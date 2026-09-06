import { useEffect, useState } from "react";
import { Bell, Share2, PlusSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const SESSION_DISMISSED_KEY = "attendance_notif_prompt_session_dismissed";

export function NotificationPromptModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isIOSWithoutPWA, setIsIOSWithoutPWA] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Listen for custom open event (e.g. clicking header bell)
    const handleManualOpen = () => setOpen(true);
    window.addEventListener("open-notification-prompt", handleManualOpen);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as any).standalone);

    // On iOS Safari, web push requires "Add to Home Screen"
    if (isIOS && !isStandalone && !("Notification" in window)) {
      setIsIOSWithoutPWA(true);
    } else if ("Notification" in window) {
      if (Notification.permission === "granted") {
        return () => window.removeEventListener("open-notification-prompt", handleManualOpen);
      }
    }

    // Check if user dismissed it in this browser session
    const sessionDismissed = sessionStorage.getItem(SESSION_DISMISSED_KEY);
    if (sessionDismissed) {
      return () => window.removeEventListener("open-notification-prompt", handleManualOpen);
    }

    // Delay 1 second after page load
    const timer = setTimeout(() => {
      setOpen(true);
    }, 1000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("open-notification-prompt", handleManualOpen);
    };
  }, []);

  const handleEnable = async () => {
    if (typeof window === "undefined") return;

    if (!("Notification" in window)) {
      toast.info("Notifications on iPhone", {
        description:
          "Tap Share (⎋) in Safari and choose 'Add to Home Screen' to enable notifications.",
      });
      setOpen(false);
      return;
    }

    setLoading(true);

    try {
      const permission = await Notification.requestPermission();
      window.dispatchEvent(new CustomEvent("notification-permission-changed"));

      if (permission === "granted") {
        toast.success("Notifications enabled!", {
          description: "You'll now receive timely Sunday service reminders.",
        });

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
          description: "You can re-enable them anytime in your browser site settings.",
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
    sessionStorage.setItem(SESSION_DISMISSED_KEY, "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleDismiss()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm p-6 text-center rounded-2xl mx-auto">
        <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Bell className="h-7 w-7 animate-bounce" />
        </div>

        <DialogTitle className="text-lg font-bold">Enable Attendance Reminders</DialogTitle>

        <DialogDescription className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
          {isIOSWithoutPWA
            ? "To get attendance reminders on iPhone, tap Share (⎋) in Safari and select 'Add to Home Screen'."
            : "Get notified on Sundays at 3:00 PM if service attendance has not been recorded yet."}
        </DialogDescription>

        {isIOSWithoutPWA ? (
          <div className="mt-4 rounded-xl bg-secondary/60 p-3 text-left text-xs text-foreground space-y-2 border border-border/50">
            <div className="flex items-center gap-2 font-medium">
              <Share2 className="h-4 w-4 text-primary" />
              <span>1. Tap the Share button in Safari</span>
            </div>
            <div className="flex items-center gap-2 font-medium">
              <PlusSquare className="h-4 w-4 text-primary" />
              <span>2. Tap 'Add to Home Screen'</span>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {!isIOSWithoutPWA && (
            <Button
              size="lg"
              className="h-11 w-full text-sm font-semibold shadow-sm"
              onClick={handleEnable}
              disabled={loading}
            >
              {loading ? "Enabling..." : "Enable Notifications"}
            </Button>
          )}
          <Button
            type="button"
            variant={isIOSWithoutPWA ? "default" : "ghost"}
            size="sm"
            className={
              isIOSWithoutPWA
                ? "h-11 w-full text-sm font-semibold"
                : "text-muted-foreground text-xs h-9"
            }
            onClick={handleDismiss}
          >
            {isIOSWithoutPWA ? "Got It" : "Maybe Later"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function triggerNotificationModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-notification-prompt"));
  }
}
