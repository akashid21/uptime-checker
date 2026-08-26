'use client'

import { useState } from 'react'
import { Project, Monitor } from '@/types/database'
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
  AlertTriangle,
  FolderPlus,
} from 'lucide-react'

interface DashboardContentProps {
  initialProjects: Project[]
  initialMonitors: Monitor[]
  userEmail: string
}

export default function DashboardContent({
  initialProjects,
  initialMonitors,
  userEmail,
}: DashboardContentProps) {
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

  return (
    <div className="space-y-8">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor website & API health across your projects in real-time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenNewMonitor()}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium text-xs transition-colors"
          >
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Add Monitor</span>
          </button>

          <button
            onClick={handleOpenNewProject}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all duration-200 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Free Tier Allowance Banner */}
      <div className="p-4 rounded-2xl glass-panel border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">Free Tier Limits</span>
              {isProjectLimitReached && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="w-3 h-3" />
                  Max Projects Hit
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              <strong className="text-slate-200">{projectCount}</strong> of <strong>{FREE_TIER_LIMITS.MAX_PROJECTS} Projects</strong> used • Up to <strong>{FREE_TIER_LIMITS.MAX_MONITORS_PER_PROJECT} Monitors</strong> per project
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full sm:w-48 bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isProjectLimitReached ? 'bg-amber-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${Math.min((projectCount / FREE_TIER_LIMITS.MAX_PROJECTS) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">System Health</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-bold text-emerald-400">Operational</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Real-time status</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Projects</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{projectCount}</span>
            <span className="text-xs text-slate-500">/ {FREE_TIER_LIMITS.MAX_PROJECTS}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Max 5 on free tier</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Active Monitors</span>
            <Server className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{totalMonitors}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Across all projects</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Global Uptime</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">100%</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">30-day average</p>
        </div>
      </div>

      {/* Projects Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <h2 className="text-lg font-bold text-white tracking-tight">Your Projects</h2>

        {initialProjects.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        )}
      </div>

      {/* Projects List or Empty State */}
      {filteredProjects.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
            <FolderPlus className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">
            {initialProjects.length === 0 ? 'No projects created yet' : 'No matching projects found'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {initialProjects.length === 0
              ? 'Create your first project to organize your website and API monitors.'
              : `No projects match "${searchQuery}".`}
          </p>
          {initialProjects.length === 0 && (
            <button
              onClick={handleOpenNewProject}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Project</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredProjects.map((project) => {
            const projectMonitors = initialMonitors.filter((m) => m.project_id === project.id)
            return (
              <ProjectCard
                key={project.id}
                project={project}
                monitors={projectMonitors}
                onEditProject={handleEditProject}
                onAddMonitor={handleOpenNewMonitor}
                onEditMonitor={handleEditMonitor}
                onLimitReached={handleLimitReached}
              />
            )
          })}
        </div>
      )}

      {/* Modals */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        projectToEdit={projectToEdit}
        onLimitReached={handleLimitReached}
      />

      <MonitorModal
        isOpen={isMonitorModalOpen}
        onClose={() => setIsMonitorModalOpen(false)}
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

