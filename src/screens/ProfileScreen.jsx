import { useState, useEffect } from 'react'
import { startStravaAuth, syncStrava, stravaConfigured } from '../lib/strava'

const FIELDS = [
  { id: 'age', label: 'גיל', type: 'number', placeholder: '34' },
  { id: 'gender', label: 'מין', type: 'select', options: ['גבר', 'אישה', 'אחר'] },
  { id: 'weight', label: 'משקל (ק"ג)', type: 'number', placeholder: '80' },
  { id: 'experience', label: 'ניסיון בריצה', type: 'select', options: ['מתחיל (פחות משנה)', 'בינוני (1–3 שנים)', 'מנוסה (3–5 שנים)', 'ותיק (5+ שנים)'] },
  { id: 'weekly_km', label: 'ק"מ שבועי ממוצע', type: 'number', placeholder: '40' },
  { id: 'runs_per_week', label: 'ריצות בשבוע', type: 'number', placeholder: '4' },
  { id: 'pb_5k', label: 'שיא 5K (מ:ש)', type: 'text', placeholder: '21:30' },
  { id: 'pb_10k', label: 'שיא 10K (מ:ש)', type: 'text', placeholder: '46:00' },
  { id: 'long_run', label: 'ריצה ארוכה (ק"מ)', type: 'number', placeholder: '16' },
  { id: 'availability', label: 'זמינות שבועית (שעות)', type: 'number', placeholder: '8' },
  { id: 'goal', label: 'יעד עיקרי', type: 'select', options: ['Sub-18 ב-5K', 'Sub-40 ב-10K', 'חצי מרתון', 'מרתון', 'ירידה במשקל', 'כושר כללי'] },
  { id: 'target_date', label: 'תאריך יעד', type: 'date' },
  { id: 'injuries', label: 'פציעות / מגבלות', type: 'textarea', full: true, placeholder: 'השאר ריק אם אין' },
]

export default function ProfileScreen({ profile, onSave }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      const f = {}
      FIELDS.forEach(fl => { f[fl.id] = profile[fl.id] ?? '' })
      setForm(f)
    }
  }, [profile])

  function set(id, val) { setForm(prev => ({ ...prev, [id]: val })); setSaved(false) }

  async function handleSave() {
    setSaving(true)
    const payload = {}
    FIELDS.forEach(fl => {
      let v = form[fl.id]
      if (v === '') v = null
      if (['age', 'weight', 'weekly_km', 'runs_per_week', 'long_run', 'availability'].includes(fl.id) && v != null) v = Number(v)
      payload[fl.id] = v
    })
    const { error } = await onSave(payload)
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  return (
    <div>
      <StravaCard profile={profile} />

      <div className="card">
        <div className="card-title">פרופיל המתאמן</div>
        <div className="card-sub">הנתונים נשמרים פעם אחת ומשמשים את המאמן בכל שיחה — כך הוא מכיר אותך והייעוץ מדויק.</div>
        <div className="fields">
          {FIELDS.map(fl => (
            <div key={fl.id} className={fl.full ? 'field full' : 'field'}>
              <label>{fl.label}</label>
              {fl.type === 'select' ? (
                <select value={form[fl.id] || ''} onChange={e => set(fl.id, e.target.value)}>
                  <option value="">בחר...</option>
                  {fl.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : fl.type === 'textarea' ? (
                <textarea rows={2} value={form[fl.id] || ''} onChange={e => set(fl.id, e.target.value)} placeholder={fl.placeholder} />
              ) : (
                <input type={fl.type} value={form[fl.id] || ''} onChange={e => set(fl.id, e.target.value)} placeholder={fl.placeholder} />
              )}
            </div>
          ))}
        </div>
        <div className="btn-row">
          {saved && <span style={{ fontSize: 13, color: 'var(--teal-d)', alignSelf: 'center' }}>נשמר ✓</span>}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <span className="spinner" /> : 'שמור פרופיל'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StravaCard({ profile }) {
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState(null)
  const connected = Boolean(profile?.strava_athlete_id)
  const configured = stravaConfigured()

  async function handleSync() {
    setSyncing(true)
    setMsg(null)
    try {
      const { imported } = await syncStrava()
      setMsg({ ok: true, text: imported > 0 ? `יובאו ${imported} ריצות חדשות` : 'הכל מסונכרן — אין ריצות חדשות' })
    } catch (err) {
      setMsg({ ok: false, text: 'שגיאה: ' + err.message })
    }
    setSyncing(false)
  }

  const lastSync = profile?.strava_last_sync
    ? new Date(profile.strava_last_sync).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div style={s.card}>
      <div style={s.head}>
        <div style={s.icon}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.title}>Strava</div>
          <div style={s.sub}>
            {!configured
              ? 'ייבוא אוטומטי של ריצות מהשעון'
              : connected
                ? <span style={{ color: 'var(--green-d)', fontWeight: 600 }}>✓ מחובר{lastSync ? ` · סונכרן ${lastSync}` : ''}</span>
                : 'חבר את החשבון וכל ריצה תיכנס אוטומטית'}
          </div>
        </div>
      </div>

      {!configured ? (
        <div style={s.notice}>החיבור ל-Strava יופעל בקרוב — נדרשת הגדרת מפתח.</div>
      ) : connected ? (
        <div style={s.row}>
          <button style={s.syncBtn} onClick={handleSync} disabled={syncing}>
            {syncing ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'סנכרן ריצות עכשיו'}
          </button>
          {msg && <span style={{ fontSize: 12, color: msg.ok ? 'var(--green-d)' : 'var(--red-d)' }}>{msg.text}</span>}
        </div>
      ) : (
        <button style={s.connectBtn} onClick={startStravaAuth}>התחבר ל-Strava</button>
      )}
    </div>
  )
}

const s = {
  card: { background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 14, boxShadow: 'var(--shadow-sm)' },
  head: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  icon: { width: 40, height: 40, borderRadius: 10, background: '#FC4C02', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(252,76,2,.35)' },
  title: { fontSize: 15, fontWeight: 700 },
  sub: { fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5, marginTop: 1 },
  row: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  connectBtn: { width: '100%', padding: 11, borderRadius: 'var(--radius-sm)', background: '#FC4C02', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, boxShadow: '0 2px 8px rgba(252,76,2,.30)' },
  syncBtn: { padding: '9px 18px', borderRadius: 'var(--radius-sm)', background: '#FC4C02', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 },
  notice: { fontSize: 12.5, color: 'var(--text3)', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' },
}
