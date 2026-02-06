# Scomap — Spécifications Projet

> Application de gestion de transport scolaire moderne, successeur de Transcolaire.

## Contexte

Scomap reprend le concept de **Transcolaire**, un logiciel PHP legacy de gestion de transport scolaire (210K lignes, 123 tables, 200+ clients). L'objectif est de reconstruire une version moderne, maintenable et évolutive.

---

## Stack Technique

### Architecture

| Élément | Choix | Justification |
|---------|-------|---------------|
| **Structure** | Monorepo (Turborepo + pnpm) | Séparation claire, partage de code |
| **Frontend** | Next.js 15 + React 19 | SSR, App Router, excellent DX |
| **Langage** | TypeScript (strict) | Type-safety, maintenabilité |
| **Backend** | Next.js API Routes + tRPC | Type-safety end-to-end |

### Base de Données

| Élément | Choix | Justification |
|---------|-------|---------------|
| **SGBD** | PostgreSQL + PostGIS | Requêtes géospatiales natives |
| **ORM** | Drizzle | Proche du SQL, performant, flexible |
| **Multi-tenant** | Row Level Security (RLS) | Sécurité au niveau DB, pas de risque d'oubli de filtre |
| **Auth** | Auth.js | SSO, LDAP, OAuth, flexible |

### UI / Design

| Élément | Choix |
|---------|-------|
| **Composants** | shadcn/ui (style: `new-york`) |
| **CSS** | Tailwind CSS v4 |
| **Border Radius** | `0.3rem` |
| **Couleur Primary** | `#0D9488` (Teal) |
| **Background** | `#FAFAFA` |
| **Font** | Inter (Google Fonts) |

### Cartographie (100% Gratuit)

| Besoin | Solution |
|--------|----------|
| **Affichage carte** | MapLibre GL JS |
| **Tuiles fond de carte** | OpenFreeMap |
| **Geocoding** | adresse.data.gouv.fr (API française, illimitée) |
| **Calcul itinéraires** | OpenRouteService (2000 req/jour) → OSRM (self-hosted) en prod |

### Librairies Complémentaires

| Besoin | Choix |
|--------|-------|
| State / Data Fetching | TanStack Query (React Query v5) |
| Tables de données | TanStack Table |
| Formulaires | React Hook Form + Zod |
| Calendrier / Planning | FullCalendar |
| Génération PDF | React-PDF |
| Import/Export Excel | SheetJS |

---

## Palette de Couleurs

### Light Mode

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--primary` | `#0D9488` | Actions principales, liens |
| `--primary-foreground` | `#FFFFFF` | Texte sur primary |
| `--background` | `#FAFAFA` | Fond de page |
| `--foreground` | `#18181B` | Texte principal |
| `--card` | `#FFFFFF` | Fond des cards |
| `--card-foreground` | `#18181B` | Texte dans cards |
| `--muted` | `#F4F4F5` | Fonds secondaires |
| `--muted-foreground` | `#71717A` | Texte secondaire |
| `--accent` | `#CCFBF1` | Highlights, badges |
| `--accent-foreground` | `#0D9488` | Texte sur accent |
| `--border` | `#E4E4E7` | Bordures |
| `--input` | `#E4E4E7` | Bordures inputs |
| `--ring` | `#0D9488` | Focus ring |
| `--destructive` | `#DC2626` | Actions destructives |
| `--destructive-foreground` | `#FFFFFF` | Texte sur destructive |

### Dark Mode

| Variable | Valeur |
|----------|--------|
| `--primary` | `#14B8A6` |
| `--background` | `#18181B` |
| `--foreground` | `#FAFAFA` |
| `--card` | `#27272A` |
| `--muted` | `#3F3F46` |
| `--muted-foreground` | `#A1A1AA` |
| `--accent` | `#134E4A` |
| `--border` | `#3F3F46` |
| `--input` | `#3F3F46` |

---

## Structure Monorepo

```
scomap/
├── apps/
│   └── web/                          # Next.js 15
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/           # Login, Signup, Forgot Password
│       │   │   │   ├── layout.tsx    # Layout 2 colonnes
│       │   │   │   ├── login/
│       │   │   │   └── signup/
│       │   │   ├── (dashboard)/      # App principale
│       │   │   │   ├── layout.tsx    # Sidebar + Header
│       │   │   │   ├── dashboard/
│       │   │   │   ├── etablissements/
│       │   │   │   ├── usagers/
│       │   │   │   ├── circuits/
│       │   │   │   ├── trajets/
│       │   │   │   ├── planning/
│       │   │   │   ├── vehicules/
│       │   │   │   ├── chauffeurs/
│       │   │   │   └── facturation/
│       │   │   └── api/              # API Routes (tRPC)
│       │   ├── components/
│       │   │   ├── ui/               # shadcn/ui
│       │   │   ├── layout/           # AppSidebar, SiteHeader
│       │   │   ├── maps/             # MapLibre, markers
│       │   │   └── forms/            # Formulaires métier
│       │   ├── lib/
│       │   │   ├── auth/             # Auth.js config
│       │   │   ├── trpc/             # tRPC config
│       │   │   └── utils/            # Helpers (cn, etc.)
│       │   ├── hooks/
│       │   ├── types/
│       │   └── providers/
│       ├── public/
│       └── package.json
├── packages/
│   ├── db/                           # Drizzle
│   │   ├── src/
│   │   │   ├── schema/               # Tables
│   │   │   │   ├── tenants.ts
│   │   │   │   ├── users.ts
│   │   │   │   ├── etablissements.ts
│   │   │   │   ├── usagers.ts
│   │   │   │   ├── circuits.ts
│   │   │   │   ├── trajets.ts
│   │   │   │   ├── arrets.ts
│   │   │   │   ├── vehicules.ts
│   │   │   │   ├── chauffeurs.ts
│   │   │   │   └── factures.ts
│   │   │   ├── migrations/
│   │   │   ├── seed.ts
│   │   │   └── index.ts
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   ├── ui/                           # Composants partagés (optionnel)
│   └── config/                       # Configs partagées
│       ├── eslint/
│       └── typescript/
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
├── .env.example
├── CLAUDE.md
└── SPECS.md
```

---

## Fonctionnalités (Héritées de Transcolaire)

### Core

| Module | Description |
|--------|-------------|
| **Établissements** | Écoles, collèges, lycées avec horaires par jour |
| **Usagers** | Élèves avec jusqu'à 4 adresses différentes |
| **Circuits** | Définition des parcours réguliers |
| **Trajets** | Instances concrètes (date, heure, chauffeur, véhicule) |
| **Points d'arrêt** | Étapes géolocalisées avec horaires |
| **Avenants** | Modifications temporaires d'un circuit |

### Ressources

| Module | Description |
|--------|-------------|
| **Chauffeurs** | Personnel, contrats, compétences, congés |
| **Véhicules** | Flotte, maintenance, assurances |
| **Clients/Transporteurs** | Gestion multi-clients |

### Opérationnel

| Module | Description |
|--------|-------------|
| **Planning** | Vue calendrier, affectations |
| **Cartographie** | Visualisation trajets, calcul itinéraires |
| **Facturation** | Devis → Factures → Avoirs |
| **Imports/Exports** | Excel, PDF |

### Système

| Module | Description |
|--------|-------------|
| **Multi-tenant** | Isolation par RLS |
| **Auth** | Login, SSO, LDAP possible |
| **Rôles** | Permissions par fonctionnalité |

---

## Phases de Développement

### Phase 1 — Fondations
- [ ] Setup monorepo Turborepo + pnpm
- [ ] Next.js 15 avec App Router
- [ ] Tailwind v4 + shadcn/ui (thème Teal)
- [ ] Auth.js (login/signup)
- [ ] Drizzle + PostgreSQL + RLS
- [ ] Layouts auth + dashboard (inspirés de Subsy)

### Phase 2 — Établissements & Usagers
- [ ] CRUD Établissements
- [ ] CRUD Usagers
- [ ] Lien usagers ↔ établissements
- [ ] Geocoding adresses (adresse.data.gouv.fr)
- [ ] Carte basique (afficher établissements)

### Phase 3 — Circuits & Trajets
- [ ] Définition circuits
- [ ] Points d'arrêt (CRUD + carte)
- [ ] Calcul itinéraires (OpenRouteService)
- [ ] Trajets (instances)
- [ ] Système d'avenants (simplifié)

### Phase 4 — Planning & Ressources
- [ ] Vue calendrier (FullCalendar)
- [ ] CRUD Chauffeurs
- [ ] CRUD Véhicules
- [ ] Affectation sur trajets

### Phase 5 — Facturation & Exports
- [ ] Génération factures
- [ ] Export PDF
- [ ] Export Excel
- [ ] Intégrations ERP (optionnel)

---

## Comparaison Transcolaire → Scomap

| Aspect | Transcolaire | Scomap |
|--------|--------------|--------|
| Langage | PHP legacy | TypeScript |
| Framework | Custom (_v51) | Next.js 15 |
| ORM | ADOdb | Drizzle |
| DB | MariaDB | PostgreSQL + PostGIS |
| Multi-tenant | Préfixes tables | Row Level Security |
| Frontend | jQuery + Bootstrap 3 | React 19 + Tailwind |
| Composants | Custom | shadcn/ui |
| Carte | Leaflet + Google | MapLibre + OpenFreeMap |
| Tests | Aucun | Vitest + Playwright |
| Types | Aucun | TypeScript strict |
| Lignes de code | 210K | Objectif < 50K |

---

## Ressources

- **Projet de référence UI** : `/Users/lou/Documents/ProjetDev/subsy`
- **Projet legacy** : `/Users/lou/Documents/Transcolaire`
- **API Adresse** : https://adresse.data.gouv.fr/api-doc/adresse
- **OpenFreeMap** : https://openfreemap.org
- **MapLibre** : https://maplibre.org
- **OpenRouteService** : https://openrouteservice.org
