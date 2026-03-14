// ============================================
// ENUMS
// ============================================

export type UserRole = 'admin' | 'manager' | 'ios_user';
export type ManagerStatus = 'pending' | 'verified' | 'suspended';
export type TransactionStatus = 'pending_manager' | 'pending_admin' | 'verified' | 'rejected';
export type InviteStatus = 'pending' | 'accepted' | 'expired';
export type CompensationType = 'daily_target' | 'team_commission';
export type PayoutStatus = 'pending' | 'paid';
export type RecipientType = 'ios_user' | 'manager';

// ============================================
// CORE ENTITIES
// ============================================

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  phone_number?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ManagerProfile {
  id: string;
  user_id: string;
  full_name: string;
  team_name: string;
  status: ManagerStatus;
  commission_rate: number;
  referral_code: string;
  is_house_account: boolean;
  verified_at?: string;
  verified_by?: string;
  created_at: string;
  updated_at: string;
}

export interface IOSUserProfile {
  id: string;
  user_id: string;
  full_name: string;
  apple_id: string;
  manager_id: string;
  daily_transaction_target: number;
  is_funded: boolean;
  funding_amount: number;
  is_available: boolean;
  available_until?: string;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Bank {
  id: string;
  ios_user_id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_primary: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemBank {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAppleId {
  id: string;
  user_id: string;
  apple_id: string;
  label?: string;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  deleted_at?: string;
}

export interface Transaction {
  id: string;
  ios_user_id: string;
  manager_id: string;
  bank_id?: string;
  apple_id_id?: string;  // Reference to user_apple_ids table
  card_amount: number;
  card_count: number;  // Number of gift cards in this transaction
  receipt_count: number;
  gift_card_amount: number;
  recipient_address?: string;
  shortfall_reason?: string;
  proof_image_url?: string;
  status: TransactionStatus;
  rejection_reason?: string;
  reviewed_by_manager?: string;
  manager_reviewed_at?: string;
  reviewed_by_admin?: string;
  admin_reviewed_at?: string;
  transaction_date: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithDetails extends Transaction {
  ios_user?: IOSUserProfile;
  bank?: Bank;
  apple_id?: UserAppleId;
}

export interface DailyTransactionSummary {
  id: string;
  ios_user_id: string;
  manager_id: string;
  date: string;
  completed_transactions: number;
  total_amount: number;
  earned_amount: number;
  created_at: string;
  updated_at: string;
}

export interface Compensation {
  id: string;
  recipient_id: string;
  recipient_type: RecipientType;
  amount: number;
  compensation_type: CompensationType;
  reference_date: string;
  status: PayoutStatus;
  paid_at?: string;
  created_at: string;
}

export interface CompensationSettings {
  id: number;
  ios_user_daily_target: number;
  ios_user_daily_amount: number;
  manager_commission_rate: number;
  updated_at: string;
  updated_by?: string;
}

export interface Invite {
  id: string;
  manager_id: string;
  email: string;
  invite_code: string;
  status: InviteStatus;
  email_sent_at?: string;
  accepted_at?: string;
  expires_at: string;
  created_at: string;
}

// ============================================
// EXTENDED TYPES (with relations)
// ============================================

export interface IOSUserProfileWithBanks extends IOSUserProfile {
  banks: Bank[];
}

export interface IOSUserProfileWithManager extends IOSUserProfile {
  manager: ManagerProfile;
}

export interface ManagerProfileWithUser extends ManagerProfile {
  user: User;
}

export interface TransactionWithUser extends Transaction {
  ios_user: IOSUserProfile;
}

export interface InviteWithManager extends Invite {
  manager: ManagerProfile;
}

// ============================================
// AUTH TYPES
// ============================================

export interface SignUpData {
  email: string;
  password: string;
  username: string;
  role: UserRole;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  profile: ManagerProfile | IOSUserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ============================================
// FORM TYPES
// ============================================

export interface IOSUserRegistrationForm {
  full_name: string;
  apple_id: string;
  manager_id: string;
  banks: {
    bank_name: string;
    account_number: string;
    account_name: string;
  }[];
}

export interface ManagerRegistrationForm {
  full_name: string;
  team_name: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// ============================================
// DASHBOARD STATS
// ============================================

export interface IOSUserStats {
  todayTransactions: number;
  todayTarget: number;
  totalEarnings: number;
  pendingPayout: number;
}

export interface ManagerStats {
  teamSize: number;
  pendingReviews: number;
  todayTeamTransactions: number;
  totalCommission: number;
}

export interface AdminStats {
  totalUsers: number;
  totalManagers: number;
  pendingManagerVerifications: number;
  pendingAdminReviews: number;
  todayTotalTransactions: number;
}

// ============================================
// AUTO-CHECKER TYPES
// ============================================

export type ScanTriggerType = 'manual' | 'scheduled';

export interface EmailCheckerConfig {
  id: string;
  gmail_email: string;
  oauth_refresh_token?: string;
  oauth_access_token?: string;
  token_expires_at?: string;
  is_active: boolean;
  last_scan_at?: string;
  scan_interval_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface RawEmail {
  id: string;
  message_id: string;
  from_email: string;
  subject?: string;
  body_text?: string;
  body_html?: string;
  received_at: string;
  processed: boolean;
  processing_error?: string;
  created_at: string;
}

export interface ParsedGiftCard {
  id: string;
  raw_email_id?: string;
  sender_email: string;
  redemption_code?: string;
  amount?: number;
  currency: string;
  card_index: number;
  matched_user_id?: string;
  received_at: string;
  created_at: string;
}

export interface ParsedGiftCardWithUser extends ParsedGiftCard {
  matched_user?: IOSUserProfile;
  raw_email?: RawEmail;
}

export interface EmailScanLog {
  id: string;
  started_at: string;
  completed_at?: string;
  emails_fetched: number;
  emails_parsed: number;
  cards_found: number;
  errors?: string[];
  triggered_by: ScanTriggerType;
}

export interface AutoCheckerStats {
  totalEmailsProcessed: number;
  totalCardsFound: number;
  todayCardsCount: number;
  todayTotalAmount: number;
  lastScanAt?: string;
  isConnected: boolean;
}

export interface DailyGiftCardSummary {
  date: string;
  userName: string;
  userEmail: string;
  cardsCount: number;
  totalAmount: number;
}

export interface UserGiftCardDetail {
  date: string;
  time: string;
  redemptionCode?: string;
  amount?: number;
  emailSubject?: string;
}

// ============================================
// RESOURCE CENTER TYPES
// ============================================

export type ResourceType = 'video' | 'image' | 'text';
export type ResourceAudience = 'managers' | 'partners' | 'all';

export interface Resource {
  id: string;
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
  sort_order: number;
  is_published: boolean;
  is_featured: boolean;
  view_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ResourceView {
  id: string;
  resource_id: string;
  user_id?: string;
  viewed_at: string;
}

// ============================================
// TRANSACTION OPPORTUNITIES TYPES
// ============================================

export interface TransactionOpportunity {
  id: string;
  title: string;
  recipient_email: string;
  amount: number;
  min_transactions_per_day: number;
  max_transactions_per_day: number;
  total_slots?: number;
  filled_slots: number;
  is_active: boolean;
  expires_at?: string;
  instructions?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface UserAvailability {
  id: string;
  user_id: string;
  opportunity_id: string;
  is_available: boolean;
  available_from: string;
  available_until?: string;
  committed_apple_ids?: string[];
  expected_transactions?: number;
  created_at: string;
  updated_at: string;
}

export interface UserAvailabilityWithDetails extends UserAvailability {
  opportunity?: TransactionOpportunity;
  user?: IOSUserProfile;
}
