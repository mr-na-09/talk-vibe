# TalkVibe

TalkVibe is a messaging platform MVP with a modern Next.js dashboard and a free PocketBase backend.

## Repository structure

- `apps/web` – Next.js + Tailwind frontend
- `apps/mobile` – Expo app shell for Android / iOS
- `packages/shared` – shared types and validation helpers
- `Pocketbase` – local PocketBase binary and data folder
- `docs` – setup and production notes

## Recommended stack for this project

- Frontend: Next.js + React + Tailwind
- Backend: PocketBase
- Auth: PocketBase auth + optional Google OAuth
- Realtime: PocketBase subscriptions
- Storage: PocketBase file upload system

## Local setup

1. Start PocketBase in one terminal:
   ```powershell
   cd Pocketbase
   .\pocketbase.exe serve --migrationsDir .\pb_migrations
   ```
   The project data directory is `Pocketbase/pb_data`; do not delete it.
2. Open the admin panel and create a PocketBase superuser if needed:
   ```text
   http://127.0.0.1:8090/_/
   ```
3. In a second terminal, install and start the web app:
   ```bash
   cd apps/web
   npm install
   npm run dev
   ```
4. Open the app:
   ```bash
   http://localhost:3000/register
   ```
5. Create a TalkVibe account using the registration page. Do not use the PocketBase admin email as an app user unless you intend to.

The app reads the local PocketBase URL from `apps/web/.env.local`. The checked-in `.env.example` contains only safe local placeholders.

## PocketBase schema

The migration at `Pocketbase/pb_migrations/1791777793_talkvibe_schema.js` creates the profiles, friend requests, friendships, conversations, messages, read receipts, notifications, device tokens, blocks, and reports collections. It also applies collection access rules and indexes.

PocketBase runs pending migrations on server startup. To run them manually:
   ```bash
   cd Pocketbase
   .\pocketbase.exe migrate up
   ```

## Current status

The project now includes:

- PocketBase email/password registration and login
- Profile creation and editing, including protected avatar uploads
- TalkVibe ID/username discovery, friend requests, and a friends list
- Friend and group conversations, message history, and realtime message updates
- Chat attachments for images, videos, and files (up to 50 MB per file); folder uploads add each file separately
- Online presence indicators and per-account local friend nicknames
- A PocketBase schema and access-rule migrations
- A dashboard linking to profile, friends, and chats

## Production notes

- Google sign-in requires your Google OAuth client credentials in PocketBase Settings > Auth Providers; it is not ready until configured.
- Configure production HTTPS, persistent disk backups, email verification, and Google OAuth callbacks.
- PocketBase's built-in admin/superuser account is separate from TalkVibe user accounts.
- Keep PocketBase running with `--migrationsDir .\pb_migrations` from the `Pocketbase` directory so new schema migrations are applied.
- Test collection rules before adding real user data; keep attachments/avatar files protected.
- For deployment, host PocketBase on a VPS or cloud service behind HTTPS.

## GitHub Pages

The web app is exported as a static site and deployed by `.github/workflows/deploy-pages.yml` when changes are pushed to `main`. Enable GitHub Pages in the repository settings with **Build and deployment > Source > GitHub Actions**. The project site URL will be `https://<owner>.github.io/talk-vibe/`.

GitHub Pages hosts only the static web frontend; it does not run PocketBase. Before the hosted app can sign in, load profiles, or exchange messages, deploy PocketBase separately over HTTPS, apply the PocketBase migrations, and add a repository Actions variable named `NEXT_PUBLIC_POCKETBASE_URL` with that backend URL. Then rerun the Pages workflow. Do not publish `pb_data`, local uploads, or `.env.local`.

## Additional resources

- `apps/web/src/lib/pocketbase.ts` – shared PocketBase client
- `apps/web/src/app/login/page.tsx` – login screen example
- `apps/web/src/app/dashboard/page.tsx` – protected dashboard starter
