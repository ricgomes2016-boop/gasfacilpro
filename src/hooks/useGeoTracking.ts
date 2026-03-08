import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const MIN_DISTANCE_METERS = 20;
const MAX_TIME_WITHOUT_UPDATE_MS = 2 * 60 * 1000; // 2 minutes

// Haversine formula to calculate distance in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
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
  const watchIdRef = useRef<number | null>(null);
  const entregadorIdRef = useRef<string | null>(null);
  const lastStateRef = useRef<{ lat: number, lng: number, time: number } | null>(null);
  const statusRef = useRef<string>("offline");
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Screen Wake Lock is active');
      }
    } catch (err: any) {
      console.warn(`WakeLock erro: ${err.name}, ${err.message}`);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current !== null) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log('Screen Wake Lock released');
    }
  };

  const updateLocation = useCallback(async (lat: number, lng: number) => {
    if (!entregadorIdRef.current) return;
    
    // Stop updating completely if offline
    if (statusRef.current === "offline") return;

    const now = Date.now();
    const last = lastStateRef.current;

    let shouldUpdate = false;

    if (!last) {
      shouldUpdate = true;
    } else {
      const distance = getDistance(last.lat, last.lng, lat, lng);
      const timeDiff = now - last.time;
      
      // Update if moved more than 20 meters, OR if 2 minutes have passed (heartbeat)
      if (distance >= MIN_DISTANCE_METERS || timeDiff >= MAX_TIME_WITHOUT_UPDATE_MS) {
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      lastStateRef.current = { lat, lng, time: now };
      try {
        await supabase
          .from("entregadores")
          .update({ latitude: lat, longitude: lng })
          .eq("id", entregadorIdRef.current);
      } catch (err) {
        console.error("Erro ao atualizar localização no banco:", err);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!navigator.geolocation) {
      console.warn("Geolocalização não suportada pelo navegador");
      return;
    }

    let channel: any;
    let handleVisibilityChange: () => void;

    const init = async () => {
      // Get initial entregador data
      const { data } = await supabase
        .from("entregadores")
        .select("id, status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!data) return;
      entregadorIdRef.current = data.id;
      statusRef.current = data.status || "offline";

      // Subscribe to real-time status changes
      channel = supabase
        .channel('entregador_status_changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'entregadores',
            filter: `id=eq.${data.id}`
          },
          (payload) => {
            const newStatus = payload.new.status;
            statusRef.current = newStatus;
            
            if (newStatus === "offline") {
              releaseWakeLock();
            } else {
              requestWakeLock();
            }
          }
        )
        .subscribe();

      // Initial wake lock if online
      if (statusRef.current !== "offline") {
        requestWakeLock();
      }

      // Handle visibility change for wake lock recovery
      // When user minimizes and maximizes, Wakelock is lost, needs re-request
      handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && statusRef.current !== "offline") {
          requestWakeLock();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Start watching position continuously
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          updateLocation(position.coords.latitude, position.coords.longitude);
        },
        (err) => {
          console.warn("Erro de watchPosition:", err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10_000,
          timeout: 10_000,
        }
      );

      // Force immediate first ping
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateLocation(position.coords.latitude, position.coords.longitude);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5_000 }
      );
    };

    init();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      releaseWakeLock();
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (handleVisibilityChange) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [user, updateLocation]);
}
