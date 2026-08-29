import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { signout } from '@/app/auth/signout/actions'
import { Activity, LogOut } from 'lucide-react'
import DashboardContent from '@/components/dashboard/DashboardContent'
import { Check, Incident, Monitor, Project } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user projects sorted by creation date
  const { data: projectsData } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const projects: Project[] = projectsData || []
  const projectIds = projects.map((p) => p.id)

  // Fetch monitors associated with user projects
  let monitors: Monitor[] = []
  if (projectIds.length > 0) {
    const { data: monitorsData } = await supabase
      .from('monitors')
      .select('*')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })

    monitors = monitorsData || []
  }

  const monitorIds = monitors.map((monitor) => monitor.id)
  let checks: Check[] = []
  let incidents: Incident[] = []

  if (monitorIds.length > 0) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const [{ data: checksData }, { data: incidentsData }] = await Promise.all([
      supabase
        .from('checks')
        .select('*')
        .in('monitor_id', monitorIds)
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      supabase
        .from('incidents')
        .select('*')
        .in('monitor_id', monitorIds)
        .order('start_time', { ascending: false })
        .limit(8),
    ])

    checks = checksData || []
    incidents = incidentsData || []
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Activity className="w-5 h-5 text-emerald-400" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full pulse-dot glow-emerald" />
            </div>
            <span className="font-bold text-lg text-white">Pulse<span className="text-indigo-400">Check</span></span>
            <span className="ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              Free Tier
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-400 hidden sm:block">
              Signed in as <span className="text-slate-200 font-medium">{user.email}</span>
            </div>
            <form action={signout}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Dashboard Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardContent
          initialProjects={projects}
          initialMonitors={monitors}
          initialChecks={checks}
          initialIncidents={incidents}
          userEmail={user.email || ''}
        />
      </main>
    </div>
  )
}
