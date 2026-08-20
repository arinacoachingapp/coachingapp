import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addAdminEmail,
  fetchAdminSettings,
  getAdminPrompt,
  getAdminPromptVersion,
  listAdminEmails,
  listAdminPrompts,
  removeAdminEmail,
  restoreAdminPrompt,
  saveAdminPrompt,
  saveAdminSettings,
} from '@/lib/adminApi'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function simpleDiff(before, after) {
  const a = (before || '').split('\n')
  const b = (after || '').split('\n')
  const max = Math.max(a.length, b.length)
  const rows = []
  for (let i = 0; i < max; i++) {
    const left = a[i]
    const right = b[i]
    if (left === right) continue
    if (left != null && right == null) rows.push({ type: 'remove', line: i + 1, text: left })
    else if (left == null && right != null) rows.push({ type: 'add', line: i + 1, text: right })
    else rows.push({ type: 'change', line: i + 1, before: left, after: right })
  }
  return rows.slice(0, 200)
}

export default function AdminPromptsPage() {
  const [tab, setTab] = useState('prompts')
  const [prompts, setPrompts] = useState([])
  const [selectedKey, setSelectedKey] = useState(null)
  const [prompt, setPrompt] = useState(null)
  const [versions, setVersions] = useState([])
  const [draft, setDraft] = useState('')
  const [changeNote, setChangeNote] = useState('')
  const [admins, setAdmins] = useState([])
  const [newAdmin, setNewAdmin] = useState('')
  const [settings, setSettings] = useState([])
  const [settingsDraft, setSettingsDraft] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [compareVersion, setCompareVersion] = useState(null)
  const [compareContent, setCompareContent] = useState('')
  const [previewVersion, setPreviewVersion] = useState(null)

  const dirty = useMemo(() => prompt && draft !== prompt.content, [draft, prompt])

  const settingsDirty = useMemo(() => {
    if (!settings.length) return false
    return settings.some((s) => settingsDraft[s.key] !== s.value)
  }, [settings, settingsDraft])

  const loadList = async () => {
    const data = await listAdminPrompts()
    setPrompts(data.prompts || [])
    if (!selectedKey && data.prompts?.[0]) {
      setSelectedKey(data.prompts[0].key)
    }
  }

  const loadPrompt = async (key) => {
    if (!key) return
    const data = await getAdminPrompt(key)
    setPrompt(data.prompt)
    setVersions(data.versions || [])
    setDraft(data.prompt?.content || '')
    setChangeNote('')
    setCompareVersion(null)
    setCompareContent('')
    setPreviewVersion(null)
  }

  const loadAdmins = async () => {
    const data = await listAdminEmails()
    setAdmins(data.admins || [])
  }

  const loadSettings = async () => {
    const data = await fetchAdminSettings()
    const rows = data.settings || []
    setSettings(rows)
    setSettingsDraft(Object.fromEntries(rows.map((s) => [s.key, s.value])))
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await listAdminPrompts()
        if (cancelled) return
        const rows = data.prompts || []
        setPrompts(rows)
        if (!selectedKey && rows[0]) {
          setSelectedKey(rows[0].key)
        }
        // Prefetch Models tab data so switching tabs is instant
        fetchAdminSettings().catch(() => {})
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // intentionally only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedKey) return
    let cancelled = false
    ;(async () => {
      setError('')
      try {
        await loadPrompt(selectedKey)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedKey])

  useEffect(() => {
    if (tab !== 'admins') return
    let cancelled = false
    ;(async () => {
      try {
        await loadAdmins()
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab])

  useEffect(() => {
    if (tab !== 'settings') return
    let cancelled = false
    ;(async () => {
      setError('')
      try {
        await loadSettings()
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab])

  const handleSaveSettings = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const data = await saveAdminSettings(settingsDraft)
      const rows = data.settings || []
      setSettings(rows)
      setSettingsDraft(Object.fromEntries(rows.map((s) => [s.key, s.value])))
      setNotice('Settings saved')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!selectedKey || !dirty) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const data = await saveAdminPrompt(selectedKey, {
        content: draft,
        changeNote,
      })
      setPrompt(data.prompt)
      setVersions(data.versions || [])
      setDraft(data.prompt.content)
      setChangeNote('')
      setNotice(`Saved as version ${data.prompt.current_version}`)
      await loadList()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = async (version) => {
    if (!selectedKey) return
    if (!window.confirm(`Restore version ${version}? This creates a new version with that content.`)) {
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const data = await restoreAdminPrompt(selectedKey, version)
      setPrompt(data.prompt)
      setVersions(data.versions || [])
      setDraft(data.prompt.content)
      setNotice(`Restored version ${version} as new version ${data.prompt.current_version}`)
      await loadList()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePreviewVersion = async (version) => {
    setError('')
    try {
      const data = await getAdminPromptVersion(selectedKey, version)
      setPreviewVersion(data.version)
      setCompareVersion(version)
      setCompareContent(data.version.content)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCompare = async (version) => {
    setError('')
    try {
      const data = await getAdminPromptVersion(selectedKey, version)
      setCompareVersion(version)
      setCompareContent(data.version.content)
      setPreviewVersion(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAddAdmin = async () => {
    setError('')
    setNotice('')
    try {
      await addAdminEmail(newAdmin)
      setNewAdmin('')
      setNotice('Admin added')
      await loadAdmins()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleRemoveAdmin = async (email) => {
    if (!window.confirm(`Remove admin access for ${email}?`)) return
    setError('')
    try {
      await removeAdminEmail(email)
      await loadAdmins()
    } catch (err) {
      setError(err.message)
    }
  }

  const diffRows = compareVersion != null ? simpleDiff(compareContent, draft) : []

  return (
    <div className="min-h-dvh bg-[#F7F5F1] text-stone-800">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-[#F7F5F1]/90 backdrop-blur-sm pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto max-w-6xl px-5 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/"
              className="shrink-0 text-xs font-medium uppercase tracking-[0.15em] text-stone-400 hover:text-stone-700"
            >
              ← Companion
            </Link>
            <p className="truncate text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
              Admin
            </p>
            <div className="w-16 shrink-0 sm:w-20" aria-hidden />
          </div>

          <div className="-mx-1 mt-3 flex gap-1 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:mt-4 sm:overflow-visible sm:pb-0">
            <button
              type="button"
              onClick={() => setTab('prompts')}
              className={`shrink-0 rounded-sm px-3 py-2 text-[10px] font-medium uppercase tracking-wider sm:px-2.5 sm:py-1.5 ${
                tab === 'prompts' ? 'bg-stone-900 text-[#F7F5F1]' : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              Prompts
            </button>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className={`shrink-0 rounded-sm px-3 py-2 text-[10px] font-medium uppercase tracking-wider sm:px-2.5 sm:py-1.5 ${
                tab === 'settings' ? 'bg-stone-900 text-[#F7F5F1]' : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              Models
            </button>
            <button
              type="button"
              onClick={() => setTab('admins')}
              className={`shrink-0 rounded-sm px-3 py-2 text-[10px] font-medium uppercase tracking-wider sm:px-2.5 sm:py-1.5 ${
                tab === 'admins' ? 'bg-stone-900 text-[#F7F5F1]' : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              Admins
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        {error && (
          <div className="mb-6 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-6 rounded-sm border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
            {notice}
          </div>
        )}

        {loading && <p className="text-sm text-stone-400">Loading…</p>}

        {!loading && tab === 'prompts' && (
          <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="space-y-2">
              <h1 className="mb-4 font-serif text-2xl text-stone-900">Prompts</h1>
              {prompts.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSelectedKey(p.key)}
                  className={`block w-full rounded-sm border px-3 py-3 text-left transition-colors ${
                    selectedKey === p.key
                      ? 'border-stone-800 bg-white'
                      : 'border-stone-200 bg-white/60 hover:border-stone-300'
                  }`}
                >
                  <p className="text-sm font-medium text-stone-800">{p.title}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-stone-400">
                    v{p.current_version || 0} · {p.format}
                  </p>
                </button>
              ))}
            </aside>

            <section className="min-w-0 space-y-5">
              {prompt && (
                <>
                  <div>
                    <h2 className="font-serif text-2xl text-stone-900 sm:text-3xl">{prompt.title}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
                      {prompt.description}
                    </p>
                    <p className="mt-2 text-xs text-stone-400">
                      Current version {prompt.current_version}
                      {prompt.updated_by_email ? ` · last edit by ${prompt.updated_by_email}` : ''}
                      {prompt.updated_at ? ` · ${formatDate(prompt.updated_at)}` : ''}
                    </p>
                  </div>

                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.15em] text-stone-400">
                      Change note
                    </span>
                    <input
                      value={changeNote}
                      onChange={(e) => setChangeNote(e.target.value)}
                      placeholder="What changed and why?"
                      className="mt-2 w-full rounded-sm border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-stone-400"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-[0.15em] text-stone-400">
                      Content
                    </span>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      spellCheck={false}
                      rows={24}
                      className="mt-2 w-full resize-y rounded-sm border border-stone-200 bg-white px-4 py-3 font-mono text-xs leading-relaxed text-stone-800 outline-none focus:border-stone-400"
                    />
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!dirty || saving}
                      className="rounded-sm bg-stone-900 px-5 py-3 text-sm font-medium text-[#F7F5F1] disabled:opacity-40"
                    >
                      {saving ? 'Saving…' : dirty ? 'Save new version' : 'No changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(prompt.content)
                        setChangeNote('')
                      }}
                      disabled={!dirty || saving}
                      className="rounded-sm border border-stone-300 px-5 py-3 text-sm text-stone-600 disabled:opacity-40"
                    >
                      Reset draft
                    </button>
                  </div>

                  <div className="grid gap-6 border-t border-stone-200 pt-8 lg:grid-cols-2">
                    <div>
                      <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-stone-400">
                        Version history
                      </h3>
                      <ul className="mt-4 space-y-2">
                        {versions.length === 0 && (
                          <li className="text-sm text-stone-400">No versions yet — save to create history.</li>
                        )}
                        {versions.map((v) => (
                          <li
                            key={v.id || v.version}
                            className="rounded-sm border border-stone-200 bg-white p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-stone-800">
                                  Version {v.version}
                                  {v.version === prompt.current_version ? ' (current)' : ''}
                                </p>
                                <p className="mt-1 text-xs text-stone-500">
                                  {v.change_note || '—'}
                                </p>
                                <p className="mt-1 text-[10px] uppercase tracking-wider text-stone-400">
                                  {v.created_by_email || 'unknown'} · {formatDate(v.created_at)}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCompare(v.version)}
                                  className="text-[10px] uppercase tracking-wider text-stone-500 hover:text-stone-800"
                                >
                                  Diff
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePreviewVersion(v.version)}
                                  className="text-[10px] uppercase tracking-wider text-stone-500 hover:text-stone-800"
                                >
                                  View
                                </button>
                                {v.version !== prompt.current_version && (
                                  <button
                                    type="button"
                                    onClick={() => handleRestore(v.version)}
                                    className="text-[10px] uppercase tracking-wider text-stone-500 hover:text-stone-800"
                                  >
                                    Restore
                                  </button>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-stone-400">
                        {previewVersion
                          ? `Version ${previewVersion.version} content`
                          : compareVersion != null
                            ? `Changes vs version ${compareVersion}`
                            : 'Diff / preview'}
                      </h3>
                      {previewVersion && (
                        <pre className="mt-4 max-h-[28rem] overflow-auto rounded-sm border border-stone-200 bg-white p-4 font-mono text-xs leading-relaxed text-stone-700 whitespace-pre-wrap">
                          {previewVersion.content}
                        </pre>
                      )}
                      {!previewVersion && compareVersion != null && (
                        <div className="mt-4 max-h-[28rem] space-y-2 overflow-auto rounded-sm border border-stone-200 bg-white p-4">
                          {diffRows.length === 0 && (
                            <p className="text-sm text-stone-400">No line differences vs current draft.</p>
                          )}
                          {diffRows.map((row) => (
                            <div key={`${row.type}-${row.line}`} className="font-mono text-xs">
                              <span className="text-stone-400">L{row.line}</span>{' '}
                              {row.type === 'add' && (
                                <span className="text-emerald-700">+ {row.text}</span>
                              )}
                              {row.type === 'remove' && (
                                <span className="text-red-700">− {row.text}</span>
                              )}
                              {row.type === 'change' && (
                                <span>
                                  <span className="block text-red-700">− {row.before}</span>
                                  <span className="block text-emerald-700">+ {row.after}</span>
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {!previewVersion && compareVersion == null && (
                        <p className="mt-4 text-sm text-stone-400">
                          Choose Diff or View on a history entry to inspect changes.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {!loading && tab === 'settings' && (
          <div className="mx-auto max-w-xl space-y-8">
            <div>
              <h1 className="font-serif text-3xl text-stone-900">Models & defaults</h1>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">
                Choose which OpenRouter chat model and ElevenLabs TTS model the app uses, and the
                default narrator voice for users who have not picked one yet.
              </p>
            </div>

            <div className="space-y-6">
              {settings.map((setting) => (
                <label key={setting.key} className="block rounded-sm border border-stone-200 bg-white p-5">
                  <span className="text-sm font-medium text-stone-800">{setting.title}</span>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">{setting.description}</p>
                  <select
                    value={settingsDraft[setting.key] || setting.value}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({ ...prev, [setting.key]: e.target.value }))
                    }
                    className="mt-4 w-full rounded-sm border border-stone-200 bg-[#F7F5F1] px-3 py-2.5 text-sm text-stone-800 outline-none focus:border-stone-400"
                  >
                    {(setting.options || []).map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-stone-400">
                    {setting.updated_by_email
                      ? `Last set by ${setting.updated_by_email}${
                          setting.updated_at ? ` · ${formatDate(setting.updated_at)}` : ''
                        }`
                      : 'Using seed / default'}
                  </p>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={!settingsDirty || saving}
              className="w-full rounded-sm bg-stone-900 py-3 text-sm font-medium text-[#F7F5F1] disabled:opacity-40"
            >
              {saving ? 'Saving…' : settingsDirty ? 'Save settings' : 'No changes'}
            </button>
          </div>
        )}

        {!loading && tab === 'admins' && (
          <div className="mx-auto max-w-xl space-y-8">
            <div>
              <h1 className="font-serif text-3xl text-stone-900">Admins</h1>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">
                Only these emails can open this panel and edit prompts. Add people who already have
                accounts.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={newAdmin}
                onChange={(e) => setNewAdmin(e.target.value)}
                placeholder="email@company.com"
                className="min-w-0 flex-1 rounded-sm border border-stone-200 bg-white px-3 py-2.5 text-base outline-none focus:border-stone-400 sm:text-sm"
              />
              <button
                type="button"
                onClick={handleAddAdmin}
                className="shrink-0 rounded-sm bg-stone-900 px-4 py-2.5 text-sm text-[#F7F5F1] sm:py-2"
              >
                Add
              </button>
            </div>

            <ul className="space-y-2">
              {admins.map((a) => (
                <li
                  key={a.email}
                  className="flex items-center justify-between gap-3 rounded-sm border border-stone-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-stone-800">{a.email}</p>
                    <p className="text-[10px] uppercase tracking-wider text-stone-400">
                      {formatDate(a.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAdmin(a.email)}
                    className="text-xs text-stone-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}
