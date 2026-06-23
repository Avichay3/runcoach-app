import { supabase } from './supabase'
import { callCoach, buildSystemPrompt } from './coach'
import { FEEL_LABELS, localYMD } from './constants'

// Proactive per-run feedback: after a Strava sync, the coach comments on any
// genuinely new run. Runs on app open. Returns { posted: 0 | 1 }.
export async function runPerRunFeedback({ user, profile, weeklyKm }) {
  if (!user || !profile) return { posted: 0 }

  const { data: uncoached } = await supabase
    .from('daily_updates')
    .select('id, update_date, distance_km, pace, avg_hr, max_hr, fatigue, pain, feel, actual_type, free_note, time_text')
    .eq('user_id', user.id)
    .eq('coached', false)
    .order('update_date', { ascending: false })
    .limit(50)

  if (!uncoached || !uncoached.length) return { posted: 0 }

  // Only comment on runs from the last couple of days — so connecting Strava
  // and back-filling weeks of history doesn't trigger a flood of messages.
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 2)
  const cutoffYMD = localYMD(cutoff)
  const recent = uncoached.filter(r => (r.update_date || '') >= cutoffYMD).slice(0, 3)

  let posted = 0
  if (recent.length) {
    const { data: history } = await supabase
      .from('daily_updates')
      .select('distance_km, pace, avg_hr, fatigue, pain, feel, actual_type, free_note, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    const runLines = recent.map(formatRun).join('\n')
    const instruction = recent.length === 1
      ? `(הודעה יזומה — ריצה חדשה נכנסה מ-Strava) הספורטאי בדיוק סיים ריצה. הגב עליה מיוזמתך, קצר ואנושי: מה בלט, איך הקצב/דופק מול אזורי הקצב שלו, ותגובה כנה (לא שבח גנרי). אם יש משהו לשים לב אליו (עומס, כאב, קצב מהיר מדי בריצה קלה) — ציין בעדינות. פתח ישר לעניין, בלי "שלום". עד 3 פסקאות קצרות. הריצה:\n${runLines}`
      : `(הודעה יזומה — ${recent.length} ריצות חדשות נכנסו מ-Strava) הגב עליהן יחד מיוזמתך, קצר ואנושי: מה המגמה, מה בלט, ותגובה כנה. פתח ישר לעניין. עד 3 פסקאות קצרות. הריצות:\n${runLines}`

    const system = buildSystemPrompt(profile, weeklyKm, history || [], profile.coach_memory || '')
    try {
      const reply = await callCoach([{ role: 'user', content: instruction }], system)
      if (reply) {
        await supabase.from('chat_messages').insert({ user_id: user.id, role: 'assistant', content: reply })
        posted = 1
      }
    } catch { /* best-effort — never block the app */ }
  }

  // Clear the whole backlog so we never re-comment, and an older back-fill
  // (no recent runs) is silently marked done without any message.
  await supabase.from('daily_updates').update({ coached: true }).eq('user_id', user.id).eq('coached', false)

  return { posted }
}

function formatRun(r) {
  const parts = []
  if (r.update_date) parts.push(r.update_date)
  if (r.distance_km) parts.push(`${r.distance_km} ק"מ`)
  if (r.time_text) parts.push(r.time_text)
  if (r.pace) parts.push(`${r.pace} דק/ק"מ`)
  if (r.avg_hr) parts.push(`דופק ממוצע ${r.avg_hr}`)
  if (r.max_hr) parts.push(`דופק מקס ${r.max_hr}`)
  if (r.fatigue) parts.push(`עייפות ${r.fatigue}/10`)
  if (r.pain > 0) parts.push(`כאב ${r.pain}/10`)
  if (r.feel) parts.push(`תחושה ${FEEL_LABELS[r.feel] || r.feel}`)
  if (r.actual_type && r.actual_type !== 'כמתוכנן') parts.push(r.actual_type)
  if (r.free_note) parts.push(`"${r.free_note}"`)
  return '- ' + parts.join(' · ')
}
