import { supabase } from './supabase'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

// On iOS, web push only works when the app is installed to the home screen.
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

// iOS Safari (not installed) can't subscribe to push at all.
export function iosNeedsInstall() {
  return isIOS() && !isStandalone()
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

// Request permission, subscribe, and store the subscription for this user.
export async function enablePush(userId) {
  if (!pushSupported()) throw new Error('הדפדפן לא תומך בהתראות')
  if (!VAPID_PUBLIC) throw new Error('חסר מפתח התראות (VAPID) בהגדרות')
  if (iosNeedsInstall()) throw new Error('באייפון יש קודם להוסיף את האפליקציה למסך הבית')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('לא ניתנה הרשאה להתראות במכשיר')

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    })
  }

  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' }
  )
  if (error) throw new Error(error.message)
  return true
}

// Remove this device's subscription.
export async function disablePush() {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}

// Ask the server to send an immediate test notification to this user.
export async function sendTestReminder() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('לא מחובר')
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reminders`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ test: true }),
  })
  if (!res.ok) throw new Error('שליחת הבדיקה נכשלה')
  return res.json()
}
