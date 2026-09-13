import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { signout } from '@/app/auth/signout/actions'
import { Activity, LogOut } from 'lucide-react'
import DashboardContent from '@/components/dashboard/DashboardContent'
import { DailyStat, Incident, Monitor, Project } from '@/types/database'

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
  let dailyStats: DailyStat[] = []
  let incidents: Incident[] = []

  if (monitorIds.length > 0) {
    const today = new Date().toISOString().slice(0, 10)
    const start = new Date(`${today}T00:00:00.000Z`)
    start.setUTCDate(start.getUTCDate() - 29)
    const startDate = start.toISOString().slice(0, 10)
    const yesterday = new Date(`${today}T00:00:00.000Z`)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const yesterdayDate = yesterday.toISOString().slice(0, 10)

    const [{ data: dailyStatsData }, { data: currentStatsData }, { data: incidentsData }] = await Promise.all([
      supabase
        .from('daily_stats')
        .select('*')
        .gte('check_date', startDate)
        .lte('check_date', yesterdayDate)
        .order('check_date', { ascending: true }),
      supabase.rpc('get_current_daily_stats', { p_check_date: today, p_timezone: 'UTC' }),
      supabase
        .from('incidents')
        .select('*')
        .in('monitor_id', monitorIds)
        .order('start_time', { ascending: false })
        .limit(8),
    ])

    dailyStats = [...(dailyStatsData || []), ...(currentStatsData || [])]
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
            <span className="font-bold text-lg text-white">Uptime<span className="text-indigo-400">Board</span></span>
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
          initialDailyStats={dailyStats}
          initialIncidents={incidents}
          userEmail={user.email || ''}
        />
      </main>
    </div>
  )
}
