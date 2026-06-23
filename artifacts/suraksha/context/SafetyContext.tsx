import * as Location from "expo-location";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { SosModal } from "@/components/SosModal";
import { getCurrentLocation, reverseGeocode } from "@/lib/location";
import { endLiveSession, startLiveSession, updateLiveSession } from "@/lib/liveSession";

export interface Coords {
  lat: number;
  lng: number;
  accuracy: number | null;
}

interface SosState {
  active: boolean;
  seconds: number;
  coords: Coords | null;
  address: string | null;
  loading: boolean;
  shareUrl: string | null;
}

interface JourneyState {
  active: boolean;
  seconds: number;
  duration: number;
}

interface SafetyContextValue {
  sos: SosState;
  triggerSOS: () => void;
  cancelSOS: () => void;
  journey: JourneyState;
  setJourneyDuration: (d: number) => void;
  startJourney: () => void;
  endJourney: () => void;
}

const SafetyContext = createContext<SafetyContextValue | null>(null);

export function SafetyProvider({ children }: { children: React.ReactNode }) {
  const [sos, setSos] = useState<SosState>({
    active: false,
    seconds: 0,
    coords: null,
    address: null,
    loading: false,
    shareUrl: null,
  });
  const [journey, setJourney] = useState<JourneyState>({
    active: false,
    seconds: 0,
    duration: 15,
  });

  const sosTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const journeyTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const shareIdRef = useRef<string | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const stopLiveTracking = useCallback(async () => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    if (shareIdRef.current) {
      await endLiveSession(shareIdRef.current);
      shareIdRef.current = null;
    }
  }, []);

  const fetchLocationAndStartTracking = useCallback(async () => {
    const point = await getCurrentLocation();
    if (!point) {
      setSos((s) => ({ ...s, loading: false, coords: null, address: null }));
      return;
    }

    setSos((s) => ({ ...s, loading: false, coords: point }));

    const addr = await reverseGeocode(point.lat, point.lng);
    setSos((s) => (s.coords ? { ...s, address: addr } : s));

    // Start live session (silently skipped if not logged in)
    const session = await startLiveSession(point.lat, point.lng, point.accuracy);
    if (session) {
      shareIdRef.current = session.shareId;
      setSos((s) => ({ ...s, shareUrl: session.shareUrl }));

      // Begin watching position and pushing to Supabase
      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 10,
          },
          (loc) => {
            if (shareIdRef.current) {
              void updateLiveSession(
                shareIdRef.current,
                loc.coords.latitude,
                loc.coords.longitude,
                loc.coords.accuracy ?? null,
              );
              setSos((s) => ({
                ...s,
                coords: {
                  lat: loc.coords.latitude,
                  lng: loc.coords.longitude,
                  accuracy: loc.coords.accuracy ?? null,
                },
              }));
            }
          },
        );
        watchRef.current = sub;
      } catch {
        // Location watch failed — SOS still works without it
      }
    }
  }, []);

  const triggerSOS = useCallback(() => {
    setSos({
      active: true,
      seconds: 0,
      coords: null,
      address: null,
      loading: true,
      shareUrl: null,
    });
    void fetchLocationAndStartTracking();
  }, [fetchLocationAndStartTracking]);

  const cancelSOS = useCallback(() => {
    void stopLiveTracking();
    setSos({
      active: false,
      seconds: 0,
      coords: null,
      address: null,
      loading: false,
      shareUrl: null,
    });
  }, [stopLiveTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void stopLiveTracking();
    };
  }, [stopLiveTracking]);

  useEffect(() => {
    if (sos.active) {
      sosTimer.current = setInterval(
        () => setSos((s) => ({ ...s, seconds: s.seconds + 1 })),
        1000,
      );
    } else if (sosTimer.current) {
      clearInterval(sosTimer.current);
      sosTimer.current = null;
    }
    return () => {
      if (sosTimer.current) {
        clearInterval(sosTimer.current);
        sosTimer.current = null;
      }
    };
  }, [sos.active]);

  const setJourneyDuration = useCallback((d: number) => {
    setJourney((j) => ({ ...j, duration: d }));
  }, []);

  const startJourney = useCallback(() => {
    setJourney((j) => ({ ...j, active: true, seconds: 0 }));
  }, []);

  const endJourney = useCallback(() => {
    setJourney((j) => ({ ...j, active: false, seconds: 0 }));
  }, []);

  useEffect(() => {
    if (journey.active) {
      journeyTimer.current = setInterval(
        () => setJourney((j) => ({ ...j, seconds: j.seconds + 1 })),
        1000,
      );
    } else if (journeyTimer.current) {
      clearInterval(journeyTimer.current);
      journeyTimer.current = null;
    }
    return () => {
      if (journeyTimer.current) {
        clearInterval(journeyTimer.current);
        journeyTimer.current = null;
      }
    };
  }, [journey.active]);

  const value = useMemo(
    () => ({
      sos,
      triggerSOS,
      cancelSOS,
      journey,
      setJourneyDuration,
      startJourney,
      endJourney,
    }),
    [sos, triggerSOS, cancelSOS, journey, setJourneyDuration, startJourney, endJourney],
  );

  return (
    <SafetyContext.Provider value={value}>
      {children}
      {sos.active && <SosModal sos={sos} cancelSOS={cancelSOS} />}
    </SafetyContext.Provider>
  );
}

export function useSafety(): SafetyContextValue {
  const ctx = useContext(SafetyContext);
  if (!ctx) throw new Error("useSafety must be used within SafetyProvider");
  return ctx;
}
