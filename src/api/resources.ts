import { supabase } from './supabase';
import type { Resource, ResourceType, ResourceAudience } from '../types';

// ============================================
// ADMIN FUNCTIONS
// ============================================

export async function createResource(data: {
  title: string;
  description?: string;
  resource_type: ResourceType;
  target_audience: ResourceAudience;
  content_text?: string;
  file_url?: string;
  external_url?: string;
  thumbnail_url?: string;
  file_size?: number;
  duration?: number;
  category?: string;
  is_published?: boolean;
  is_featured?: boolean;
  created_by: string;
}): Promise<Resource> {
  const { data: resource, error } = await supabase
    .from('resources')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return resource;
}

export async function updateResource(
  id: string,
  data: Partial<Omit<Resource, 'id' | 'created_at' | 'updated_at'>>
): Promise<Resource> {
  const { data: resource, error } = await supabase
    .from('resources')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return resource;
}

export async function deleteResource(id: string): Promise<void> {
  const { error } = await supabase
    .from('resources')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getAllResources(options?: {
  audience?: ResourceAudience;
  type?: ResourceType;
  category?: string;
  publishedOnly?: boolean;
}): Promise<Resource[]> {
  let query = supabase
    .from('resources')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (options?.audience) {
    query = query.eq('target_audience', options.audience);
  }
  if (options?.type) {
    query = query.eq('resource_type', options.type);
  }
  if (options?.category) {
    query = query.eq('category', options.category);
  }
  if (options?.publishedOnly) {
    query = query.eq('is_published', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getResourceById(id: string): Promise<Resource | null> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ============================================
// USER/MANAGER FUNCTIONS
// ============================================

export async function getResourcesForUser(audience: 'managers' | 'partners'): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('is_published', true)
    .in('target_audience', [audience, 'all'])
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getFeaturedResources(audience: 'managers' | 'partners'): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('is_published', true)
    .eq('is_featured', true)
    .in('target_audience', [audience, 'all'])
    .order('sort_order', { ascending: true })
    .limit(5);

  if (error) throw error;
  return data || [];
}

export async function getResourcesByCategory(
  audience: 'managers' | 'partners',
  category: string
): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('is_published', true)
    .eq('category', category)
    .in('target_audience', [audience, 'all'])
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getCategories(audience: 'managers' | 'partners'): Promise<string[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('category')
    .eq('is_published', true)
    .in('target_audience', [audience, 'all'])
    .not('category', 'is', null);

  if (error) throw error;

  // Get unique categories
  const categories = [...new Set(data?.map(r => r.category).filter(Boolean))];
  return categories as string[];
}

// ============================================
// PUBLIC FUNCTIONS (No auth required)
// ============================================

export async function getLatestFeaturedVideo(): Promise<Resource | null> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('is_published', true)
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching featured video:', error);
    return null;
  }

  // Only return if it has a video URL (file_url or external_url)
  if (data && (data.file_url || data.external_url)) {
    return data;
  }

  return null;
}

// ============================================
// VIEW TRACKING
// ============================================

export async function recordResourceView(resourceId: string, userId: string): Promise<void> {
  // Record the view
  await supabase
    .from('resource_views')
    .insert({ resource_id: resourceId, user_id: userId });

  // Increment view count
  await supabase.rpc('increment_resource_view_count', { resource_id: resourceId });
}

// ============================================
// FILE UPLOAD
// ============================================

export async function uploadResourceFile(
  file: File,
  resourceType: ResourceType
): Promise<{ url: string; size: number }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${resourceType}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('resources')
    .upload(fileName, file);

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('resources')
    .getPublicUrl(data.path);

  return {
    url: publicUrl,
    size: file.size,
  };
}

export async function deleteResourceFile(fileUrl: string): Promise<void> {
  // Extract path from URL
  const urlParts = fileUrl.split('/resources/');
  if (urlParts.length < 2) return;

  const filePath = urlParts[1];
  await supabase.storage
    .from('resources')
    .remove([filePath]);
}
