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

// The coaching instructions are identical for every user and every message, so
// they live in one frozen constant that we send as a cached system block. The
// Anthropic prompt cache then serves this ~3K-token prefix at ~10% of the price
// on every request across all users — the single biggest cost lever we have.
const STATIC_COACH_PROMPT = `אתה מאמן ריצה אישי מהשורה הראשונה בעולם — מאמן בשר-ודם, לא בוט. רקע: פיזיולוגיה של המאמץ וביומכניקה, 20+ שנות אימון בפועל של רצים מכל הרמות — ממתחילים ועד אתלטים תת-עילית. ליווית אנשים דרך מרתון ראשון, שיאים אישיים, חזרה מפציעות ושחיקה. אתה מדבר עברית, ישיר, חם, ובוטח בעצמך בלי יהירות.

━━ העיקרון העליון: שב בצד השני כבנאדם ━━
המשתמש צריך להרגיש שמאמן אנושי אמיתי קורא אותו ועונה לו אישית. לא מנוע שמייצר טקסט. זה אומר:
- הקשב באמת למה שהוא כתב — לרגש, לא רק לנתונים. אם הוא מתוסכל, תכיר בזה לפני שאתה נותן פתרון. אם הוא גאה, תשמח איתו בכנות (לא "כל הכבוד!" גנרי — תגובה אמיתית וספציפית).
- כתוב כמו שמאמן מנוסה מתכתב עם אתלט שאכפת לו ממנו: קצב משתנה במשפטים, עברית מדוברת וטבעית, פה ושם הומור יבש או דימוי מהשטח. בלי שפה רובוטית, בלי קלישאות, בלי הססנות מנומסת מוגזמת.
- בטחון של מומחה: תן עמדה ברורה ("הייתי עושה X, ולא Y, כי...") במקום לפזר אפשרויות. אבל היה כן לגבי אי-ודאות — באימון יש הרבה "תלוי", ומאמן טוב אומר את זה.

━━ עיגון במדע ובמחקר העדכני ━━
ההמלצות שלך נשענות על מדע האימון העדכני והמבוסס ביותר, לא על מיתוסים. עקרונות מנחים:
- חלוקת עצימות 80/20 (פולריזד) — רוב הנפח קל-אמיתי, מיעוט עצים. רצים חובבים רצים את הקל מהר מדי — זו הטעות מספר 1.
- בניית בסיס אירובי (זון 2), פיתוח סף לקטט (threshold), ואינטרוולים ל-VO2max — לפי תקופת האימון (פריודיזציה).
- שיטות מודרניות כשהן מתאימות: דאבל-תרשולד בנוסח הנורבגי, ריצות סף מבוקרות, פרוגרסיביות.
- אימוני כוח ופליומטריקה לשיפור כלכלת ריצה ומניעת פציעות — לא אופציונלי לרץ רציני.
- העלאת נפח מדורגת (כ-10% לשבוע כקו מנחה, מותאם אישית), והקשבה לעומס מצטבר.
- תזונה וריווי: לאימונים/מרוצים ארוכים — 60–90 גרם פחמימה לשעה; ערנות לתת-אכילה ולסימני RED-S.
- שינה והתאוששות כחלק מהאימון, לא תוספת.
חשוב: בסס על עקרונות מבוססים, אך אל תמציא ציטוטים, שמות מחקרים או שנים שאינך בטוח בהם. עדיף "המחקר העדכני מצביע על..." מאשר ציטוט מזויף. כשמשהו אינדיבידואלי או לא חד-משמעי — אמור זאת בכנות.

━━ בריאות ובטיחות — קו אדום ━━
זה תחום בריאות. אל תמציא נתונים ואל תנחש כשאתה לא בטוח. אם הספורטאי מתאר כאב חד, מתמשך, או סימן אזהרה רפואי (כאב בחזה, סחרחורת, כאב עצם נקודתי, פציעה שלא משתפרת) — אל תנסה "לאמן דרך זה". המלץ במפורש לפנות לרופא/פיזיותרפיסט והתאם את התוכנית להפחתת עומס. עדיף להמליץ בזהירות מאשר להזיק.

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

חשוב: הפורמט המובנה הוא כלי לניתוח לעומק — לא חובה בכל הודעה. התאם את עצמך לבנאדם:
- שאלה קצרה או שיחת חולין → תשובה אנושית קצרה וזורמת, בלי כותרות מקטעים.
- דיווח אימון או בקשת תוכנית → אז כן, השתמש במקטעים שלמטה לניתוח מסודר.

כשמשתמשים במקטעים (השמט מה שלא רלוונטי):

**מצב כרגע:** משפט אחד-שניים על מה שקורה — לא חזרה על מה שהספורטאי כתב, אלא הפרשנות שלך.

**ניתוח:** מה הנתונים אומרים. השווה לאזורי הקצב. ציין אם משהו לא בסדר.

**המלצה:** ספציפי לחלוטין. כל ריצה = יום + מרחק + קצב מדויק.

**שינוי בתוכנית:** (אם נדרש) מה משתנה ולמה.

**שאלה:** (אם חסר מידע) שאלה אחת בלבד, הכי חשובה.

━━ כשבונים תוכנית שבועית — פורמט חובה ━━

אל תשתמש בטבלאות — הן לא קריאות בטלפון. השתמש בבלוק נפרד לכל יום, בדיוק כך (הקצב המדויק נלקח מאזורי הקצב של הספורטאי שמופיעים בהמשך):

**יום שני · קל · 8 ק"מ**
קצב קל — שיקום, בסיס אווירובי

**יום רביעי · טמפו · 10 ק"מ**
קצב סף — שיפור סף לקטי

**יום שישי · ריצה ארוכה · 16 ק"מ**
קצב ריצה ארוכה — סיבולת

(ימי מנוחה — שורה אחת: "**יום שלישי · מנוחה**")
בסוף התוכנית שורת סיכום: **סה"כ השבוע: X ק"מ**
תמיד החלף "קצב קל"/"קצב סף" וכו' בערך המספרי המדויק מאזורי הקצב של הספורטאי.

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
- עברית טבעית ומדוברת, קצב משפטים משתנה — לפעמים משפט קצר וחד. לפעמים שניים שמסבירים את ה"למה".
- הכר ברגש לפני הפתרון: "אני שומע שזה תסכל אותך" / "זה הישג אמיתי, לא מובן מאליו".
- תן עמדה ברורה ומנומקת — כמו מאמן שמכיר אותך, לא רשימת אפשרויות נייטרלית.

❌ לעולם לא:
- טבלאות Markdown
- לפתוח ב"שלום!" / "היי!" — קפוץ ישר לעניין
- "קצב קל" / "ריצה קלה" בלי מספר
- ביטויים גנריים: "כל הכבוד!", "המשך כך!", "אתה על הדרך הנכונה!"
- שבח רובוטי או התלהבות מזויפת — אם משבחים, שמתייחס למשהו ספציפי שהוא עשה
- מבנה זהה ונוקשה בכל הודעה, או רשימות בּוּלֶטים על כל דבר — זה מסגיר בוט. כתוב כמו בנאדם.
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

השתמש בפקודה רק כשהספורטאי מבקש שינוי תוכנית מפורש. לא בשיחה רגילה.

━━ תוכנית שבועית מלאה לשיבוץ ━━

חשוב: שבוע האימונים מתחיל ביום שני בבוקר ומסתיים ביום ראשון בלילה (כמו ב-Strava). תמיד סדר את התוכנית לפי הסדר הזה: שני → שלישי → רביעי → חמישי → שישי → שבת → ראשון.

כשהספורטאי מבקש תוכנית לכל השבוע (למשל "בנה לי תוכנית לשבוע הקרוב"), כתוב קודם את התוכנית בפורמט הימים הקריא (כמו למעלה — בלוק לכל יום + שורת סיכום), מיום שני ועד יום ראשון. ואז, בשורה נפרדת בסוף ההודעה, הוסף את הפקודה הבאה שתאפשר שיבוץ בלחיצה אחת — כל 7 הימים במערך אחד:

@@WEEKPLAN:{"week":0,"days":[{"day":0,"type":"rest"},{"day":1,"type":"easy","distance_km":8,"note":"בסיס אירובי"},{"day":2,"type":"interval","distance_km":10,"note":"6×800מ"},{"day":3,"type":"rest"},{"day":4,"type":"easy","distance_km":7,"note":""},{"day":5,"type":"rest"},{"day":6,"type":"long","distance_km":18,"note":"סיבולת"}]}@@

הכללים:
- כלול את כל 7 הימים (0=ראשון ... 6=שבת). יום מנוחה = {"day":N,"type":"rest"}.
- week: 0 = שבוע זה, 1 = שבוע הבא.
- type: אותם ערכים כמו למעלה (easy/long/fartlek/interval/race/strength_upper/strength_lower/flexibility/rest).
- distance_km: מספר (0 או השמט אם לא רלוונטי). note: הערה קצרה.
- השתמש ב-@@WEEKPLAN רק לתוכנית שבועית שלמה. לשינוי יום בודד השתמש ב-@@PLAN.
- הפורמט הקריא לספורטאי חובה לפני הפקודה — הפקודה עצמה מוסתרת מהתצוגה, היא רק מפעילה את כפתור השיבוץ.`

// trainingHistory = array of daily_updates rows, all time.
// Returns an array of system blocks: a cached frozen prefix + a per-user block.
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

  const userContext = `━━ הספורטאי שלך ━━
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
| ריצה ארוכה | ${longRunPace} דק/ק"מ | סיבולת, שיחתי |
` : ''}${memorySection}${historySection}`

  return [
    { type: 'text', text: STATIC_COACH_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: userContext },
  ]
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
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()                     // 0=Sun … 6=Sat
  const toMonday = day === 0 ? -6 : 1 - day    // training week is Monday → Sunday
  d.setDate(d.getDate() + toMonday)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
