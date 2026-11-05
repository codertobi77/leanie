export type Screen = "landing" | "overview" | "projects" | "new" | "council" | "results" | "plan" | "settings"
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
