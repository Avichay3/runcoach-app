import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { callCoach, buildSystemPrompt } from '../lib/coach'

export default function CoachScreen({ profile, weeklyKm, pendingMessage, onConsumePending }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [trainingHistory, setTrainingHistory] = useState([])
  const boxRef = useRef(null)

  useEffect(() => { loadHistory(); loadTrainingHistory() }, [user])

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [messages, loading])

  useEffect(() => {
    if (pendingMessage && loaded) {
      send(pendingMessage)
      onConsumePending()
    }
  }, [pendingMessage, loaded])

  async function loadTrainingHistory() {
    if (!user) return
    const { data } = await supabase
      .from('daily_updates')
      .select('distance_km, pace, avg_hr, fatigue, pain, feel, actual_type, free_note, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (data) setTrainingHistory(data)
  }

  async function loadHistory() {
    if (!user) return
    const { data } = await supabase
      .from('chat_messages').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: true }).limit(50)
    if (data && data.length) {
      setMessages(data.map(m => ({ role: m.role, content: m.content })))
    } else {
      const greeting = profile?.goal
        ? `שלום! אני המאמן שלך. היעד שלנו: ${profile.goal} עד ${profile.target_date || 'התאריך שנקבע'}. דווח לי על אימון, שלח תוכנית, או שאל כל שאלה.`
        : 'שלום! כדי שאוכל ללוות אותך, התחל מהשלמת הפרופיל. אחר כך נבנה תוכנית ונתחיל לעקוב.'
      setMessages([{ role: 'assistant', content: greeting }])
      await persist('assistant', greeting)
    }
    setLoaded(true)
  }

  async function persist(role, content) {
    await supabase.from('chat_messages').insert({ user_id: user.id, role, content })
  }

  async function send(text) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setInput('')

    const userMsg = { role: 'user', content: trimmed }
    const next = [...messages, userMsg]
    setMessages(next)
    await persist('user', trimmed)

    setLoading(true)
    try {
      const history = next.slice(-20).map(m => ({ role: m.role, content: m.content }))
      const reply = await callCoach(history, buildSystemPrompt(profile, weeklyKm, trainingHistory))
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      await persist('assistant', reply)
    } catch {
      const errMsg = 'מצטער, הייתה שגיאה בחיבור למאמן. נסה שוב בעוד רגע.'
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.msgs} ref={boxRef}>
        {messages.map((m, i) => (
          <div key={i} style={{ ...styles.msg, ...(m.role === 'user' ? styles.msgUser : styles.msgCoach) }}>
            <div style={{ ...styles.av, ...(m.role === 'user' ? styles.avUser : styles.avCoach) }}>
              {m.role === 'user' ? 'אני' : 'AI'}
            </div>
            <div style={{ ...styles.bubble, ...(m.role === 'user' ? styles.bubbleUser : styles.bubbleCoach) }}>
              {m.role === 'user' ? m.content : <CoachMarkdown content={m.content} />}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ ...styles.msg, ...styles.msgCoach }}>
            <div style={{ ...styles.av, ...styles.avCoach }}>AI</div>
            <div style={{ ...styles.bubble, ...styles.bubbleCoach }}>
              <div style={styles.dots}>
                <span style={dot(0)} />
                <span style={dot(.18)} />
                <span style={dot(.36)} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={styles.inputRow}>
        <textarea
          style={styles.textarea}
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="כתוב למאמן..."
        />
        <button style={{ ...styles.sendBtn, ...(loading || !input.trim() ? styles.sendBtnDisabled : {}) }} onClick={() => send(input)} disabled={loading || !input.trim()} aria-label="שלח">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 17V4M4 10l6-6 6 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function CoachMarkdown({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p style={{ margin: '0 0 8px' }}>{children}</p>,
        strong: ({ children }) => <strong style={{ fontWeight: 700, color: 'var(--text)' }}>{children}</strong>,
        ul: ({ children }) => <ul style={{ margin: '4px 0 8px', paddingRight: 18, paddingLeft: 0 }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ margin: '4px 0 8px', paddingRight: 18, paddingLeft: 0 }}>{children}</ol>,
        li: ({ children }) => <li style={{ marginBottom: 3 }}>{children}</li>,
        h1: ({ children }) => <div style={mdHeading}>{children}</div>,
        h2: ({ children }) => <div style={mdHeading}>{children}</div>,
        h3: ({ children }) => <div style={mdHeading}>{children}</div>,
        hr: () => <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />,
        table: ({ children }) => (
          <div style={{ overflowX: 'auto', margin: '6px 0 10px' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead>{children}</thead>,
        th: ({ children }) => (
          <th style={{ border: '1px solid var(--border)', padding: '5px 8px', background: 'var(--surface2)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>{children}</th>
        ),
        td: ({ children }) => (
          <td style={{ border: '1px solid var(--border)', padding: '5px 8px', whiteSpace: 'nowrap', textAlign: 'right' }}>{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

const mdHeading = { fontSize: 14, fontWeight: 700, margin: '8px 0 4px' }

function dot(delay) {
  return {
    width: 7, height: 7, borderRadius: '50%',
    background: 'var(--text3)',
    display: 'inline-block',
    animation: `blink 1.4s ${delay}s infinite`,
  }
}

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 195px)',
    minHeight: 400,
  },
  msgs: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '4px 2px',
  },
  msg: {
    display: 'flex',
    gap: 9,
    maxWidth: '84%',
  },
  msgUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  msgCoach: { alignSelf: 'flex-start' },
  av: {
    width: 30, height: 30,
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, flexShrink: 0,
  },
  avCoach: {
    background: 'var(--purple-l)',
    color: 'var(--purple)',
  },
  avUser: {
    background: 'var(--teal)',
    color: '#fff',
  },
  bubble: {
    padding: '10px 14px',
    borderRadius: 14,
    fontSize: 14,
    lineHeight: 1.6,
    overflowWrap: 'anywhere',
  },
  bubbleCoach: {
    background: 'var(--surface)',
    boxShadow: 'var(--shadow-sm)',
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    background: 'var(--teal)',
    color: '#fff',
    boxShadow: '0 2px 6px rgba(240,86,39,.25)',
    borderBottomRightRadius: 4,
    whiteSpace: 'pre-wrap',
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-end',
    paddingTop: 12,
    borderTop: '1px solid var(--border)',
    marginTop: 10,
  },
  textarea: {
    flex: 1,
    resize: 'none',
    border: '1.5px solid var(--border2)',
    borderRadius: 14,
    padding: '10px 14px',
    fontSize: 14,
    background: 'var(--surface)',
    color: 'var(--text)',
    maxHeight: 120,
    outline: 'none',
    transition: 'border-color .15s',
    boxShadow: 'var(--shadow-sm)',
  },
  sendBtn: {
    width: 42, height: 42,
    borderRadius: '50%',
    background: 'var(--teal)',
    border: 'none',
    color: '#fff',
    flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(240,86,39,.35)',
    transition: 'all .15s',
  },
  sendBtnDisabled: {
    background: 'var(--surface2)',
    color: 'var(--text3)',
    boxShadow: 'none',
  },
  dots: { display: 'flex', gap: 5, alignItems: 'center', padding: '2px 0' },
}
