# Phase 1 Follow-up: Editable Personal Profiles

## Delivered

- Added `avatar_url`, `display_title`, `phone`, and 200-character `bio` fields to `profiles`.
- Added the public-read `avatars` Supabase Storage bucket with 2MB JPG/PNG/WebP limits and per-user folder policies.
- Added `GET/PATCH /api/v1/me/profile`, `POST /api/v1/me/profile/avatar`, and `DELETE /api/v1/me/profile/avatar`.
- Profile PATCH uses strict Zod validation and rejects role, branch, active-state, and other unknown fields.
- A database trigger blocks non-admin direct changes to protected profile fields.
- Replaced the static header identity display with a clickable profile popover and responsive mobile sheet.
- Added initials fallback, live avatar preview, upload/remove actions, character counter, save loading state, and remove confirmation.

## Verification

- `apps/api/test/profile.test.ts`: 5 tests pass for all four demo roles, protected-field manipulation, invalid upload, upload, and removal.
- API and web production builds pass.
- Supabase audit triggers record profile updates, including avatar URL changes. Storage writes are restricted by the `avatars` bucket policies.

## Assumptions

- Demo-mode avatar uploads use a data URL because the local fallback has no storage service; live Supabase uploads use `avatars/{user_id}/avatar.{extension}` and public URLs.
- Official name, role, branch, and active state remain controlled by Staff & Roles/Admin workflows.
