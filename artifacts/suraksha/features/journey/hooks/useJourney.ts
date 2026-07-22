import { useCallback } from "react";

import { useApp } from "@/features/profile/context/AppContext";
import { useSafety } from "@/features/sos/context/SafetyContext";
import type { JourneyState } from "@/features/sos/context/SafetyContext";
import { sendJourneyAlerts } from "@/features/sos/services/sosAlertService";
import { useI18n } from "@/features/settings/context/LanguageContext";
import { useToast } from "@/features/settings/context/ToastContext";
import { useLocation } from "@/shared/hooks/useLocation";

export interface UseJourneyResult {
  journey: JourneyState;
  /** True once the timer has elapsed and the user hasn't checked in. */
  overdue: boolean;
  setJourneyDuration: (minutes: number) => void;
  /** Starts the journey timer and notifies trusted contacts. */
  startJourney: () => void;
  endJourney: () => void;
  checkInJourney: () => void;
}

/**
 * Screen-facing journey (timed check-in / live-location-sharing) API.
 * Wraps the journey slice of SafetyContext — journey and SOS share one state
 * machine there because an overdue journey auto-triggers SOS — and adds the
 * "notify contacts on start" orchestration that used to live in the home screen.
 */
export function useJourney(): UseJourneyResult {
  const { journey, setJourneyDuration, startJourney: startJourneyTimer, endJourney, checkInJourney } =
    useSafety();
  const { contacts, profile } = useApp();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { point, address } = useLocation();

  const overdue = journey.active && journey.seconds >= journey.duration * 60;

  const startJourney = useCallback(() => {
    startJourneyTimer();
    showToast(t("home.sharingLive"));
    void sendJourneyAlerts(
      contacts,
      point ?? null,
      journey.duration,
      profile.name.trim() || t("home.guest"),
      address,
    );
  }, [startJourneyTimer, showToast, t, contacts, point, journey.duration, profile.name, address]);

  return { journey, overdue, setJourneyDuration, startJourney, endJourney, checkInJourney };
}
