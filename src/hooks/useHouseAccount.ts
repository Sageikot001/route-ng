import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getManagerById, getHouseAccountManager, isHouseAccount } from '../api/managers';

/**
 * Hook to check if the current iOS user belongs to the House Account (Route.ng Direct)
 * Returns loading state and whether they are a house member
 */
export function useIsHouseMember() {
  const { iosUserProfile } = useAuth();

  const { data: manager, isLoading } = useQuery({
    queryKey: ['manager', iosUserProfile?.manager_id],
    queryFn: () => getManagerById(iosUserProfile!.manager_id),
    enabled: !!iosUserProfile?.manager_id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    isHouseMember: isHouseAccount(manager ?? null),
    isLoading,
    manager,
  };
}

/**
 * Hook to get the House Account manager profile
 */
export function useHouseAccountManager() {
  return useQuery({
    queryKey: ['house-account-manager'],
    queryFn: getHouseAccountManager,
    staleTime: 30 * 60 * 1000, // Cache for 30 minutes - this rarely changes
  });
}
