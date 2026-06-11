import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { WORKOUT_TYPES, DAYS_HE, weekKeyDate, FEEL_LABELS } from '../lib/constants'
import { parseGPX } from '../lib/gpx'

const BODY_TAGS = [
  { t: 'רגליים קלות', c: 'ok' }, { t: 'נשימה טובה', c: 'ok' }, { t: 'קצב נוח', c: 'ok' }, { t: 'דופק יציב', c: 'ok' },
  { t: 'עייפות', c: 'warn' }, { t: 'כבדות ברגליים', c: 'warn' }, { t: 'קיצור נשימה', c: 'warn' }, { t: 'כיווצים', c: 'warn' },
  { t: 'כאב בברך', c: 'danger' }, { t: 'כאב בשוק', c: 'danger' }, { t: 'כאב בגב', c: 'danger' }, { t: 'כאב חד', c: 'danger' },
]

export default function UpdateScreen({ profile, onSendToCoach }) {
  const { user } = useAuth()
  const [todayWorkout, setTodayWorkout] = useState(null)
  const [form, setForm] = useState({
    actual: 'כמתוכנן', reason: '', km: '', time: '', avgHr: '', maxHr: '', pace: '',
    weather: 'נעים', sleep: '', sleepQ: 'טובה', note: '',
  })
  const [feel, setFeel] = useState(null)
  const [tags, setTags] = useState([])
  const [fatigue, setFatigue] = useState(5)
  const [pain, setPain] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [gpxLoading, setGpxLoading] = useState(false)
  const [gpxName, setGpxName] = useState('')
  const fileRef = useRef(null)

  useEffect(() => { loadToday() }, [user])

  async function handleGPX(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setGpxLoading(true)
    try {
      const text = await file.text()
      const result = parseGPX(text)
      setForm(prev => ({
        ...prev,
        km: result.distanceKm ? String(result.distanceKm) : prev.km,
        time: result.timeText || prev.time,
        avgHr: result.avgHr ? String(result.avgHr) : prev.avgHr,
        maxHr: result.maxHr ? String(result.maxHr) : prev.maxHr,
        pace: result.pace || prev.pace,
      }))
      setGpxName(result.name || file.name.replace('.gpx', ''))
    } catch (err) {
      alert('שגיאה בקריאת הקובץ: ' + err.message)
    } finally {
      setGpxLoading(false)
      e.target.value = ''
    }
  }

  async function loadToday() {
    if (!user) return
    const ws = weekKeyDate(0)
    const today = new Date().getDay()
    const { data: plan } = await supabase.from('training_plans').select('id').eq('user_id', user.id).eq('week_start', ws).maybeSingle()
    if (plan) {
      const { data: wkts } = await supabase.from('workouts').select('*').eq('plan_id', plan.id).eq('day_of_week', today)
      if (wkts && wkts.length) setTodayWorkout(wkts[0])
    }
  }

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }
  function toggleTag(t) { setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]) }

  const plannedLabel = todayWorkout
    ? `${WORKOUT_TYPES[todayWorkout.type].label}${todayWorkout.distance_km ? ` · ${todayWorkout.distance_km}ק"מ` : ''}${todayWorkout.duration_min ? ` · ${todayWorkout.duration_min} דקות` : ''}`
    : 'אין אימון מתוכנן להיום'

  async function submit() {
    if (!profile) { alert('קודם השלם את הפרופיל'); return }
    setSubmitting(true)

    await supabase.from('daily_updates').insert({
      user_id: user.id, workout_id: todayWorkout?.id || null,
      actual_type: form.actual, change_reason: form.reason || null,
      distance_km: form.km ? Number(form.km) : null, time_text: form.time || null,
      avg_hr: form.avgHr ? Number(form.avgHr) : null, max_hr: form.maxHr ? Number(form.maxHr) : null,
      pace: form.pace || null, weather: form.weather, feel: feel ? Number(feel) : null,
      body_tags: tags, fatigue: Number(fatigue), pain: Number(pain),
      sleep_hours: form.sleep ? Number(form.sleep) : null, sleep_quality: form.sleepQ,
      free_note: form.note || null,
    })

    if (todayWorkout && !todayWorkout.completed) {
      await supabase.from('workouts').update({ completed: true }).eq('id', todayWorkout.id)
    }

    const summary = `אימון מתוכנן: ${plannedLabel}
בפועל: ${form.actual}${form.reason ? ` (${form.reason})` : ''}
נתונים: ${form.km ? form.km + 'ק"מ ' : ''}${form.time ? form.time + ' ' : ''}${form.avgHr ? 'דופק ' + form.avgHr + ' ' : ''}${form.maxHr ? 'מקס ' + form.maxHr + ' ' : ''}${form.pace ? 'טמפו ' + form.pace + ' ' : ''}מז"א ${form.weather}
הרגשה: ${feel ? FEEL_LABELS[feel] : '—'} | עייפות ${fatigue}/10 | כאב ${pain}/10
תחושות: ${tags.length ? tags.join(', ') : 'ללא'}
שינה: ${form.sleep || '—'}ש (${form.sleepQ})
הערה: ${form.note || 'אין'}`

    setSubmitting(false)
    onSendToCoach('דיווח אימון:\n' + summary)
  }

  return (
    <div>
      {/* GPX Import card */}
      <div style={styles.gpxCard}>
        <div style={styles.gpxLeft}>
          <div style={styles.gpxIcon}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.22-8.56" /><path d="M21 3v4h-4" /><path d="M21 7 12 16l-3-3" />
            </svg>
          </div>
          <div>
            <div style={styles.gpxTitle}>ייבא מ-Strava</div>
            <div style={styles.gpxSub}>
              {gpxName
                ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓ יובא: {gpxName}</span>
                : 'בStrava: ··· ← Export GPX ← פתח פעילות'}
            </div>
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".gpx" style={{ display: 'none' }} onChange={handleGPX} />
        <button
          style={styles.gpxBtn}
          onClick={() => fileRef.current?.click()}
          disabled={gpxLoading}
        >
          {gpxLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'בחר קובץ GPX'}
        </button>
      </div>

      <div className="card">
        <div className="section-label">אימון מתוכנן להיום</div>
        <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{plannedLabel}</div>
          {todayWorkout?.note && <div style={{ fontSize: 12, color: 'var(--text2)' }}>{todayWorkout.note}</div>}
        </div>
        <div className="fields">
          <div className="field">
            <label>מה עשיתי בפועל</label>
            <select value={form.actual} onChange={e => set('actual', e.target.value)}>
              {['כמתוכנן', 'קיצרתי', 'הארכתי', 'עצימות נמוכה', 'עצימות גבוהה', 'דילגתי', 'אימון אחר'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="field"><label>סיבת שינוי (אם יש)</label><input value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="עייפות, מזג אוויר..." /></div>
        </div>
      </div>

      <div className="card">
        <div className="section-label">נתוני האימון</div>
        <div className="fields">
          <div className="field"><label>מרחק (ק"מ)</label><input type="number" value={form.km} onChange={e => set('km', e.target.value)} placeholder="8.2" /></div>
          <div className="field"><label>זמן (מ:ש)</label><input value={form.time} onChange={e => set('time', e.target.value)} placeholder="44:30" /></div>
          <div className="field"><label>דופק ממוצע</label><input type="number" value={form.avgHr} onChange={e => set('avgHr', e.target.value)} placeholder="162" /></div>
          <div className="field"><label>דופק מקסימלי</label><input type="number" value={form.maxHr} onChange={e => set('maxHr', e.target.value)} placeholder="178" /></div>
          <div className="field"><label>טמפו (דק/ק"מ)</label><input value={form.pace} onChange={e => set('pace', e.target.value)} placeholder="5:33" /></div>
          <div className="field"><label>מזג אוויר</label><select value={form.weather} onChange={e => set('weather', e.target.value)}>{['נעים', 'חם', 'קר', 'גשם', 'רוח', 'לח מאוד'].map(o => <option key={o}>{o}</option>)}</select></div>
        </div>
      </div>

      <div className="card">
        <div className="section-label">איך הרגשתי</div>
        <div style={styles.feelGrid}>
          {[{ v: 1, e: '😞', l: 'גרוע', c: 'red' }, { v: 2, e: '😐', l: 'קשה', c: 'amber' }, { v: 3, e: '🙂', l: 'סביר', c: 'gray' }, { v: 4, e: '😊', l: 'טוב', c: 'teal' }, { v: 5, e: '🚀', l: 'מעולה', c: 'purple' }].map(f => (
            <button key={f.v} onClick={() => setFeel(String(f.v))} style={{ ...styles.feelBtn, ...(feel === String(f.v) ? feelSel(f.c) : {}) }}>
              <span style={{ fontSize: 20, display: 'block', marginBottom: 4 }}>{f.e}</span>{f.l}
            </button>
          ))}
        </div>
        <div className="section-label">תחושות גוף</div>
        <div style={styles.tagWrap}>
          {BODY_TAGS.map(({ t, c }) => (
            <span key={t} onClick={() => toggleTag(t)} style={{ ...styles.tag, ...(tags.includes(t) ? tagSel(c) : {}) }}>{t}</span>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <Range label="עייפות כללית" min={1} max={10} value={fatigue} onChange={setFatigue} />
          <Range label="כאב / אי-נוחות" min={0} max={10} value={pain} onChange={setPain} />
        </div>
      </div>

      <div className="card">
        <div className="section-label">שינה והתאוששות</div>
        <div className="fields">
          <div className="field"><label>שעות שינה</label><input type="number" step="0.5" value={form.sleep} onChange={e => set('sleep', e.target.value)} placeholder="7" /></div>
          <div className="field"><label>איכות שינה</label><select value={form.sleepQ} onChange={e => set('sleepQ', e.target.value)}>{['טובה', 'בינונית', 'גרועה'].map(o => <option key={o}>{o}</option>)}</select></div>
        </div>
        <div className="field full" style={{ marginTop: 12 }}>
          <label>הערה חופשית למאמן</label>
          <textarea rows={2} value={form.note} onChange={e => set('note', e.target.value)} placeholder="הרגשתי שהרגל שמאל מכווצת מהק&quot;מ ה-5..." />
        </div>
      </div>

      <button className="btn btn-primary btn-block" onClick={submit} disabled={submitting} style={{ padding: 11 }}>
        {submitting ? <span className="spinner" /> : 'שלח עדכון למאמן וקבל המלצה'}
      </button>
    </div>
  )
}

function Range({ label, min, max, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <label style={{ fontSize: 13, color: 'var(--text2)', width: 110, flexShrink: 0 }}>{label}</label>
      <input type="range" min={min} max={max} step={1} value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1 }} />
      <span style={{ fontSize: 14, fontWeight: 600, width: 38, textAlign: 'left' }}>{value}</span>
    </div>
  )
}

function feelSel(c) { return { borderWidth: 2, borderColor: `var(--${c})`, background: `var(--${c}-l)`, color: `var(--${c}-d)`, fontWeight: 600 } }
function tagSel(c) {
  const map = { ok: 'teal', warn: 'amber', danger: 'red' }
  const cc = map[c]
  return { background: `var(--${cc}-l)`, borderColor: `var(--${cc})`, color: `var(--${cc}-d)` }
}

const styles = {
  gpxCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'var(--surface)', borderRadius: 'var(--radius)',
    padding: '14px 16px', marginBottom: 14,
    boxShadow: 'var(--shadow-sm)',
    gap: 12, flexWrap: 'wrap',
  },
  gpxLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  gpxIcon: {
    width: 38, height: 38, borderRadius: 10,
    background: 'linear-gradient(135deg, #FC4C02, #F05627)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(240,86,39,.35)',
  },
  gpxTitle: { fontSize: 14, fontWeight: 600, marginBottom: 2 },
  gpxSub: { fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 },
  gpxBtn: {
    padding: '8px 16px', borderRadius: 10,
    background: 'var(--teal)', color: '#fff',
    border: 'none', fontSize: 13, fontWeight: 600,
    boxShadow: '0 2px 6px rgba(240,86,39,.30)',
    whiteSpace: 'nowrap', flexShrink: 0,
    display: 'flex', alignItems: 'center', gap: 6,
  },
  feelGrid: { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 7, marginBottom: 14 },
  feelBtn: { padding: '10px 4px', border: '0.5px solid var(--border2)', borderRadius: 'var(--radius-sm)', background: 'var(--surface3)', textAlign: 'center', fontSize: 12, color: 'var(--text2)' },
  tagWrap: { display: 'flex', flexWrap: 'wrap', gap: 7 },
  tag: { padding: '6px 12px', borderRadius: 20, fontSize: 12, border: '0.5px solid var(--border2)', background: 'var(--surface3)', color: 'var(--text2)' },
}
