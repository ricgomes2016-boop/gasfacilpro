import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Capacitor, registerPlugin } from '@capacitor/core';
import { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

const MIN_DISTANCE_METERS = 20;
const MAX_TIME_WITHOUT_UPDATE_MS = 2 * 60 * 1000; // 2 minutes

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function useGeoTracking() {
  const { user } = useAuth();
  const watchIdRef = useRef<any>(null);
  const isCapacitorWatcherRef = useRef<boolean>(false);
  const entregadorIdRef = useRef<string | null>(null);
  const lastStateRef = useRef<{ lat: number, lng: number, time: number } | null>(null);
  const statusRef = useRef<string>("offline");
  const wakeLockRef = useRef<any>(null);
  const activeRotaIdRef = useRef<string | null>(null);

  // --- WAKELOCK FOR PWA FALLBACK ---
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !Capacitor.isNativePlatform()) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Screen Wake Lock is active (PWA mode)');
      }
    } catch (err: any) {
      console.warn(`WakeLock erro: ${err.name}, ${err.message}`);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current !== null && !Capacitor.isNativePlatform()) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  // --- FETCH ACTIVE ROTA ID ---
  const fetchActiveRotaId = async () => {
    if (!entregadorIdRef.current) return;
    try {
      const { data } = await supabase.from("carregamentos_rota")
        .select("id")
        .eq("entregador_id", entregadorIdRef.current)
        .eq("status", "em_rota")
        .order("data_saida", { ascending: false })
        .limit(1)
        .maybeSingle();
      activeRotaIdRef.current = data?.id || null;
    } catch (err) {
      console.warn("Erro ao buscar rota ativa:", err);
    }
  };

  // --- STOP TRACKING (reusable) ---
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      if (isCapacitorWatcherRef.current) {
        BackgroundGeolocation.removeWatcher({ id: watchIdRef.current });
      } else if (navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    }
  }, []);

  const updateLocation = useCallback(async (lat: number, lng: number) => {
    if (!entregadorIdRef.current) return;
    if (statusRef.current === "offline") return;

    const now = Date.now();
    const last = lastStateRef.current;
    let shouldUpdate = false;

    if (!last) {
      shouldUpdate = true;
    } else {
      const distance = getDistance(last.lat, last.lng, lat, lng);
      const timeDiff = now - last.time;
      if (distance >= MIN_DISTANCE_METERS || timeDiff >= MAX_TIME_WITHOUT_UPDATE_MS) {
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      lastStateRef.current = { lat, lng, time: now };
      try {
        // Update current position
        await supabase.from("entregadores")
          .update({ latitude: lat, longitude: lng })
          .eq("id", entregadorIdRef.current);

        // Insert route history if there's an active route
        if (activeRotaIdRef.current) {
          await supabase.from("rota_historico").insert({
            rota_id: activeRotaIdRef.current,
            latitude: lat,
            longitude: lng,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error("Erro ao atualizar localização:", err);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    let channel: any;
    let handleVisibilityChange: () => void;

    const startWebTracking = () => {
      if (!navigator.geolocation) return;
      if (statusRef.current === "offline") return;
      
      // Prevent duplicate watchers
      stopTracking();
      
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => updateLocation(position.coords.latitude, position.coords.longitude),
        (err) => console.warn("Erro de watchPosition:", err.message),
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 10_000 }
      );
      isCapacitorWatcherRef.current = false;
      
      navigator.geolocation.getCurrentPosition(
        (position) => updateLocation(position.coords.latitude, position.coords.longitude),
        () => {},
        { enableHighAccuracy: true, timeout: 5_000 }
      );
    };

    const startCapacitorTracking = () => {
      // Prevent duplicate watchers
      stopTracking();
      
      BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "Rastreando rota de entrega. Desligue se pausar.",
          backgroundTitle: "GásFacil GPS Ativo",
          requestPermissions: true,
          stale: false,
          distanceFilter: MIN_DISTANCE_METERS
        },
        function callback(location, error) {
          if (error) return console.error("Background GPS Error:", error);
          if (location) updateLocation(location.latitude, location.longitude);
        }
      ).then((watcherId) => {
        watchIdRef.current = watcherId;
        isCapacitorWatcherRef.current = true;
      });
    };

    const startTrackingForPlatform = () => {
      if (Capacitor.isNativePlatform()) {
        startCapacitorTracking();
      } else {
        startWebTracking();
      }
    };

    const init = async () => {
      const { data } = await supabase.from("entregadores")
        .select("id, status")
        .eq("user_id", user.id).maybeSingle();

      if (!data) return;
      entregadorIdRef.current = data.id;
      statusRef.current = data.status || "offline";

      // Fetch active rota for history tracking
      await fetchActiveRotaId();

      channel = supabase.channel('entregador_status_changes').on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'entregadores', filter: `id=eq.${data.id}` },
        async (payload) => {
          const newStatus = payload.new.status;
          const oldStatus = statusRef.current;
          statusRef.current = newStatus;

          if (newStatus === "offline") {
            // Going offline: stop GPS and release wake lock
            stopTracking();
            releaseWakeLock();
            activeRotaIdRef.current = null;
          } else if (oldStatus === "offline" && newStatus !== "offline") {
            // Coming online: start GPS and request wake lock
            await fetchActiveRotaId();
            requestWakeLock();
            startTrackingForPlatform();
          }
        }
      ).subscribe();

      if (statusRef.current !== "offline") {
        requestWakeLock();
        startTrackingForPlatform();
      }

      handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && statusRef.current !== "offline") {
          requestWakeLock();
        }
      };
      
      if (!Capacitor.isNativePlatform()) {
        document.addEventListener('visibilitychange', handleVisibilityChange);
      }
    };

    init();

    return () => {
      stopTracking();
      releaseWakeLock();
      if (channel) supabase.removeChannel(channel);
      if (handleVisibilityChange) document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, updateLocation, stopTracking]);
}
