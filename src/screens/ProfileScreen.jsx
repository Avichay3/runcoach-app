import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { compressImage } from '../lib/image'
import { startStravaAuth, syncStrava, stravaConfigured } from '../lib/strava'

const FIELDS_TOP = [
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
]

const FIELDS_BOTTOM = [
  { id: 'injuries', label: 'פציעות / מגבלות', type: 'textarea', full: true, placeholder: 'השאר ריק אם אין' },
]

const NUMERIC_IDS = new Set(['age', 'weight', 'weekly_km', 'runs_per_week', 'long_run', 'availability'])
const GOAL_DISTANCES = ['5K', '10K', 'חצי מרתון', 'מרתון']
const GOAL_PLACEHOLDERS = { '5K': '22:00', '10K': '46:00', 'חצי מרתון': '1:50:00', 'מרתון': '3:45:00' }

function parseGoalJson(str) {
  if (!str) return { type: 'free', text: '', distance: '5K', targetTime: '' }
  try {
    const g = JSON.parse(str)
    if (g.type) return { type: 'free', text: '', distance: '5K', targetTime: '', ...g }
  } catch {}
  return { type: 'free', text: str, distance: '5K', targetTime: '' }
}

export default function ProfileScreen({ profile, onSave }) {
  const { user } = useAuth()
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      const f = {}
      ;[...FIELDS_TOP, ...FIELDS_BOTTOM].forEach(fl => { f[fl.id] = profile[fl.id] ?? '' })
      f.goal = profile.goal ?? ''
      f.target_date = profile.target_date ?? ''
      setForm(f)
    }
  }, [profile])

  function set(id, val) { setForm(prev => ({ ...prev, [id]: val })); setSaved(false) }

  async function handleSave() {
    setSaving(true)
    const payload = {}
    ;[...FIELDS_TOP, ...FIELDS_BOTTOM].forEach(fl => {
      let v = form[fl.id]
      if (v === '') v = null
      if (NUMERIC_IDS.has(fl.id) && v != null) v = Number(v)
      payload[fl.id] = v
    })
    payload.goal = form.goal || null
    payload.target_date = form.target_date || null
    const { error } = await onSave(payload)
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  return (
    <div>
      <AvatarCard profile={profile} user={user} onSave={onSave} />
      <StravaCard profile={profile} />

      <div className="card">
        <div className="card-title">פרופיל המתאמן</div>
        <div className="card-sub">הנתונים נשמרים פעם אחת ומשמשים את המאמן בכל שיחה — כך הוא מכיר אותך והייעוץ מדויק.</div>
        <div className="fields">
          {FIELDS_TOP.map(fl => (
            <div key={fl.id} className="field">
              <label>{fl.label}</label>
              {fl.type === 'select' ? (
                <select value={form[fl.id] || ''} onChange={e => set(fl.id, e.target.value)}>
                  <option value="">בחר...</option>
                  {fl.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={fl.type} value={form[fl.id] || ''} onChange={e => set(fl.id, e.target.value)} placeholder={fl.placeholder} />
              )}
            </div>
          ))}

          <GoalEditor
            value={form.goal || ''}
            dateValue={form.target_date || ''}
            onGoalChange={v => set('goal', v)}
            onDateChange={v => set('target_date', v)}
          />

          {FIELDS_BOTTOM.map(fl => (
            <div key={fl.id} className="field full">
              <label>{fl.label}</label>
              <textarea rows={2} value={form[fl.id] || ''} onChange={e => set(fl.id, e.target.value)} placeholder={fl.placeholder} />
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

function GoalEditor({ value, dateValue, onGoalChange, onDateChange }) {
  const g = parseGoalJson(value)

  function upd(patch) {
    onGoalChange(JSON.stringify({ ...g, ...patch }))
  }

  const showDist = g.type === 'distance' || g.type === 'both'
  const showText = g.type === 'free' || g.type === 'both'

  const typeOpts = [
    { id: 'free', label: 'מלל חופשי' },
    { id: 'distance', label: 'שיפור תוצאה' },
    { id: 'both', label: 'שניהם' },
  ]

  return (
    <div className="field full">
      <label>יעד עיקרי</label>

      {/* Goal type toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {typeOpts.map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => upd({ type: opt.id })}
            style={{
              flex: 1, padding: '8px 4px',
              borderRadius: 'var(--radius-sm)',
              border: '1.5px solid',
              borderColor: g.type === opt.id ? 'var(--teal)' : 'var(--border)',
              background: g.type === opt.id ? 'var(--teal-l)' : 'var(--surface2)',
              color: g.type === opt.id ? 'var(--teal-d)' : 'var(--text2)',
              fontSize: 13, fontWeight: g.type === opt.id ? 700 : 500, cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {showDist && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12.5, marginBottom: 5, display: 'block' }}>מרחק יעד</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {GOAL_DISTANCES.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => upd({ distance: d })}
                style={{
                  flex: 1, padding: '7px 2px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid',
                  borderColor: g.distance === d ? 'var(--teal)' : 'var(--border)',
                  background: g.distance === d ? 'var(--teal-l)' : 'var(--surface2)',
                  color: g.distance === d ? 'var(--teal-d)' : 'var(--text2)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {showDist && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12.5, marginBottom: 5, display: 'block' }}>זמן יעד</label>
          <input
            type="text"
            value={g.targetTime || ''}
            onChange={e => upd({ targetTime: e.target.value })}
            placeholder={GOAL_PLACEHOLDERS[g.distance] || '22:00'}
          />
        </div>
      )}

      {showText && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12.5, marginBottom: 5, display: 'block' }}>
            {g.type === 'both' ? 'פרטים נוספים' : 'תאר את היעד שלך'}
          </label>
          <textarea
            rows={2}
            value={g.text || ''}
            onChange={e => upd({ text: e.target.value })}
            placeholder='לדוגמה: לסיים חצי מרתון ראשון בתל אביב'
          />
        </div>
      )}

      <div>
        <label style={{ fontSize: 12.5, marginBottom: 5, display: 'block' }}>תאריך יעד</label>
        <input
          type="date"
          value={dateValue || ''}
          onChange={e => onDateChange(e.target.value)}
        />
      </div>
    </div>
  )
}

function AvatarCard({ profile, user, onSave }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const avatarUrl = profile?.avatar_url

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('אפשר להעלות רק תמונות'); return }
    setUploading(true)
    try {
      const blob = await compressImage(file, 512, 0.85)
      const path = `${user.id}/avatar.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      })
      if (error) throw new Error(error.message)
      const base = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      await onSave({ avatar_url: `${base}?t=${Date.now()}` })
    } catch (err) {
      alert('העלאת התמונה נכשלה: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={av.card}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      <button style={av.ring} onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="שנה תמונת פרופיל">
        {avatarUrl ? (
          <img src={avatarUrl} alt="תמונת פרופיל" style={av.img} />
        ) : (
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--text3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        )}
        <span style={av.cam}>
          {uploading ? (
            <span className="spinner" style={{ width: 13, height: 13, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.4)' }} />
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
            </svg>
          )}
        </span>
      </button>
      <div style={av.name}>{user?.email}</div>
      <div style={av.hint}>{avatarUrl ? 'לחץ על התמונה כדי להחליף' : 'לחץ כדי להוסיף תמונה'}</div>
    </div>
  )
}

const av = {
  card: { background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '22px 18px', marginBottom: 14, boxShadow: 'var(--shadow-sm)', textAlign: 'center' },
  ring: {
    position: 'relative', width: 88, height: 88, borderRadius: '50%',
    background: 'var(--surface2)', border: '2px solid var(--border2)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, overflow: 'visible',
  },
  img: { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' },
  cam: {
    position: 'absolute', bottom: -2, insetInlineEnd: -2,
    width: 28, height: 28, borderRadius: '50%',
    background: 'var(--teal)', border: '3px solid var(--surface)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(240,86,39,.35)',
  },
  name: { fontSize: 14, fontWeight: 600, marginTop: 12, color: 'var(--text)' },
  hint: { fontSize: 12, color: 'var(--text3)', marginTop: 2 },
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
