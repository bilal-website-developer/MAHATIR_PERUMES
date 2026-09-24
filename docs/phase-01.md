# Phase 1 Documentation: Authentication, Roles, Permissions and Audit

## 1. Overview
Phase 1 establishes enterprise-grade access control, role-based permission enforcement, and immutable audit logging before any inventory or recipe data is created.

## 2. Database Schema & RLS
- **Migration**: `20260101000002_auth_roles_and_profiles.sql`
- **Role Enum**: `user_role` (`admin`, `production_manager`, `sales_staff`, `inventory_manager`).
- **Profiles Table**: `id` (UUID), `email`, `full_name`, `role`, `branch_id`, `is_active`, `created_at`, `updated_at`, `deleted_at`.
- **Database Functions**:
  - `auth_role()`: `SECURITY DEFINER` function returning the caller's operational role from `profiles` based on JWT `sub`.
  - `has_role(required_role)`: Security helper checking if caller matches the role or is `admin`.
- **Row Level Security (RLS)**:
  - `profiles`: All active profiles readable by authenticated users; only `admin` can create, update, or alter roles; users can update their own personal info.
  - `audit_log`: Strictly restricted to `admin` role for read operations; append-only via triggers.

## 3. Permission Matrix
Implemented in `apps/api/src/config/permissions.ts` and `apps/web/src/context/AuthContext.tsx`:
- **Admin**: Full access across all modules, user administration, purchase approvals, audit log viewer.
- **Production Manager**: Formulas (BOM), batches, bulk liquid inventory, bottling runs, dilution calculator.
- **Inventory Manager**: Raw materials, suppliers, purchase order creation, packaging, stock adjustments. (PO approvals restricted to Admin).
- **Sales Staff**: Retail POS counter sales, receipt printing, decants, customers. (Zero access to formula secrets or raw material costs).

## 4. API Endpoints
- `POST /api/v1/auth/login`: Authenticates credentials (or demo profile) and returns JWT bearer token and permissions map.
- `GET /api/v1/auth/me`: Returns current user identity, role, and authorized resources.
- `GET /api/v1/users`: List profiles (Admin only; other roles receive 403 Forbidden).
- `POST /api/v1/users`: Create staff account (Admin only).
- `PATCH /api/v1/users/:id`: Modify staff role or active status (Admin only).
- `GET /api/v1/audit-log`: Filterable audit ledger by table, action, and timestamp (Admin only).

## 5. User Interface Screens
- **Sign In Portal** (`/login`): Luxury dark/gold branded login with 1-click demo role switcher for immediate operational testing.
- **User Management** (`/users`): Reusable `DataTable` with role dropdown switcher, active/suspended toggle, and staff creation modal.
- **Audit Trail** (`/audit`): Filterable log with side-by-side JSON diff modal comparing `old_data` vs `new_data`.
- **Access Denied** (`/access-denied`): Elegant 403 restricted page explaining permission boundary.
- **Dynamic Role Navigation**: Sidebar navigation automatically filters and displays only authorized modules for the active role. TopBar includes live role switcher.

## 6. Verification and Acceptance Criteria
- 10 automated unit & permission tests passing in Vitest (`npm run test`).
- Direct API calls to admin endpoints without proper role return HTTP 403 Forbidden.
- Production build compiles with zero TypeScript errors (`npm run build`).
- No secrets committed; zero pushes to GitHub.
