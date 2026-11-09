# LeanIE Plan — Roadmap P3 à P6

Statut : P1/P2 livrés et déployés (commits jusqu'à `a247bc0` inclus) — P3 à P6 restent à implémenter.
Mise à jour : 2026-11-06.

## P3 — Persistance serveur, comptes et collaboration

1. **Multi-utilisateurs / comptes avancés**
   Auth Neon en place, mais manquent gestion de profil robuste, récupération de mot de passe et invitations.
2. **Synchronisation multi-appareils et état offline**
   Persistance Neon déployée, mais pas de reconciliation offline / mode dégradé ni sync en temps réel dans toute l’app.
3. **Partage de plan**
   Pas de lien de partage public/privé à partir de Neon Data API.
4. **Collaboration / édition à plusieurs**
   Absent.
5. **Import/export de projet complet**
   Markdown/CSV/PDF côté client déjà fait, mais import de brief/projet manquant.
6. **Historique / snapshots de versioning**
   Pas de suivi des versions de plan.
7. **Sauvegarde/versioning des hypothèses**
   Assumptions éditables, historique non stocké.

## P4 — UX, i18n, accessibilité et paramètres

8. **Internationalisation réelle et multilingue**
   Dictionnaire typé et chargeur déjà prêts côté historique, mais UI locale encore largement anglaise.
9. **Achèvement complet du mode sombre**
   CSS partiellement adapté, audit complet restant.
10. **Amélioration de la palette de commandes**
    Projets + navigation uniquement ; ajouter filtres et actions.
11. **Paramètres de langue et préférences actives**
    Sélecteur présent mais pas encore fonctionnel.
12. **Accessibilité audit (clavier, ARIA, contraste)** — non couvert par P3.
13. **Performance et démultiplexage bundle**
    Bundle supérieur à 500 kB actuel.
14. **Export PDF robuste et qualité document**
    Basé sur impression d’iframe ; PDF natif côté serveur/edge reste à améliorer.

## P5 — Provider IA et couverture tests

15. **Méta-modèle provider optionnel** (rester à implémenter).
16. **Tests unitaires et tests d’intégration** (Zod, storage, orchestration).
17. **Tests E2E (Playwright)** pour couvrir tous les flux automatiquement.
18. **Observabilité et logs IA** : logs structurés, traces pour NIM deliveries.

## P6 — Fonctionnalités avancées (optionnelles à terme)

19. **Notifications / reminders / échéances** sur les projets.
20. **Commentaires et annotation de plans** pour plusieurs utilisateurs.
21. **Templates ou onboarding projet**.
22. **Recherche sémantique** dans projets, tâches, concepts.
23. **Connected systems / webhook automation**.

---

## Statut actuel (référence)

- P1/P2 (itérations précédentes) :
  - App React/Vite/Tailwind + Neon (auth, data API, functions, storage, realtime)
  - Projets, council analysis, plan éditable avec phases/tâches/risques/assumptions
  - Council analysis via NIM providers, realtime benchmark dashboard, multi-provider admin
  - Metrics + filtres/pagination (livré au commit `a247bc0`)
  - Admin sous-menus, diagramme admin ≡ page council, settings sous-menus
- Ce fichier regroupe le travail restant pour ne pas l'oublier. Les items sont marqués `[ ]` puis `[x]` au fur et à mesure.

## Suivi

- [x] P3.1 Multi-utilisateurs / comptes avancés
- [x] P3.2 Sync multi-appareils / offline
- [x] P3.3 Partage de plan public/privé
- [x] P3.4 Collaboration / édition à plusieurs
- [x] P3.5 Import/export de projet complet
- [x] P3.6 Historique / snapshots de versioning
- [x] P3.7 Versioning des hypothèses
- [x] P4.8 Internationalisation réelle
- [x] P4.9 Mode sombre complet
- [x] P4.10 Palette de commandes avancée
- [x] P4.11 Paramètres de langue actifs
- [x] P4.12 Accessibilité (audit clavier/ARIA/contraste)
- [x] P4.13 Performance / split bundle
- [x] P4.14 Export PDF robuste
- [ ] P5.15 Méta-modèle provider optionnel
- [ ] P5.16 Tests unitaires et d'intégration
- [ ] P5.17 Tests E2E Playwright
- [ ] P5.18 Observabilité et logs IA structurés
- [ ] P6.19 Notifications / reminders / échéances
- [ ] P6.20 Commentaires et annotation de plans
- [ ] P6.21 Templates / onboarding projet
- [ ] P6.22 Recherche sémantique
- [ ] P6.23 Connected systems / webhook automation
",