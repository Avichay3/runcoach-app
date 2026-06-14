import { useState, useEffect, useRef } from 'react'
import { useAuth } from './context/AuthContext'
import { useProfile } from './lib/useProfile'
import { supabase } from './lib/supabase'
import { weekKeyDate } from './lib/constants'
import { exchangeStravaCode, syncStrava } from './lib/strava'
import { runProactiveCheck } from './lib/proactive'
import AuthScreen from './screens/AuthScreen'
import DashboardScreen from './screens/DashboardScreen'
import PlannerScreen from './screens/PlannerScreen'
import CoachScreen from './screens/CoachScreen'
import ProfileScreen from './screens/ProfileScreen'

const TABS = [
  {
    id: 'dashboard', label: 'לוח בקרה',
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="11" width="5" height="7" rx="1.5" /><rect x="7.5" y="6" width="5" height="12" rx="1.5" /><rect x="13" y="2" width="5" height="16" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'planner', label: 'תוכנית',
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="16" height="15" rx="2.5" /><path d="M6 1v4M14 1v4M2 8h16" />
      </svg>
    ),
  },
  {
    id: 'coach', label: 'מאמן',
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 10c0 3.866-3.134 7-7 7a6.97 6.97 0 0 1-3.5-.935L3 17l.935-3.5A6.97 6.97 0 0 1 3 10c0-3.866 3.134-7 7-7s7 3.134 7 7z" />
      </svg>
    ),
  },
  {
    id: 'profile', label: 'פרופיל',
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="6.5" r="3.5" /><path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" />
      </svg>
    ),
  },
]

export default function App() {
  const { session, loading: authLoading, signOut } = useAuth()
  const { profile, save, reload } = useProfile()
  const [tab, setTab] = useState('dashboard')
  const [pendingMessage, setPendingMessage] = useState(null)
  const [weeklyKm, setWeeklyKm] = useState(0)
  const [stravaToast, setStravaToast] = useState(null)
  const [coachUnread, setCoachUnread] = useState(false)
  const proactiveRan = useRef(false)

  useEffect(() => {
    if (session) loadWeeklyKm()
  }, [session, tab])

  // Proactive coach: once per app load, let the coach post a weekly summary
  useEffect(() => {
    if (!session || !profile || proactiveRan.current) return
    proactiveRan.current = true
    runProactiveCheck({ user: session.user, profile, weeklyKm }).then(({ posted }) => {
      if (posted) setCoachUnread(true)
    })
  }, [session, profile, weeklyKm])

  // Clear the badge when the user opens the coach
  useEffect(() => {
    if (tab === 'coach') setCoachUnread(false)
  }, [tab])

  // Handle the Strava OAuth redirect (?code=...&scope=...)
  useEffect(() => {
    if (!session) return
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const scope = params.get('scope')
    if (!code || !scope) return

    // Clean the URL immediately so a refresh doesn't re-trigger
    window.history.replaceState({}, '', window.location.pathname)
    setTab('profile')
    setStravaToast({ kind: 'loading', text: 'מתחבר ל-Strava ומייבא ריצות...' })

    ;(async () => {
      try {
        const { athlete_name } = await exchangeStravaCode(code)
        const { imported } = await syncStrava()
        await reload()
        setStravaToast({
          kind: 'success',
          text: `מחובר ל-Strava (${athlete_name}) — יובאו ${imported} ריצות`,
        })
      } catch (err) {
        setStravaToast({ kind: 'error', text: 'החיבור ל-Strava נכשל: ' + err.message })
      }
      setTimeout(() => setStravaToast(null), 6000)
    })()
  }, [session])

  async function loadWeeklyKm() {
    const ws = weekKeyDate(0)
    const { data: plan } = await supabase.from('training_plans').select('id').eq('user_id', session.user.id).eq('week_start', ws).maybeSingle()
    if (plan) {
      const { data: wkts } = await supabase.from('workouts').select('distance_km').eq('plan_id', plan.id)
      if (wkts) setWeeklyKm(Math.round(wkts.reduce((s, w) => s + (Number(w.distance_km) || 0), 0) * 10) / 10)
    }
  }

  function sendToCoach(msg) {
    setPendingMessage(msg)
    setTab('coach')
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    )
  }

  if (!session) return <AuthScreen />

  return (
    <div style={styles.app}>
      {stravaToast && (
        <div style={{ ...styles.toast, ...toastKind(stravaToast.kind) }}>
          {stravaToast.kind === 'loading' && <span className="spinner" style={{ width: 14, height: 14 }} />}
          <span>{stravaToast.text}</span>
        </div>
      )}

      {/* Top bar */}
      <div style={styles.topbar}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0" />
              <path d="M4 17l5 1l.75-1.5" />
              <path d="M15 21l0-4l-4-3l1-6" />
              <path d="M7 12l0-3l5-1l3 3l3 1" />
            </svg>
          </div>
          <span style={styles.logoText}>RunCoach AI</span>
        </div>
        <div style={{ flex: 1 }} />
        <button style={styles.signOut} onClick={signOut}>יציאה</button>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }}
          >
            <span style={{ ...styles.tabIcon, ...(tab === t.id ? styles.tabIconActive : {}) }}>
              {t.icon}
              {t.id === 'coach' && coachUnread && <span style={styles.unreadDot} />}
            </span>
            <span style={styles.tabLabel}>{t.label}</span>
            {tab === t.id && <span style={styles.tabDot} />}
          </button>
        ))}
      </div>

      {/* Screen content */}
      <div style={styles.content}>
        {tab === 'dashboard' && <DashboardScreen profile={profile} onAsk={sendToCoach} onGoProfile={() => setTab('profile')} />}
        {tab === 'planner'   && <PlannerScreen profile={profile} onSendToCoach={sendToCoach} />}
        {tab === 'coach'     && <CoachScreen profile={profile} weeklyKm={weeklyKm} pendingMessage={pendingMessage} onConsumePending={() => setPendingMessage(null)} />}
        {tab === 'profile'   && <ProfileScreen profile={profile} onSave={async (f) => { const r = await save(f); await reload(); return r }} />}
      </div>
    </div>
  )
}

function toastKind(kind) {
  if (kind === 'success') return { background: 'var(--green-l)', color: 'var(--green-d)' }
  if (kind === 'error') return { background: 'var(--red-l)', color: 'var(--red-d)' }
  return { background: 'var(--surface2)', color: 'var(--text2)' }
}

const styles = {
  app: {
    maxWidth: 900,
    margin: '0 auto',
    minHeight: '100vh',
  },
  toast: {
    position: 'sticky',
    top: 0,
    zIndex: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'center',
  },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 20px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
    boxShadow: 'var(--shadow-sm)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    background: 'var(--teal)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(240,86,39,.35)',
  },
  logoText: {
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  signOut: {
    fontSize: 13,
    color: 'var(--text3)',
    padding: '6px 14px',
    borderRadius: 20,
    border: '1.5px solid var(--border2)',
    background: 'transparent',
    fontWeight: 500,
    transition: 'all .15s',
  },
  tabBar: {
    display: 'flex',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    position: 'sticky',
    top: 57,
    zIndex: 49,
    overflowX: 'auto',
    padding: '0 8px',
  },
  tab: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '10px 14px 8px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text3)',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 72,
    transition: 'color .15s',
  },
  tabActive: {
    color: 'var(--teal)',
  },
  tabIcon: {
    position: 'relative',
    display: 'inline-flex',
    opacity: .55,
    transition: 'opacity .15s',
  },
  tabIconActive: {
    opacity: 1,
  },
  unreadDot: {
    position: 'absolute',
    top: -3,
    insetInlineEnd: -5,
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--red)',
    border: '1.5px solid var(--surface)',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '.01em',
  },
  tabDot: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 28,
    height: 2.5,
    borderRadius: 2,
    background: 'var(--teal)',
  },
  content: {
    padding: 16,
  },
}
