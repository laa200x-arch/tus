# Home Overview Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Add one authenticated home overview API and rebuild the iOS and Windows home screens from it, with iOS faithfully reproducing the supplied reference design and Windows using the same visual system in a desktop-native dashboard.

**Architecture:** The server derives an immutable overview payload from existing user, outfit, mood, complaint, colleague, conversation, and personality records. Each client owns one `homeOverview` state, reconciles its mood/outfit fields into the existing global state, and refreshes the aggregate after successful mutations. The existing write endpoints and `/api/home/stats` remain compatible.

**Tech Stack:** Node.js 20, Express, SQLite/MySQL database adapter, Swift 5/SwiftUI, Electron 31, browser JavaScript, CSS, Node assertion-based regression tests, GitHub Actions/Xcode Release build.

**Spec:** `docs/superpowers/specs/2026-08-27-home-overview-redesign.md`

## Global Constraints

- Use the supplied iOS screenshot as a strong visual contract: preserve section order, proportions, spacing rhythm, corner radii, shadows, type hierarchy, purple palette, and Little Energy hero placement. Do not copy the device status bar.
- Windows must retain its sidebar/top-level desktop navigation and use a wide two-column dashboard; never stretch the mobile screen or add a mobile bottom tab bar.
- Reuse the 27-mood catalog, outfit normalization, current mood store, current user store, and existing write APIs. Do not introduce a second mood/outfit source or a home aggregate table.
- The darkened Little Energy character remains exclusive to the complained-about colleague representation and never receives user clothing.
- Every loading path must settle into content, an empty state, or a retryable error state. No full-screen infinite spinner.
- Preserve unrelated local changes. Commit after each green task.

---

## Task 1: Define and test the server overview contract

**Files:**

- Create: `server/src/services/home-overview.js`
- Modify: `server/src/routes/home.js`
- Create: `server/test/home-overview.test.mjs`
- Modify: `server/test/smoke.mjs`

**Interfaces:**

```js
export function greetingPeriodAt(now) // 'morning' | 'afternoon' | 'evening'
export function buildHomeOverview(db, userId, now = new Date())
```

The returned object must always contain `serverTime`, `greetingPeriod`, normalized `user.littleEnergyOutfit`, all five `stats` fields, nullable `moodToday`, exactly five `quickMoods`, `latestComplaints`, nullable `personality`, and `colleagueSummary`.

**Steps:**

1. Add failing unit fixtures for an empty authenticated user, a user with an outfit and today's check-in, anonymous/latest complaints, unread conversations, colleagues, and personality data. Assert exact keys and stable 27-mood IDs.
2. Run `node server/test/home-overview.test.mjs`; confirm failure because the service does not exist.
3. Implement pure helpers for local-day boundaries, greeting period, quick-mood mapping, default outfit normalization, and optional module fallback. Keep SQL in the service and parameterize every user value.
4. Add `GET /api/home/overview` under `requireAuth` in `homeRouter`; return `{ ...overview }`, not an extra wrapper. Keep `/api/home/stats` unchanged.
5. Extend smoke coverage to assert 401 without a token, the complete overview response, and the unchanged legacy stats response.
6. Run `node server/test/home-overview.test.mjs` and `npm test --prefix server`.
7. Commit: `feat(server): add home overview aggregate`.

## Task 2: Add iOS overview models and decoding coverage

**Files:**

- Modify: `TuS/Models/ServerModels.swift`
- Modify: `TuS/Services/APIClient.swift`
- Create: `TuSTests/HomeOverviewDecodingTests.swift`
- Modify: `TuS.xcodeproj/project.pbxproj` only if the test target does not auto-discover the new file.

**Interfaces:**

```swift
struct HomeOverview: Decodable, Equatable
struct HomeOverviewStats: Decodable, Equatable
struct HomeQuickMood: Decodable, Identifiable, Equatable
struct HomePersonalitySummary: Decodable, Equatable
struct HomeColleagueSummary: Decodable, Equatable
func fetchHomeOverview() async throws -> HomeOverview
```

**Steps:**

1. Add decoding tests using a complete JSON fixture and an empty-state fixture. Assert outfit IDs, optional mood/personality, latest complaint fields, five quick moods, and all counters.
2. Run the iOS test target or, where unavailable on Windows, verify the test is discovered in the Xcode project and let CI provide the executable gate.
3. Add explicit Codable models matching the server's camelCase contract. Reuse existing `LittleEnergyOutfit` and complaint model types where their wire shape matches; otherwise add a narrow home card DTO and mapping initializer.
4. Add `APIClient.shared.fetchHomeOverview()` using `request("/api/home/overview")` and the existing authenticated request/error path.
5. Ensure absent optional modules decode as `nil`, while required contract fields remain required so server drift is visible.
6. Commit: `feat(ios): add home overview contract`.

## Task 3: Establish one iOS home state and mutation reconciliation

**Files:**

- Modify: `TuS/Services/MockDataStore.swift`
- Modify: `TuS/Models/LittleEnergyModels.swift` only for a reusable normalization/mapping helper if needed.
- Create: `TuSTests/HomeOverviewStoreTests.swift`

**Interfaces:**

```swift
@Published var homeOverview: HomeOverview?
@Published var homeOverviewPhase: HomeOverviewPhase
func loadHomeOverview(force: Bool = false) async
func reconcileHomeOverview(_ overview: HomeOverview)
func refreshHomeAfterMutation() async
```

**Steps:**

1. Add tests around a small injectable overview loader: loading success stores the payload, reconciles today's mood and outfit into existing global state, failure preserves cached content and exposes retry, and a stale request cannot overwrite a newer response.
2. Add the phase enum (`idle`, `loading`, `loaded`, `failed(message:)`) and one published overview property. Do not duplicate individual home counters as published fields.
3. Reconcile `moodToday` through `LittleEnergyCatalog.normalizeMood` and the existing global selected/current mood mechanism. Reconcile outfit through the existing current-user profile model.
4. Call `loadHomeOverview()` after server session activation and when the home explicitly refreshes. A failed optional home request must not fail login.
5. After existing mood check-in, complaint publication, and outfit-save success paths, apply their immediate local state updates first, then call `refreshHomeAfterMutation()` for server-authoritative counters.
6. Reset overview and phase on logout/account switch.
7. Run available Swift tests or the CI-compatible test command, then commit: `feat(ios): synchronize home overview state`.

## Task 4: Rebuild iOS navigation and faithfully reproduce the reference home

**Files:**

- Modify: `TuS/App/ContentView.swift`
- Create: `TuS/Views/Home/HomeOverviewView.swift`
- Create: `TuS/Views/Home/HomeHeroView.swift`
- Create: `TuS/Views/Home/HomeStatsGrid.swift`
- Create: `TuS/Views/Home/HomeMoodCard.swift`
- Create: `TuS/Views/Home/HomeComplaintCard.swift`
- Create: `TuS/Views/Home/HomePersonalityCard.swift`
- Modify: `TuS/Views/Match/MatchHomeView.swift` to remove or redirect the superseded home implementation without deleting still-used shared views.
- Modify: `TuS/Support/Theme.swift`
- Create: `TuSTests/HomeNavigationTests.swift`

**Required visual constants:**

```swift
enum HomeMetrics {
    static let pageHorizontal: CGFloat = 20
    static let cardRadius: CGFloat = 24
    static let sectionGap: CGFloat = 18
    static let cardShadowRadius: CGFloat = 18
}
```

**Steps:**

1. Add a navigation test or inspectable configuration asserting the five destinations are Home, Plaza, center Compose action, Messages, Mine; assert the center item presents the existing complaint composer and is not a selectable empty page.
2. Change `ContentView` to the new tab order, retain unread badge behavior, remove the AI tab, and route the personality card plus the existing Mine entry to `AITabView`.
3. Build `HomeOverviewView` as a vertical `ScrollView` in the exact reference order: greeting/hero, four stat cards, mood card, latest complaint, personality card. Render cached/skeleton content without a blocking overlay.
4. Reproduce the reference hierarchy: dark navy headline, muted subtitle, right-side Little Energy hero, translucent white cards, soft lavender/blue background glow, 24-point rounded cards, compact four-column stats, purple call-to-action text, and restrained shadows. Use dynamic type and a minimum tap target of 44 points without altering the visible proportions at the reference viewport.
5. Use `LittleEnergyAvatarView` with the globally reconciled mood and outfit for the hero and user representations. Never pass an outfit into the darkened colleague rendering path.
6. Wire quick moods to the existing check-in write API. Optimistically update the top hero/stat/mood card, present the existing full check-in sheet for pressure source/notes, and roll back/show retry on write failure.
7. Wire stat cards and section links to existing Plaza, My Complaints, Colleagues, Messages, search, and AI destinations. Keep existing complaint actions on the latest card.
8. Add pull-to-refresh calling `loadHomeOverview(force: true)` and a compact module retry on failure.
9. Run Swift tests and a Release simulator/device build in CI. Capture the iOS home at the reference-like viewport and compare side-by-side for section order, hero scale/position, card widths/heights, 20-point page margins, color hierarchy, and clipping.
10. Commit: `feat(ios): recreate reference home experience`.

## Task 5: Add Windows overview API, state, and regression tests

**Files:**

- Modify: `win-app/src/api.js`
- Modify: `win-app/src/app.js` or the actual shared state bootstrap file found during execution.
- Create: `win-app/test-home-overview.js`
- Modify: `win-app/test-little-energy-regressions.js`

**Interfaces:**

```js
async function fetchHomeOverview()
function applyHomeOverview(overview)
function refreshHomeOverview({ force = false } = {})
```

**Steps:**

1. Add a VM/browser-order regression fixture that loads scripts in the packaged HTML order and supplies complete, empty, delayed, and failed overview responses.
2. Assert one overview request feeds all first-screen modules, applies mood/outfit through existing Little Energy global setters, ignores stale responses, and always clears loading state on timeout/failure.
3. Add `fetchHomeOverview()` to the API export and replace the homepage's parallel first-screen requests with one refresh coordinator. Keep secondary radar/top-three requests lazy and non-blocking.
4. Store only `App.state.homeOverview` plus request phase/token. Do not mirror every stat into unrelated state keys.
5. After quick check-in, complaint publish, and profile outfit save, update existing global state immediately and refresh the overview.
6. Run `node win-app/test-home-overview.js`, `node win-app/test-little-energy-regressions.js`, and the existing `test-core.js`, `test-v2.js`, `test-v2b.js`, `test-v3.js`, `test-v3b.js` suites.
7. Commit: `feat(windows): integrate home overview state`.

## Task 6: Rebuild Windows home as a desktop-native counterpart

**Files:**

- Modify: `win-app/src/views.js`
- Modify: `win-app/src/style.css`
- Modify: `win-app/src/index.html` only if semantic script/style ordering or a root class must change.
- Modify: `win-app/smoke-ui.js`

**Steps:**

1. Extend smoke assertions for a rendered hero, four clickable stats, mood module, latest complaint, personality summary, colleague summary, and settled error/empty states.
2. Split homepage markup into rendering helpers: `renderHomeHero`, `renderHomeStats`, `renderHomeMood`, `renderHomeComplaint`, `renderHomePersonality`, and `renderHomeColleagueSummary`. Each accepts overview data and returns deterministic markup.
3. Preserve desktop sidebar/top navigation. Build a wide hero row, four equal stat cards, and a `minmax(0, 2fr) minmax(280px, 1fr)` main grid: mood/latest content left; personality/colleagues/quick links right.
4. Translate the reference visual system—soft lavender canvas, white translucent cards, navy typography, purple accents, rounded corners, low-elevation shadows, Little Energy hero—without mobile bottom navigation or phone-card stretching.
5. At widths below the existing desktop breakpoint, collapse main content to one column while keeping navigation desktop-appropriate. Test 1100×760 and the current minimum supported window size for no horizontal overflow or clipped controls.
6. Wire all cards, mood options, retry, search, complaint actions, and AI/personality links to existing destinations. Ensure the Little Energy hero reads current mood/outfit and the darkened colleague path receives no outfit.
7. Run the browser-order regressions and `node win-app/smoke-ui.js`. Launch the unpacked app and verify it leaves Splash for login/home under both successful and failed overview responses.
8. Commit: `feat(windows): redesign home dashboard`.

## Task 7: End-to-end verification, visual QA, and release

**Files:**

- Modify: `.github/workflows/ios-build.yml` only if test invocation needs correction; do not weaken build checks.
- Modify: `win-app/package.json` for the next patch version.
- Modify: release notes/changelog files already used by the repository.

**Steps:**

1. Start the server with seeded data and verify `/api/home/overview` for empty, populated, checked-in, and default-outfit accounts. Confirm `/api/home/stats` remains compatible.
2. Exercise both clients against the same account: change outfit, check in mood, publish a complaint, and verify the hero, cards, counts, and cross-page Little Energy update without relaunching.
3. Run all server tests, all Windows regression/smoke suites, and the iOS Release arm64 GitHub Actions build. Record exact command/run links and failures; fix causes rather than muting checks.
4. Capture iOS visual evidence beside the supplied reference. Treat wrong section order, materially different card geometry, missing glow/shadow hierarchy, incorrect Little Energy placement, or substituted generic emoji as release blockers.
5. Capture Windows at 1100×760 and minimum width. Treat stretched mobile layout, bottom tabs, overflow, unresolved skeletons, or a blocking spinner as release blockers.
6. Use `superpowers:requesting-code-review`, address P0/P1/P2 findings, then use `superpowers:verification-before-completion` and rerun all affected checks.
7. Bump the Windows patch version, build both portable and NSIS artifacts, install/launch each, and verify login/home entry.
8. Push the verified commits to `main`, trigger/confirm the iOS artifact workflow, publish the Windows release assets, and report changed files, overview state flow, visual QA evidence, release URLs, and any genuinely unresolved issue.
9. Commit release metadata: `chore(release): publish redesigned home experience`.

## Definition of Done

- One `/api/home/overview` request supplies the first screen on both platforms.
- iOS visibly matches the supplied reference design and uses the requested five-item navigation with a functional center compose button.
- Windows uses the same design language in a desktop-native sidebar/dashboard layout.
- Mood and outfit changes synchronize immediately across home and other Little Energy surfaces from existing global state.
- Empty, offline, timeout, and partial-module failures settle without an infinite loading screen.
- Server, Windows, and iOS Release checks pass; local and GitHub `main` plus release artifacts are updated.
