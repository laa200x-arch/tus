# Avatar, Navigation and Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a consistent Little Energy, complaint, navigation, messaging, icon, and update-notice experience across iOS, Windows, and the server.

**Architecture:** Build-time image composition produces complete Little Energy avatars from the existing mood and look source art, so runtime components select one asset. A small shared contract layer normalizes sentiments and version notices, while iOS and Electron each implement platform-native navigation and presentation. The Express route tests protect the deployed complaint API contract.

**Tech Stack:** SwiftUI/Xcode, Electron/vanilla JavaScript/CSS, Node.js/Express, Sharp, PNG/ICO assets.

**Spec:** `docs/superpowers/specs/2026-08-30-avatar-release-hardening.md`

## Global Constraints

- Preserve existing server-backed user, outfit, mood, complaint, and message data sources.
- Do not replace semantic in-app controls with the app icon.
- Keep Windows desktop-native; do not add a mobile bottom tab bar.
- Do not edit unrelated smoke outputs, prior release directories, or the root worktree.
- Verify failures before production-code changes and run platform builds before publishing.

---

### Task 1: Complete-avatar asset pipeline and regression contract

**Files:**
- Create: `win-app/scripts/build-complete-avatars.js`
- Create: `win-app/test-complete-avatar-assets.js`
- Modify: `win-app/src/little-energy.js`
- Modify: `TuS/Views/Components/LittleEnergyAvatarView.swift`
- Modify: `TuS/Models/LittleEnergyModels.swift`

**Interfaces:**
- Produces `complete/<mood>-<look>.png` and `complete/<mood>-<look>-<angle>.png`.
- `completeAvatarAsset(moodID, outfit)` returns one front asset path/name.

- [ ] **Step 1: Write failing asset contract test**

```js
assert.equal(renderedLayerCount, 1)
assert.ok(fs.existsSync(completeAvatarPath('xnz_happy', 'commute')))
```

- [ ] **Step 2: Run the contract test and verify it fails because complete assets are absent.**

- [ ] **Step 3: Add the Sharp composition script and the one-image renderer.**

```js
const avatar = completeAvatarPath(normalizeMood(moodId), resolveLook(outfit).id)
return `<img class="little-energy-complete" src="${avatar}" alt="">`
```

- [ ] **Step 4: Generate iOS/Windows derivatives and run the contract test until it passes.**

### Task 2: Complaint, favorite, sentiment and version-notice server contracts

**Files:**
- Modify: `server/src/routes/complaints.js`
- Modify: `server/src/routes/notifications.js`
- Modify: `server/src/index.js`
- Modify: `server/test/complaint-favorites.test.mjs`
- Create: `server/test/complaint-detail-contract.test.mjs`

**Interfaces:**
- Authenticated detail returns `{ complaint }`; favorite returns `{ favorited, favoriteCount }`.
- Version notice returns current version, release text and download action.

- [ ] **Step 1: Write failing authenticated detail/favorite and normalized-sentiment tests.**

```js
assert.equal(detail.status, 200)
assert.equal(detail.body.complaint.sentiment, 'xnz_disappointed')
assert.equal(favorite.body.favorited, true)
```

- [ ] **Step 2: Run only the new server tests and verify the missing/old-route fixture fails.**

- [ ] **Step 3: Implement the route ordering, notice payload and version constant reuse needed by the tests.**

- [ ] **Step 4: Run the new tests and full server test suite until green.**

### Task 3: iOS full-page navigation, profile, messaging, launch and update notice

**Files:**
- Modify: `TuS/App/ContentView.swift`
- Modify: `TuS/Views/Auth/LaunchView.swift`
- Modify: `TuS/Views/Chat/MessageView.swift`
- Modify: `TuS/Views/Profile/MineView.swift`
- Modify: `TuS/Views/Profile/UserProfileView.swift`
- Modify: `TuS/Views/Profile/ProfileEditView.swift`
- Modify: `TuS/Services/MockDataStore.swift`
- Modify: `TuS.xcodeproj/project.pbxproj`
- Test: `TuSTests/*`

**Interfaces:**
- `label(forSentiment:)` falls back to `LittleEnergyCatalog.mood(for:).label`.
- Full-screen entries accept a visible `dismiss` action.
- Version notices are accessed from Messages and own the external download action.

- [ ] **Step 1: Add failing Swift regression assertions for sentiment fallback and no-startup-update behavior.**
- [ ] **Step 2: Run the Swift tests and verify the assertions fail.**
- [ ] **Step 3: Implement a single-avatar UI, responsive turntable drag/preload, explicit navigation controls, profile archive placement, message layout, launch gradient, and version notice.**
- [ ] **Step 4: Run Swift tests and an iOS simulator/device build target.**

### Task 4: Windows desktop experience, messages and application identity

**Files:**
- Modify: `win-app/src/little-energy.js`
- Modify: `win-app/src/views.js`
- Modify: `win-app/src/app.js`
- Modify: `win-app/src/style.css`
- Modify: `win-app/src/index.html`
- Modify: `win-app/main.js`
- Modify: `win-app/package.json`
- Create: `win-app/test-message-layout.js`
- Create: `win-app/test-version-notice.js`

**Interfaces:**
- `sentimentLabel(value)` returns a human label for every supported `xnz_*` ID.
- Profile preview moves one turntable step during pointer movement after the threshold.
- Version notices are rendered as a content page, never a startup modal.

- [ ] **Step 1: Write failing DOM/source tests for one avatar layer, sentiment labels, version notice behavior, message header/composer, and configured Windows icon.**
- [ ] **Step 2: Run the new tests and record the expected failures.**
- [ ] **Step 3: Implement complete-avatar rendering, desktop message redesign, explicit back affordances, profile archive placement, dynamic-gradient splash, and non-modal version notice.**
- [ ] **Step 4: Run all Windows unit/source tests and the Electron smoke suite.**

### Task 5: Unified icon derivatives, release metadata, documentation and publish verification

**Files:**
- Create: `win-app/scripts/build-app-icons.js`
- Create: `win-app/build/icon.ico`
- Modify: `TuS/Assets.xcassets/AppIcon.appiconset/AppIcon.png`
- Modify: `assets/ui/icons/ui_brand_tus.png`
- Modify: `win-app/assets/ui/icons/ui_brand_tus.png`
- Modify: `README.md`
- Modify: `win-app/README.md`

**Interfaces:**
- One supplied source illustration creates an opaque 1024 iOS icon and a multi-size Windows ICO.
- All version strings use the same release value.

- [ ] **Step 1: Write failing checks for iOS/Windows icon configuration and version consistency.**
- [ ] **Step 2: Run the checks and verify the old iOS/empty Windows setup fails.**
- [ ] **Step 3: Generate icon derivatives from the approved supplied image and wire them into packaging, window, tray and launch branding.**
- [ ] **Step 4: Run icon/version checks, Windows installer build and iOS Release build.**
- [ ] **Step 5: Publish only after fresh tests/builds pass; deploy the server using configured host credentials or report deployment access as the remaining blocker.**
