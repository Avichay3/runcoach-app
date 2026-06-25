import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { weekKeyDate, FEEL_LABELS, goalToText, localYMD } from '../lib/constants'

const CHART_WEEKS = 8

export default function DashboardScreen({ profile, onAsk, onGoProfile }) {
  const { user } = useAuth()
  const [updates, setUpdates] = useState([])
  const [actualKm, setActualKm] = useState(0)        // km actually run this week
  const [runsThisWeek, setRunsThisWeek] = useState(0)
  const [weeklyData, setWeeklyData] = useState([])
  const [loading, setLoading] = useState(true)
  const [checkIn, setCheckIn] = useState(null)   // the run being checked in
  const [addRun, setAddRun] = useState(false)

  useEffect(() => { load() }, [user])

  async function saveCheckIn(id, fields) {
    const { data } = await supabase.from('daily_updates').update(fields).eq('id', id).select().single()
    if (data) setUpdates(prev => prev.map(u => (u.id === id ? data : u)))
    return data
  }

  async function deleteRun(id) {
    await supabase.from('daily_updates').delete().eq('id', id)
    load()
  }

  async function saveNewRun(fields) {
    const { data } = await supabase.from('daily_updates').insert({
      user_id: user.id,
      source: 'manual',
      coached: false,
      ...fields,
    }).select().single()
    load()
    return data
  }

  function tellCoach(run, fields) {
    const km = run.distance_km ? `${run.distance_km} ק"מ` : 'ריצה'
    const date = (run.update_date || '').split('-').reverse().slice(0, 2).join('/')
    const bits = []
    if (fields.feel) bits.push(`הרגשה ${FEEL_LABELS[fields.feel]}`)
    if (fields.fatigue) bits.push(`מאמץ ${fields.fatigue}/10`)
    if (fields.pain) bits.push(`כאב ${fields.pain}/10`)
    if (fields.sleep_hours) bits.push(`שינה ${fields.sleep_hours} שעות`)
    const note = fields.free_note ? `. ${fields.free_note}` : ''
    onAsk(`רצתי ${km}${date ? ` ב-${date}` : ''}. ${bits.join(', ')}${note}. מה דעתך?`)
  }

  async function load() {
    if (!user) return
    setLoading(true)
    const { data: ups } = await supabase
      .from('daily_updates').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(60)
    const list = ups || []
    setUpdates(list)

    // Build the weekly km chart from actual logged runs (Strava)
    buildWeekly(list)

    // Actual runs in the current Monday→Sunday week (real data, not the plan)
    const weekStart = weekKeyDate(0)
    const nextWeek = weekKeyDate(1)
    const thisWeek = list.filter(u => {
      const d = u.update_date || (u.created_at || '').slice(0, 10)
      return d >= weekStart && d < nextWeek
    })
    setActualKm(Math.round(thisWeek.reduce((s, u) => s + (Number(u.distance_km) || 0), 0) * 10) / 10)
    setRunsThisWeek(thisWeek.length)
    setLoading(false)
  }

  function buildWeekly(ups) {
    const byWeek = {}
    ups.forEach(u => {
      const dateStr = u.update_date || (u.created_at || '').slice(0, 10)
      if (!dateStr) return
      const k = getWeekStart(new Date(dateStr + 'T00:00:00'))
      byWeek[k] = (byWeek[k] || 0) + (Number(u.distance_km) || 0)
    })
    const weeks = []
    for (let i = CHART_WEEKS - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i * 7)
      const key = getWeekStart(d)
      weeks.push({
        label: formatWeekLabel(new Date(key)),
        km: Math.round((byWeek[key] || 0) * 10) / 10,
      })
    }
    setWeeklyData(weeks)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><span className="spinner" /></div>

  if (!profile?.goal) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>🏃</div>
        <div style={styles.emptyTitle}>בוא נתחיל</div>
        <div style={styles.emptySub}>השלם את הפרופיל כדי שהמאמן יכיר אותך ונוכל לעקוב אחר ההתקדמות</div>
        <button className="btn btn-primary" onClick={onGoProfile} style={{ marginTop: 16 }}>למסך הפרופיל ←</button>
      </div>
    )
  }

  const target = Number(profile.weekly_km) || 50
  const kmPct = Math.min(100, Math.round((actualKm / target) * 100))
  const runGoal = Number(profile.runs_per_week) || 0
  const runsPct = runGoal ? Math.min(100, Math.round((runsThisWeek / runGoal) * 100)) : 0
  const daysToGoal = profile.target_date
    ? Math.max(0, Math.ceil((new Date(profile.target_date) - new Date()) / (1000 * 60 * 60 * 24)))
    : '—'

  const goal = computeGoalProgress(profile)
  const maxKm = Math.max(target, ...weeklyData.map(w => w.km), 1)

  // The most recent run (last 2 days) that has no subjective check-in yet
  const cutoffYMD = (() => { const d = new Date(); d.setDate(d.getDate() - 2); return localYMD(d) })()
  const pendingRun = updates.find(u => !u.feel && (u.update_date || (u.created_at || '').slice(0, 10)) >= cutoffYMD)

  return (
    <div>
      {pendingRun && (
        <button style={styles.nudge} onClick={() => setCheckIn(pendingRun)}>
          <span style={styles.nudgeIcon}>👋</span>
          <span style={{ flex: 1, textAlign: 'right' }}>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>איך היתה הריצה?</span>
            <span style={{ display: 'block', fontSize: 12, opacity: .92, marginTop: 1 }}>
              {pendingRun.distance_km ? `${pendingRun.distance_km} ק"מ` : 'ריצה'} · הוסף הרגשה, מאמץ וכאב — המאמן ילמד ממך
            </span>
          </span>
          <span style={{ fontSize: 18 }}>←</span>
        </button>
      )}
      {/* KPI grid */}
      <div style={styles.kpiGrid}>
        <Kpi
          icon={<TrophyIcon />}
          color="var(--teal)"
          colorL="var(--teal-l)"
          label="שיא 5K"
          val={profile.pb_5k || '—'}
          sub={`יעד: ${goalToText(profile.goal) || '—'}`}
        />
        <Kpi
          icon={<RouteIcon />}
          color="var(--blue)"
          colorL="var(--blue-l)"
          label='ק"מ השבוע'
          val={actualKm}
          sub={`יעד: ${target} ק"מ`}
        />
        <Kpi
          icon={<CheckIcon />}
          color="var(--green)"
          colorL="var(--green-l)"
          label="ריצות השבוע"
          val={runGoal ? <>{runsThisWeek}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text3)' }}>/{runGoal}</span></> : runsThisWeek}
          sub="בפועל"
        />
        <Kpi
          icon={<CalIcon />}
          color="var(--purple)"
          colorL="var(--purple-l)"
          label="ימים ליעד"
          val={daysToGoal}
          sub={profile.target_date ? profile.target_date.slice(0, 10) : 'ללא תאריך'}
        />
      </div>

      {/* Goal progress */}
      <div className="card">
        <div className="section-label">המטרה שלי</div>
        <div style={styles.goalHead}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{goalToText(profile.goal) || profile.goal}</div>
            {profile.target_date && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                {daysToGoal} ימים נותרו · {profile.target_date.slice(0, 10)}
              </div>
            )}
          </div>
          {goal.hasMetric && (
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>פער ליעד</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: goal.reached ? 'var(--green)' : 'var(--teal)' }}>
                {goal.reached ? '✓ הושג!' : goal.gapLabel}
              </div>
            </div>
          )}
        </div>
        {goal.hasMetric && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, marginTop: 14, fontSize: 12, color: 'var(--text2)' }}>
              <span>נוכחי: <strong>{goal.currentLabel}</strong></span>
              <span>יעד: <strong>{goal.targetLabel}</strong></span>
            </div>
            <div style={{ height: 9, background: 'var(--surface2)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 5, width: `${goal.pct}%`, background: goal.reached ? 'var(--green)' : 'var(--teal)', transition: 'width .6s ease' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>{goal.hint}</div>
          </>
        )}
        {!goal.hasMetric && profile.target_date && (
          <GoalBar label="התקדמות בזמן" pct={goal.timePct} nums={`${daysToGoal} ימים נותרו`} color="var(--teal)" />
        )}
      </div>

      {/* Weekly progress bars */}
      <div className="card">
        <div className="section-label">התקדמות שבועית</div>
        <GoalBar label='ק"מ שרצתי' pct={kmPct} nums={`${actualKm} / ${target}`} color="var(--teal)" />
        {runGoal > 0 && (
          <GoalBar label="ריצות שביצעתי" pct={runsPct} nums={`${runsThisWeek} / ${runGoal}`} color="var(--blue)" />
        )}
      </div>

      {/* Weekly km chart */}
      <div className="card">
        <div className="section-label">קילומטראז' שבועי — {CHART_WEEKS} שבועות אחרונים</div>
        {weeklyData.some(w => w.km > 0) ? (
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={weeklyData} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text2)' }} axisLine={{ stroke: 'var(--border2)' }} tickLine={false} interval={0} />
              <YAxis
                tick={{ fontSize: 12, fill: 'var(--text2)' }}
                axisLine={false} tickLine={false} width={34}
                domain={[0, Math.ceil(maxKm / 10) * 10]}
                tickFormatter={v => `${v}`}
                label={{ value: 'ק"מ', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--text3)', dy: 20 }}
              />
              <ReferenceLine y={target} stroke="var(--blue)" strokeDasharray="5 4" strokeWidth={1.5}
                label={{ value: `יעד ${target}`, fill: 'var(--blue)', fontSize: 11, position: 'insideTopRight' }} />
              <Tooltip content={<KmTooltip />} cursor={{ fill: 'var(--surface2)', opacity: .5 }} />
              <Bar dataKey="km" fill="var(--teal)" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="km" position="top" fontSize={11} fill="var(--text2)" formatter={v => v > 0 ? v : ''} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, color: 'var(--text3)' }}>
            חבר את Strava כדי לראות את הקילומטראז' השבועי שלך כאן.
          </div>
        )}
      </div>

      {/* Recent updates */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>דיווחים אחרונים</div>
          <button style={styles.addRunBtn} onClick={() => setAddRun(true)}>+ הוסף ריצה</button>
        </div>
        {updates.length > 0 ? updates.slice(0, 8).map(u => {
          const d = new Date(u.update_date || u.created_at)
          const meta = []
          if (u.fatigue) meta.push(`מאמץ ${u.fatigue}/10`)
          if (u.pain) meta.push(`כאב ${u.pain}/10`)
          const isManual = u.source === 'manual'
          return (
            <div key={u.id} style={styles.updateRow}>
              <div style={styles.updateDot}>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke={isManual ? 'var(--blue)' : 'var(--teal)'} strokeWidth="2" strokeLinecap="round">
                  <circle cx="8" cy="8" r="5.5" />
                </svg>
              </div>
              <div style={{ flex: 1, textAlign: 'right', cursor: 'pointer' }} onClick={() => setCheckIn(u)}>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  {u.distance_km ? `${u.distance_km} ק"מ` : 'ריצה'}{u.time_text ? ` · ${u.time_text}` : ''}
                  {u.feel ? ` · ${FEEL_LABELS[u.feel]}` : ''}
                  {isManual && <span style={{ fontSize: 10, color: 'var(--blue)', marginRight: 5, fontWeight: 600 }}>ידני</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  {d.getDate()}/{d.getMonth() + 1}{meta.length ? ` · ${meta.join(' · ')}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {!u.feel && (
                  <span style={styles.addPill} onClick={() => setCheckIn(u)}>הוסף פרטים</span>
                )}
                <button
                  style={styles.deleteBtn}
                  onClick={() => {
                    if (window.confirm('למחוק ריצה זו מהרשימה?')) deleteRun(u.id)
                  }}
                  title="מחק ריצה"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          )
        }) : (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: 'var(--text3)' }}>
            עדיין אין ריצות. הוסף ידנית או חבר Strava.
          </div>
        )}
      </div>

      {/* Quick ask */}
      <div className="card">
        <div className="section-label">שאל את המאמן</div>
        <button
          className="btn btn-block"
          style={styles.askBtn}
          onClick={() => onAsk(`לפי הנתונים שלי, האם אני על מסלול ליעד ${goalToText(profile.goal) || profile.goal}? מה כדאי לשנות?`)}
        >
          <span>האם אני על המסלול ליעד?</span>
          <span style={{ color: 'var(--teal)', fontSize: 16 }}>↗</span>
        </button>
        <button
          className="btn btn-block"
          style={styles.askBtn}
          onClick={() => onAsk('בנה לי תוכנית אימונים מותאמת לשבוע הקרוב')}
        >
          <span>בנה תוכנית לשבוע הקרוב</span>
          <span style={{ color: 'var(--teal)', fontSize: 16 }}>↗</span>
        </button>
      </div>

      {checkIn && (
        <CheckInModal
          run={checkIn}
          onClose={() => setCheckIn(null)}
          onSave={saveCheckIn}
          onTellCoach={tellCoach}
        />
      )}
      {addRun && (
        <AddRunModal
          onClose={() => setAddRun(false)}
          onSave={saveNewRun}
        />
      )}
    </div>
  )
}

function CheckInModal({ run, onClose, onSave, onTellCoach }) {
  const [feel, setFeel] = useState(run.feel || 0)
  const [fatigue, setFatigue] = useState(run.fatigue || 5)
  const [pain, setPain] = useState(run.pain || 0)
  const [sleep, setSleep] = useState(run.sleep_hours ?? '')
  const [note, setNote] = useState(run.free_note || '')
  const [saving, setSaving] = useState(false)

  function fields() {
    return {
      feel: feel || null,
      fatigue: fatigue,
      pain: pain,
      sleep_hours: sleep === '' ? null : Number(sleep),
      free_note: note.trim() || null,
    }
  }

  async function save(thenCoach) {
    setSaving(true)
    const f = fields()
    await onSave(run.id, f)
    setSaving(false)
    if (thenCoach) onTellCoach(run, f)
    onClose()
  }

  const km = run.distance_km ? `${run.distance_km} ק"מ` : 'ריצה'
  const date = (run.update_date || '').split('-').reverse().slice(0, 2).join('/')

  return (
    <div style={ci.bg} onClick={onClose}>
      <div style={ci.modal} onClick={e => e.stopPropagation()}>
        <div style={ci.title}>איך היתה הריצה?</div>
        <div style={ci.sub}>{km}{date ? ` · ${date}` : ''}</div>

        <div style={ci.field}>
          <label style={ci.label}>תחושה כללית</label>
          <div style={ci.chips}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setFeel(n)} style={{ ...ci.chip, ...(feel === n ? ci.chipOn : {}) }}>
                {FEEL_LABELS[n]}
              </button>
            ))}
          </div>
        </div>

        <div style={ci.field}>
          <label style={ci.label}>כמה היה קשה? <strong style={{ color: 'var(--teal)' }}>{fatigue}/10</strong></label>
          <input type="range" min="1" max="10" step="1" value={fatigue} onChange={e => setFatigue(Number(e.target.value))} style={ci.range} />
          <div style={ci.scaleEnds}><span>קל מאוד</span><span>מקסימלי</span></div>
        </div>

        <div style={ci.field}>
          <label style={ci.label}>כאב / אי-נוחות <strong style={{ color: pain >= 5 ? 'var(--red)' : 'var(--teal)' }}>{pain}/10</strong></label>
          <input type="range" min="0" max="10" step="1" value={pain} onChange={e => setPain(Number(e.target.value))} style={ci.range} />
          <div style={ci.scaleEnds}><span>אין</span><span>חזק</span></div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ ...ci.field, flex: 1 }}>
            <label style={ci.label}>שעות שינה</label>
            <input type="number" inputMode="decimal" placeholder="7" value={sleep} onChange={e => setSleep(e.target.value)} style={ci.input} />
          </div>
        </div>

        <div style={ci.field}>
          <label style={ci.label}>הערה (לא חובה)</label>
          <textarea rows={2} placeholder="איך הרגשת, מזג אוויר, כל דבר..." value={note} onChange={e => setNote(e.target.value)} style={ci.input} />
        </div>

        <div style={ci.btns}>
          <button style={ci.btnGhost} onClick={() => save(true)} disabled={saving}>שמור וספר למאמן</button>
          <button style={ci.btnPrimary} onClick={() => save(false)} disabled={saving}>
            {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'שמור'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddRunModal({ onClose, onSave }) {
  const today = localYMD(new Date())
  const [date, setDate] = useState(today)
  const [km, setKm] = useState('')
  const [duration, setDuration] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!km || isNaN(Number(km)) || Number(km) <= 0) { setError('הכנס קילומטראז\' תקין'); return }
    setSaving(true)
    setError('')
    await onSave({
      update_date: date,
      distance_km: Math.round(Number(km) * 100) / 100,
      time_text: duration.trim() || null,
      free_note: note.trim() || null,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div style={ci.bg} onClick={onClose}>
      <div style={ci.modal} onClick={e => e.stopPropagation()}>
        <div style={ci.title}>הוסף ריצה ידנית</div>
        <div style={ci.sub}>הריצה תתווסף לסטטיסטיקה ולדשבורד</div>

        <div style={ci.field}>
          <label style={ci.label}>תאריך</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={ci.input} max={today} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ ...ci.field, flex: 1 }}>
            <label style={ci.label}>מרחק (ק"מ)</label>
            <input type="number" inputMode="decimal" placeholder="10.5" value={km} onChange={e => setKm(e.target.value)} style={ci.input} />
          </div>
          <div style={{ ...ci.field, flex: 1 }}>
            <label style={ci.label}>זמן (לא חובה)</label>
            <input type="text" placeholder="50:30" value={duration} onChange={e => setDuration(e.target.value)} style={ci.input} />
          </div>
        </div>

        <div style={ci.field}>
          <label style={ci.label}>הערה (לא חובה)</label>
          <textarea rows={2} placeholder="סוג ריצה, תחושה כללית..." value={note} onChange={e => setNote(e.target.value)} style={ci.input} />
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

        <div style={ci.btns}>
          <button style={ci.btnGhost} onClick={onClose} disabled={saving}>ביטול</button>
          <button style={ci.btnPrimary} onClick={save} disabled={saving}>
            {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'שמור ריצה'}
          </button>
        </div>
      </div>
    </div>
  )
}

const ci = {
  bg: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 18, backdropFilter: 'blur(4px)' },
  modal: { background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px 18px', width: '100%', maxWidth: 380, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-md)' },
  title: { fontSize: 17, fontWeight: 700 },
  sub: { fontSize: 12.5, color: 'var(--text3)', marginTop: 2, marginBottom: 14 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, color: 'var(--text2)', fontWeight: 500, display: 'block', marginBottom: 7 },
  chips: { display: 'flex', gap: 6 },
  chip: { flex: 1, padding: '8px 2px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  chipOn: { borderColor: 'var(--teal)', background: 'var(--teal-l)', color: 'var(--teal-d)' },
  range: { width: '100%' },
  scaleEnds: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  input: { width: '100%', fontSize: 14, padding: '9px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--radius-sm)', background: 'var(--surface3)', color: 'var(--text)', resize: 'none' },
  btns: { display: 'flex', gap: 8, marginTop: 18 },
  btnGhost: { flex: 1, padding: '11px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--surface2)', color: 'var(--text2)', border: 'none', fontSize: 13, fontWeight: 600 },
  btnPrimary: { padding: '11px 22px', borderRadius: 'var(--radius-sm)', background: 'var(--teal)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' },
}

function computeGoalProgress(profile) {
  const goalStr = profile.goal || ''

  const timePct = (() => {
    if (!profile.target_date) return 0
    const end = new Date(profile.target_date)
    const start = new Date(end); start.setDate(start.getDate() - 90)
    const total = end - start
    const done = new Date() - start
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)))
  })()

  let targetSec = null
  let distKey = null  // '5k' | '10k'

  try {
    const g = JSON.parse(goalStr)
    if ((g.type === 'distance' || g.type === 'both') && g.targetTime && g.distance) {
      if (g.distance === '5K') distKey = '5k'
      else if (g.distance === '10K') distKey = '10k'
      if (distKey) {
        const parts = g.targetTime.split(':').map(Number)
        if (!parts.some(isNaN)) {
          if (parts.length === 3) targetSec = parts[0] * 3600 + parts[1] * 60 + parts[2]
          else if (parts.length === 2) targetSec = parts[0] * 60 + parts[1]
        }
      }
    }
  } catch {
    // Legacy: "Sub-18 ב-5K"
    const m = goalStr.match(/sub[\s-]?(\d+)/i)
    distKey = /10k/i.test(goalStr) ? '10k' : /5k/i.test(goalStr) ? '5k' : null
    if (m && distKey) targetSec = Number(m[1]) * 60
  }

  const pb = distKey === '10k' ? profile.pb_10k : distKey === '5k' ? profile.pb_5k : null

  if (targetSec && distKey && pb) {
    const currentSec = pbToSec(pb)
    if (currentSec) {
      const reached = currentSec <= targetSec
      const gap = currentSec - targetSec
      const startSec = targetSec * 1.12
      const pct = Math.max(0, Math.min(100, Math.round(((startSec - currentSec) / (startSec - targetSec)) * 100)))
      return {
        hasMetric: true, reached,
        currentLabel: pb,
        targetLabel: secToLabel(targetSec),
        gapLabel: reached ? '✓' : secToMs(gap),
        pct: reached ? 100 : pct,
        hint: reached ? 'הגעת ליעד הזמן! 🎉' : `צריך לשפר ${secToMs(gap)} ב-${distKey.toUpperCase()}`,
        timePct,
      }
    }
  }
  return { hasMetric: false, timePct }
}

function pbToSec(pb) {
  if (!pb) return null
  const parts = pb.split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}
function secToLabel(sec) {
  const a = Math.round(sec)
  if (a >= 3600) {
    const h = Math.floor(a / 3600)
    const m = Math.floor((a % 3600) / 60)
    const s = a % 60
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  const m = Math.floor(a / 60)
  const s = a % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
function secToMs(sec) {
  const a = Math.abs(Math.round(sec))
  const m = Math.floor(a / 60)
  const s = (a % 60).toString().padStart(2, '0')
  return m > 0 ? `${m}:${s} דק'` : `${s} שנ'`
}

function getWeekStart(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()                    // 0=Sun … 6=Sat
  const toMonday = day === 0 ? -6 : 1 - day  // week runs Monday → Sunday
  d.setDate(d.getDate() + toMonday)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function formatWeekLabel(date) {
  return `${date.getDate()}/${date.getMonth() + 1}`
}

function KmTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', boxShadow: 'var(--shadow)', fontSize: 13, direction: 'rtl' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>שבוע {label}</div>
      <div style={{ color: 'var(--teal)', fontWeight: 700 }}>{payload[0].value} ק"מ</div>
    </div>
  )
}

function Kpi({ icon, color, colorL, label, val, sub }) {
  return (
    <div style={styles.kpi}>
      <div style={{ ...styles.kpiIcon, background: colorL, color }}>
        {icon}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{val}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{sub}</div>
    </div>
  )
}

function GoalBar({ label, pct, nums, color }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}><span style={{ direction: 'ltr', unicodeBidi: 'isolate', display: 'inline-block' }}>{nums}</span> · <strong style={{ color }}>{pct}%</strong></span>
      </div>
      <div style={{ height: 7, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: color, transition: 'width .6s ease' }} />
      </div>
    </div>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12V15M6 17h6M4 2h10l-1 6a5 5 0 0 1-8 0L4 2z" />
      <path d="M4 4H2l1 4M14 4h2l-1 4" />
    </svg>
  )
}

function RouteIcon() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 15s2-4 4-4 4 4 6 4" /><path d="M3 9s2-4 4-4 4 4 6 4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="7" /><path d="M6 9l2 2 4-4" />
    </svg>
  )
}

function CalIcon() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="14" height="13" rx="2" /><path d="M6 1v4M12 1v4M2 8h14" />
    </svg>
  )
}

const styles = {
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-sm)',
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 600, marginBottom: 6 },
  emptySub: { fontSize: 13, color: 'var(--text3)', lineHeight: 1.55 },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
    gap: 10,
    marginBottom: 14,
  },
  kpi: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    padding: '14px 14px',
    boxShadow: 'var(--shadow-sm)',
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  updateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 2px',
    width: '100%',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
  },
  deleteBtn: {
    padding: '5px 7px',
    borderRadius: 7,
    border: '1px solid var(--border2)',
    background: 'transparent',
    color: 'var(--text3)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'color .15s, background .15s',
  },
  addRunBtn: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--teal-d)',
    background: 'var(--teal-l)',
    border: 'none',
    borderRadius: 20,
    padding: '5px 12px',
    cursor: 'pointer',
  },
  nudge: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '13px 16px',
    marginBottom: 14,
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--teal)',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(240,86,39,.30)',
    textAlign: 'right',
  },
  nudgeIcon: { fontSize: 22, flexShrink: 0 },
  addPill: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--teal-d)',
    background: 'var(--teal-l)',
    padding: '4px 10px',
    borderRadius: 20,
    flexShrink: 0,
  },
  updateDot: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--teal-l)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  askBtn: {
    marginBottom: 8,
    justifyContent: 'space-between',
    padding: '11px 14px',
    background: 'var(--surface3)',
    borderColor: 'var(--border)',
  },
  goalHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
}
