'use client'

import { useState, useTransition } from 'react'
import { Project, Monitor } from '@/types/database'
import {
  Folder,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  Clock,
  Server,
} from 'lucide-react'
import { deleteProject, deleteMonitor, toggleMonitorActive } from '@/app/dashboard/actions'
import { FREE_TIER_LIMITS } from '@/lib/constants'

interface ProjectCardProps {
  project: Project
  monitors: Monitor[]
  onEditProject: (project: Project) => void
  onAddMonitor: (projectId: string) => void
  onEditMonitor: (monitor: Monitor) => void
  onLimitReached: (msg: string) => void
}

export default function ProjectCard({
  project,
  monitors,
  onEditProject,
  onAddMonitor,
  onEditMonitor,
  onLimitReached,
}: ProjectCardProps) {
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [isDeletingProject, startDeleteProjectTransition] = useTransition()

  const monitorCount = monitors.length
  const isMonitorLimitReached = monitorCount >= FREE_TIER_LIMITS.MAX_MONITORS_PER_PROJECT

  function handleDeleteProject() {
    if (confirm(`Are you sure you want to delete project "${project.name}" and all its monitors?`)) {
      startDeleteProjectTransition(async () => {
        await deleteProject(project.id)
      })
    }
  }

  function handleAddMonitorClick() {
    if (isMonitorLimitReached) {
      onLimitReached(
        `Free tier limit reached: You can create a maximum of ${FREE_TIER_LIMITS.MAX_MONITORS_PER_PROJECT} monitors per project.`
      )
    } else {
      onAddMonitor(project.id)
    }
  }

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
      {/* Project Header */}
      <div className="p-5 border-b border-slate-800/60 bg-slate-950/40 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">{project.name}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {monitorCount} / {FREE_TIER_LIMITS.MAX_MONITORS_PER_PROJECT} Monitors
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Created {new Date(project.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 relative">
          <button
            onClick={handleAddMonitorClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Monitor</span>
          </button>

          <button
            onClick={() => setShowProjectMenu(!showProjectMenu)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Project Dropdown Menu */}
          {showProjectMenu && (
            <div className="absolute right-0 top-9 w-40 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-20">
              <button
                onClick={() => {
                  setShowProjectMenu(false)
                  onEditProject(project)
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Rename Project</span>
              </button>
              <button
                onClick={() => {
                  setShowProjectMenu(false)
                  handleDeleteProject()
                }}
                disabled={isDeletingProject}
                className="w-full text-left px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete Project</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Monitors List */}
      <div className="divide-y divide-slate-800/40">
        {monitors.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <Server className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs text-slate-400 font-medium">No monitors in this project yet</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Add your first monitor to start tracking HTTP uptime and response time.
            </p>
            <button
              onClick={handleAddMonitorClick}
              className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Monitor Now</span>
            </button>
          </div>
        ) : (
          monitors.map((monitor) => (
            <MonitorRow
              key={monitor.id}
              monitor={monitor}
              onEdit={() => onEditMonitor(monitor)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function MonitorRow({
  monitor,
  onEdit,
}: {
  monitor: Monitor
  onEdit: () => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleToggleActive() {
    startTransition(async () => {
      await toggleMonitorActive(monitor.id, !monitor.is_active)
    })
  }

  function handleDelete() {
    if (confirm(`Delete monitor "${monitor.name}"?`)) {
      startTransition(async () => {
        await deleteMonitor(monitor.id)
      })
    }
  }

  // Status Styling Logic
  let statusBadge = (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot glow-emerald" />
      <span>UP</span>
    </span>
  )

  if (monitor.status === 'down') {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        <span>DOWN</span>
      </span>
    )
  } else if (!monitor.is_active || monitor.status === 'paused') {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <span>PAUSED</span>
      </span>
    )
  } else if (monitor.status === 'unmonitored') {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        <span>PENDING</span>
      </span>
    )
  }

  return (
    <div className="p-4 hover:bg-slate-900/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Name & URL */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0">{statusBadge}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">{monitor.name}</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
              <Clock className="w-3 h-3" />
              {monitor.check_interval_minutes}m
            </span>
          </div>
          <a
            href={monitor.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1 truncate max-w-md mt-0.5"
          >
            <span className="truncate">{monitor.url}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        <button
          onClick={handleToggleActive}
          disabled={isPending}
          title={monitor.is_active ? 'Pause Monitor' : 'Resume Monitor'}
          className={`p-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1 ${
            monitor.is_active
              ? 'bg-slate-900 hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 border-slate-800 hover:border-amber-500/30'
              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
          }`}
        >
          {monitor.is_active ? (
            <PauseCircle className="w-4 h-4" />
          ) : (
            <PlayCircle className="w-4 h-4" />
          )}
        </button>

        <button
          onClick={onEdit}
          disabled={isPending}
          title="Edit Monitor"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>

        <button
          onClick={handleDelete}
          disabled={isPending}
          title="Delete Monitor"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

