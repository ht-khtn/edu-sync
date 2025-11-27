# EduSync Folder Structure Plan

## Objectives
- Align the App Router tree with clear route groups for admin vs. client, while keeping API routes colocated under `app/api`.
- Separate configuration, utilities, hooks, and domain logic so that shared code sits outside the `app/` tree and can be imported from predictable aliases.
- Reduce the cognitive load in `components/` by grouping UI building blocks, layout shells, and feature modules.
- Preserve testability by keeping scripts, seeds, and tests isolated from runtime code.

---

## Target Top-Level Layout
```
app/
components/
configs/
hooks/
lib/
public/
scripts/
supabase/
tests/
types/
utils/
```

| Directory | Purpose | Notes |
|-----------|---------|-------|
| `app/` | App Router entry point, route groups, API handlers | Server/route code only. Import shared logic from `lib`, `configs`, `utils`, `hooks`. |
| `components/` | Reusable presentational + feature components | Subdivide by domain (`admin`, `client`, `auth`, etc.) and keep pure UI primitives under `components/ui`. |
| `configs/` | Runtime configuration helpers | Already hosts `env`. Add `rbac`, `feature-flags`, `metadata` as needed. |
| `hooks/` | Client/shared hooks | Keep server hooks under `lib`. Organize by concern (auth, layout, data). |
| `lib/` | Server-only helpers (Supabase server client, RBAC, data loaders) | No browser-only code; co-locate zod schemas, query utilities. |
| `utils/` | Framework-agnostic helpers (`cn`, formatters, parsing) | All functions must be side-effect free and import-safe on both server & client. |
| `types/` | Global TypeScript declarations and shared types | Group by domain to avoid giant single file. |
| `public/` | Static assets | Continue mirroring Next.js expectations. |
| `scripts/` | Node scripts and seeds | Use for one-off maintenance utilities. |
| `supabase/` | SQL schema + Edge functions | Leave untouched except for migrations. |
| `tests/` | Vitest suites | Mirror domain naming from `components/`/`lib/`. |

---

## `app/` Structure
```
app/
├── (admin)/
│   ├── layout.tsx          # Auth + RBAC gate, sidebar shell
│   └── admin/
│       ├── page.tsx        # Dashboard
│       ├── leaderboard/
│       ├── violation-entry/
│       ├── score-entry/
│       ├── violation-history/
│       └── violation-stats/
├── (client)/
│   ├── layout.tsx          # Public shell w/ hero
│   └── client/
│       ├── page.tsx
│       └── my-violations/
├── login/
├── api/
│   ├── auth/
│   ├── record-ops/
│   ├── records/
│   └── session/
├── layout.tsx               # minimal root providers
└── page.tsx                 # redirects based on role
```

**Guidelines**
- Keep server components wherever possible; mark `"use client"` only when hooks/events required.
- API routes should import logic from `lib/` or `utils/` instead of embedding heavy logic.
- Centralize metadata (title/description) inside `configs/metadata.ts` so each route imports a named export.

---

## `components/` Structure
```
components/
├── layout/                  # Cross-route shells (headers, footers)
├── admin/                   # Admin-only building blocks
├── client/                  # Client/student components
├── auth/                    # Auth nav/forms
├── common/                  # cross-cutting widgets (notifications, toasts)
├── domain/                  # leaderboard, violations, score-entry, etc.
│   ├── leaderboard/
│   ├── violation-entry/
│   ├── violation-history/
│   ├── violation-stats/
│   ├── score/
│   └── my-violations/
├── ui/                      # Shadcn primitives (unchanged)
├── ui-extended/             # Larger composites built atop primitives
└── NavClient.tsx            # Bridge component (to be migrated into `layout/`)
```

**Action Items**
1. Move `ClientHeader`, `ClientHero`, `ClientMainContent` into `components/layout/client/` to signal layout-specific usage.
2. Relocate `AdminHeader`, `AdminSidebar`, `AdminMainContent` into `components/layout/admin/`.
3. Group feature modules under `components/domain/<feature>/` instead of scattering across root-level folders.
4. Keep MDX or markdown-driven components under `components/md/`.

---

## `configs/`
Add dedicated files to avoid sprinkling `process.env` reads across the app:

| File | Responsibility |
|------|----------------|
| `configs/env.ts` | Validate and expose Supabase + generic env vars (already created). |
| `configs/rbac.ts` | Map Supabase roles (`cc`, `admin`, `student`) to feature flags and route guards. |
| `configs/navigation.ts` | Define primary nav trees consumed by admin/client headers to prevent duplication. |
| `configs/metadata.ts` | Default SEO metadata, used by routes via `export const metadata`. |

All config modules should be tree-shakeable and pure.

---

## `lib/`
Split into clear domains and ensure server-only utilities stay here:
```
lib/
├── supabase-server.ts
├── supabase.ts             # browser client wrapper
├── server-auth.ts
├── rbac.ts
├── csv.ts
├── score.ts
├── violations.ts
└── utils.ts                # re-export aggregator only
```

Guidelines:
- `lib/utils.ts` should only re-export top-level helpers from `utils/` (already started).
- Any module that touches the filesystem, Supabase admin client, or Next.js server APIs belongs under `lib/`.

---

## `utils/`
```
utils/
├── cn.ts
├── formatters/
│   ├── currency.ts
│   └── date.ts
├── parsers/
│   └── csv.ts
├── validation/
│   └── schema-helpers.ts
└── index.ts
```

Rules:
- No direct `process.env` usage (import from `configs/env`).
- Keep each helper single-purpose; prefer named exports.
- Add tests under `tests/utils/` to guarantee behavior during refactors.

---

## `hooks/`
Organize hooks by platform:
```
hooks/
├── use-mobile.ts
├── use-auth.ts              # wraps Supabase auth client-side
├── use-toast.ts             # surfaces shadcn toasts
├── use-query-params.ts
└── index.ts
```

Server-only hooks should live under `lib/` as standard functions.

---

## `types/`
Create subfolders when the file grows:
```
types/
├── auth.d.ts
├── leaderboard.d.ts
├── violations.d.ts
├── score.d.ts
└── material-web.d.ts        # existing ambient types
```

Encourage co-location with feature code where practical, but keep global ambient declarations here.

---

## Migration Strategy
1. **Stabilize tooling** – finish ESLint/Prettier config updates (already underway).
2. **Move configs & utils** – ensure all env access goes through `configs/`, update imports.
3. **Restructure components** – follow the layout/domain breakdown above; update barrel exports if needed.
4. **Normalize hooks & types** – rename/move files, update import paths, run `tsc --noEmit` to catch regressions.
5. **Clean references** – run codemods or find/replace to point to new paths.
6. **Verify routes** – `npm run lint` and `npm run test` before and after moves.

This plan keeps business logic untouched while making the filesystem reflect the mental model of admin vs. client functionality plus shared infrastructure.
