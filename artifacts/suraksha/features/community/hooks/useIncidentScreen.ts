import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { INCIDENT_TYPES } from "@/shared/utils/data";
import type { IncidentTypeKey } from "@/shared/utils/data";
import { useI18n } from "@/features/settings/context/LanguageContext";
import { useToast } from "@/features/settings/context/ToastContext";
import { useLocation } from "@/shared/hooks/useLocation";
import { reverseGeocode } from "@/core/permissions/location";
import { firebaseAuth } from "@/repositories/firebase/firebaseClient";
import { supabase } from "@/repositories/supabase/supabaseClient";
import { useCommunityReportsRepository } from "@/core/di/hooks";
import { logger } from "@/core/logger/logger";
import type { CommunityReport } from "@/domain/entities/CommunityReport";
import { fetchWeather, type WeatherData } from "@/repositories/api/weatherRepository";

export type IncidentTab = "new" | "mine";

/** All state and handlers for the incident-report screen: form, photo upload, submission, and "my reports" list. */
export function useIncidentScreen() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const router = useRouter();
  const communityReportsRepository = useCommunityReportsRepository();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();

  const [activeTab, setActiveTab] = useState<IncidentTab>(
    initialTab === "mine" ? "mine" : "new",
  );

  // Form state
  const [incidentType, setIncidentType] = useState<IncidentTypeKey>("harassment");
  const [description, setDescription] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Location & weather
  const { point, status: locStatus } = useLocation();
  const [address, setAddress] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // My reports
  const [myReports, setMyReports] = useState<CommunityReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Resolve address when GPS is ready
  useEffect(() => {
    if (point && !address) {
      reverseGeocode(point.lat, point.lng)
        .then((a) => { if (a) setAddress(a); })
        .catch(() => {});
    }
  }, [point, address]);

  // Fetch weather when GPS ready
  useEffect(() => {
    if (point) {
      fetchWeather(point.lat, point.lng)
        .then((w) => { if (w) setWeather(w); })
        .catch(() => {});
    }
  }, [point]);

  const loadMyReports = useCallback(async () => {
    if (!firebaseAuth.currentUser) return;
    setLoadingReports(true);
    try {
      const result = await communityReportsRepository.fetchMyReports();
      if (result.ok) {
        setMyReports(result.value);
      } else {
        logger.warn("[useIncidentScreen] failed to load my reports", result.error);
      }
    } finally {
      setLoadingReports(false);
    }
  }, [communityReportsRepository]);

  useEffect(() => {
    void loadMyReports();
  }, [loadMyReports]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMyReports();
    setRefreshing(false);
  }, [loadMyReports]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      showToast(t("incident.addPhoto"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const submit = async () => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      showToast(t("incident.loginRequired"));
      router.push("/login" as never);
      return;
    }
    if (!point) {
      showToast(t("incident.noLocation"));
      return;
    }

    setSubmitting(true);
    try {
      const descText = isAnonymous
        ? `[Anonymous] ${description.trim()}`
        : description.trim();

      // Attempt photo upload to Supabase Storage (non-critical — skipped on failure)
      let photoUrl: string | undefined;
      if (photoUri) {
        try {
          const ext = (photoUri.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z]/g, "j");
          const path = `${user.uid}/${Date.now()}.${ext}`;
          const response = await fetch(photoUri);
          const blob = await response.blob();
          const { error: uploadErr } = await supabase.storage
            .from("community-reports")
            .upload(path, blob, { upsert: false, contentType: `image/${ext}` });
          if (!uploadErr) {
            photoUrl = supabase.storage.from("community-reports").getPublicUrl(path).data.publicUrl;
          }
        } catch { /* non-critical — submit without photo */ }
      }

      const result = await communityReportsRepository.submitReport({
        type: incidentType,
        lat: point.lat,
        lng: point.lng,
        address: address ?? null,
        description: descText || null,
        photoUrl: photoUrl ?? null,
      });
      if (!result.ok) throw result.error;

      showToast(t("incident.submitted"));
      setDescription("");
      setPhotoUri(undefined);
      setIncidentType("harassment");
      setIsAnonymous(false);
      setActiveTab("mine");
      void loadMyReports();
    } catch {
      showToast(t("incident.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = INCIDENT_TYPES.find((i) => i.key === incidentType)!;

  return {
    activeTab, setActiveTab,
    incidentType, setIncidentType, description, setDescription, photoUri, setPhotoUri,
    isAnonymous, setIsAnonymous, submitting,
    point, locStatus, address, weather,
    myReports, loadingReports, refreshing, onRefresh,
    pickPhoto, submit, selectedType,
  };
}
