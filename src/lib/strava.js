import { supabase } from './supabase'

const CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID
const SCOPE = 'activity:read_all'

// Strava allows one redirect domain; we send the user back to the app root.
function redirectUri() {
  return window.location.origin + window.location.pathname
}

export function stravaConfigured() {
  return Boolean(CLIENT_ID)
}

// Send the user to Strava's consent screen
export function startStravaAuth() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    approval_prompt: 'auto',
  })
  window.location.href = `https://www.strava.com/oauth/authorize?${params}`
}

async function callFn(name, body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('not authenticated')
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body || {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.detail || json.error || 'request failed')
  return json
}

// Exchange the OAuth code for tokens (server-side), then return athlete name
export function exchangeStravaCode(code) {
  return callFn('strava-auth', { code })
}

// Pull new runs from Strava into daily_updates
export function syncStrava() {
  return callFn('strava-sync', {})
}
