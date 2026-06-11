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

// trainingHistory = array of daily_updates rows, last 28 days
export function buildSystemPrompt(profile, weeklyKm, trainingHistory = []) {
  if (!profile) {
    return `You are an elite running coach with 20+ years of experience. Reply ONLY in Hebrew. Be direct, warm, and practical.`
  }

  const pb5k = profile.pb_5k
  const paceZones = pb5k ? derivePaceZones(pb5k) : null
  const historySection = trainingHistory.length ? buildHistorySection(trainingHistory) : ''

  return `You are an elite running coach with 20+ years of experience coaching runners from beginners to sub-3h marathoners. You combine the methodologies of Jack Daniels, Hal Higdon, and Matt Fitzgerald. Reply ONLY in Hebrew. Be direct, warm, specific, and data-driven. Max 180 words per reply.

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
━━ אזורי טמפו (לפי שיא 5K) ━━
קל (Zone 1-2): ${paceZones.easy} דק/ק"מ
סף (Threshold): ${paceZones.threshold} דק/ק"מ
אינטרוולים (VO2max): ${paceZones.interval} דק/ק"מ
` : ''}${historySection}
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

// ── Training history section ──────────────────────────────

function buildHistorySection(updates) {
  const sorted = [...updates].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const now = new Date()

  // ATL = total km last 7 days
  const last7 = sorted.filter(u => (now - new Date(u.created_at)) <= 7 * 86400000)
  const atl = last7.reduce((s, u) => s + (Number(u.distance_km) || 0), 0)

  // CTL = weekly average over last 42 days (standard base)
  const last42 = sorted.filter(u => (now - new Date(u.created_at)) <= 42 * 86400000)
  const ctl = last42.reduce((s, u) => s + (Number(u.distance_km) || 0), 0) / 6

  const tsb = Math.round((ctl - atl) * 10) / 10
  let tsbLabel
  if (tsb > 10) tsbLabel = '✅ רענן, מוכן לעומס'
  else if (tsb > 0) tsbLabel = '⚡ כוננות טובה'
  else if (tsb > -10) tsbLabel = '⚠️ עייפות קלה'
  else tsbLabel = '🔴 עייפות גבוהה — שקול הפחתה'

  // Group ALL runs by week
  const byWeek = {}
  sorted.forEach(u => {
    const k = getWeekStart(new Date(u.created_at))
    if (!byWeek[k]) byWeek[k] = []
    byWeek[k].push(u)
  })
  const weekEntries = Object.entries(byWeek).sort(([a], [b]) => a.localeCompare(b))

  // All-time personal bests from data
  const allKmValues = sorted.map(u => Number(u.distance_km) || 0).filter(v => v > 0)
  const longestRun = allKmValues.length ? Math.max(...allKmValues) : null
  const bestWeekKm = weekEntries.length
    ? Math.max(...weekEntries.map(([, runs]) => runs.reduce((s, u) => s + (Number(u.distance_km) || 0), 0)))
    : null
  const allPaces = sorted.map(u => u.pace).filter(Boolean).map(p => {
    const [m, s] = p.split(':').map(Number)
    return isNaN(m) || isNaN(s) ? null : m * 60 + s
  }).filter(Boolean)
  const fastestPaceSec = allPaces.length ? Math.min(...allPaces) : null
  const fastestPace = fastestPaceSec
    ? `${Math.floor(fastestPaceSec / 60)}:${String(fastestPaceSec % 60).padStart(2, '0')}`
    : null

  const bests = [
    longestRun ? `ריצה הארוכה ביותר: ${longestRun}ק"מ` : null,
    bestWeekKm ? `שבוע שיא: ${Math.round(bestWeekKm * 10) / 10}ק"מ` : null,
    fastestPace ? `טמפו מהיר ביותר: ${fastestPace} דק/ק"מ` : null,
    `סה"כ ריצות מאז תחילת האימונים: ${sorted.length}`,
    `סה"כ ק"מ: ${Math.round(sorted.reduce((s, u) => s + (Number(u.distance_km) || 0), 0) * 10) / 10}ק"מ`,
  ].filter(Boolean).join(' | ')

  // All weekly summaries (compact — one line each)
  const weekSummaries = weekEntries.map(([weekStart, runs]) => {
    const km = runs.reduce((s, u) => s + (Number(u.distance_km) || 0), 0)
    const fatArr = runs.map(u => u.fatigue).filter(Boolean)
    const avgFatigue = fatArr.length ? (fatArr.reduce((s, v) => s + v, 0) / fatArr.length).toFixed(1) : '—'
    const d = new Date(weekStart)
    const label = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`
    return `  ${label}: ${runs.length}x ${Math.round(km * 10) / 10}ק"מ עייפות ${avgFatigue}`
  }).join('\n')

  // Last 14 runs in detail
  const recentRuns = sorted.slice(-14).reverse().map(u => {
    const d = new Date(u.created_at)
    const dl = `${d.getDate()}/${d.getMonth() + 1}`
    const parts = [dl]
    if (u.distance_km) parts.push(`${u.distance_km}ק"מ`)
    if (u.pace) parts.push(`${u.pace} דק/ק"מ`)
    if (u.avg_hr) parts.push(`דופק ${u.avg_hr}`)
    if (u.fatigue) parts.push(`עייפות ${u.fatigue}/10`)
    if (u.pain > 0) parts.push(`⚠️כאב ${u.pain}/10`)
    if (u.feel) parts.push(`תחושה ${u.feel}/5`)
    if (u.actual_type && u.actual_type !== 'כמתוכנן') parts.push(`(${u.actual_type})`)
    if (u.free_note) parts.push(`"${u.free_note.slice(0, 50)}"`)
    return `  ${parts.join(' | ')}`
  }).join('\n')

  // Alerts
  let alerts = ''
  const painRuns = last7.filter(u => u.pain >= 5)
  const highFatigueRuns = last7.filter(u => u.fatigue >= 8)
  if (painRuns.length > 0) alerts += `\n🚨 התראה: כאב ≥5 ב-${painRuns.length} ריצה/ות מ-7 ימים האחרונים — חשוב לשאול!`
  if (highFatigueRuns.length >= 3) alerts += `\n🚨 עייפות גבוהה (≥8) ב-${highFatigueRuns.length} ריצות אחרונות — בדוק עומס יתר.`
  if (weekEntries.length >= 2) {
    const prevKm = weekEntries[weekEntries.length - 2][1].reduce((s, u) => s + (Number(u.distance_km) || 0), 0)
    const thisKm = weekEntries[weekEntries.length - 1][1].reduce((s, u) => s + (Number(u.distance_km) || 0), 0)
    if (prevKm > 0 && thisKm / prevKm > 1.15) {
      alerts += `\n⚠️ עלייה של ${Math.round((thisKm / prevKm - 1) * 100)}% בנפח השבוע — מעל כלל ה-10%.`
    }
  }

  return `
━━ שיאים אישיים (מהנתונים) ━━
${bests || '  (אין נתונים עדיין)'}

━━ היסטוריה מלאה — סיכום שבועי ━━
${weekSummaries || '  (אין נתונים עדיין)'}

━━ 14 ריצות אחרונות — פירוט ━━
${recentRuns || '  (אין נתונים עדיין)'}

━━ מדדי עומס אימון ━━
ATL 7 ימים: ${Math.round(atl * 10) / 10}ק"מ | CTL ממוצע שבועי (42 יום): ${Math.round(ctl * 10) / 10}ק"מ | TSB: ${tsb} → ${tsbLabel}${alerts}
`
}

function getWeekStart(date) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

// ── Pace zone calculator ──────────────────────────────

function derivePaceZones(pb5k) {
  try {
    const [min, sec] = pb5k.split(':').map(Number)
    if (isNaN(min) || isNaN(sec)) return null
    const totalSec = min * 60 + sec
    const perKmSec = totalSec / 5
    return {
      easy: formatPace(perKmSec * 1.35),
      threshold: formatPace(perKmSec * 1.08),
      interval: formatPace(perKmSec * 0.98),
    }
  } catch {
    return null
  }
}

function formatPace(totalSec) {
  const m = Math.floor(totalSec / 60)
  const s = Math.round(totalSec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
