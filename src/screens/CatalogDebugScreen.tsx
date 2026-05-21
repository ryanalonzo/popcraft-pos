import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { getAllRenters, getCatalogStats, searchItems } from '@/api/catalog';
import { useCatalogSync } from '@/hooks/useCatalogSync';
import { useItemLookup } from '@/hooks/useItemLookup';
import { formatPeso } from '@/lib/money';
import type { Item, Renter } from '@/types';

export function CatalogDebugScreen() {
  const sync = useCatalogSync();
  const [searchQuery, setSearchQuery] = useState('');
  const [lookupCode, setLookupCode] = useState('');

  const stats = useQuery({
    queryKey: ['catalog', 'stats', sync.lastSyncAt],
    queryFn: getCatalogStats,
  });

  const renters = useQuery({
    queryKey: ['catalog', 'renters', sync.lastSyncAt],
    queryFn: getAllRenters,
  });

  const search = useQuery<Item[]>({
    queryKey: ['catalog', 'search', searchQuery, sync.lastSyncAt],
    queryFn: () => searchItems(searchQuery, 25),
    enabled: searchQuery.trim().length > 0,
  });

  const lookup = useItemLookup(lookupCode.trim() || null);

  const handleSyncNow = useCallback(async () => {
    await sync.refetch();
  }, [sync]);

  const lastSyncLabel = useMemo(() => {
    if (!sync.lastSyncAt) return 'never';
    return new Date(sync.lastSyncAt).toLocaleString();
  }, [sync.lastSyncAt]);

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="p-6">
      <Text className="text-2xl font-bold text-ink">Catalog debug</Text>
      <Text className="mt-1 text-base text-ink-muted">
        Local SQLite cache · sync runs every 5 min in the foreground
      </Text>

      <View className="mt-4 rounded-md bg-paper-warm p-4">
        <Row label="Items" value={`${stats.data?.activeItems ?? 0} active / ${stats.data?.items ?? 0} total`} />
        <Row label="Renters" value={`${stats.data?.activeRenters ?? 0} active / ${stats.data?.renters ?? 0} total`} />
        <Row label="Last sync" value={lastSyncLabel} />
        {sync.error ? (
          <Row label="Last error" value={sync.error.message} valueClassName="text-accent" />
        ) : null}
      </View>

      <Pressable
        onPress={handleSyncNow}
        disabled={sync.isFetching}
        className={`mt-4 rounded-md px-4 py-3 ${sync.isFetching ? 'bg-ink-muted' : 'bg-accent'}`}
      >
        <Text className="text-center text-base font-semibold text-paper">
          {sync.isFetching ? 'Syncing…' : 'Sync now'}
        </Text>
      </Pressable>

      <Section title="Renters">
        {renters.data && renters.data.length > 0 ? (
          renters.data.map((r) => <RenterRow key={r.id} renter={r} />)
        ) : (
          <Text className="text-sm text-ink-muted">No renters cached yet.</Text>
        )}
      </Section>

      <Section title="Search items">
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Type a name fragment (e.g. anime, pottery)"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded border border-ink-muted bg-paper-warm px-3 py-2 text-base text-ink"
        />
        {searchQuery.trim().length === 0 ? (
          <Text className="mt-2 text-sm text-ink-muted">Type something to search.</Text>
        ) : search.isLoading ? (
          <Text className="mt-2 text-sm text-ink-muted">Searching…</Text>
        ) : (search.data?.length ?? 0) === 0 ? (
          <Text className="mt-2 text-sm text-ink-muted">No matches.</Text>
        ) : (
          search.data!.map((item) => <ItemRowView key={item.id} item={item} />)
        )}
      </Section>

      <Section title="Scan / look up code">
        <TextInput
          value={lookupCode}
          onChangeText={setLookupCode}
          placeholder="R001-00000001"
          autoCapitalize="characters"
          autoCorrect={false}
          className="rounded border border-ink-muted bg-paper-warm px-3 py-2 text-base text-ink"
        />
        <View className="mt-2">
          {lookupCode.trim().length === 0 ? (
            <Text className="text-sm text-ink-muted">Enter a code to look up.</Text>
          ) : lookup.isLoading ? (
            <Text className="text-sm text-ink-muted">Looking up…</Text>
          ) : lookup.error === 'invalid_format' ? (
            <Text className="text-sm text-accent">Invalid barcode format.</Text>
          ) : lookup.error === 'not_found' ? (
            <Text className="text-sm text-accent">Item not in catalog.</Text>
          ) : lookup.item ? (
            <ItemRowView item={lookup.item} />
          ) : null}
        </View>
      </Section>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <View className="flex-row items-baseline justify-between py-1">
      <Text className="text-sm text-ink-muted">{label}</Text>
      <Text className={`text-sm font-semibold text-ink ${valueClassName ?? ''}`}>
        {value}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="text-lg font-bold text-ink">{title}</Text>
      <View className="mt-2">{children}</View>
    </View>
  );
}

function RenterRow({ renter }: { renter: Renter }) {
  return (
    <View className="flex-row items-baseline justify-between py-1">
      <Text className="text-sm text-ink">{renter.name}</Text>
      <Text className="text-xs text-ink-muted">{renter.id}</Text>
    </View>
  );
}

function ItemRowView({ item }: { item: Item }) {
  return (
    <View className="mt-1 rounded bg-paper-warm px-3 py-2">
      <View className="flex-row items-baseline justify-between">
        <Text className="flex-1 pr-2 text-sm font-semibold text-ink">{item.name}</Text>
        <Text className="text-sm text-ink">{formatPeso(item.price_centavos)}</Text>
      </View>
      <Text className="text-xs text-ink-muted">
        {item.code} · {item.renter_id}
      </Text>
    </View>
  );
}
