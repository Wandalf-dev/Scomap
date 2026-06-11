# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⛔ RÈGLE CRITIQUE — PAS DE PLAN SAUF DEMANDE EXPLICITE

**NE JAMAIS entrer en mode plan (EnterPlanMode) sauf si l'utilisateur le demande explicitement.**
- Quand on te demande de faire un truc → tu le fais directement.
- Pas de plan, pas de "voici mon approche", pas de "je vais d'abord analyser".
- Le seul moment où tu fais un plan c'est quand on te dit `/epct`, `/ultra-think`, ou "fais-moi un plan".
- En cas de doute sur l'implémentation → pose une question rapide, ne fais pas un plan.

## Project Overview

Scomap is a French B2B SaaS for school transport management (transport scolaire). It manages students, schools, routes, trips, drivers, vehicles and (later) billing for transport operators and local authorities. **The entire UI and domain vocabulary is in French** — keep it that way.

## Tech Stack

- **Monorepo**: Turborepo + pnpm (Node ≥ 20)
- **Next.js 15** (App Router, Turbopack, `src/` dir) + **React 19** (Server Components by default)
- **TypeScript** strict, no `any`
- **Tailwind CSS v4** + **shadcn/ui** (`new-york`, components under `components/ui/`)
- **Drizzle ORM** + **PostgreSQL** (plain Postgres, **NO PostGIS**)
- **tRPC v11** + **TanStack Query v5** (via `@trpc/tanstack-react-query`)
- **Auth.js v5** (next-auth beta) — Credentials provider
- **Zod v4** + **react-hook-form**
- **MapLibre GL JS** for maps; **OSRM** for routing; **adresse.data.gouv.fr** for geocoding
- **superjson** transformer; **framer-motion/motion**, **lucide-react**, **sonner**, **exceljs** (xlsx export), **dnd-kit** (sortable)

## Commands

```bash
pnpm dev                       # Dev server (Turbopack) — turbo run dev
pnpm build                     # Production build
pnpm lint                      # ESLint (next lint) — the primary check
pnpm db:generate               # Drizzle: generate migration from schema diff
pnpm db:migrate                # Apply migrations (needs DATABASE_URL)
pnpm db:studio                 # Drizzle Studio

# Type-check (no dedicated script — run tsc directly per package):
pnpm --filter web exec tsc --noEmit
pnpm --filter @scomap/db exec tsc --noEmit   # NB: pre-existing `process`/@types/node errors in seed.ts are unrelated noise
```

There is **no test runner** configured (no Jest/Vitest/Playwright). After changes, validate with `pnpm --filter web lint` and `pnpm --filter web exec tsc --noEmit`.

**Always ask before**: `git commit`/`push`/`reset`, starting servers (`pnpm dev`), installing deps, running `db:migrate`. Never use Chrome DevTools MCP (browser) without explicit permission.

## Local dev

- DB: `postgresql://lou@localhost:5432/scomap` (Postgres.app, user `lou` = superuser, no password)
- Multi-tenant by subdomain: add `demo.localhost` to `/etc/hosts`, then use `http://demo.localhost:3000` (tenant slug `demo`)

## Architecture

### Monorepo layout

```
apps/web/                      # Next.js app (everything UI + API lives here)
packages/db/                   # Drizzle schema + migrations + seed (@scomap/db)
```

`@scomap/db` exports `db` (`.`) and all tables (`./schema`). Migrations live in `packages/db/src/migrations/`.

### Multi-tenant flow (READ THIS FIRST)

Tenancy is resolved by **subdomain**, and isolation is enforced at the **application layer** — not by Postgres RLS:

1. `middleware.ts` extracts the subdomain from the Host header → sets `x-tenant-slug` request header. It also does a lightweight session-cookie redirect guard for protected routes.
2. `lib/tenant.ts#getTenantSlug()` reads that header in server code.
3. Auth (`lib/auth/`) resolves the tenant by slug at login and puts `tenantId` on the session (`session.user.tenantId`).
4. `lib/trpc/context.ts` exposes `{ db, session, tenantId }`.
5. `lib/trpc/init.ts` defines procedures: `baseProcedure`, `protectedProcedure` (authed), and **`tenantProcedure`** (authed + has tenant). **Use `tenantProcedure` for all tenant data.**
6. **Every query/mutation must filter by `eq(table.tenantId, ctx.tenantId)` explicitly.** This is the real isolation mechanism.

⚠️ RLS policies exist only in migration `0003` for a couple of early tables and key off `current_setting('app.tenant_id')`, which the app **never sets** (and the local superuser bypasses RLS anyway). **Do not rely on RLS** — always add the explicit `tenantId` filter.

### tRPC

- Routers in `apps/web/src/lib/trpc/routers/`, composed in `root.ts` (`appRouter`). Large routers are **folders** (`trajets/`, `usager-circuits/`, `avenants/`): procedure groups in sibling files (`satisfies TRPCRouterRecord`), assembled in `index.ts` — import specifiers unchanged. Follow this pattern when a router grows past ~400 lines.
- Server caller: `lib/trpc/server.ts`; client/provider: `lib/trpc/client.tsx`; `query-client.ts`.
- Client usage: `const trpc = useTRPC()` then `useQuery(trpc.x.y.queryOptions(...))` / `useMutation(trpc.x.y.mutationOptions(...))`; invalidate via `queryClient.invalidateQueries({ queryKey: trpc.x.y.queryKey(...) })`.
- Server Components read `searchParams` (a Promise) directly to pass initial values (e.g. `?tab=`, `?back=`) — avoids `useSearchParams` hydration issues.
- Heavier domain logic lives in `lib/trpc/services/` (e.g. `trajet-sync/`, `circuit-suggestions.ts`, `routing/`).

### Database conventions

- Tables `snake_case` plural; columns `snake_case`; PK `id` UUID; FKs `{singular}_id`; `created_at`/`updated_at` everywhere; **soft delete** via `deleted_at` (filter `isNull(table.deletedAt)` in reads).
- **Geo = plain columns** `latitude`/`longitude` (`doublePrecision`). No PostGIS, no `geometry` type.
- **Per-tenant human-readable IDs (`display_id`)**: usagers, trajets, circuits and avenants each have a sequential per-tenant `displayId` (shown as "N°"), distinct from the UUID. Allocate via `lib/db/display-id.ts#nextDisplayId(db, tenantId, entity)`, backed by the `tenant_counters` table. When adding `display_id` to a new entity, follow migrations `0020`/`0027`/`0030`: add nullable → backfill with `ROW_NUMBER()` → seed `tenant_counters` → set NOT NULL + unique index `(tenant_id, display_id)`.
- **Migrations are hand-written** (numbered `.sql`) since `0014`, and must be **manually registered** in `migrations/meta/_journal.json` (incrementing `idx` + a monotonic `when`). `pnpm db:generate` (diff-based) is generally not used for these.

### Domain model essentials

- **`usager_circuits`** is **date-versioned** (`valid_from`/`valid_to`): the open version is `valid_to IS NULL AND deleted_at IS NULL`. One active circuit per `(usager, address)` is enforced (UI + server guard + partial unique index, migration `0026`).
- **Avenants** (amendments) = header (circuit + effective date + reason) + N `avenant_changes` (one per usager × change type), numbered per circuit. Creating an avenant **auto-merges** into an existing non-cancelled one with the same `(circuitId, effectiveDate)`. Resolution is by date at read time (no triggers). A usager with avenants on a circuit **cannot be dissociated** (server guard) — cancel/delete the avenants first.
- **Trajets are largely derived, not free-form.** `lib/trpc/services/trajet-sync/` creates/groups one trajet per `(direction, set-of-days)` from the usagers' PEC (prise en charge) days. The trajet `name` and `recurrence.daysOfWeek` are **derived** from usagers — these fields are read-only in the trajet form (change via avenant). The establishment's opening/closing hours feed the trajet's `departureTime` anchor (morning→aller, evening→retour), and the establishment stop is created pre-filled + `timeLocked` so `calculateTimes` uses it as the anchor.
- **Cascade invalidation**: changing an establishment's address (lat/lng) or schedules resets the affected trajets' computed route/times so their état no longer reads "OK" (see `routers/etablissements.ts`).
- **Trajet état** is explicit (`shared/trajet-etat-badge.tsx`): "OK" only when both distance AND horaires are computed; otherwise it spells out what's missing. Billing is deferred and depends on trajets being "OK".
- **Day model** (`lib/types/day-entry.ts`): each PEC day is `{ day: 1-7, parity: "all"|"even"|"odd" }`. Labels are 2-letter codes `LU MA ME JE VE SA DI`; parity is appended (`LUP`=lundi paire, `LUI`=impaire). Use the `DAY_LABELS` / `formatDaysShort` helpers — they drive both badges and derived trajet names.

### Frontend patterns

- **Detail pages** use `components/shared/entity-detail-layout.tsx` (`EntityDetailLayout`): sticky header with back button, delete dialog, plus a **header-actions portal** + **unsaved-changes context**. Tab forms inject their Save buttons into the header via `useHeaderActions()` + `createPortal`, register dirty state via `useUnsavedChanges()`, and submit through `<form id=...>` + `<Button form={id} type="submit">`. Save buttons go in the header (top), not at the bottom. Reference: `usagers/tab-identite.tsx`.
- **List pages** use the generic `components/shared/data-list/` (`DataList`): columns, per-column filters (`type: "text" | "select"`, keyed to the column `key`), bulk delete, column picker, pagination, xlsx export, clickable rows.
- **Forms**: Zod schema in `lib/validators/` + react-hook-form + `zodResolver`. Always handle loading / error / empty states.
- **Maps**: `components/trajets/trajet-map.tsx` (numbered markers for ordered stops); `components/shared/point-map.tsx` (single pin to verify one address); `components/shared/address-map-dialog.tsx` (reusable "Voir sur la carte" button). Tile style comes from `trpc.basemap.getStyle` (per-tenant provider; keys encrypted via `lib/crypto/`).
- Server Components by default; `'use client'` as low as possible. Named exports (pages excepted). shadcn `ui/` components are extended by composition, **never edited directly**.
- **Big feature components are split into feature subfolders**: the entry file stays a thin orchestrator at its original path, sub-components/hooks/helpers live next to it (e.g. `usagers/associer-circuit/`, `usagers/adresses/`, `usagers/list/`, `trajets/arrets/`). Follow this pattern when a component grows past ~400 lines.

### Known workaround

- **React is pinned to `19.1.8`** via root `pnpm.overrides` to dodge a Next 15.5 + React 19.2 `useId` hydration bug. Remove once fixed upstream.

## Design System

- **Theme**: oklch color space, **indigo** primary (`--primary: oklch(0.578 0.235 278.291)` light / `oklch(0.495 0.171 268.388)` dark), white-ish cards, light gray background. CSS vars are defined directly in `globals.css` for `:root` and `.dark` (no `html.dark` overrides).
- `--radius: 0.5rem`. Note: many table/recap components hardcode `rounded-[0.3rem]` — match the surrounding component rather than assuming one value.
- Font **Inter**; `cursor-pointer` on all clickable buttons/links.
- **Tokens only** for colors (light + dark). Tolerated hardcoded accents, always with explicit `dark:` variants: indigo, emerald, amber, sky. In Tailwind v4 a bare `border-l` defaults to currentColor — always pair borders with `border-border` (or `dark:border-foreground/30` for stronger contrast on dark muted backgrounds).

## Code Conventions

- **Import order**: React → Next.js → external libs → internal (`@/`) → types last.
- Components `PascalCase.tsx`; utils/hooks `kebab-case.ts`; DB `snake_case`; interface for all props.
- **Comments**: add them **occasionally, not everywhere** — only where the code isn't self-evident (the *why*: business rules, non-obvious tradeoffs, gotchas, workarounds). Skip them on trivial/obvious code. Write comments in **English** (universal across the codebase); keep French domain vocabulary as-is inside them (usager, trajet, avenant, PEC…). UI strings stay French.
- Commits: Conventional Commits, **no co-author attribution**. Commit body in **English** even though the app/conversation is French.

## Domain Glossary (French → English)

| Term | Meaning |
|------|---------|
| Établissement | School |
| Usager | Student / transported person |
| Circuit | Route (defined path with stops) |
| Trajet | Trip — a directional instance of a circuit (aller/retour) |
| Arrêt | Stop (pick-up / drop-off) |
| Avenant | Amendment to a circuit/assignment (date-versioned change) |
| PEC (prise en charge) | Pick-up (the days/times a usager is transported) |
| Chauffeur / Véhicule | Driver / Vehicle |
| Transporteur | Carrier company |
| AO | Autorité Organisatrice (organizing authority) |

## Reference Projects

- **Legacy system (domain knowledge)**: `/Users/lou/Documents/Transcolaire` — its table layouts and circuit "fiche" recap mirror this app's expectations.
- **UI/Design inspiration**: `/Users/lou/Documents/ProjetDev/subsy`
