import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { weekKeyDate, FEEL_LABELS } from '../lib/constants'

export default function DashboardScreen({ profile, onAsk, onGoProfile }) {
  const { user } = useAuth()
  const [updates, setUpdates] = useState([])
  const [weekKm, setWeekKm] = useState(0)
  const [completed, setCompleted] = useState(0)
  const [planned, setPlanned] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [user])

  async function load() {
    if (!user) return
    setLoading(true)
    const { data: ups } = await supabase
      .from('daily_updates').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(10)
    setUpdates(ups || [])

    const ws = weekKeyDate(0)
    const { data: plan } = await supabase.from('training_plans').select('id').eq('user_id', user.id).eq('week_start', ws).maybeSingle()
    if (plan) {
      const { data: wkts } = await supabase.from('workouts').select('*').eq('plan_id', plan.id)
      if (wkts) {
        setWeekKm(Math.round(wkts.reduce((s, w) => s + (Number(w.distance_km) || 0), 0) * 10) / 10)
        setCompleted(wkts.filter(w => w.completed).length)
        setPlanned(wkts.length)
      }
    }
    setLoading(false)
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
  const kmPct = Math.min(100, Math.round((weekKm / target) * 100))
  const planPct = planned ? Math.round((completed / planned) * 100) : 0
  const daysToGoal = profile.target_date
    ? Math.max(0, Math.ceil((new Date(profile.target_date) - new Date()) / (1000 * 60 * 60 * 24)))
    : '—'

  return (
    <div>
      {/* KPI grid */}
      <div style={styles.kpiGrid}>
        <Kpi
          icon={<TrophyIcon />}
          color="var(--teal)"
          colorL="var(--teal-l)"
          label="שיא 5K"
          val={profile.pb_5k || '—'}
          sub={`יעד: ${profile.goal}`}
        />
        <Kpi
          icon={<RouteIcon />}
          color="var(--blue)"
          colorL="var(--blue-l)"
          label='ק"מ השבוע'
          val={weekKm}
          sub={`יעד: ${target} ק"מ`}
        />
        <Kpi
          icon={<CheckIcon />}
          color="var(--green)"
          colorL="var(--green-l)"
          label="אימונים"
          val={<>{completed}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text3)' }}>/{planned}</span></>}
          sub="השבוע"
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

      {/* Progress bars */}
      <div className="card">
        <div className="section-label">התקדמות שבועית</div>
        <GoalBar label='עומס ק"מ' pct={kmPct} nums={`${weekKm} / ${target}`} color="var(--teal)" />
        <GoalBar label="עמידה בתוכנית" pct={planPct} nums={`${completed} / ${planned}`} color="var(--blue)" />
      </div>

      {/* Recent updates */}
      {updates.length > 0 ? (
        <div className="card">
          <div className="section-label">דיווחים אחרונים</div>
          {updates.slice(0, 5).map(u => {
            const d = new Date(u.created_at)
            return (
              <div key={u.id} style={styles.updateRow}>
                <div style={styles.updateDot}>
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round">
                    <circle cx="8" cy="8" r="5.5" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>
                    {u.distance_km ? `${u.distance_km} ק"מ` : ''}{u.time_text ? ` · ${u.time_text}` : ''}
                    {' '}הרגשה: {u.feel ? FEEL_LABELS[u.feel] : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    {d.getDate()}/{d.getMonth() + 1} · עייפות {u.fatigue}/10 · כאב {u.pain}/10
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✏️</div>
          <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 4 }}>עדיין אין דיווחים</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>דווח על אימון ראשון בלשונית "עדכון"</div>
        </div>
      )}

      {/* Quick ask */}
      <div className="card">
        <div className="section-label">שאל את המאמן</div>
        <button
          className="btn btn-block"
          style={styles.askBtn}
          onClick={() => onAsk(`לפי הנתונים שלי, האם אני על מסלול ליעד ${profile.goal}? מה כדאי לשנות?`)}
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
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{nums} · <strong style={{ color }}>{pct}%</strong></span>
      </div>
      <div style={{ height: 7, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: color, transition: 'width .6s ease' }} />
      </div>
    </div>
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
    alignItems: 'flex-start',
    gap: 10,
    padding: '9px 0',
    borderBottom: '1px solid var(--border)',
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
}
