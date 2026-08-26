'use client'

import { useState, useTransition, useEffect } from 'react'
import { X, Server, AlertCircle, Link2, Clock } from 'lucide-react'
import { createMonitor, updateMonitor } from '@/app/dashboard/actions'
import { Project, Monitor } from '@/types/database'

interface MonitorModalProps {
  isOpen: boolean
  onClose: () => void
  projects: Project[]
  selectedProjectId?: string
  monitorToEdit?: Monitor | null
  onLimitReached?: (errorMsg: string) => void
}

export default function MonitorModal({
  isOpen,
  onClose,
  projects,
  selectedProjectId,
  monitorToEdit,
  onLimitReached,
}: MonitorModalProps) {
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [interval, setInterval] = useState('5')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (monitorToEdit) {
      setName(monitorToEdit.name)
      setUrl(monitorToEdit.url)
      setInterval(String(monitorToEdit.check_interval_minutes || 5))
      setProjectId(monitorToEdit.project_id)
    } else {
      setName('')
      setUrl('')
      setInterval('5')
      setProjectId(selectedProjectId || projects[0]?.id || '')
    }
    setErrorMessage(null)
  }, [monitorToEdit, selectedProjectId, projects, isOpen])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    const formData = new FormData()
    formData.append('projectId', projectId)
    formData.append('name', name)
    formData.append('url', url)
    formData.append('checkIntervalMinutes', interval)

    startTransition(async () => {
      let result
      if (monitorToEdit) {
        result = await updateMonitor(monitorToEdit.id, formData)
      } else {
        result = await createMonitor(formData)
      }

      if (result?.error) {
        if (result.isLimitReached && onLimitReached) {
          onClose()
          onLimitReached(result.error)
        } else {
          setErrorMessage(result.error)
        }
      } else {
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {monitorToEdit ? 'Edit Monitor' : 'Add New Monitor'}
            </h3>
            <p className="text-xs text-slate-400">
              Configure automatic HTTP uptime checks
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Project Dropdown */}
          {!monitorToEdit && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="projectSelect">
                Target Project
              </label>
              <select
                id="projectSelect"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Monitor Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="monitorName">
              Friendly Name
            </label>
            <input
              id="monitorName"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Landing Page, Auth API"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          {/* Monitor URL */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="monitorUrl">
              URL to Monitor
            </label>
            <div className="relative">
              <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                id="monitorUrl"
                type="text"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/api/health"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Check Interval */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="checkInterval">
              Check Frequency
            </label>
            <div className="relative">
              <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                id="checkInterval"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-3.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              >
                <option value="1">Every 1 minute</option>
                <option value="5">Every 5 minutes (Default)</option>
                <option value="15">Every 15 minutes</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isPending && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <span>{monitorToEdit ? 'Save Changes' : 'Add Monitor'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

