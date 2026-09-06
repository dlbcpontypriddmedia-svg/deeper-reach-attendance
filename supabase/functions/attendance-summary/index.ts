import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.13";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SummaryRequest {
  type?: "sunday" | "monthly";
  force?: boolean;
  date?: string; // e.g. YYYY-MM-DD
  month?: string; // e.g. YYYY-MM
  targetEmail?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const gmailUser = Deno.env.get("GMAIL_USER") || "dlbcpontypriddmedia@gmail.com";
    const gmailPass = (Deno.env.get("GMAIL_APP_PASSWORD") || "oqspdijxubcttglm").replace(/\s+/g, "");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: SummaryRequest = {};
    try {
      if (req.method === "POST") {
        body = await req.json();
      }
    } catch {
      // Empty body
    }

    // Read dynamic settings from app_settings table
    const { data: dbSettings } = await supabase.from("app_settings").select("id, value");
    const settingsMap: Record<string, any> = {};
    if (dbSettings) {
      for (const row of dbSettings) {
        settingsMap[row.id] = row.value;
      }
    }

    const generalSettings = settingsMap["general"] || {};
    const automationSettings = settingsMap["automation"] || settingsMap["cron_jobs"] || {};

    const configuredEmail = generalSettings.pastor_email?.trim();
    const recipient = body.targetEmail || configuredEmail;

    if (!recipient) {
      return new Response(
        JSON.stringify({
          error: "No recipient email configured. Please set the Pastor/Leadership Email in Settings.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const timeZone = "Europe/London";
    const now = new Date();

    // Time formatting in Europe/London
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    const todayStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
    const currentMonthStr = `${partMap.year}-${partMap.month}`;

    const reportType = body.type || (partMap.weekday === "Sun" ? "sunday" : "monthly");

    // Check if report cron is enabled in settings
    if (!body.force) {
      if (reportType === "sunday" && automationSettings.sunday_summary_enabled === false) {
        return new Response(
          JSON.stringify({ message: "Sunday summary email is disabled in settings.", skipped: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
      if (reportType === "monthly" && automationSettings.monthly_report_enabled === false) {
        return new Response(
          JSON.stringify({ message: "Monthly summary report is disabled in settings.", skipped: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
    }

    // ==========================================
    // 1. SUNDAY ATTENDANCE SUMMARY (EXACT FORMAT)
    // ==========================================
    if (reportType === "sunday") {
      let targetDate = body.date || todayStr;

      let { data: services, error: sErr } = await supabase
        .from("services")
        .select("*")
        .eq("date", targetDate);

      if (sErr) throw new Error(`Error fetching services: ${sErr.message}`);

      // If no services on target date (e.g. today has no services yet or test trigger), fetch the latest service
      if (!services || services.length === 0) {
        const { data: latestServices } = await supabase
          .from("services")
          .select("*")
          .order("date", { ascending: false })
          .limit(1);

        if (latestServices && latestServices.length > 0) {
          services = latestServices;
        }
      }

      if (!services || services.length === 0) {
        return new Response(
          JSON.stringify({ message: "No services found in database.", date: targetDate }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }

      const service = services[0];

      const { data: records, error: rErr } = await supabase
        .from("attendance_records")
        .select("status, member_id")
        .eq("service_id", service.id);

      if (rErr) throw new Error(`Error fetching attendance records: ${rErr.message}`);

      const { data: members, error: mErr } = await supabase
        .from("members")
        .select("id, name, gender, category, is_worker");

      if (mErr) throw new Error(`Error fetching members: ${mErr.message}`);

      const memberMap = new Map((members || []).map((m) => [m.id, m]));

      let adultM = 0;
      let adultF = 0;
      let youthM = 0;
      let youthF = 0;
      let childM = 0;
      let childF = 0;

      for (const rec of records || []) {
        if (rec.status !== "present") continue;
        const m = memberMap.get(rec.member_id);
        if (!m) continue;

        const cat = m.category === "young_adult" ? "adult" : m.category;
        const isMale = m.gender === "male";

        if (cat === "adult") {
          if (isMale) adultM += 1;
          else adultF += 1;
        } else if (cat === "youth") {
          if (isMale) youthM += 1;
          else youthF += 1;
        } else if (cat === "child") {
          if (isMale) childM += 1;
          else childF += 1;
        }
      }

      // Add visitor counts
      adultM += service.visitor_adult_male || 0;
      adultF += service.visitor_adult_female || 0;
      youthM += service.visitor_youth_male || 0;
      youthF += service.visitor_youth_female || 0;
      childM += service.visitor_child_male || 0;
      childF += service.visitor_child_female || 0;

      const total = adultM + adultF + youthM + youthF + childM + childF;

      const [year, month, day] = service.date.split("-");
      const serviceDateFormatted = `${day}/${month}/${year.slice(-2)}`;

      // STRICT FORMAT REQUESTED:
      // Sunday Attendance for 06/09/26
      //
      // Adult (M=8; F=5)
      // Youth (M=3; F=3)
      // Children (M=2; F=4)
      //
      // Total = 25
      const exactSundayText = `Sunday Attendance for ${serviceDateFormatted}\n\nAdult (M=${adultM}; F=${adultF})\nYouth (M=${youthM}; F=${youthF})\nChildren (M=${childM}; F=${childF})\n\nTotal = ${total}\n`;

      const emailSubject = `Sunday Attendance for ${serviceDateFormatted}`;

      let messageId = "";
      if (gmailUser && gmailPass) {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: gmailUser, pass: gmailPass },
        });

        const info = await transporter.sendMail({
          from: `"Deeper Life Pontypridd Attendance" <${gmailUser}>`,
          to: recipient,
          subject: emailSubject,
          text: exactSundayText,
        });
        messageId = info.messageId;
      } else if (resendApiKey) {
        const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") || "Deeper Life Pontypridd Attendance <onboarding@resend.dev>";
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [recipient],
            subject: emailSubject,
            text: exactSundayText,
          }),
        });
        const resData = await resendRes.json();
        messageId = resData.id;
      }

      await supabase.from("audit_logs").insert({
        action: "summary_email_sent",
        entity_type: "attendance_summary",
        entity_id: service.id,
        entity_title: `Sunday Summary: ${serviceDateFormatted}`,
        actor_name: "Automated Summary System",
        actor_email: gmailUser || "system@deeper-reach.local",
        details: {
          recipient,
          report_type: "sunday",
          service_date: serviceDateFormatted,
          adult_m: adultM,
          adult_f: adultF,
          youth_m: youthM,
          youth_f: youthF,
          child_m: childM,
          child_f: childF,
          total,
          message_id: messageId,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          reportType: "sunday",
          recipient,
          formattedText: exactSundayText,
          messageId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // ==========================================
    // 2. MONTHLY ATTENDANCE BREAKDOWN (WORKERS PRIORITIZED)
    // ==========================================
    const targetMonth = body.month || currentMonthStr; // YYYY-MM
    const startDate = `${targetMonth}-01`;
    const endDate = `${targetMonth}-31`;

    const { data: monthServices, error: msErr } = await supabase
      .from("services")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (msErr) throw new Error(`Error fetching monthly services: ${msErr.message}`);

    const { data: allMembers, error: amErr } = await supabase
      .from("members")
      .select("id, name, gender, category, is_worker, contact")
      .order("name", { ascending: true });

    if (amErr) throw new Error(`Error fetching members: ${amErr.message}`);

    const serviceIds = (monthServices || []).map((s) => s.id);
    let allMonthRecords: { service_id: string; member_id: string; status: string }[] = [];

    if (serviceIds.length > 0) {
      const { data: recs, error: recsErr } = await supabase
        .from("attendance_records")
        .select("service_id, member_id, status")
        .in("service_id", serviceIds);

      if (recsErr) throw new Error(`Error fetching monthly records: ${recsErr.message}`);
      allMonthRecords = recs || [];
    }

    const memberPresentMap = new Map<string, number>();
    for (const rec of allMonthRecords) {
      if (rec.status === "present") {
        memberPresentMap.set(rec.member_id, (memberPresentMap.get(rec.member_id) || 0) + 1);
      }
    }

    const totalServicesCount = monthServices ? monthServices.length : 0;

    const workers = (allMembers || []).filter((m) => m.is_worker);
    const nonWorkers = (allMembers || []).filter((m) => !m.is_worker);

    const [mYear, mMonth] = targetMonth.split("-");
    const monthDateObj = new Date(parseInt(mYear, 10), parseInt(mMonth, 10) - 1, 1);
    const monthName = monthDateObj.toLocaleString("en-GB", { month: "long", year: "numeric" });

    let monthlyText = `Monthly Attendance Summary & Breakdown — ${monthName}\n`;
    monthlyText += `Total Services Held: ${totalServicesCount}\n`;
    monthlyText += `==================================================\n\n`;

    // 1. Workers Section (Prioritized)
    monthlyText += `⭐ CHURCH WORKERS (${workers.length} registered)\n`;
    monthlyText += `--------------------------------------------------\n`;
    if (workers.length === 0) {
      monthlyText += `No workers registered.\n`;
    } else {
      for (const w of workers) {
        const presentCount = memberPresentMap.get(w.id) || 0;
        const pct = totalServicesCount ? Math.round((presentCount / totalServicesCount) * 100) : 0;
        monthlyText += `• [WORKER] ${w.name}: ${presentCount}/${totalServicesCount} services (${pct}%)\n`;
      }
    }

    monthlyText += `\n`;

    // 2. General Members Section
    monthlyText += `👥 GENERAL MEMBERS (${nonWorkers.length} registered)\n`;
    monthlyText += `--------------------------------------------------\n`;
    for (const m of nonWorkers) {
      const presentCount = memberPresentMap.get(m.id) || 0;
      const pct = totalServicesCount ? Math.round((presentCount / totalServicesCount) * 100) : 0;
      const cat = m.category === "young_adult" ? "Adult" : m.category.charAt(0).toUpperCase() + m.category.slice(1);
      monthlyText += `• ${m.name} (${cat}): ${presentCount}/${totalServicesCount} services (${pct}%)\n`;
    }

    const monthlySubject = `Monthly Attendance Report — ${monthName}`;

    let messageId = "";
    if (gmailUser && gmailPass) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      });

      const info = await transporter.sendMail({
        from: `"Deeper Life Pontypridd Attendance" <${gmailUser}>`,
        to: recipient,
        subject: monthlySubject,
        text: monthlyText,
      });
      messageId = info.messageId;
    }

    await supabase.from("audit_logs").insert({
      action: "summary_email_sent",
      entity_type: "monthly_summary",
      entity_id: null,
      entity_title: `Monthly Summary: ${monthName}`,
      actor_name: "Automated Summary System",
      actor_email: gmailUser || "system@deeper-reach.local",
      details: {
        recipient,
        report_type: "monthly",
        month: monthName,
        total_services: totalServicesCount,
        workers_count: workers.length,
        members_count: nonWorkers.length,
        message_id: messageId,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        reportType: "monthly",
        recipient,
        month: monthName,
        messageId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("Summary email error:", errMessage);
    return new Response(
      JSON.stringify({ error: errMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
