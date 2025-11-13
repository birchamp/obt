# Open Bible Text Project Structure Guide

## Overview
- Open Bible Text (OBT) is a React 17 Progressive Web App that assembles translation helps from Door43 and related `@texttree` packages into a configurable study workspace.
- The project originated from Create React App but is customized through CRACO, Material‑UI, Workbox, and various TextTree reusable component libraries.
- Most persistent state is stored in `localStorage` so that the experience, selected resources, and layouts survive refreshes and can be shared.

## Build System and Tooling
- `create-react-app` conventions with overrides in `craco.config.js` for vendor chunking.
- `package.json` scripts: `yarn start`, `yarn build`, `yarn test`, `yarn analyze` (source-map-explorer).
- Crowdin integration (`crowdin.yml`) drives translation updates for `src/config/locales`.
- Netlify serverless functions live in `netlify/functions`; CI/CD often targets Netlify deployments noted in `README.md`.

## Top-Level Layout
- `public/` static shell: CRA template, favicons, `manifest.json`, `_redirects` (supporting Netlify routing).
- `src/` application source (React). Key folders broken down below.
- `netlify/` serverless functions (feedback form routing to Telegram).
- `oce.json` describes dependency metadata for Open Church Ecosystem packaging.
- `src/docs/` houses architecture and contributor docs (`CODESTYLE.md`, changelog, diagrams); add team-contributed references here.

## Runtime Entry Points
- `src/index.js`: bootstraps the app. Sequence: run local-storage migrations via `Migrate()`, initialize GA4, attach React Router routes (`/projector`, `/share`, default app), wrap in `ErrorBoundary`, and register the service worker.
- Dedicated routes:
  - `/projector` renders `@texttree/projector-mode-rcl` with `ProjectorScreen`.
  - `/share` hydrates stored layouts from URL query params.
- Service worker registration is customized in `src/serviceWorkerRegistration.js` and Workbox logic lives in `src/service-worker.js`.

## Contexts and Global State
- `src/context/ContextProviders.js` composes `ReferenceContextProvider` around `AppContextProvider`.
- `AppContext` (`src/context/AppContext.js`) manages UI state (theme, dialogs), resource catalog cache, workspace layouts, feature flags, and selection state from `@texttree/scripture-resources-rcl`. Most setters write through to `localStorage`.
- `ReferenceContext` (`src/context/ReferenceContext.js`) wraps `useBibleReference` to keep the book/chapter/verse in sync with the URL, chunk metadata, and the rest of the UI. It also exposes navigation helpers (next/prev chapter, etc.).
- Both contexts share state with external libraries: `ResourcesContextProvider` and `SelectionsContextProvider` (from `@texttree/scripture-resources-rcl`) enable downstream resource components to access catalog data.

## Configuration and Defaults
- `src/config/base.js` defines:
  - Door43 server endpoints.
  - Breakpoint grid configs for the workspace layout (`columns`, `defaultTplBible`, `defaultTplOBS`).
  - Default Bible/OBS references when switching modes.
  - Supported interface languages (`languages`) and reusable card geometry constants (`defaultCard`).
- `src/config/materials.js` stores metadata like language names, subject filters, and blacklists used by resource search and UI presentation.
- `src/config/locales/` holds translation files consumed during i18next initialization (`src/i18next.js`).

## Workspace and Card System
- `WorkSpaceWrap` (`src/WorkSpaceWrap.js`) hosts the grid via `resource-workspace-rcl::Workspace`. It:
  - Maps the current layout to card components (Bible texts, translation helps, OBS, projector settings).
  - Syncs breakpoint changes into `AppContext`.
  - Persists layout mutations into `localStorage` (per layout type) and enforces constraints when closing core cards.
  - Computes available book lists based on loaded resources and injects occurrences (selected verses) into `SelectionsContext`.
- `src/components/Card/Card.js` is the top-level resource card renderer. It inspects resource metadata (subject, owner, language) and routes to specialized card bodies (`Chapter`, `SupportTN`, `SupportTQ`, `SupportTWL`, OBS variants, etc.).
- Specialized cards rely on shared helpers (`src/helper.js`) for transforming USFM, computing verse text, or resetting layouts.

## Resource Discovery and Management
- `SearchResources` (`src/components/SearchResources/SearchResources.js`) queries Door43 (`https://git.door43.org/api/v1/catalog/search`) filtered by subjects and allowed interface languages, caches results in `AppContext.state.resourcesApp`, and offers menu-driven insertion into the workspace grid using `getXY` from `resource-workspace-rcl`.
- Resource language filters come from `SelectResourcesLanguages`, which manipulates `AppContext.state.languageResources`.
- `Share` (`src/components/Share/Share.js`) parses query params (`r`, `b`, `c`, `v`) to generate or append layouts, update references, and merge language lists. It also writes optional saved layouts into `layoutStorage`.
- `WorkspaceManager` and `Settings` provide reset and export/import options built on helpers like `resetWorkspace` (`src/helper.js`).

## Navigation, Menus, and Dialogs
- `SubMenuBar` (`src/components/SubMenuBar/SubMenuBar.js`) is the primary toolbar: toggles Bible/OBS mode, book/chapter pickers, workspace menus, feedback, projector controls, and integrates the user intro flow.
- `Intro` (`src/components/Intro/Intro.js`) orchestrates onboarding steps using `intro.js-react`, coordinating UI state via `AppContext`.
- `StartDialog`, `ContextMenu`, `FeedbackDialog`, and `TypoReport` handle modals for onboarding, right-click verse actions, feedback submission (uses Netlify function), and typo reporting.
- `Shortcut` / `Swipes` components attach global listeners (`react-hotkeys-hook`, `react-swipeable`) to support keyboard and touch gestures.

## Hooks and Utilities
- Custom hooks in `src/hooks/` supplement third-party hooks: `useChunk` retrieves chunking metadata, `useScrollToVerse` wraps smooth scrolling, `useOnScreen` drives projector scroll prompts, `useListWordsReference` and `useSelectTypeUniqueWords` support translation word utilities.
- `src/helper.js` centralizes logic for deriving resource lists, verifying and coercing `localStorage` values (`checkLSVal`), workspace reset flows, and DOM animation helpers for verse focus.

## Styling and Theming
- Material-UI theming lives in `src/themes.js` (`obt`, `textTree`, `dark` themes) and is applied through `<ThemeProvider>` in `App.js`.
- Layout styles for resource cards reside in `src/style.js`; global CSS lives in `src/styles/app.css` and `src/styles/style.css`.
- Individual components use `makeStyles` alongside theme palette entries; images and icons live alongside their components (`SubMenuBar` assets, projector styles).

## Internationalization
- i18next is initialized in `src/i18next.js` with `i18next-http-backend` and the browser language detector. Local translation resources are pre-bundled via `langArrToObject`.
- Crowdin synchronization uses `src/config/locales/en/translation.json` as the source of truth, generating language directories like `ru`, `tg`, `es-419`, etc.

## Offline and Caching
- Workbox-powered service worker (`src/service-worker.js`) precaches build assets, handles App Shell routing, and caches Door43/QA APIs and imagery.
- Registration tweaks in `src/serviceWorkerRegistration.js` support custom SW versioning (`service-worker.js?v2`) and detailed logging.

## Serverless Integrations
- `netlify/functions/sendFeedback.js` posts feedback to a Telegram bot using environment variables (`API_TELEGRAM_TOKEN`, `GROUP_TELEGRAM`).
- Frontend feedback dialog (`FeedbackDialog`) hits this endpoint via `/.netlify/functions/sendFeedback`.

## Testing and QA
- Testing setup remains CRA defaults: `src/setupTests.js` pulls in `@testing-library/jest-dom`. No additional test utilities are configured in the repo.
- `src/reportWebVitals.js` is available for optional performance logging.

## Getting Started Notes
- Application data comes from live Door43 endpoints; when developing offline you may need to mock responses or adjust the API base (`src/config/base.js`).
- Environment variables (`.env`) configure optional integrations (error reporting backend, feedback tokens).
- When modifying layout or resource behavior, ensure migrations in `src/Migrate/` keep stored state forward-compatible—add a new `migrateYYMMDD.js` file and invoke it from `Migrate.js`.
