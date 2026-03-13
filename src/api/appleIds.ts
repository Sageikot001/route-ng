import { supabase } from './supabase';
import type { UserAppleId } from '../types';

/**
 * Get all Apple IDs for a user
 */
export async function getUserAppleIds(userId: string): Promise<UserAppleId[]> {
  const { data, error } = await supabase
    .from('user_apple_ids')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching user apple ids:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get a single Apple ID by ID
 */
export async function getAppleIdById(appleIdId: string): Promise<UserAppleId | null> {
  const { data, error } = await supabase
    .from('user_apple_ids')
    .select('*')
    .eq('id', appleIdId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching apple id:', error);
    throw error;
  }

  return data;
}

/**
 * Get the primary Apple ID for a user
 */
export async function getPrimaryAppleId(userId: string): Promise<UserAppleId | null> {
  const { data, error } = await supabase
    .from('user_apple_ids')
    .select('*')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching primary apple id:', error);
    throw error;
  }

  return data;
}

/**
 * Add a new Apple ID for a user
 */
export async function addAppleId(
  userId: string,
  appleId: string,
  label?: string
): Promise<UserAppleId> {
  // Check if this is the user's first Apple ID (should be primary)
  const existing = await getUserAppleIds(userId);
  const isPrimary = existing.length === 0;

  const { data, error } = await supabase
    .from('user_apple_ids')
    .insert({
      user_id: userId,
      apple_id: appleId.trim().toLowerCase(),
      label: label?.trim() || null,
      is_primary: isPrimary,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('This Apple ID is already registered');
    }
    console.error('Error adding apple id:', error);
    throw error;
  }

  return data;
}

/**
 * Update an Apple ID's label
 */
export async function updateAppleIdLabel(
  appleIdId: string,
  label: string
): Promise<UserAppleId> {
  const { data, error } = await supabase
    .from('user_apple_ids')
    .update({ label: label.trim() || null })
    .eq('id', appleIdId)
    .select()
    .single();

  if (error) {
    console.error('Error updating apple id label:', error);
    throw error;
  }

  return data;
}

/**
 * Set an Apple ID as primary (unsets previous primary)
 */
export async function setPrimaryAppleId(
  userId: string,
  appleIdId: string
): Promise<void> {
  // First, unset all as primary for this user
  const { error: unsetError } = await supabase
    .from('user_apple_ids')
    .update({ is_primary: false })
    .eq('user_id', userId);

  if (unsetError) {
    console.error('Error unsetting primary apple ids:', unsetError);
    throw unsetError;
  }

  // Then set the specified one as primary
  const { error: setError } = await supabase
    .from('user_apple_ids')
    .update({ is_primary: true })
    .eq('id', appleIdId);

  if (setError) {
    console.error('Error setting primary apple id:', setError);
    throw setError;
  }
}

/**
 * Soft delete an Apple ID
 */
export async function deleteAppleId(appleIdId: string): Promise<void> {
  const { error } = await supabase
    .from('user_apple_ids')
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', appleIdId);

  if (error) {
    console.error('Error deleting apple id:', error);
    throw error;
  }
}

/**
 * Check if an Apple ID is already taken (globally)
 */
export async function isAppleIdTaken(appleId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_apple_ids')
    .select('id')
    .eq('apple_id', appleId.trim().toLowerCase())
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1);

  if (error) {
    console.error('Error checking apple id:', error);
    throw error;
  }

  return (data?.length ?? 0) > 0;
}
