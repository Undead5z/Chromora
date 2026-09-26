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

The first start creates ignored local runtime data, including the SQLite database, local development signing keys, upload directories, a development admin account, and the demo-only profile.

### Web

```powershell
cd web
npm install
npm run dev
```

- Command Centre: `http://localhost:5173`
- Product presentation: `http://localhost:5173/welcome`

### Mobile

For a physical phone, first write the current PC LAN API URL:

```powershell
./scripts/update-mobile-api-url.ps1
cd mobile
npm install
npx expo start --lan --clear
```

The helper writes `mobile/.env` using the active Windows LAN IPv4. A physical phone must not use `localhost`.

Development sign-in:

```text
Web Admin: admin@chromora.local / Chromora123!
Mobile Officer: officer1@chromora.local / Officer123!
Mobile Officer: officer2@chromora.local / Officer123!
```

These are local demo identities only and must be changed or removed before any non-local use.

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
