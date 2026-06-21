import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { supabase } from './supabase'
import { weekKeyDate } from './constants'

// True only inside the Capacitor Android/iOS app (not the website).
export function isNative() {
  return Capacitor.isNativePlatform()
}

const TYPE_LABELS = {
  easy: 'ריצה קלה', long: 'ריצה ארוכה', fartlek: 'פארטלק', interval: 'אינטרוואלים',
  race: 'תחרות / מרוץ', strength_upper: 'כוח פלג גוף עליון', strength_lower: 'כוח פלג גוף תחתון', flexibility: 'גמישות',
}

const DAYS_AHEAD = 30
const BASE_ID = 1000   // scheduled reminders use ids 1000..1000+DAYS_AHEAD
const TEST_ID = 999

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function nativePermissionGranted() {
  const p = await LocalNotifications.checkPermissions()
  return p.display === 'granted'
}

export async function enableNativeReminders(userId, time) {
  const p = await LocalNotifications.requestPermissions()
  if (p.display !== 'granted') throw new Error('לא ניתנה הרשאה להתראות במכשיר')
  await scheduleNativeReminders(userId, time)
  return true
}

export async function disableNativeReminders() {
  const pending = await LocalNotifications.getPending()
  const ours = (pending.notifications || []).filter(n => n.id >= BASE_ID && n.id <= BASE_ID + DAYS_AHEAD)
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map(n => ({ id: n.id })) })
}

// Build the next 30 daily reminders with each day's actual workout text.
// Re-run whenever the app opens or the time changes.
export async function scheduleNativeReminders(userId, time) {
  await disableNativeReminders()

  const [h, m] = (time || '07:00').split(':').map(Number)
  const byDate = await loadUpcomingWorkouts(userId)

  const now = new Date()
  const notifications = []
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    d.setHours(h || 7, m || 0, 0, 0)
    if (d <= now) continue   // skip a time that already passed today
    const body = byDate[dateKey(d)] || 'אין אימון מתוכנן להיום — יום מנוחה 😌'
    notifications.push({
      id: BASE_ID + i,
      title: 'תזכורת אימון 🏃',
      body,
      schedule: { at: d, allowWhileIdle: true },
    })
  }
  if (notifications.length) await LocalNotifications.schedule({ notifications })
}

export async function sendNativeTest() {
  await LocalNotifications.schedule({
    notifications: [{
      id: TEST_ID,
      title: 'בדיקה 🔔',
      body: 'מעולה! ההתראות עובדות במכשיר הזה.',
      schedule: { at: new Date(Date.now() + 3000) },
    }],
  })
}

// Map of 'YYYY-MM-DD' -> reminder text, for this week + next 4 weeks.
async function loadUpcomingWorkouts(userId) {
  const map = {}
  const weekStarts = []
  for (let w = 0; w < 5; w++) weekStarts.push(weekKeyDate(w))

  const { data: plans } = await supabase
    .from('training_plans').select('id, week_start')
    .eq('user_id', userId).in('week_start', weekStarts)
  if (!plans || !plans.length) return map

  const { data: wkts } = await supabase
    .from('workouts').select('plan_id, day_of_week, type, distance_km, note')
    .in('plan_id', plans.map(p => p.id))
  const weekStartByPlan = Object.fromEntries(plans.map(p => [p.id, p.week_start]))

  for (const w of wkts || []) {
    const ws = weekStartByPlan[w.plan_id]
    if (!ws) continue
    const d = new Date(ws + 'T00:00:00')
    d.setDate(d.getDate() + w.day_of_week)
    const label = TYPE_LABELS[w.type] || w.type
    let text = `היום: ${label}`
    if (w.distance_km) text += ` · ${w.distance_km} ק"מ`
    if (w.note) text += ` — ${w.note}`
    map[dateKey(d)] = text
  }
  return map
}
