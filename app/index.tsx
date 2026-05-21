import { Redirect } from 'expo-router';

import { useAuthStore } from '@/state/authStore';

export default function Index() {
  const cashier = useAuthStore((s) => s.cashier);
  return <Redirect href={cashier ? '/(cashier)' : '/login'} />;
}
