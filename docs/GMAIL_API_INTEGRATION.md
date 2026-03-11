# Gmail API Integration - Future Implementation Guide

## Overview

Auto-detect Apple gift card purchases by reading Apple receipt emails from user's Gmail.

```
User clicks "Connect Gmail" → OAuth flow → Access to query inbox → Pull Apple receipts automatically
```

---

## Step 1: Google Cloud Setup

1. Go to https://console.cloud.google.com
2. Create a project (e.g., "Route.ng")
3. Enable Gmail API:
   - APIs & Services → Library → Search "Gmail API" → Enable
4. Configure OAuth consent screen:
   - User Type: External
   - App name: Route.ng
   - Support email: your email
   - Add scope: `https://www.googleapis.com/auth/gmail.readonly`
   - Add test users (for development)
5. Create OAuth 2.0 credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: Web application
   - Authorized redirect URI: `https://yourapp.com/auth/google/callback`
   - Download `client_secrets.json`

---

## Step 2: OAuth Flow Implementation

### Using Supabase Edge Function (Recommended for our stack)

```typescript
// supabase/functions/gmail-auth/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')
const REDIRECT_URI = 'https://yourapp.com/auth/google/callback'

serve(async (req) => {
  const url = new URL(req.url)

  if (url.pathname === '/auth/google') {
    // Generate OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.readonly')
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')

    return Response.redirect(authUrl.toString())
  }

  if (url.pathname === '/auth/google/callback') {
    const code = url.searchParams.get('code')

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenResponse.json()
    // Store tokens.access_token and tokens.refresh_token for user

    return new Response('Connected!')
  }
})
```

### Using Python + Flask (Alternative)

```python
from google_auth_oauthlib.flow import Flow

# User clicks "Connect Gmail"
@app.route('/auth/google')
def google_auth():
    flow = Flow.from_client_secrets_file(
        'client_secrets.json',
        scopes=['https://www.googleapis.com/auth/gmail.readonly'],
        redirect_uri='https://yourapp.com/auth/google/callback'
    )
    auth_url, state = flow.authorization_url()
    return redirect(auth_url)

# Google redirects back with token
@app.route('/auth/google/callback')
def google_callback():
    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials
    # Store credentials (access_token, refresh_token) for this user
    save_user_credentials(user_id, credentials)
```

---

## Step 3: Fetch Apple Receipts

```python
from googleapiclient.discovery import build

def get_apple_receipts(credentials):
    service = build('gmail', 'v1', credentials=credentials)

    # Search for Apple receipts
    query = 'from:(no_reply@email.apple.com) subject:(receipt)'

    results = service.users().messages().list(
        userId='me',
        q=query,
        maxResults=100
    ).execute()

    messages = results.get('messages', [])

    receipts = []
    for msg in messages:
        # Get full email content
        email = service.users().messages().get(
            userId='me',
            id=msg['id'],
            format='full'
        ).execute()

        # Parse HTML body for gift card details
        receipts.append(parse_apple_receipt(email))

    return receipts
```

### TypeScript Version (for Edge Functions)

```typescript
async function getAppleReceipts(accessToken: string) {
  const query = 'from:(no_reply@email.apple.com) subject:(receipt)'

  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=100`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  )

  const { messages } = await listResponse.json()

  const receipts = []
  for (const msg of messages || []) {
    const emailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    )
    const email = await emailResponse.json()
    receipts.push(parseAppleReceipt(email))
  }

  return receipts
}
```

---

## Step 4: Parse the Receipt HTML

```python
from bs4 import BeautifulSoup
import base64

def parse_apple_receipt(email):
    # Extract HTML body
    payload = email['payload']
    html_body = None

    for part in payload.get('parts', []):
        if part['mimeType'] == 'text/html':
            html_body = base64.urlsafe_b64decode(
                part['body']['data']
            ).decode('utf-8')

    soup = BeautifulSoup(html_body, 'html.parser')

    # Extract purchase details (structure varies - may need adjustment)
    return {
        'date': email['internalDate'],
        'items': extract_line_items(soup),
        'total': extract_total(soup),
        'order_id': extract_order_id(soup)
    }

def extract_line_items(soup):
    # Apple receipt structure - inspect actual emails to refine
    items = []
    # Find gift card line items
    # ...
    return items

def extract_total(soup):
    # Find total amount
    # ...
    return 0

def extract_order_id(soup):
    # Find Apple order ID for deduplication
    # ...
    return None
```

---

## Step 5: Ongoing Sync Strategies

| Approach | How | Best For |
|----------|-----|----------|
| On-demand | User clicks "Sync" → fetch new receipts | Simple, user-controlled |
| Periodic | Cron job every hour/day using stored refresh_token | Automatic background sync |
| Push (advanced) | Gmail Push Notifications via Google Pub/Sub | Real-time, complex setup |

### Periodic Sync with Supabase

```sql
-- Store Gmail credentials
CREATE TABLE gmail_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Use Supabase scheduled functions or external cron to sync periodically.

---

## Costs

| Item | Cost |
|------|------|
| Gmail API | Free - 1 billion quota units/day |
| Queries | ~5 units per message list, ~5 per message get |
| Realistically | Free unless you have 100k+ users |

---

## Pros/Cons

| Pros | Cons |
|------|------|
| One-time user setup | Gmail only (no Outlook/Yahoo) |
| Gets historical receipts | OAuth review required for "sensitive" scope |
| Auto-syncs new ones | Users may hesitate at "read email" permission |
| Free | More complex to build |

---

## Google Verification Requirements

Since `gmail.readonly` is a **sensitive scope**, Google requires:

1. **Verification process** (few days to weeks)
2. **Privacy policy** (must be publicly accessible)
3. **Homepage** (must be publicly accessible)
4. **Limited to 100 users** until verified

### For Development/Testing

You can use "test mode" with up to 100 manually-added test users:
1. Go to OAuth consent screen
2. Add users under "Test users"
3. Only these users can authorize the app

---

## Database Schema Additions

```sql
-- Gmail connections
CREATE TABLE gmail_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Synced receipts (for deduplication)
CREATE TABLE synced_apple_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gmail_message_id TEXT NOT NULL,
    apple_order_id TEXT,
    receipt_date TIMESTAMPTZ NOT NULL,
    total_amount DECIMAL(12,2),
    items JSONB,
    processed BOOLEAN DEFAULT FALSE,
    transaction_id UUID REFERENCES transactions(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, gmail_message_id)
);
```

---

## Implementation Priority

This is a **Phase 5+ feature**. Prerequisites:
1. Basic transaction logging working (Option A)
2. Manager verification flow complete
3. User base established
4. Privacy policy in place
5. Google verification submitted

---

## Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Cloud Console](https://console.cloud.google.com)
- [Gmail API Quotas](https://developers.google.com/gmail/api/reference/quota)
