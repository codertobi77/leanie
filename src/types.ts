export type Screen = "landing" | "overview" | "projects" | "new" | "council" | "results" | "plan" | "settings" | "admin" | "shared"
export type ProjectStatus = "Draft" | "Analyzing" | "Plan ready" | "Validated"

export interface Task {
  id: string
  title: string
  description: string
  priority: "High" | "Medium" | "Low"
  duration: string
  dependency: string
  resource: string
  deliverable: string
  completed?: boolean
}

export interface Phase {
  id: string
  title: string
  objective: string
  tasks: Task[]
}

export interface Risk {
  title: string
  likelihood: "Low" | "Medium" | "High"
  mitigation: string
}

export interface Project {
  id: string
  title: string
  objective: string
  context: string
  outcome: string
  targetDate?: string
  budget?: string
  resources?: string
  createdAt: string
  updatedAt: string
  status: ProjectStatus
  phases: Phase[]
  risks: Risk[]
  assumptions?: string[]
  successCriteria?: string[]
  tags?: string[]
  revision?: number
}

export interface ProjectFormData {
  title: string
  objective: string
  context: string
  outcome: string
  targetDate: string
  budget: string
  resources: string
}

export interface Analyst {
  role: string
  model: string
  description: string
  preview: string
  strength: string
}

export interface ModelRun {
  id: number
  created_at: string
  model: string
  step: string
  mode: string
  latency_ms: number | null
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number | string
  cost_usd: number | null
  json_valid: boolean | null
  analysis_quality: number | null
  risk_relevance: number | null
  coherence: number | null
  brief_title: string | null
  error: string | null
}

export interface ModelMetrics {
  model: string
  runs: number
  avg_latency_ms: number | null
  avg_analysis_quality: number | null
  avg_risk_relevance: number | null
  avg_coherence: number | null
  json_valid_rate: number | null
  total_tokens: number | string
  total_cost_usd: number
  last_run_at: string | null
}

export interface MetricsPayload {
  models: ModelMetrics[]
  runs: ModelRun[]
}
