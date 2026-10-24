import { StyleSheet, Text, View } from 'react-native';

import { AddButton } from '@/components/AddButton';
import { CategoryBars } from '@/components/CategoryBars';
import { FilterBar } from '@/components/FilterBar';
import { TransactionRow } from '@/components/TransactionRow';
import { Card, Muted, Screen, Title } from '@/components/ui';
import { formatEuro } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { byScope, sumByCategory, totals, useTransactions } from '@/lib/useTransactions';
import { useHousehold } from '@/providers/HouseholdProvider';

export default function Overview() {
  const t = useTheme();
  const { period, scope, category } = useHousehold();
  const { items } = useTransactions(period);
  const shown = byScope(items, scope);
  const sum = totals(shown, (id) => category(id)?.is_fixed_cost ?? false);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <FilterBar />

        <Card>
          <Muted>Saldo</Muted>
          <Text style={[styles.big, { color: sum.balance >= 0 ? t.income : t.expense }]}>
            {formatEuro(sum.balance)}
          </Text>
          <View style={styles.split}>
            <Stat label="Einnahmen" value={sum.income} color={t.income} />
            <Stat label="Ausgaben" value={sum.expense} color={t.expense} />
            <Stat label="davon Fixkosten" value={sum.fixed} color={t.muted} />
          </View>
        </Card>

        <Card>
          <Title>Top-Kategorien</Title>
          <CategoryBars rows={sumByCategory(shown, 'ausgabe')} limit={5} />
        </Card>

        <Card>
          <Title>Letzte Buchungen</Title>
          {shown.length === 0 && <Muted>Noch nichts eingetragen. Tippe auf +.</Muted>}
          {shown.slice(0, 8).map((item) => (
            <TransactionRow key={item.id} item={item} />
          ))}
        </Card>
        <View style={{ height: 70 }} />
      </Screen>
      <AddButton />
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Muted>{label}</Muted>
      <Text style={{ color, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
        {formatEuro(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  split: { flexDirection: 'row', gap: 10 },
});
