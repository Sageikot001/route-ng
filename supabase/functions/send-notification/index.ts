import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRequest {
  title: string
  body: string
  url?: string
  tag?: string
  targetType: 'all' | 'role' | 'users'
  targetRole?: 'ios_user' | 'manager' | 'admin'
  targetUserIds?: string[]
}

// Get OAuth token for FCM v1 API
async function getAccessToken(): Promise<string> {
  const serviceAccountEmail = Deno.env.get('FCM_SERVICE_ACCOUNT_EMAIL')
  const privateKey = Deno.env.get('FCM_PRIVATE_KEY')?.replace(/\\n/g, '\n')

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('FCM service account not configured')
  }

  // Create JWT for service account
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  // Encode header and payload
  const encoder = new TextEncoder()
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const unsignedToken = `${headerB64}.${payloadB64}`

  // Sign with private key
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBinary(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(unsignedToken)
  )

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${unsignedToken}.${signatureB64}`

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenResponse.json()
  if (!tokenData.access_token) {
    throw new Error('Failed to get access token: ' + JSON.stringify(tokenData))
  }

  return tokenData.access_token
}

// Convert PEM to binary
function pemToBinary(pem: string): ArrayBuffer {
  const lines = pem.split('\n')
  const base64 = lines.filter(line => !line.includes('-----')).join('')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// Send notification via FCM v1 API
async function sendToFCM(token: string, notification: { title: string; body: string; url?: string }): Promise<boolean> {
  const projectId = Deno.env.get('FCM_PROJECT_ID')
  if (!projectId) {
    console.error('FCM_PROJECT_ID not configured')
    return false
  }

  try {
    const accessToken = await getAccessToken()

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: token,
            notification: {
              title: notification.title,
              body: notification.body,
            },
            webpush: {
              fcm_options: {
                link: notification.url || '/',
              },
            },
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('FCM error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error sending to FCM:', error)
    return false
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { title, body, url, tag, targetType, targetRole, targetUserIds }: NotificationRequest = await req.json()

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'title and body are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get target user IDs based on targetType
    let userIds: string[] = []

    console.log('Notification request:', { targetType, targetRole, targetUserIds })

    if (targetType === 'users' && targetUserIds) {
      userIds = targetUserIds
      console.log('Targeting specific users:', userIds.length)
    } else if (targetType === 'role' && targetRole) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id')
        .eq('role', targetRole)

      if (usersError) {
        console.error('Error fetching users by role:', usersError)
      }
      console.log(`Found ${users?.length || 0} users with role "${targetRole}"`)
      userIds = users?.map(u => u.id) || []
    } else if (targetType === 'all') {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id')

      if (usersError) {
        console.error('Error fetching all users:', usersError)
      }
      console.log(`Found ${users?.length || 0} total users`)
      userIds = users?.map(u => u.id) || []
    }

    if (userIds.length === 0) {
      console.log('No target users found, returning early')
      return new Response(
        JSON.stringify({ success: 0, failed: 0, message: 'No target users' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get FCM tokens for these users
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('fcm_token')
      .in('user_id', userIds)

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: 0, failed: 0, message: 'No push subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send to each token
    let success = 0
    let failed = 0

    for (const sub of subscriptions) {
      const sent = await sendToFCM(sub.fcm_token, { title, body, url })
      if (sent) {
        success++
      } else {
        failed++
      }
    }

    return new Response(
      JSON.stringify({ success, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
