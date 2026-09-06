import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

export type AuditAction =
  | "service_created"
  | "service_updated"
  | "service_deleted"
  | "attendance_taken"
  | "attendance_updated"
  | "member_created"
  | "member_updated"
  | "member_deleted"
  | "role_updated";

export type AuditEntityType = "service" | "attendance" | "member" | "account";

export interface LogActivityParams {
  action: AuditAction | string;
  entityType: AuditEntityType | string;
  entityId?: string | null;
  entityTitle?: string | null;
  details?: Record<string, unknown> | null;
  actorName?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    let actorId = params.actorId;
    let actorName = params.actorName;
    let actorEmail = params.actorEmail;

    if (!actorId || !actorName) {
      const { data: session } = await supabase.auth.getUser();
      if (session?.user) {
        actorId = actorId || session.user.id;
        actorEmail = actorEmail || session.user.email || null;
        if (!actorName) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, username")
            .eq("id", session.user.id)
            .maybeSingle();
          actorName = profile?.name || profile?.username || session.user.email || "User";
        }
      }
    }

    await supabase.from("audit_logs").insert({
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      entity_title: params.entityTitle ?? null,
      details: (params.details ?? {}) as Json,
      actor_id: actorId ?? null,
      actor_name: actorName || "Unknown User",
      actor_email: actorEmail ?? null,
    });
  } catch (err) {
    // Non-blocking: log errors to console but never throw
    console.error("Failed to write audit log:", err);
  }
}

export async function fetchAuditLogs(limit = 100): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export const auditLogsQuery = {
  queryKey: ["audit_logs"],
  queryFn: () => fetchAuditLogs(200),
};