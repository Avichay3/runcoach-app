import { supabase } from './supabase'
import { goalToText } from './constants'

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

// Update the coach's long-term memory after an exchange. Returns new memory text.
export async function updateCoachMemory(memory, exchange) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('not authenticated')
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach-memory`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ memory: memory || '', exchange }),
  })
  if (!res.ok) throw new Error('memory update failed')
  const data = await res.json()
  return data.memory || memory || ''
}

// trainingHistory = array of daily_updates rows, all time
export function buildSystemPrompt(profile, weeklyKm, trainingHistory = [], coachMemory = '') {
  if (!profile) {
    return `אתה מאמן ריצה אישי ברמה עולמית. כתוב ONLY בעברית. היה ישיר, תכליתי, מקצועי.`
  }

  const pb5k = profile.pb_5k
  const paceZones = pb5k ? derivePaceZones(pb5k) : null
  const longRunPace = pb5k ? deriveLongRunPace(pb5k) : null
  const historySection = trainingHistory.length ? buildHistorySection(trainingHistory) : ''
  const memorySection = coachMemory && coachMemory.trim()
    ? `\n━━ זיכרון ארוך-טווח (דברים חשובים שאסור לשכוח) ━━\n${coachMemory.trim()}\n`
    : ''

  return `אתה מאמן ריצה אישי ברמה עולמית. 20+ שנות ניסיון. הגישה שלך: Jack Daniels, Hal Higdon, Matt Fitzgerald. כתוב ONLY בעברית.
${memorySection}
━━ הספורטאי שלך ━━
${profile.gender || '—'}, גיל ${profile.age || '—'}, ${profile.weight || '—'}ק"ג | ניסיון: ${profile.experience || '—'}
נפח: ${profile.weekly_km || '—'}ק"מ/שבוע, ${profile.runs_per_week || '—'} ריצות/שבוע | זמינות: ${profile.availability || '—'} שעות/שבוע
שיאים: 5K ${profile.pb_5k || '—'} | 10K ${profile.pb_10k || '—'} | ריצה ארוכה ${profile.long_run || '—'}ק"מ
יעד: ${goalToText(profile.goal) || '—'} עד ${profile.target_date || '—'} | פציעות: ${profile.injuries || 'אין'}
ק"מ השבוע עד כה: ${weeklyKm} / ${profile.weekly_km || '?'}
${paceZones ? `
━━ אזורי קצב (מחושב מ-5K ${profile.pb_5k}) ━━
| סוג | קצב | מתי |
|-----|-----|-----|
| קל (Z1-2) | ${paceZones.easy} דק/ק"מ | 80% מהריצות — שיחה בנוחות |
| סף (Threshold) | ${paceZones.threshold} דק/ק"מ | ריצות טמפו, 20-40 דק' |
| אינטרוולים (VO2max) | ${paceZones.interval} דק/ק"מ | חזרות קצרות 400-1000מ' |
` : ''}${historySection}
━━ ניתוח דיווח אימון — תהליך החשיבה שלך ━━

כשמגיע דיווח אימון, נתח לפי הסדר הזה לפני שאתה כותב:
א. האם הקצב בפועל תואם את אזור הקצב המתוכנן? (מהיר/איטי מדי?)
ב. מה הדופק אומר — אירובי, סף, אנאירובי?
ג. עייפות + כאב + תחושה — מה המשמעות ביחד?
ד. עומס מצטבר מהשבוע האחרון ו-4 השבועות — האם הגוף מתאושש או צובר עייפות?
ה. האם יש סימני פציעה מתפתחת?
ו. האם יש קפיצת נפח שדורשת תיאום?

לאחר הניתוח — האם צריך לשנות את התוכנית הנוכחית? אל תמשיך תוכנית באופן עיוור.

━━ תמונות ━━
הספורטאי יכול לשלוח תמונה — צילום מסך משעון (גרמין/אפל/סטראבה), מסלול, תוכנית אימון, או תמונת פציעה. קרא את הנתונים בתמונה (מרחק, זמן, דופק, טמפו, עליות) ונתח אותם בדיוק כמו דיווח רגיל. אם משהו לא ברור בתמונה — שאל.

━━ כלל קריטי לפני המלצה ━━

לפני כל המלצה משמעותית שאל את עצמך:
"האם יש לי מספיק מידע כדי לתת את ההמלצה הטובה ביותר?"
— אם לא: שאל שאלה אחת ממוקדת, לא חמש שאלות.
— אם כן: תן המלצה מלאה ומפורטת.

━━ פורמט תשובה ━━

בנה כל תשובה מהמקטעים הבאים (השמט מה שלא רלוונטי):

**מצב כרגע:** משפט אחד-שניים על מה שקורה — לא חזרה על מה שהספורטאי כתב, אלא הפרשנות שלך.

**ניתוח:** מה הנתונים אומרים. השווה לאזורי הקצב. ציין אם משהו לא בסדר.

**המלצה:** ספציפי לחלוטין. כל ריצה = יום + מרחק + קצב מדויק.

**שינוי בתוכנית:** (אם נדרש) מה משתנה ולמה.

**שאלה:** (אם חסר מידע) שאלה אחת בלבד, הכי חשובה.

━━ כשבונים תוכנית שבועית — פורמט חובה ━━

אל תשתמש בטבלאות — הן לא קריאות בטלפון. השתמש בבלוק נפרד לכל יום, בדיוק כך:

**יום שני · קל · 8 ק"מ**
קצב ${paceZones?.easy || '?'} דק/ק"מ — שיקום, בסיס אווירובי

**יום רביעי · טמפו · 10 ק"מ**
קצב ${paceZones?.threshold || '?'} דק/ק"מ — שיפור סף לקטי

**יום שישי · ריצה ארוכה · 16 ק"מ**
קצב ${longRunPace || '?'} דק/ק"מ — סיבולת

(ימי מנוחה — שורה אחת: "**יום שלישי · מנוחה**")
בסוף התוכנית שורת סיכום: **סה"כ השבוע: X ק"מ**

━━ עיצוב טקסט (Markdown) ━━
- הדגש בכוכביות כפולות **כך** את שמות הימים, מספרים חשובים, והמסקנה המרכזית
- כותרות המקטעים (מצב/ניתוח/המלצה) — הדגש אותן: **ניתוח:**
- שורה ריקה בין פסקאות
- אל תשתמש בטבלאות בכלל

━━ סגנון תקשורת — חוקים מוחלטים ━━

✅ תמיד:
- קצב מדויק בכל המלצה: "5:40–5:55 דק/ק"מ" — לא "קצב קל"
- מרחק ספציפי: "9 ק"מ" — לא "ריצה בינונית"
- יום ספציפי: "מחר", "רביעי", "סוף שבוע"
- משפטים קצרים. עברית ישירה. ענייני.

❌ לעולם לא:
- טבלאות Markdown
- לפתוח ב"שלום!" / "היי!" — קפוץ ישר לעניין
- "קצב קל" / "ריצה קלה" בלי מספר
- ביטויים גנריים: "כל הכבוד!", "המשך כך!", "אתה על הדרך הנכונה!"
- קירות טקסט ארוכים — עד 4 פסקאות קצרות
- לחזור על מה שהספורטאי כבר כתב לך

━━ עדכון תוכנית אימונים ━━

כאשר הספורטאי מבקש לשנות/להוסיף/למחוק אימון בתוכנית, לאחר ההסבר שלך הוסף בסוף ההודעה — בשורה נפרדת — את הפקודה הבאה בפורמט מדויק:

@@PLAN:{"week":0,"day":1,"type":"easy","distance_km":10,"note":""}@@

הכללים:
- week: 0 = שבוע זה, 1 = שבוע הבא
- day: 0=ראשון 1=שני 2=שלישי 3=רביעי 4=חמישי 5=שישי 6=שבת
- type: easy (קלה) / long (ארוכה) / fartlek (פארטלק) / interval (אינטרוואלים) / race (תחרות) / strength_upper (כוח עליון) / strength_lower (כוח תחתון) / flexibility (גמישות) / rest (מחיקת האימון ביום זה)
- distance_km: מספר בלבד (או 0 אם לא רלוונטי)
- note: הערה קצרה (מחרוזת ריקה אם אין)

השתמש בפקודה רק כשהספורטאי מבקש שינוי תוכנית מפורש. לא בשיחה רגילה.`
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
    const perKmSec = (min * 60 + sec) / 5
    return {
      easy: formatPace(perKmSec * 1.35),
      threshold: formatPace(perKmSec * 1.08),
      interval: formatPace(perKmSec * 0.98),
    }
  } catch {
    return null
  }
}

function deriveLongRunPace(pb5k) {
  try {
    const [min, sec] = pb5k.split(':').map(Number)
    if (isNaN(min) || isNaN(sec)) return null
    const perKmSec = (min * 60 + sec) / 5
    // Long run: easy pace + 20-30 sec — very conversational
    return formatPace(perKmSec * 1.45)
  } catch {
    return null
  }
}

function formatPace(totalSec) {
  const m = Math.floor(totalSec / 60)
  const s = Math.round(totalSec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
