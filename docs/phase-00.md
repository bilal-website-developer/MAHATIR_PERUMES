# Phase 0 Documentation: Foundation and Architecture

## 1. Overview
Phase 0 establishes the engineering core, database standards, and foundational layout for the Mahatir Perfumes ERP + POS monorepo.

## 2. Monorepo Architecture
- **Workspaces**:
  - `apps/web`: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router.
  - `apps/api`: Node.js, TypeScript, Express, Zod validation, `@supabase/supabase-js`, `pg`.
  - `supabase/`: Versioned SQL migrations and seed data.

## 3. Database Conventions & Migrations
The following versioned SQL migrations have been established:
1. `20260101000000_initial_conventions.sql`:
   - Extensions: `uuid-ossp`, `pgcrypto`.
   - `set_updated_at()`: Trigger function that automatically keeps `updated_at` current.
   - `audit_log`: System-wide audit table recording `table_name`, `row_id`, `action` (INSERT/UPDATE/DELETE), `old_data`, `new_data`, `user_id`, and `created_at`.
   - `audit_trigger_func()`: Generic trigger attached to all core tables for non-repudiation.
2. `20260101000001_branches_and_settings.sql`:
   - `branches`: Multi-branch foundation with default seed `Main Boutique & Lab` (`00000000-0000-0000-0000-000000000001`).
   - `app_settings`: Company configuration, base currency (`USD`), tax percentage (`5.00%`), invoice prefix (`MP-INV-`).
   - Row Level Security (RLS) enabled across all tables.

## 4. Node API Architecture
- **Environment**: Validated strictly on startup using Zod in `src/config/env.ts`.
- **Response Format**: Strict compliance with `{ data, error, meta }`.
- **Endpoints**:
  - `GET /health`: Uptime and system status.
  - `GET /health/db`: Database connectivity verification and latency report.
  - `GET /api/v1/settings`: Company settings and currency defaults.
  - `GET /api/v1/branches`: Active branch list.

## 5. Frontend Luxury Design System
- Signature Dark & Gold theme: Slate `0c0e12` with warm gold accents (`#d4af37`), Playfair Display serif headings and Inter typography.
- Reusable `DataTable`: Full client-side and server-ready search, column sorting, pagination, and CSV export.
- Diagnostic Health Page: Live verification of API and DB connections.

## 6. Verification and Acceptance Criteria
- App boots locally on `http://localhost:5173` (web) and `http://localhost:4000` (api).
- Tests pass (`vitest`).
- No secrets are committed to git; `.gitignore` strictly ignores `.env`, `*.local`, and `supabase/.env`.
