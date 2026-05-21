import { useLocalSearchParams } from 'expo-router';

import { SaleDetailScreen } from '@/screens/SaleDetailScreen';

export default function SaleDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SaleDetailScreen saleId={String(id)} />;
}
