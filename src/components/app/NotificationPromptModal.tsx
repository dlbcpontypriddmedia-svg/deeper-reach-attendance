import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const DISMISSED_KEY = "attendance_notif_prompt_dismissed_at";
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function NotificationPromptModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only run in client browser
    if (typeof window === "undefined" || !("Notification" in window)) return;

    // Check if permission is already granted or denied
    if (Notification.permission !== "default") return;

    // Check if user recently dismissed the modal
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const timeSince = Date.now() - parseInt(dismissedAt, 10);
      if (timeSince < THREE_DAYS_MS) return;
    }

    // Show after a gentle 1.5 second delay
    const timer = setTimeout(() => {
      setOpen(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setLoading(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        toast.success("Notifications enabled!", {
          description: "You'll now receive timely Sunday service reminders.",
        });

        // Test notification
        try {
          new Notification("🔔 Attendance Notifications Enabled", {
            body: "You will now receive automatic reminders for Sunday attendance at 3:00 PM.",
            icon: "/favicon.ico",
          });
        } catch {
          // Non-blocking
        }
      } else if (permission === "denied") {
        toast.info("Notifications blocked", {
          description: "You can re-enable them anytime from your browser site settings.",
        });
      }
    } catch (err) {
      console.error("Failed to request notification permission:", err);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleDismiss()}>
      <DialogContent className="max-w-sm p-6 text-center rounded-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Bell className="h-7 w-7 animate-bounce" />
        </div>

        <DialogTitle className="text-lg font-bold">
          Enable Attendance Reminders
        </DialogTitle>
        <DialogDescription className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
          Get notified on Sundays at 3:00 PM if service attendance has not been recorded yet.
        </DialogDescription>

        <div className="mt-5 flex flex-col gap-2">
          <Button
            size="lg"
            className="h-11 w-full text-sm font-semibold shadow-sm"
            onClick={handleEnable}
            disabled={loading}
          >
            {loading ? "Enabling..." : "Enable Notifications"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground text-xs h-9"
            onClick={handleDismiss}
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
