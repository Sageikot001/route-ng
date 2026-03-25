# Route.ng Feature Epic Plan

## Overview

Transform Route.ng to support both managed (referred) and independent users, enable multi-device support via multiple Apple IDs, and build an automated receipt verification system.

---

## Epic 1: House Account + Optional Referral System

**Goal:** Allow users to register without a referral code, assigning them to a default "Route.ng Direct" manager with conditional UI.

| # | Task | Description | Priority | Estimate | Dependencies |
|---|------|-------------|----------|----------|--------------|
| 1.1 | Create House Account Manager | Add migration to create default "Route.ng Direct" manager with `is_house_account: true` flag | High | 1hr | None |
| 1.2 | Update `manager_profiles` Schema | Add `is_house_account` boolean column (default false) | High | 30min | None |
| 1.3 | Make Referral Code Optional | Update registration flow - referral input is optional, not required | High | 1hr | 1.1 |
| 1.4 | Auto-Assign to House Account | If no referral code provided, assign user to House Account manager | High | 1hr | 1.1, 1.3 |
| 1.5 | Add `is_house_member` Helper | Create utility/hook to check if user belongs to House Account | Medium | 30min | 1.2 |
| 1.6 | iOS User Dashboard - Conditional UI | Hide funding-related UI elements for House Account members | High | 2hr | 1.5 |
| 1.7 | iOS User Overview - Conditional Copy | Adjust text/messaging for independent users (no "your manager" references) | Medium | 1hr | 1.5 |
| 1.8 | Manager Dashboard - House Account View | Admin can view House Account team separately | Medium | 2hr | 1.1, 1.2 |
| 1.9 | Update Landing Page Copy | Clarify both paths: "Have a referral? Enter it. Don't have one? Join directly." | Medium | 1hr | 1.3 |
| 1.10 | Testing & QA | Test both registration paths, UI conditions, edge cases | High | 2hr | All above |

**Epic 1 Total Estimate:** ~12 hours

---

## Epic 2: Multiple Apple IDs Support

**Goal:** Allow users to manage multiple Apple IDs (devices) and select which one when logging transactions.

| # | Task | Description | Priority | Estimate | Dependencies |
|---|------|-------------|----------|----------|--------------|
| 2.1 | Create `user_apple_ids` Table | New table: id, user_id, apple_id, label, is_primary, is_active, created_at, deleted_at | High | 1hr | None |
| 2.2 | Migrate Existing Apple IDs | Move existing `apple_id` from `ios_user_profiles` to new table | High | 1hr | 2.1 |
| 2.3 | Update Types & API | Add TypeScript types, CRUD functions for user_apple_ids | High | 1hr | 2.1 |
| 2.4 | Profile - Apple ID Management UI | List, add, edit label, set primary, soft-delete Apple IDs | High | 3hr | 2.3 |
| 2.5 | Add Apple ID Modal | Form to add new Apple ID with label (e.g., "iPhone 15 Pro") | High | 1hr | 2.4 |
| 2.6 | Soft Delete Apple ID | Mark as inactive instead of hard delete, show confirmation | Medium | 1hr | 2.4 |
| 2.7 | Update Transaction Schema | Add `apple_id_id` FK to transactions table | High | 30min | 2.1 |
| 2.8 | Transaction Log - Apple ID Dropdown | When logging, user selects which Apple ID from dropdown | High | 2hr | 2.3, 2.7 |
| 2.9 | Transaction History - Show Apple ID | Display which Apple ID was used for each transaction | Medium | 1hr | 2.7 |
| 2.10 | Link Banks to Apple IDs (Optional) | Allow associating specific bank cards with specific Apple IDs | Low | 2hr | 2.1 |
| 2.11 | Validation - Unique Apple IDs | Ensure same Apple ID can't be added twice (globally or per user) | Medium | 1hr | 2.3 |
| 2.12 | Testing & QA | Test add/remove Apple IDs, transaction logging, edge cases | High | 2hr | All above |

**Epic 2 Total Estimate:** ~16.5 hours

---

## Epic 3: Auto-Checker Receipt Verification System

**Goal:** Automatically verify transactions by parsing Apple receipt emails sent to company email(s).

### Phase 3A: Email Integration

| # | Task | Description | Priority | Estimate | Dependencies |
|---|------|-------------|----------|----------|--------------|
| 3A.1 | Choose Email Provider/API | Decide: Gmail API, Microsoft Graph, or IMAP | High | 2hr | None |
| 3A.2 | Set Up Email Credentials | OAuth setup or app passwords for email access | High | 2hr | 3A.1 |
| 3A.3 | Create Email Fetching Service | Backend service to poll/webhook for new emails | High | 4hr | 3A.2 |
| 3A.4 | Filter Apple Receipt Emails | Identify emails from Apple (sender, subject patterns) | High | 2hr | 3A.3 |
| 3A.5 | Store Raw Emails | Save email metadata and content to DB for processing | Medium | 2hr | 3A.4 |

### Phase 3B: Receipt Parsing

| # | Task | Description | Priority | Estimate | Dependencies |
|---|------|-------------|----------|----------|--------------|
| 3B.1 | Analyze Apple Receipt Format | Document email structure, identify key data points | High | 2hr | 3A.4 |
| 3B.2 | Build Receipt Parser | Extract: recipient email, amount, date/time, gift card type | High | 4hr | 3B.1 |
| 3B.3 | Create `parsed_receipts` Table | Store extracted data: apple_id_email, amount, timestamp, raw_email_id | High | 1hr | 3B.2 |
| 3B.4 | Handle Parser Errors | Log unparseable emails for manual review | Medium | 1hr | 3B.2 |
| 3B.5 | Receipt Deduplication | Prevent same receipt from being processed twice | High | 1hr | 3B.3 |

### Phase 3C: Auto-Matching & Verification

| # | Task | Description | Priority | Estimate | Dependencies |
|---|------|-------------|----------|----------|--------------|
| 3C.1 | Match Receipts to Apple IDs | Link parsed receipts to user_apple_ids by email | High | 2hr | 3B.3, Epic 2 |
| 3C.2 | Match Receipts to Transactions | Find pending transactions matching amount/date/apple_id | High | 3hr | 3C.1 |
| 3C.3 | Auto-Verify Matched Transactions | Update transaction status when receipt matches | High | 2hr | 3C.2 |
| 3C.4 | Confidence Scoring | Score match quality (exact vs fuzzy time match) | Medium | 2hr | 3C.2 |
| 3C.5 | Handle Unmatched Receipts | Queue for manual review if no transaction match | Medium | 1hr | 3C.2 |
| 3C.6 | Handle Unmatched Transactions | Flag transactions with no receipt after X hours | Medium | 1hr | 3C.2 |

### Phase 3D: Admin & Reporting

| # | Task | Description | Priority | Estimate | Dependencies |
|---|------|-------------|----------|----------|--------------|
| 3D.1 | Auto-Checker Dashboard | View incoming receipts, match status, errors | High | 4hr | 3C.3 |
| 3D.2 | Manual Match Override | Admin can manually link receipt to transaction | Medium | 2hr | 3D.1 |
| 3D.3 | Receipt Analytics | Stats: receipts/day, match rate, avg verification time | Medium | 2hr | 3C.3 |
| 3D.4 | User Verification History | Show users which transactions were auto vs manual verified | Low | 1hr | 3C.3 |
| 3D.5 | Alerts - Suspicious Patterns | Flag unusual activity (many failures, mismatched amounts) | Medium | 2hr | 3C.3 |
| 3D.6 | Testing & QA | End-to-end testing with sample receipts | High | 4hr | All above |

**Epic 3 Total Estimate:** ~46 hours

---

## Epic 4: Funding, Transaction Lifecycle & Payouts

**Goal:** Track user balances, manage transaction states, and handle payouts to users.

### System Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Manager Funds  │────▶│  User Balance    │────▶│   User Payout   │
│  (Top-ups)      │     │  (Available ₦)   │     │   (Withdrawal)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               ▲
                               │
                    ┌──────────────────┐
                    │  Transactions    │
                    │  (Gift Cards)    │
                    │  Adds to balance │
                    └──────────────────┘
```

### Phase 4A: Balance Tracking

| # | Task | Description | Priority | Estimate |
|---|------|-------------|----------|----------|
| 4A.1 | Add `balance` to ios_user_profiles | Track current available balance per user | High | 30min |
| 4A.2 | Create `balance_transactions` table | Ledger of all balance changes (credits/debits) | High | 1hr |
| 4A.3 | Auto-update balance on verified gift card | When Auto-Checker verifies a card, credit user balance | High | 2hr |
| 4A.4 | User Dashboard - Balance Display | Show current balance prominently | High | 1hr |
| 4A.5 | Balance History View | List all balance transactions with reasons | Medium | 2hr |

### Phase 4B: Transaction Lifecycle

| # | Task | Description | Priority | Estimate |
|---|------|-------------|----------|----------|
| 4B.1 | Transaction Status Flow | pending → verified → paid (or rejected) | High | 1hr |
| 4B.2 | Link Auto-Checker to Transactions | When gift card verified, mark transaction as verified | High | 2hr |
| 4B.3 | Transaction Status UI | Show status badges, timeline of state changes | Medium | 2hr |
| 4B.4 | Admin - Bulk Status Updates | Approve/reject multiple transactions at once | Medium | 2hr |

### Phase 4C: Payouts

| # | Task | Description | Priority | Estimate |
|---|------|-------------|----------|----------|
| 4C.1 | Create `payouts` table | id, user_id, amount, bank_id, status, requested_at, processed_at | High | 1hr |
| 4C.2 | User - Request Payout | User can request withdrawal of available balance | High | 2hr |
| 4C.3 | Payout Validation | Check sufficient balance, minimum payout amount | High | 1hr |
| 4C.4 | Admin - Payout Queue | View pending payouts, approve/process/reject | High | 3hr |
| 4C.5 | Payout Processing | Mark as processed, deduct from balance, record transaction | High | 2hr |
| 4C.6 | Payout History | User sees their payout history and status | Medium | 1hr |
| 4C.7 | Manager - Team Payouts View | Manager sees payouts for their team members | Medium | 2hr |

**Epic 4 Total Estimate:** ~25.5 hours

### Questions to Revisit

> **These questions need to be answered before implementation:**

1. **How does funding work?**
   - Does the manager fund users directly (top-up)?
   - Or do users only earn balance from verified gift cards?
   - Or both?

2. **What's the transaction flow?**
   - User logs transaction → Auto-Checker verifies → Balance credited → User requests payout?
   - Or is there a manual approval step?

3. **Payout approval workflow:**
   - Single admin approval?
   - Manager approval then admin processing?
   - Auto-approve under certain thresholds?

4. **Minimum payout amount?**
   - Is there a threshold before users can withdraw?
   - Any maximum limits?

5. **Commission/fees:**
   - Does Route.ng take a percentage?
   - Does the manager take a cut?
   - How is this calculated and deducted?

---

### Database Schema Changes (Epic 4)

```sql
-- Phase 4A: Balance Tracking
ALTER TABLE ios_user_profiles ADD COLUMN balance DECIMAL(12,2) DEFAULT 0;

CREATE TABLE balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ios_user_profiles(id) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,  -- positive = credit, negative = debit
  balance_after DECIMAL(12,2) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,  -- 'gift_card_credit', 'payout_debit', 'adjustment', 'funding'
  reference_id UUID,  -- links to parsed_gift_cards.id, payouts.id, etc.
  reference_type VARCHAR(50),  -- 'gift_card', 'payout', 'manual'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Phase 4C: Payouts
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ios_user_profiles(id) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  bank_id UUID REFERENCES banks(id) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'processing', 'completed', 'rejected'
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  transaction_reference VARCHAR(100),  -- bank transfer reference
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update transactions table for lifecycle
ALTER TABLE transactions ADD COLUMN verification_status VARCHAR(20) DEFAULT 'pending';
-- 'pending', 'verified', 'rejected', 'paid'
ALTER TABLE transactions ADD COLUMN verified_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN verified_by UUID REFERENCES users(id);
ALTER TABLE transactions ADD COLUMN linked_gift_card_id UUID REFERENCES parsed_gift_cards(id);
```

---

## Summary

| Epic | Description | Estimate | Status |
|------|-------------|----------|--------|
| **Epic 1** | House Account + Optional Referral | ~12 hrs | ✅ Complete |
| **Epic 2** | Multiple Apple IDs Support | ~16.5 hrs | ✅ Complete |
| **Epic 3** | Auto-Checker Receipt Verification | ~46 hrs | 🔄 In Progress |
| **Epic 4** | Funding, Transaction Lifecycle & Payouts | ~25.5 hrs | 📋 Planned |
| **Total** | | **~100 hrs** | |

---

## Recommended Implementation Order

```
Epic 1 (House Account)           ✅ Complete
    |
    v
Epic 2 (Multiple Apple IDs)      ✅ Complete
    |
    v
Epic 3A (Email Integration)      ✅ Complete
    |
    v
Epic 3B (Receipt Parsing)        ✅ Complete
    |
    v
Epic 3C (Auto-Matching)          🔄 In Progress
    |
    v
Epic 3D (Admin & Reporting)      🔄 In Progress
    |
    v
Epic 4A (Balance Tracking)       <-- Requires Epic 3 (gift cards credit balance)
    |
    v
Epic 4B (Transaction Lifecycle)
    |
    v
Epic 4C (Payouts)
```

---

## Technical Decisions Needed

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Email API | Gmail API, Microsoft Graph, Generic IMAP | Gmail API if using Google Workspace |
| Auto-Checker Backend | Supabase Edge Functions, Separate Node.js service, Cron job | Edge Functions for MVP, migrate if scale needed |
| Receipt Parsing | Regex, Cheerio HTML parsing, AI extraction | Cheerio for structured HTML, regex fallback |
| Matching Strategy | Exact match only, Fuzzy time window, ML scoring | Fuzzy window (e.g., +/- 30 min) for MVP |

---

## Database Schema Changes Summary

```sql
-- Epic 1
ALTER TABLE manager_profiles ADD COLUMN is_house_account BOOLEAN DEFAULT FALSE;

-- Epic 2
CREATE TABLE user_apple_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  apple_id VARCHAR(255) NOT NULL,
  label VARCHAR(100),
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE transactions ADD COLUMN apple_id_id UUID REFERENCES user_apple_ids(id);

-- Epic 3
CREATE TABLE raw_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(255) UNIQUE,
  sender VARCHAR(255),
  subject TEXT,
  body TEXT,
  received_at TIMESTAMPTZ,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE parsed_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_email_id UUID REFERENCES raw_emails(id),
  recipient_apple_id VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(10),
  transaction_date TIMESTAMPTZ,
  matched_user_apple_id UUID REFERENCES user_apple_ids(id),
  matched_transaction_id UUID REFERENCES transactions(id),
  match_confidence DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Notes

- Epic 3 is the most complex and can be broken into smaller releases
- Consider a "beta" period for Auto-Checker where it suggests matches but admin confirms
- House Account users could later be "upgraded" to a real manager if they get referred
- Multiple Apple IDs opens possibility for "device-level" analytics in future
