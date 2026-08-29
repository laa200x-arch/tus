# 小能仔完整造型与资料页修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除服装散件遮挡小能仔的问题，在 iOS 与 Windows 使用统一的完整造型渲染，并清理首页和“我的”中的重复内容。

**Architecture:** 保持后端的 `littleEnergyOutfit` 字段不变；客户端把旧的上衣、下装、鞋子组合确定性解析成一个 `LittleEnergyLook`。用户头像只渲染情绪底图与单张完整造型壳，黑化同事永远走独立角色资源。换装页使用每套造型的四视角角色 PNG，通过拖动切换视角而非叠加服装商品图。

**Tech Stack:** SwiftUI / XCTest、Electron 原生 JavaScript / Node `assert`、PNG asset catalogs、现有 Node API 与本地资料持久化。

**Spec:** 用户 2026-08-29 截图反馈与确认的“整套造型 + 四视角可拖动预览”方案。

## Global Constraints

- 保留 27 个稳定情绪 ID 与现有 `littleEnergyOutfit` API 合约。
- 黑化小能仔仅用于被吐槽同事，永不接受用户服装。
- 所有角色视觉只能消费完整角色资源或情绪底图加单张完整造型壳；禁止渲染旧服装散件。
- iOS 使用规范 SF Symbols 作为底栏图标；Windows 保持桌面导航而非复制 iOS 底栏。
- 不删除后端头像或信用分字段，仅从“我的 / 编辑资料”界面移除重复头像和信用分。

---

### Task 1: 定义完整造型解析器与回归契约

**Files:**
- Modify: `TuS/Models/LittleEnergyModels.swift`
- Modify: `TuSTests/LittleEnergyModelsTests.swift`
- Modify: `win-app/src/little-energy.js`
- Modify: `win-app/test-little-energy.js`
- Modify: `win-app/test-little-energy-layer-layout.js`

**Interfaces:**
- Produces Swift `LittleEnergyLook.resolve(outfit:) -> LittleEnergyLook` and `outfitAssetName` / `turntableAssetName(angle:)`.
- Produces JS `resolveLook(outfit)` and `littleEnergyAssetSources(moodId, outfit)` with no `outfits/tops|bottoms|shoes|accessories` paths.
- Consumes existing `LittleEnergyOutfit.normalized` and 27 mood catalog IDs.

- [ ] **Step 1: Write failing tests**

```swift
func testLegacyOutfitResolvesToOneWholeLook() {
    XCTAssertEqual(LittleEnergyLook.resolve(outfit: .default).id, "commute")
    XCTAssertEqual(LittleEnergyLook.resolve(outfit: LittleEnergyOutfit(topId: "top_hoodie")).id, "casual")
}
```

```js
assert.equal(L.resolveLook({ topId: 'top_hoodie' }).id, 'casual')
assert.doesNotMatch(L.littleEnergyAvatarHtml({ outfit: {} }), /outfits\/(tops|bottoms|shoes|accessories)/)
```

- [ ] **Step 2: Run tests and confirm they fail because the resolver does not exist.**
- [ ] **Step 3: Add five look presets (`commute`, `casual`, `professional`, `campus`, `street`) and one resolver based on the existing normalized `topId`.**
- [ ] **Step 4: Replace per-item layer source emission with a single complete-look source.**
- [ ] **Step 5: Run XCTest and all Windows Little Energy tests; commit the contract change.**

### Task 2: Produce and install complete Little Energy look assets

**Files:**
- Create: `win-app/assets/little-energy/looks/<look>-front.png`
- Create: `win-app/assets/little-energy/looks/<look>-left.png`
- Create: `win-app/assets/little-energy/looks/<look>-back.png`
- Create: `win-app/assets/little-energy/looks/<look>-right.png`
- Create: matching `TuS/Assets.xcassets/LittleEnergy/looks/*.imageset/` resources
- Modify: asset copy/synchronization script when required by the existing asset workflow

**Interfaces:**
- Each look has four transparent-background full-body PNGs in consistent square framing.
- The front asset is the avatar shell used in app-wide user rendering.

- [ ] **Step 1: Generate complete full-body Little Energy looks with the provided outfit reference; inspect the outputs against the reference.**
- [ ] **Step 2: Split each four-angle turntable into named transparent PNG files and place the canonical copies in Windows assets.**
- [ ] **Step 3: Sync the same bytes to Xcode asset catalogs.**
- [ ] **Step 4: Verify image dimensions, alpha channel, and all expected front/left/back/right files.**

### Task 3: Make the iOS avatar and editable preview render one integrated character

**Files:**
- Modify: `TuS/Views/Components/LittleEnergyAvatarView.swift`
- Modify: `TuS/Views/Profile/ProfileEditView.swift`
- Modify: `TuSTests/LittleEnergyModelsTests.swift`

**Interfaces:**
- `LittleEnergyAvatarView` renders mood + one resolved whole-look overlay for users, or only `dark-colleague` for colleague role.
- `LittleEnergyTurntableView` accepts a `LittleEnergyOutfit` binding/value and changes its current angle from horizontal drag.

- [ ] **Step 1: Write a failing model/view-source regression test that rejects old outfit item layer references.**
- [ ] **Step 2: Render only one look-shell image after the emotion base; keep the dark-colleague branch independent.**
- [ ] **Step 3: Replace per-part controls in Edit Profile with five complete-look choices and a drag-controlled four-angle preview.**
- [ ] **Step 4: Persist a chosen look by writing its canonical existing outfit structure via the current profile update path.**
- [ ] **Step 5: Run iOS unit tests and compile the app target.**

### Task 4: Remove duplicate profile UI and repeated home statistics on iOS

**Files:**
- Modify: `TuS/Views/Profile/MineView.swift`
- Modify: `TuS/Views/Profile/ProfileEditView.swift`
- Modify: `TuS/Views/Home/HomeOverviewView.swift`
- Modify: `TuS/App/ContentView.swift`

**Interfaces:**
- Mine header contains exactly one Little Energy avatar and no credit ring/photo picker.
- Home overview has hero, mood check-in, latest complaint, and personality; it does not instantiate `HomeStatsGrid`.
- Bottom tab items use SF Symbols only and have fixed normal/central sizing.

- [ ] **Step 1: Add source-level regression assertions for single profile avatar and no home stats grid.**
- [ ] **Step 2: Remove avatar upload and credit-ring presentation from Mine and avatar section from Edit Profile.**
- [ ] **Step 3: Remove `HomeStatsGrid` from both normal and loading home paths.**
- [ ] **Step 4: Correct bottom navigation icon assets/sizing to native SF Symbols without custom raster layers.**
- [ ] **Step 5: Build iOS release configuration and resolve every compiler error.**

### Task 5: Apply the same data and visual rules to Windows without copying mobile navigation

**Files:**
- Modify: `win-app/src/little-energy.js`
- Modify: `win-app/src/views.js`
- Modify: `win-app/src/style.css`
- Modify: `win-app/test-home-overview.js`
- Modify: `win-app/test-little-energy*.js`

**Interfaces:**
- Windows avatar HTML contains at most emotion + whole-look image for a user.
- Dashboard no longer renders the four repeated quick-stat cards.
- Profile edit shows a desktop-friendly click preset selector plus drag/pointer turntable preview; desktop sidebar remains intact.

- [ ] **Step 1: Write failing DOM/source tests for no scattered outfit paths and no `renderHomeStats()` on the dashboard output.**
- [ ] **Step 2: Update renderer, dashboard, and profile edit interactions to use `resolveLook`.**
- [ ] **Step 3: Update CSS for whole-avatar framing and the turntable only; delete old per-layer calibration rules.**
- [ ] **Step 4: Run all Windows node tests and the Electron smoke test.**

### Task 6: Visual QA, release checks, and publication

**Files:**
- Modify: `design-qa.md`
- Create: `artifacts/design-qa/<timestamp>-comparison.png`

- [ ] **Step 1: Capture updated Windows home/profile and iOS simulator or build evidence in the same states as the user screenshots.**
- [ ] **Step 2: Compare each capture side-by-side with the supplied references and record visual findings; fix P0/P1/P2 issues.**
- [ ] **Step 3: Run final Windows tests, Electron package build, iOS test/build, and image-asset validation.**
- [ ] **Step 4: Review the full diff, commit with a focused message, push the isolated branch, merge/push to `main`, and report any platform-specific release limitations.**
