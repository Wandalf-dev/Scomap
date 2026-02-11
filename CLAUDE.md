# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scomap is a French B2B SaaS for school transport management. It manages students, schools, routes, schedules, drivers, vehicles, and billing for transport operators and local authorities.

## Tech Stack

- **Monorepo**: Turborepo + pnpm
- **Next.js 15** (App Router, Turbopack, `src/` directory)
- **React 19** (Server Components by default)
- **TypeScript** (strict mode, no `any`)
- **Tailwind CSS v4** + **shadcn/ui** (style: `new-york`)
- **Drizzle ORM** (PostgreSQL + PostGIS)
- **Auth.js** (authentication)
- **tRPC** (type-safe API)
- **TanStack Query v5** (data fetching)
- **Zod** + **react-hook-form** (validation)
- **MapLibre GL JS** + **OpenFreeMap** (maps)
- **next-themes** (theme persistence)

## Commands

```bash
pnpm dev              # Start dev server (Turbopack)
pnpm build            # Production build
pnpm lint             # ESLint
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Drizzle Studio
```

## Architecture

### Monorepo Structure

```
scomap/
├── apps/
│   └── web/                    # Next.js app
├── packages/
│   ├── db/                     # Drizzle schema + migrations
│   ├── ui/                     # Shared components (optional)
│   └── config/                 # Shared configs
├── turbo.json
└── pnpm-workspace.yaml
```

### App Structure (apps/web/src/)

```
src/
├── app/
│   ├── (auth)/                 # Auth pages (no sidebar)
│   │   ├── layout.tsx          # 2-column layout
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/            # App pages (with sidebar)
│   │   ├── layout.tsx          # Sidebar + Header
│   │   ├── dashboard/
│   │   ├── etablissements/
│   │   ├── usagers/
│   │   ├── circuits/
│   │   ├── trajets/
│   │   ├── planning/
│   │   ├── vehicules/
│   │   ├── chauffeurs/
│   │   └── facturation/
│   └── api/                    # tRPC routes
├── components/
│   ├── ui/                     # shadcn (DO NOT MODIFY)
│   ├── layout/                 # AppSidebar, SiteHeader
│   ├── maps/                   # MapLibre components
│   └── forms/                  # Business forms
├── lib/
│   ├── auth/                   # Auth.js config
│   ├── trpc/                   # tRPC client/server
│   └── utils/                  # Helpers (cn, etc.)
├── hooks/
├── types/
└── providers/
```

## Design System

### Theme (CRITICAL)

| Property | Value |
|----------|-------|
| **Theme** | Solar Dusk (warm amber/orange tones) |
| **Border Radius** | `0.3rem` (all components: buttons, cards, inputs, etc.) |
| **Primary Color** | `#B45309` (Amber) light / `#F97316` (Orange) dark |
| **Background** | `#FDFBF7` light / `#1C1917` dark |
| **Font** | Inter |
| **shadcn style** | `new-york` |

### CSS Variables (globals.css)

```css
:root {
  --radius: 0.3rem;
  --background: #FDFBF7;
  --foreground: #4A3B33;
  --primary: #B45309;
  --primary-foreground: #FFFFFF;
  --card: #F8F4EE;
  --card-foreground: #4A3B33;
  --secondary: #E4C090;
  --secondary-foreground: #57534E;
  --muted: #F1E9DA;
  --muted-foreground: #78716C;
  --accent: #f2daba;
  --accent-foreground: #57534E;
  --border: #E4D9BC;
  --input: #E4D9BC;
  --ring: #B45309;
  --destructive: #991B1B;
  --destructive-foreground: #FFFFFF;
}

.dark {
  --background: #1C1917;
  --foreground: #F5F5F4;
  --primary: #F97316;
  --card: #292524;
  --secondary: #57534E;
  --muted: #292524;
  --muted-foreground: #A8A29E;
  --accent: #1e4252;
  --border: #44403C;
  --input: #44403C;
  --ring: #F97316;
}
```

### Radius Usage

ALL interactive and container elements must use `0.3rem` radius:
- Buttons: `rounded-[0.3rem]` or use CSS var `rounded-lg` mapped to `--radius`
- Cards: same radius
- Inputs: same radius
- Modals/Dialogs: same radius
- Dropdowns: same radius
- Badges: same radius

## Database

### Multi-tenant Strategy (RLS)

Every table with user data MUST have:
1. A `tenant_id` column (UUID, NOT NULL)
2. RLS policies enabled
3. Policies that filter by `auth.jwt() ->> 'tenant_id'`

```sql
-- Example RLS policy
ALTER TABLE etablissements ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON etablissements
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

### Schema Conventions

- Tables: `snake_case` plural (e.g., `etablissements`, `usagers`)
- Columns: `snake_case` (e.g., `created_at`, `tenant_id`)
- Primary keys: `id` (UUID)
- Foreign keys: `{table_singular}_id` (e.g., `etablissement_id`)
- Timestamps: `created_at`, `updated_at` on all tables
- Soft delete: `deleted_at` (nullable timestamp)
- Geolocation: Use PostGIS `geometry(Point, 4326)` type

### Core Tables

| Table | Description |
|-------|-------------|
| `tenants` | Organizations (departments, transport companies) |
| `users` | Users with tenant association |
| `etablissements` | Schools (name, address, coordinates, schedules) |
| `usagers` | Students (up to 4 addresses) |
| `circuits` | Route definitions |
| `trajets` | Route instances (date, time, driver, vehicle) |
| `arrets` | Stop points (coordinates, times) |
| `chauffeurs` | Drivers |
| `vehicules` | Vehicles |
| `factures` | Invoices |

## Code Conventions

### Import Order

1. React
2. Next.js
3. External libraries
4. Internal (`@/` imports)
5. Types (always last)

### Naming

- Components: `PascalCase.tsx`
- Utils/Hooks: `kebab-case.ts`
- DB tables/columns: `snake_case`
- API routes: kebab-case

### Components

- Server Components by default (no directive)
- `'use client'` only when needed, as low as possible in the tree
- Named exports (no default except pages)
- Interface for all props
- shadcn components in `ui/` — extend via composition, NEVER modify directly

### Forms

Always use Zod + react-hook-form:

```typescript
const schema = z.object({
  nom: z.string().min(1, "Nom requis"),
  adresse: z.string().min(1, "Adresse requise"),
})

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: { nom: "", adresse: "" }
})
```

### Loading States

Always handle all 3 states:

```typescript
if (isLoading) return <Skeleton />
if (error) return <ErrorMessage error={error} />
return <Component data={data} />
```

### Maps

Use MapLibre GL JS with OpenFreeMap tiles:

```typescript
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [2.3522, 48.8566], // Paris
  zoom: 12
})
```

### Geocoding

Use adresse.data.gouv.fr (French government API, free, unlimited):

```typescript
const geocode = async (address: string) => {
  const res = await fetch(
    `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}`
  )
  const data = await res.json()
  if (data.features.length > 0) {
    const [lng, lat] = data.features[0].geometry.coordinates
    return { lat, lng }
  }
  return null
}
```

## Security Rules

- Auth: Double check (middleware + layout)
- RLS on ALL tenant tables (no exceptions)
- Validate all inputs with Zod
- Never expose tenant_id in URLs (use session)
- Soft delete for audit trail

## Reference Projects

- **UI/Design inspiration**: `/Users/lou/Documents/ProjetDev/subsy`
- **Legacy system (domain knowledge)**: `/Users/lou/Documents/Transcolaire`

## Domain Glossary (French)

| Term | English | Description |
|------|---------|-------------|
| Établissement | School | Educational institution |
| Usager | Student/User | Person being transported |
| Circuit | Route | Defined path with stops |
| Trajet | Trip | Instance of a circuit (specific date/time) |
| Arrêt | Stop | Pick-up/drop-off point |
| Avenant | Amendment | Temporary modification to a circuit |
| Chauffeur | Driver | Vehicle operator |
| Véhicule | Vehicle | Bus, minibus, etc. |
| Transporteur | Carrier | Transport company |
| AO | Authority | Autorité Organisatrice (organizing authority) |
