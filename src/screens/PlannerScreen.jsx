import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { WORKOUT_TYPES, DAYS_HE, REST_DEFAULT, weekKeyDate, weekDates } from '../lib/constants'

export default function PlannerScreen({ profile, onSendToCoach }) {
  const { user } = useAuth()
  const [weekOffset, setWeekOffset] = useState(0)
  const [planId, setPlanId] = useState(null)
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  const target = Number(profile?.weekly_km) || 50

  const loadWeek = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const ws = weekKeyDate(weekOffset)
    let { data: plan } = await supabase
      .from('training_plans').select('*')
      .eq('user_id', user.id).eq('week_start', ws).maybeSingle()

    if (!plan) {
      const { data: created } = await supabase
        .from('training_plans')
        .insert({ user_id: user.id, week_start: ws, target_km: target })
        .select().single()
      plan = created
    }
    setPlanId(plan.id)

    const { data: wkts } = await supabase
      .from('workouts').select('*').eq('plan_id', plan.id).order('created_at', { ascending: true })
    setWorkouts(wkts || [])
    setLoading(false)
  }, [user, weekOffset, target])

  useEffect(() => { loadWeek() }, [loadWeek])

  async function addWorkout(day, w) {
    const { data } = await supabase.from('workouts').insert({
      plan_id: planId, user_id: user.id, day_of_week: day,
      type: w.type, distance_km: w.km ? Number(w.km) : null,
      duration_min: w.mins ? Number(w.mins) : null, note: w.note || null,
    }).select().single()
    if (data) setWorkouts(prev => [...prev, data])
  }

  async function removeWorkout(id) {
    await supabase.from('workouts').delete().eq('id', id)
    setWorkouts(prev => prev.filter(w => w.id !== id))
  }

  async function toggleDone(w) {
    const { data } = await supabase.from('workouts').update({ completed: !w.completed }).eq('id', w.id).select().single()
    if (data) setWorkouts(prev => prev.map(x => x.id === w.id ? data : x))
  }

  const dates = weekDates(weekOffset)
  const fmt = d => `${d.getDate()}/${d.getMonth() + 1}`
  const byDay = day => workouts.filter(w => w.day_of_week === day)
  const totalKm = Math.round(workouts.reduce((s, w) => s + (Number(w.distance_km) || 0), 0) * 10) / 10
  const NON_RUN = ['strength_upper', 'strength_lower', 'flexibility', 'strength']
  const totalRuns = workouts.filter(w => !NON_RUN.includes(w.type)).length
  const totalMins = workouts.reduce((s, w) => s + (Number(w.duration_min) || 0), 0)
  const pct = Math.min(100, Math.round((totalKm / target) * 100))

  function sendToCoach() {
    const lines = DAYS_HE.map((name, i) => {
      if (REST_DEFAULT.includes(i)) return `${name}: מנוחה`
      const ws = byDay(i)
      if (!ws.length) return `${name}: ריק`
      return `${name}: ` + ws.map(w => {
        const t = WORKOUT_TYPES[w.type].label
        return t + (w.distance_km ? ` ${w.distance_km}ק"מ` : '') + (w.duration_min ? ` ${w.duration_min}ד` : '') + (w.note ? ` (${w.note})` : '')
      }).join(' + ')
    }).join('\n')
    onSendToCoach(`תוכנית האימונים שלי לשבוע:\n${lines}\n\nסך הכל: ${totalKm} ק"מ\n\nאנא סקור ותגיד אם יש משהו לשנות לפי הפרופיל שלי.`)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>

  return (
    <div>
      <div style={styles.top}>
        <div style={styles.nav}>
          <button style={styles.navBtn} onClick={() => setWeekOffset(o => o - 1)}>›</button>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{fmt(dates[0])} – {fmt(dates[6])}</span>
          <button style={styles.navBtn} onClick={() => setWeekOffset(o => o + 1)}>‹</button>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Stat val={totalKm} label='ק"מ' />
          <Stat val={totalRuns} label="ריצות" />
          <Stat val={totalMins} label="דקות" />
        </div>
      </div>

      <div style={styles.grid}>
        {dates.map((date, i) => {
          const rest = REST_DEFAULT.includes(i)
          return (
            <div key={i} style={styles.col}>
              <div style={styles.dayHead}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{DAYS_HE[i]}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(date)}</div>
              </div>
              <div style={{ ...styles.drop, ...(rest ? styles.dropRest : {}) }}>
                {rest ? (
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '14px 0' }}>מנוחה</div>
                ) : (
                  <>
                    {byDay(i).map(w => {
                      const t = WORKOUT_TYPES[w.type] || WORKOUT_TYPES.easy
                      return (
                        <div key={w.id} style={{ ...styles.wkt, background: t.bg, color: t.text, border: `0.5px solid ${t.border}`, opacity: w.completed ? .55 : 1 }}>
                          <button style={styles.wktX} onClick={() => removeWorkout(w.id)} aria-label="הסר">✕</button>
                          <div style={{ fontWeight: 600, marginBottom: 2 }}>{t.label}</div>
                          <div style={{ opacity: .85, lineHeight: 1.35 }}>
                            {w.distance_km ? `${w.distance_km}ק"מ` : ''}{w.distance_km && w.duration_min ? ' · ' : ''}{w.duration_min ? `${w.duration_min}ד` : ''}
                            {w.note ? <><br />{w.note}</> : ''}
                          </div>
                          <button style={styles.wktCheck} onClick={() => toggleDone(w)} aria-label="בוצע">{w.completed ? '↩' : '✓'}</button>
                        </div>
                      )
                    })}
                    <button style={styles.addDay} onClick={() => setModal({ day: i })}>+</button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="section-label">עומס שבועי מול יעד</div>
        <div style={styles.goalRow}>
          <span style={{ fontSize: 13, color: 'var(--text2)', width: 90 }}>ק"מ השבוע</span>
          <div style={styles.barBg}><div style={{ ...styles.barFill, width: `${pct}%` }} /></div>
          <span style={{ fontSize: 12, color: 'var(--text2)', width: 96, textAlign: 'left' }}>{totalKm} / {target} ק"מ</span>
        </div>
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={sendToCoach}>שלח למאמן לאישור</button>
      </div>

      {modal && <WorkoutModal day={modal.day} onClose={() => setModal(null)} onAdd={addWorkout} />}
    </div>
  )
}

function Stat({ val, label }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '6px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{val}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</div>
    </div>
  )
}

function WorkoutModal({ day, onClose, onAdd }) {
  const [type, setType] = useState('easy')
  const [km, setKm] = useState('')
  const [mins, setMins] = useState('')
  const [note, setNote] = useState('')

  function submit() {
    onAdd(day, { type, km, mins, note })
    onClose()
  }

  return (
    <div style={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={styles.modal}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>הוסף אימון — {DAYS_HE[day]}</h3>
        <div className="field" style={{ marginBottom: 10 }}>
          <label>סוג</label>
          <select value={type} onChange={e => setType(e.target.value)}>
            {Object.entries(WORKOUT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 10 }}><label>מרחק (ק"מ)</label><input type="number" value={km} onChange={e => setKm(e.target.value)} placeholder="10" /></div>
        <div className="field" style={{ marginBottom: 10 }}><label>משך (דקות)</label><input type="number" value={mins} onChange={e => setMins(e.target.value)} placeholder="60" /></div>
        <div className="field" style={{ marginBottom: 10 }}><label>הערה</label><input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="6×800מ" /></div>
        <div className="btn-row">
          <button className="btn" onClick={onClose}>ביטול</button>
          <button className="btn btn-primary" onClick={submit}>הוסף</button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  top: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 },
  nav: { display: 'flex', alignItems: 'center', gap: 8 },
  navBtn: { width: 30, height: 30, border: '0.5px solid var(--border2)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text2)', fontSize: 15 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 6, marginBottom: 14 },
  col: { display: 'flex', flexDirection: 'column', gap: 6 },
  dayHead: { textAlign: 'center', padding: '4px 0' },
  drop: { minHeight: 110, border: '0.5px dashed var(--border2)', borderRadius: 'var(--radius-sm)', padding: 5, display: 'flex', flexDirection: 'column', gap: 5 },
  dropRest: { background: 'var(--surface2)', borderStyle: 'solid' },
  wkt: { borderRadius: 7, padding: '7px 8px', position: 'relative', fontSize: 11 },
  wktX: { position: 'absolute', top: 4, left: 5, border: 'none', background: 'none', color: 'inherit', fontSize: 11, padding: 0, opacity: .6 },
  wktCheck: { position: 'absolute', bottom: 4, left: 5, border: 'none', background: 'none', color: 'inherit', fontSize: 11, padding: 0, opacity: .5 },
  addDay: { padding: 5, fontSize: 14, border: '0.5px dashed var(--border)', borderRadius: 7, background: 'transparent', color: 'var(--text3)' },
  goalRow: { display: 'flex', alignItems: 'center', gap: 10 },
  barBg: { flex: 1, height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, background: 'var(--teal)', transition: 'width .4s' },
  modalBg: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20, backdropFilter: 'blur(4px)' },
  modal: { background: 'var(--surface)', borderRadius: 18, padding: 22, width: 300, maxWidth: '100%', boxShadow: 'var(--shadow-md)' },
}
