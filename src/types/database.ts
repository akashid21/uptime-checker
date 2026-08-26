export interface Profile {
  id: string
  full_name: string | null
  created_at: string
}

export interface Project {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
  monitors?: Monitor[]
}

export interface Monitor {
  id: string
  project_id: string
  name: string
  url: string
  check_interval_minutes: number
  type: string
  status: 'up' | 'down' | 'unmonitored' | 'paused'
  is_active: boolean
  last_checked_at: string | null
  next_check_at: string | null
  created_at: string
  updated_at: string
}

export interface Check {
  id: string
  monitor_id: string
  status_code: number | null
  response_time_ms: number | null
  is_up: boolean
  error_message: string | null
  created_at: string
}

export interface Incident {
  id: string
  monitor_id: string
  start_time: string
  end_time: string | null
  duration_minutes: number | null
  resolution_reason: string | null
  created_at: string
}

