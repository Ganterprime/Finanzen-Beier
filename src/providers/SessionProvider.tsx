import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

interface SessionState {
  session: Session | null;
  loading: boolean;
}

const SessionContext = createContext<SessionState>({ session: null, loading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      // Offline lässt sich ein abgelaufenes Login nicht erneuern. Dann den gespeicherten
      // Stand weiter nutzen, damit die App die zuletzt geladenen Daten zeigen kann.
      const session = data.session ?? (isAuthRetryableFetchError(error) ? storedSession() : null);
      setState({ session, loading: false });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && event !== 'SIGNED_OUT') return;
      setState({ session, loading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

function storedSession(): Session | null {
  try {
    const key = (supabase.auth as unknown as { storageKey: string }).storageKey;
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function useSession() {
  return useContext(SessionContext);
}
