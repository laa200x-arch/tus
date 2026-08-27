# TUS Full Product Design Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce 39 individually named transparent PNG icons plus two background/decor images from the approved full-product design board, apply them across all ten iOS screen families and the desktop-native Windows equivalents, then test, package, and publish both clients.

**Architecture:** `assets/ui/asset-manifest.json` is the canonical asset contract. Generated and library-rendered PNGs live once under `assets/ui`, a deterministic Node sync tool copies them into iOS imagesets and Windows assets, and platform-specific `UIAsset`/`uiAsset()` helpers are the only code-facing names. Existing Little Energy emotion/outfit assets and product state remain authoritative.

**Tech Stack:** Built-in ImageGen, PNG/RGBA, Node.js 20, Sharp, Phosphor Iconify JSON, Swift 5/SwiftUI, Electron 31, HTML/CSS/JavaScript, XCTest, GitHub Actions/Xcode Release build.

**Spec:** `docs/superpowers/specs/2026-08-28-full-product-design-assets.md`

## Global Constraints

- The supplied `TUS 职场那些事 · 全量设计稿 Design Draft v1.0` is the only visual target; do not invent alternate layout, palette, radii, type hierarchy, or icon language.
- Produce exactly one independent 256×256 RGBA PNG for every one of the 39 manifest icon names; no sprite sheets, screenshot crops, placeholders, emoji, text glyphs, handcrafted SVG, inline SVG, CSS drawings, or SF Symbols in the mapped slots.
- Produce `ui_bg_app_soft` at 1024×1536 and `ui_decor_home_hero` at 1024×1024 with alpha.
- Reuse all existing 27 `xnz_*` emotion PNGs and outfit layers. `dark-colleague.png` remains outfit-free and exclusive to the complained-about colleague representation.
- User/colleague photos, AI charts, counters, labels, unread dots, and other live data remain dynamic UI rather than baked images.
- iOS follows the ten mobile screen families in the reference. Windows uses the same assets and visual language in its existing sidebar/wide-dashboard structure, never a copied mobile bottom bar.
- Every asset must exist in canonical, iOS, and Windows paths and have a consuming component before release.
- Windows release version advances from 2.1.2 to 2.1.3.

---

### Task 1: Canonical manifest, reference, sync, and validation tooling

**Files:**

- Create: `assets/ui/asset-manifest.json`
- Create: `assets/ui/reference/tus-full-design-v1.jpg`
- Create: `win-app/scripts/sync-ui-assets.js`
- Create: `win-app/test-ui-assets.js`
- Modify: `win-app/package.json`
- Modify: `win-app/package-lock.json`

**Interfaces:**

- Produces: `loadManifest(): { icons: AssetEntry[], backgrounds: AssetEntry[] }`
- Produces: `syncUIAssets({ rootDir }): Promise<void>`
- `AssetEntry = { name, category, method, width, height, alpha, screens, iosAsset, windowsPath, consumers, iconifyName?, color?, prompt? }`

- [ ] **Step 1: Write the failing manifest/tooling test**

Create `win-app/test-ui-assets.js` with assertions that the manifest has exactly 39 unique icons and two unique backgrounds; each entry has all interface fields; all spec names are present; no extra name starts with `ui_`; icon entries require `256×256` and `alpha: true`.

```js
assert.equal(manifest.icons.length, 39)
assert.equal(manifest.backgrounds.length, 2)
assert.equal(new Set(manifest.icons.map((item) => item.name)).size, 39)
for (const item of manifest.icons) {
  assert.deepEqual([item.width, item.height, item.alpha], [256, 256, true])
  assert.ok(item.iosAsset && item.windowsPath && item.consumers.length)
}
```

- [ ] **Step 2: Run RED**

Run: `node win-app/test-ui-assets.js`

Expected: FAIL because `assets/ui/asset-manifest.json` does not exist.

- [ ] **Step 3: Add exact manifest entries**

Copy all 39 icon names and two background names from the spec. Assign methods as follows:

```text
library: ui_nav_home, ui_nav_plaza, ui_nav_messages, ui_nav_profile,
ui_action_search, ui_action_back, ui_action_more, ui_action_chevron,
ui_action_like, ui_action_comment, ui_action_share, ui_action_send, ui_action_add

imagegen: ui_brand_tus, ui_nav_publish,
all ui_feature_*, all ui_publish_*, all ui_message_*, all ui_profile_*,
all ui_tool_*, all ui_row_*, ui_badge_level, ui_avatar_anonymous,
ui_bg_app_soft, ui_decor_home_hero
```

Use these Phosphor names for the 13 library icons:

```json
{
  "ui_nav_home": "house",
  "ui_nav_plaza": "magnifying-glass",
  "ui_nav_messages": "heart",
  "ui_nav_profile": "user",
  "ui_action_search": "magnifying-glass",
  "ui_action_back": "caret-left",
  "ui_action_more": "dots-three-vertical",
  "ui_action_chevron": "caret-right",
  "ui_action_like": "heart",
  "ui_action_comment": "chat-circle",
  "ui_action_share": "share-network",
  "ui_action_send": "paper-plane-tilt",
  "ui_action_add": "plus"
}
```

- [ ] **Step 4: Add dependencies and sync implementation**

Add `sharp` and `@iconify-json/ph` to Windows dev dependencies. Implement sync to create one iOS imageset per canonical file with a universal 1x PNG and `preserves-vector-representation: false`, and copy the same PNG to each declared Windows path. Never edit PNG bytes during sync.

- [ ] **Step 5: Save the approved reference image**

Copy `C:/Users/KK/AppData/Local/Temp/codex-clipboard-c3863965-60c6-4da2-9975-43c86179eede.jpg` to the manifest reference path without recompression. Record its SHA-256 in the manifest top-level `reference.sha256`.

- [ ] **Step 6: Run GREEN for schema/tooling**

Run: `node win-app/test-ui-assets.js --schema-only`

Expected: PASS with `39 icons / 2 backgrounds / 0 duplicate names`.

- [ ] **Step 7: Commit**

```bash
git add assets/ui/asset-manifest.json assets/ui/reference win-app/scripts/sync-ui-assets.js win-app/test-ui-assets.js win-app/package.json win-app/package-lock.json
git commit -m "build(assets): define full product image manifest"
```

### Task 2: Render the 13 shared line icons as transparent PNGs

**Files:**

- Create: `win-app/scripts/render-library-icons.js`
- Create: `assets/ui/icons/ui_nav_home.png` and the other 12 manifest `method: library` PNGs
- Modify: `win-app/test-ui-assets.js`

**Interfaces:**

- Consumes: manifest `iconifyName`, `color`, `width`, and `height`.
- Produces: `renderLibraryIcons({ rootDir }): Promise<string[]>` returning rendered canonical paths.

- [ ] **Step 1: Add failing library-render checks**

Assert all 13 library outputs exist, are PNG, are 256×256 RGBA, contain at least one alpha-zero pixel and at least one visible pixel, and have visible bounds inside the 28px outer safety margin.

- [ ] **Step 2: Run RED**

Run: `node win-app/test-ui-assets.js --method library`

Expected: FAIL listing all 13 missing files.

- [ ] **Step 3: Implement deterministic rendering**

Read icon bodies from `@iconify-json/ph/icons.json`, place each in a 200×200 view box centered on a 256×256 transparent canvas, use rounded stroke/regular weight where available, and render via Sharp. Use `#747B96` as canonical line color; selected-state purple is applied by the platform rendering layer.

- [ ] **Step 4: Render and verify**

Run:

```bash
node win-app/scripts/render-library-icons.js
node win-app/test-ui-assets.js --method library
```

Expected: `13/13 library icons valid`.

- [ ] **Step 5: Commit**

```bash
git add assets/ui/icons win-app/scripts/render-library-icons.js win-app/test-ui-assets.js
git commit -m "feat(assets): render shared line icon set"
```

### Task 3: Generate branded navigation, home, publish, and message images

**Files:**

- Create: 15 manifest `method: imagegen` PNGs under `assets/ui/icons/`
- Modify: `assets/ui/asset-manifest.json` with final prompts and generation provenance.

**Interfaces:**

- Consumes: the saved design-board reference plus the manifest prompt.
- Produces: `ui_brand_tus`, `ui_nav_publish`, four `ui_feature_*`, four `ui_publish_*`, and four `ui_message_*` PNGs plus one independently generated `ui_avatar_anonymous` PNG.

- [ ] **Step 1: Add failing existence/alpha checks for the batch**

Run: `node win-app/test-ui-assets.js --group primary-branded`

Expected: FAIL listing 15 missing canonical PNGs.

- [ ] **Step 2: Generate each image separately with built-in ImageGen**

Use the saved design board as style reference for every call. Use this exact shared constraint block in every prompt:

```text
Use case: stylized-concept. Asset type: TUS mobile app UI icon.
Style: polished soft 3D-clay icon matching the supplied design board; rounded geometry; subtle translucent material; gentle inner glow; compact centered silhouette.
Palette: energy purple #765BFF, pale purple #A695FF, with the asset-specific accent.
Composition: one centered icon, generous padding, no crop.
Output: genuinely transparent background PNG, no tile, no container unless explicitly requested.
Constraints: no text, no letters, no watermark, no extra objects, no screenshot or device chrome.
```

Append exactly one subject line per independent call:

```text
ui_brand_tus: rounded purple app badge with a tiny white abstract workplace-energy spark mark; no letters.
ui_nav_publish: luminous purple rounded-square button with a crisp white plus.
ui_feature_checkin: purple work journal with one clean checklist line; pale lavender rounded tile allowed.
ui_feature_plaza: warm orange-red flame representing a busy workplace plaza; pale peach tile allowed.
ui_feature_my_complaints: sky-blue circular speech bubble with three white dots; pale blue tile allowed.
ui_feature_colleagues: mint-green pair of friendly coworker silhouettes; pale mint tile allowed.
ui_publish_complaint: purple work journal with a small chat notch.
ui_publish_dynamic: coral-pink square post card with a small sparkle.
ui_publish_mood: cyan-blue smiling mood bubble.
ui_publish_colleague: mint-green two-person workplace profile.
ui_message_interaction: pink-magenta inbox with a small heart notification.
ui_message_system: purple notification bell inside a soft hexagonal badge.
ui_message_ai: friendly tiny Little Energy assistant head, white face, lavender hood, black oval eyes, no clothing.
ui_message_update: purple secure update badge combining a small lock and upward sparkle.
ui_avatar_anonymous: circular purple anonymous theatre-mask avatar with small cyan and orange accents.
```

- [ ] **Step 3: Normalize final files**

Inspect every result, reject any white/opaque backdrop or text, preserve alpha, downsample the accepted output to 256×256 with Lanczos, and save to its exact canonical filename. Store `generation.tool`, `generation.promptVersion`, and final SHA-256 in the matching manifest entry.

- [ ] **Step 4: Run batch validation**

Run: `node win-app/test-ui-assets.js --group primary-branded`

Expected: `15/15 primary branded icons valid`.

- [ ] **Step 5: Commit**

```bash
git add assets/ui/icons assets/ui/asset-manifest.json
git commit -m "feat(assets): generate primary product icon set"
```

### Task 4: Generate profile/tool images and the two backgrounds

**Files:**

- Create: remaining 11 imagegen icon PNGs under `assets/ui/icons/`
- Create: `assets/ui/backgrounds/ui_bg_app_soft.png`
- Create: `assets/ui/backgrounds/ui_decor_home_hero.png`
- Modify: `assets/ui/asset-manifest.json`

**Interfaces:**

- Produces: four `ui_profile_*`, four `ui_tool_*`, two `ui_row_*`, `ui_badge_level`, and two backgrounds.

- [ ] **Step 1: Add failing remaining-asset checks**

Run: `node win-app/test-ui-assets.js --group profile-backgrounds`

Expected: FAIL listing 13 missing files.

- [ ] **Step 2: Generate every icon separately**

Use the same exact shared prompt block from Task 3 and these subject lines:

```text
ui_profile_complaints: golden-yellow work journal with one white speech line; pale cream tile allowed.
ui_profile_favorites: warm orange five-point favorite star; pale peach tile allowed.
ui_profile_posts: pink-magenta friendly flame representing liked posts; pale pink tile allowed.
ui_profile_history: golden circular clock with one clean hand; pale yellow tile allowed.
ui_tool_report: cyan-blue report sheet with two simple bars; pale blue tile allowed.
ui_tool_ai: mint-green insight target with one central sparkle; pale mint tile allowed.
ui_tool_stress: coral-pink pressure cloud with one gentle pulse line; pale rose tile allowed.
ui_tool_relationship: blue-violet connected coworker silhouettes; pale lavender tile allowed.
ui_row_colleague: small purple coworker archive symbol, clean and compact.
ui_row_company: small navy-purple office building portrait symbol, clean and compact.
ui_badge_level: tiny polished gold level medal with one star, no number and no text.
```

- [ ] **Step 3: Generate each background separately**

Use exact prompts:

```text
ui_bg_app_soft — Use case: stylized-concept. Asset type: full-screen mobile app background. Near-white canvas with extremely subtle lavender-blue ambient glow in the upper-right and lower-left, almost imperceptible paper-soft texture, large clean negative space, no objects, no text, no border, no watermark. 1024×1536.

ui_decor_home_hero — Use case: stylized-concept. Asset type: transparent decorative overlay around the existing Little Energy hero. Sparse lavender four-point sparkles, one translucent pale-blue chat bubble with three tiny blue dots, and a soft elliptical lavender glow; keep the center mostly empty for the character, no character, no text, no border, genuinely transparent background. 1024×1024.
```

- [ ] **Step 4: Normalize and validate**

Downsample icons to 256×256, preserve background dimensions, update hashes/provenance, then run:

```bash
node win-app/test-ui-assets.js --group profile-backgrounds
node win-app/test-ui-assets.js
```

Expected: `39 icons / 2 backgrounds valid`.

- [ ] **Step 5: Commit**

```bash
git add assets/ui/icons assets/ui/backgrounds assets/ui/asset-manifest.json
git commit -m "feat(assets): complete full product image set"
```

### Task 5: Sync assets and add platform accessors

**Files:**

- Create: `TuS/Support/UIAsset.swift`
- Create: `win-app/src/ui-assets.js`
- Modify: `TuS.xcodeproj/project.pbxproj`
- Modify: `win-app/src/index.html`
- Create: `TuSTests/UIAssetTests.swift`
- Modify: `win-app/test-ui-assets.js`
- Generate: `TuS/Assets.xcassets/UI/**`
- Generate: `win-app/assets/ui/**`

**Interfaces:**

```swift
enum UIAsset: String, CaseIterable {
    case brandTUS = "ui_brand_tus"
    // one case for every manifest asset
    var image: Image { Image(rawValue) }
}
```

```js
function uiAsset(name) { return `../assets/ui/${manifestRelativePath(name)}` }
function uiIcon(name, className = '') { return `<img src="${uiAsset(name)}" class="ui-icon ${className}" alt="">` }
```

- [ ] **Step 1: Write failing accessor/sync tests**

Assert Swift cases and JS names equal the manifest names; every iOS imageset and Windows copy exists; every generated iOS `Contents.json` references the right filename.

- [ ] **Step 2: Run RED**

Run: `node win-app/test-ui-assets.js --synced`

Expected: FAIL because platform copies/accessors do not exist.

- [ ] **Step 3: Run sync and add accessors**

Run `node win-app/scripts/sync-ui-assets.js`; add `UIAsset.swift` to the app target and `UIAssetTests.swift` to the test target; load `ui-assets.js` before `views.js` in the real packaged order.

- [ ] **Step 4: Run GREEN**

Run:

```bash
node win-app/test-ui-assets.js --synced
node win-app/test-little-energy-regressions.js
```

Expected: all assets synchronized and browser-order regression green.

- [ ] **Step 5: Commit**

```bash
git add TuS/Assets.xcassets/UI TuS/Support/UIAsset.swift TuSTests/UIAssetTests.swift TuS.xcodeproj/project.pbxproj win-app/assets/ui win-app/src/ui-assets.js win-app/src/index.html win-app/test-ui-assets.js
git commit -m "feat(assets): synchronize image set across clients"
```

### Task 6: Apply all assets to the ten iOS screen families

**Files:**

- Modify: `TuS/App/ContentView.swift`
- Modify: `TuS/Support/Theme.swift`
- Modify: `TuS/Views/Home/*.swift`
- Modify: `TuS/Views/Feed/ExchangeDynamicView.swift`
- Modify: `TuS/Views/Match/MatchDetailView.swift`
- Modify: `TuS/Views/Chat/MessageView.swift`
- Modify: `TuS/Views/Profile/MineView.swift`
- Modify: `TuS/Views/Match/MatchHomeView.swift`
- Modify: `TuS/Views/Match/MatchMapView.swift`
- Modify: `TuS/Views/Pet/PetTabView.swift`
- Create: `TuSTests/FullDesignAssetUsageTests.swift`

**Interfaces:**

- Consumes: `UIAsset`, existing `MockDataStore.homeOverview`, existing Little Energy mood/outfit state, existing navigation destinations.
- Produces: image-backed Home, Square, Complaint Detail, Publish, Messages, Profile, Mood Check-in, AI Insight, Colleague, and Settings screen families.

- [ ] **Step 1: Write the failing usage scan test**

The test reads manifest-required screen mappings and asserts each listed iOS consumer contains `UIAsset.<case>`; it also rejects `Image(systemName:)` and hard-coded icon emoji within mapped components, excluding device/runtime and dynamic content.

- [ ] **Step 2: Run RED structurally**

On Windows, run a Node/static companion scan and confirm it reports current SF Symbols/emoji. Ensure `FullDesignAssetUsageTests.swift` is in the XCTest Sources phase for macOS CI.

- [ ] **Step 3: Apply backgrounds and navigation**

Use `ui_bg_app_soft` as an aspect-fill background behind scroll content, `ui_decor_home_hero` behind the existing outfit-aware Little Energy hero, and the five `ui_nav_*` assets in `ContentView`. Preserve the center compose sheet behavior and unread badge.

- [ ] **Step 4: Apply Home/Square/Detail/Publish images**

Replace all mapped stats, actions, anonymous avatar, menu, search/back/more, and interaction icons with the manifest assets. Preserve likes, comments, shares, filters, compose, quick mood check-in, and overview refresh behavior.

- [ ] **Step 5: Apply Messages/Profile/Mood/AI/Colleague/Settings images**

Replace mapped system conversation, profile shortcut, tool, list, level, action, and chevron icons. Keep dynamic photos and the 27 mood images. Do not apply clothing to `dark-colleague`.

- [ ] **Step 6: Run static and XCTest gates**

Run the static companion scan locally. Task 8 runs the macOS workflow with the XCTest target enabled; expected zero missing use, zero banned substitutes in mapped slots, and successful Swift compile.

- [ ] **Step 7: Commit**

```bash
git add TuS TuSTests TuS.xcodeproj/project.pbxproj
git commit -m "feat(ios): apply full product image system"
```

### Task 7: Apply all assets to Windows desktop screens

**Files:**

- Modify: `win-app/src/views.js`
- Modify: `win-app/src/style.css`
- Modify: `win-app/test-ui-assets.js`
- Modify: `win-app/smoke-ui.js`

**Interfaces:**

- Consumes: `uiAsset(name)` and `uiIcon(name, className)` from Task 5.
- Produces: image-backed desktop equivalents of all ten screen families without mobile bottom navigation.

- [ ] **Step 1: Write failing DOM/source tests**

Assert each manifest Windows consumer renders the expected PNG path; reject inline SVG, emoji-as-icon, and CSS-drawn replacements in mapped slots; assert the desktop sidebar remains and no mobile bottom nav is added.

- [ ] **Step 2: Run RED**

Run: `node win-app/test-ui-assets.js --windows-usage`

Expected: FAIL with existing emoji/system substitute locations.

- [ ] **Step 3: Replace screen assets and style them**

Use 18–22px line icons for actions/nav, 34–40px colorful feature icons, 48px system-message icons, and 16px chevrons. Apply `ui_bg_app_soft` to the desktop content surface and `ui_decor_home_hero` only behind the current Little Energy hero. Keep sidebar, top search, wide cards, two-column dashboards, and desktop modals.

- [ ] **Step 4: Verify behavior and responsive layout**

Run:

```bash
node win-app/test-ui-assets.js --windows-usage
node win-app/test-little-energy-regressions.js
node win-app/test-core.js
node win-app/test-v2.js
node win-app/test-v2b.js
node win-app/test-v3.js
node win-app/test-v3b.js
node win-app/smoke-ui.js
```

Expected: all source/DOM checks pass; legacy remote API failures must be rerun against the local current server before acceptance.

- [ ] **Step 5: Commit**

```bash
git add win-app/src win-app/test-ui-assets.js win-app/smoke-ui.js
git commit -m "feat(windows): apply full product image system"
```

### Task 8: Design QA, full verification, packaging, and GitHub release

**Files:**

- Create: `design-qa.md`
- Create: `artifacts/design-qa/reference-board.jpg`
- Create: `artifacts/design-qa/ios-home.png`, `ios-square.png`, `ios-complaint-detail.png`, `ios-publish.png`, `ios-messages.png`, `ios-profile.png`, `ios-mood.png`, `ios-ai.png`, `ios-colleagues.png`, `ios-settings.png`
- Create: `artifacts/design-qa/windows-1100x760.png`, `windows-minimum.png`
- Modify: `win-app/package.json` and lockfile to version 2.1.3.
- Modify: release notes used by the repository.
- Modify: `.github/workflows/build-ipa.yml` to run the `TuSTests` target before the existing unsigned Release build; do not weaken any build gate.

**Interfaces:**

- Consumes: complete manifest, synchronized assets, all screen implementations.
- Produces: passed design QA, iOS build artifact, Windows 2.1.3 portable/NSIS binaries, GitHub main/release.

- [ ] **Step 1: Verify canonical and platform assets from a clean checkout**

Run `npm ci --prefix win-app`, sync assets, and execute full `test-ui-assets.js`. Delete no generated source assets; prove sync is idempotent with a clean `git status` after the second run.

- [ ] **Step 2: Run server and Windows suites**

Start the seeded local server and run server smoke plus all Windows tests and `win-app/verify-launch.ps1`. Install/launch both unpacked and packaged outputs and confirm Splash settles to login/home.

- [ ] **Step 3: Run iOS tests and Release arm64 build**

Push the branch or dispatch `.github/workflows/build-ipa.yml` on macOS. Require TuSTests execution, `Release-iphoneos` compile success, and an unsigned IPA artifact. Fix compile/test failures before QA is marked passed.

- [ ] **Step 4: Perform blocking visual QA**

Capture the same state/viewport for all ten iOS screen families and Windows at 1100×760/minimum width. Compare the reference and implementation together. Write `design-qa.md` with P0–P3 findings; fix all P0/P1/P2 and repeat captures until the final line is exactly `final result: passed`.

- [ ] **Step 5: Run final review and verification skills**

Use `superpowers:requesting-code-review`, fix blocking findings, then use `superpowers:verification-before-completion` and rerun affected tests/builds.

- [ ] **Step 6: Package Windows 2.1.3**

Update version and run:

```bash
npm run pack --prefix win-app
npm run dist --prefix win-app
```

Verify both `职场那些事 2.1.3.exe` and `职场那些事 Setup 2.1.3.exe` launch and display the new assets.

- [ ] **Step 7: Publish**

Merge or fast-forward verified commits to `main`, push GitHub, publish Windows release tag `win-v2.1.3` with portable and NSIS files, and confirm the iOS workflow artifact is attached/available. Report 39 icon paths, two backgrounds, ten-screen mapping, test/build links, release links, and unresolved P3-only polish.

- [ ] **Step 8: Commit release metadata**

```bash
git add design-qa.md artifacts/design-qa win-app/package.json win-app/package-lock.json .github/workflows/build-ipa.yml
git commit -m "chore(release): publish full product image system"
```

## Definition of Done

- Exactly 39 icon PNGs and two background/decor PNGs pass canonical, iOS, Windows, alpha, dimension, duplication, and consumer checks.
- All ten iOS screen families use the approved assets and match the reference at the same states/viewports.
- Windows uses the same assets in a desktop-native layout and has no infinite loading or mobile bottom navigation.
- Existing Little Energy mood/outfit/dark-colleague rules and all product interactions remain correct.
- `design-qa.md` ends in `final result: passed`; server, Windows, XCTest, iOS Release, and packaged-launch checks pass.
- GitHub `main`, iOS artifact, and Windows `win-v2.1.3` release are published.
