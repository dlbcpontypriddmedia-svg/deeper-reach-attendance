import { useMemo, useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, HeartHandshake, Phone, X } from "lucide-react";
import {
  attendanceQuery,
  buildHouseholds,
  membersQuery,
  servicesQuery,
  type Member,
} from "@/lib/data";
import { fetchAllSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SESSION_FOLLOWUP_DISMISSED = "urgent_followup_dismissed_session";

export interface UrgentFollowUpItem {
  id: string;
  name: string;
  contact: string | null;
  household: string;
  consecutiveAbsences: number;
  reason: string;
}

export function useUrgentFollowUps(): { items: UrgentFollowUpItem[]; isPopupEnabled: boolean } {
  const members = useQuery(membersQuery);
  const services = useQuery(servicesQuery);
  const attendance = useQuery(attendanceQuery);
  const settings = useQuery({ queryKey: ["app_settings"], queryFn: fetchAllSettings });

  const threshold = settings.data?.follow_up?.consecutive_absence_threshold ?? 3;
  const isPopupEnabled = settings.data?.follow_up?.popup_alert_enabled ?? true;

  const items = useMemo(() => {
    const memberList = members.data ?? [];
    const allServices = services.data ?? [];
    const allRecords = attendance.data ?? [];

    if (memberList.length === 0 || allServices.length === 0 || allRecords.length === 0) {
      return [];
    }

    // Find services that have attendance recorded, sorted chronologically ascending (oldest to newest)
    const recordedServiceIds = new Set(allRecords.map((r) => r.service_id));
    const sortedPastServices = allServices
      .filter((s) => recordedServiceIds.has(s.id))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Need at least 2 recorded services to evaluate
    if (sortedPastServices.length < 2) return [];

    const households = buildHouseholds(memberList);

    // Map records by memberId -> serviceId -> status
    const recordMap = new Map<string, Map<string, string>>();
    for (const rec of allRecords) {
      if (!recordMap.has(rec.member_id)) {
        recordMap.set(rec.member_id, new Map());
      }
      recordMap.get(rec.member_id)!.set(rec.service_id, rec.status);
    }

    const urgentList: UrgentFollowUpItem[] = [];

    for (const member of memberList) {
      const memberRecords = recordMap.get(member.id);
      if (!memberRecords) continue;

      // Count consecutive absences starting from the most recent recorded service backwards
      let consecutiveAbsences = 0;
      let evaluatedCount = 0;

      for (let i = sortedPastServices.length - 1; i >= 0; i -= 1) {
        const s = sortedPastServices[i];
        const status = memberRecords.get(s.id);

        if (status === "absent") {
          consecutiveAbsences += 1;
          evaluatedCount += 1;
        } else if (status === "present") {
          // Stopped absence streak
          break;
        }
      }

      // Flag as URGENT if missed threshold or more consecutive services in a row (or all services if only 2 held)
      const isUrgent =
        consecutiveAbsences >= threshold ||
        (sortedPastServices.length === 2 && consecutiveAbsences === 2);

      if (isUrgent) {
        const household = households.find((h) => h.members.some((m) => m.id === member.id));
        urgentList.push({
          id: member.id,
          name: member.name,
          contact: member.contact || null,
          household: household?.label ?? "Unknown",
          consecutiveAbsences,
          reason: `Missed last ${consecutiveAbsences} services in a row`,
        });
      }
    }

    // Sort by highest absence streak
    return urgentList.sort((a, b) => b.consecutiveAbsences - a.consecutiveAbsences);
  }, [members.data, services.data, attendance.data, threshold]);

  return { items, isPopupEnabled };
}

export function UrgentFollowUpModal() {
  const { items: urgentMembers, isPopupEnabled } = useUrgentFollowUps();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isPopupEnabled || urgentMembers.length === 0) return;

    // Check if dismissed in this session
    if (typeof window !== "undefined") {
      const dismissed = sessionStorage.getItem(SESSION_FOLLOWUP_DISMISSED);
      if (dismissed) return;

      // Automatically pop up after 1.2s to alert admin/taker
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [urgentMembers.length, isPopupEnabled]);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_FOLLOWUP_DISMISSED, "true");
    }
    setOpen(false);
  };

  if (!isPopupEnabled || urgentMembers.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleDismiss()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md p-0 overflow-hidden border-destructive/30 shadow-2xl rounded-2xl mx-auto">
        {/* Urgent Red Alert Header */}
        <div className="bg-destructive/15 border-b border-destructive/20 p-5 text-center relative">
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close"
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive text-white shadow-md">
            <AlertTriangle className="h-6 w-6 animate-pulse" />
          </div>

          <DialogTitle className="text-lg font-bold text-destructive">
            Urgent Follow-Up Required
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-foreground/80 mt-1 max-w-xs mx-auto font-medium">
            <strong>
              {urgentMembers.length} {urgentMembers.length === 1 ? "member has" : "members have"}
            </strong>{" "}
            missed 3+ consecutive services. Please reach out to them today.
          </DialogDescription>
        </div>

        {/* List of Urgent Members */}
        <div className="p-5 space-y-3 max-h-72 overflow-y-auto">
          {urgentMembers.map((member) => (
            <div
              key={member.id}
              className="surface p-3 rounded-xl border border-destructive/20 flex items-center justify-between gap-3 shadow-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{member.name}</span>
                  <span className="rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-bold shrink-0">
                    {member.consecutiveAbsences} in a row
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                  <span>{member.household}</span>
                  {member.contact && (
                    <>
                      <span>·</span>
                      <a
                        href={`tel:${member.contact}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                      >
                        <Phone className="h-3 w-3" />
                        {member.contact}
                      </a>
                    </>
                  )}
                </div>
              </div>

              {member.contact && (
                <a
                  href={`tel:${member.contact}`}
                  className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold shrink-0 hover:bg-primary/90 flex items-center gap-1 shadow-xs"
                >
                  <Phone className="h-3.5 w-3.5" /> Call
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Action Footer */}
        <div className="p-5 pt-0 flex flex-col gap-2 border-t border-border/40 pt-4">
          <Link to="/reports" onClick={handleDismiss}>
            <Button size="lg" className="h-11 w-full text-sm font-semibold gap-2">
              <HeartHandshake className="h-4 w-4" />
              View Full Follow-up List <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground text-xs h-9"
            onClick={handleDismiss}
          >
            I will follow up later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
