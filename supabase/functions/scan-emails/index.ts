// Supabase Edge Function for scanning Gmail for Apple Gift Card emails
// This function fetches emails, parses gift card data, and stores results

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;  // Gmail preview text - often contains the amount!
  payload: {
    headers: { name: string; value: string }[];
    body?: { data?: string };
    parts?: { mimeType: string; body?: { data?: string } }[];
  };
  internalDate: string;
}

interface ParsedCard {
  redemption_code: string;
  amount: number;
  currency: string;
  card_index: number;
}

// Apple Gift Card email patterns
const APPLE_GIFT_CARD_PATTERNS = {
  // Redemption code pattern - "Redeem Code: X26J5Q67D56T925L"
  redemptionCode: /(?:redeem(?:ption)?\s*code|gift\s*card\s*code|code)[:\s]*([A-Z0-9]{16})/gi,
  // Alternative: code with dashes or spaces
  codeWithDashes: /(?:redeem(?:ption)?\s*code|code)[:\s]*([A-Z0-9]{4}[-\s][A-Z0-9]{4}[-\s][A-Z0-9]{4}[-\s][A-Z0-9]{4})/gi,
  // Standalone 16-char code as fallback
  codeAlt: /\b([A-Z0-9]{16})\b/g,
  // Amount patterns - Naira (₦) and USD ($)
  amountNaira: /₦\s*([\d,]+(?:\.\d{2})?)/g,
  amountNairaAlt: /NGN\s*([\d,]+(?:\.\d{2})?)/gi,
  amountUSD: /\$\s*(\d+(?:\.\d{2})?)/g,
  // Gift card indicator in email
  giftCardIndicator: /gift\s*(?:card|from)|redeem\s*code|itunes\s*store/gi,
};

function base64Decode(data: string): string {
  try {
    // Gmail uses URL-safe base64
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return atob(base64);
  } catch {
    return '';
  }
}

function extractEmailBody(message: GmailMessage): { text: string; html: string } {
  let text = '';
  let html = '';

  // Recursively extract body from parts (handles nested multipart emails)
  function extractFromParts(parts: any[]): void {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text += base64Decode(part.body.data);
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        html += base64Decode(part.body.data);
      }
      // Recursively check nested parts (multipart/alternative, multipart/mixed, etc.)
      if (part.parts) {
        extractFromParts(part.parts);
      }
    }
  }

  // Check direct body
  if (message.payload.body?.data) {
    text = base64Decode(message.payload.body.data);
  }

  // Check parts (including nested)
  if (message.payload.parts) {
    extractFromParts(message.payload.parts);
  }

  return { text, html };
}

function getHeader(message: GmailMessage, name: string): string {
  const header = message.payload.headers.find(
    h => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value || '';
}

function extractFromEmail(rawFrom: string): string {
  // Extract email from "Name <email@domain.com>" format
  const match = rawFrom.match(/<([^>]+)>/);
  return match ? match[1].trim().toLowerCase() : rawFrom.trim().toLowerCase();
}

// Match sender email to a user via their Apple IDs
async function matchEmailToUser(supabase: any, senderEmail: string): Promise<string | null> {
  if (!senderEmail) {
    console.log('matchEmailToUser: No sender email provided');
    return null;
  }

  const normalizedEmail = senderEmail.trim().toLowerCase();
  console.log(`=== Matching email: "${normalizedEmail}" ===`);

  // Query ALL user_apple_ids (no filters first to debug)
  const { data: allAppleIds, error: allError, count: totalCount } = await supabase
    .from('user_apple_ids')
    .select('id, user_id, apple_id, is_active, deleted_at', { count: 'exact' });

  if (allError) {
    console.error('Error fetching ALL Apple IDs:', allError);
    console.error('Error details:', JSON.stringify(allError));
  } else {
    console.log(`Total Apple IDs in user_apple_ids table: ${allAppleIds?.length || 0} (count: ${totalCount})`);
    // Log ALL for debugging (since we expect more)
    console.log('ALL Apple IDs in user_apple_ids:', JSON.stringify(allAppleIds?.map((a: any) => ({
      apple_id: a.apple_id,
      is_active: a.is_active,
      deleted_at: a.deleted_at
    }))));
  }

  // Also check ios_user_profiles.apple_id directly
  const { data: profileAppleIds, error: debugProfileError } = await supabase
    .from('ios_user_profiles')
    .select('id, apple_id, full_name');

  if (debugProfileError) {
    console.error('Error fetching ios_user_profiles:', debugProfileError);
  } else {
    console.log(`Total ios_user_profiles with apple_id: ${profileAppleIds?.length || 0}`);
    console.log('ALL ios_user_profiles apple_ids:', JSON.stringify(profileAppleIds?.map((p: any) => ({
      profile_id: p.id,
      apple_id: p.apple_id,
      name: p.full_name
    }))));
  }

  // Query user_apple_ids for active, non-deleted Apple IDs
  const { data: activeAppleIds, error } = await supabase
    .from('user_apple_ids')
    .select('id, user_id, apple_id')
    .eq('is_active', true)
    .is('deleted_at', null);

  if (error) {
    console.error('Error fetching active Apple IDs:', error);
    return null;
  }

  console.log(`Active Apple IDs count: ${activeAppleIds?.length || 0}`);

  // Log all active Apple IDs for comparison
  if (activeAppleIds && activeAppleIds.length > 0) {
    console.log('All active Apple IDs:', JSON.stringify(activeAppleIds.map((a: any) => a.apple_id?.toLowerCase())));
  }

  // Find matching Apple ID (case-insensitive comparison)
  const matchedAppleId = activeAppleIds?.find(
    (a: any) => a.apple_id?.trim().toLowerCase() === normalizedEmail
  );

  if (!matchedAppleId) {
    console.log(`No match in user_apple_ids for "${normalizedEmail}", checking ios_user_profiles...`);

    // Fallback: check the old ios_user_profiles.apple_id column
    const { data: profiles, error: profilesError } = await supabase
      .from('ios_user_profiles')
      .select('id, user_id, apple_id');

    if (profilesError) {
      console.error('Error fetching ios_user_profiles:', profilesError);
      return null;
    }

    console.log(`Checking ${profiles?.length || 0} ios_user_profiles for apple_id match`);

    // Find matching profile by apple_id (case-insensitive)
    const matchedProfile = profiles?.find(
      (p: any) => p.apple_id?.trim().toLowerCase() === normalizedEmail
    );

    if (matchedProfile) {
      console.log(`MATCH FOUND in ios_user_profiles: ${matchedProfile.apple_id} -> profile_id: ${matchedProfile.id}`);
      return matchedProfile.id;
    }

    console.log(`NO MATCH for "${normalizedEmail}" in any table`);
    return null;
  }

  console.log(`MATCH FOUND: ${matchedAppleId.apple_id} -> user_id: ${matchedAppleId.user_id}`);

  // Get the ios_user_profile for this user
  const { data: profile, error: profileError } = await supabase
    .from('ios_user_profiles')
    .select('id')
    .eq('user_id', matchedAppleId.user_id)
    .maybeSingle();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return null;
  }

  if (profile) {
    console.log(`Matched to ios_user_profile: ${profile.id}`);
    return profile.id;
  }

  console.log(`No ios_user_profile found for user_id: ${matchedAppleId.user_id}`);
  return null;
}

// Validate if a code is a real Apple gift card code (not CSS or other false positive)
function isValidGiftCardCode(code: string): boolean {
  if (!code || code.length !== 16) return false;

  const upperCode = code.toUpperCase();

  // Apple gift card codes start with X
  if (!upperCode.startsWith('X')) {
    return false;
  }

  // Filter out CSS-like values (e.g., 50PX30PX50PX30PX, 100PX200PX etc)
  if (/PX/i.test(upperCode)) return false;

  // Filter out repeating patterns (e.g., ABCDABCDABCDABCD)
  if (/(.{4})\1/.test(upperCode)) return false;
  if (/(.{2})\1{3,}/.test(upperCode)) return false;

  // Must be alphanumeric only (letters and/or numbers, no special chars)
  if (!/^[A-Z0-9]+$/.test(upperCode)) return false;

  return true;
}

function parseGiftCards(bodyText: string, bodyHtml: string, snippet?: string, skipIndicatorCheck = false): ParsedCard[] {
  const cards: ParsedCard[] = [];

  // Combine all text sources for parsing
  const content = bodyText || bodyHtml || '';
  const allText = snippet ? `${snippet} ${content}` : content;

  if (!allText) return cards;

  // Log snippet and content preview for debugging
  console.log('Gmail snippet:', snippet);
  console.log('Email content preview (first 1000 chars):', content.substring(0, 1000));

  // Check if this looks like a gift card email (skip for rescan since emails already filtered)
  if (!skipIndicatorCheck && !APPLE_GIFT_CARD_PATTERNS.giftCardIndicator.test(allText)) {
    console.log('Email does not match gift card indicator pattern');
    return cards;
  }

  // Extract redemption codes
  const codes: string[] = [];
  let match;

  // Pattern 1: "Redeem Code: X26J5Q67D56T925L" or similar prefixed codes
  const codeRegex = /(?:redeem(?:ption)?\s*code|gift\s*card\s*code|code)[:\s]*([A-Z0-9]{16})/gi;
  while ((match = codeRegex.exec(allText)) !== null) {
    const code = match[1].toUpperCase();
    if (isValidGiftCardCode(code) && !codes.includes(code)) {
      codes.push(code);
    }
  }

  // Pattern 2: Codes with dashes/spaces (e.g., "ABCD-EFGH-IJKL-MNOP")
  const dashRegex = /\b([A-Z0-9]{4}[-\s][A-Z0-9]{4}[-\s][A-Z0-9]{4}[-\s][A-Z0-9]{4})\b/gi;
  while ((match = dashRegex.exec(allText)) !== null) {
    const code = match[1].replace(/[-\s]/g, '').toUpperCase();
    if (isValidGiftCardCode(code) && !codes.includes(code)) {
      codes.push(code);
    }
  }

  // Pattern 3: Standalone 16-character alphanumeric codes (fallback)
  const standaloneRegex = /\b([A-Z0-9]{16})\b/g;
  const rejectedCodes: string[] = [];
  while ((match = standaloneRegex.exec(allText)) !== null) {
    const code = match[1].toUpperCase();
    if (codes.includes(code)) continue; // Already added
    if (isValidGiftCardCode(code)) {
      codes.push(code);
    } else {
      rejectedCodes.push(code);
    }
  }

  console.log('Valid codes found:', codes.length, codes);
  if (rejectedCodes.length > 0) {
    console.log('Rejected codes (failed validation):', rejectedCodes.length, rejectedCodes);
  }

  // If no codes found, log more of the content to understand why
  if (codes.length === 0) {
    console.log('=== NO CODES FOUND - FULL DEBUG ===');
    console.log('Full content length:', allText.length);
    // Log in chunks to see more
    console.log('Content chunk 1 (0-2000):', allText.substring(0, 2000));
    console.log('Content chunk 2 (2000-4000):', allText.substring(2000, 4000));
    console.log('Content chunk 3 (4000-6000):', allText.substring(4000, 6000));
    // Look for any 16-char alphanumeric strings
    const all16Chars = allText.match(/[A-Z0-9]{16}/gi) || [];
    console.log('All 16-char alphanumeric strings found:', all16Chars);
  }

  // Extract amounts - try multiple patterns
  const amounts: { value: number; currency: string }[] = [];

  // Helper to add amount if valid
  const addAmount = (value: number, source: string) => {
    if (value >= 100 && value <= 1000000) {
      // Check if this amount already exists
      if (!amounts.some(a => a.value === value)) {
        amounts.push({ value, currency: 'NGN' });
        console.log(`Found amount ${value} from: ${source}`);
      }
    }
  };

  // Pattern 1: Naira symbol ₦ (direct) - e.g., "₦2000" or "₦ 14,900" or "₦14900"
  const nairaRegex = /₦\s*([\d,]+(?:\.\d{2})?)/g;
  while ((match = nairaRegex.exec(allText)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    addAmount(amount, '₦ symbol');
  }

  // Pattern 2: "gift - ₦2000" or "gift - 2000" format (from notification)
  const giftDashRegex = /gift\s*[-–—]\s*₦?\s*([\d,]+)/gi;
  while ((match = giftDashRegex.exec(allText)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    addAmount(amount, 'gift-amount pattern');
  }

  // Pattern 3: HTML entity for Naira (&#8358; or &#x20A6;)
  const htmlNairaRegex = /(?:&#8358;|&#x20A6;)\s*([\d,]+)/gi;
  while ((match = htmlNairaRegex.exec(allText)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    addAmount(amount, 'HTML entity');
  }

  // Pattern 4: NGN prefix - "NGN 14,900" or "NGN14900"
  const ngnRegex = /NGN\s*([\d,]+)/gi;
  while ((match = ngnRegex.exec(allText)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    addAmount(amount, 'NGN prefix');
  }

  // Pattern 5: "sent you a gift - ₦2000" or similar in snippet
  const snippetAmountRegex = /sent\s+you\s+a\s+gift\s*[-–—]?\s*₦?\s*([\d,]+)/gi;
  while ((match = snippetAmountRegex.exec(allText)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    addAmount(amount, 'sent you a gift pattern');
  }

  // Pattern 6: Number followed by "Gift" (e.g., "2000 Gift" or "14,900 Gift Card")
  const giftAmountRegex = /([\d,]+)\s*(?:\n|\r|<[^>]*>)*\s*(?:Apple\s+)?Gift/gi;
  while ((match = giftAmountRegex.exec(allText)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    addAmount(amount, 'amount before Gift');
  }

  // Pattern 7: "worth ₦X" or "value ₦X"
  const worthRegex = /(?:worth|value|amount)[:\s]*₦?\s*([\d,]+)/gi;
  while ((match = worthRegex.exec(allText)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    addAmount(amount, 'worth/value pattern');
  }

  // Pattern 8: "₦X Apple Gift Card" (amount before Apple)
  const beforeAppleRegex = /₦\s*([\d,]+)\s*Apple/gi;
  while ((match = beforeAppleRegex.exec(allText)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    addAmount(amount, '₦ before Apple');
  }

  // Pattern 9: Standalone large numbers that look like Nigerian gift card amounts
  // Common values: 2000, 5000, 10000, 14900, 15000, 20000, 25000, 50000
  if (amounts.length === 0) {
    const standaloneRegex = /\b(2000|5000|10000|14900|15000|20000|25000|50000)\b/g;
    while ((match = standaloneRegex.exec(allText)) !== null) {
      const amount = parseFloat(match[1]);
      addAmount(amount, 'common gift card amount');
    }
  }

  console.log('Amounts found:', amounts.length, amounts);

  // USD amounts as fallback
  if (amounts.length === 0) {
    const usdRegex = /\$\s*(\d+(?:\.\d{2})?)/g;
    while ((match = usdRegex.exec(content)) !== null) {
      const amount = parseFloat(match[1]);
      if (amount > 0 && amount <= 500) {
        amounts.push({ value: amount, currency: 'USD' });
      }
    }
  }

  // Create cards from extracted data
  if (codes.length === 0) {
    console.log('No valid codes found in email');
    return cards;
  }

  console.log(`Creating ${codes.length} cards from ${codes.length} codes and ${amounts.length} amounts`);

  // Each code gets its corresponding amount, or falls back to first amount if not enough amounts detected
  for (let i = 0; i < codes.length; i++) {
    const cardAmount = amounts[i]?.value || amounts[0]?.value || 0;
    const cardCurrency = amounts[i]?.currency || amounts[0]?.currency || 'NGN';

    cards.push({
      redemption_code: codes[i],
      amount: cardAmount,
      currency: cardCurrency,
      card_index: i + 1,
    });

    console.log(`Card ${i + 1}: ${codes[i]} = ${cardAmount} ${cardCurrency}`);
  }

  return cards;
}

async function refreshAccessToken(
  supabase: any,
  configId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.error('Missing Google OAuth credentials');
    return null;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    // Update config with new access token
    await supabase
      .from('email_checker_config')
      .update({
        oauth_access_token: data.access_token,
        token_expires_at: expiresAt,
      })
      .eq('id', configId);

    return data.access_token;
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

async function fetchGmailMessages(
  accessToken: string,
  fromDate?: string | null,
  toDate?: string | null,
  maxResults = 100
): Promise<GmailMessage[]> {
  // Search for Apple gift card emails sent directly to this inbox
  // Partners send gift cards TO this email, Apple sends the notification
  let query = 'from:email.apple.com subject:"sent you a gift"';

  // Add date range filters if provided
  if (fromDate) {
    // Gmail format: YYYY/MM/DD
    const formattedFrom = fromDate.replace(/-/g, '/');
    query += ` after:${formattedFrom}`;
  }
  if (toDate) {
    // Gmail's before: is exclusive, so add 1 day to include the end date
    const endDate = new Date(toDate);
    endDate.setDate(endDate.getDate() + 1);
    const formattedTo = endDate.toISOString().split('T')[0].replace(/-/g, '/');
    query += ` before:${formattedTo}`;
  }

  // Default to last 14 days if no date range specified
  if (!fromDate && !toDate) {
    query += ' newer_than:14d';
  }

  console.log('Gmail search query:', query);

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  console.log('Gmail API URL:', url);

  const listResponse = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listResponse.ok) {
    const errorText = await listResponse.text();
    console.error('Gmail API error:', listResponse.status, errorText);
    throw new Error(`Gmail list failed: ${listResponse.status} - ${errorText}`);
  }

  const listData = await listResponse.json();
  const messageIds = listData.messages || [];
  console.log(`Gmail API returned ${messageIds.length} message IDs`);

  // Fetch full message details
  const messages: GmailMessage[] = [];
  for (const { id } of messageIds) {
    const msgResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (msgResponse.ok) {
      const msg = await msgResponse.json();
      const subject = msg.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || 'No subject';
      const bodySize = (msg.payload?.body?.data?.length || 0) +
        (msg.payload?.parts?.reduce((acc: number, p: any) => acc + (p.body?.data?.length || 0), 0) || 0);
      console.log(`Message ${id}: "${subject}" - body size: ${bodySize} chars`);
      messages.push(msg);
    } else {
      console.error(`Failed to fetch message ${id}: ${msgResponse.status}`);
    }
  }

  console.log(`Successfully fetched ${messages.length} full messages`);
  return messages;
}

async function markEmailAsRead(accessToken: string, messageId: string): Promise<void> {
  await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removeLabelIds: ['UNREAD'],
      }),
    }
  );
}

Deno.serve(async (req) => {
  console.log('=== Scan emails function started ===');

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Initializing Supabase client...');
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseServiceKey });
      return new Response(
        JSON.stringify({ error: 'Missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Supabase client initialized');

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const triggeredBy = body.triggered_by || 'scheduled';
    const rescanExisting = body.rescan_existing === true;
    console.log('Request body:', body, 'Rescan existing:', rescanExisting);

    // Get active email config
    console.log('Fetching email config...');
    const { data: config, error: configError } = await supabase
      .from('email_checker_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (configError) {
      console.error('Config error:', configError);
      return new Response(
        JSON.stringify({ error: 'Failed to get config: ' + configError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config) {
      console.error('No active config found');
      return new Response(
        JSON.stringify({ error: 'No active email configuration found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Config found:', { email: config.gmail_email, hasToken: !!config.oauth_access_token });

    // Create scan log
    const { data: scanLog, error: logError } = await supabase
      .from('email_scan_logs')
      .insert({ triggered_by: triggeredBy })
      .select()
      .single();

    if (logError) {
      console.error('Failed to create scan log:', logError);
    }

    const errors: string[] = [];
    let emailsFetched = 0;
    let emailsParsed = 0;
    let cardsFound = 0;

    try {
      // Ensure we have a valid access token
      let accessToken = config.oauth_access_token;
      const tokenExpired = config.token_expires_at && new Date(config.token_expires_at) < new Date();
      console.log('Token status:', { hasToken: !!accessToken, expired: tokenExpired });

      if (tokenExpired || !accessToken) {
        console.log('Refreshing access token...');
        accessToken = await refreshAccessToken(supabase, config.id, config.oauth_refresh_token);
        if (!accessToken) {
          throw new Error('Failed to refresh access token');
        }
        console.log('Token refreshed successfully');
      }

      // RESCAN MODE: Find missing codes by comparing parsed codes vs stored codes
      if (rescanExisting) {
        console.log('=== RESCAN MODE: Finding missing codes ===');

        // Step 1: Get ALL existing redemption codes from the database
        const { data: allExistingCards, error: existingError } = await supabase
          .from('parsed_gift_cards')
          .select('redemption_code')
          .not('redemption_code', 'is', null);

        if (existingError) {
          throw new Error(`Failed to fetch existing codes: ${existingError.message}`);
        }

        const globalExistingCodes = new Set(
          (allExistingCards || []).map(c => c.redemption_code?.toUpperCase()).filter(Boolean)
        );
        console.log(`Found ${globalExistingCodes.size} existing codes in database`);

        // Step 2: Fetch all raw_emails
        const { data: existingEmails, error: emailsError } = await supabase
          .from('raw_emails')
          .select('*')
          .order('received_at', { ascending: false });

        if (emailsError) {
          throw new Error(`Failed to fetch existing emails: ${emailsError.message}`);
        }

        emailsFetched = existingEmails?.length || 0;
        console.log(`Scanning ${emailsFetched} emails for missing codes`);

        // Step 3: Re-parse each email and find codes NOT in globalExistingCodes
        for (const rawEmail of existingEmails || []) {
          // Use stored snippet for amount detection (snippet often has amount in parseable format)
          // Skip indicator check for rescan - emails already came from gift card search
          const parsedCards = parseGiftCards(rawEmail.body_text || '', rawEmail.body_html || '', rawEmail.snippet || '', true);

          // Only process cards that have a redemption code
          const cardsWithCodes = parsedCards.filter(c => c.redemption_code && c.redemption_code.length > 0);

          if (cardsWithCodes.length === 0) {
            emailsParsed++;
            continue;
          }

          // Find codes that don't exist in the database
          const missingCodes = cardsWithCodes.filter(
            c => !globalExistingCodes.has(c.redemption_code.toUpperCase())
          );

          if (missingCodes.length > 0) {
            console.log(`Email ${rawEmail.id}: Found ${missingCodes.length} MISSING codes:`,
              missingCodes.map(c => c.redemption_code));

            // Get amount from existing cards in the same email (all cards in one email have same amount)
            const { data: existingEmailCards } = await supabase
              .from('parsed_gift_cards')
              .select('amount')
              .eq('raw_email_id', rawEmail.id)
              .not('amount', 'is', null)
              .gt('amount', 0)
              .limit(1);

            const fallbackAmount = existingEmailCards?.[0]?.amount || null;
            console.log(`Fallback amount for email ${rawEmail.id}: ${fallbackAmount}`);

            // Match user for this email using helper function
            const matchedUserId = await matchEmailToUser(supabase, rawEmail.from_email);

            // Insert only the missing codes
            for (const card of missingCodes) {
              // Use parsed amount, or fallback to amount from other cards in same email
              const cardAmount = (card.amount && card.amount > 0) ? card.amount : fallbackAmount;

              const { error: cardError } = await supabase
                .from('parsed_gift_cards')
                .insert({
                  raw_email_id: rawEmail.id,
                  sender_email: rawEmail.from_email,
                  redemption_code: card.redemption_code,
                  amount: cardAmount,
                  currency: card.currency,
                  card_index: card.card_index,
                  matched_user_id: matchedUserId,
                  received_at: rawEmail.received_at,
                });

              if (cardError) {
                errors.push(`Failed to save code ${card.redemption_code}: ${cardError.message}`);
              } else {
                cardsFound++;
                // Add to global set to avoid duplicates within this scan
                globalExistingCodes.add(card.redemption_code.toUpperCase());
                console.log(`Added missing code: ${card.redemption_code} (amount: ${cardAmount})`);
              }
            }
          }
          emailsParsed++;
        }

        console.log(`Rescan complete: Found ${cardsFound} missing codes`);

        // Clean up invalid codes (CSS patterns, non-X-starting codes, etc.)
        console.log('=== Cleaning up invalid codes ===');
        const { data: allCards, error: allCardsError } = await supabase
          .from('parsed_gift_cards')
          .select('id, redemption_code');

        if (!allCardsError && allCards) {
          const invalidCards = allCards.filter(c => !isValidGiftCardCode(c.redemption_code));
          if (invalidCards.length > 0) {
            console.log(`Found ${invalidCards.length} invalid codes to remove:`,
              invalidCards.map(c => c.redemption_code));

            const invalidIds = invalidCards.map(c => c.id);
            const { error: deleteError } = await supabase
              .from('parsed_gift_cards')
              .delete()
              .in('id', invalidIds);

            if (deleteError) {
              console.error('Error deleting invalid codes:', deleteError);
            } else {
              console.log(`Deleted ${invalidCards.length} invalid codes`);
            }
          } else {
            console.log('No invalid codes found');
          }
        }

        // Also fix cards with zero/null amounts by getting amount from sibling cards
        console.log('=== Fixing cards with zero amounts ===');
        const { data: zeroAmountCards, error: zeroError } = await supabase
          .from('parsed_gift_cards')
          .select('id, raw_email_id, redemption_code')
          .or('amount.is.null,amount.eq.0');

        if (!zeroError && zeroAmountCards && zeroAmountCards.length > 0) {
          console.log(`Found ${zeroAmountCards.length} cards with zero/null amounts`);

          for (const card of zeroAmountCards) {
            // First try: get amount from sibling cards in same email
            const { data: siblingCards } = await supabase
              .from('parsed_gift_cards')
              .select('amount')
              .eq('raw_email_id', card.raw_email_id)
              .not('amount', 'is', null)
              .gt('amount', 0)
              .limit(1);

            let newAmount = siblingCards?.[0]?.amount || null;

            // Second try: re-parse the raw email for amount
            if (!newAmount && card.raw_email_id) {
              const { data: rawEmail } = await supabase
                .from('raw_emails')
                .select('body_text, body_html, snippet')
                .eq('id', card.raw_email_id)
                .single();

              if (rawEmail) {
                // Skip indicator check - emails already from gift card search
                const parsedCards = parseGiftCards(
                  rawEmail.body_text || '',
                  rawEmail.body_html || '',
                  rawEmail.snippet || '',
                  true
                );
                // Find matching card by code or use first amount
                const matchingParsed = parsedCards.find(
                  p => p.redemption_code === card.redemption_code
                );
                newAmount = matchingParsed?.amount || parsedCards[0]?.amount || null;
              }
            }

            if (newAmount && newAmount > 0) {
              const { error: updateError } = await supabase
                .from('parsed_gift_cards')
                .update({ amount: newAmount })
                .eq('id', card.id);

              if (!updateError) {
                console.log(`Fixed amount for ${card.redemption_code}: ${newAmount}`);
              }
            }
          }
        }

        // Re-match unmatched cards to users
        console.log('=== Re-matching unmatched cards ===');
        const { data: unmatchedCards, error: unmatchedError } = await supabase
          .from('parsed_gift_cards')
          .select('id, sender_email, redemption_code')
          .is('matched_user_id', null);

        if (!unmatchedError && unmatchedCards && unmatchedCards.length > 0) {
          console.log(`Found ${unmatchedCards.length} unmatched cards to re-match`);

          // Group by sender_email to avoid duplicate lookups
          const emailGroups = new Map<string, string[]>();
          for (const card of unmatchedCards) {
            const email = card.sender_email?.toLowerCase() || '';
            if (!emailGroups.has(email)) {
              emailGroups.set(email, []);
            }
            emailGroups.get(email)!.push(card.id);
          }

          let matchedCount = 0;
          for (const [senderEmail, cardIds] of emailGroups) {
            const matchedUserId = await matchEmailToUser(supabase, senderEmail);

            if (matchedUserId) {
              // Update all cards from this sender
              const { error: updateError } = await supabase
                .from('parsed_gift_cards')
                .update({ matched_user_id: matchedUserId })
                .in('id', cardIds);

              if (!updateError) {
                matchedCount += cardIds.length;
                console.log(`Matched ${cardIds.length} cards from ${senderEmail} to user ${matchedUserId}`);
              }
            }
          }

          console.log(`Re-matched ${matchedCount} cards to users`);
        }

        // Update config last scan time
        await supabase
          .from('email_checker_config')
          .update({ last_scan_at: new Date().toISOString() })
          .eq('id', config.id);

      } else {
        // NORMAL MODE: Fetch from Gmail
        // Fetch emails from Gmail using dates from config
        const fromDate = config.scan_from_date || null; // YYYY-MM-DD or null
        const toDate = config.scan_to_date || null;     // YYYY-MM-DD or null
        console.log('Scan dates from config:', { fromDate, toDate });

        const messages = await fetchGmailMessages(accessToken, fromDate, toDate);
        emailsFetched = messages.length;
        console.log('Emails fetched:', emailsFetched);

        // Process each message
        for (const message of messages) {
          const messageId = message.id;

          // Check if already processed
          const { data: existing } = await supabase
            .from('raw_emails')
            .select('id')
            .eq('message_id', messageId)
            .single();

          if (existing) {
            continue; // Skip already processed
          }

          // The partner's email is in Reply-To header (they sent the gift card)
          // From is Apple's email (do_not_reply@email.apple.com)
          const replyTo = getHeader(message, 'Reply-To');
          const fromEmail = getHeader(message, 'From');
          const partnerEmail = extractFromEmail(replyTo || fromEmail);
          const subject = getHeader(message, 'Subject');
          const receivedAt = new Date(parseInt(message.internalDate)).toISOString();
          const { text: bodyText, html: bodyHtml } = extractEmailBody(message);

          // Save raw email (from_email stores the partner's email from Reply-To)
          // Store snippet for later rescan (snippet often has amount in parseable format)
          const { data: rawEmail, error: rawError } = await supabase
            .from('raw_emails')
            .insert({
              message_id: messageId,
              from_email: partnerEmail,
              subject,
              snippet: message.snippet || null,
              body_text: bodyText,
              body_html: bodyHtml,
              received_at: receivedAt,
            })
            .select()
            .single();

          if (rawError) {
            errors.push(`Failed to save email ${messageId}: ${rawError.message}`);
            continue;
          }

          // Parse gift cards from email (include snippet for amount detection)
          const parsedCards = parseGiftCards(bodyText, bodyHtml, message.snippet);

          if (parsedCards.length > 0) {
            // Match sender email to a user via their Apple IDs
            const matchedUserId = await matchEmailToUser(supabase, partnerEmail);

            // Save parsed cards
            for (const card of parsedCards) {
              const { error: cardError } = await supabase
                .from('parsed_gift_cards')
                .insert({
                  raw_email_id: rawEmail.id,
                  sender_email: partnerEmail,
                  redemption_code: card.redemption_code || null,
                  amount: card.amount || null,
                  currency: card.currency,
                  card_index: card.card_index,
                  matched_user_id: matchedUserId || null,
                  received_at: receivedAt,
                });

              if (cardError) {
                errors.push(`Failed to save card: ${cardError.message}`);
              } else {
                cardsFound++;
              }
            }
          }

          // Mark email as processed
          await supabase
            .from('raw_emails')
            .update({ processed: true })
            .eq('id', rawEmail.id);

          emailsParsed++;

          // Mark email as read in Gmail
          await markEmailAsRead(accessToken, messageId);
        }

        // Update config last scan time
        await supabase
          .from('email_checker_config')
          .update({ last_scan_at: new Date().toISOString() })
          .eq('id', config.id);
      } // end else (normal mode)

    } catch (error: any) {
      errors.push(error.message);
    }

    // Update scan log with results
    if (scanLog) {
      await supabase
        .from('email_scan_logs')
        .update({
          completed_at: new Date().toISOString(),
          emails_fetched: emailsFetched,
          emails_parsed: emailsParsed,
          cards_found: cardsFound,
          errors: errors.length > 0 ? errors : null,
        })
        .eq('id', scanLog.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanLogId: scanLog?.id,
        emailsFetched,
        emailsParsed,
        cardsFound,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Scan error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
