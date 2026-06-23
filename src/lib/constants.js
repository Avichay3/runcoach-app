export const WORKOUT_TYPES = {
  easy:           { label: 'ריצה קלה',            bg: 'var(--teal-l)',   text: 'var(--teal-d)',   border: 'var(--teal)' },
  long:           { label: 'ארוכה',               bg: 'var(--blue-l)',   text: 'var(--blue-d)',   border: 'var(--blue)' },
  fartlek:        { label: 'פארטלק',              bg: 'var(--amber-l)',  text: 'var(--amber-d)',  border: 'var(--amber)' },
  interval:       { label: 'אינטרוואלים',         bg: 'var(--coral-l)',  text: 'var(--coral-d)',  border: 'var(--coral)' },
  race:           { label: 'תחרות / מרוץ',        bg: 'var(--red-l)',    text: 'var(--red-d)',    border: 'var(--red)' },
  strength_upper: { label: 'כוח — פלג גוף עליון', bg: 'var(--purple-l)', text: 'var(--purple-d)', border: 'var(--purple)' },
  strength_lower: { label: 'כוח — פלג גוף תחתון', bg: 'var(--surface2)', text: 'var(--text2)',    border: 'var(--border2)' },
  flexibility:    { label: 'גמישות',              bg: 'var(--green-l)',  text: 'var(--green-d)',  border: 'var(--green)' },
}

export const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
export const FEEL_LABELS = ['', 'גרוע', 'קשה', 'סביר', 'טוב', 'מעולה']

// Convert a goal value (JSON string or legacy string) to human-readable text
export function goalToText(goalStr) {
  if (!goalStr) return null
  try {
    const g = JSON.parse(goalStr)
    if (!g.type) return goalStr
    if (g.type === 'free') return g.text || ''
    const distPart = g.distance && g.targetTime ? `שיפור ${g.distance} → ${g.targetTime}` : g.distance ? `${g.distance}` : ''
    if (g.type === 'distance') return distPart
    return g.text ? `${distPart} · ${g.text}` : distPart
  } catch {}
  return goalStr
}

// The training week runs Monday → Sunday (matches Strava).
// day_of_week stays JS getDay() convention: 0=Sunday … 6=Saturday.

// Local YYYY-MM-DD (avoids the UTC drift that toISOString would introduce).
export function localYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The Monday that starts the week containing today (+ offset weeks).
function mondayOfWeek(offset = 0) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()                     // 0=Sun … 6=Sat
  const toMonday = day === 0 ? -6 : 1 - day   // Sunday belongs to the week that just ended
  d.setDate(d.getDate() + toMonday + offset * 7)
  return d
}

// week_start key (the Monday) as local YYYY-MM-DD.
export function weekKeyDate(offset = 0) {
  return localYMD(mondayOfWeek(offset))
}

// 7 dates, Monday → Sunday.
export function weekDates(offset = 0) {
  const start = mondayOfWeek(offset)
  const arr = []
  for (let i = 0; i < 7; i++) {
    const x = new Date(start)
    x.setDate(start.getDate() + i)
    arr.push(x)
  }
  return arr
}

// Actual date of a workout from its week_start (Monday) + day_of_week (0=Sun…6=Sat).
export function dateOfWorkout(weekStart, dayOfWeek) {
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() + ((dayOfWeek + 6) % 7))
  return d
}

// Rank a day_of_week for Monday→Sunday ordering (Mon=0 … Sun=6).
export function dayOrder(dayOfWeek) {
  return (dayOfWeek + 6) % 7
}
