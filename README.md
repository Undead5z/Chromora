# Chromora

**SIH26231 — Digital Companion for Field Drug Testing**

Chromora is a local-development prototype for documenting colourimetric field drug-test workflows. Field officers can capture a test image with a reference colour card, record consented GPS metadata, and create an auditable digital test record for review in a web command centre.

Chromora does not identify or confirm controlled substances independently and does not replace laboratory confirmatory testing.

## Problem

Field-test records need a consistent way to preserve the original image, operator, time, location state, and integrity information. Paper or unstructured image sharing makes later review and tamper checks difficult.

## What the prototype does

- Authenticated mobile and web sessions.
- Mobile evidence capture from camera or gallery.
- Optional, officer-initiated foreground GPS capture; coordinates are never fabricated.
- Private local evidence storage.
- Basic image-dimension quality check.
- SHA-256 fingerprinting and local-development ECDSA P-256 record signing.
- Fresh hash/signature verification in the Web Command Centre.
- Field-test history, audit activity, operator list, demo-only test profiles, and local analytics.

The current result state remains `ANALYSIS_PENDING`. The prototype does not generate a drug classification.

## Architecture

```text
mobile/  React Native + Expo field companion
web/     React + Vite command centre and presentation route
backend/ Node.js + Express API, SQLite data, private uploads
```

The mobile client sends authenticated records and evidence to the local Express API. The backend stores runtime data in `backend/data/chromora.db`, stores evidence under `backend/uploads`, hashes/signs original evidence records, and exposes authenticated APIs to the web client.

## Technology stack

- React Native + Expo
- React + Vite
- Node.js + Express
- SQLite / better-sqlite3
- Sharp
- JWT and bcrypt authentication
- Node.js cryptographic integrity components (SHA-256 and ECDSA P-256)

## Current prototype status

Implemented prototype capabilities are capture, optional GPS collection, local private evidence storage, basic quality assessment, image hashing, local-development record signing, and integrity verification.

Reference-card detection, colour calibration, reaction-region extraction, and profile-specific presumptive classification are not implemented. The included `GENERAL_COLORIMETRIC_DEMO` profile is a workflow placeholder, not a validated test profile.

## Local setup

### Prerequisites

- Node.js 20 or newer recommended
- Expo Go or an Android emulator for mobile testing

### Backend

```powershell
cd backend
npm install
npm run dev
```

Backend health: `http://localhost:4000/api/health`

The API listens on all local LAN interfaces in development and prints its detected LAN URLs at startup. The first start creates ignored local runtime data, including the SQLite database, local development signing keys, upload directories, a development admin account, and the demo-only profile.

### Web

```powershell
cd web
npm install
npm run dev
```

- Welcome / product presentation: `http://localhost:5173/` (also `/welcome`)
- Web Admin login: `http://localhost:5173/login`
- Command Centre dashboard: `http://localhost:5173/dashboard` after login

### Mobile

In normal Expo LAN development, Chromora derives the current computer address from Expo's runtime host information, so a physical phone does not normally need a manually edited IP. Start Expo in LAN mode:

```powershell
cd mobile
npm install
npx expo start --clear --lan
```

The helper remains available as an explicit override when needed:

```powershell
./scripts/update-mobile-api-url.ps1
```

It selects an active Wi-Fi/Ethernet IPv4 address and writes `mobile/.env`. Do not commit that file; restart Expo after changing it. Because an `EXPO_PUBLIC_API_URL` override takes precedence, remove or update a stale `mobile/.env` to return to automatic Expo host detection. A physical phone must never use a silent `localhost` fallback.

## Local Development Accounts

These accounts are seeded for **LOCAL PROTOTYPE DEVELOPMENT ONLY**. They are not production credentials.

### Web Command Centre

- **Role:** Admin
- **Email:** `admin@chromora.local`
- **Password:** `Admin@123!`
- **Access:** `http://localhost:5173/login`

### Mobile Field Companion

- **Role:** Field Officer
- **Email:** `officer1@chromora.local`
- **Password:** `Officer@123!`

An optional second seeded Field Officer is also available:

- **Email:** `officer2@chromora.local`
- **Password:** `Officer@123!`

Web Admin credentials are intended for the Web Command Centre. Field Officer credentials are intended for the Expo Mobile application. Do not expose these credentials in screenshots or production deployments.

## Preferred local startup and LAN verification

Use three terminals:

```powershell
# Terminal 1
cd backend
npm run dev

# Terminal 2
cd web
npm run dev

# Terminal 3
cd mobile
npx expo start --clear --lan
```

Verify the backend from the PC at `http://localhost:4000/api/health`, then use the LAN URL printed by the backend to open `http://<CURRENT-PC-IP>:4000/api/health` in the phone browser. If the PC check succeeds but the phone check fails, the remaining issue is LAN, router, or firewall configuration rather than React Native. Do not change the firewall automatically; confirm that Windows Firewall permits Node.js on private networks (for example, inspect matching inbound filters with `Get-NetFirewallRule -Enabled True -Direction Inbound | Get-NetFirewallApplicationFilter | Where-Object { $_.Program -like '*\\node.exe' }`).

Web logout returns to `/login` so the administrator can sign in again, while `/` and `/welcome` remain publicly viewable for signed-in and signed-out users.

## Optional synthetic demo data

The repository does not ship real test records or evidence. For PPT/YouTube demonstration only, generate explicitly labelled synthetic records and synthetic colour-card images:

```powershell
cd backend
npm run seed-demo
```

Seeded records have `data_origin = DEMO_SEED`, `analysis_source = DEMO_SEED`, and visible **DEMO DATA** provenance. Their Positive/Negative/Inconclusive states are manually seeded UI states, not classifier outputs and not genuine NCB records. One record is deliberately modified after signing so Verify Evidence detects a real hash mismatch.

Remove only synthetic demo records and evidence with:

```powershell
cd backend
npm run reset-demo
```

## Project structure

```text
backend/
  src/        Express API, auth, integrity service, schema
  test/       Integrity test
  data/       Ignored SQLite runtime data and local signing keys
  uploads/    Ignored private evidence and reports
web/
  src/        React routes, dashboard, landing page, styles
mobile/
  App.js      Expo field workflow
  apiConfig.js Runtime LAN API resolution and health check
scripts/
  update-mobile-api-url.ps1
```

## Planned colour-calibration and classification pipeline

The intended future pipeline is:

1. Validate image quality.
2. Detect the reference colour card.
3. Correct lighting and camera colour variation.
4. Identify the reaction region.
5. Apply a validated, kit-specific test profile.
6. Produce only a presumptive Positive, Negative, or Inconclusive result.
7. Keep the original image, GPS/time/operator metadata, SHA-256 fingerprint, and digital record signature available for review.

Any future classification module requires validated reference-card data, test-kit-specific rules, evaluation data, and appropriate forensic/departmental review before operational use.

## Repository hygiene

Runtime databases, signing keys, evidence, generated reports, Expo caches, build output, and real `.env` files are ignored. Environment templates are committed in `backend/.env.example`, `web/.env.example`, and `mobile/.env.example`.
