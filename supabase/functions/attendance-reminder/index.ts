import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.13";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderRequest {
  force?: boolean;
  testEmail?: string;
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
    const appUrl = (Deno.env.get("APP_URL") || "https://dlbcpontypriddattendance.vercel.app").replace(/\/+$/, "");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: ReminderRequest = {};
    try {
      if (req.method === "POST") {
        body = await req.json();
      }
    } catch {
      // Body may be empty on GET / cron trigger
    }

    const timeZone = "Europe/London";
    const now = new Date();

    // Format date, weekday, and hour in Europe/London timezone
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    const isSunday = partMap.weekday === "Sun";
    const londonHour = parseInt(partMap.hour || "0", 10);
    const todayStr = `${partMap.year}-${partMap.month}-${partMap.day}`;

    // If not forced: check if Sunday and >= 3:00 PM (15:00) London time
    if (!body.force) {
      if (!isSunday) {
        return new Response(
          JSON.stringify({
            message: "Not Sunday in Europe/London. Skipped reminder check.",
            todayStr,
            weekday: partMap.weekday,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
      if (londonHour < 15) {
        return new Response(
          JSON.stringify({
            message: `Before 3:00 PM Europe/London time (current hour: ${londonHour}:00). Skipped.`,
            todayStr,
            londonHour,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
    }

    // 1. Fetch today's services
    const { data: services, error: serviceError } = await supabase
      .from("services")
      .select("id, name, date, type")
      .eq("date", todayStr);

    if (serviceError) {
      throw new Error(`Failed to query services: ${serviceError.message}`);
    }

    // If no services found for today and not forced, skip
    if ((!services || services.length === 0) && !body.force) {
      return new Response(
        JSON.stringify({ message: "No services scheduled for today.", date: todayStr }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Find services that have NO attendance recorded
    const pendingServices = [];
    for (const s of services || []) {
      const { count, error: countErr } = await supabase
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("service_id", s.id);

      if (!countErr && (count === null || count === 0)) {
        pendingServices.push(s);
      }
    }

    // If all services for today have attendance recorded and not forced, skip
    if (pendingServices.length === 0 && !body.force) {
      return new Response(
        JSON.stringify({ message: "All services for today have attendance taken.", date: todayStr }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Check if a reminder was already sent in the last 15 minutes to avoid duplicate floods
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentLogs } = await supabase
      .from("audit_logs")
      .select("id, created_at")
      .eq("action", "reminder_sent")
      .gte("created_at", fifteenMinutesAgo)
      .limit(1);

    if (recentLogs && recentLogs.length > 0 && !body.force) {
      return new Response(
        JSON.stringify({ message: "Reminder was already sent recently (< 15 mins ago). Skipping." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // 2. Fetch recipient emails
    let recipientEmails: string[] = [];

    if (body.testEmail) {
      recipientEmails = [body.testEmail];
    } else {
      const { data: authUsers, error: userError } = await supabase.auth.admin.listUsers();
      if (!userError && authUsers?.users) {
        recipientEmails = authUsers.users
          .map((u) => u.email)
          .filter((email): email is string => Boolean(email));
      }
    }

    // Deduplicate and filter out nulls/blanks
    recipientEmails = Array.from(new Set(recipientEmails.filter(Boolean)));

    if (recipientEmails.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recipient emails found to notify." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const targetService = pendingServices[0] || null;

    const attendanceLink = targetService?.id
      ? `${appUrl}/attendance/${targetService.id}`
      : `${appUrl}/dashboard`;

    const serviceDisplayName = targetService?.name || "Sunday Service";
    const serviceDisplayDate = targetService?.date || todayStr;

    // 3. Email Template
    const emailSubject = `⚠️ Reminder: Sunday Service Attendance Pending (${serviceDisplayName})`;
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sunday Attendance Reminder</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="background-color: #4f46e5; padding: 28px 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.025em;">
        Deeper Life Pontypridd Attendance
      </h1>
      <p style="color: #e0e7ff; margin: 6px 0 0 0; font-size: 14px;">
        Sunday Service Attendance Reminder
      </p>
    </div>
    
    <div style="padding: 28px 24px;">
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px;">
        <strong style="color: #991b1b; font-size: 15px; display: block;">⚠️ Attendance Pending</strong>
        <p style="color: #b91c1c; margin: 4px 0 0 0; font-size: 13px;">
          The attendance for <strong>${serviceDisplayName}</strong> (${serviceDisplayDate}) has not been submitted yet.
        </p>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
        Hello, this is an automated reminder to submit today's Sunday service attendance record. Accurate records ensure all brethren and visitors are tracked in church records.
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${attendanceLink}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.3);">
          Take Attendance Now →
        </a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 24px 0 0 0;">
        Reminders will automatically stop once attendance has been submitted.
      </p>
    </div>

    <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
      Deeper Life Bible Church Pontypridd · Attendance Management System
    </div>
  </div>
</body>
</html>
    `;

    let sendMethod = "gmail_smtp";
    let messageId = "";

    // 4. Send using Gmail SMTP
    if (gmailUser && gmailPass) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      const info = await transporter.sendMail({
        from: `"Deeper Life Pontypridd Attendance" <${gmailUser}>`,
        to: recipientEmails.join(", "),
        subject: emailSubject,
        html: emailHtml,
      });

      messageId = info.messageId;
    } else if (resendApiKey) {
      sendMethod = "resend";
      const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") || "Deeper Life Pontypridd Attendance <onboarding@resend.dev>";
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: recipientEmails,
          subject: emailSubject,
          html: emailHtml,
        }),
      });
      const resendData = await resendRes.json();
      if (!resendRes.ok) throw new Error(JSON.stringify(resendData));
      messageId = resendData.id;
    } else {
      throw new Error("No email provider configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD.");
    }

    // 5. Log reminder into audit_logs
    await supabase.from("audit_logs").insert({
      action: "reminder_sent",
      entity_type: "attendance",
      entity_id: targetService?.id || null,
      entity_title: `Sunday Reminder: ${serviceDisplayName}`,
      actor_name: "Automated Reminder System",
      actor_email: gmailUser || "system@deeper-reach.local",
      details: {
        recipients_count: recipientEmails.length,
        recipients: recipientEmails,
        service_name: serviceDisplayName,
        service_date: serviceDisplayDate,
        send_method: sendMethod,
        message_id: messageId,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reminder sent to ${recipientEmails.length} recipients via ${sendMethod}.`,
        messageId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("Attendance reminder error:", errMessage);
    return new Response(
      JSON.stringify({ error: errMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
