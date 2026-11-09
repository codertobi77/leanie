import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type Lang = "en" | "fr"

/**
 * Typed dictionary. `en` defines the canonical key set; `fr` must keep
 * exactly the same keys (enforced by the `satisfies` below).
 */
const en = {
  // Sidebar / navigation
  "nav.workspace": "WORKSPACE",
  "nav.overview": "Overview",
  "nav.projects": "My Projects",
  "nav.new": "New Project",
  "nav.settings": "Settings",
  "nav.admin": "Admin",
  "nav.newBadge": "NEW",
  "nav.quickSearch": "Quick search",
  "nav.collapse": "Collapse sidebar",
  "nav.expand": "Expand sidebar",
  "nav.localPrototype": "Local prototype",
  "nav.localPrototypeDesc": "Data stored in this browser",
  "nav.productSite": "Product site",
  "nav.closeMenu": "Close menu",
  "nav.openNavigation": "Open navigation",

  // Landing
  "landing.howItWorks": "How it works",
  "landing.aiCouncil": "AI Council",
  "landing.benefits": "Benefits",
  "landing.getStarted": "Get started",
  "landing.eyebrow": "LeanIE · Lean Intelligence Engine",
  "landing.title1": "Better thinking.",
  "landing.title2": "Clearer plans.",
  "landing.title3": "Smarter execution.",
  "landing.subtitle":
    "Turn an idea into a realistic plan through a Council of specialized AI perspectives—challenged, compared, and synthesized for action.",
  "landing.startPlanning": "Start planning",
  "landing.discover": "Discover how it works",
  "landing.prototypeNote": "Interactive prototype · Simulated AI analysis",
  "landing.councilSession": "COUNCIL SESSION",
  "landing.footerTagline":
    "LeanIE Plan — part of the LeanIE suite by LiteTECH Solutions · © 2026",

  // Dashboard
  "dashboard.greeting": "Good morning.",
  "dashboard.tagline": "Turn your next open question into a defensible plan.",
  "dashboard.createProject": "Create a project",
  "dashboard.totalProjects": "Total projects",
  "dashboard.plansReady": "Plans ready",
  "dashboard.validated": "Validated",
  "dashboard.recentProjects": "Recent projects",
  "dashboard.recentSub": "Demonstration content and your locally saved projects.",
  "dashboard.viewAll": "View all",

  // Projects screen
  "projects.kicker": "PROJECT LIBRARY",
  "projects.title": "My projects",
  "projects.searchPlaceholder": "Search title, objective or context…",
  "projects.searchLabel": "Search projects",
  "projects.allStatuses": "All statuses",
  "projects.filterStatus": "Filter by status",
  "projects.sortNewest": "Newest first",
  "projects.sortOldest": "Oldest first",
  "projects.sortTitle": "Title",
  "projects.sortStatus": "Status",
  "projects.sortLabel": "Sort projects",
  "projects.tagFilter": "Tag filter",
  "projects.filterTag": "Filter by tag",
  "projects.import": "Import",
  "projects.newProject": "New project",
  "projects.updated": "Updated",
  "projects.shown": "shown",

  // New project form
  "form.step1": "Core idea",
  "form.step2": "Constraints",
  "form.step3": "Review",
  "form.next": "Continue",
  "form.back": "Back",
  "form.createProject": "Run the Council",
  "form.cancel": "Cancel",

  // Settings
  "settings.kicker": "PREFERENCES",
  "settings.title": "Settings",
  "settings.subtitle":
    "Keep the experience comfortable and understand how this prototype handles data.",
  "settings.tabAppearance": "Appearance",
  "settings.tabAccount": "Account",
  "settings.tabData": "Data",
  "settings.tabAbout": "About",
  "settings.themeTitle": "Interface theme",
  "settings.themeDesc": "Choose how LeanIE Plan appears on this device.",
  "settings.light": "Light",
  "settings.dark": "Dark",
  "settings.languageTitle": "Language",
  "settings.languageDesc":
    "Choose the interface language. The preference is saved on this device.",
  "settings.english": "English",
  "settings.french": "Français",
  "settings.switchToDark": "Switch to dark theme",
  "settings.switchToLight": "Switch to light theme",

  // Command palette
  "palette.placeholder": "Search projects or jump to…",
  "palette.searchLabel": "Search commands",
  "palette.close": "Close command palette",
  "palette.noResults": "No matching projects or commands",
  "palette.noResultsHint": "Try a different title or destination.",
  "palette.hintNavigate": "Navigate",
  "palette.hintAction": "Action",
  "palette.hintTheme": "Theme",
  "palette.openOverview": "Open overview",
  "palette.newProject": "Create a new project",
  "palette.browseProjects": "Browse all projects",
  "palette.openSettings": "Open settings",
  "palette.openAdmin": "Open admin metrics",
  "palette.toggleTheme": "Toggle dark mode",
  "palette.filterStatusHint": "Filter projects by status (is:draft…)",
  "palette.filterTagHint": "Filter projects by tag (tag:…)",
  "palette.filteredBy": "Filtered by",
  "palette.navigateHint": "navigate",
  "palette.openHint": "open",
  "palette.closeHint": "close",

  // Statuses (display only — data values stay English)
  "status.Draft": "Draft",
  "status.Analyzing": "Analyzing",
  "status.Plan ready": "Plan ready",
  "status.Validated": "Validated",
  // Shared / misc chrome
  "shared.loading": "Loading shared plan...",
  "shared.unavailable": "Shared plan is unavailable.",
  "common.signOut": "Sign out",
  "common.delete": "Delete",
  "common.open": "Open",
  "nav.product": "LeanIE Plan",
  "nav.activeProject": "Active project",
  "nav.kickerAdmin": "ADMINISTRATION",
  "nav.help": "Help",
  "nav.storage": "Local storage",
  "topbar.notifications": "Notifications",
  "topbar.noNotifications": "You're all caught up.",
  "topbar.eventValidated": "Plan validated",
  "topbar.eventCouncil": "Council analysis completed",
  "topbar.eventBrief": "Project brief updated",
  "dashboard.eyebrow": "Desk edition — live data",
  "dashboard.inAnalysis": "In analysis",
  "dashboard.taskLabel": "Tasks",
  "dashboard.progressLabel": "Progress",
  "dashboard.filterAll": "All",
  "dashboard.filterReady": "Plan ready",
  "dashboard.filterValidated": "Validated",
  "dashboard.continueLabel": "Continue analysis",
  "dashboard.targetLabel": "Target",
  "dashboard.noTarget": "No target date",
  "dashboard.paperBrief": "Project brief",
  "dashboard.paperCouncil": "Council review",
  "dashboard.tasksCount": "tasks",
  "dashboard.risksCount": "risks",
  "dashboard.queueTitle": "Decision queue",
  "dashboard.queueIntro": "Analyses finished — validate the plan to proceed.",
  "dashboard.queueEmpty": "Nothing waiting for a decision.",
  "dashboard.prototypeNote": "Prototype mode — Council responses are deterministic demonstration content stored on this device.",
  "dashboard.footerNote": "LEANIE PLAN · LOCAL WORKSPACE",
  "table.project": "Project",
  "table.status": "Status",
  "table.tasks": "Tasks",
  "table.updated": "Updated",
  "empty.title": "Start with an open question",
  "empty.body": "Describe an idea, decision or project. The Council will help you test it before you commit.",
  "empty.cta": "Create your first project",
  "missing.title": "Project information is unavailable",
  "missing.body": "This project may have been removed from local storage. Return to the project library or begin a new Council session.",
  "missing.browse": "Browse projects",
  "council.active": "COUNCIL SIMULATION ACTIVE",
  "council.paused": "SIMULATION PAUSED",
  "council.subtitle": "Three independent perspectives analyze in parallel before converging on the Arbiter.",
  "council.stageOf": "Stage {n} of 5 · {stage}",
  "council.processing": "Processing",
  "council.errorTitle": "Analysis simulation interrupted",
  "council.errorBody": "No project data was lost. Retry to restart the state-driven sequence.",
  "council.retry": "Retry analysis",
  "council.errorPreview": "Preview error state",
  "council.timingNote": "Animation timing is driven by the simulated Council stage.",
  "council.demoNotice": "Deterministic demo · no live AI",
  "settings.preferences": "Preferences",
  "settings.preferencesBody": "Manage display, language and account options for this device.",
} as const

export type DictKey = keyof typeof en

const fr: Record<DictKey, string> = {
  "nav.workspace": "ESPACE",
  "nav.overview": "Vue d’ensemble",
  "nav.projects": "Mes projets",
  "nav.new": "Nouveau projet",
  "nav.settings": "Paramètres",
  "nav.admin": "Admin",
  "nav.newBadge": "NOUVEAU",
  "nav.quickSearch": "Recherche rapide",
  "nav.collapse": "Réduire le menu",
  "nav.expand": "Déplier le menu",
  "nav.localPrototype": "Prototype local",
  "nav.localPrototypeDesc": "Données stockées dans ce navigateur",
  "nav.productSite": "Site produit",
  "nav.closeMenu": "Fermer le menu",
  "nav.openNavigation": "Ouvrir la navigation",

  "landing.howItWorks": "Comment ça marche",
  "landing.aiCouncil": "Conseil IA",
  "landing.benefits": "Bénéfices",
  "landing.getStarted": "Commencer",
  "landing.eyebrow": "LeanIE · Moteur d’intelligence lean",
  "landing.title1": "Mieux réfléchir.",
  "landing.title2": "Des plans plus clairs.",
  "landing.title3": "Une exécution plus fine.",
  "landing.subtitle":
    "Transformez une idée en plan réaliste grâce à un Conseil de perspectives IA spécialisées — confrontées, comparées et synthétisées pour l’action.",
  "landing.startPlanning": "Commencer un plan",
  "landing.discover": "Découvrir le fonctionnement",
  "landing.prototypeNote": "Prototype interactif · Analyse IA simulée",
  "landing.councilSession": "SESSION CONSEIL",
  "landing.footerTagline":
    "LeanIE Plan — fait partie de la suite LeanIE par LiteTECH Solutions · © 2026",

  "dashboard.greeting": "Bonjour.",
  "dashboard.tagline":
    "Transformez votre prochaine question ouverte en plan défendable.",
  "dashboard.createProject": "Créer un projet",
  "dashboard.totalProjects": "Projets au total",
  "dashboard.plansReady": "Plans prêts",
  "dashboard.validated": "Validés",
  "dashboard.recentProjects": "Projets récents",
  "dashboard.recentSub":
    "Contenu de démonstration et projets enregistrés localement.",
  "dashboard.viewAll": "Tout voir",

  "projects.kicker": "BIBLIOTHÈQUE DE PROJETS",
  "projects.title": "Mes projets",
  "projects.searchPlaceholder": "Rechercher titre, objectif ou contexte…",
  "projects.searchLabel": "Rechercher des projets",
  "projects.allStatuses": "Tous les statuts",
  "projects.filterStatus": "Filtrer par statut",
  "projects.sortNewest": "Plus récents",
  "projects.sortOldest": "Plus anciens",
  "projects.sortTitle": "Titre",
  "projects.sortStatus": "Statut",
  "projects.sortLabel": "Trier les projets",
  "projects.tagFilter": "Filtre par tag",
  "projects.filterTag": "Filtrer par tag",
  "projects.import": "Importer",
  "projects.newProject": "Nouveau projet",
  "projects.updated": "Mis à jour",
  "projects.shown": "affichés",

  "form.step1": "Idée centrale",
  "form.step2": "Contraintes",
  "form.step3": "Revue",
  "form.next": "Continuer",
  "form.back": "Retour",
  "form.createProject": "Lancer le Conseil",
  "form.cancel": "Annuler",

  "settings.kicker": "PRÉFÉRENCES",
  "settings.title": "Paramètres",
  "settings.subtitle":
    "Gardez une expérience confortable et comprenez comment ce prototype traite vos données.",
  "settings.tabAppearance": "Apparence",
  "settings.tabAccount": "Compte",
  "settings.tabData": "Données",
  "settings.tabAbout": "À propos",
  "settings.themeTitle": "Thème de l’interface",
  "settings.themeDesc": "Choisissez l’apparence de LeanIE Plan sur cet appareil.",
  "settings.light": "Clair",
  "settings.dark": "Sombre",
  "settings.languageTitle": "Langue",
  "settings.languageDesc":
    "Choisissez la langue de l’interface. La préférence est enregistrée sur cet appareil.",
  "settings.english": "English",
  "settings.french": "Français",
  "settings.switchToDark": "Passer au thème sombre",
  "settings.switchToLight": "Passer au thème clair",

  "palette.placeholder": "Rechercher un projet ou une action…",
  "palette.searchLabel": "Rechercher des commandes",
  "palette.close": "Fermer la palette de commandes",
  "palette.noResults": "Aucun projet ni commande correspondant",
  "palette.noResultsHint": "Essayez un autre titre ou une autre destination.",
  "palette.hintNavigate": "Navigation",
  "palette.hintAction": "Action",
  "palette.hintTheme": "Thème",
  "palette.openOverview": "Ouvrir la vue d’ensemble",
  "palette.newProject": "Créer un nouveau projet",
  "palette.browseProjects": "Parcourir tous les projets",
  "palette.openSettings": "Ouvrir les paramètres",
  "palette.openAdmin": "Ouvrir les métriques admin",
  "palette.toggleTheme": "Basculer le mode sombre",
  "palette.filterStatusHint": "Filtrer les projets par statut (is:draft…)",
  "palette.filterTagHint": "Filtrer les projets par tag (tag:…)",
  "palette.filteredBy": "Filtré par",
  "palette.navigateHint": "naviguer",
  "palette.openHint": "ouvrir",
  "palette.closeHint": "fermer",

  "status.Draft": "Brouillon",
  "status.Analyzing": "Analyse",
  "status.Plan ready": "Plan prêt",
  "status.Validated": "Validé",

  "shared.loading": "Chargement du plan partagé...",
  "shared.unavailable": "Le plan partagé est indisponible.",
  "common.signOut": "Se déconnecter",
  "common.delete": "Supprimer",
  "common.open": "Ouvrir",
  "nav.product": "LeanIE Plan",
  "nav.activeProject": "Projet actif",
  "nav.kickerAdmin": "ADMINISTRATION",
  "nav.help": "Aide",
  "nav.storage": "Stockage local",
  "topbar.notifications": "Notifications",
  "topbar.noNotifications": "Vous êtes à jour.",
  "topbar.eventValidated": "Plan validé",
  "topbar.eventCouncil": "Analyse du Conseil terminée",
  "topbar.eventBrief": "Brief du projet mis à jour",
  "dashboard.eyebrow": "Édition bureau — données en direct",
  "dashboard.inAnalysis": "En analyse",
  "dashboard.taskLabel": "Tâches",
  "dashboard.progressLabel": "Progression",
  "dashboard.filterAll": "Tout",
  "dashboard.filterReady": "Plan prêt",
  "dashboard.filterValidated": "Validé",
  "dashboard.continueLabel": "Reprendre l'analyse",
  "dashboard.targetLabel": "Échéance",
  "dashboard.noTarget": "Aucune échéance",
  "dashboard.paperBrief": "Brief du projet",
  "dashboard.paperCouncil": "Revue du Conseil",
  "dashboard.tasksCount": "tâches",
  "dashboard.risksCount": "risques",
  "dashboard.queueTitle": "File de décision",
  "dashboard.queueIntro": "Analyses terminées — validez le plan pour continuer.",
  "dashboard.queueEmpty": "Aucune décision en attente.",
  "dashboard.prototypeNote": "Mode prototype — les réponses du Conseil sont un contenu de démonstration déterministe stocké sur cet appareil.",
  "dashboard.footerNote": "LEANIE PLAN · ESPACE DE TRAVAIL LOCAL",
  "table.project": "Projet",
  "table.status": "Statut",
  "table.tasks": "Tâches",
  "table.updated": "Mise à jour",
  "empty.title": "Commencez par une question ouverte",
  "empty.body": "Décrivez une idée, une décision ou un projet. Le Conseil vous aide à la tester avant de vous engager.",
  "empty.cta": "Créer votre premier projet",
  "missing.title": "Les informations du projet sont indisponibles",
  "missing.body": "Ce projet a peut-être été retiré du stockage local. Revenez à la bibliothèque de projets ou démarrez une nouvelle session du Conseil.",
  "missing.browse": "Parcourir les projets",
  "council.active": "SIMULATION DU CONSEIL ACTIVE",
  "council.paused": "SIMULATION EN PAUSE",
  "council.subtitle": "Trois perspectives indépendantes analysent en parallèle avant de converger vers l'Arbitre.",
  "council.stageOf": "Étape {n} sur 5 · {stage}",
  "council.processing": "Traitement",
  "council.errorTitle": "Simulation d'analyse interrompue",
  "council.errorBody": "Aucune donnée du projet n'a été perdue. Relancez pour reprendre la séquence.",
  "council.retry": "Relancer l'analyse",
  "council.errorPreview": "Prévisualiser l'état d'erreur",
  "council.timingNote": "Le rythme de l'animation est piloté par l'étape simulée du Conseil.",
  "council.demoNotice": "Démo déterministe · sans IA en direct",
  "settings.preferences": "Préférences",
  "settings.preferencesBody": "Gérez les options d'affichage, de langue et de compte de cet appareil.",
}

const dictionaries: Record<Lang, Record<DictKey, string>> = { en, fr }

export function translate(lang: Lang, key: DictKey): string {
  return dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? key
}

export function formatDate(value: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "fr" ? "fr" : "en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

export function formatToday(lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "fr" ? "fr" : "en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date())
}

const LANG_KEY = "leanie-lang"

interface LangContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: DictKey) => string
}

const LangContext = createContext<LangContextValue | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() =>
    localStorage.getItem(LANG_KEY) === "fr" ? "fr" : "en",
  )

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang)
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<LangContextValue>(
    () => ({ lang, setLang, t: (key: DictKey) => translate(lang, key) }),
    [lang],
  )

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): LangContextValue {
  const value = useContext(LangContext)
  if (!value) throw new Error("useLang must be used inside LangProvider")
  return value
}
