import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Member = Database["public"]["Tables"]["members"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type AttendanceRecord = Database["public"]["Tables"]["attendance_records"]["Row"];
export type MemberCategory = Database["public"]["Enums"]["member_category"];
export type ServiceType = Database["public"]["Enums"]["service_type"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export const CATEGORY_LABELS: Record<MemberCategory, string> = {
  adult: "Adult",
  young_adult: "Adult",
  youth: "Youth",
  child: "Children",
};

export const CATEGORY_ORDER: MemberCategory[] = ["adult", "youth", "child"];

export function normalizeMemberCategory(category: MemberCategory): MemberCategory {
  return category === "young_adult" ? "adult" : category;
}

export type Household = {
  id: string;
  head: Member | null;
  label: string;
  members: Member[];
  dependents: Member[];
};

export function buildHouseholds(members: Member[]): Household[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const groups = new Map<string, { head: Member | null; dependents: Member[] }>();

  for (const member of members) {
    const guardian = member.guardian_id ? byId.get(member.guardian_id) : undefined;
    if (guardian) {
      const group = groups.get(guardian.id) ?? { head: guardian, dependents: [] };
      group.head = guardian;
      group.dependents.push(member);
      groups.set(guardian.id, group);
    } else {
      const group = groups.get(member.id) ?? { head: member, dependents: [] };
      group.head = member;
      groups.set(member.id, group);
    }
  }

  return [...groups.entries()]
    .map(([id, group]) => {
      const head = group.head!;
      const dependents = group.dependents
        .slice()
        .sort(
          (a, b) =>
            CATEGORY_ORDER.indexOf(normalizeMemberCategory(a.category)) -
              CATEGORY_ORDER.indexOf(normalizeMemberCategory(b.category)) ||
            a.name.localeCompare(b.name),
        );
      return {
        id,
        head,
        label: dependents.length ? `${lastName(head.name)} household` : head.name,
        members: [head, ...dependents],
        dependents,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function lastName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export async function fetchMembers() {
  const { data, error } = await supabase.from("members").select("*").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchServices() {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchService(id: string) {
  const { data, error } = await supabase.from("services").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Service not found");
  return data;
}

export async function fetchAttendance(serviceId?: string) {
  let query = supabase.from("attendance_records").select("*");
  if (serviceId) query = query.eq("service_id", serviceId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function getServiceVisitorTotal(service?: Partial<Service> | null): number {
  if (!service) return 0;
  return (
    (service.visitor_adult_male ?? 0) +
    (service.visitor_adult_female ?? 0) +
    (service.visitor_youth_male ?? 0) +
    (service.visitor_youth_female ?? 0) +
    (service.visitor_child_male ?? 0) +
    (service.visitor_child_female ?? 0)
  );
}

export const membersQuery = { queryKey: ["members"], queryFn: fetchMembers };
export const servicesQuery = { queryKey: ["services"], queryFn: fetchServices };
export const attendanceQuery = { queryKey: ["attendance"], queryFn: () => fetchAttendance() };
