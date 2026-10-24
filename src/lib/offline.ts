import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/** true, solange der Browser keine Verbindung hat (nur Web). */
export function useOffline() {
  const [offline, setOffline] = useState(
    Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false,
  );
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return offline;
}

/** Abmelden und die auf dem Gerät gespeicherten Daten löschen. */
export async function signOut() {
  if (Platform.OS === 'web' && typeof caches !== 'undefined') {
    await caches.delete('daten-v1').catch(() => {});
  }
  await supabase.auth.signOut();
}
