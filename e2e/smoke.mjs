import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { chromium } = require("/home/tobi/wondertours_web_site/node_modules/playwright")

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8443"
const failures = []
const ok = (name, cond, detail = "") => {
  if (cond) console.log(`PASS ${name}`)
  else {
    failures.push(`${name}${detail ? `: ${detail}` : ""}`)
    console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`)
  }
}

const seed = () => {
  const now = Date.now()
  const DAY = 86400000
  const mk = (id, title, status, offset) => ({
    id,
    title,
    objective: "Validate the approach with measurable evidence.",
    context: "c",
    outcome: "o",
    targetDate: new Date(now + 40 * DAY).toISOString(),
    createdAt: new Date(now - offset * DAY).toISOString(),
    updatedAt: new Date(now - offset * DAY).toISOString(),
    status,
    tags: ["e2e"],
    phases: [
      {
        id: "ph1",
        title: "Assessment",
        objective: "Scope",
        tasks: [
          {
            id: "t1",
            title: "Task 1",
            description: "d",
            priority: "High",
            duration: "2d",
            dependency: "-",
            resource: "Core",
            deliverable: "n",
            completed: true,
          },
          {
            id: "t2",
            title: "Task 2",
            description: "d",
            priority: "Medium",
            duration: "1d",
            dependency: "-",
            resource: "Core",
            deliverable: "n",
            completed: false,
          },
        ],
      },
    ],
    risks: [{ title: "Risk 1", likelihood: "Low", mitigation: "m" }],
    assumptions: [],
    successCriteria: ["Criterion 1"],
  })
  return [
    mk("e2e-1", "Regional market entry validation", "Analyzing", 0),
    mk("e2e-2", "Migration Postgres to branch model", "Plan ready", 1),
  ]
}

const browser = await chromium.launch()
try {
  {
    const page = await browser.newPage({ viewport: { width: 1512, height: 950 } })
    const errors = []
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)))
    await page.goto(`${BASE}/?e2e=1`, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1200)
    ok("landing loads", await page.locator("body").count() > 0)
    ok("landing has brand", (await page.textContent("body"))?.includes("LeanIE") ?? false)

    await page.evaluate((s) => {
      localStorage.setItem("leanie-projects-v1", JSON.stringify(s))
      localStorage.setItem("leanie-theme", "light")
    }, seed())
    await page.goto(`${BASE}/?e2e=2`, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(900)
    await page.evaluate(() => {
      Array.from(document.querySelectorAll("a, button")).find((el) =>
        /get started|overview|commencer|vue/i.test(el.textContent || ""),
      )?.click()
    })
    await page.waitForTimeout(1200)
    ok("enters app shell", (await page.locator(".app-shell, .topbar, nav").count()) > 0)

    await page.evaluate(() => {
      Array.from(document.querySelectorAll(".nav-list button")).find((el) =>
        /My Projects|Mes projets/i.test(el.textContent || ""),
      )?.click()
    })
    await page.waitForTimeout(700)
    const table = await page.evaluate(() => {
      const row = document.querySelector(".table-line")
      const head = document.querySelector(".table-head")
      if (!row || !head) return null
      const rx = Array.from(row.children).map((c) => Math.round(c.getBoundingClientRect().x))
      const hx = Array.from(head.children).map((c) => Math.round(c.getBoundingClientRect().x))
      return {
        rowDisplay: getComputedStyle(row).display,
        aligned: JSON.stringify(rx) === JSON.stringify(hx),
      }
    })
    ok("projects table grid aligned", table?.rowDisplay === "grid" && table?.aligned, JSON.stringify(table))

    await page.evaluate(() => {
      Array.from(document.querySelectorAll("aside button, .sidebar-bottom button, .nav-list button")).find((el) =>
        /Settings|Paramètres/i.test(el.textContent || ""),
      )?.click()
    })
    await page.waitForTimeout(500)
    ok("settings renders", (await page.locator(".settings-card, .settings-layout").count()) > 0)

    ok("no page errors", errors.length === 0, errors.join(" | "))
    await page.close()
  }

  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.goto(`${BASE}/?e2e=m1`, { waitUntil: "domcontentloaded" })
    await page.evaluate((s) => {
      localStorage.setItem("leanie-projects-v1", JSON.stringify(s))
      localStorage.setItem("leanie-theme", "light")
    }, seed())
    await page.goto(`${BASE}/?e2e=m2`, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(900)
    await page.evaluate(() => {
      Array.from(document.querySelectorAll("a, button")).find((el) =>
        /get started|overview|commencer|vue/i.test(el.textContent || ""),
      )?.click()
    })
    await page.waitForTimeout(1200)
    const mob = await page.evaluate(() => {
      const mb = document.querySelector(".menu-button")
      return {
        hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
        menuVisible: mb ? getComputedStyle(mb).display !== "none" : false,
      }
    })
    ok("mobile no horizontal scroll", !mob.hscroll, JSON.stringify(mob))
    ok("mobile hamburger visible", mob.menuVisible, JSON.stringify(mob))
    await page.close()
  }
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`\n${failures.length} E2E failure(s)`)
  process.exit(1)
}
console.log("\nAll E2E checks passed")
