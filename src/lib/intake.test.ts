import { describe, expect, it } from "vitest"
import {
  buildCouncilBrief,
  defaultIntake,
  decodeContextWithIntake,
  encodeContextWithIntake,
  formDataToIntake,
  intakeToLegacyFields,
  isDefinedValue,
} from "./intake"
import type { ProjectFormData } from "../types"

describe("intake codec", () => {
  it("encode/decode roundtrip preserves human context and intake", () => {
    const intake = defaultIntake()
    intake.coreIdea.projectSummary = "Improve access to clean water"
    intake.coreIdea.problemStatement = "Communities lack reliable water access causing health issues"
    intake.constraints.availableBudget = "50000 EUR"
    intake.constraints.fundingStatus = "Seeking funding"
    const encoded = encodeContextWithIntake("Project context here", intake)
    expect(encoded).toContain("[LEANIE_INTAKE_V1]")
    const decoded = decodeContextWithIntake(encoded)
    expect(decoded.context).toBe("Project context here")
    expect(decoded.intake?.coreIdea.projectSummary).toBe("Improve access to clean water")
    expect(decoded.intake?.coreIdea.problemStatement).toBe("Communities lack reliable water access causing health issues")
    expect(decoded.intake?.constraints.availableBudget).toBe("50000 EUR")
    expect(decoded.intake?.constraints.fundingStatus).toBe("Seeking funding")
  })

  it("encodeContextWithIntake handles null/undefined intake", () => {
    expect(encodeContextWithIntake("Hello", null)).toBe("Hello")
    expect(encodeContextWithIntake("Hello", undefined)).toBe("Hello")
    expect(encodeContextWithIntake("", null)).toBe("")
  })

  it("decodeContextWithIntake handles raw context without marker", () => {
    const decoded = decodeContextWithIntake("Just plain context")
    expect(decoded.context).toBe("Just plain context")
    expect(decoded.intake).toBeNull()
  })

  it("decodeContextWithIntake handles malformed payload gracefully", () => {
    const bad = "context\n\n[LEANIE_INTAKE_V1]!!!badbase64!!!"
    const decoded = decodeContextWithIntake(bad)
    expect(decoded.intake).toBeNull()
    expect(decoded.context).toBeTruthy()
  })

  it("decodeContextWithIntake with empty string", () => {
    const decoded = decodeContextWithIntake("")
    expect(decoded.context).toBe("")
    expect(decoded.intake).toBeNull()
  })
})

describe("intake legacy mapping", () => {
  it("intakeToLegacyFields maps core idea and constraints correctly", () => {
    const intake = defaultIntake()
    intake.coreIdea.projectSummary = "Summary text"
    intake.coreIdea.problemStatement = "Problem text"
    intake.coreIdea.targetBeneficiaries = "Women and children"
    intake.coreIdea.mainObjectives = "Increase access"
    intake.coreIdea.expectedResults = "50% coverage"
    intake.coreIdea.proposedSolution = "Build wells"
    intake.coreIdea.sectors = ["Water & sanitation", "Health"]
    intake.coreIdea.projectLocation = "Rural Kenya"
    intake.coreIdea.projectMaturity = "Pilot"
    intake.coreIdea.additionalContext = "Seasonal droughts"
    intake.constraints.availableBudget = "75000 USD"
    intake.constraints.implementationDeadline = "2026-12-31"
    intake.constraints.availableResources = "2 engineers"
    intake.constraints.teamComposition = "Team of 3"
    
    const legacy = intakeToLegacyFields("Water Project", intake)
    expect(legacy.title).toBe("Water Project")
    expect(legacy.objective).toBe("Increase access")
    expect(legacy.outcome).toBe("50% coverage")
    expect(legacy.targetDate).toBe("2026-12-31")
    expect(legacy.budget).toBe("75000 USD")
    expect(legacy.resources).toContain("2 engineers")
    expect(legacy.resources).toContain("Team of 3")
    expect(legacy.tags).toContain("Water & sanitation")
    expect(legacy.tags).toContain("Pilot")
    expect(legacy.context).toContain("Problem: Problem text")
    expect(legacy.context).toContain("Beneficiaries: Women and children")
  })

  it("intakeToLegacyFields falls back correctly when fields missing", () => {
    const intake = defaultIntake()
    intake.coreIdea.projectSummary = "Fallback summary"
    const legacy = intakeToLegacyFields("Test Project", intake)
    expect(legacy.objective).toBe("Fallback summary")
    expect(legacy.outcome).toBe("")
    expect(legacy.budget).toBeUndefined()
    expect(legacy.targetDate).toBeUndefined()
    expect(legacy.resources).toBeUndefined()
  })

  it("formDataToIntake uses intake when present", () => {
    const intake = defaultIntake()
    intake.coreIdea.projectSummary = "From intake"
    const form: ProjectFormData = {
      title: "Test",
      objective: "",
      context: "",
      outcome: "",
      targetDate: "",
      budget: "",
      resources: "",
      intake,
    }
    const result = formDataToIntake(form)
    expect(result.coreIdea.projectSummary).toBe("From intake")
  })

  it("formDataToIntake maps legacy form fields when intake missing", () => {
    const form = {
      title: "Legacy Title",
      objective: "Legacy objective",
      context: "Legacy context",
      outcome: "Legacy outcome",
      targetDate: "2026-06-01",
      budget: "10000",
      resources: "2 people",
    } as ProjectFormData
    const result = formDataToIntake(form)
    expect(result.coreIdea.projectSummary).toBe("Legacy Title")
    expect(result.coreIdea.mainObjectives).toBe("Legacy objective")
    expect(result.coreIdea.additionalContext).toBe("Legacy context")
    expect(result.coreIdea.expectedResults).toBe("Legacy outcome")
    expect(result.constraints.implementationDeadline).toBe("2026-06-01")
    expect(result.constraints.availableBudget).toBe("10000")
    expect(result.constraints.availableResources).toBe("2 people")
  })
})

describe("known/unknown handling", () => {
  it("isDefinedValue returns false for empty and 'Not yet defined'", () => {
    expect(isDefinedValue("")).toBe(false)
    expect(isDefinedValue("   ")).toBe(false)
    expect(isDefinedValue(null)).toBe(false)
    expect(isDefinedValue(undefined)).toBe(false)
    expect(isDefinedValue("Not yet defined")).toBe(false)
  })

  it("isDefinedValue returns true for actual values", () => {
    expect(isDefinedValue("50000 EUR")).toBe(true)
    expect(isDefinedValue("Yes")).toBe(true)
    expect(isDefinedValue("0")).toBe(true)
  })

  it("buildCouncilBrief includes knownInformation and unknownOrNotYetDefined for intake", () => {
    const intake = defaultIntake()
    intake.coreIdea.projectSummary = "A project summary"
    intake.coreIdea.problemStatement = "A problem statement"
    intake.constraints.availableBudget = "10000"
    intake.constraints.fundingStatus = "Not yet defined"
    intake.constraints.riskTolerance = "Low"
    
    const brief: any = buildCouncilBrief({
      id: "1",
      title: "Test Project",
      intake,
    })
    
    expect(brief.intake).toBe(intake)
    expect(Array.isArray(brief.knownInformation)).toBe(true)
    expect(Array.isArray(brief.unknownOrNotYetDefined)).toBe(true)
    expect(brief.knownInformation.some((k: string) => k.includes("Summary"))).toBe(true)
    expect(brief.knownInformation.some((k: string) => k.includes("Budget"))).toBe(true)
    expect(brief.unknownOrNotYetDefined.some((k: string) => k.includes("Funding status"))).toBe(true)
  })

  it("buildCouncilBrief returns legacy fields when no intake", () => {
    const brief: any = buildCouncilBrief({
      id: "1",
      title: "Test",
      objective: "Obj",
      context: "Ctx",
      outcome: "Out",
      targetDate: "2026-01-01",
      budget: "5000",
      resources: "Team",
    })
    expect(brief.title).toBe("Test")
    expect(brief.objective).toBe("Obj")
    expect(brief.intake).toBeUndefined()
  })

  it("collectKnown captures sectors array correctly", () => {
    const intake = defaultIntake()
    intake.coreIdea.sectors = ["Health", "Education"]
    const brief: any = buildCouncilBrief({ id: "1", title: "Test", intake })
    expect(brief.knownInformation.some((k: string) => k.includes("Health") && k.includes("Education"))).toBe(true)
  })
})
