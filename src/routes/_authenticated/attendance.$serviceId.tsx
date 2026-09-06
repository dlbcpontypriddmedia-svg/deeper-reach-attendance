import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Check, ChevronDown, X, ArrowLeft, Search, Copy, Users, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  buildHouseholds,
  fetchAttendance,
  fetchService,
  getServiceVisitorTotal,
  membersQuery,
  normalizeMemberCategory,
  type Member,
  type MemberCategory,
  type Service,
} from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/app/AppShell";
import { buildAttendanceSummary } from "@/lib/summary";

export const Route = createFileRoute("/_authenticated/attendance/$serviceId")({
  head: () => ({
    meta: [
      { title: "Take Attendance | Deeper Life Attendance" },
      { name: "description", content: "Mark households present or absent for this service." },
      { property: "og:title", content: "Take Attendance | Deeper Life Attendance" },
      {
        property: "og:description",
        content: "Mark households present or absent for this service.",
      },
    ],
  }),
  component: AttendancePage,
});

type Status = "present" | "absent";

function AttendancePage() {
  const { serviceId } = Route.useParams();
  const queryClient = useQueryClient();
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState(false);

  // Visitors / Guests state
  const [visitors, setVisitors] = useState({
    adult_male: 0,
    adult_female: 0,
    youth_male: 0,
    youth_female: 0,
    child_male: 0,
    child_female: 0,
    notes: "",
  });

  const service = useQuery({
    queryKey: ["service", serviceId],
    queryFn: () => fetchService(serviceId),
  });
  const members = useQuery(membersQuery);
  const existing = useQuery({
    queryKey: ["attendance", serviceId],
    queryFn: () => fetchAttendance(serviceId),
  });

  // Sync visitor state when service is loaded
  useEffect(() => {
    if (service.data) {
      setVisitors({
        adult_male: service.data.visitor_adult_male ?? 0,
        adult_female: service.data.visitor_adult_female ?? 0,
        youth_male: service.data.visitor_youth_male ?? 0,
        youth_female: service.data.visitor_youth_female ?? 0,
        child_male: service.data.visitor_child_male ?? 0,
        child_female: service.data.visitor_child_female ?? 0,
        notes: service.data.visitor_notes ?? "",
      });
    }
  }, [service.data]);

  const baseline = useMemo(() => {
    const map: Record<string, Status> = {};
    for (const record of existing.data ?? []) map[record.member_id] = record.status;
    return map;
  }, [existing.data]);

  const statusOf = (memberId: string): Status =>
    statuses[memberId] ?? baseline[memberId] ?? "absent";

  const allMembers = members.data ?? [];

  const households = useMemo(() => buildHouseholds(allMembers), [allMembers]);
  const query = search.trim().toLowerCase();

  // Group members by category and gender
  const grouped = useMemo(() => {
    const groups: Record<MemberCategory, Record<"male" | "female", Member[]>> = {
      adult: { male: [], female: [] },
      young_adult: { male: [], female: [] },
      youth: { male: [], female: [] },
      child: { male: [], female: [] },
    };

    const filteredMembers = query
      ? allMembers.filter((m) => m.name.toLowerCase().includes(query))
      : allMembers;

    for (const member of filteredMembers) {
      const gender = (member.gender || "male") as "male" | "female";
      groups[normalizeMemberCategory(member.category)][gender].push(member);
    }

    // Sort members by name within each group
    for (const category of CATEGORY_ORDER) {
      groups[category].male.sort((a, b) => a.name.localeCompare(b.name));
      groups[category].female.sort((a, b) => a.name.localeCompare(b.name));
    }

    return groups;
  }, [allMembers, query]);

  // Initialize all sections as expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const sectionKeys = useMemo(() => {
    const keys: Record<string, boolean> = {};
    for (const category of CATEGORY_ORDER) {
      keys[`${category}-male`] = true;
      keys[`${category}-female`] = true;
    }
    return keys;
  }, []);

  const getSectionExpandedState = (section: string): boolean => {
    return expandedSections[section] !== undefined
      ? expandedSections[section]
      : (sectionKeys[section] ?? true);
  };

  const memberPresentCount = allMembers.filter((m) => statusOf(m.id) === "present").length;
  const totalVisitors =
    visitors.adult_male +
    visitors.adult_female +
    visitors.youth_male +
    visitors.youth_female +
    visitors.child_male +
    visitors.child_female;
  const totalPresent = memberPresentCount + totalVisitors;
  const totalMembers = allMembers.length;
  const pct = totalMembers ? Math.round((memberPresentCount / totalMembers) * 100) : 0;

  const setMany = (ids: string[], status: Status) =>
    setStatuses((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = status;
      return next;
    });

  const submit = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getUser();

      // Update visitor counts on service
      const { error: serviceError } = await supabase
        .from("services")
        .update({
          visitor_adult_male: visitors.adult_male,
          visitor_adult_female: visitors.adult_female,
          visitor_youth_male: visitors.youth_male,
          visitor_youth_female: visitors.youth_female,
          visitor_child_male: visitors.child_male,
          visitor_child_female: visitors.child_female,
          visitor_notes: visitors.notes.trim() || null,
        })
        .eq("id", serviceId);

      if (serviceError) throw new Error(serviceError.message);

      if (allMembers.length > 0) {
        const rows = allMembers.map((member) => ({
          service_id: serviceId,
          member_id: member.id,
          status: statusOf(member.id),
          recorded_by: session.user?.id ?? null,
        }));
        const { error } = await supabase
          .from("attendance_records")
          .upsert(rows, { onConflict: "service_id,member_id" });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["service", serviceId] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setSubmitted(true);
      toast.success("Attendance submitted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const absentees = allMembers.filter((m) => statusOf(m.id) === "absent");

  const alreadyRecorded = (existing.data ?? []).length > 0;
  const locked = (submitted || alreadyRecorded) && !editing;

  if (existing.isPending || members.isPending || service.isPending) {
    return <p className="text-muted-foreground py-16 text-center text-sm">Loading...</p>;
  }

  if (locked) {
    return (
      <ServiceOverview
        service={service.data}
        all={allMembers}
        statusOf={statusOf}
        absentees={absentees}
        households={households}
        onEdit={() => {
          setSubmitted(false);
          setEditing(true);
        }}
      />
    );
  }

  return (
    <>
      <Link
        to="/dashboard"
        className="text-muted-foreground mb-3 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> All services
      </Link>
      <PageHeading
        title={service.data?.name ?? "Taking attendance"}
        subtitle={
          service.data ? format(parseISO(service.data.date), "EEEE d MMMM yyyy") : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a name"
            className="h-12 pl-9"
          />
        </div>
        <Button
          variant="secondary"
          size="lg"
          className="h-12"
          onClick={() =>
            setMany(
              allMembers.map((m) => m.id),
              "present",
            )
          }
        >
          All present
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="h-12"
          onClick={() =>
            setMany(
              allMembers.map((m) => m.id),
              "absent",
            )
          }
        >
          Clear
        </Button>
      </div>

      {/* Visitor / Guest Count Section for Special / Combined Sundays */}
      <VisitorSection
        visitors={visitors}
        onChange={(field, val) => setVisitors((prev) => ({ ...prev, [field]: val }))}
      />

      <ul className="space-y-3 pb-32">
        {CATEGORY_ORDER.map((category) => {
          const hasMale = grouped[category].male.length > 0;
          const hasFemale = grouped[category].female.length > 0;

          if (!hasMale && !hasFemale) return null;

          return (
            <li key={category} className="space-y-2">
              <h2 className="text-lg font-semibold">{CATEGORY_LABELS[category]}</h2>
              <div className="space-y-2">
                {hasMale && (
                  <AttendanceSection
                    title="Male"
                    members={grouped[category].male}
                    sectionKey={`${category}-male`}
                    expanded={getSectionExpandedState(`${category}-male`)}
                    onToggle={toggleSection}
                    statusOf={statusOf}
                    setMany={setMany}
                  />
                )}
                {hasFemale && (
                  <AttendanceSection
                    title="Female"
                    members={grouped[category].female}
                    sectionKey={`${category}-female`}
                    expanded={getSectionExpandedState(`${category}-female`)}
                    onToggle={toggleSection}
                    statusOf={statusOf}
                    setMany={setMany}
                  />
                )}
              </div>
            </li>
          );
        })}
        {Object.values(grouped)
          .flat()
          .every((gender) => gender.length === 0) && (
          <li className="surface text-muted-foreground p-8 text-center text-sm">No matches.</li>
        )}
      </ul>

      <div className="border-border bg-background/95 fixed inset-x-0 bottom-0 border-t backdrop-blur z-20">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex-1">
            <div className="font-display text-xl font-semibold">
              {totalPresent}
              <span className="text-muted-foreground text-sm font-normal">
                {" "}
                total present ({memberPresentCount} members
                {totalVisitors > 0 ? ` + ${totalVisitors} visitors` : ""})
              </span>
            </div>
            <div className="text-muted-foreground text-xs">{pct}% member attendance</div>
          </div>
          <Button
            size="lg"
            className="h-13 flex-1 py-4 text-base sm:flex-none sm:px-10"
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
          >
            {editing ? "Resubmit attendance" : "Submit attendance"}
          </Button>
        </div>
      </div>
    </>
  );
}

function VisitorSection({
  visitors,
  onChange,
}: {
  visitors: {
    adult_male: number;
    adult_female: number;
    youth_male: number;
    youth_female: number;
    child_male: number;
    child_female: number;
    notes: string;
  };
  onChange: (field: keyof typeof visitors, val: number | string) => void;
}) {
  const [open, setOpen] = useState(
    visitors.adult_male > 0 ||
      visitors.adult_female > 0 ||
      visitors.youth_male > 0 ||
      visitors.youth_female > 0 ||
      visitors.child_male > 0 ||
      visitors.child_female > 0 ||
      Boolean(visitors.notes),
  );

  const total =
    visitors.adult_male +
    visitors.adult_female +
    visitors.youth_male +
    visitors.youth_female +
    visitors.child_male +
    visitors.child_female;

  return (
    <div className="surface mb-4 overflow-hidden border-dashed border-2 border-primary/30">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 p-4 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="text-primary h-5 w-5" />
          <span className="font-semibold">Special Sunday Guests & Visiting Branches</span>
          <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold">
            {total} {total === 1 ? "visitor" : "visitors"}
          </span>
        </div>
        <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-border bg-secondary/30 space-y-4 border-t p-4 sm:p-5">
          <p className="text-muted-foreground text-xs">
            Use these counters for one-time attendees, combined services, or guests so you don't
            need to create permanent member profiles.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {/* Adults */}
            <div className="surface p-3 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Adult Visitors
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">Male:</span>
                <Counter value={visitors.adult_male} onChange={(v) => onChange("adult_male", v)} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">Female:</span>
                <Counter
                  value={visitors.adult_female}
                  onChange={(v) => onChange("adult_female", v)}
                />
              </div>
            </div>

            {/* Youth */}
            <div className="surface p-3 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Youth Visitors
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">Male:</span>
                <Counter value={visitors.youth_male} onChange={(v) => onChange("youth_male", v)} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">Female:</span>
                <Counter
                  value={visitors.youth_female}
                  onChange={(v) => onChange("youth_female", v)}
                />
              </div>
            </div>

            {/* Children */}
            <div className="surface p-3 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Child Visitors
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">Male:</span>
                <Counter value={visitors.child_male} onChange={(v) => onChange("child_male", v)} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">Female:</span>
                <Counter
                  value={visitors.child_female}
                  onChange={(v) => onChange("child_female", v)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="visitor-notes" className="text-xs">
              Guest / Branch notes (optional)
            </Label>
            <Input
              id="visitor-notes"
              placeholder="e.g., Visiting brethren from Central Branch"
              value={visitors.notes}
              onChange={(e) => onChange("notes", e.target.value)}
              className="h-10 bg-background"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Counter({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="border-border hover:bg-secondary grid h-8 w-8 place-items-center rounded-lg border text-sm font-semibold transition-colors disabled:opacity-40"
        disabled={value <= 0}
        aria-label="Decrease"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="surface h-8 w-12 text-center text-sm font-semibold focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="border-border hover:bg-secondary grid h-8 w-8 place-items-center rounded-lg border text-sm font-semibold transition-colors"
        aria-label="Increase"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function IconToggle({
  kind,
  active,
  label,
  onClick,
}: {
  kind: Status;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  const base =
    "grid h-11 w-11 place-items-center rounded-xl border transition-colors active:scale-95";
  const styles = active
    ? kind === "present"
      ? "border-transparent bg-success text-success-foreground"
      : "border-transparent bg-destructive text-destructive-foreground"
    : "border-border text-muted-foreground";
  return (
    <button type="button" aria-label={label} onClick={onClick} className={`${base} ${styles}`}>
      {kind === "present" ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
    </button>
  );
}

interface AttendanceSectionProps {
  title: string;
  members: Member[];
  sectionKey: string;
  expanded: boolean;
  onToggle: (section: string) => void;
  statusOf: (memberId: string) => Status;
  setMany: (ids: string[], status: Status) => void;
}

function AttendanceSection({
  title,
  members,
  sectionKey,
  expanded,
  onToggle,
  statusOf,
  setMany,
}: AttendanceSectionProps) {
  const presentCount = members.filter((m) => statusOf(m.id) === "present").length;
  const ids = members.map((m) => m.id);

  return (
    <div className="surface overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        className="flex w-full items-center justify-between gap-3 p-4 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">{title}</span>
          <span className="text-muted-foreground text-sm">
            ({presentCount}/{members.length} present)
          </span>
        </div>
        <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && members.length > 0 && (
        <>
          <div className="border-border bg-secondary/40 flex shrink-0 gap-2 border-t px-4 py-3">
            <IconToggle
              kind="present"
              active={presentCount === members.length}
              label={`Mark all ${title.toLowerCase()} present`}
              onClick={() => setMany(ids, "present")}
            />
            <IconToggle
              kind="absent"
              active={presentCount === 0}
              label={`Mark all ${title.toLowerCase()} absent`}
              onClick={() => setMany(ids, "absent")}
            />
          </div>
          <ul className="divide-border bg-secondary/40 divide-y">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{member.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {CATEGORY_LABELS[member.category]}
                    {member.contact ? ` · ${member.contact}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <IconToggle
                    kind="present"
                    active={statusOf(member.id) === "present"}
                    label={`Mark ${member.name} present`}
                    onClick={() => setMany([member.id], "present")}
                  />
                  <IconToggle
                    kind="absent"
                    active={statusOf(member.id) === "absent"}
                    label={`Mark ${member.name} absent`}
                    onClick={() => setMany([member.id], "absent")}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ServiceOverview({
  service,
  all,
  statusOf,
  absentees,
  households,
  onEdit,
}: {
  service?: Service | null;
  all: Member[];
  statusOf: (id: string) => Status;
  absentees: Member[];
  households: ReturnType<typeof buildHouseholds>;
  onEdit: () => void;
}) {
  const householdOf = (memberId: string) =>
    households.find((h) => h.members.some((m) => m.id === memberId))?.label ?? "Unknown";

  const memberPresent = all.filter((m) => statusOf(m.id) === "present").length;
  const visitorTotal = getServiceVisitorTotal(service);
  const totalPresent = memberPresent + visitorTotal;

  const summarise = (rows: Member[]) => {
    const present = rows.filter((m) => statusOf(m.id) === "present").length;
    return {
      present,
      absent: rows.length - present,
      pct: rows.length ? Math.round((present / rows.length) * 100) : 0,
    };
  };

  const everyone = summarise(all);
  const workers = summarise(all.filter((m) => m.is_worker));
  const hasWorkers = all.some((m) => m.is_worker);

  const copySummary = async () => {
    const text = buildAttendanceSummary({
      date: service?.date,
      present: all.filter((m) => statusOf(m.id) === "present"),
      service,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Summary copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <>
      <PageHeading
        title={service?.name ?? "Service"}
        subtitle={service?.date ? format(parseISO(service.date), "EEEE d MMMM yyyy") : undefined}
        action={
          <div className="flex gap-2">
            <Button size="lg" className="h-12" onClick={copySummary}>
              <Copy className="mr-2 h-4 w-4" /> Copy summary
            </Button>
            <Button variant="secondary" size="lg" className="h-12" onClick={onEdit}>
              Edit attendance
            </Button>
          </div>
        }
      />

      <h2 className="mb-2 text-sm font-semibold tracking-[0.16em] uppercase">Overview</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Total Present" value={totalPresent} tone="primary" />
        <Stat label="Members Present" value={everyone.present} tone="success" />
        <Stat label="Visitors / Guests" value={visitorTotal} tone="primary" />
        <Stat label="Members Absent" value={everyone.absent} tone="destructive" />
      </div>

      {service?.visitor_notes && (
        <div className="surface mb-6 p-4 border-l-4 border-primary">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Visitor Notes
          </div>
          <div className="mt-1 text-sm font-medium">{service.visitor_notes}</div>
        </div>
      )}

      {hasWorkers && (
        <>
          <h2 className="mb-2 text-sm font-semibold tracking-[0.16em] uppercase">Workers</h2>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Stat label="Present" value={workers.present} tone="success" />
            <Stat label="Absent" value={workers.absent} tone="destructive" />
            <Stat label="Attendance" value={`${workers.pct}%`} tone="primary" />
          </div>
        </>
      )}

      <div className="surface p-5">
        <h2 className="text-lg font-semibold">Absentees</h2>
        {absentees.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">None.</p>
        ) : (
          <ul className="divide-border mt-3 divide-y">
            {absentees.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {member.name}
                  {member.is_worker && (
                    <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase">
                      Worker
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground text-xs">{householdOf(member.id)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-6">
        <Link to="/dashboard" className="text-primary text-sm font-semibold">
          Back to services
        </Link>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "success" | "destructive" | "primary";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : "text-primary";
  return (
    <div className="surface p-5">
      <div className="text-muted-foreground text-xs tracking-[0.18em] uppercase">{label}</div>
      <div className={`font-display mt-1 text-4xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
