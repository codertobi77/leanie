import type { Project, ProjectIntake, ProjectFormData } from "../types"

export const INTAKE_MARKER = "[LEANIE_INTAKE_V1]"

export const SECTORS = [
  "Agriculture",
  "Education",
  "Health",
  "Energy",
  "Water & sanitation",
  "Climate & environment",
  "Digital & technology",
  "Financial inclusion",
  "Governance & civic",
  "Humanitarian",
  "Infrastructure",
  "Livelihoods & jobs",
  "Other",
] as const

export const MATURITY_OPTIONS = ["Idea", "Concept", "Prototype", "Pilot", "Scaling"] as const
export const FUNDING_STATUS_OPTIONS = [
  "Not yet defined",
  "Not funded",
  "Seeking funding",
  "Partially secured",
  "Secured",
] as const
export const RISK_TOLERANCE_OPTIONS = ["Not yet defined", "Low", "Moderate", "High"] as const

export function defaultIntake(): ProjectIntake {
  return {
    coreIdea: {
      projectSummary: "",
      problemStatement: "",
      targetBeneficiaries: "",
      proposedSolution: "",
      mainObjectives: "",
      expectedResults: "",
      sectors: [],
      projectLocation: "",
      projectDuration: "",
      projectMaturity: "Idea",
      additionalContext: "",
    },
    constraints: {
      availableBudget: "",
      fundingStatus: "Not yet defined",
      availableResources: "",
      teamComposition: "",
      implementationDeadline: "",
      keyMilestones: "",
      geographicalConstraints: "",
      regulatoryConstraints: "",
      technicalConstraints: "",
      operationalConstraints: "",
      nonNegotiableRequirements: "",
      riskTolerance: "Not yet defined",
      preferredImplementationApproach: "",
      knownAssumptions: "",
    },
  }
}

export function normalizeOptional(value: string | undefined | null): string {
  const v = (value ?? "").trim()
  return v
}

export function isDefinedValue(value: string | undefined | null): boolean {
  const v = normalizeOptional(value)
  return !!v && v !== "Not yet defined"
}

function safeB64Encode(input: string): string {
  try {
    if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(input)))
  } catch {}
  try {
    // Node/buffer fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const B = (globalThis as any).Buffer
    if (B) return B.from(input, "utf8").toString("base64")
  } catch {}
  return ""
}

function safeB64Decode(input: string): string {
  try {
    if (typeof atob === "function") return decodeURIComponent(escape(atob(input)))
  } catch {}
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const B = (globalThis as any).Buffer
    if (B) return B.from(input, "base64").toString("utf8")
  } catch {}
  return ""
}

export function encodeContextWithIntake(humanContext: string, intake?: ProjectIntake | null): string {
  const text = (humanContext ?? "").trim()
  if (!intake) return text
  const payload = safeB64Encode(JSON.stringify({ v: 1, intake }))
  if (!payload) return text
  return text ? `${text}\n\n${INTAKE_MARKER}${payload}` : `${INTAKE_MARKER}${payload}`
}

export function decodeContextWithIntake(raw: string | undefined | null): { context: string; intake: ProjectIntake | null } {
  const value = raw ?? ""
  const idx = value.indexOf(INTAKE_MARKER)
  if (idx === -1) return { context: value, intake: null }
  const human = value.slice(0, idx).trim()
  const encoded = value.slice(idx + INTAKE_MARKER.length).trim()
  try {
    const parsed = JSON.parse(safeB64Decode(encoded))
    const intake = parsed?.intake && typeof parsed.intake === "object" ? (parsed.intake as ProjectIntake) : null
    return { context: human, intake }
  } catch {
    return { context: human || value, intake: null }
  }
}

/** Build a legacy-compatible Project baseline from intake + form identity. */
export function intakeToLegacyFields(title: string, intake: ProjectIntake) {
  const c = intake.coreIdea
  const k = intake.constraints
  const contextParts = [
    c.problemStatement && `Problem: ${c.problemStatement}`,
    c.targetBeneficiaries && `Beneficiaries: ${c.targetBeneficiaries}`,
    c.additionalContext && `Additional context: ${c.additionalContext}`,
    c.projectLocation && `Location: ${c.projectLocation}`,
    c.sectors?.length ? `Sectors: ${c.sectors.join(", ")}` : "",
  ].filter(Boolean)
  const resourceParts = [k.availableResources, k.teamComposition].filter(isDefinedValue)
  return {
    title: title.trim(),
    objective: normalizeOptional(c.mainObjectives) || normalizeOptional(c.projectSummary) || title.trim(),
    context: contextParts.join("\n"),
    outcome: normalizeOptional(c.expectedResults) || normalizeOptional(c.proposedSolution) || "",
    targetDate: normalizeOptional(k.implementationDeadline) || undefined,
    budget: normalizeOptional(k.availableBudget) || undefined,
    resources: resourceParts.join("\n") || undefined,
    tags: [...(c.sectors || []), c.projectMaturity].filter(Boolean),
  }
}

/** Council brief payload: full structured intake + legacy fields for compatibility. */
export function buildCouncilBrief(project: Pick<Project, "id" | "title" | "intake"> & Partial<Project>) {
  const intake = project.intake
  if (!intake) {
    return {
      title: project.title,
      objective: project.objective,
      context: project.context,
      outcome: project.outcome,
      targetDate: project.targetDate,
      budget: project.budget,
      resources: project.resources,
    }
  }
  const legacy = intakeToLegacyFields(project.title, intake)
  return {
    ...legacy,
    intake,
    // explicit "known vs not yet defined" handling for the model
    knownInformation: collectKnown(intake),
    unknownOrNotYetDefined: collectUnknown(intake),
  }
}

function collectKnown(intake: ProjectIntake): string[] {
  const out: string[] = []
  const push = (label: string, v: string | string[] | undefined) => {
    if (Array.isArray(v)) {
      if (v.length) out.push(`${label}: ${v.join(", ")}`)
      return
    }
    if (isDefinedValue(v)) out.push(`${label}: ${normalizeOptional(v)}`)
  }
  const c = intake.coreIdea
  const k = intake.constraints
  push("Summary", c.projectSummary)
  push("Problem", c.problemStatement)
  push("Beneficiaries", c.targetBeneficiaries)
  push("Solution", c.proposedSolution)
  push("Objectives", c.mainObjectives)
  push("Expected results", c.expectedResults)
  push("Sectors", c.sectors)
  push("Location", c.projectLocation)
  push("Duration", c.projectDuration)
  push("Maturity", c.projectMaturity)
  push("Budget", k.availableBudget)
  push("Funding status", k.fundingStatus)
  push("Resources", k.availableResources)
  push("Team", k.teamComposition)
  push("Deadline", k.implementationDeadline)
  push("Milestones", k.keyMilestones)
  push("Geographical constraints", k.geographicalConstraints)
  push("Regulatory constraints", k.regulatoryConstraints)
  push("Technical constraints", k.technicalConstraints)
  push("Operational constraints", k.operationalConstraints)
  push("Non-negotiable requirements", k.nonNegotiableRequirements)
  push("Risk tolerance", k.riskTolerance)
  push("Preferred approach", k.preferredImplementationApproach)
  push("Known assumptions", k.knownAssumptions)
  return out
}

function collectUnknown(intake: ProjectIntake): string[] {
  const missing: string[] = []
  const check = (label: string, v: string | string[] | undefined, optional = true) => {
    if (!optional && !normalizeOptional(v as string) && !(Array.isArray(v) && v.length)) missing.push(label)
    if (Array.isArray(v)) return
    if (!isDefinedValue(v) && normalizeOptional(v) === "Not yet defined") missing.push(`${label}: Not yet defined`)
  }
  const c = intake.coreIdea
  const k = intake.constraints
  check("Budget", k.availableBudget)
  check("Funding status", k.fundingStatus)
  check("Resources", k.availableResources)
  check("Team", k.teamComposition)
  check("Deadline", k.implementationDeadline)
  check("Risk tolerance", k.riskTolerance)
  return missing
}

export function formDataToIntake(form: ProjectFormData): ProjectIntake {
  // New rich form: form.intake is the source of truth; legacy fields mapped for compat.
  if (form.intake) return form.intake
  // Legacy fallback
  const intake = defaultIntake()
  intake.coreIdea.projectSummary = form.title || ""
  intake.coreIdea.mainObjectives = form.objective || ""
  intake.coreIdea.additionalContext = form.context || ""
  intake.coreIdea.expectedResults = form.outcome || ""
  intake.constraints.implementationDeadline = form.targetDate || ""
  intake.constraints.availableBudget = form.budget || ""
  intake.constraints.availableResources = form.resources || ""
  return intake
}
