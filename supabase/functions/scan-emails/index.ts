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

  // Check direct body
  if (message.payload.body?.data) {
    text = base64Decode(message.payload.body.data);
  }

  // Check parts
  if (message.payload.parts) {
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text = base64Decode(part.body.data);
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        html = base64Decode(part.body.data);
      }
    }
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
  return match ? match[1] : rawFrom;
}

function parseGiftCards(bodyText: string, bodyHtml: string, snippet?: string): ParsedCard[] {
  const cards: ParsedCard[] = [];

  // Combine all text sources for parsing
  const content = bodyText || bodyHtml || '';
  const allText = snippet ? `${snippet} ${content}` : content;

  if (!allText) return cards;

  // Log snippet and content preview for debugging
  console.log('Gmail snippet:', snippet);
  console.log('Email content preview (first 1000 chars):', content.substring(0, 1000));

  // Check if this looks like a gift card email
  if (!APPLE_GIFT_CARD_PATTERNS.giftCardIndicator.test(allText)) {
    console.log('Email does not match gift card indicator pattern');
    return cards;
  }

  // Extract redemption codes
  const codes: string[] = [];
  let match;

  // Try primary pattern first - "Redeem Code: X26J5Q67D56T925L"
  const codeRegex = /(?:redeem(?:ption)?\s*code|gift\s*card\s*code|code)[:\s]*([A-Z0-9]{16})/gi;
  while ((match = codeRegex.exec(allText)) !== null) {
    const code = match[1].toUpperCase();
    if (!codes.includes(code)) {
      codes.push(code);
    }
  }

  // Try pattern with dashes/spaces
  if (codes.length === 0) {
    const dashRegex = /(?:redeem(?:ption)?\s*code|code)[:\s]*([A-Z0-9]{4}[-\s][A-Z0-9]{4}[-\s][A-Z0-9]{4}[-\s][A-Z0-9]{4})/gi;
    while ((match = dashRegex.exec(allText)) !== null) {
      const code = match[1].replace(/[-\s]/g, '').toUpperCase();
      if (code.length === 16 && !codes.includes(code)) {
        codes.push(code);
      }
    }
  }

  console.log('Codes found:', codes);

  // Extract amounts - try multiple patterns
  const amounts: { value: number; currency: string }[] = [];

  // Pattern 1: Naira symbol ₦ (direct) - e.g., "₦2000" or "₦ 14,900"
  const nairaRegex = /₦\s*([\d,]+)/g;
  while ((match = nairaRegex.exec(allText)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    if (amount > 0 && amount <= 1000000) {
      amounts.push({ value: amount, currency: 'NGN' });
      console.log('Found amount with ₦:', amount);
    }
  }

  // Pattern 2: "gift - ₦2000" format (from notification)
  if (amounts.length === 0) {
    const giftDashRegex = /gift\s*-\s*₦?\s*([\d,]+)/gi;
    while ((match = giftDashRegex.exec(allText)) !== null) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0 && amount <= 1000000) {
        amounts.push({ value: amount, currency: 'NGN' });
        console.log('Found amount with gift-₦ pattern:', amount);
      }
    }
  }

  // Pattern 3: HTML entity for Naira (&#8358; or &#x20A6;)
  if (amounts.length === 0) {
    const htmlNairaRegex = /(?:&#8358;|&#x20A6;)\s*([\d,]+)/gi;
    while ((match = htmlNairaRegex.exec(allText)) !== null) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0 && amount <= 1000000) {
        amounts.push({ value: amount, currency: 'NGN' });
        console.log('Found amount with HTML entity:', amount);
      }
    }
  }

  // Pattern 4: NGN prefix
  if (amounts.length === 0) {
    const ngnRegex = /NGN\s*([\d,]+)/gi;
    while ((match = ngnRegex.exec(allText)) !== null) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0 && amount <= 1000000) {
        amounts.push({ value: amount, currency: 'NGN' });
        console.log('Found amount with NGN:', amount);
      }
    }
  }

  // Pattern 5: Number followed by "Gift" (e.g., "2000 Gift" or "14900\nGift")
  if (amounts.length === 0) {
    const giftAmountRegex = /([\d,]+)\s*(?:\n|\r|<[^>]*>)*\s*Gift/gi;
    while ((match = giftAmountRegex.exec(allText)) !== null) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount >= 100 && amount <= 1000000) {  // Reasonable gift card range
        amounts.push({ value: amount, currency: 'NGN' });
        console.log('Found amount before Gift:', amount);
      }
    }
  }

  // Pattern 6: "sent you a gift - ₦2000" or similar in snippet
  if (amounts.length === 0) {
    const snippetAmountRegex = /sent\s+you\s+a\s+gift\s*-?\s*₦?\s*([\d,]+)/gi;
    while ((match = snippetAmountRegex.exec(allText)) !== null) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount >= 100 && amount <= 1000000) {
        amounts.push({ value: amount, currency: 'NGN' });
        console.log('Found amount in sent you a gift pattern:', amount);
      }
    }
  }

  console.log('Amounts found:', amounts);

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
  if (codes.length === 0 && amounts.length === 0) {
    return cards;
  }

  const cardCount = Math.max(codes.length, amounts.length, 1);
  for (let i = 0; i < cardCount; i++) {
    cards.push({
      redemption_code: codes[i] || '',
      amount: amounts[i]?.value || amounts[0]?.value || 0,
      currency: amounts[i]?.currency || amounts[0]?.currency || 'NGN',
      card_index: i + 1,
    });
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
  maxResults = 50
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
  console.log('Gmail API response:', JSON.stringify(listData));
  const messageIds = listData.messages || [];

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
      messages.push(await msgResponse.json());
    }
  }

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
    console.log('Request body:', body);

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
        const { data: rawEmail, error: rawError } = await supabase
          .from('raw_emails')
          .insert({
            message_id: messageId,
            from_email: partnerEmail,
            subject,
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
          // Try to match partner email to a user's Apple ID (case-insensitive)
          // First find the Apple ID record, then get the ios_user_profile
          const { data: matchedAppleId } = await supabase
            .from('user_apple_ids')
            .select('id, user_id')
            .ilike('apple_id', partnerEmail)  // Case-insensitive match
            .eq('is_active', true)
            .is('deleted_at', null)
            .limit(1)
            .single();

          let matchedUserId = null;
          if (matchedAppleId) {
            // Now get the ios_user_profile for this user
            const { data: profile } = await supabase
              .from('ios_user_profiles')
              .select('id')
              .eq('user_id', matchedAppleId.user_id)
              .single();

            matchedUserId = profile?.id || null;
            console.log('Matched user via Apple ID:', { appleId: partnerEmail, userId: matchedAppleId.user_id, profileId: matchedUserId });
          } else {
            console.log('No matching Apple ID found for:', partnerEmail);
          }

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
