import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export function useIdleTimeout(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleLogout = async () => {
      try {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
        toast.info("Logged out due to 10 minutes of inactivity.");
        navigate({ to: "/auth", replace: true });
      } catch (err) {
        console.error("Auto logout error:", err);
      }
    };

    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(handleLogout, timeoutMs);
    };

    // User activity events to track
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "visibilitychange",
    ];

    const onActivity = () => {
      if (document.visibilityState === "visible") {
        resetTimer();
      }
    };

    // Initialize timer
    resetTimer();

    // Attach listeners
    for (const event of events) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      for (const event of events) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, [navigate, queryClient, timeoutMs]);
}