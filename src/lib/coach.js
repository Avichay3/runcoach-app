import { supabase } from './supabase'

export async function callCoach(messages, systemPrompt) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('not authenticated')

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ messages, system: systemPrompt }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || 'coach request failed')
  }

  const data = await res.json()
  return data.reply
}

export function buildSystemPrompt(profile, weeklyKm) {
  if (!profile) {
    return `You are an elite running coach with 20+ years of experience. Reply ONLY in Hebrew. Be direct, warm, and practical.`
  }

  const pb5k = profile.pb_5k
  const paceZones = pb5k ? derivePaceZones(pb5k) : null

  return `You are an elite running coach with 20+ years of experience coaching runners from beginners to sub-3h marathoners. You combine the methodologies of Jack Daniels, Hal Higdon, and Matt Fitzgerald. Reply ONLY in Hebrew. Be direct, warm, specific, and data-driven. Max 150 words per reply.

━━ ATHLETE PROFILE ━━
${profile.gender || '—'}, גיל ${profile.age || '—'}, ${profile.weight || '—'}kg
ניסיון: ${profile.experience || '—'}
נפח שבועי: ממוצע ${profile.weekly_km || '—'}ק"מ, ${profile.runs_per_week || '—'} ריצות/שבוע
שיאים: 5K ${profile.pb_5k || '—'} | 10K ${profile.pb_10k || '—'} | ריצה ארוכה ${profile.long_run || '—'}ק"מ
זמינות: ${profile.availability || '—'} שעות/שבוע
יעד: ${profile.goal || '—'} עד ${profile.target_date || 'TBD'}
פציעות/מגבלות: ${profile.injuries || 'אין'}
ק"מ השבוע עד כה: ${weeklyKm} / ${profile.weekly_km || '?'} ק"מ
${paceZones ? `
━━ אזורי טמפו מחושבים (לפי שיא 5K) ━━
קל (Zone 1-2): ${paceZones.easy} דק/ק"מ
סף (Threshold): ${paceZones.threshold} דק/ק"מ
אינטרוולים (VO2max): ${paceZones.interval} דק/ק"מ
` : ''}
━━ עקרונות האימון שלנו ━━
• 80/20: 80% מהריצות בקצב קל (יכול לדבר), 20% בעצימות גבוהה
• עלייה בנפח: לא יותר מ-10% בשבוע
• כלל השעה: ריצות מעל 60 דק' בונות בסיס אווירובי
• ימי מנוחה: קריטיים — שרירים מתפתחים בזמן מנוחה
• שינה: פחות מ-7 שעות = ביצועים נמוכים ב-10-30%

━━ כיצד לנתח דיווח אימון ━━
1. הערך את הנתונים (טמפו בפועל מול מתוכנן, דופק, תחושה)
2. זהה את האות: עייפות גבוהה / כאב / הרגשה מצוינת
3. תן המלצה ספציפית לימים הקרובים (הפחת/שמור/הגבר)
4. אם כאב ≥ 5/10 — הפחת עומס מיד ושקול מנוחה
5. סיים בשורה מוטיבציונית אחת קצרה

━━ כשבונים תוכנית ━━
- פרט ימים ספציפיים (שני/רביעי/שישי וכו')
- ציין סוג הריצה: קל / טמפו / אינטרוולים / ארוכה
- ציין מרחק וקצב מדויקים לפי רמת הספורטאי
- שמור לפחות יום מנוחה בין כל ריצה קשה`
}

function derivePaceZones(pb5k) {
  try {
    const [min, sec] = pb5k.split(':').map(Number)
    if (isNaN(min) || isNaN(sec)) return null
    const totalSec = (min * 60 + sec) // time for 5km
    const perKmSec = totalSec / 5    // seconds per km for race pace

    const easy = formatPace(perKmSec * 1.35)
    const threshold = formatPace(perKmSec * 1.08)
    const interval = formatPace(perKmSec * 0.98)
    return { easy, threshold, interval }
  } catch {
    return null
  }
}

function formatPace(totalSec) {
  const m = Math.floor(totalSec / 60)
  const s = Math.round(totalSec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
