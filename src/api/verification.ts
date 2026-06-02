import { supabase } from './supabase';
import type { IOSUserProfile, VerificationStatus, IDType } from '../types';

// Upload profile image
export async function uploadProfileImage(
  userId: string,
  file: File
): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${userId}/profile.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('profile-images')
    .upload(fileName, file, { upsert: true });

  if (uploadError) {
    console.error('Profile image upload error:', uploadError);
    throw new Error(uploadError.message || 'Failed to upload profile image');
  }

  const { data: { publicUrl } } = supabase.storage
    .from('profile-images')
    .getPublicUrl(fileName);

  // Update profile with image URL
  const { error: updateError } = await supabase
    .from('ios_user_profiles')
    .update({ profile_image_url: publicUrl })
    .eq('user_id', userId);

  if (updateError) {
    console.error('Profile update error:', updateError);
    throw new Error('Failed to update profile with image');
  }

  return publicUrl;
}

// Upload ID document image
export async function uploadIDDocument(
  userId: string,
  file: File
): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${userId}/id-document-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('id-documents')
    .upload(fileName, file, { upsert: true });

  if (uploadError) {
    console.error('ID document upload error:', uploadError);
    throw new Error(uploadError.message || 'Failed to upload ID document');
  }

  // For private bucket, we need to create a signed URL or store the path
  const { data: { publicUrl } } = supabase.storage
    .from('id-documents')
    .getPublicUrl(fileName);

  return publicUrl;
}

// Submit verification request
export async function submitVerification(
  profileId: string,
  data: {
    bvn: string;
    id_type: IDType;
    id_number: string;
    id_image_url: string;
  }
): Promise<IOSUserProfile> {
  // Validate BVN format (11 digits)
  if (!/^\d{11}$/.test(data.bvn)) {
    throw new Error('BVN must be exactly 11 digits');
  }

  const { data: profile, error } = await supabase
    .from('ios_user_profiles')
    .update({
      bvn: data.bvn,
      id_type: data.id_type,
      id_number: data.id_number,
      id_image_url: data.id_image_url,
      verification_status: 'pending',
      verification_submitted_at: new Date().toISOString(),
      verification_rejection_reason: null, // Clear any previous rejection
    })
    .eq('id', profileId)
    .select()
    .single();

  if (error) {
    console.error('Verification submission error:', error);
    throw new Error(error.message || 'Failed to submit verification');
  }

  return profile;
}

// Get pending verifications (admin)
export async function getPendingVerifications(): Promise<IOSUserProfile[]> {
  const { data, error } = await supabase
    .from('ios_user_profiles')
    .select('*')
    .eq('verification_status', 'pending')
    .order('verification_submitted_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Approve verification (admin)
export async function approveVerification(
  profileId: string,
  adminId: string
): Promise<IOSUserProfile> {
  const { data, error } = await supabase
    .from('ios_user_profiles')
    .update({
      verification_status: 'verified',
      verification_reviewed_at: new Date().toISOString(),
      verification_reviewed_by: adminId,
    })
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Reject verification (admin)
export async function rejectVerification(
  profileId: string,
  adminId: string,
  reason: string
): Promise<IOSUserProfile> {
  const { data, error } = await supabase
    .from('ios_user_profiles')
    .update({
      verification_status: 'rejected',
      verification_reviewed_at: new Date().toISOString(),
      verification_reviewed_by: adminId,
      verification_rejection_reason: reason,
    })
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get verification stats (admin)
export async function getVerificationStats(): Promise<{
  pending: number;
  verified: number;
  rejected: number;
  unverified: number;
}> {
  const { data, error } = await supabase
    .from('ios_user_profiles')
    .select('verification_status');

  if (error) throw error;

  const stats = {
    pending: 0,
    verified: 0,
    rejected: 0,
    unverified: 0,
  };

  (data || []).forEach((profile) => {
    const status = profile.verification_status as VerificationStatus;
    if (status in stats) {
      stats[status]++;
    }
  });

  return stats;
}

// Get signed URL for ID document (admin only)
export async function getIDDocumentUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('id-documents')
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (error) throw error;
  return data.signedUrl;
}
