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

## Summary

| Epic | Description | Estimate | Status |
|------|-------------|----------|--------|
| **Epic 1** | House Account + Optional Referral | ~12 hrs | ✅ Complete |
| **Epic 2** | Multiple Apple IDs Support | ~16.5 hrs | ✅ Complete |
| **Epic 3** | Auto-Checker Receipt Verification | ~46 hrs | Not Started |
| **Total** | | **~74.5 hrs** | |

---

## Recommended Implementation Order

```
Epic 1 (House Account)
    |
    v
Epic 2 (Multiple Apple IDs)  <-- Required for Epic 3 matching
    |
    v
Epic 3A (Email Integration)
    |
    v
Epic 3B (Receipt Parsing)
    |
    v
Epic 3C (Auto-Matching)
    |
    v
Epic 3D (Admin & Reporting)
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
