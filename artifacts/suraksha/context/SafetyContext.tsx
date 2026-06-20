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
  });
  const [journey, setJourney] = useState<JourneyState>({
    active: false,
    seconds: 0,
    duration: 15,
  });

  const sosTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const journeyTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLocation = useCallback(async () => {
    const point = await getCurrentLocation();
    if (!point) {
      setSos((s) => ({ ...s, loading: false, coords: null, address: null }));
      return;
    }
    setSos((s) => ({ ...s, loading: false, coords: point }));
    const addr = await reverseGeocode(point.lat, point.lng);
    setSos((s) => (s.coords ? { ...s, address: addr } : s));
  }, []);

  const triggerSOS = useCallback(() => {
    setSos({ active: true, seconds: 0, coords: null, address: null, loading: true });
    fetchLocation();
  }, [fetchLocation]);

  const cancelSOS = useCallback(() => {
    setSos({ active: false, seconds: 0, coords: null, address: null, loading: false });
  }, []);

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
