import { useState, useEffect } from 'react'

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
