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
  Send,
  Trash2,
  UserCheck,
  UserPlus,
} from "lucide-react";

import { auditLogsQuery, type AuditLog } from "@/lib/audit";
import { CATEGORY_LABELS, initials, normalizeMemberCategory, type MemberCategory } from "@/lib/data";
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
                    <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] mb-2.5">
                      Event Details & Snapshot
                    </div>
                    <DetailsSummary log={log} />
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

function formatCategory(category?: unknown): string {
  if (typeof category === "string" && category in CATEGORY_LABELS) {
    return CATEGORY_LABELS[normalizeMemberCategory(category as MemberCategory)] || category;
  }
  return String(category ?? "-");
}

function DetailsSummary({ log }: { log: AuditLog }) {
  const details = (log.details ?? {}) as Record<string, unknown>;

  if (log.action === "attendance_taken" || log.action === "attendance_updated") {
    const isResubmission =
      log.action === "attendance_updated" ||
      (typeof details.submission_count === "number" && details.submission_count > 1);
    return (
      <div className="space-y-2">
        {isResubmission && (
          <div className="inline-flex items-center gap-1.5 rounded-md bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300">
            Resubmission #{String(details.submission_count ?? 1)}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="surface p-2.5 rounded-lg text-center">
            <div className="text-muted-foreground text-[10px] uppercase font-medium">Total Present</div>
            <div className="text-primary text-base font-bold">{String(details.total_present ?? "-")}</div>
          </div>
          <div className="surface p-2.5 rounded-lg text-center">
            <div className="text-muted-foreground text-[10px] uppercase font-medium">Members</div>
            <div className="text-success text-base font-bold">{String(details.members_present ?? "-")}</div>
          </div>
          <div className="surface p-2.5 rounded-lg text-center">
            <div className="text-muted-foreground text-[10px] uppercase font-medium">Visitors</div>
            <div className="text-accent-foreground text-base font-bold">{String(details.visitors ?? "0")}</div>
          </div>
          <div className="surface p-2.5 rounded-lg text-center">
            <div className="text-muted-foreground text-[10px] uppercase font-medium">Absentees</div>
            <div className="text-destructive text-base font-bold">{String(details.members_absent ?? "-")}</div>
          </div>
        </div>
      </div>
    );
  }

  if (log.action === "reminder_sent") {
    const recipients = Array.isArray(details.recipients) ? (details.recipients as string[]) : [];
    const method =
      details.send_method === "gmail_smtp"
        ? "Gmail SMTP (Church Mail)"
        : details.send_method === "resend"
          ? "Resend API"
          : String(details.send_method || "Email");

    return (
      <div className="surface p-3.5 rounded-xl border-l-4 border-amber-500 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
              Automated Reminder:
            </span>
            <span className="text-sm font-semibold text-foreground">
              {String(details.service_name || log.entity_title || "Sunday Service")}
            </span>
          </div>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            {method}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {details.service_date && (
            <span>
              Service Date: <strong className="text-foreground">{String(details.service_date)}</strong>
            </span>
          )}
          {details.recipients_count !== undefined && (
            <span>
              Total Recipients: <strong className="text-foreground">{String(details.recipients_count)}</strong>
            </span>
          )}
        </div>

        {recipients.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-border/50">
            <div className="text-[11px] font-medium text-muted-foreground">Delivered to:</div>
            <div className="flex flex-wrap gap-1.5">
              {recipients.map((email, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  {email}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (log.action === "member_created") {
    return (
      <div className="surface p-3.5 rounded-xl border-l-4 border-emerald-500 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
            Member Added:
          </span>
          <strong className="text-foreground text-sm font-semibold">
            {String(details.name || log.entity_title || "Unknown")}
          </strong>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {details.category && (
            <span className="rounded bg-secondary px-2 py-0.5 font-medium text-foreground">
              {formatCategory(details.category)}
            </span>
          )}
          {details.gender && (
            <span className="rounded bg-secondary px-2 py-0.5 capitalize font-medium text-foreground">
              {String(details.gender)}
            </span>
          )}
          {details.is_worker && (
            <span className="rounded bg-primary/10 text-primary px-2 py-0.5 font-semibold text-[11px]">
              Worker
            </span>
          )}
          {details.contact && (
            <span className="text-muted-foreground text-xs">
              · Contact: {String(details.contact)}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (log.action === "member_deleted") {
    return (
      <div className="surface p-3.5 rounded-xl border-l-4 border-rose-500 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wide">
            Member Removed:
          </span>
          <strong className="text-foreground text-sm font-semibold">
            {String(details.name || log.entity_title || "Unknown")}
          </strong>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {details.category && (
            <span className="rounded bg-secondary px-2 py-0.5 font-medium text-foreground">
              {formatCategory(details.category)}
            </span>
          )}
          {details.gender && (
            <span className="rounded bg-secondary px-2 py-0.5 capitalize font-medium text-foreground">
              {String(details.gender)}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (log.action === "member_updated" && (details.old || details.new)) {
    const oldD = (details.old ?? {}) as Record<string, unknown>;
    const newD = (details.new ?? {}) as Record<string, unknown>;
    return (
      <div className="surface p-3.5 rounded-xl border-l-4 border-sky-500 space-y-2">
        <div className="text-xs font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wide">
          Member Changes: <strong className="text-foreground font-semibold lowercase tracking-normal">{String(newD.name || oldD.name || log.entity_title)}</strong>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {oldD.name !== newD.name && (
            <div>
              <span className="text-muted-foreground">Name:</span> {String(oldD.name)} → <strong className="text-foreground">{String(newD.name)}</strong>
            </div>
          )}
          {oldD.category !== newD.category && (
            <div>
              <span className="text-muted-foreground">Category:</span> {formatCategory(oldD.category)} → <strong className="text-foreground">{formatCategory(newD.category)}</strong>
            </div>
          )}
          {oldD.gender !== newD.gender && (
            <div>
              <span className="text-muted-foreground">Gender:</span> {String(oldD.gender)} → <strong className="text-foreground">{String(newD.gender)}</strong>
            </div>
          )}
          {oldD.is_worker !== newD.is_worker && (
            <div>
              <span className="text-muted-foreground">Worker Status:</span> {oldD.is_worker ? "Worker" : "Member"} → <strong className="text-foreground">{newD.is_worker ? "Worker" : "Member"}</strong>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (log.action === "service_created") {
    return (
      <div className="surface p-3.5 rounded-xl border-l-4 border-emerald-500 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
            Service Created:
          </span>
          <strong className="text-foreground text-sm font-semibold">{String(details.name || log.entity_title)}</strong>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {details.date && <span>Date: <strong className="text-foreground">{String(details.date)}</strong></span>}
          {details.type && <span className="capitalize">· Type: <strong className="text-foreground">{String(details.type)}</strong></span>}
          {typeof details.count === "number" && details.count > 1 && (
            <span>· ({details.count} recurring services generated)</span>
          )}
        </div>
      </div>
    );
  }

  if (log.action === "service_updated" && details.old && details.new) {
    const oldD = details.old as Record<string, unknown>;
    const newD = details.new as Record<string, unknown>;
    return (
      <div className="surface p-3.5 rounded-xl border-l-4 border-sky-500 space-y-1">
        <div className="text-xs font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wide mb-1">
          Service Updated
        </div>
        {oldD.name !== newD.name && (
          <div>
            <span className="text-muted-foreground">Name:</span> {String(oldD.name)} →{" "}
            <strong className="text-foreground">{String(newD.name)}</strong>
          </div>
        )}
        {oldD.date !== newD.date && (
          <div>
            <span className="text-muted-foreground">Date:</span> {String(oldD.date)} →{" "}
            <strong className="text-foreground">{String(newD.date)}</strong>
          </div>
        )}
      </div>
    );
  }

  if (log.action === "service_deleted") {
    return (
      <div className="surface p-3.5 rounded-xl border-l-4 border-rose-500 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wide">
            Service Deleted:
          </span>
          <strong className="text-foreground text-sm font-semibold">{String(details.name || log.entity_title)}</strong>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {details.date && <span>Date: {String(details.date)}</span>}
          {details.type && <span className="capitalize">· Type: {String(details.type)}</span>}
          {details.visitors !== undefined && <span>· Visitors snapshot: {String(details.visitors)}</span>}
        </div>
      </div>
    );
  }

  if (log.action === "role_updated") {
    return (
      <div className="surface p-3.5 rounded-xl border-l-4 border-amber-500 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
            Role Assignment:
          </span>
          <span className="text-sm font-semibold text-foreground">{log.entity_title || "Account"}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Assigned Role: <span className="capitalize font-semibold text-foreground">{String(details.role || "-")}</span>
          {details.action === "account_created" && <span className="ml-2 text-[11px]">(New account created)</span>}
        </div>
      </div>
    );
  }

  // Clean fallback for any other properties without showing raw JSON
  const entries = Object.entries(details).filter(
    ([key]) => !["message_id", "resend_id"].includes(key),
  );

  if (entries.length === 0) return null;

  return (
    <div className="surface p-3 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
      {entries.map(([key, val]) => (
        <div key={key}>
          <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</span>{" "}
          <strong className="text-foreground">{typeof val === "object" ? JSON.stringify(val) : String(val)}</strong>
        </div>
      ))}
    </div>
  );
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
