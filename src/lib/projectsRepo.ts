import type { Project, Phase, Risk } from "../types"
import { supabase } from "./supabase"

const STORAGE_KEY = "leanie-projects-v1"

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function toRow(project: Project, userId: string) {
  return {
    id: project.id,
    user_id: userId,
    title: project.title,
    objective: project.objective,
    context: project.context,
    outcome: project.outcome,
    target_date: project.targetDate ?? null,
    budget: project.budget ?? null,
    resources: project.resources ?? null,
    status: project.status,
    phases: project.phases,
    risks: project.risks,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  }
}

function fromRow(row: any): Project {
  return {
    id: row.id,
    title: row.title,
    objective: row.objective,
    context: row.context ?? "",
    outcome: row.outcome ?? "",
    targetDate: row.target_date ?? undefined,
    budget: row.budget ?? undefined,
    resources: row.resources ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    phases: asArray<Phase>(row.phases),
    risks: asArray<Risk>(row.risks),
  }
}

export async function loadProjects(userId?: string | null): Promise<Project[]> {
  if (userId && supabase) {
    const { data, error } = await supabase
      .from("leanie_projects")
      .select("*")
      .order("updated_at", { ascending: false })
    if (error) throw error
    return (data ?? []).map(fromRow)
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as Project[]) : []
  } catch {
    return []
  }
}

export async function saveProject(project: Project, userId?: string | null): Promise<void> {
  if (userId && supabase) {
    const { error } = await supabase
      .from("leanie_projects")
      .upsert(toRow(project, userId), { onConflict: "id" })
    if (error) throw error
    return
  }
  const current = await loadProjects(null)
  const next = current.some((p) => p.id === project.id)
    ? current.map((p) => (p.id === project.id ? project : p))
    : [project, ...current]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export async function removeProject(id: string, userId?: string | null): Promise<void> {
  if (userId && supabase) {
    const { error } = await supabase.from("leanie_projects").delete().eq("id", id)
    if (error) throw error
    return
  }
  const current = await loadProjects(null)
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(current.filter((p) => p.id !== id)),
  )
}
