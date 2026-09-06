import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { attendanceQuery, servicesQuery, type Service } from "@/lib/data";

const REMINDER_STORAGE_KEY = "last_sunday_attendance_reminder_ts";
const REMINDER_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

export function useAttendanceReminders() {
  const { data: services = [] } = useQuery(servicesQuery);
  const { data: attendance = [] } = useQuery(attendanceQuery);

  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });

  const [dismissed, setDismissed] = useState(false);

  // Compute attendance status for today
  const reminderStatus = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const hour = now.getHours(); // 0-23 in user's local timezone

    // Only active on Sunday at or after 3:00 PM (15:00)
    const isSundayAfter3PM = dayOfWeek === 0 && hour >= 15;

    // Get today's local date YYYY-MM-DD
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    // Find services scheduled for today
    const todaysServices = services.filter((s) => s.date === todayStr);

    // Find if there is any service today that lacks attendance records
    const attendanceServiceIds = new Set(attendance.map((a) => a.service_id));
    const pendingService = todaysServices.find((s) => !attendanceServiceIds.has(s.id));

    const isPending = isSundayAfter3PM && Boolean(pendingService);

    return {
      isSundayAfter3PM,
      isPending,
      pendingService: pendingService ?? null,
      todayStr,
    };
  }, [services, attendance]);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "denied" as NotificationPermission;
    }

    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      return res;
    } catch {
      return "denied" as NotificationPermission;
    }
  }, []);

  // Trigger browser notification if eligible and interval has elapsed
  useEffect(() => {
    if (!reminderStatus.isPending || !reminderStatus.pendingService) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (permission !== "granted") return;

    const checkAndNotify = () => {
      const lastNotified = localStorage.getItem(REMINDER_STORAGE_KEY);
      const lastTime = lastNotified ? parseInt(lastNotified, 10) : 0;
      const now = Date.now();

      if (now - lastTime >= REMINDER_INTERVAL_MS) {
        try {
          const serviceName = reminderStatus.pendingService?.name || "Sunday Service";
          const n = new Notification("⚠️ Sunday Attendance Reminder", {
            body: `Attendance for ${serviceName} has not been recorded yet. Please submit attendance now.`,
            icon: "/favicon.ico",
            tag: "sunday-attendance-reminder",
            requireInteraction: true,
          });

          n.onclick = () => {
            window.focus();
            if (reminderStatus.pendingService?.id) {
              window.location.href = `/attendance/${reminderStatus.pendingService.id}`;
            }
          };

          localStorage.setItem(REMINDER_STORAGE_KEY, String(now));
        } catch (err) {
          console.error("Browser notification trigger failed:", err);
        }
      }
    };

    checkAndNotify();
    const interval = setInterval(checkAndNotify, 60 * 1000); // Check every minute
    return () => clearInterval(interval);
  }, [reminderStatus.isPending, reminderStatus.pendingService, permission]);

  return {
    isReminderActive: reminderStatus.isPending && !dismissed,
    pendingService: reminderStatus.pendingService,
    permission,
    requestNotificationPermission,
    dismissReminder: () => setDismissed(true),
  };
}

