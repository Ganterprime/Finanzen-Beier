# Finanzen Beier

Gemeinsame Finanz-App für Joschka und Talea: Ausgaben und Einnahmen erfassen, Fixkosten verwalten,
Auswertungen nach Kategorie, Monat und Jahr. Läuft auf Android, iOS und im Browser am PC.

**Stack:** Expo (React Native, TypeScript, Expo Router) · Supabase (Postgres, Auth, Realtime, Edge Functions)

## Funktionen

- Gemeinsame Übersicht und Ansicht pro Person (Umschalter oben)
- Filter nach Monat oder Jahr
- Buchung erfassen: Ausgabe/Einnahme, Betrag, Kategorie, Datum, Person, Notiz
- 24 Standardkategorien, eigene Kategorien anlegen, umbenennen, ausblenden
- Fixkosten als eigener Bereich, werden am Fälligkeitstag automatisch gebucht
- Auswertung: pro Kategorie mit Anteil und Vergleich zum Vorzeitraum, Sparquote, Fixkostenquote,
  variable Ausgaben, Anteil pro Person, Monatsverlauf
- Live-Sync zwischen allen Geräten
- Push-Nachricht an den anderen, wenn jemand etwas einträgt

## Datenschutz

Jede Tabelle ist per Row Level Security geschützt: Die Datenbank liefert Daten nur an angemeldete
Mitglieder des jeweiligen Haushalts. Neue Mitglieder kommen nur über eine Einladung des Verwalters
in den Haushalt. Keine Bankanbindung.

## Einrichtung

### 1. Supabase

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen, Region **Frankfurt (eu-central-1)**.
2. *Database → Extensions*: `pg_cron` aktivieren (für das automatische Buchen der Fixkosten).
3. *SQL Editor*: den Inhalt von `supabase/migrations/20261024000000_init.sql` einfügen und ausführen.
   Alternativ mit der Supabase CLI: `npx supabase link` und `npx supabase db push`.
4. *Authentication → Providers → Email*: „Confirm email“ eingeschaltet lassen.
5. Wenn Joschka und Talea registriert sind: *Authentication → Sign In / Providers* → „Allow new users to sign up“
   ausschalten. (Fremde sehen ohnehin nichts, das ist eine zusätzliche Absicherung.)

### 2. App starten

```bash
cp .env.example .env      # URL und anon key aus Project Settings → API eintragen
npm install
npm run web               # im Browser
npx expo start            # QR-Code mit Expo Go (Handy) scannen
```

### 3. Erste Schritte in der App

1. Joschka registriert sich, bestätigt die E-Mail und legt den Haushalt an.
2. *Einstellungen → Mitglied einladen*: Taleas E-Mail eintragen.
3. Talea registriert sich mit genau dieser E-Mail und tippt auf „Beitreten“.

### 4. Push-Benachrichtigungen

Push braucht einen echten App-Build (nicht Expo Go):

```bash
npx eas-cli@latest init                 # legt die EAS-Projekt-ID in app.json an
npx supabase functions deploy notify-new-transaction --no-verify-jwt
npx supabase secrets set WEBHOOK_SECRET=<zufälliger-langer-wert>
```

Dann in Supabase *Database → Webhooks* einen Webhook anlegen: Tabelle `transactions`, Ereignis `INSERT`,
Typ „Supabase Edge Function“ → `notify-new-transaction`, HTTP-Header `x-webhook-secret: <derselbe Wert>`.

### 5. Veröffentlichen

- **PC/Web:** `npm run build:web` erzeugt `dist/`, das z. B. bei Netlify oder Vercel hochgeladen wird.
  Die Umgebungsvariablen dort ebenfalls setzen.
- **Android:** `npx eas-cli@latest build -p android --profile preview` erzeugt eine APK zum Installieren.
- **iOS:** braucht einen Apple-Developer-Account; dann `npx eas-cli@latest build -p ios` und TestFlight.

## Projektstruktur

```
src/app/            Screens (Expo Router)
  (tabs)/           Übersicht, Buchungen, Fixkosten, Auswertung, Einstellungen
  buchung.tsx       Buchung erfassen/bearbeiten
  fixkosten-form.tsx
  kategorien.tsx
src/components/     UI-Bausteine
src/lib/            Supabase-Client, Formatierung, Daten-Hooks
src/providers/      Session und Haushalt
supabase/
  migrations/       Datenbankschema, Zugriffsregeln, Standardkategorien
  functions/        Edge Function für Push
```
