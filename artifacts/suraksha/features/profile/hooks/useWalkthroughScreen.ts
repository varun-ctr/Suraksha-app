import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Animated, Easing } from "react-native";

import { firebaseAuth } from "@/repositories/firebase/firebaseClient";
import { db } from "@/repositories/supabase/supabaseClient";

/** Number of slides in the post-login walkthrough — kept alongside the hook since the slide content is static/presentational. */
export function useWalkthroughScreen(slideCount: number) {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const slideY = useRef(new Animated.Value(0)).current;

  const finish = async () => {
    const uid = firebaseAuth.currentUser?.uid;
    if (uid) {
      try {
        await db.profiles.upsert({ id: uid, walkthrough_seen: true });
      } catch {
        // best-effort — worst case the walkthrough shows again next login
      }
    }
    router.replace("/(tabs)" as never);
  };

  const goTo = (next: number) => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 20, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideY.setValue(-20);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 0, duration: 200, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (step < slideCount - 1) goTo(step + 1);
    else void finish();
  };

  return { step, opacity, slideY, finish, handleNext };
}
