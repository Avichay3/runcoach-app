import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'

const PERIODS = [
  { label: '4 שב\'', weeks: 4 },
  { label: '8 שב\'', weeks: 8 },
  { label: '12 שב\'', weeks: 12 },
]

export default function ProgressScreen({ profile }) {
  const { user } = useAuth()
  const [period, setPeriod] = useState(8)
  const [weeklyData, setWeeklyData] = useState([])
  const [runsData, setRunsData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [user, period])

  async function load() {
    if (!user) return
    setLoading(true)

    const since = new Date()
    since.setDate(since.getDate() - period * 7)

    // Actual runs from daily_updates
    const { data: updates } = await supabase
      .from('daily_updates')
      .select('distance_km, fatigue, pain, feel, created_at')
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })

    if (updates) {
      // Group by week
      const byWeek = {}
      updates.forEach(u => {
        const d = new Date(u.created_at)
        const weekStart = getWeekStart(d)
        if (!byWeek[weekStart]) byWeek[weekStart] = { week: weekStart, km: 0, runs: 0, fatigue: [], feel: [] }
        byWeek[weekStart].km += Number(u.distance_km) || 0
        byWeek[weekStart].runs += 1
        if (u.fatigue) byWeek[weekStart].fatigue.push(Number(u.fatigue))
        if (u.feel)    byWeek[weekStart].feel.push(Number(u.feel))
      })

      // Fill all weeks (including empty ones)
      const weeks = []
      for (let i = period - 1; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i * 7)
        const key = getWeekStart(d)
        const w = byWeek[key] || { week: key, km: 0, runs: 0, fatigue: [], feel: [] }
        weeks.push({
          label: formatWeekLabel(new Date(key)),
          km: Math.round(w.km * 10) / 10,
          runs: w.runs,
          fatigue: w.fatigue.length ? Math.round(avg(w.fatigue) * 10) / 10 : null,
          feel: w.feel.length ? Math.round(avg(w.feel) * 10) / 10 : null,
        })
      }
      setWeeklyData(weeks)

      // Individual runs for the scatter/area
      setRunsData(updates.filter(u => u.distance_km).map(u => ({
        date: formatDate(new Date(u.created_at)),
        km: Math.round(Number(u.distance_km) * 10) / 10,
        fatigue: u.fatigue,
        feel: u.feel,
      })))
    }

    setLoading(false)
  }

  const totalKm = weeklyData.reduce((s, w) => s + w.km, 0)
  const avgWeeklyKm = weeklyData.length ? Math.round((totalKm / weeklyData.filter(w => w.km > 0).length || 0) * 10) / 10 : 0
  const totalRuns = weeklyData.reduce((s, w) => s + w.runs, 0)
  const bestWeek = weeklyData.reduce((best, w) => w.km > best ? w.km : best, 0)

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><span className="spinner" /></div>

  const noData = totalRuns === 0

  return (
    <div>
      {/* Header stats */}
      <div style={styles.statsRow}>
        <StatChip icon="🏃" label="סה״כ ק״מ" val={`${Math.round(totalKm)}`} unit='ק"מ' color="var(--teal)" colorL="var(--teal-l)" />
        <StatChip icon="📅" label="ממוצע שבועי" val={isNaN(avgWeeklyKm) ? '0' : String(avgWeeklyKm)} unit='ק"מ' color="var(--blue)" colorL="var(--blue-l)" />
        <StatChip icon="✅" label="ריצות" val={String(totalRuns)} unit="סה״כ" color="var(--green)" colorL="var(--green-l)" />
        <StatChip icon="🔥" label="שבוע שיא" val={String(bestWeek)} unit='ק"מ' color="var(--purple)" colorL="var(--purple-l)" />
      </div>

      {/* Period selector */}
      <div style={styles.periodRow}>
        {PERIODS.map(p => (
          <button key={p.weeks} onClick={() => setPeriod(p.weeks)}
            style={{ ...styles.periodBtn, ...(period === p.weeks ? styles.periodActive : {}) }}>
            {p.label}
          </button>
        ))}
      </div>

      {noData ? (
        <div style={styles.emptyCard}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>אין עדיין נתונים</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
            דווח על ריצות בלשונית "עדכון" וכאן יופיעו הגרפים של ההתקדמות שלך
          </div>
        </div>
      ) : (
        <>
          {/* Weekly km bar chart */}
          <ChartCard title='ק"מ שבועי' subtitle="נפח האימון לאורך זמן">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData} barSize={period <= 4 ? 28 : period <= 8 ? 20 : 14}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={28}
                  tickFormatter={v => v === 0 ? '' : v} />
                {profile?.weekly_km && (
                  <ReferenceLine y={Number(profile.weekly_km)} stroke="var(--teal)"
                    strokeDasharray="5 3" strokeOpacity={0.4}
                    label={{ value: `יעד ${profile.weekly_km}`, fill: 'var(--teal)', fontSize: 10, position: 'right' }} />
                )}
                <Tooltip content={<KmTooltip />} />
                <Bar dataKey="km" fill="var(--teal)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Individual runs area */}
          {runsData.length > 1 && (
            <ChartCard title="מרחק ריצות" subtitle="כל ריצה לפי תאריך">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={runsData}>
                  <defs>
                    <linearGradient id="kmGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--teal)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--teal)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                  <XAxis dataKey="date" tick={tickStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={28}
                    tickFormatter={v => v === 0 ? '' : v} />
                  <Tooltip content={<RunTooltip />} />
                  <Area type="monotone" dataKey="km" stroke="var(--teal)" strokeWidth={2.5}
                    fill="url(#kmGrad)" dot={{ fill: 'var(--teal)', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: 'var(--teal)' }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Fatigue & feel trends */}
          {weeklyData.some(w => w.fatigue !== null) && (
            <ChartCard title="עייפות ותחושה" subtitle="ממוצע שבועי — נמוך יותר = טוב יותר לעייפות">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={weeklyData}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={tickStyle} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} tick={tickStyle} axisLine={false} tickLine={false} width={22} />
                  <Tooltip content={<FatigueTooltip />} />
                  <Legend formatter={legendFormatter} iconType="circle" iconSize={8} />
                  <Line type="monotone" dataKey="fatigue" name="עייפות"
                    stroke="var(--amber)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--amber)', strokeWidth: 0 }}
                    activeDot={{ r: 5 }} connectNulls />
                  <Line type="monotone" dataKey="feel" name="תחושה"
                    stroke="var(--green)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--green)', strokeWidth: 0 }}
                    activeDot={{ r: 5 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────

function StatChip({ icon, label, val, unit, color, colorL }) {
  return (
    <div style={{ ...styles.statChip, background: 'var(--surface)' }}>
      <div style={{ ...styles.statIcon, background: colorL, color }}>{icon}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, color }}>
        {val}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)', marginRight: 2 }}>{unit}</span>
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function KmTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={ttStyle}>
      <div style={ttLabel}>{label}</div>
      <div style={{ color: 'var(--teal)', fontWeight: 600 }}>{payload[0].value} ק"מ</div>
    </div>
  )
}

function RunTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={ttStyle}>
      <div style={ttLabel}>{label}</div>
      <div style={{ color: 'var(--teal)', fontWeight: 600 }}>{payload[0].value} ק"מ</div>
    </div>
  )
}

function FatigueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={ttStyle}>
      <div style={ttLabel}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {p.value}/10
        </div>
      ))}
    </div>
  )
}

const legendFormatter = (value) => (
  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{value}</span>
)

// ── Helpers ──────────────────────────────

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function formatWeekLabel(date) {
  return `${date.getDate()}/${date.getMonth() + 1}`
}

function formatDate(date) {
  return `${date.getDate()}/${date.getMonth() + 1}`
}

function avg(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

const tickStyle = { fontSize: 11, fill: 'var(--text3)' }
const ttStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '8px 12px',
  boxShadow: 'var(--shadow)',
  fontSize: 13,
  direction: 'rtl',
}
const ttLabel = { fontSize: 11, color: 'var(--text3)', marginBottom: 4 }

const styles = {
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
    gap: 10,
    marginBottom: 14,
  },
  statChip: {
    borderRadius: 'var(--radius)',
    padding: '13px 13px',
    boxShadow: 'var(--shadow-sm)',
  },
  statIcon: {
    width: 30, height: 30,
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15,
    marginBottom: 8,
  },
  periodRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 14,
  },
  periodBtn: {
    padding: '7px 16px',
    borderRadius: 20,
    border: '1.5px solid var(--border2)',
    background: 'transparent',
    color: 'var(--text2)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all .15s',
  },
  periodActive: {
    background: 'var(--teal)',
    color: '#fff',
    borderColor: 'transparent',
    boxShadow: '0 2px 8px rgba(240,86,39,.30)',
  },
  emptyCard: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    padding: '48px 24px',
    textAlign: 'center',
    boxShadow: 'var(--shadow-sm)',
  },
}
