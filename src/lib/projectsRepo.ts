import type { Project, Phase, Risk } from "../types"
import { neonClient } from "./neon"

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
    assumptions: project.assumptions ?? [],
    success_criteria: project.successCriteria ?? [],
    tags: project.tags ?? [],
    revision: project.revision ?? 1,
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
    assumptions: asArray<string>(row.assumptions),
    successCriteria: asArray<string>(row.success_criteria),
    tags: asArray<string>(row.tags),
    revision: Number(row.revision ?? 1),
  }
}

export async function loadProjects(userId?: string | null): Promise<Project[]> {
  setActiveShareToken(null)
  const queued = readOfflineQueue().map((item) => item.project)
  if (userId && neonClient) {
    try {
      await syncOfflineProjects()
    } catch {
      // keep queue for the next retry
    }
    try {
      const { data, error } = await neonClient
        .from("leanie_projects")
        .select("*")
        .order("updated_at", { ascending: false })
      if (error) throw error
      const base = (data ?? []).map(fromRow)
      const merged = new Map(base.map((p) => [p.id, p]))
      for (const project of queued) merged.set(project.id, project)
      return Array.from(merged.values())
    } catch {
      const stored = localStorage.getItem(STORAGE_KEY)
      const base: Project[] = stored ? (JSON.parse(stored) as Project[]) : []
      const merged = new Map(base.map((p) => [p.id, p]))
      for (const project of queued) merged.set(project.id, project)
      return Array.from(merged.values())
    }
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const base: Project[] = stored ? (JSON.parse(stored) as Project[]) : []
    const merged = new Map(base.map((p) => [p.id, p]))
    for (const project of queued) merged.set(project.id, project)
    return Array.from(merged.values())
  } catch {
    return queued
  }
}

export async function saveProject(project: Project, userId?: string | null): Promise<void> {
  if (userId && neonClient) {
    try {
      const { error } = await neonClient
        .from("leanie_projects")
        .upsert(toRow(project, userId), { onConflict: "id" })
      if (error) throw error
      return
    } catch (error) {
      queueProjectForSync(project, userId)
      throw error
    }
  }
  const current = await loadProjects(null)
  const next = current.some((p) => p.id === project.id)
    ? current.map((p) => (p.id === project.id ? project : p))
    : [project, ...current]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export async function removeProject(id: string, userId?: string | null): Promise<void> {
  if (userId && neonClient) {
    const { error } = await neonClient.from("leanie_projects").delete().eq("id", id)
    if (error) throw error
    return
  }
  const current = await loadProjects(null)
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(current.filter((p) => p.id !== id)),
  )
}

const OFFLINE_QUEUE_KEY = "leanie-offline-queue"

function readOfflineQueue(): Array<{ userId: string; project: Project }> {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]") as Array<{ userId: string; project: Project }>
  } catch {
    return []
  }
}

export function queueProjectForSync(project: Project, userId: string) {
  const queue = readOfflineQueue().filter((item) => !(item.userId === userId && item.project.id === project.id))
  queue.push({ userId, project })
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
}

export async function syncOfflineProjects() {
  if (!neonClient) return
  let queue = readOfflineQueue()
  if (!queue.length) return
  const remaining: Array<{ userId: string; project: Project }> = []
  for (const item of queue) {
    try {
      const row = toRow(item.project, item.userId)
      const { error } = await neonClient.from("leanie_projects").upsert(row, { onConflict: "id" })
      if (error) throw error
    } catch {
      remaining.push(item)
    }
  }
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining))
}

export async function createProjectShare(projectId: string, token: string, userId?: string | null) {
  if (!userId || !neonClient) return null
  const toRowShare = { project_id: projectId, token, role: "editor", created_by: userId }
  const { data, error } = await neonClient.from("leanie_shares").insert(toRowShare).select().single()
  if (error) return null
  return data as any
}

let activeShareToken: string | null = null
export function setActiveShareToken(token: string | null) { activeShareToken = token }
export function getActiveShareToken() { return activeShareToken }
export async function refreshSharedProject(token: string) {
  const shareUrl = import.meta.env.VITE_NEON_FUNCTION_SHARE_BASE_URL as string | undefined
  if (!shareUrl) return null
  try {
    const response = await fetch(`${shareUrl}?token=${encodeURIComponent(token)}`)
    if (!response.ok) return null
    return fromRow(await response.json())
  } catch {
    return null
  }
}
export async function persistSharedProject(project: Project, token: string) {
  const shareUrl = import.meta.env.VITE_NEON_FUNCTION_SHARE_BASE_URL as string | undefined
  if (!shareUrl) return { status: "unavailable" as const }
  try {
    const response = await fetch(shareUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ token, project, revision: project.revision ?? 1 }),
    })
    const data = await response.json()
    if (response.status === 409 && data.current) return { status: "conflict" as const, project: fromRow(data.current) }
    if (!response.ok) return { status: "error" as const, error: data.error }
    return { status: "ok" as const, project: fromRow(data) }
  } catch (error) {
    return { status: "network" as const, error: String(error) }
  }
}

export async function loadSharedProject(token: string) {
  setActiveShareToken(token)
  const shareUrl = import.meta.env.VITE_NEON_FUNCTION_SHARE_BASE_URL as string | undefined
  if (shareUrl) {
    try {
      const response = await fetch(`${shareUrl}?token=${encodeURIComponent(token)}`)
      if (!response.ok) return null
      return fromRow(await response.json())
    } catch {
      return null
    }
  }
  if (!neonClient) return null
  const { data: share, error: shareError } = await neonClient.from("leanie_shares").select("*").eq("token", token).single()
  if (shareError || !share) return null
  const { data: project, error: projectError } = await neonClient.from("leanie_projects").select("*").eq("id", share.project_id).single()
  if (projectError || !project) return null
  return fromRow(project)
}

export async function saveProjectVersion(project: Project, action: string, userId?: string | null) {
  if (!userId || !neonClient) return
  await neonClient.from("leanie_versions").insert({
    project_id: project.id,
    snapshot: project,
    action,
    created_by: userId,
  })
}

export async function loadProjectVersions(projectId: string) {
  if (!neonClient) return []
  const { data, error } = await neonClient.from("leanie_versions").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(25)
  if (error) return []
  return (data ?? []).map((row: any) => ({
    id: row.id,
    action: row.action,
    createdAt: row.created_at,
    createdBy: row.created_by ?? undefined,
    snapshot: row.snapshot as Project,
  }))
}
