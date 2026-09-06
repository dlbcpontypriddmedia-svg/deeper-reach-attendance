import type { AttendanceRecord, Household, Member, Service } from "@/lib/data";

export interface FollowUpConcern {
  id: string;
  name: string;
  contact: string | null;
  household: string;
  total: number;
  presentCount: number;
  percent: number;
  streak: number;
  severity: "critical" | "warning";
  reason: string;
}

export function computeFollowUpConcerns({
  members,
  services,
  attendance,
  households,
  workerIds,
  scope = "everyone",
  threshold = 3,
  chronicPercentLimit = 40,
}: {
  members: Member[];
  services: Service[];
  attendance: AttendanceRecord[];
  households: Household[];
  workerIds?: Set<string>;
  scope?: "everyone" | "workers";
  threshold?: number;
  chronicPercentLimit?: number;
}): FollowUpConcern[] {
  if (!members.length || !services.length || !attendance.length) {
    return [];
  }

  // Find services that have attendance recorded, sorted chronologically ascending
  const recordedServiceIds = new Set(attendance.map((r) => r.service_id));
  const activeRecordedServices = services
    .filter((s) => recordedServiceIds.has(s.id))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalRecordedCount = activeRecordedServices.length;

  // Need at least 2 recorded services held before calculating follow-ups
  if (totalRecordedCount < 2) {
    return [];
  }

  // Build lookup map: memberId -> serviceId -> status
  const recordMap = new Map<string, Map<string, string>>();
  for (const rec of attendance) {
    if (!recordMap.has(rec.member_id)) {
      recordMap.set(rec.member_id, new Map());
    }
    recordMap.get(rec.member_id)!.set(rec.service_id, rec.status);
  }

  const results: FollowUpConcern[] = [];

  for (const member of members) {
    if (scope === "workers" && workerIds && !workerIds.has(member.id)) {
      continue;
    }

    const memberRecords = recordMap.get(member.id);
    if (!memberRecords) continue;

    let presentCount = 0;
    let absentCount = 0;
    let consecutiveAbsences = 0;

    // Count backwards from most recent service for absence streak
    for (let i = activeRecordedServices.length - 1; i >= 0; i -= 1) {
      const s = activeRecordedServices[i];
      const status = memberRecords.get(s.id);

      if (status === "present") {
        presentCount += 1;
      } else if (status === "absent") {
        absentCount += 1;
      }

      // Track streak from the very latest service
      if (absentCount === i + 1 || (consecutiveAbsences === activeRecordedServices.length - 1 - i && status === "absent")) {
        consecutiveAbsences += 1;
      }
    }

    // Recalculate full present/absent across all active recorded services
    presentCount = 0;
    for (const s of activeRecordedServices) {
      if (memberRecords.get(s.id) === "present") {
        presentCount += 1;
      }
    }

    // Accurate streak from latest service backwards
    consecutiveAbsences = 0;
    for (let i = activeRecordedServices.length - 1; i >= 0; i -= 1) {
      const s = activeRecordedServices[i];
      const st = memberRecords.get(s.id);
      if (st === "absent") {
        consecutiveAbsences += 1;
      } else {
        break;
      }
    }

    const total = activeRecordedServices.length;
    const percent = Math.round((presentCount / total) * 100);
    const isLatestAbsent = memberRecords.get(activeRecordedServices[activeRecordedServices.length - 1].id) === "absent";
    const household = households.find((h) => h.members.some((m) => m.id === member.id));

    // Criteria:
    // 1. Prolonged absence streak: missed threshold+ services in a row
    const isProlongedAbsence = consecutiveAbsences >= threshold;

    // 2. Complete Inactivity: 0% attendance across 2+ services
    const isCompleteInactivity = total >= 2 && presentCount === 0;

    // 3. Chronic low attendance: < chronicPercentLimit% across 3+ services and absent in latest
    const isChronicLowAttendance = total >= 3 && percent < chronicPercentLimit && isLatestAbsent;

    // 4. Missed both services in a 2-service pool
    const isMissedBothInTwo = total === 2 && presentCount === 0;

    if (!isProlongedAbsence && !isCompleteInactivity && !isChronicLowAttendance && !isMissedBothInTwo) {
      continue;
    }

    let severity: "critical" | "warning" = "warning";
    let reason = "";

    if (isCompleteInactivity || consecutiveAbsences >= threshold) {
      severity = "critical";
      if (consecutiveAbsences >= threshold) {
        reason = `Missed last ${consecutiveAbsences} services in a row`;
      } else {
        reason = `Absent for all ${total} services`;
      }
    } else if (isChronicLowAttendance) {
      severity = "warning";
      reason = `Attended only ${presentCount} of ${total} services (${percent}%)`;
    } else {
      severity = "warning";
      reason = `Missed last ${consecutiveAbsences} services`;
    }

    results.push({
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
    });
  }

  return results.sort((a, b) => {
    if (a.severity === "critical" && b.severity !== "critical") return -1;
    if (b.severity === "critical" && a.severity !== "critical") return 1;
    return b.streak - a.streak || a.percent - b.percent;
  });
}
