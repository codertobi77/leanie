import type { Project, Phase, Risk, ProjectIntake } from "../types"
import { neonClient } from "./neon"
import { trackEvent } from "./observability"
import { createId } from "./id"
import { decodeContextWithIntake, defaultIntake, encodeContextWithIntake, intakeToLegacyFields } from "./intake"

const STORAGE_KEY = "leanie-projects-v1"

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function projectForPersistence(project: Project): Project {
  if (!project.intake) return project
  const legacy = intakeToLegacyFields(project.title, project.intake)
  return {
    ...project,
    ...legacy,
    context: encodeContextWithIntake(legacy.context, project.intake),
  }
}

function toRow(project: Project, userId: string) {
  const p = projectForPersistence(project)
  return {
    id: p.id,
    user_id: userId,
    title: p.title,
    objective: p.objective,
    context: p.context,
    outcome: p.outcome,
    target_date: p.targetDate ?? null,
    budget: p.budget ?? null,
    resources: p.resources ?? null,
    status: p.status,
    phases: p.phases,
    risks: p.risks,
    assumptions: p.assumptions ?? [],
    success_criteria: p.successCriteria ?? [],
    tags: p.tags ?? [],
    revision: p.revision ?? 1,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }
}

function fromRow(row: any): Project {
  const decoded = decodeContextWithIntake(row.context ?? "")
  const intake: ProjectIntake | undefined = decoded.intake ?? undefined
  const tags = asArray<string>(row.tags)
  return {
    id: row.id,
    title: row.title,
    objective: row.objective,
    context: decoded.context || row.context || "",
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
    tags,
    revision: Number(row.revision ?? 1),
    intake,
  }
}

export async function loadProjects(userId?: string | null): Promise<Project[]> {
  const queued = readOfflineQueue().map((item) => item.project)
  const mergeQueued = (base: Project[]) => {
    const merged = new Map(base.map((p) => [p.id, p]))
    for (const project of queued) merged.set(project.id, project)
    return Array.from(merged.values())
  }
  const readLocal = (): Project[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? (JSON.parse(stored) as Project[]) : []
    } catch (error) {
      console.warn("loadProjects: could not read local cache", error)
      return []
    }
  }

  if (userId && neonClient) {
    try {
      await syncOfflineProjects()
    } catch (error) {
      // Keep the offline queue for the next retry; remote load still proceeds.
      console.warn("loadProjects: offline sync deferred", error)
    }
    try {
      const { data, error } = await neonClient
        .from("leanie_projects")
        .select("*")
        .order("updated_at", { ascending: false })
      if (error) throw error
      return mergeQueued((data ?? []).map(fromRow))
    } catch (error) {
      console.warn("loadProjects: falling back to local cache", error)
      return mergeQueued(readLocal())
    }
  }

  return mergeQueued(readLocal())
}

export async function saveProject(project: Project, userId?: string | null): Promise<void> {
  if (userId && neonClient) {
    try {
      const { error } = await neonClient
        .from("leanie_projects")
        .upsert(toRow(project, userId), { onConflict: "id" })
      if (error) throw error
      trackEvent("project.save", { projectId: project.id, mode: "remote" })
      return
    } catch (error) {
      queueProjectForSync(project, userId)
      trackEvent("project.save_queued", { projectId: project.id, mode: "offline-queue" })
      throw error
    }
  }
  const current = await loadProjects(null)
  const next = current.some((p) => p.id === project.id)
    ? current.map((p) => (p.id === project.id ? project : p))
    : [project, ...current]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (error) {
    console.error("saveProject: failed to persist local cache", error)
    throw error
  }
  trackEvent("project.save", { projectId: project.id, mode: "local" })
}

export async function removeProject(id: string, userId?: string | null): Promise<void> {
  if (userId && neonClient) {
    const { error } = await neonClient.from("leanie_projects").delete().eq("id", id)
    if (error) throw error
    trackEvent("project.remove", { projectId: id, mode: "remote" })
    return
  }
  const current = await loadProjects(null)
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(current.filter((p) => p.id !== id)),
    )
  } catch (error) {
    console.error("removeProject: failed to persist local cache", error)
    throw error
  }
  trackEvent("project.remove", { projectId: id, mode: "local" })
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
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  } catch (error) {
    console.warn("queueProjectForSync: could not persist offline queue", error)
  }
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
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining))
  } catch (error) {
    console.warn("syncOfflineProjects: could not persist remaining queue", error)
  }
}

export async function createProjectShare(projectId: string, token: string, userId: string | null, role: string = "editor", expiresAt: string | null = null) {
  if (!userId || !neonClient) return null
  const toRowShare = { project_id: projectId, token, role, created_by: userId, expires_at: expiresAt }
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
  } catch (error) {
    console.warn("refreshSharedProject: network error", error)
    return null
  }
}

export async function persistSharedProject(project: Project, token: string) {
  const shareUrl = import.meta.env.VITE_NEON_FUNCTION_SHARE_BASE_URL as string | undefined
  if (!shareUrl) return { status: "unavailable" as const }
  try {
    const p = projectForPersistence(project)
    const response = await fetch(shareUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ token, project: p, revision: p.revision ?? 1 }),
    })
    const data = await response.json()
    if (response.status === 409 && data.current) {
      trackEvent("share.persist_conflict", { projectId: project.id, revision: project.revision ?? 1 })
      return { status: "conflict" as const, project: fromRow(data.current) }
    }
    if (!response.ok) {
      trackEvent("share.persist_error", { projectId: project.id, http: response.status })
      return { status: "error" as const, error: data.error ?? `HTTP ${response.status}` }
    }
    trackEvent("share.persist_ok", { projectId: project.id, revision: (data as any)?.revision })
    return { status: "ok" as const, project: fromRow(data) }
  } catch (error) {
    trackEvent("share.persist_network", { projectId: project.id })
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
    } catch (error) {
      console.warn("loadSharedProject: network error", error)
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

function ephemeralPresenceId(): string {
  try {
    const key = "leanie-presence-id"
    const existing = sessionStorage.getItem(key)
    if (existing) return existing
    const id = `anon-${createId()}`
    sessionStorage.setItem(key, id)
    return id
  } catch {
    return `anon-${createId()}`
  }
}

export async function heartbeatSharePresence(
  token: string,
  userId: string | null,
  email: string | null,
) {
  if (!neonClient || !token) return
  try {
    await neonClient.from("leanie_share_presence").upsert(
      {
        share_token: token,
        user_id: userId || ephemeralPresenceId(),
        user_email: email,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "share_token,user_id" },
    )
  } catch (error) {
    console.warn("heartbeatSharePresence failed", error)
  }
}

export async function loadSharePresence(token: string): Promise<Array<{ userId: string; email: string | null; lastSeenAt: string }>> {
  if (!neonClient || !token) return []
  try {
    const { data, error } = await neonClient
      .from("leanie_share_presence")
      .select("*")
      .eq("share_token", token)
      .gte("last_seen_at", new Date(Date.now() - 90_000).toISOString())
    if (error) return []
    return (data ?? []).map((row: any) => ({
      userId: row.user_id,
      email: row.user_email ?? null,
      lastSeenAt: row.last_seen_at,
    }))
  } catch {
    return []
  }
}

export { trackEvent, trackResource } from "./observability"
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
