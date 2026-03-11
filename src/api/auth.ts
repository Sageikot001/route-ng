import { supabase } from './supabase';
import type { SignUpData, SignInData, User, ManagerProfile, IOSUserProfile, UserRole } from '../types';

// Sign up a new user
export async function signUp(data: SignUpData) {
  const { email, password, username, role } = data;

  // Use the current origin for redirect, or production URL
  const redirectUrl = window.location.origin + '/login';

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, role },
      emailRedirectTo: redirectUrl,
    },
  });

  if (authError) throw authError;

  // If we have a session (no email confirmation), create user record immediately
  if (authData.session && authData.user) {
    await createUserRecord(authData.user.id, email, username, role);
  }

  return {
    user: authData.user,
    session: authData.session,
    needsEmailConfirmation: Boolean(authData.user && !authData.session),
  };
}

// Create user record in users table
async function createUserRecord(userId: string, email: string, username: string, role: UserRole): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .insert({ id: userId, email, username, role })
    .select()
    .single();

  if (error) {
    // Might already exist from trigger, try to fetch it
    console.log('Insert failed, trying to fetch existing:', error.message);
    return getUserProfile(userId);
  }
  return data;
}

// Sign in
export async function signIn(data: SignInData) {
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });
  if (error) throw error;
  return authData;
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Get user profile - returns null if not found
export async function getUserProfile(userId: string, accessToken?: string): Promise<User | null> {
  try {
    console.log('getUserProfile: querying for userId:', userId);
    const data = await directFetch<User>('users', `id=eq.${userId}`, accessToken);
    console.log('getUserProfile: success, data:', data);
    return data;
  } catch (err) {
    console.error('getUserProfile caught exception:', err);
    return null;
  }
}

// Helper for direct fetch queries - avoids Supabase client entirely
async function directFetch<T>(table: string, query: string, accessToken?: string): Promise<T | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const token = accessToken || supabaseKey;

  console.log(`directFetch: ${table} with query ${query}`);

  const response = await fetch(
    `${supabaseUrl}/rest/v1/${table}?select=*&${query}`,
    {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    }
  );

  console.log(`directFetch ${table}: status`, response.status);

  if (!response.ok) {
    console.error(`directFetch ${table}: failed with status:`, response.status);
    return null;
  }

  const data = await response.json();
  console.log(`directFetch ${table}: got data`, data);
  return data?.[0] || null;
}

// Get manager profile - returns null if not found
export async function getManagerProfile(userId: string, accessToken?: string): Promise<ManagerProfile | null> {
  try {
    console.log('getManagerProfile: querying for userId:', userId);
    const data = await directFetch<ManagerProfile>('manager_profiles', `user_id=eq.${userId}`, accessToken);
    console.log('getManagerProfile: success, data:', data);
    return data;
  } catch (err) {
    console.error('getManagerProfile caught exception:', err);
    return null;
  }
}

// Get iOS user profile - returns null if not found
export async function getIOSUserProfile(userId: string, accessToken?: string): Promise<IOSUserProfile | null> {
  try {
    console.log('getIOSUserProfile: querying for userId:', userId);
    const data = await directFetch<IOSUserProfile>('ios_user_profiles', `user_id=eq.${userId}`, accessToken);
    console.log('getIOSUserProfile: success, data:', data);
    return data;
  } catch (err) {
    console.error('getIOSUserProfile caught exception:', err);
    return null;
  }
}

// Ensure user profile exists - create if missing
export async function ensureUserProfile(
  userId: string,
  email: string,
  username: string,
  role: UserRole,
  accessToken?: string
): Promise<User | null> {
  try {
    console.log('ensureUserProfile: checking for existing profile...');
    // First check if exists
    let profile = await getUserProfile(userId, accessToken);
    if (profile) {
      console.log('ensureUserProfile: profile exists, returning');
      return profile;
    }

    console.log('ensureUserProfile: creating new profile...');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const token = accessToken || supabaseKey;

    const response = await fetch(`${supabaseUrl}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ id: userId, email, username, role }),
    });

    if (!response.ok) {
      console.error('ensureUserProfile insert failed:', response.status);
      // Try fetch again in case of race condition
      return getUserProfile(userId, accessToken);
    }

    const data = await response.json();
    console.log('ensureUserProfile: created successfully:', data);
    return data?.[0] || null;
  } catch (err) {
    console.error('ensureUserProfile caught exception:', err);
    return null;
  }
}

// Create manager profile
export async function createManagerProfile(
  userId: string,
  fullName: string,
  teamName: string
): Promise<ManagerProfile> {
  const { data, error } = await supabase
    .from('manager_profiles')
    .insert({ user_id: userId, full_name: fullName, team_name: teamName })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Create iOS user profile with banks
export async function createIOSUserProfile(
  userId: string,
  fullName: string,
  appleId: string,
  managerId: string,
  banks: { bank_name: string; account_number: string; account_name: string }[]
): Promise<IOSUserProfile> {
  const { data: profile, error: profileError } = await supabase
    .from('ios_user_profiles')
    .insert({ user_id: userId, full_name: fullName, apple_id: appleId, manager_id: managerId })
    .select()
    .single();

  if (profileError) throw profileError;

  if (banks.length > 0) {
    const banksWithProfile = banks.map((bank, index) => ({
      ...bank,
      ios_user_id: profile.id,
      is_primary: index === 0,
    }));

    const { error: banksError } = await supabase.from('banks').insert(banksWithProfile);
    if (banksError) console.error('Error creating banks:', banksError);
  }

  return profile;
}

// Get verified managers
export async function getVerifiedManagers(): Promise<ManagerProfile[]> {
  const { data, error } = await supabase
    .from('manager_profiles')
    .select('*')
    .eq('status', 'verified')
    .order('full_name');

  if (error) {
    console.error('getVerifiedManagers error:', error);
    return [];
  }
  return data || [];
}

// Get manager by referral code
export async function getManagerByReferralCode(referralCode: string): Promise<ManagerProfile | null> {
  try {
    const { data, error } = await supabase
      .from('manager_profiles')
      .select('*')
      .eq('referral_code', referralCode.toUpperCase())
      .eq('status', 'verified')
      .maybeSingle();

    if (error) {
      console.error('getManagerByReferralCode error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('getManagerByReferralCode exception:', err);
    return null;
  }
}

// Validate invite code
export async function validateInviteCode(code: string) {
  const { data, error } = await supabase
    .from('invites')
    .select('*, manager:manager_profiles(*)')
    .eq('invite_code', code)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error('validateInviteCode error:', error);
    return null;
  }
  return data;
}

// Accept invite
export async function acceptInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('invites')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', inviteId);

  if (error) throw error;
}
