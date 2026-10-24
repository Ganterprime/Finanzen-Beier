import { Platform } from 'react-native';

import { supabase } from './supabase';

const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;

export type WebPushStatus = 'unsupported' | 'needs-homescreen' | 'default' | 'granted' | 'denied';

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Manifest, Homescreen-Metadaten und Service Worker für die Web-App einrichten. */
export function setupWebApp() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const add = (tag: string, attrs: Record<string, string>) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  };
  if (!document.querySelector('link[rel="manifest"]')) {
    add('link', { rel: 'manifest', href: '/manifest.json' });
    add('link', { rel: 'apple-touch-icon', href: '/icon-180.png' });
    add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    add('meta', { name: 'apple-mobile-web-app-title', content: 'Finanzen' });
    add('meta', { name: 'theme-color', content: '#2F6FED' });
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

export function webPushStatus(): WebPushStatus {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'unsupported';
  if (isIOS() && !isStandalone()) return 'needs-homescreen';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !vapidPublicKey) {
    return 'unsupported';
  }
  return Notification.permission;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Fragt nach Erlaubnis (muss durch einen Klick ausgelöst werden) und speichert das Abo. */
export async function enableWebPush(): Promise<WebPushStatus> {
  const status = webPushStatus();
  if (status === 'unsupported' || status === 'needs-homescreen' || status === 'denied') return status;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
    }));

  const { error } = await supabase.rpc('save_web_push_subscription', { p_subscription: subscription.toJSON() });
  if (error) throw error;
  return 'granted';
}

/** Gibt die Anzahl der erreichten Geräte zurück. */
export async function sendTestPush(): Promise<number | null> {
  const { data, error } = await supabase.functions.invoke('notify-new-transaction', { body: { test: true } });
  if (!error) return typeof data?.web === 'number' ? data.web : null;
  // Fehlertext der Funktion anzeigen statt der allgemeinen Meldung
  const context = (error as { context?: Response }).context;
  const detail = await context?.json?.().catch(() => null);
  throw new Error(detail?.error ?? error.message);
}
