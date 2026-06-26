import { useRef, useCallback, useEffect, useState } from "react";

let globalAudioContext: AudioContext | null = null;
let globalInterval: ReturnType<typeof setInterval> | null = null;
let globalIsPlaying = false;

/**
 * Hook that plays a persistent alarm sound in a loop until stopped.
 * Supports urgent mode (faster, louder alarm for deliveries waiting 10+ min).
 */
export function useDeliveryAlarm() {
  const isPlayingRef = useRef(false); // keep local ref for component rendering if needed, but we'll use a state for UI
  const [isPlaying, setIsPlaying] = useState(globalIsPlaying);

  useEffect(() => {
    // Keep local state in sync with global (rough approximation for UI)
    const interval = setInterval(() => {
      if (isPlaying !== globalIsPlaying) setIsPlaying(globalIsPlaying);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const playBeep = useCallback((ctx: AudioContext, urgent = false) => {
    const now = ctx.currentTime;
    const baseFreq = urgent ? 1000 : 880;
    const volume = urgent ? 0.45 : 0.3;

    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = urgent ? "sawtooth" : "square";
    osc1.frequency.setValueAtTime(baseFreq, now);
    gain1.gain.setValueAtTime(volume, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second tone (higher)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = urgent ? "sawtooth" : "square";
    osc2.frequency.setValueAtTime(baseFreq + 220, now + 0.18);
    gain2.gain.setValueAtTime(volume, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.35);

    // Third tone
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = urgent ? "sawtooth" : "square";
    osc3.frequency.setValueAtTime(baseFreq + 440, now + 0.4);
    gain3.gain.setValueAtTime(volume + 0.05, now + 0.4);
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.4);
    osc3.stop(now + 0.6);

    // Extra urgent: fourth rapid tone
    if (urgent) {
      const osc4 = ctx.createOscillator();
      const gain4 = ctx.createGain();
      osc4.type = "sawtooth";
      osc4.frequency.setValueAtTime(baseFreq + 660, now + 0.65);
      gain4.gain.setValueAtTime(0.5, now + 0.65);
      gain4.gain.exponentialRampToValueAtTime(0.01, now + 0.85);
      osc4.connect(gain4);
      gain4.connect(ctx.destination);
      osc4.start(now + 0.65);
      osc4.stop(now + 0.85);
    }
  }, []);

  const vibrate = useCallback((urgent = false) => {
    if ("vibrate" in navigator) {
      navigator.vibrate(
        urgent
          ? [200, 50, 200, 50, 200, 50, 400]  // rapid intense pattern
          : [300, 100, 300, 100, 500]
      );
    }
  }, []);

  const startAlarm = useCallback((urgent = false) => {
    if (globalIsPlaying) return;
    globalIsPlaying = true;
    isPlayingRef.current = true;
    setIsPlaying(true);

    vibrate(urgent);

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      globalAudioContext = ctx;

      playBeep(ctx, urgent);

      // Urgent: repeat faster (every 1.2s instead of 2s)
      const interval = urgent ? 1200 : 2000;
      globalInterval = setInterval(() => {
        if (ctx.state === "suspended") ctx.resume();
        playBeep(ctx, urgent);
        vibrate(urgent);
      }, interval);
    } catch (e) {
      console.warn("Web Audio API não disponível:", e);
    }
  }, [playBeep, vibrate]);

  const stopAlarm = useCallback(() => {
    globalIsPlaying = false;
    isPlayingRef.current = false;
    setIsPlaying(false);

    if (globalInterval) {
      clearInterval(globalInterval);
      globalInterval = null;
    }
    
    if (globalAudioContext) {
      globalAudioContext.close().catch(() => {});
      globalAudioContext = null;
    }
  }, []);

  useEffect(() => {
    return () => { stopAlarm(); };
  }, [stopAlarm]);

  return {
    startAlarm,
    stopAlarm,
    isPlaying: isPlayingRef,
    isCurrentlyPlaying: isPlaying
  };
}
