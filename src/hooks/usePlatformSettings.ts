import { useQuery } from '@tanstack/react-query';
import { getPlatformSettings, DEFAULT_SETTINGS, type PlatformSettings } from '../api/settings';

export function usePlatformSettings() {
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: getPlatformSettings,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });

  const earningsPerCard = settings?.earnings_per_card ?? DEFAULT_SETTINGS.earnings_per_card;
  const minTransactions = settings?.min_daily_transactions ?? DEFAULT_SETTINGS.min_daily_transactions;
  const maxTransactions = settings?.max_daily_transactions ?? DEFAULT_SETTINGS.max_daily_transactions;

  return {
    settings: settings ?? DEFAULT_SETTINGS,
    isLoading,
    error,
    // Convenience getters for commonly used values
    earningsPerCard,
    minDailyTransactions: minTransactions,
    maxDailyTransactions: maxTransactions,
    // Calculated potential daily earnings range
    minDailyEarnings: earningsPerCard * minTransactions,
    maxDailyEarnings: earningsPerCard * maxTransactions,
    maxBanksPerUser: settings?.max_banks_per_user ?? DEFAULT_SETTINGS.max_banks_per_user,
    commissionRate: settings?.manager_commission_rate ?? DEFAULT_SETTINGS.manager_commission_rate,
    maintenanceMode: settings?.maintenance_mode ?? DEFAULT_SETTINGS.maintenance_mode,
    registrationOpen: settings?.registration_open ?? DEFAULT_SETTINGS.registration_open,
  };
}

export type { PlatformSettings };
