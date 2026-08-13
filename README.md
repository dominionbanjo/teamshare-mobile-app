# TeamShare — Mobile App (`teamshare-mobile-app`)

The Expo (React Native) client for **TeamShare**: a workspace where individuals and
organizations create projects, track tasks/issues, share documents, manage environment
variables (secrets), and message each other with mentions and notifications.

- API: [`teamshare-backend`](https://github.com/dominionbanjo/teamshare-backend) (NestJS)
- Web client: [`teamshare-frontend`](https://github.com/dominionbanjo/teamshare-frontend) (Next.js)
- Product spec: `TeamShare_PRD.docx`, UI system: `docs/ui-style-guide.md`, API contract: `docs/api-contract.md`

---

## Features

| Area | Status |
|---|---|
| Auth (email/Google sign-in, password reset, session persistence) | ✅ |
| Onboarding + workspace switcher (Company / Individual) | ✅ |
| Company & team screens (list/detail, member management) | ✅ |
| Invitations (accept/decline from the app) | ✅ |
| Projects (list, detail with tabs, create dialog) | ✅ |
| Tasks (list, detail, status/priority, attachments, create dialog) | ✅ |
| Comments, threads & @mentions | ✅ |
| Notifications (in-app list, read/unread, deep links) | ✅ |
| Env vars (masked list, reveal, export) | ✅ |
| Documents (list, upload, open) | ✅ |
| Project chat (realtime via Socket.IO) | ✅ |
| Search, analytics, billing screens | ✅ |
| Profile / settings | ✅ |

## Tech stack

- **Expo SDK 57** · **React Native 0.86** · **React 19** · **TypeScript** (strict)
- **expo-router** (file-based routing, typed routes enabled) + React Compiler
- **NativeWind v4** (Tailwind 3.4, dark-mode class) + **react-native-reusables** primitives
- **@tanstack/react-query** (server state), **react-hook-form + zod** via `TSForm`
- **iconsax-react-native** (IconSax icons — `variant` + `color` props always required)
- **socket.io-client** (realtime chat), **@react-native-async-storage/async-storage** (session)
- Google sign-in via **expo-web-browser** OAuth flow (redirect scheme `teamsharemobileapp://login`)

## Getting started

Requirements: **Node.js 22+**, npm, the [Expo Go](https://expo.dev/go) app on your
device (or an emulator/simulator).

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `a` / `i` for emulators. The backend must be
reachable from your device — **on Windows, run `npx expo start --clear` if classes
or routes misbehave** (known Metro cache gotcha).

### Environment variables

Set in your shell or `.env.local` (all optional — defaults point at your machine):

| Variable | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:4000/api` | REST API base (envelope client) |
| `EXPO_PUBLIC_WS_URL` | `http://localhost:4000` | Socket.IO origin for realtime chat |

On a physical device, replace `localhost` with your machine's **LAN IP**
(e.g. `http://192.168.1.10:4000/api`).

## Scripts

| Command | Purpose |
|---|---|
| `npm run start` | `expo start` (dev server) |
| `npm run android` / `npm run ios` / `npm run web` | Start for a specific target |
| `npm run lint` | ESLint via `expo lint` |
| `npx tsc --noEmit` | Typecheck (part of CI) |
| `npx expo export` | Static export / build verification |
| `npx expo start --clear` | Dev server with cleared Metro cache (Windows gotcha) |

## Routes (expo-router, `src/app/`)

```
src/app/
├─ _layout.tsx                 # root Stack
├─ (auth)/                     # unauthenticated group
│  ├─ _layout.tsx
│  ├─ login.tsx, register.tsx, forgot-password.tsx
├─ (tabs)/                     # authenticated tab group
│  ├─ index.tsx                # Home / dashboard
│  ├─ projects/index.tsx, tasks/index.tsx, search.tsx, settings.tsx
├─ projects/[id].tsx           # project detail (tabs: overview/tasks/docs/env vars/chat)
├─ tasks/[id].tsx              # task detail + threads
├─ companies/index.tsx, companies/[id].tsx
├─ teams.tsx, invitations.tsx, notifications.tsx
├─ analytics.tsx, billing.tsx
```

## Project structure

```
src/
├─ app/                        # expo-router routes (above)
├─ components/
│  ├─ ui/                      # VENDOR react-native-reusables primitives — do not edit
│  ├─ shared/                  # TeamShare TS* wrappers (always import from here)
│  │  └─ ts-button, ts-card, ts-input, ts-badge, ts-dialog, ts-tabs, ts-avatar,
│  │     ts-mention-chip, ts-mention-text, ts-list, ts-select, ts-skeleton,
│  │     ts-form, ts-screen, ts-error-state
│  └─ feature/                 # app-tabs, chat-panel, documents-tab, env-vars-tab,
│     └─ project/task/invite dialogs, animated-icon
├─ lib/
│  ├─ api/                     # client.ts (envelope-aware fetch) + 19 module files
│  │  └─ auth, session, companies, projects, tasks, teams, invitations,
│  │     notifications, comments, documents, envVars, chat, search, billing,
│  │     audit, uploads, types, index
│  ├─ auth/                    # AuthProvider (AsyncStorage session), google-signin.ts
│  ├─ query/keys.ts            # React Query key factory
│  ├─ validation/schemas.ts    # zod schemas — MIRROR the backend contract
│  └─ format.ts, utils.ts
├─ constants/theme.ts          # Colors light/dark + tokens mirroring the style guide
└─ global.css                  # NativeWind entry (wired in metro.config.js)
```

## Conventions (from `AGENTS.md` — read before contributing)

- **Two component layers, never mixed:** `src/components/ui/` = vendor primitives
  (never edit); `src/components/shared/` = `TS*` wrappers. App code imports from
  `@/components/shared` only.
- **IconSax hard rule:** every icon instance passes `variant` and `color` props.
  Default `Outline`; `Bold` for active nav; `TwoTone` for empty states; `Broken`
  for destructive confirmations. Icon names are a contract — see style guide §6.4.
- **Validation:** zod end-to-end. `src/lib/validation/schemas.ts` mirrors the
  backend's generated schemas — backend is canonical (`docs/api-contract.md`).
  Never bypass `TSForm` for forms.
- **Colors/spacing/typography** come from the style-guide tokens (exposed in
  `src/constants/theme.ts`), never raw hex/pixels. No emoji as icons.
- **API envelope:** `lib/api/client.ts` enforces `{ success, data, pagination? }` /
  `{ success, error: { code, message, details? } }` and throws typed `ApiError`.
- **Realtime chat:** connects to `${EXPO_PUBLIC_WS_URL}/chat` with `{ auth: { token } }`,
  joins `project:<id>` rooms, listens for `message:new`; history via REST (`lib/api/chat.ts`).

## EAS builds

`eas.json` defines three profiles (Expo Go works for development; store builds need EAS):

| Profile | Type | Channel | Use |
|---|---|---|---|
| `development` | development client | `development` | Dev builds with native debugging |
| `preview` | internal distribution | `preview` | Test builds for the team |
| `production` | store release (auto-increment) | `production` | App Store / Play Store |

```bash
npx eas build --profile preview --platform android
```

The EAS project is not linked in-repo yet (no `extra.eas.projectId` in `app.json`).

## Known gaps

- **No push notifications** — `expo-notifications` is not configured; the
  notifications screen polls the REST API and deep-links into screens. Push is a
  planned follow-up (PRD F8 email is handled server-side by the backend).
- **Windows Metro cache bug** — run `npx expo start --clear` when styling/routing
  behaves unexpectedly.

## CI

`.github/workflows/ci.yml` runs on push to `main` and all PRs (Node 22):
`npm ci` → `npx tsc --noEmit` → `npx expo lint`.

> Heads up: the local branch is currently `master` — CI triggers on `main`.

## Related documentation

- `TeamShare_PRD.docx` — full product spec (features F1–F15, RBAC §5, QA matrix §9)
- `docs/ui-style-guide.md` — design system (tokens, components, IconSax mapping)
- `docs/api-contract.md` — API envelope, pagination, RBAC + type-mirroring rule
- `IMPLEMENTATION_TRACKER.md` — the master task list (tick off as features land)
