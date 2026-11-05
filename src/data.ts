import type { Analyst, Phase, Project, Risk } from "./types"

export const analysts: Analyst[] = [
  {
    role: "Strategic Analyst",
    model: "Model S-1",
    description: "Examines strategic coherence, relevance, and alignment.",
    preview:
      "The core objective is well defined. Narrowing the first release to one audience will strengthen strategic focus.",
    strength: "Strong alignment",
  },
  {
    role: "Feasibility Analyst",
    model: "Model F-2",
    description: "Tests technical, operational, and financial feasibility.",
    preview:
      "A six-week validation window is achievable if the initial scope remains constrained to the primary workflow.",
    strength: "Moderate confidence",
  },
  {
    role: "Critical Reviewer",
    model: "Model C-3",
    description: "Challenges assumptions and exposes blind spots or risks.",
    preview:
      "The plan assumes reliable access to early users. A recruitment fallback and explicit success threshold are required.",
    strength: "3 assumptions flagged",
  },
]

export const samplePhases: Phase[] = [
  {
    id: "phase-1",
    title: "01 — Validate the problem",
    objective:
      "Confirm that the target audience experiences the problem frequently and urgently enough to act.",
    tasks: [
      {
        id: "task-1",
        title: "Define validation criteria",
        description:
          "Translate the project objective into measurable evidence thresholds.",
        priority: "High",
        duration: "2 days",
        dependency: "None",
        resource: "Project lead",
        deliverable: "Validation scorecard",
      },
      {
        id: "task-2",
        title: "Interview 8 target users",
        description:
          "Run structured interviews focused on current behavior, cost of the problem, and alternatives.",
        priority: "High",
        duration: "1 week",
        dependency: "Validation criteria",
        resource: "Researcher",
        deliverable: "Interview synthesis",
      },
    ],
  },
  {
    id: "phase-2",
    title: "02 — Prototype the core path",
    objective:
      "Create the smallest credible experience that tests the principal value proposition.",
    tasks: [
      {
        id: "task-3",
        title: "Map the critical user journey",
        description:
          "Reduce the proposed experience to the decisions and actions needed for the primary outcome.",
        priority: "High",
        duration: "3 days",
        dependency: "Interview synthesis",
        resource: "Product designer",
        deliverable: "Journey map",
      },
      {
        id: "task-4",
        title: "Build a testable prototype",
        description:
          "Produce a focused prototype covering the core workflow and key edge cases.",
        priority: "Medium",
        duration: "2 weeks",
        dependency: "Journey map",
        resource: "Designer + developer",
        deliverable: "Interactive prototype",
      },
    ],
  },
  {
    id: "phase-3",
    title: "03 — Test and decide",
    objective:
      "Measure value, usability, and delivery risk before committing to a broader build.",
    tasks: [
      {
        id: "task-5",
        title: "Run moderated tests",
        description:
          "Observe five target users completing the critical workflow and capture structured evidence.",
        priority: "High",
        duration: "1 week",
        dependency: "Interactive prototype",
        resource: "Product lead",
        deliverable: "Test findings",
      },
      {
        id: "task-6",
        title: "Make the proceed / revise decision",
        description:
          "Compare evidence to thresholds and document the next investment decision.",
        priority: "Medium",
        duration: "2 days",
        dependency: "Test findings",
        resource: "Project sponsor",
        deliverable: "Decision memo",
      },
    ],
  },
]

export const sampleRisks: Risk[] = [
  {
    title: "Insufficient access to target users",
    likelihood: "Medium",
    mitigation: "Recruit through two channels and maintain a 30% reserve list.",
  },
  {
    title: "Prototype scope expands during delivery",
    likelihood: "High",
    mitigation:
      "Freeze the critical path after journey mapping; defer secondary workflows.",
  },
  {
    title: "Positive feedback is mistaken for intent",
    likelihood: "Medium",
    mitigation: "Measure behavior and commitment, not stated preference alone.",
  },
]

export const sampleAssumptions = [
  "Target users experience the problem at least monthly.",
  "A prototype is sufficient to test the core value.",
  "Decision-makers accept a staged investment model.",
]

export const sampleSuccessCriteria = [
  "At least 6 of 8 interviews confirm recurring urgency.",
  "4 of 5 test users complete the critical path.",
  "Delivery estimate remains inside the stated constraint.",
]

export const sampleTags = ["validation", "prototype", "decision"]

export const demoProject: Project = {
  id: "demo-market-entry",
  title: "Regional market entry validation",
  objective:
    "Determine whether a focused market entry is viable before committing a full operating budget.",
  context:
    "The concept has internal support but limited direct evidence from prospective customers in the target region.",
  outcome:
    "A defendable go / revise / stop decision supported by customer and operational evidence.",
  assumptions: sampleAssumptions,
  successCriteria: sampleSuccessCriteria,
  tags: sampleTags,
  targetDate: "2026-06-30",
  budget: "$12,000 validation budget",
  resources: "Product lead, researcher, part-time designer",
  createdAt: "2026-03-12T09:00:00.000Z",
  updatedAt: "2026-03-17T14:30:00.000Z",
  status: "Plan ready",
  phases: samplePhases,
  risks: sampleRisks,
}

export const cloneDemoPlan = () => ({
  phases: structuredClone(samplePhases),
  risks: structuredClone(sampleRisks),
  assumptions: structuredClone(sampleAssumptions),
  successCriteria: structuredClone(sampleSuccessCriteria),
  tags: structuredClone(sampleTags),
})
