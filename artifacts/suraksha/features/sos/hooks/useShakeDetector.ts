import { useEffect, useRef } from "react";
import { Accelerometer } from "expo-sensors";

const UPDATE_INTERVAL_MS = 100;
/** How far acceleration magnitude must deviate from resting gravity (~1g) to count as a jolt. */
const JOLT_THRESHOLD = 2.2;
/** Jolts must land within this window to count as one deliberate shake, not scattered bumps. */
const SHAKE_WINDOW_MS = 1200;
/** Number of jolts required within the window before firing. */
const REQUIRED_JOLTS = 3;
/** Minimum time between two triggers, so one shake can't fire SOS twice. */
const TRIGGER_COOLDOWN_MS = 3000;

/**
 * Fires `onShake` after a sustained shake gesture (several sharp jolts in
 * quick succession), not a single bump — avoids false positives from the
 * phone being dropped once or jostled in a bag.
 */
export function useShakeDetector(onShake: () => void, enabled: boolean) {
  const joltTimestamps = useRef<number[]>([]);
  const lastTriggerAt = useRef(0);
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    if (!enabled) return;

    Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const jolt = Math.abs(magnitude - 1);
      if (jolt < JOLT_THRESHOLD) return;

      const now = Date.now();
      joltTimestamps.current = joltTimestamps.current.filter(
        (t) => now - t < SHAKE_WINDOW_MS,
      );
      joltTimestamps.current.push(now);

      if (
        joltTimestamps.current.length >= REQUIRED_JOLTS &&
        now - lastTriggerAt.current > TRIGGER_COOLDOWN_MS
      ) {
        lastTriggerAt.current = now;
        joltTimestamps.current = [];
        onShakeRef.current();
      }
    });

    return () => subscription.remove();
  }, [enabled]);
}
