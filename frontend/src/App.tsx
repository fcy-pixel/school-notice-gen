import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_BASE = 'http://localhost:8000'

// ── Types ──────────────────────────────────────────────────────────
type Role = 'user' | 'assistant'

interface Message {
  id: number
  role: Role
  content: string
  isTyping?: boolean
}

interface Notice {
  title: string
  recipient: string
  body: string
  closing: string
}

// ── Constants ──────────────────────────────────────────────────────
const WELCOME_MESSAGE: Message = {
  id: 0,
  role: 'assistant',
  content:
    '你好！👋 我係**通告小幫手**，幫你快速生成香港學校通告。\n\n你今次想出邊種通告呢？',
}

const NOTICE_TYPE_CHIPS = [
  '活動通告',
  '家長通告',
  '考試測驗通知',
  '繳費通知',
  '緊急通告',
  '其他通告',
]

// ── Helpers ────────────────────────────────────────────────────────
let _msgId = 1
const nextId = () => _msgId++

/** 把 **粗體** 轉成 <strong>，換行轉 <br> */
function renderMarkdown(text: string) {
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
  return { __html: html }
}

interface TemplateItem {
  id: string
  name: string
}

// ── App ────────────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [chips, setChips] = useState<string[]>(NOTICE_TYPE_CHIPS)
  const [loading, setLoading] = useState(false)

  const [schoolName, setSchoolName] = useState('中華基督教會基慈小學')
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [templateId, setTemplateId] = useState('')

  const [notice, setNotice] = useState<Notice | null>(null)
  const [exportLoading, setExportLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load templates on mount
  useEffect(() => {
    fetch(`${API_BASE}/templates/`)
      .then((r) => r.json())
      .then((d: { templates: TemplateItem[] }) => {
        setTemplates(d.templates)
        if (d.templates.length > 0) setTemplateId(d.templates[0].id)
      })
      .catch(() => {})
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, notice])

  // ── Send message ────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: Message = { id: nextId(), role: 'user', content: text }
    const typingMsg: Message = { id: nextId(), role: 'assistant', content: '', isTyping: true }

    setMessages((prev) => [...prev, userMsg, typingMsg])
    setInput('')
    setChips([])
    setLoading(true)
    setNotice(null)

    // Build history for API (exclude typing placeholder)
    const history = [...messages, userMsg]
      .filter((m) => !m.isTyping)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch(`${API_BASE}/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, school_name: schoolName }),
      })
      const data = (await res.json()) as {
        reply: string
        status: string
        notice?: Notice
        suggested_replies?: string[]
        detail?: string
      }

      if (!res.ok) throw new Error(data.detail ?? '發生錯誤')

      const assistantMsg: Message = { id: nextId(), role: 'assistant', content: data.reply }
      setMessages((prev) => [...prev.filter((m) => !m.isTyping), assistantMsg])

      if (data.status === 'generated' && data.notice) {
        setNotice(data.notice)
      }
      setChips(data.suggested_replies ?? [])
    } catch (err) {
      const errMsg: Message = {
        id: nextId(),
        role: 'assistant',
        content: `❌ 出錯了：${(err as Error).message}`,
      }
      setMessages((prev) => [...prev.filter((m) => !m.isTyping), errMsg])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  // ── Reset chat ──────────────────────────────────────────────────
  const handleReset = () => {
    setMessages([WELCOME_MESSAGE])
    setChips(NOTICE_TYPE_CHIPS)
    setNotice(null)
    setInput('')
    setStatusMsg('')
    inputRef.current?.focus()
  }

  // ── Export Word ─────────────────────────────────────────────────
  const handleExport = async () => {
    if (!notice || !templateId) {
      setStatusMsg('請先選擇範本，再下載通告。')
      return
    }
    setExportLoading(true)
    setStatusMsg('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await fetch(`${API_BASE}/export/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          title: notice.title,
          recipient: notice.recipient,
          body: notice.body,
          closing: notice.closing,
          school_name: schoolName,
          date: today,
        }),
      })
      if (!res.ok) {
        const err = (await res.json()) as { detail?: string }
        throw new Error(err.detail ?? '匯出失敗')
      }
      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${notice.title || '通告'}.docx`
      link.click()
      URL.revokeObjectURL(link.href)
      setStatusMsg('✅ Word 檔案已下載。')
    } catch (err) {
      setStatusMsg(`❌ 匯出失敗：${(err as Error).message}`)
    } finally {
      setExportLoading(false)
    }
  }

  const updateNotice = (key: keyof Notice, value: string) => {
    if (!notice) return
    setNotice({ ...notice, [key]: value })
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/logo.png" alt="校徽" className="school-logo" />
          <h1 className="app-title">學校通告<br />生成器</h1>
        </div>

        <div className="sidebar-section">
          <label className="sidebar-label">學校名稱</label>
          <input
            className="sidebar-input"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
          />
        </div>

        <div className="sidebar-section">
          <label className="sidebar-label">Word 範本</label>
          <select
            className="sidebar-input"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">（未選擇）</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {templates.length === 0 && (
            <p className="sidebar-hint">後端未啟動或無範本</p>
          )}
        </div>

        <button className="reset-btn" onClick={handleReset}>
          🔄 重新開始
        </button>

        <div className="sidebar-footer">
          <p>中華基督教會基慈小學</p>
          <p>學校行政工具</p>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="chat-main">
        {/* Messages */}
        <div className="messages-area">
          {messages.map((msg) => (
            <div key={msg.id} className={`msg-row ${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="avatar">🤖</div>
              )}
              <div className={`bubble ${msg.role}${msg.isTyping ? ' typing' : ''}`}>
                {msg.isTyping ? (
                  <span className="dots"><span /><span /><span /></span>
                ) : (
                  <span dangerouslySetInnerHTML={renderMarkdown(msg.content)} />
                )}
              </div>
              {msg.role === 'user' && (
                <div className="avatar user-avatar">🧑‍💼</div>
              )}
            </div>
          ))}

          {/* Notice Preview */}
          {notice && (
            <div className="notice-preview">
              <div className="notice-preview-header">
                <span>📄 通告草稿已生成 — 可直接編輯後下載</span>
              </div>
              <div className="notice-fields">
                <label>
                  <span>標題</span>
                  <input value={notice.title} onChange={(e) => updateNotice('title', e.target.value)} />
                </label>
                <label>
                  <span>收件人</span>
                  <input value={notice.recipient} onChange={(e) => updateNotice('recipient', e.target.value)} />
                </label>
                <label>
                  <span>正文</span>
                  <textarea rows={10} value={notice.body} onChange={(e) => updateNotice('body', e.target.value)} />
                </label>
                <label>
                  <span>落款</span>
                  <textarea rows={3} value={notice.closing} onChange={(e) => updateNotice('closing', e.target.value)} />
                </label>
              </div>
              <div className="notice-actions">
                {statusMsg && <span className="status-msg">{statusMsg}</span>}
                <button
                  className="export-btn"
                  disabled={exportLoading || !templateId}
                  onClick={handleExport}
                >
                  {exportLoading ? '處理中⋯' : '⬇️ 下載 Word (.docx)'}
                </button>
              </div>
              {!templateId && (
                <p className="notice-hint">請先在左側選擇 Word 範本才可下載</p>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick reply chips */}
        {chips.length > 0 && !loading && (
          <div className="chips-row">
            {chips.map((c) => (
              <button key={c} className="chip" onClick={() => sendMessage(c)}>
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <form
          className="input-bar"
          onSubmit={(e) => {
            e.preventDefault()
            void sendMessage(input)
          }}
        >
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="輸入訊息⋯⋯（Shift+Enter 換行，Enter 發送）"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void sendMessage(input)
              }
            }}
          />
          <button type="submit" className="send-btn" disabled={loading || !input.trim()}>
            {loading ? '⋯' : '➤'}
          </button>
        </form>
      </main>
    </div>
  )
}

