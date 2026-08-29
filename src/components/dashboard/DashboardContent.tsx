'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Incident, Project, Monitor } from '@/types/database'
import ProjectCard from './ProjectCard'
import ProjectModal from './ProjectModal'
import MonitorModal from './MonitorModal'
import LimitAlertModal from './LimitAlertModal'
import { FREE_TIER_LIMITS } from '@/lib/constants'
import {
  Plus,
  Search,
  Layers,
  ShieldCheck,
  Activity,
  Server,
  FolderPlus,
  CircleAlert,
  Clock3,
  RefreshCw,
  Wifi,
} from 'lucide-react'

interface DashboardContentProps {
  initialProjects: Project[]
  initialMonitors: Monitor[]
  initialChecks: Check[]
  initialIncidents: Incident[]
  userEmail: string
}

export default function DashboardContent({
  initialProjects,
  initialMonitors,
  initialChecks,
  initialIncidents,
  userEmail,
}: DashboardContentProps) {
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()
  const [searchQuery, setSearchQuery] = useState('')
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null)

  const [isMonitorModalOpen, setIsMonitorModalOpen] = useState(false)
  const [monitorToEdit, setMonitorToEdit] = useState<Monitor | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()

  const [limitAlert, setLimitAlert] = useState<{
    isOpen: boolean
    title: string
    description: string
    limitType: 'projects' | 'monitors'
  }>({
    isOpen: false,
    title: '',
    description: '',
    limitType: 'projects',
  })

  const projectCount = initialProjects.length
  const totalMonitors = initialMonitors.length
  const isProjectLimitReached = projectCount >= FREE_TIER_LIMITS.MAX_PROJECTS

  const monitorById = useMemo(() => new Map(initialMonitors.map((monitor) => [monitor.id, monitor])), [initialMonitors])
  const activeMonitors = initialMonitors.filter((monitor) => monitor.is_active)
  const downMonitors = activeMonitors.filter((monitor) => monitor.status === 'down')
  const pendingMonitors = activeMonitors.filter((monitor) => monitor.status === 'unmonitored')
  const operational = activeMonitors.length > 0 && downMonitors.length === 0
  const checksUp = initialChecks.filter((check) => check.is_up).length
  const uptime = initialChecks.length > 0 ? Math.round((checksUp / initialChecks.length) * 1000) / 10 : null
  const lastUpdated = useMemo(() => {
    const latest = initialChecks[0]?.created_at || initialMonitors.reduce<string | null>((latest, monitor) => {
      if (!monitor.last_checked_at) return latest
      return !latest || monitor.last_checked_at > latest ? monitor.last_checked_at : latest
    }, null)
    return latest ? new Date(latest) : null
  }, [initialChecks, initialMonitors])

  // Poll only while the dashboard is visible. Modal state is intentionally a pause
  // point so a refresh never replaces values someone is currently editing.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible' && !isProjectModalOpen && !isMonitorModalOpen) {
        startRefresh(() => router.refresh())
      }
    }
    const interval = window.setInterval(refresh, 45000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [isProjectModalOpen, isMonitorModalOpen, router])

  function refreshAfterAction() {
    startRefresh(() => router.refresh())
  }

  // Filter projects by search query
  const filteredProjects = initialProjects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function handleOpenNewProject() {
    if (isProjectLimitReached) {
      setLimitAlert({
        isOpen: true,
        title: 'Project Limit Reached',
        description: `Free tier limit reached: You can create a maximum of ${FREE_TIER_LIMITS.MAX_PROJECTS} projects. Upgrade to add more.`,
        limitType: 'projects',
      })
    } else {
      setProjectToEdit(null)
      setIsProjectModalOpen(true)
    }
  }

  function handleOpenNewMonitor(targetProjectId?: string) {
    if (initialProjects.length === 0) {
      handleOpenNewProject()
      return
    }

    const targetId = targetProjectId || initialProjects[0]?.id
    const targetProjectMonitors = initialMonitors.filter((m) => m.project_id === targetId)

    if (targetProjectMonitors.length >= FREE_TIER_LIMITS.MAX_MONITORS_PER_PROJECT) {
      setLimitAlert({
        isOpen: true,
        title: 'Monitor Limit Reached',
        description: `Free tier limit reached: You can create a maximum of ${FREE_TIER_LIMITS.MAX_MONITORS_PER_PROJECT} monitors per project. Upgrade to add more.`,
        limitType: 'monitors',
      })
    } else {
      setMonitorToEdit(null)
      setSelectedProjectId(targetId)
      setIsMonitorModalOpen(true)
    }
  }

  function handleEditProject(project: Project) {
    setProjectToEdit(project)
    setIsProjectModalOpen(true)
  }

  function handleEditMonitor(monitor: Monitor) {
    setMonitorToEdit(monitor)
    setSelectedProjectId(monitor.project_id)
    setIsMonitorModalOpen(true)
  }

  function handleLimitReached(msg: string) {
    setLimitAlert({
      isOpen: true,
      title: 'Free Tier Limit Reached',
      description: msg,
      limitType: msg.includes('projects') ? 'projects' : 'monitors',
    })
  }

  const statusLabel = !initialMonitors.length
    ? 'No monitors yet'
    : !activeMonitors.length
      ? 'No active monitors'
    : operational
      ? 'All systems operational'
      : `${downMonitors.length} ${downMonitors.length === 1 ? 'system' : 'systems'} down`

  return (
    <div className="space-y-7">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Overview</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${operational ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : downMonitors.length ? 'border-rose-500/25 bg-rose-500/10 text-rose-400' : 'border-slate-700 bg-slate-800/60 text-slate-400'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${operational ? 'bg-emerald-400' : downMonitors.length ? 'bg-rose-400' : 'bg-slate-500'}`} />
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">A live view of your monitored services and recent reliability.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenNewMonitor()}
            disabled={!initialProjects.length}
            title={!initialProjects.length ? 'Create a project first' : 'Add monitor'}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Add Monitor</span>
          </button>

          <button
            onClick={handleOpenNewProject}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white shadow-lg shadow-indigo-600/20 transition-all duration-200 hover:bg-indigo-500"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Status banner */}
      <section className={`glass-panel flex flex-col gap-5 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${downMonitors.length ? 'border-rose-500/25' : 'border-emerald-500/20'}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${downMonitors.length ? 'border-rose-500/25 bg-rose-500/10 text-rose-400' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'}`}>
            {downMonitors.length ? <CircleAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{statusLabel}</p>
            <p className="mt-1 text-xs text-slate-400">{downMonitors.length ? 'Review the affected monitors below.' : activeMonitors.length ? `${activeMonitors.length} active ${activeMonitors.length === 1 ? 'monitor is' : 'monitors are'} being watched.` : 'Add a monitor to begin collecting uptime data.'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          {isRefreshing ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-400" /> : <Wifi className="h-3.5 w-3.5 text-emerald-400" />}
          {isRefreshing ? 'Updating…' : lastUpdated ? `Last check ${formatRelativeTime(lastUpdated)}` : 'Waiting for first check'}
        </div>
      </section>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Active monitors" value={activeMonitors.length} detail={`${totalMonitors} total`} icon={<Server className="h-4 w-4" />} />
        <Metric label="Down right now" value={downMonitors.length} detail={downMonitors.length ? 'Needs attention' : 'Nothing to fix'} icon={<CircleAlert className="h-4 w-4" />} tone={downMonitors.length ? 'down' : 'neutral'} />
        <Metric label="30-day uptime" value={uptime === null ? '—' : `${uptime}%`} detail={initialChecks.length ? `${initialChecks.length} checks recorded` : 'No check history yet'} icon={<Activity className="h-4 w-4" />} tone="up" />
        <Metric label="Projects" value={projectCount} detail={`${FREE_TIER_LIMITS.MAX_PROJECTS - projectCount} slots available`} icon={<Layers className="h-4 w-4" />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="glass-panel rounded-2xl border border-slate-800/80 p-5">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-sm font-semibold text-white">30-day reliability</h2><p className="mt-1 text-xs text-slate-500">Each block represents a day of recorded checks.</p></div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500"><span className="h-2 w-2 rounded-sm bg-slate-800" />No data <span className="h-2 w-2 rounded-sm bg-emerald-500" />Healthy</div>
          </div>
          <UptimeGrid monitors={initialMonitors} checks={initialChecks} />
        </section>

        <section className="glass-panel rounded-2xl border border-slate-800/80 p-5">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-semibold text-white">Recent incidents</h2><p className="mt-1 text-xs text-slate-500">Open and recently resolved downtime.</p></div><CircleAlert className="h-4 w-4 text-slate-500" /></div>
          <IncidentList incidents={initialIncidents} monitorById={monitorById} />
        </section>
      </div>

      {/* Projects Header & Search */}
      <div className="flex flex-col justify-between gap-4 pt-2 sm:flex-row sm:items-center">
        <div><h2 className="text-lg font-bold tracking-tight text-white">Your projects</h2><p className="mt-1 text-xs text-slate-500">Manage monitors and their check cadence.</p></div>
        {initialProjects.length > 0 && <div className="relative w-full sm:w-64"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search projects..." aria-label="Search projects" className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" /></div>}
      </div>

      {/* Projects List or Empty State */}
      {filteredProjects.length === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 p-12 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-600/10 text-indigo-400"><FolderPlus className="h-6 w-6" /></div>
          <h3 className="text-base font-semibold text-white">{initialProjects.length === 0 ? 'Create your first project' : 'No matching projects'}</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-400">{initialProjects.length === 0 ? 'Projects keep related website and API monitors together.' : `Nothing matches “${searchQuery}”.`}</p>
          {initialProjects.length === 0 && <button onClick={handleOpenNewProject} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"><Plus className="h-4 w-4" />Create first project</button>}
        </div>
      ) : (
        <div className="space-y-5">{filteredProjects.map((project) => <ProjectCard key={project.id} project={project} monitors={initialMonitors.filter((m) => m.project_id === project.id)} onEditProject={handleEditProject} onAddMonitor={handleOpenNewMonitor} onEditMonitor={handleEditMonitor} onLimitReached={handleLimitReached} />)}</div>
      )}

      {pendingMonitors.length > 0 && <p className="flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{pendingMonitors.length} monitor{pendingMonitors.length === 1 ? '' : 's'} waiting for the first check.</p>}

      {/* Modals */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => { setIsProjectModalOpen(false); refreshAfterAction() }}
        projectToEdit={projectToEdit}
        onLimitReached={handleLimitReached}
      />

      <MonitorModal
        isOpen={isMonitorModalOpen}
        onClose={() => { setIsMonitorModalOpen(false); refreshAfterAction() }}
        projects={initialProjects}
        selectedProjectId={selectedProjectId}
        monitorToEdit={monitorToEdit}
        onLimitReached={handleLimitReached}
      />

      <LimitAlertModal
        isOpen={limitAlert.isOpen}
        onClose={() => setLimitAlert({ ...limitAlert, isOpen: false })}
        title={limitAlert.title}
        description={limitAlert.description}
        limitType={limitAlert.limitType}
      />
    </div>
  )
}

function Metric({ label, value, detail, icon, tone = 'neutral' }: { label: string; value: string | number; detail: string; icon: React.ReactNode; tone?: 'neutral' | 'up' | 'down' }) {
  const color = tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-rose-400' : 'text-white'
  return <div className="glass-panel rounded-2xl border border-slate-800/80 p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium text-slate-400">{label}</span><span className={tone === 'down' ? 'text-rose-400' : tone === 'up' ? 'text-emerald-400' : 'text-indigo-400'}>{icon}</span></div><p className={`mt-3 text-xl font-bold ${color}`}>{value}</p><p className="mt-1 truncate text-[10px] text-slate-500">{detail}</p></div>
}

function UptimeGrid({ monitors, checks }: { monitors: Monitor[]; checks: Check[] }) {
  const days = Array.from({ length: 30 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (29 - index)); return date })
  if (!monitors.length) return <div className="flex h-28 items-center justify-center text-xs text-slate-500">Add a monitor to see uptime history.</div>
  return <div className="mt-6 space-y-3">{monitors.slice(0, 6).map((monitor) => <div key={monitor.id} className="flex items-center gap-3"><span className="w-24 truncate text-[11px] text-slate-400" title={monitor.name}>{monitor.name}</span><div className="grid min-w-0 flex-1 grid-cols-10 gap-1 sm:grid-cols-[repeat(15,minmax(0,1fr))] md:grid-cols-[repeat(30,minmax(0,1fr))]">{days.map((day) => { const next = new Date(day); next.setDate(next.getDate() + 1); const dayChecks = checks.filter((check) => check.monitor_id === monitor.id && new Date(check.created_at) >= day && new Date(check.created_at) < next); const ratio = dayChecks.length ? dayChecks.filter((check) => check.is_up).length / dayChecks.length : null; return <span key={day.toISOString()} title={`${day.toLocaleDateString()}: ${ratio === null ? 'No data' : `${Math.round(ratio * 100)}% uptime`}`} className={`h-3 rounded-sm ${ratio === null ? 'bg-slate-800' : ratio === 1 ? 'bg-emerald-500' : ratio >= 0.95 ? 'bg-emerald-700' : ratio >= 0.8 ? 'bg-amber-500' : 'bg-rose-500'}`} /> })}</div></div>)}</div>
}

function IncidentList({ incidents, monitorById }: { incidents: Incident[]; monitorById: Map<string, Monitor> }) {
  if (!incidents.length) return <div className="flex h-28 items-center justify-center text-center text-xs text-slate-500">No incidents recorded in the current history.</div>
  return <div className="mt-5 space-y-1">{incidents.slice(0, 5).map((incident) => { const monitor = monitorById.get(incident.monitor_id); return <div key={incident.id} className="flex items-center justify-between gap-3 border-b border-slate-800/60 py-3 last:border-0"><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-200">{monitor?.name || 'Deleted monitor'}</p><p className="mt-1 text-[10px] text-slate-500">{formatRelativeTime(new Date(incident.start_time))} · {incident.end_time ? formatDuration(incident.duration_minutes) : 'Ongoing'}</p></div><span className={`h-2 w-2 shrink-0 rounded-full ${incident.end_time ? 'bg-amber-400' : 'bg-rose-400'}`} /></div> })}</div>
}

function formatRelativeTime(date: Date) {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return 'Duration unknown'
  if (minutes < 60) return `${minutes}m downtime`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m downtime`
}
