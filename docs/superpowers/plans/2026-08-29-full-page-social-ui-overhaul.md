# Full-Page Social UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver full-page, cross-platform posts, search, chat, profile and Little Energy experiences with persistent favorites and no avatar outfit overlap.

**Architecture:** Add server-owned complaint favorites and detail/topic filtering to the existing complaint API, then extend both client models and stores from that response. iOS uses typed `NavigationStack` destinations/full-screen flows; Windows keeps its desktop sidebar while replacing content-page modals with an in-view history stack. A shared complete-look avatar renderer crops mood art to the head and uses one whole-look body asset.

**Tech Stack:** SwiftUI / Swift 5.9, Electron / vanilla JavaScript, Express, SQLite/MySQL schema, Socket.io, XCTest, Node test scripts, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-29-full-page-social-ui-design.md`

## Global Constraints

- Preserve the existing `littleEnergyOutfit`, mood and user-profile state owners; do not introduce duplicate persistent state.
- `complaint_resonances` remains API-compatible for older clients but is not a primary new UI action.
- Use real Little Energy PNGs and existing UI asset catalog entries; never substitute text/emoji/CSS drawings for visible assets.
- iOS follows the supplied mobile references; Windows keeps desktop navigation and full content panes.
- Only short confirmations may remain sheets/modals. All browse, edit, compose, detail and search flows are full pages.
- Image attachments show a local preview only; do not add unscoped media persistence or storage credentials.

---

### Task 1: Persistent complaint favorites and detail APIs

**Files:**
- Modify: `server/src/schema.js:148-205,373-416`
- Modify: `server/src/routes/complaints.js:1-310`
- Modify: `server/test/smoke.mjs:191-220`
- Create: `server/test/complaint-favorites.test.mjs`

**Interfaces:**
- Produces `POST /api/complaints/:id/favorite → { favorited, favoriteCount }`.
- Produces `GET /api/complaints/favorites → { complaints }` and `GET /api/complaints/:id → { complaint }`.
- Extends every enriched complaint with `favorited: boolean` and `favoriteCount: number`.
- Accepts `GET /api/complaints/feed?topic=<URL encoded term>` for hot-search result pages.

- [ ] **Step 1: Write failing favorite route tests**

Create `server/test/complaint-favorites.test.mjs` with a temporary migrated DB, authenticated test user and one complaint. Assert the API contract:

```js
const first = await api(`/api/complaints/${complaintId}/favorite`, { method: 'POST', token })
assert.equal(first.status, 200)
assert.deepEqual(await first.json(), { favorited: true, favoriteCount: 1 })

const detail = await api(`/api/complaints/${complaintId}`, { token })
assert.equal((await detail.json()).complaint.favorited, true)

const saved = await api('/api/complaints/favorites', { token })
assert.equal((await saved.json()).complaints[0].id, complaintId)

const second = await api(`/api/complaints/${complaintId}/favorite`, { method: 'POST', token })
assert.deepEqual(await second.json(), { favorited: false, favoriteCount: 0 })
```

- [ ] **Step 2: Run the new test and verify the expected red failure**

Run: `node server/test/complaint-favorites.test.mjs`

Expected: failure because the favorite route/table does not exist.

- [ ] **Step 3: Add SQLite and MySQL favorite schema**

Add `complaint_favorites` immediately after `complaint_likes` in both schema blocks:

```sql
CREATE TABLE IF NOT EXISTS complaint_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (complaint_id, user_id)
);
```

Use the equivalent `INT AUTO_INCREMENT` MySQL definition and `UNIQUE KEY uq_complaint_favorite (complaint_id, user_id)`.

- [ ] **Step 4: Extend complaint enrichment and routes**

In `enrichRow`, query favorite count and viewer state alongside likes/comments, then return `favoriteCount` and `favorited`. Add the three routes before the existing comments routes. Delete favorites in the complaint delete route. For topic filtering, add a parameterized `AND (c.content LIKE ? OR c.category LIKE ? OR c.behavior_tags LIKE ?)` clause to the existing feed query; never interpolate `topic` into SQL.

- [ ] **Step 5: Run server regression tests**

Run:

```bash
node server/test/complaint-favorites.test.mjs
node server/test/smoke.mjs
node server/test/migrations.test.mjs
```

Expected: favorite test passes; existing complaint/comment/resonance smoke coverage remains green.

- [ ] **Step 6: Commit the server data contract**

```bash
git add server/src/schema.js server/src/routes/complaints.js server/test/complaint-favorites.test.mjs server/test/smoke.mjs
git commit -m "feat: add persistent complaint favorites"
```

### Task 2: iOS complaint models, store and API client

**Files:**
- Modify: `TuS/Models/AgreementModel.swift:217-294`
- Modify: `TuS/Services/APIClient.swift:360-505,598-680`
- Modify: `TuS/Services/MockDataStore.swift:720-860`
- Modify: `TuSTests/HomeOverviewStoreTests.swift`
- Create: `TuSTests/ComplaintFavoritesTests.swift`

**Interfaces:**
- `ComplaintModel` gains mutable `favoriteCount: Int` and `favorited: Bool` with backward-compatible decoding defaults.
- `APIClient` exposes `fetchComplaint(id:)`, `fetchFavoriteComplaints()`, and `toggleFavoriteComplaint(id:)`.
- `MockDataStore` exposes `favoriteComplaints`, `toggleFavorite(_:)` and reconciles favorite fields in every cached complaint collection.

- [ ] **Step 1: Write the failing model/store test**

Create `TuSTests/ComplaintFavoritesTests.swift`:

```swift
func testFavoriteToggleReconcilesFeedMineAndFavorites() {
    let complaint = ComplaintModel.fixture(id: "c1", favorited: false, favoriteCount: 0)
    let changed = ComplaintFavoriteDecision.apply(
        id: "c1", favorited: true, favoriteCount: 1,
        feed: [complaint], mine: [complaint], favorites: []
    )
    XCTAssertTrue(changed.feed[0].favorited)
    XCTAssertEqual(changed.mine[0].favoriteCount, 1)
    XCTAssertEqual(changed.favorites.map(\.id), ["c1"])
}
```

- [ ] **Step 2: Run the iOS test in CI-compatible compile mode and observe failure**

Run on macOS:

```bash
xcodebuild -project TuS.xcodeproj -scheme TuS -configuration Debug \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build-for-testing
```

Expected: compile failure because `ComplaintFavoriteDecision` and favorite fields do not exist.

- [ ] **Step 3: Implement API models and deterministic reconciliation**

Add optional-decoding defaults so older servers still decode. Implement a pure `ComplaintFavoriteDecision.apply(...)` helper beside existing state decision helpers, then call it only after `APIClient.toggleFavoriteComplaint` succeeds. Fetch favorites into `favoriteComplaints` when the user refreshes their profile data.

- [ ] **Step 4: Add API client calls**

Use the existing request helper:

```swift
func toggleFavoriteComplaint(id: String) async throws -> (favorited: Bool, favoriteCount: Int) {
    let response: FavoriteToggleResponse = try await request("/api/complaints/\(id)/favorite", method: "POST")
    return (response.favorited, response.favoriteCount)
}
```

Add response wrappers for the detail and favorite-list contracts.

- [ ] **Step 5: Verify iOS model coverage**

Run the new XCTest target through the GitHub macOS workflow after the commit; locally on Windows run the static UI regression tests in Task 6.

- [ ] **Step 6: Commit iOS favorite state**

```bash
git add TuS/Models/AgreementModel.swift TuS/Services/APIClient.swift TuS/Services/MockDataStore.swift TuSTests/ComplaintFavoritesTests.swift
git commit -m "feat(ios): synchronize complaint favorites"
```

### Task 3: Windows complaint state, routes and no-modal content navigation

**Files:**
- Modify: `win-app/src/api.js:359-411,542-550`
- Modify: `win-app/src/views.js:66-110,1752-2168`
- Modify: `win-app/src/style.css:357-482,1027-1168`
- Create: `win-app/test-complaint-page-flow.js`

**Interfaces:**
- `api.js` exports `fetchComplaint`, `fetchFavoriteComplaints`, `toggleFavoriteComplaint` and `fetchFeedComplaints(sort, filter, topic)`.
- `views.js` exports `openComplaintDetail(id)`, `showComplaintCompose()`, `renderSearch(query)` and `renderSavedComplaints()` as full content pages, not `openModal` clients.
- `App.state.views` gains a return target stack consumed by `pushContentPage(render)` and `popContentPage()`.

- [ ] **Step 1: Write a failing page-flow source regression test**

Create `win-app/test-complaint-page-flow.js`:

```js
assert.match(source, /function pushContentPage\(/)
assert.match(source, /function renderSavedComplaints\(/)
assert.match(source, /data-act="favorite"/)
assert.doesNotMatch(detailFunctionBody, /openModal\(/)
assert.doesNotMatch(composeFunctionBody, /openModal\(/)
```

- [ ] **Step 2: Run it and confirm red**

Run: `node win-app/test-complaint-page-flow.js`

Expected: failure because detail and compose currently call `openModal`.

- [ ] **Step 3: Add Windows API/state reconciliation**

Mirror iOS favorite fields in complaint objects. On a successful favorite response, update feed, mine, favorites and any mounted detail card by id; do not optimistically create a second state source.

- [ ] **Step 4: Replace browse/edit modals with content pages**

Introduce `pushContentPage`/`popContentPage` around the existing `#view` mount. Convert posts, comments, compose, search, profile editor, my posts and favorites to render in that mount. Preserve `openModal` only for confirmation, blocked-content and short utility actions.

- [ ] **Step 5: Verify Windows logic and UI contracts**

Run:

```bash
node win-app/test-complaint-page-flow.js
node win-app/test-little-energy.js
node win-app/test-avatar-ui-regressions.js
node win-app/test-ui-assets.js --synced --ios-usage --windows-usage
```

- [ ] **Step 6: Commit the Windows data/navigation layer**

```bash
git add win-app/src/api.js win-app/src/views.js win-app/src/style.css win-app/test-complaint-page-flow.js
git commit -m "feat(windows): add full-page complaint flows"
```

### Task 4: Complete-look Little Energy renderer and dresser

**Files:**
- Modify: `TuS/Views/Components/LittleEnergyAvatarView.swift:1-220`
- Modify: `TuS/Views/Profile/ProfileEditView.swift:1-150`
- Modify: `TuS/Views/Home/HomeOverviewView.swift`
- Modify: `win-app/src/little-energy.js:39-128`
- Modify: `win-app/src/style.css` Little Energy selectors
- Modify: `win-app/src/views.js:9-20,676-800,1460-1510`
- Modify: `TuSTests/LittleEnergyModelsTests.swift`
- Modify: `win-app/test-little-energy-layer-layout.js`

**Interfaces:**
- Both renderers emit exactly `.layer-emotion-head` and `.layer-look` for normal users; no product-cutout item layers are permitted.
- `LittleEnergyTurntableView` and the Windows dresser accept a `LittleEnergyLook`/resolved outfit and show front/left/back/right assets.

- [ ] **Step 1: Extend failing renderer assertions**

Add checks:

```js
assert.match(css, /\.layer-emotion-head[\s\S]*clip-path/)
assert.match(css, /\.layer-look/)
assert.doesNotMatch(html, /outfits\/(tops|bottoms|shoes|accessories)/)
```

Add Swift test expectations that `.darkColleague` has no look layer and `LittleEnergyLook.resolve` maps every canonical look to a complete asset.

- [ ] **Step 2: Run the assertions and observe red**

Run: `node win-app/test-little-energy-layer-layout.js`

Expected: failure because current emotion layer is not named/cropped as a head-only layer.

- [ ] **Step 3: Implement standard layer geometry**

Rename the normal emotion layer to `emotion-head`, apply the same normalized top-half crop in Swift `mask` and CSS `clip-path`, and keep look body beneath it. Ensure every consumer calls the one renderer. Keep dark-colleague branch untouched.

- [ ] **Step 4: Rework dresser layouts to reference 1**

Replace the iOS Form look section with a full-page card layout: account rows, large turntable, drag cue, horizontal selected look cards and a bottom save CTA. Match it on Windows with a desktop preview panel and horizontal cards rather than a modal.

- [ ] **Step 5: Run avatar tests and asset sync checks**

Run:

```bash
node win-app/test-little-energy.js
node win-app/test-little-energy-layer-layout.js
node win-app/test-avatar-ui-regressions.js
```

- [ ] **Step 6: Commit the Little Energy fix**

```bash
git add TuS/Views/Components/LittleEnergyAvatarView.swift TuS/Views/Profile/ProfileEditView.swift TuS/Views/Home/HomeOverviewView.swift TuS/Models/LittleEnergyModels.swift TuSTests/LittleEnergyModelsTests.swift win-app/src/little-energy.js win-app/src/style.css win-app/src/views.js win-app/test-little-energy-layer-layout.js
git commit -m "fix: render Little Energy as complete looks"
```

### Task 5: iOS full-page posts, profile, compose, search and chat

**Files:**
- Modify: `TuS/Views/Feed/ExchangeDynamicView.swift:1-420`
- Modify: `TuS/Views/Match/MatchDetailView.swift:1-180`
- Modify: `TuS/Views/Home/HomeOverviewView.swift:1-260`
- Modify: `TuS/Views/Profile/MineView.swift:1-115`
- Modify: `TuS/Views/Profile/UserProfileView.swift`
- Modify: `TuS/Views/Chat/MessageView.swift:1-380`
- Create: `TuS/Views/Feed/ComplaintDetailView.swift`
- Create: `TuS/Views/Feed/ComplaintSearchView.swift`
- Create: `TuSTests/FullPageNavigationTests.swift`

**Interfaces:**
- `ComplaintDetailView(complaintID:focusComments:)` loads the canonical complaint and comments.
- `ComplaintSearchView(initialQuery:mode:)` renders hot terms, category cards, recent queries and grouped results.
- `ComplaintComposeView` is pushed/full-screen and posts through the existing Store method.
- `UserProfileView` owns links to edit profile, my posts, favorites and existing personal tools.

- [ ] **Step 1: Write failing navigation and presentation tests**

Create `TuSTests/FullPageNavigationTests.swift` source-contract checks requiring:

```swift
XCTAssertFalse(try source("ExchangeDynamicView.swift").contains(".sheet(isPresented: $showCompose)"))
XCTAssertTrue(try source("ComplaintDetailView.swift").contains("struct ComplaintDetailView"))
XCTAssertTrue(try source("HomeOverviewView.swift").contains("navigationDestination"))
XCTAssertFalse(try source("MineView.swift").contains("sheet(isPresented: $showProfile)"))
```

- [ ] **Step 2: Compile tests and confirm red**

Run the CI-compatible `build-for-testing` command from Task 2.

Expected: failure because the detail/search view files and required full-page navigation contracts are absent.

- [ ] **Step 3: Implement reusable full pages**

Extract card action rendering from `ComplaintCardView` so the feed, detail and saved lists share the same like/comment/favorite state. Comment action pushes `ComplaintDetailView(..., focusComments: true)`. Hot topic action pushes a filtered feed route. `ComplaintComposeView` matches reference 2 (full top bar, editable content, tags, mood tiles, anonymous toggle and bottom CTA); provide local image preview only.

- [ ] **Step 4: Convert home and profile entry points**

Replace relevant sheets in `HomeOverviewView` and `MineView` with typed navigation destinations or `fullScreenCover`. Make Mine's identity card open `UserProfileView`; place edit, posts, favorites, browsing history and colleagues there so “我的档案” is not a separate half page.

- [ ] **Step 5: Match chat and search references**

In `MessageView`/`ChatDetailView`, implement the reference 3 hierarchy using app assets/system icons: presence label, date chip, clear left/right message bubbles, bottom composer, plus and Little Energy emoji panel. Build the reference 4 search sections and route every hit to a full page; map mood IDs using `LittleEnergyCatalog.mood(for:)` before display.

- [ ] **Step 6: Compile and run model/navigation tests**

Run on GitHub macOS:

```bash
xcodebuild -project TuS.xcodeproj -scheme TuS -configuration Debug \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build-for-testing
```

Then inspect the resulting iOS app/screens with the required visual QA capture.

- [ ] **Step 7: Commit iOS full-page UX**

```bash
git add TuS/Views/Feed TuS/Views/Home/HomeOverviewView.swift TuS/Views/Profile/MineView.swift TuS/Views/Profile/UserProfileView.swift TuS/Views/Chat/MessageView.swift TuSTests/FullPageNavigationTests.swift
git commit -m "feat(ios): redesign full-page social flows"
```

### Task 6: Windows visual parity without mobile-layout copying

**Files:**
- Modify: `win-app/src/views.js:668-800,995-1095,1410-2200`
- Modify: `win-app/src/style.css` dashboard, complaint, compose, chat, search and profile selectors
- Modify: `win-app/test-avatar-ui-regressions.js`
- Create: `win-app/test-full-page-ui.js`

**Interfaces:**
- `renderSearch` exposes hot terms, category buttons, recents and a Little Energy empty state.
- `renderComplaint` exposes comment/favorite actions and no resonance action label.
- Full content pages expose `[data-page-back]` and no primary use of `.modal-box`.

- [ ] **Step 1: Write failing desktop UI contract tests**

Create `win-app/test-full-page-ui.js`:

```js
assert.match(views, /评论<\/button>/)
assert.match(views, /data-act="favorite"/)
assert.doesNotMatch(complaintCardHtml, />共鸣</)
assert.match(views, /热门搜索/)
assert.match(views, /最近搜索/)
assert.match(views, /data-page-back/)
```

- [ ] **Step 2: Run it and verify red**

Run: `node win-app/test-full-page-ui.js`

Expected: failure because current cards still render the resonance label and search is a compact result mount.

- [ ] **Step 3: Implement desktop page layouts**

Use the existing theme variables and real asset catalog images to create desktop-scale versions of the reference flows: broad detail/article column, right contextual panel where useful, dedicated compose workspace, chat conversation canvas and searchable panels. Do not add an iOS-style bottom bar.

- [ ] **Step 4: Wire all interactive entry points**

Connect card click, comment, favorite, hot topic, quick search category, recent search, profile post/favorite tools and conversation rows to the page history API. Keep title/back state correct after returning.

- [ ] **Step 5: Run desktop tests and packaged smoke test**

Run:

```bash
node win-app/test-full-page-ui.js
node win-app/test-complaint-page-flow.js
node win-app/test-little-energy-regressions.js
npm run dist
node win-app/smoke-main.js
```

- [ ] **Step 6: Commit Windows visual delivery**

```bash
git add win-app/src/views.js win-app/src/style.css win-app/test-full-page-ui.js win-app/test-avatar-ui-regressions.js
git commit -m "feat(windows): redesign desktop social pages"
```

### Task 7: Two-platform visual QA, release and documentation

**Files:**
- Modify: `design-qa.md`
- Modify: `README.md`
- Modify: `win-app/package.json`
- Modify: `.github/workflows/build-ipa.yml` only if CI diagnostics require it

**Interfaces:**
- Produces a Windows installer matching the bumped package version and an IPA artifact from a successful GitHub Action.
- `design-qa.md` records reference-by-reference comparison for dresser, compose, chat and search.

- [ ] **Step 1: Capture the four target states**

Capture iOS and Windows dresser, composer, chat and search screens at matching states. Pair each capture with the supplied reference before assessment.

- [ ] **Step 2: Write and run design QA**

Document P0/P1/P2 mismatches in `design-qa.md`; correct all of them and recapture until it reads `final result: passed`. If an iOS visual capture is unavailable, write `final result: blocked` with the exact environment reason instead of claiming a pass.

- [ ] **Step 3: Run final verification**

Run:

```bash
node server/test/complaint-favorites.test.mjs
node server/test/smoke.mjs
node win-app/test-full-page-ui.js
node win-app/test-complaint-page-flow.js
node win-app/test-little-energy.js
node win-app/test-little-energy-layer-layout.js
node win-app/test-avatar-ui-regressions.js
node win-app/test-ui-assets.js --synced --ios-usage --windows-usage
cd win-app && npm run dist
```

Confirm GitHub `Build IPA` succeeds for the final commit and that its `TuS-unsigned-ipa` artifact exists.

- [ ] **Step 4: Publish the versioned Windows installer**

Increment `win-app/package.json` once for this release, regenerate the NSIS installer, then create a new `win-v<version>` GitHub Release with `tools/release-win.mjs`. Add the direct Release link and concise change list to README.

- [ ] **Step 5: Commit and push the release record**

```bash
git add design-qa.md README.md win-app/package.json
git commit -m "release: publish full-page social UI update"
git push origin codex/home-overview-redesign
git push origin HEAD:main
```
