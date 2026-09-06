import { useEffect, useState } from "react";
import { Bell, BellRing, CheckCircle2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
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
      <DialogContent className="max-w-md p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        {/* Header Visual with Gradient and Pulsing Bell */}
        <div className="bg-depth-gradient text-white p-6 text-center relative">
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close"
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md shadow-inner">
            <BellRing className="h-8 w-8 text-white animate-bounce" />
          </div>

          <DialogTitle className="text-xl font-bold tracking-tight text-white">
            Never Miss Sunday Attendance
          </DialogTitle>
          <DialogDescription className="text-white/80 text-xs sm:text-sm mt-1 max-w-xs mx-auto">
            Enable notifications to get automatic reminders when attendance has not been recorded.
          </DialogDescription>
        </div>

        {/* Benefits List */}
        <div className="p-6 space-y-4">
          <ul className="space-y-3 text-xs sm:text-sm text-foreground">
            <li className="flex items-start gap-2.5">
              <div className="rounded-full bg-primary/10 p-1 text-primary shrink-0 mt-0.5">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <span>
                <strong>Sunday 3:00 PM Alerts:</strong> Timely reminder if Sunday attendance is still unsubmitted.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <div className="rounded-full bg-primary/10 p-1 text-primary shrink-0 mt-0.5">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <span>
                <strong>Instant 1-Click Access:</strong> Click any notification to open the attendance form directly.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <div className="rounded-full bg-primary/10 p-1 text-primary shrink-0 mt-0.5">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span>
                <strong>Smart & Quiet:</strong> Automatically pauses as soon as attendance is submitted.
              </span>
            </li>
          </ul>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <Button
              size="lg"
              className="h-12 w-full text-sm font-semibold shadow-md gap-2"
              onClick={handleEnable}
              disabled={loading}
            >
              <Bell className="h-4 w-4" />
              {loading ? "Requesting..." : "Enable Notifications"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground text-xs"
              onClick={handleDismiss}
            >
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
