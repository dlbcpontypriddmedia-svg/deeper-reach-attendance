import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { addMonths, format, isSameMonth, parseISO } from "date-fns";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Phone,
  HeartHandshake,
  CheckCircle2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  attendanceQuery,
  buildHouseholds,
  getServiceVisitorTotal,
  membersQuery,
  servicesQuery,
} from "@/lib/data";
import { PageHeading } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Monthly Analysis | Deeper Life Attendance" },
      {
        name: "description",
        content: "Attendance trends by member, household and service type, month by month.",
      },
      { property: "og:title", content: "Monthly Analysis | Deeper Life Attendance" },
      {
        property: "og:description",
        content: "Attendance trends by member, household and service type.",
      },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(servicesQuery);
  },
  component: ReportsPage,
});

type View = "member" | "household" | "service_type";

function ReportsPage() {
  const { data: services } = useSuspenseQuery(servicesQuery);
  const members = useQuery(membersQuery);
  const attendance = useQuery(attendanceQuery);

  const [month, setMonth] = useState(() => new Date());
  const [view, setView] = useState<View>("service_type");
  const [focusId, setFocusId] = useState<string>("all");
  const [scope, setScope] = useState<"everyone" | "workers">("everyone");

  const households = useMemo(() => buildHouseholds(members.data ?? []), [members.data]);
  const workerIds = useMemo(
    () => new Set((members.data ?? []).filter((m) => m.is_worker).map((m) => m.id)),
    [members.data],
  );

  const monthServices = useMemo(
    () =>
      services
        .filter((s) => isSameMonth(parseISO(s.date), month))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [services, month],
  );
  const monthServiceIds = new Set(monthServices.map((s) => s.id));
  const records = (attendance.data ?? []).filter(
    (r) =>
      monthServiceIds.has(r.service_id) && (scope === "everyone" || workerIds.has(r.member_id)),
  );

  const focusMemberIds = useMemo(() => {
    if (focusId === "all") return null;
    if (view === "member") return new Set([focusId]);
    if (view === "household") {
      const household = households.find((h) => h.id === focusId);
      return new Set((household?.members ?? []).map((m) => m.id));
    }
    return null;
  }, [focusId, view, households]);

  const scoped = focusMemberIds ? records.filter((r) => focusMemberIds.has(r.member_id)) : records;

  const trend = monthServices.map((service) => {
    const rows = scoped.filter((r) => r.service_id === service.id);
    const memberPresent = rows.filter((r) => r.status === "present").length;
    const visitors = !focusMemberIds && scope === "everyone" ? getServiceVisitorTotal(service) : 0;
    const present = memberPresent + visitors;
    const total = rows.length + visitors;
    return {
      label: format(parseISO(service.date), "d MMM"),
      name: service.name,
      type: service.type,
      present,
      total,
      percent: total ? Math.round((present / total) * 100) : 0,
    };
  });

  const byType = (["recurring", "one_off"] as const).map((type) => {
    const matchingServices = monthServices.filter((s) => s.type === type);
    const rows = scoped.filter((r) => matchingServices.some((s) => s.id === r.service_id));
    const memberPresent = rows.filter((r) => r.status === "present").length;
    const visitors =
      !focusMemberIds && scope === "everyone"
        ? matchingServices.reduce((sum, s) => sum + getServiceVisitorTotal(s), 0)
        : 0;
    const present = memberPresent + visitors;
    const total = rows.length + visitors;
    return {
      label: type === "recurring" ? "Recurring" : "One-off",
      percent: total ? Math.round((present / total) * 100) : 0,
      services: matchingServices.length,
    };
  });

  const totalVisitors =
    !focusMemberIds && scope === "everyone"
      ? monthServices.reduce((sum, s) => sum + getServiceVisitorTotal(s), 0)
      : 0;
  const totalRows = scoped.length + totalVisitors;
  const totalPresent = scoped.filter((r) => r.status === "present").length + totalVisitors;
  const overall = totalRows ? Math.round((totalPresent / totalRows) * 100) : 0;

  const concerns = useMemo(() => {
    // Only evaluate services where attendance records have actually been recorded
    const recordedServiceIds = new Set((attendance.data ?? []).map((r) => r.service_id));
    const activeRecordedServices = monthServices.filter((s) => recordedServiceIds.has(s.id));
    const totalRecordedCount = activeRecordedServices.length;

    // If fewer than 2 services recorded in the evaluated period, don't flag anyone (insufficient sample size)
    if (totalRecordedCount < 2) {
      return [];
    }

    return (members.data ?? [])
      .filter((member) => scope === "everyone" || workerIds.has(member.id))
      .map((member) => {
        const rows = activeRecordedServices
          .map((s) => records.find((r) => r.service_id === s.id && r.member_id === member.id))
          .filter(Boolean);

        const total = rows.length;
        if (total === 0) return null;

        const presentCount = rows.filter((r) => r!.status === "present").length;
        const percent = Math.round((presentCount / total) * 100);

        // Calculate consecutive absences ending at the most recent service
        let consecutiveAbsences = 0;
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (rows[i]!.status === "absent") {
            consecutiveAbsences += 1;
          } else {
            break;
          }
        }

        const isLatestAbsent = rows[rows.length - 1]?.status === "absent";
        const household = households.find((h) => h.members.some((m) => m.id === member.id));

        // Strict Criteria for Genuine Follow-Up:
        // 1. Critical: Missed 3+ consecutive services in a row
        const isProlongedAbsence = consecutiveAbsences >= 3;

        // 2. Critical: Complete Inactivity (0% attendance over all recorded services)
        const isCompleteInactivity = total >= 2 && presentCount === 0;

        // 3. Chronic Low Attendance: At least 3 services recorded, attendance < 40%, AND absent in the most recent service
        const isChronicLowAttendance = total >= 3 && percent < 40 && isLatestAbsent;

        // 4. In a 2-service month: Missed both services
        const isMissedBothInTwo = total === 2 && presentCount === 0;

        if (
          !isProlongedAbsence &&
          !isCompleteInactivity &&
          !isChronicLowAttendance &&
          !isMissedBothInTwo
        ) {
          return null;
        }

        // Determine severity level and human-readable reason
        let severity: "critical" | "warning" = "warning";
        let reason = "";

        if (isCompleteInactivity || consecutiveAbsences >= 3) {
          severity = "critical";
          if (consecutiveAbsences >= 3) {
            reason = `Missed last ${consecutiveAbsences} services in a row`;
          } else {
            reason = `Absent for all ${total} services this month`;
          }
        } else if (isChronicLowAttendance) {
          severity = "warning";
          reason = `Attended only ${presentCount} of ${total} services (${percent}%)`;
        } else {
          severity = "warning";
          reason = `Missed last ${consecutiveAbsences} services`;
        }

        return {
          id: member.id,
          name: member.name,
          contact: member.contact || null,
          household: household?.label ?? "Unknown",
          total,
          presentCount,
          percent,
          streak: consecutiveAbsences,
          severity,
          reason,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => {
        if (a.severity === "critical" && b.severity !== "critical") return -1;
        if (b.severity === "critical" && a.severity !== "critical") return 1;
        return b.streak - a.streak || a.percent - b.percent;
      })
      .slice(0, 15);
  }, [members.data, records, monthServices, households, scope, workerIds, attendance.data]);

  const options =
    view === "member"
      ? (members.data ?? []).map((m) => ({ id: m.id, label: m.name }))
      : view === "household"
        ? households.map((h) => ({ id: h.id, label: h.label }))
        : [];

  return (
    <>
      <PageHeading
        title="Monthly analysis"
        action={
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="icon"
              aria-label="Previous month"
              onClick={() => setMonth((m) => addMonths(m, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-display w-36 text-center text-base font-semibold">
              {format(month, "MMMM yyyy")}
            </span>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Next month"
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:max-w-xs">
        {(["everyone", "workers"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setScope(option)}
            className={`rounded-xl border px-3 py-3 text-sm capitalize transition-colors ${
              scope === option
                ? "border-primary bg-primary/8 text-primary font-semibold"
                : "border-border text-muted-foreground"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Services" value={monthServices.length} />
        <Metric label="Present" value={totalPresent} />
        <Metric label="Attendance" value={`${overall}%`} />
      </div>

      <Tabs
        value={view}
        onValueChange={(value) => {
          setView(value as View);
          setFocusId("all");
        }}
        className="mb-4"
      >
        <TabsList className="h-11">
          <TabsTrigger value="service_type">Service type</TabsTrigger>
          <TabsTrigger value="household">Household</TabsTrigger>
          <TabsTrigger value="member">Member</TabsTrigger>
        </TabsList>
      </Tabs>

      {options.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <FilterChip active={focusId === "all"} onClick={() => setFocusId("all")}>
            Everyone
          </FilterChip>
          {options.map((option) => (
            <FilterChip
              key={option.id}
              active={focusId === option.id}
              onClick={() => setFocusId(option.id)}
            >
              {option.label}
            </FilterChip>
          ))}
        </div>
      )}

      {monthServices.length === 0 ? (
        <div className="surface text-muted-foreground p-10 text-center text-sm">
          No services in {format(month, "MMMM yyyy")}.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="surface p-5 lg:col-span-2">
            <h2 className="text-lg font-semibold">Attendance trend</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`${value}%`, "Present"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="percent"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "var(--accent)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface p-5">
            <h2 className="text-lg font-semibold">Recurring vs one-off</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byType} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`${value}%`, "Present"]}
                  />
                  <Bar dataKey="percent" fill="var(--primary)" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface p-5 lg:col-span-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <AlertTriangle className="text-amber-500 h-5 w-5" /> Requires Follow-up
                  {concerns.length > 0 && (
                    <span className="rounded-full bg-destructive/15 text-destructive px-2.5 py-0.5 text-xs font-semibold">
                      {concerns.length} {concerns.length === 1 ? "person" : "people"}
                    </span>
                  )}
                </h2>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Members with prolonged absence streaks (3+ in a row) or chronic low attendance.
                </p>
              </div>
            </div>

            {concerns.length === 0 ? (
              <div className="py-8 text-center space-y-1">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 opacity-80" />
                <p className="text-sm font-semibold text-foreground">No urgent follow-ups</p>
                <p className="text-xs text-muted-foreground">
                  All active members are attending faithfully or are up to date.
                </p>
              </div>
            ) : (
              <ul className="divide-border divide-y">
                {concerns.map((row) => {
                  const isCritical = row.severity === "critical";

                  return (
                    <li
                      key={row.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-bold ${
                            isCritical
                              ? "bg-destructive/15 text-destructive"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {isCritical ? "!" : "•"}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {row.name}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                isCritical
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {row.reason}
                            </span>
                          </div>

                          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                            <span>Household: {row.household}</span>
                            {row.contact && (
                              <>
                                <span>·</span>
                                <a
                                  href={`tel:${row.contact}`}
                                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                                >
                                  <Phone className="h-3 w-3" />
                                  {row.contact}
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t border-border/30 sm:border-t-0">
                        <div className="text-right">
                          <div className="text-[10px] uppercase text-muted-foreground font-medium">
                            Attendance
                          </div>
                          <div className="font-semibold text-sm text-foreground">
                            {row.presentCount} / {row.total} services
                          </div>
                        </div>
                        <span
                          className={`font-display w-14 text-right text-lg font-bold ${
                            isCritical ? "text-destructive" : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {row.percent}%
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="surface p-4">
      <div className="text-muted-foreground text-[11px] tracking-[0.16em] uppercase">{label}</div>
      <div className="font-display text-primary mt-1 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
