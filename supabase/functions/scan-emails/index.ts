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
  snippet: string;
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
  // Redemption code patterns (16 characters, alphanumeric)
  redemptionCode: /(?:redemption\s*code|gift\s*card\s*code|code)[:\s]*([A-Z0-9]{4}[-\s]?[A-Z0-9]{4}[-\s]?[A-Z0-9]{4}[-\s]?[A-Z0-9]{4})/gi,
  // Alternative code pattern
  codeAlt: /\b([A-Z0-9]{16})\b/g,
  // Amount patterns
  amount: /\$\s*(\d+(?:\.\d{2})?)/g,
  amountAlt: /(?:value|amount)[:\s]*\$?\s*(\d+(?:\.\d{2})?)/gi,
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

function parseGiftCards(bodyText: string, bodyHtml: string): ParsedCard[] {
  const cards: ParsedCard[] = [];
  const content = bodyText || bodyHtml;

  if (!content) return cards;

  // Extract redemption codes
  const codes: string[] = [];
  let match;

  // Try primary pattern first
  const codeRegex = new RegExp(APPLE_GIFT_CARD_PATTERNS.redemptionCode);
  while ((match = codeRegex.exec(content)) !== null) {
    const code = match[1].replace(/[-\s]/g, '').toUpperCase();
    if (code.length === 16 && !codes.includes(code)) {
      codes.push(code);
    }
  }

  // If no codes found, try alternative pattern
  if (codes.length === 0) {
    const altRegex = new RegExp(APPLE_GIFT_CARD_PATTERNS.codeAlt);
    while ((match = altRegex.exec(content)) !== null) {
      const code = match[1].toUpperCase();
      // Filter out common false positives
      if (!code.match(/^[0-9]+$/) && !codes.includes(code)) {
        codes.push(code);
      }
    }
  }

  // Extract amounts
  const amounts: number[] = [];
  const amountRegex = new RegExp(APPLE_GIFT_CARD_PATTERNS.amount);
  while ((match = amountRegex.exec(content)) !== null) {
    const amount = parseFloat(match[1]);
    if (amount > 0 && amount <= 500) { // Apple gift cards typically max at $500
      amounts.push(amount);
    }
  }

  // Create cards from extracted data
  const cardCount = Math.max(codes.length, amounts.length, 1);
  for (let i = 0; i < cardCount; i++) {
    cards.push({
      redemption_code: codes[i] || '',
      amount: amounts[i] || amounts[0] || 0,
      currency: 'USD',
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
  maxResults = 50
): Promise<GmailMessage[]> {
  // Search for Apple gift card related emails
  const query = 'from:apple.com subject:(gift card OR receipt) newer_than:7d';

  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!listResponse.ok) {
    throw new Error(`Gmail list failed: ${listResponse.status}`);
  }

  const listData = await listResponse.json();
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
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const triggeredBy = body.triggered_by || 'scheduled';

    // Get active email config
    const { data: config, error: configError } = await supabase
      .from('email_checker_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'No active email configuration found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

      if (tokenExpired || !accessToken) {
        accessToken = await refreshAccessToken(supabase, config.id, config.oauth_refresh_token);
        if (!accessToken) {
          throw new Error('Failed to refresh access token');
        }
      }

      // Fetch emails from Gmail
      const messages = await fetchGmailMessages(accessToken);
      emailsFetched = messages.length;

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

        const fromEmail = extractFromEmail(getHeader(message, 'From'));
        const subject = getHeader(message, 'Subject');
        const receivedAt = new Date(parseInt(message.internalDate)).toISOString();
        const { text: bodyText, html: bodyHtml } = extractEmailBody(message);

        // Save raw email
        const { data: rawEmail, error: rawError } = await supabase
          .from('raw_emails')
          .insert({
            message_id: messageId,
            from_email: fromEmail,
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

        // Parse gift cards from email
        const parsedCards = parseGiftCards(bodyText, bodyHtml);

        if (parsedCards.length > 0) {
          // Try to match sender to an iOS user
          const { data: matchedUser } = await supabase
            .from('users')
            .select('id, ios_user_profiles!inner(id)')
            .eq('email', fromEmail)
            .single();

          const matchedUserId = matchedUser?.ios_user_profiles?.[0]?.id;

          // Save parsed cards
          for (const card of parsedCards) {
            const { error: cardError } = await supabase
              .from('parsed_gift_cards')
              .insert({
                raw_email_id: rawEmail.id,
                sender_email: fromEmail,
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
