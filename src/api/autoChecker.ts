import { supabase } from './supabase';
import type {
  EmailCheckerConfig,
  RawEmail,
  ParsedGiftCard,
  ParsedGiftCardWithUser,
  EmailScanLog,
  AutoCheckerStats,
  DailyGiftCardSummary,
  UserGiftCardDetail,
} from '../types';

// ============================================
// EMAIL CHECKER CONFIG
// ============================================

export async function getEmailCheckerConfig(): Promise<EmailCheckerConfig | null> {
  const { data, error } = await supabase
    .from('email_checker_config')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveEmailCheckerConfig(config: {
  gmail_email: string;
  oauth_refresh_token: string;
  oauth_access_token: string;
  token_expires_at: string;
}): Promise<EmailCheckerConfig> {
  // First, deactivate any existing config
  await supabase
    .from('email_checker_config')
    .update({ is_active: false })
    .eq('is_active', true);

  // Insert new config
  const { data, error } = await supabase
    .from('email_checker_config')
    .insert({
      ...config,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEmailCheckerConfig(
  id: string,
  updates: Partial<Pick<EmailCheckerConfig, 'oauth_access_token' | 'token_expires_at' | 'last_scan_at' | 'scan_interval_minutes' | 'scan_from_date' | 'scan_to_date'>>
): Promise<EmailCheckerConfig> {
  const { data, error } = await supabase
    .from('email_checker_config')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function disconnectEmailChecker(): Promise<void> {
  const { error } = await supabase
    .from('email_checker_config')
    .update({ is_active: false })
    .eq('is_active', true);

  if (error) throw error;
}

// ============================================
// RAW EMAILS
// ============================================

export async function getRawEmails(options?: {
  processed?: boolean;
  limit?: number;
  offset?: number;
}): Promise<RawEmail[]> {
  let query = supabase
    .from('raw_emails')
    .select('*')
    .order('received_at', { ascending: false });

  if (options?.processed !== undefined) {
    query = query.eq('processed', options.processed);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getRawEmailById(id: string): Promise<RawEmail | null> {
  const { data, error } = await supabase
    .from('raw_emails')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ============================================
// PARSED GIFT CARDS
// ============================================

export async function getParsedGiftCards(options?: {
  date?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}): Promise<ParsedGiftCardWithUser[]> {
  let query = supabase
    .from('parsed_gift_cards')
    .select(`
      *,
      matched_user:ios_user_profiles(*),
      raw_email:raw_emails(id, subject, from_email)
    `)
    .order('received_at', { ascending: false });

  if (options?.date) {
    const startOfDay = `${options.date}T00:00:00.000Z`;
    const endOfDay = `${options.date}T23:59:59.999Z`;
    query = query.gte('received_at', startOfDay).lte('received_at', endOfDay);
  }
  if (options?.userId) {
    query = query.eq('matched_user_id', options.userId);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ParsedGiftCardWithUser[];
}

export async function getGiftCardsByUser(userId: string): Promise<ParsedGiftCard[]> {
  const { data, error } = await supabase
    .from('parsed_gift_cards')
    .select('*')
    .eq('matched_user_id', userId)
    .order('received_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getUnmatchedGiftCards(): Promise<ParsedGiftCardWithUser[]> {
  const { data, error } = await supabase
    .from('parsed_gift_cards')
    .select(`
      *,
      raw_email:raw_emails(id, subject, from_email)
    `)
    .is('matched_user_id', null)
    .order('received_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ParsedGiftCardWithUser[];
}

export async function matchGiftCardToUser(cardId: string, userId: string): Promise<ParsedGiftCard> {
  const { data, error } = await supabase
    .from('parsed_gift_cards')
    .update({ matched_user_id: userId })
    .eq('id', cardId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// SCAN LOGS
// ============================================

export async function getScanLogs(limit = 20): Promise<EmailScanLog[]> {
  const { data, error } = await supabase
    .from('email_scan_logs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getLatestScanLog(): Promise<EmailScanLog | null> {
  const { data, error } = await supabase
    .from('email_scan_logs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ============================================
// STATISTICS
// ============================================

export async function getAutoCheckerStats(): Promise<AutoCheckerStats> {
  const config = await getEmailCheckerConfig();

  // Get total processed emails
  const { count: totalEmails } = await supabase
    .from('raw_emails')
    .select('*', { count: 'exact', head: true })
    .eq('processed', true);

  // Get total cards found
  const { count: totalCards } = await supabase
    .from('parsed_gift_cards')
    .select('*', { count: 'exact', head: true });

  // Get today's stats
  const today = new Date().toISOString().split('T')[0];
  const startOfDay = `${today}T00:00:00.000Z`;
  const endOfDay = `${today}T23:59:59.999Z`;

  const { data: todayCards } = await supabase
    .from('parsed_gift_cards')
    .select('amount')
    .gte('received_at', startOfDay)
    .lte('received_at', endOfDay);

  const todayCardsCount = todayCards?.length || 0;
  const todayTotalAmount = todayCards?.reduce((sum, card) => sum + (card.amount || 0), 0) || 0;

  return {
    totalEmailsProcessed: totalEmails || 0,
    totalCardsFound: totalCards || 0,
    todayCardsCount,
    todayTotalAmount,
    lastScanAt: config?.last_scan_at,
    isConnected: !!config && config.is_active,
  };
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

export async function getDailySummaryData(date?: string): Promise<DailyGiftCardSummary[]> {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const startOfDay = `${targetDate}T00:00:00.000Z`;
  const endOfDay = `${targetDate}T23:59:59.999Z`;

  const { data, error } = await supabase
    .from('parsed_gift_cards')
    .select(`
      amount,
      matched_user_id,
      sender_email,
      matched_user:ios_user_profiles(id, full_name, user_id, users:users(email))
    `)
    .gte('received_at', startOfDay)
    .lte('received_at', endOfDay);

  if (error) throw error;

  // Group by user
  const userMap = new Map<string, DailyGiftCardSummary>();

  for (const card of data || []) {
    const key = card.matched_user_id || card.sender_email;
    const existing = userMap.get(key);

    const user = card.matched_user as any;
    const userName = user?.full_name || 'Unknown';
    const userEmail = user?.users?.email || card.sender_email;

    if (existing) {
      existing.cardsCount += 1;
      existing.totalAmount += card.amount || 0;
    } else {
      userMap.set(key, {
        date: targetDate,
        userName,
        userEmail,
        cardsCount: 1,
        totalAmount: card.amount || 0,
      });
    }
  }

  return Array.from(userMap.values());
}

export async function getUserGiftCardDetails(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<UserGiftCardDetail[]> {
  let query = supabase
    .from('parsed_gift_cards')
    .select(`
      *,
      raw_email:raw_emails(subject)
    `)
    .eq('matched_user_id', userId)
    .order('received_at', { ascending: false });

  if (startDate) {
    query = query.gte('received_at', `${startDate}T00:00:00.000Z`);
  }
  if (endDate) {
    query = query.lte('received_at', `${endDate}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((card: any) => {
    const receivedDate = new Date(card.received_at);
    return {
      date: receivedDate.toISOString().split('T')[0],
      time: receivedDate.toTimeString().split(' ')[0],
      redemptionCode: card.redemption_code,
      amount: card.amount,
      emailSubject: card.raw_email?.subject,
    };
  });
}

// ============================================
// MANUAL SCAN TRIGGER
// ============================================

export async function triggerManualScan(options?: {
  fromDate?: string;  // Format: YYYY-MM-DD
  toDate?: string;    // Format: YYYY-MM-DD
}): Promise<{ success: boolean; scanLogId?: string; emailsFetched?: number; cardsFound?: number; error?: string }> {
  // Check if config exists
  const config = await getEmailCheckerConfig();
  if (!config) {
    return { success: false, error: 'Gmail not connected. Please connect Gmail first.' };
  }

  // Call the edge function
  const { data, error } = await supabase.functions.invoke('scan-emails', {
    body: {
      triggered_by: 'manual',
      from_date: options?.fromDate,
      to_date: options?.toDate,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    scanLogId: data?.scanLogId,
    emailsFetched: data?.emailsFetched,
    cardsFound: data?.cardsFound,
  };
}

// ============================================
// USER COUNT BY DATE
// ============================================

export async function getGiftCardCountByUserAndDate(
  userId: string,
  date: string
): Promise<number> {
  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;

  const { count, error } = await supabase
    .from('parsed_gift_cards')
    .select('*', { count: 'exact', head: true })
    .eq('matched_user_id', userId)
    .gte('received_at', startOfDay)
    .lte('received_at', endOfDay);

  if (error) throw error;
  return count || 0;
}
