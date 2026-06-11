export const WORKOUT_TYPES = {
  easy:     { label: 'ריצה קלה',   bg: 'var(--teal-l)',   text: 'var(--teal-d)',   border: 'var(--teal)' },
  tempo:    { label: 'טמפו',        bg: 'var(--amber-l)',  text: 'var(--amber-d)',  border: 'var(--amber)' },
  interval: { label: 'אינטרוולים', bg: 'var(--coral-l)',  text: 'var(--coral-d)',  border: 'var(--coral)' },
  long:     { label: 'ריצה ארוכה', bg: 'var(--blue-l)',   text: 'var(--blue-d)',   border: 'var(--blue)' },
  recovery: { label: 'שחזור',       bg: 'var(--surface2)', text: 'var(--text2)',    border: 'var(--border2)' },
  strength: { label: 'כוח',         bg: 'var(--purple-l)', text: 'var(--purple-d)', border: 'var(--purple)' },
  race:     { label: 'תחרות',       bg: 'var(--red-l)',    text: 'var(--red-d)',    border: 'var(--red)' },
}

export const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
export const REST_DEFAULT = [6]
export const FEEL_LABELS = ['', 'גרוע', 'קשה', 'סביר', 'טוב', 'מעולה']

export function weekKeyDate(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay() + offset * 7)
  return d.toISOString().slice(0, 10)
}

export function weekDates(offset = 0) {
  const arr = []
  const d = new Date()
  d.setDate(d.getDate() - d.getDay() + offset * 7)
  for (let i = 0; i < 7; i++) {
    const x = new Date(d)
    x.setDate(d.getDate() + i)
    arr.push(x)
  }
  return arr
}
