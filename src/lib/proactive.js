import { supabase } from './supabase'
import { callCoach, buildSystemPrompt } from './coach'
import { weekKeyDate } from './constants'

// Once per week, have the coach proactively post a weekly review + next-week
// plan (or a gentle check-in if nothing was logged). Runs on app open.
// Returns { posted: boolean }.
export async function runProactiveCheck({ user, profile, weeklyKm }) {
  if (!user || !profile) return { posted: false }

  const thisWeek = weekKeyDate(0)
  if (profile.last_weekly_summary === thisWeek) return { posted: false }

  // Pull the last 4 weeks for context
  const since = new Date()
  since.setDate(since.getDate() - 28)
  const { data: updates } = await supabase
    .from('daily_updates')
    .select('distance_km, pace, avg_hr, fatigue, pain, feel, actual_type, free_note, created_at')
    .eq('user_id', user.id)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })
  const history = updates || []

  // Runs in the previous calendar week (the one we're summarizing)
  const lastWeekStart = new Date(weekKeyDate(-1))
  const lastWeekEnd = new Date(weekKeyDate(0))
  const lastWeekRuns = history.filter(u => {
    const d = new Date(u.created_at)
    return d >= lastWeekStart && d < lastWeekEnd
  })

  const instruction = lastWeekRuns.length
    ? `(הודעה יזומה — תחילת שבוע) צור סיכום שבועי קצר של השבוע שעבר: מה בלט (נפח, מגמות, עייפות/כאב אם רלוונטי), ואז תוכנית לשבוע הקרוב בפורמט הימים הרגיל. פתח במשפט אישי קצר, בלי "שלום".`
    : `(הודעה יזומה — תחילת שבוע) הספורטאי לא תיעד ריצות בשבוע שעבר. כתוב צ'ק-אין קצר, אנושי ולא שיפוטי — שאל מה שלומו ואם הכל בסדר, והצע התחלה קלה לשבוע הקרוב (יום + מרחק + קצב). קצר.`

  const system = buildSystemPrompt(profile, weeklyKm, history, profile.coach_memory || '')

  let reply
  try {
    reply = await callCoach([{ role: 'user', content: instruction }], system)
  } catch {
    return { posted: false }
  }
  if (!reply) return { posted: false }

  // Store only the coach's message (the instruction stays hidden)
  await supabase.from('chat_messages').insert({ user_id: user.id, role: 'assistant', content: reply })
  await supabase.from('profiles').update({ last_weekly_summary: thisWeek }).eq('id', user.id)

  return { posted: true }
}
