import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Field, Muted, Screen, Segmented } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function Login() {
  const t = useTheme();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const creds = { email: email.trim(), password };
    const { error, data } =
      mode === 'login' ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds);
    setBusy(false);
    if (error) setMessage(error.message);
    else if (mode === 'signup' && !data.session) setMessage('Fast geschafft: Bitte bestätige die E-Mail in deinem Postfach.');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={styles.header}>
          <Text style={[styles.logo, { color: t.text }]}>Finanzen Beier</Text>
          <Muted>Eure gemeinsamen Ausgaben und Einnahmen</Muted>
        </View>
        <Card>
          <Segmented
            options={[
              { value: 'login', label: 'Anmelden' },
              { value: 'signup', label: 'Registrieren' },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Field
            label="E-Mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label="Passwort"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onSubmitEditing={submit}
          />
          {message && <Body style={{ color: t.expense }}>{message}</Body>}
          <Button
            label={mode === 'login' ? 'Anmelden' : 'Konto anlegen'}
            onPress={submit}
            loading={busy}
            disabled={!email || password.length < 6}
          />
          {mode === 'signup' && (
            <Muted>Registrieren lohnt sich nur mit Einladung: Daten sieht nur, wer zum Haushalt gehört.</Muted>
          )}
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 4, marginTop: 60, marginBottom: 12 },
  logo: { fontSize: 28, fontWeight: '800' },
});
