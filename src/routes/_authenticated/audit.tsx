import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  ChevronDown,
  Clock,
  History,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
} from "lucide-react";

import { auditLogsQuery, type AuditLog } from "@/lib/audit";
import { initials } from "@/lib/data";
import { PageHeading } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log | Deeper Life Attendance" },
      { name: "description", content: "Audit trail of actions and changes." },
      { property: "og:title", content: "Audit Log | Deeper Life Attendance" },
      { property: "og:description", content: "Audit trail of actions and changes." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(auditLogsQuery);
  },
  component: AuditPage,
});

type FilterType = "all" | "service" | "attendance" | "member" | "account";

function AuditPage() {
  const { data: logs = [], refetch, isFetching } = useQuery(auditLogsQuery);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      const matchFilter = filter === "all" || log.entity_type === filter;
      const matchQuery =
        !q ||
        log.actor_name.toLowerCase().includes(q) ||
        (log.actor_email && log.actor_email.toLowerCase().includes(q)) ||
        (log.entity_title && log.entity_title.toLowerCase().includes(q)) ||
        log.action.toLowerCase().includes(q);
      return matchFilter && matchQuery;
    });
  }, [logs, search, filter]);

  return (
    <>
      <PageHeading
        title="Audit Trail"
        subtitle="Chronological log of activities, service changes, attendance submissions, and user actions."
        action={
          <Button
            variant="secondary"
            size="lg"
            className="h-11 sm:h-12"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* Filter and Search Controls */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by person, title, or action..."
            className="h-11 pl-9"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 overflow-x-auto">
          {(
            [
              { key: "all", label: "All Activity" },
              { key: "service", label: "Services" },
              { key: "attendance", label: "Attendance" },
              { key: "member", label: "Members" },
              { key: "account", label: "Accounts" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                filter === item.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs List */}
      {filtered.length === 0 ? (
        <div className="surface p-12 text-center">
          <History className="text-primary mx-auto h-8 w-8 opacity-60" />
          <p className="font-display mt-3 text-lg font-semibold">No audit logs found</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {search || filter !== "all"
              ? "Try adjusting your search or category filter."
              : "Actions taken across services, attendance, and members will be recorded here."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((log) => {
            const isExpanded = expandedId === log.id;
            const meta = getActionMeta(log.action);
            const formattedDate = format(parseISO(log.created_at), "EEE, d MMM yyyy · h:mm:ss a");

            return (
              <li
                key={log.id}
                className="surface overflow-hidden transition-shadow hover:shadow-sm"
              >
                <div
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 cursor-pointer select-none"
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                >
                  <div className="flex items-start gap-3.5 sm:items-center">
                    {/* Actor Avatar */}
                    <div className="bg-primary/10 text-primary font-display grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold">
                      {initials(log.actor_name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{log.actor_name}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}
                        >
                          <meta.icon className="h-3 w-3 shrink-0" />
                          {meta.label}
                        </span>
                      </div>

                      {log.entity_title && (
                        <div className="text-foreground mt-0.5 truncate text-xs font-medium sm:text-sm">
                          {log.entity_title}
                        </div>
                      )}

                      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formattedDate}
                        </span>
                        {log.actor_email && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{log.actor_email}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-muted-foreground pt-2 sm:pt-0 border-t border-border/40 sm:border-t-0">
                    <span className="capitalize">{log.entity_type}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </div>
                </div>

                {/* Expandable Details Payload */}
                {isExpanded && (
                  <div className="border-border/60 bg-secondary/30 border-t p-4 sm:p-5 text-xs">
                    <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] mb-2">
                      Event Details & Snapshot
                    </div>
                    <DetailsSummary log={log} />
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-3 text-[11px] text-muted-foreground">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function DetailsSummary({ log }: { log: AuditLog }) {
  const details = (log.details ?? {}) as Record<string, unknown>;

  if (log.action === "attendance_taken" || log.action === "attendance_updated") {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-2">
        <div className="surface p-2.5 rounded-lg text-center">
          <div className="text-muted-foreground text-[10px] uppercase">Total Present</div>
          <div className="text-primary text-base font-bold">
            {String(details.total_present ?? "-")}
          </div>
        </div>
        <div className="surface p-2.5 rounded-lg text-center">
          <div className="text-muted-foreground text-[10px] uppercase">Members</div>
          <div className="text-success text-base font-bold">
            {String(details.members_present ?? "-")}
          </div>
        </div>
        <div className="surface p-2.5 rounded-lg text-center">
          <div className="text-muted-foreground text-[10px] uppercase">Visitors</div>
          <div className="text-accent-foreground text-base font-bold">
            {String(details.visitors ?? "0")}
          </div>
        </div>
        <div className="surface p-2.5 rounded-lg text-center">
          <div className="text-muted-foreground text-[10px] uppercase">Absentees</div>
          <div className="text-destructive text-base font-bold">
            {String(details.members_absent ?? "-")}
          </div>
        </div>
      </div>
    );
  }

  if (log.action === "service_updated" && details.old && details.new) {
    const oldD = details.old as Record<string, unknown>;
    const newD = details.new as Record<string, unknown>;
    return (
      <div className="surface p-3 rounded-lg mb-2 space-y-1">
        <div>
          <span className="text-muted-foreground">Name:</span> {String(oldD.name)} →{" "}
          <strong className="text-foreground">{String(newD.name)}</strong>
        </div>
        <div>
          <span className="text-muted-foreground">Date:</span> {String(oldD.date)} →{" "}
          <strong className="text-foreground">{String(newD.date)}</strong>
        </div>
      </div>
    );
  }

  if (log.action === "reminder_sent") {
    return (
      <div className="surface p-3 rounded-lg mb-2 space-y-1.5 border-l-4 border-amber-500">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
            Automated Reminder Sent:
          </span>
          <span className="text-sm font-semibold text-foreground">
            {String(details.service_name || log.entity_title || "Sunday Service")}
          </span>
        </div>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-2 items-center">
          {details.recipients_count !== undefined && (
            <span>
              Sent to <strong>{String(details.recipients_count)}</strong> recipient(s)
            </span>
          )}
          {details.service_date && <span>· Service Date: {String(details.service_date)}</span>}
        </div>
      </div>
    );
  }

  return null;
}

function getActionMeta(action: string) {
  switch (action) {
    case "reminder_sent":
      return {
        label: "Reminder Sent",
        icon: Mail,
        badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      };
    case "service_created":
      return {
        label: "Service Created",
        icon: Plus,
        badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      };
    case "service_updated":
      return {
        label: "Service Updated",
        icon: Pencil,
        badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
      };
    case "service_deleted":
      return {
        label: "Service Deleted",
        icon: Trash2,
        badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
      };
    case "attendance_taken":
      return {
        label: "Attendance Taken",
        icon: UserCheck,
        badgeClass: "bg-primary/15 text-primary",
      };
    case "attendance_updated":
      return {
        label: "Attendance Resubmitted",
        icon: Pencil,
        badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
      };
    case "member_created":
      return {
        label: "Member Added",
        icon: UserPlus,
        badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      };
    case "member_updated":
      return {
        label: "Member Updated",
        icon: Pencil,
        badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
      };
    case "member_deleted":
      return {
        label: "Member Removed",
        icon: Trash2,
        badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
      };
    case "role_updated":
      return {
        label: "Role Changed",
        icon: KeyRound,
        badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      };
    default:
      return {
        label: action.replace(/_/g, " "),
        icon: History,
        badgeClass: "bg-secondary text-secondary-foreground",
      };
  }
}
