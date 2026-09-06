import { format, parseISO } from "date-fns";

import { normalizeMemberCategory, type Member, type MemberCategory, type Service } from "./data";

const GROUPS: {
  key: "adult" | "youth" | "child";
  label: string;
  categories: MemberCategory[];
}[] = [
  { key: "adult", label: "Adult", categories: ["adult"] },
  { key: "youth", label: "Youth", categories: ["youth"] },
  { key: "child", label: "Children", categories: ["child"] },
];

export function buildAttendanceSummary({
  date,
  present,
  service,
}: {
  date?: string | undefined;
  present: Member[];
  service?: Partial<Service> | null;
}) {
  const day = date ? parseISO(date) : new Date();
  const heading = `${format(day, "EEEE")} Attendance for ${format(day, "dd/MM/yy")}`;
  const workers = present.filter((m) => m.is_worker);

  const out: string[] = [];
  let totalAll = 0;

  for (const group of GROUPS) {
    const inGroup = present.filter((m) =>
      group.categories.includes(normalizeMemberCategory(m.category)),
    );

    const memMale = inGroup.filter((m) => m.gender === "male").length;
    const memFemale = inGroup.filter((m) => m.gender === "female").length;

    let visMale = 0;
    let visFemale = 0;
    if (service) {
      if (group.key === "adult") {
        visMale = service.visitor_adult_male ?? 0;
        visFemale = service.visitor_adult_female ?? 0;
      } else if (group.key === "youth") {
        visMale = service.visitor_youth_male ?? 0;
        visFemale = service.visitor_youth_female ?? 0;
      } else if (group.key === "child") {
        visMale = service.visitor_child_male ?? 0;
        visFemale = service.visitor_child_female ?? 0;
      }
    }

    const maleTotal = memMale + visMale;
    const femaleTotal = memFemale + visFemale;
    const groupTotal = maleTotal + femaleTotal;

    if (groupTotal === 0) continue;

    out.push(`${group.label} (M=${maleTotal}; F=${femaleTotal})`);
    totalAll += groupTotal;
  }

  out.push("");
  out.push(`Total = ${totalAll}`);

  const blocks = [heading, "", ...out];

  // Optional visitor breakdown note if visitors exist
  const visitorTotal =
    (service?.visitor_adult_male ?? 0) +
    (service?.visitor_adult_female ?? 0) +
    (service?.visitor_youth_male ?? 0) +
    (service?.visitor_youth_female ?? 0) +
    (service?.visitor_child_male ?? 0) +
    (service?.visitor_child_female ?? 0);

  if (visitorTotal > 0) {
    const visitorParts: string[] = [];
    if (service?.visitor_notes?.trim()) {
      visitorParts.push(`Note: ${service.visitor_notes.trim()}`);
    }
    visitorParts.push(`Visitors/Guests included: ${visitorTotal}`);
    blocks.push("", ...visitorParts);
  }

  if (workers.length > 0) {
    const workerOut: string[] = [];
    let workerTotal = 0;
    for (const group of GROUPS) {
      const inGroup = workers.filter((m) =>
        group.categories.includes(normalizeMemberCategory(m.category)),
      );
      if (inGroup.length === 0) continue;
      const male = inGroup.filter((m) => m.gender === "male").length;
      const female = inGroup.filter((m) => m.gender === "female").length;
      workerOut.push(`${group.label} (M=${male}; F=${female})`);
      workerTotal += inGroup.length;
    }
    workerOut.push("");
    workerOut.push(`Total = ${workerTotal}`);
    blocks.push("", "Workers", "", ...workerOut);
  }

  return blocks.join("\n");
}

