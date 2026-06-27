import { useEffect, useRef, useState } from 'react';

export function useWakeLock() {
  const [isSupported, setIsSupported] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if ('wakeLock' in navigator) {
      setIsSupported(true);
    }
  }, []);

  const requestWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsLocked(true);
      
      wakeLockRef.current.addEventListener('release', () => {
        setIsLocked(false);
      });
      
      console.log('Tela mantida acesa (Wake Lock ativado).');
    } catch (err: any) {
      console.error(`${err.name}, ${err.message}`);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsLocked(false);
        console.log('Wake Lock liberado.');
      } catch (err: any) {
        console.error(`${err.name}, ${err.message}`);
      }
    }
  };

  // Reativar se a aba voltar a ficar visível
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return { isSupported, isLocked, requestWakeLock, releaseWakeLock };
}
