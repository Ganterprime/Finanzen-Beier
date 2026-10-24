import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CategoryBars } from '@/components/CategoryBars';
import { FilterBar } from '@/components/FilterBar';
import { Card, Muted, Screen, Segmented, Title } from '@/components/ui';
import { MONTHS, formatEuro, formatPercent, previousPeriod } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { EntryType } from '@/lib/types';
import { byScope, sumByCategory, totals, useTransactions } from '@/lib/useTransactions';
import { useHousehold } from '@/providers/HouseholdProvider';

export default function Analysis() {
  const t = useTheme();
  const { period, scope, members, category, memberName } = useHousehold();
  const [type, setType] = useState<EntryType>('ausgabe');

  const current = useTransactions(period);
  const prev = useTransactions(previousPeriod(period));
  const year = useTransactions({ year: period.year, month: null });

  const isFixed = (id: string) => category(id)?.is_fixed_cost ?? false;
  const shown = byScope(current.items, scope);
  const sum = totals(shown, isFixed);
  const prevSum = totals(byScope(prev.items, scope), isFixed);

  const rows = sumByCategory(shown, type);
  const compare = useMemo(
    () => new Map(sumByCategory(byScope(prev.items, scope), type).map((r) => [r.categoryId, r.cents])),
    [prev.items, scope, type],
  );

  // Verlauf über die Monate des gewählten Jahres
  const months = useMemo(() => {
    const out = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
    for (const tx of byScope(year.items, scope)) {
      const m = Number(tx.booked_on.slice(5, 7)) - 1;
      if (tx.type === 'einnahme') out[m].income += tx.amount_cents;
      else out[m].expense += tx.amount_cents;
    }
    return out;
  }, [year.items, scope]);
  const monthMax = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));
  const activeMonths = months.filter((m) => m.expense > 0).length;

  // Anteil pro Person (nur in der gemeinsamen Ansicht sinnvoll)
  const perPerson = useMemo(() => {
    const all = current.items.filter((tx) => tx.type === 'ausgabe');
    const total = all.reduce((s, tx) => s + tx.amount_cents, 0);
    const keys: (string | null)[] = [...members.map((m) => m.user_id), null];
    return keys
      .map((k) => {
        const cents = all.filter((tx) => tx.person_id === k).reduce((s, tx) => s + tx.amount_cents, 0);
        return { key: k, cents, share: total ? cents / total : 0 };
      })
      .filter((r) => r.cents > 0);
  }, [current.items, members]);

  const change = (now: number, before: number) => (before ? (now - before) / before : NaN);

  return (
    <Screen>
      <FilterBar />

      <View style={styles.kpis}>
        <Kpi label="Sparquote" value={sum.income ? formatPercent(sum.balance / sum.income) : '–'} />
        <Kpi label="Fixkostenquote" value={sum.income ? formatPercent(sum.fixed / sum.income) : '–'} />
        <Kpi label="Ausgaben / Einnahmen" value={sum.income ? formatPercent(sum.expense / sum.income) : '–'} />
        <Kpi
          label="Variable Ausgaben"
          value={formatEuro(sum.expense - sum.fixed)}
          sub={sum.expense ? `${formatPercent((sum.expense - sum.fixed) / sum.expense)} der Ausgaben` : undefined}
        />
        <Kpi
          label="Ausgaben vs. Vorzeitraum"
          value={formatPercent(change(sum.expense, prevSum.expense))}
          sub={`vorher ${formatEuro(prevSum.expense)}`}
        />
        <Kpi
          label="Ø Ausgaben pro Monat"
          value={activeMonths ? formatEuro(months.reduce((s, m) => s + m.expense, 0) / activeMonths) : '–'}
          sub={`im Jahr ${period.year}`}
        />
      </View>

      <Card>
        <View style={styles.headerRow}>
          <Title>Pro Kategorie</Title>
          <View style={{ width: 200 }}>
            <Segmented
              options={[
                { value: 'ausgabe', label: 'Ausgaben' },
                { value: 'einnahme', label: 'Einnahmen' },
              ]}
              value={type}
              onChange={setType}
            />
          </View>
        </View>
        <CategoryBars rows={rows} compare={compare} />
      </Card>

      {scope === 'alle' && perPerson.length > 1 && (
        <Card>
          <Title>Ausgaben pro Person</Title>
          {perPerson.map((r) => (
            <View key={String(r.key)} style={styles.personRow}>
              <Text style={{ color: t.text, flex: 1 }}>{memberName(r.key)}</Text>
              <Text style={{ color: t.text, fontWeight: '600' }}>{formatEuro(r.cents)}</Text>
              <Text style={{ color: t.muted, width: 54, textAlign: 'right' }}>{formatPercent(r.share)}</Text>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Title>Verlauf {period.year}</Title>
        <View style={styles.chart}>
          {months.map((m, i) => (
            <View key={i} style={styles.monthCol}>
              <View style={styles.barPair}>
                <View style={[styles.bar, { height: `${(m.income / monthMax) * 100}%`, backgroundColor: t.income }]} />
                <View style={[styles.bar, { height: `${(m.expense / monthMax) * 100}%`, backgroundColor: t.expense }]} />
              </View>
              <Text
                style={{
                  color: period.month === i + 1 ? t.text : t.muted,
                  fontSize: 10,
                  fontWeight: period.month === i + 1 ? '700' : '400',
                }}
              >
                {MONTHS[i].slice(0, 3)}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Muted style={{ color: t.income }}>■ Einnahmen</Muted>
          <Muted style={{ color: t.expense }}>■ Ausgaben</Muted>
        </View>
      </Card>
    </Screen>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.kpi, { backgroundColor: t.card, borderColor: t.border }]}>
      <Muted>{label}</Muted>
      <Text style={{ color: t.text, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
      {sub && <Muted style={{ fontSize: 12 }}>{sub}</Muted>}
    </View>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { flexGrow: 1, flexBasis: 150, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chart: { flexDirection: 'row', height: 140, alignItems: 'flex-end', gap: 4 },
  monthCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  barPair: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, flex: 1, width: '100%', justifyContent: 'center' },
  bar: { width: '40%', borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 1 },
});
