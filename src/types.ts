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
  provider: string
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
  config_id: string | null
  run_id: string | null
  steps: CouncilStepDetail[] | null
}

export interface ModelMetrics {
  provider: string
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

// ---- Multi-provider Council administration ----

export type CouncilStepName = "strategic" | "feasibility" | "critique" | "arbiter"

export interface CouncilStepDetail {
  step: string
  provider: string
  model: string
  latencyMs: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsd: number
  jsonValid: boolean
  error: string | null
}

export interface ProviderModel {
  id: string
  price_prompt_per_1m?: number
  price_completion_per_1m?: number
}

export interface LeanieProvider {
  id: string
  name: string
  baseUrl: string
  apiKeyMasked: string
  hasKey: boolean
  models: ProviderModel[]
  status: "testing" | "published"
  createdAt: string
  updatedAt: string
}

export interface CouncilConfigStep {
  providerId: string
  model: string
}

export interface CouncilConfig {
  id: string
  name: string
  steps: Partial<Record<CouncilStepName, CouncilConfigStep>>
  status: "draft" | "published"
  createdAt: string
  updatedAt: string
}

export interface BenchmarkRunConfig {
  steps?: Partial<Record<CouncilStepName, { provider: string; model: string }>>
  configId?: string | null
  configName?: string | null
  step?: string
}

export interface BenchmarkRunRow {
  id: string
  source: string
  config: BenchmarkRunConfig
  status: "running" | "done" | "failed"
  current_step: CouncilStepName | null
  steps: CouncilStepDetail[]
  result: { metrics?: Record<string, unknown>; payload?: Record<string, unknown> } | null
  error: string | null
  created_at: string
  updated_at: string
}
