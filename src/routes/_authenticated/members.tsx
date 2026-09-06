import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronDown, Pencil, Search, UserPlus, Users2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  buildHouseholds,
  initials,
  membersQuery,
  normalizeMemberCategory,
  type Member,
  type MemberCategory,
} from "@/lib/data";
import type { Database } from "@/integrations/supabase/types";
import { PageHeading } from "@/components/app/AppShell";
import { logActivity } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Gender = Database["public"]["Enums"]["member_gender"];

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({
    meta: [
      { title: "Members | Deeper Life Attendance" },
      { name: "description", content: "Members of the church grouped by household." },
      { property: "og:title", content: "Members | Deeper Life Attendance" },
      { property: "og:description", content: "Members of the church grouped by household." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(membersQuery);
  },
  component: MembersPage,
});

function MembersPage() {
  const { data: members } = useSuspenseQuery(membersQuery);
  const { isAdmin } = useSession();
  const [search, setSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [workersOnly, setWorkersOnly] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  const query = search.trim().toLowerCase();
  const filtered = members.filter(
    (m) => (!query || m.name.toLowerCase().includes(query)) && (!workersOnly || m.is_worker),
  );

  // Group members by category and gender
  const grouped = useMemo(() => {
    const groups: Record<MemberCategory, Record<"male" | "female", Member[]>> = {
      adult: { male: [], female: [] },
      young_adult: { male: [], female: [] },
      youth: { male: [], female: [] },
      child: { male: [], female: [] },
    };

    for (const member of filtered) {
      const gender = (member.gender || "male") as "male" | "female";
      groups[normalizeMemberCategory(member.category)][gender].push(member);
    }

    // Sort members by name within each group
    for (const category of CATEGORY_ORDER) {
      groups[category].male.sort((a, b) => a.name.localeCompare(b.name));
      groups[category].female.sort((a, b) => a.name.localeCompare(b.name));
    }

    return groups;
  }, [filtered]);

  // Initialize all sections as expanded
  const sectionKeys = useMemo(() => {
    const keys: Record<string, boolean> = {};
    for (const category of CATEGORY_ORDER) {
      keys[`${category}-male`] = true;
      keys[`${category}-female`] = true;
    }
    return keys;
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getSectionExpandedState = (section: string): boolean => {
    return expandedSections[section] !== undefined
      ? expandedSections[section]
      : (sectionKeys[section] ?? true);
  };

  return (
    <>
      <PageHeading title="Members" action={isAdmin ? <AddMemberDialog /> : undefined} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="h-12 pl-9"
          />
        </div>
        <Button
          variant={workersOnly ? "default" : "secondary"}
          size="lg"
          className="h-12"
          onClick={() => setWorkersOnly((v) => !v)}
        >
          Workers
        </Button>
      </div>

      {members.length === 0 ? (
        <div className="surface p-10 text-center">
          <Users2 className="text-primary mx-auto h-6 w-6" />
          <p className="font-display mt-3 text-lg">No members yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORY_ORDER.map((category) => {
            const hasMale = grouped[category].male.length > 0;
            const hasFemale = grouped[category].female.length > 0;

            if (!hasMale && !hasFemale) return null;

            return (
              <div key={category} className="space-y-2">
                <h2 className="text-lg font-semibold">{CATEGORY_LABELS[category]}</h2>
                <div className="space-y-2">
                  {hasMale && (
                    <MemberSection
                      title="Male"
                      members={grouped[category].male}
                      sectionKey={`${category}-male`}
                      expanded={getSectionExpandedState(`${category}-male`)}
                      onToggle={toggleSection}
                      isAdmin={isAdmin}
                      onEdit={setEditing}
                    />
                  )}
                  {hasFemale && (
                    <MemberSection
                      title="Female"
                      members={grouped[category].female}
                      sectionKey={`${category}-female`}
                      expanded={getSectionExpandedState(`${category}-female`)}
                      onToggle={toggleSection}
                      isAdmin={isAdmin}
                      onEdit={setEditing}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="surface text-muted-foreground p-8 text-center text-sm">No matches.</div>
          )}
        </div>
      )}

      <EditMemberDialog member={editing} onClose={() => setEditing(null)} />
    </>
  );
}

interface MemberSectionProps {
  title: string;
  members: Member[];
  sectionKey: string;
  expanded: boolean;
  onToggle: (section: string) => void;
  isAdmin: boolean;
  onEdit: (member: Member) => void;
}

function MemberSection({
  title,
  members,
  sectionKey,
  expanded,
  onToggle,
  isAdmin,
  onEdit,
}: MemberSectionProps) {
  return (
    <div className="surface overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        className="flex w-full items-center justify-between gap-3 p-4 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">{title}</span>
          <span className="text-muted-foreground text-sm">({members.length})</span>
        </div>
        <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && members.length > 0 && (
        <ul className="divide-border bg-secondary/40 divide-y">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={member.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{member.name}</span>
                  {member.gender && <GenderBadge gender={member.gender} />}
                  {member.is_worker && <WorkerBadge />}
                </div>
                <div className="text-muted-foreground text-xs">
                  {CATEGORY_LABELS[member.category]}
                  {member.contact ? ` · ${member.contact}` : ""}
                </div>
              </div>
              {isAdmin && <EditButton onClick={() => onEdit(member)} name={member.name} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  return (
    <div
      className={`bg-primary/10 text-primary font-display grid shrink-0 place-items-center rounded-full font-semibold ${dim}`}
    >
      {initials(name)}
    </div>
  );
}

function EditButton({ onClick, name }: { onClick: () => void; name: string }) {
  return (
    <button
      type="button"
      aria-label={`Edit ${name}`}
      onClick={onClick}
      className="text-muted-foreground hover:text-primary hover:bg-secondary grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors"
    >
      <Pencil className="h-4 w-4" />
    </button>
  );
}

function WorkerBadge() {
  return (
    <span className="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
      Worker
    </span>
  );
}

function GenderBadge({ gender }: { gender: "male" | "female" }) {
  return (
    <span className="bg-secondary text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
      {gender === "male" ? "M" : "F"}
    </span>
  );
}

function CategoryPicker({
  category,
  setCategory,
}: {
  category: MemberCategory;
  setCategory: (value: MemberCategory) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>
        Category <span className="text-destructive">*</span>
      </Label>
      <div className="grid grid-cols-2 gap-2">
        {CATEGORY_ORDER.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCategory(option)}
            className={`rounded-xl border px-3 py-3 text-sm transition-colors ${
              category === option
                ? "border-primary bg-primary/8 text-primary font-semibold"
                : "border-border text-muted-foreground"
            }`}
          >
            {CATEGORY_LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

function GenderPicker({
  gender,
  setGender,
}: {
  gender: Gender | null;
  setGender: (value: Gender) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>
        Gender <span className="text-destructive">*</span>
      </Label>
      <div className="grid grid-cols-2 gap-2">
        {(["male", "female"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setGender(option)}
            className={`rounded-xl border px-3 py-3 text-sm transition-colors ${
              gender === option
                ? "border-primary bg-primary/8 text-primary font-semibold"
                : "border-border text-muted-foreground"
            }`}
          >
            {option === "male" ? "Male" : "Female"}
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkerToggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-sm transition-colors ${
        value
          ? "border-primary bg-primary/8 text-primary font-semibold"
          : "border-border text-muted-foreground"
      }`}
    >
      Worker
      <span
        className={`grid h-6 w-11 items-center rounded-full px-0.5 transition-colors ${value ? "bg-primary" : "bg-border"}`}
      >
        <span
          className={`bg-card h-5 w-5 rounded-full transition-transform ${value ? "translate-x-5" : ""}`}
        />
      </span>
    </button>
  );
}

function GuardianPicker({
  adults,
  guardianId,
  setGuardianId,
  excludeId,
}: {
  adults: Member[];
  guardianId: string | null;
  setGuardianId: (value: string | null) => void;
  excludeId?: string | undefined;
}) {
  const [search, setSearch] = useState("");
  const pool = adults.filter((m) => m.id !== excludeId);
  const matches = search.trim()
    ? pool.filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase()))
    : pool.slice(0, 6);
  const guardian = pool.find((m) => m.id === guardianId);

  return (
    <div className="bg-secondary/50 space-y-2 rounded-xl p-3">
      <Label htmlFor="guardian">Guardian (optional)</Label>
      {guardian ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium">{guardian.name}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setGuardianId(null)}>
            Change
          </Button>
        </div>
      ) : (
        <>
          <Input
            id="guardian"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search adults"
            className="h-11"
          />
          <ul className="max-h-40 overflow-y-auto">
            {matches.map((adult) => (
              <li key={adult.id}>
                <button
                  type="button"
                  onClick={() => setGuardianId(adult.id)}
                  className="hover:bg-background w-full rounded-lg px-2 py-2 text-left text-sm"
                >
                  {adult.name}
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="text-muted-foreground px-2 py-2 text-xs">No matches.</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

function AddMemberDialog() {
  const queryClient = useQueryClient();
  const { data: members } = useSuspenseQuery(membersQuery);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [category, setCategory] = useState<MemberCategory>("adult");
  const [gender, setGender] = useState<Gender | null>(null);
  const [guardianId, setGuardianId] = useState<string | null>(null);
  const [isWorker, setIsWorker] = useState(false);

  const adults = members.filter((m) => normalizeMemberCategory(m.category) === "adult");

  const create = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      const { data, error } = await supabase
        .from("members")
        .insert({
          name: trimmedName,
          contact: contact.trim() || null,
          category,
          gender,
          is_worker: isWorker,
          guardian_id: category === "adult" ? null : guardianId,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      void logActivity({
        action: "member_created",
        entityType: "member",
        entityId: data?.id,
        entityTitle: trimmedName,
        details: {
          name: trimmedName,
          category,
          gender,
          is_worker: isWorker,
          contact: contact.trim() || null,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Member added");
      setOpen(false);
      setName("");
      setContact("");
      setCategory("adult");
      setGender(null);
      setGuardianId(null);
      setIsWorker(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-12">
          <UserPlus className="mr-2 h-4 w-4" /> Add member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!gender) {
              toast.error("Please select a gender");
              return;
            }
            create.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="member-name">Full name</Label>
            <Input
              id="member-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-contact">Contact (optional)</Label>
            <Input
              id="member-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="h-12"
            />
          </div>
          <CategoryPicker category={category} setCategory={setCategory} />
          <GenderPicker gender={gender} setGender={setGender} />
          <WorkerToggle value={isWorker} onToggle={() => setIsWorker((v) => !v)} />
          {category !== "adult" && (
            <GuardianPicker adults={adults} guardianId={guardianId} setGuardianId={setGuardianId} />
          )}
          <Button
            type="submit"
            size="lg"
            className="h-12 w-full"
            disabled={create.isPending || !gender}
          >
            Add member
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditMemberDialog({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: members } = useSuspenseQuery(membersQuery);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [category, setCategory] = useState<MemberCategory>("adult");
  const [gender, setGender] = useState<Gender | null>(null);
  const [guardianId, setGuardianId] = useState<string | null>(null);
  const [isWorker, setIsWorker] = useState(false);

  useEffect(() => {
    if (!member) return;
    setName(member.name);
    setContact(member.contact ?? "");
    setCategory(normalizeMemberCategory(member.category));
    setGender(member.gender);
    setGuardianId(member.guardian_id);
    setIsWorker(member.is_worker);
  }, [member]);

  const adults = members.filter((m) => normalizeMemberCategory(m.category) === "adult");

  const save = useMutation({
    mutationFn: async () => {
      if (!member) return;
      const trimmedName = name.trim();
      const { error } = await supabase
        .from("members")
        .update({
          name: trimmedName,
          contact: contact.trim() || null,
          category,
          gender,
          is_worker: isWorker,
          guardian_id: category === "adult" ? null : guardianId,
        })
        .eq("id", member.id);
      if (error) throw new Error(error.message);

      void logActivity({
        action: "member_updated",
        entityType: "member",
        entityId: member.id,
        entityTitle: trimmedName,
        details: {
          old: {
            name: member.name,
            category: member.category,
            gender: member.gender,
            is_worker: member.is_worker,
          },
          new: {
            name: trimmedName,
            category,
            gender,
            is_worker: isWorker,
          },
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Member updated");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!member) return;
      const { error } = await supabase.from("members").delete().eq("id", member.id);
      if (error) throw new Error(error.message);

      void logActivity({
        action: "member_deleted",
        entityType: "member",
        entityId: member.id,
        entityTitle: member.name,
        details: {
          name: member.name,
          category: member.category,
          gender: member.gender,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Member removed");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={!!member} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit member</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!gender) {
              toast.error("Please select a gender");
              return;
            }
            save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="edit-name">Full name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-contact">Contact (optional)</Label>
            <Input
              id="edit-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="h-12"
            />
          </div>
          <CategoryPicker category={category} setCategory={setCategory} />
          <GenderPicker gender={gender} setGender={setGender} />
          <WorkerToggle value={isWorker} onToggle={() => setIsWorker((v) => !v)} />
          {category !== "adult" && (
            <GuardianPicker
              adults={adults}
              guardianId={guardianId}
              setGuardianId={setGuardianId}
              excludeId={member?.id}
            />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="h-12"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Remove
            </Button>
            <Button
              type="submit"
              size="lg"
              className="h-12 flex-1"
              disabled={save.isPending || !gender}
            >
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
