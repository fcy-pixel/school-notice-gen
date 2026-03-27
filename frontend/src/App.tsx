import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type TemplateItem = {
  id: string
  name: string
}

type NoticeResult = {
  title: string
  recipient: string
  body: string
  closing: string
}

const API_BASE = 'http://localhost:8000'

function App() {
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [templateId, setTemplateId] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  const [noticeTypes, setNoticeTypes] = useState<string[]>([])
  const [noticeType, setNoticeType] = useState('')
  const [fields, setFields] = useState<string[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})

  const [schoolName, setSchoolName] = useState('香港示範學校')
  const [extraInstructions, setExtraInstructions] = useState('')
  const [notice, setNotice] = useState<NoticeResult | null>(null)

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const isReadyToGenerate = useMemo(() => {
    return Boolean(templateId && noticeType && schoolName.trim())
  }, [templateId, noticeType, schoolName])

  useEffect(() => {
    void loadTemplates()
    void loadTypes()
  }, [])

  useEffect(() => {
    if (!noticeType) {
      setFields([])
      return
    }
    void loadFields(noticeType)
  }, [noticeType])

  const loadTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/templates/`)
      const data = (await res.json()) as { templates: TemplateItem[] }
      setTemplates(data.templates)
      if (data.templates.length > 0 && !templateId) {
        setTemplateId(data.templates[0].id)
      }
    } catch {
      setMessage('無法載入範本清單，請確認後端已啟動。')
    }
  }

  const loadTypes = async () => {
    try {
      const res = await fetch(`${API_BASE}/generate/types`)
      const data = (await res.json()) as { types: string[] }
      setNoticeTypes(data.types)
      if (data.types.length > 0) {
        setNoticeType(data.types[0])
      }
    } catch {
      setMessage('無法載入通告類型。')
    }
  }

  const loadFields = async (type: string) => {
    try {
      const res = await fetch(`${API_BASE}/generate/fields/${encodeURIComponent(type)}`)
      const data = (await res.json()) as { fields: string[] }
      setFields(data.fields)
      const nextValues: Record<string, string> = {}
      for (const key of data.fields) {
        nextValues[key] = fieldValues[key] ?? ''
      }
      setFieldValues(nextValues)
    } catch {
      setMessage('無法載入欄位設定。')
    }
  }

  const handleUploadTemplate = async (event: FormEvent) => {
    event.preventDefault()
    if (!uploadFile) {
      setMessage('請先選擇 .docx 範本。')
      return
    }

    const form = new FormData()
    form.append('file', uploadFile)

    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`${API_BASE}/templates/upload`, {
        method: 'POST',
        body: form,
      })
      const data = (await res.json()) as { detail?: string }
      if (!res.ok) {
        throw new Error(data.detail ?? '上傳失敗')
      }
      setUploadFile(null)
      setMessage('範本上傳成功。')
      await loadTemplates()
    } catch (error) {
      const err = error as Error
      setMessage(`範本上傳失敗：${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDefaultTemplate = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`${API_BASE}/templates/create-default`, { method: 'POST' })
      const data = (await res.json()) as { detail?: string }
      if (!res.ok) {
        throw new Error(data.detail ?? '建立預設範本失敗')
      }
      await loadTemplates()
      setMessage('已建立預設範本。')
    } catch (error) {
      const err = error as Error
      setMessage(`建立預設範本失敗：${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault()
    if (!isReadyToGenerate) {
      setMessage('請先完成範本、學校名稱與通告類型設定。')
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`${API_BASE}/generate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notice_type: noticeType,
          school_name: schoolName,
          fields: fieldValues,
          extra_instructions: extraInstructions,
        }),
      })
      const data = (await res.json()) as { detail?: string; notice?: NoticeResult }
      if (!res.ok || !data.notice) {
        throw new Error(data.detail ?? 'AI 生成失敗')
      }
      setNotice(data.notice)
      setMessage('通告草稿已生成，可先編輯再匯出 Word。')
    } catch (error) {
      const err = error as Error
      setMessage(`AI 生成失敗：${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!notice || !templateId) {
      setMessage('請先生成通告內容並選擇範本。')
      return
    }

    setLoading(true)
    setMessage('')
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
      setMessage('Word 檔案已下載。')
    } catch (error) {
      const err = error as Error
      setMessage(`Word 匯出失敗：${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const updateNoticeField = (key: keyof NoticeResult, value: string) => {
    if (!notice) return
    setNotice({ ...notice, [key]: value })
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">香港學校行政工具</p>
        <h1>學校自動出通告系統</h1>
        <p className="subtitle">上傳既有 Word 範本，AI 生成繁體中文通告，直接下載 .docx。</p>
      </header>

      <section className="panel">
        <h2>1. 範本管理</h2>
        <div className="row">
          <form onSubmit={handleUploadTemplate} className="inline-form">
            <input
              type="file"
              accept=".docx"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
            <button disabled={loading} type="submit">上傳範本</button>
          </form>
          <button disabled={loading} onClick={handleCreateDefaultTemplate} type="button">
            建立預設範本
          </button>
        </div>
        <label className="field">
          <span>選擇範本</span>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">請選擇</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel">
        <h2>2. 生成通告內容</h2>
        <form onSubmit={handleGenerate} className="grid-form">
          <label className="field">
            <span>學校名稱</span>
            <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
          </label>

          <label className="field">
            <span>通告類型</span>
            <select value={noticeType} onChange={(e) => setNoticeType(e.target.value)}>
              {noticeTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          {fields.map((field) => (
            <label key={field} className="field">
              <span>{field}</span>
              <input
                value={fieldValues[field] ?? ''}
                onChange={(e) => setFieldValues({ ...fieldValues, [field]: e.target.value })}
              />
            </label>
          ))}

          <label className="field full">
            <span>額外要求（可選）</span>
            <textarea
              rows={3}
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              placeholder="例：語氣更簡潔、加入回條提醒、適用小四至小六"
            />
          </label>

          <div className="actions full">
            <button disabled={loading || !isReadyToGenerate} type="submit">
              {loading ? '生成中...' : 'AI 生成通告'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>3. 校對與匯出 Word</h2>
        {!notice && <p className="hint">請先在上方生成通告草稿。</p>}

        {notice && (
          <div className="grid-form">
            <label className="field full">
              <span>標題</span>
              <input value={notice.title} onChange={(e) => updateNoticeField('title', e.target.value)} />
            </label>

            <label className="field full">
              <span>收件人</span>
              <input
                value={notice.recipient}
                onChange={(e) => updateNoticeField('recipient', e.target.value)}
              />
            </label>

            <label className="field full">
              <span>正文</span>
              <textarea
                rows={12}
                value={notice.body}
                onChange={(e) => updateNoticeField('body', e.target.value)}
              />
            </label>

            <label className="field full">
              <span>落款</span>
              <textarea
                rows={3}
                value={notice.closing}
                onChange={(e) => updateNoticeField('closing', e.target.value)}
              />
            </label>

            <div className="actions full">
              <button disabled={loading || !templateId} onClick={handleExport} type="button">
                {loading ? '處理中...' : '下載 Word (.docx)'}
              </button>
            </div>
          </div>
        )}
      </section>

      {message && <p className="status">{message}</p>}
    </main>
  )
}

export default App
