import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setInfo(''); setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setInfo('נרשמת בהצלחה! אם נדרש אימות מייל, בדוק את תיבת הדואר. אחרת אפשר להתחבר.')
        setMode('login')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(translateError(err.message))
    } finally {
      setLoading(false)
    }
  }

  function translateError(msg) {
    if (msg.includes('Invalid login')) return 'מייל או סיסמה שגויים'
    if (msg.includes('already registered')) return 'המייל כבר רשום — נסה להתחבר'
    if (msg.includes('Password')) return 'הסיסמה חייבת להכיל לפחות 6 תווים'
    if (msg.includes('email')) return 'כתובת מייל לא תקינה'
    return msg
  }

  return (
    <div style={styles.wrap}>
      {/* Hero section */}
      <div style={styles.hero}>
        <div style={styles.logoRow}>
          <div style={styles.logoIcon}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0" />
              <path d="M4 17l5 1l.75-1.5" />
              <path d="M15 21l0-4l-4-3l1-6" />
              <path d="M7 12l0-3l5-1l3 3l3 1" />
            </svg>
          </div>
          <span style={styles.logoText}>RunCoach AI</span>
        </div>
        <p style={styles.tagline}>המאמן האישי שמכיר אותך,<br />את הנתונים שלך, ואת הדרך ליעד.</p>

        <div style={styles.statsRow}>
          {[
            { val: 'AI', label: 'מבוסס' },
            { val: '24/7', label: 'זמין' },
            { val: '100%', label: 'פרטי' },
          ].map(s => (
            <div key={s.val} style={styles.stat}>
              <div style={styles.statVal}>{s.val}</div>
              <div style={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Form card */}
      <div style={styles.card}>
        <div style={styles.toggle}>
          {[{ id: 'login', label: 'התחברות' }, { id: 'signup', label: 'הרשמה' }].map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setError(''); setInfo('') }}
              style={{ ...styles.toggleBtn, ...(mode === m.id ? styles.toggleActive : {}) }}
            >{m.label}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>אימייל</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required dir="ltr" />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>סיסמה</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="לפחות 6 תווים" required dir="ltr" />
          </div>

          {error && <div style={styles.msgError}>{error}</div>}
          {info  && <div style={styles.msgInfo}>{info}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ padding: 12, fontSize: 15, borderRadius: 12 }}>
            {loading ? <span className="spinner" /> : (mode === 'login' ? 'התחבר' : 'צור חשבון')}
          </button>
        </form>
      </div>

      <p style={styles.footer}>הנתונים שלך נשמרים באופן מאובטח ופרטי — רק אתה רואה אותם.</p>
    </div>
  )
}

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
    background: 'var(--bg)',
  },
  hero: {
    width: '100%',
    maxWidth: 400,
    textAlign: 'center',
    marginBottom: 24,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: 'var(--teal)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(240,86,39,.40)',
  },
  logoText: {
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: '-.03em',
    color: 'var(--text)',
  },
  tagline: {
    fontSize: 15,
    color: 'var(--text2)',
    lineHeight: 1.65,
    marginBottom: 20,
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 28,
  },
  stat: {
    textAlign: 'center',
  },
  statVal: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--teal)',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 11,
    color: 'var(--text3)',
    marginTop: 3,
    fontWeight: 500,
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 18,
    padding: '24px 24px',
    width: '100%',
    maxWidth: 400,
    boxShadow: 'var(--shadow-md)',
  },
  toggle: {
    display: 'flex',
    gap: 4,
    background: 'var(--surface2)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    padding: '9px',
    fontSize: 14,
    border: 'none',
    background: 'transparent',
    color: 'var(--text2)',
    borderRadius: 9,
    transition: 'all .15s',
    fontWeight: 500,
  },
  toggleActive: {
    background: 'var(--surface)',
    color: 'var(--text)',
    fontWeight: 600,
    boxShadow: 'var(--shadow-sm)',
  },
  msgError: {
    fontSize: 13,
    color: 'var(--red-d)',
    background: 'var(--red-l)',
    padding: '9px 13px',
    borderRadius: 10,
    marginBottom: 12,
  },
  msgInfo: {
    fontSize: 13,
    color: 'var(--green-d)',
    background: 'var(--green-l)',
    padding: '9px 13px',
    borderRadius: 10,
    marginBottom: 12,
  },
  footer: {
    fontSize: 12,
    color: 'var(--text3)',
    marginTop: 20,
    textAlign: 'center',
  },
}
