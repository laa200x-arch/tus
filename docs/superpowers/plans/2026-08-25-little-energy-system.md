# 小能仔统一视觉、情绪同步、换装与聊天 Emoji Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 iOS 与 Windows 两端交付统一的小能仔角色系统、27 种全局同步情绪、分部件换装和聊天自定义 Emoji，并兼容现有数据。

**Architecture:** 服务端共享模块定义唯一的情绪与服装 ID，并由接口返回给两端；每日打卡与用户资料仍分别作为情绪和穿搭的唯一数据源。客户端打包同名本地图片资源，通过统一角色组件渲染情绪、穿搭和黑化同事，聊天复用现有媒体消息字段保存 Emoji ID。

**Tech Stack:** Swift 5.9 / SwiftUI / iOS 16+；Electron 31 / 原生 JavaScript / CSS；Node.js 20 / Express / SQLite / MySQL；GitHub Actions / Xcode。

**Spec:** `docs/superpowers/specs/2026-08-25-little-energy-system-design.md`

## Global Constraints

- iOS 与 Windows 两端必须共享完全相同的 27 个情绪 ID、中文名、分值和资源名。
- 今日情绪只能来自 `mood_checkins`；不得在用户表中复制当天情绪。
- 穿搭只能来自用户资料中的一份结构化配置；客户端状态只是缓存。
- 黑化小能仔只能用于被吐槽同事，不能进入用户换装或用户情绪。
- 新客户端保存稳定 ID，服务端继续接受并规范化历史 6 种系统 Emoji。
- 不引入新的前端框架或第三方状态管理库。
- 每个生产行为先有能正确失败的测试，再写最小实现。

---

## File Map

- `server/src/little-energy.js`：跨接口共享的 27 情绪、服装目录、规范化和校验函数。
- `server/test/little-energy.test.mjs`：纯函数、资料、打卡和聊天协议回归测试。
- `server/src/schema.js`、`server/src/index.js`：穿搭字段 DDL 与幂等迁移。
- `server/src/middleware.js`、`server/src/routes/profile.js`：用户穿搭序列化与更新。
- `server/src/routes/tags-dict.js`、`server/src/routes/mood.js`：27 情绪字典、打卡规范化、趋势和总结。
- `server/src/routes/chat.js`、`server/src/socket.js`：小能仔 Emoji 消息校验。
- `shared/little-energy/catalog.json`：供资源校验和两端生成/同步定义使用的规范清单。
- `tools/verify-little-energy-assets.mjs`：检查共享清单与两端资源完整性。
- `TuS/Models/LittleEnergyModels.swift`：iOS 情绪、穿搭模型和清单。
- `TuS/Views/Components/LittleEnergyAvatarView.swift`：iOS 统一角色渲染组件。
- `TuS/Assets.xcassets/LittleEnergy/*`：iOS 角色、情绪、黑化同事和换装图片。
- `TuS/Models/SkillModel.swift`、`TuS/Models/ServerModels.swift`：用户穿搭数据契约。
- `TuS/Services/APIClient.swift`、`TuS/Services/MockDataStore.swift`：资料、情绪和 Emoji 的全局状态流。
- `TuS/Views/Match/MatchHomeView.swift`：首页角色和 27 情绪打卡。
- `TuS/Views/Profile/ProfileEditView.swift`、`TuS/Views/Profile/MineView.swift`、`TuS/Views/Profile/UserProfileView.swift`：换装与用户展示。
- `TuS/Views/Chat/MessageView.swift`：Emoji 面板和消息气泡。
- `win-app/src/little-energy.js`、`win-app/src/style.css`：Windows 清单、渲染函数和样式。
- `win-app/assets/little-energy/*`：Windows 本地角色资源。
- `win-app/src/api.js`、`win-app/src/app.js`、`win-app/src/views.js`：Windows 状态、换装、打卡和聊天 Emoji。
- `win-app/test-little-energy.js`：Windows 映射和渲染单元测试。

---

### Task 1: 建立共享目录和资源验证器

**Files:**
- Create: `shared/little-energy/catalog.json`
- Create: `tools/verify-little-energy-assets.mjs`
- Create: `server/src/little-energy.js`
- Create: `server/test/little-energy.test.mjs`
- Modify: `server/package.json`

**Interfaces:**
- Produces: `MOODS`, `OUTFIT_CATALOG`, `DEFAULT_OUTFIT`, `normalizeMood(value)`, `normalizeOutfit(value)`, `isLittleEnergyEmoji(value)`。
- Produces: `npm run test:little-energy` 和 `node tools/verify-little-energy-assets.mjs`。

- [ ] **Step 1: 写目录纯函数的失败测试**

```js
import assert from 'node:assert/strict'
import { MOODS, normalizeMood, normalizeOutfit, isLittleEnergyEmoji } from '../src/little-energy.js'

assert.equal(MOODS.length, 27)
assert.equal(new Set(MOODS.map((m) => m.id)).size, 27)
assert.equal(normalizeMood('😄'), 'xnz_happy')
assert.equal(normalizeMood('xnz_angry'), 'xnz_angry')
assert.equal(normalizeMood('unknown'), 'xnz_happy')
assert.deepEqual(normalizeOutfit({ topId: 'bad' }), {
  topId: 'top_tshirt', bottomId: 'bottom_slacks', shoesId: 'shoes_sneakers', accessoryIds: []
})
assert.equal(isLittleEnergyEmoji('xnz_grateful'), true)
assert.equal(isLittleEnergyEmoji('../bad.png'), false)
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `cd server && node test/little-energy.test.mjs`

Expected: FAIL，错误包含 `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 写最小共享目录与规范化函数**

创建 27 项 JSON 目录，每项包含 `id`、`label`、`legacyEmoji`、`score`、`assetName`、`fallbackText`；创建服装四分类白名单和默认穿搭。`server/src/little-energy.js` 读取同一份值并实现白名单规范化，未知值回退默认值，不允许路径字符串。

- [ ] **Step 4: 增加资源验证器**

验证器读取 `catalog.json`，断言 27 个 ID 唯一，并检查：

```js
const required = [
  ...catalog.moods.flatMap((m) => [
    `win-app/assets/little-energy/emotions/${m.assetName}.png`,
    `TuS/Assets.xcassets/LittleEnergy/${m.assetName}.imageset/Contents.json`
  ]),
  'win-app/assets/little-energy/colleague/dark-colleague.png',
  'TuS/Assets.xcassets/LittleEnergy/dark-colleague.imageset/Contents.json'
]
```

支持 `--catalog-only`，使资源制作前可先验证定义。

- [ ] **Step 5: 运行目录测试至通过**

Run: `cd server && npm run test:little-energy`

Expected: PASS，输出 27 项目录及所有规范化断言通过。

- [ ] **Step 6: 提交**

```bash
git add shared/little-energy/catalog.json tools/verify-little-energy-assets.mjs server/src/little-energy.js server/test/little-energy.test.mjs server/package.json
git commit -m "feat: define little energy catalog"
```

---

### Task 2: 扩展服务端穿搭资料与 27 情绪协议

**Files:**
- Modify: `server/src/schema.js`
- Modify: `server/src/index.js`
- Modify: `server/src/middleware.js`
- Modify: `server/src/routes/profile.js`
- Modify: `server/src/routes/tags-dict.js`
- Modify: `server/src/routes/mood.js`
- Modify: `server/test/little-energy.test.mjs`
- Modify: `win-app/test-v2.js`

**Interfaces:**
- Consumes: `normalizeMood`, `normalizeOutfit`, `MOODS` from Task 1。
- Produces: `user.littleEnergyOutfit`；`PUT /api/me/profile` 接受 `littleEnergyOutfit`；情绪接口统一返回稳定 ID。

- [ ] **Step 1: 写失败的接口测试**

在测试服务器上登录演示账号并断言：

```js
const update = await api('/api/me/profile', {
  method: 'PUT', token,
  body: { littleEnergyOutfit: {
    topId: 'top_hoodie', bottomId: 'bottom_jeans',
    shoesId: 'shoes_canvas', accessoryIds: ['accessory_headphones']
  }}
})
assert.equal(update.status, 200)
assert.equal(update.data.user.littleEnergyOutfit.topId, 'top_hoodie')

const checkin = await api('/api/mood/checkin', {
  method: 'POST', token, body: { mood: 'xnz_grateful', stressSources: [], note: '' }
})
assert.equal(checkin.data.mood, 'xnz_grateful')
assert.equal((await api('/api/tags')).data.moods.length, 27)
```

另测非法服装回退、非法情绪返回 400、旧 `😐` 被规范化。

- [ ] **Step 2: 运行测试并确认资料字段和 27 情绪断言失败**

Run: `cd server && npm run test:little-energy`

Expected: FAIL，缺少 `littleEnergyOutfit` 或字典仍为 6 项。

- [ ] **Step 3: 增加幂等数据库迁移**

SQLite `users` 增加 `little_energy_outfit TEXT`，MySQL 增加 `little_energy_outfit TEXT NULL`；`server/src/index.js` 启动时执行幂等 `ALTER TABLE users ADD COLUMN little_energy_outfit TEXT`。

- [ ] **Step 4: 扩展用户序列化和资料更新**

`serializeUser` 将 JSON 字段解析并通过 `normalizeOutfit`；资料更新接口只接受对象，规范化后 `JSON.stringify` 保存。其他用户接口因复用 `serializeUser` 自动返回穿搭。

- [ ] **Step 5: 替换情绪字典和 mood 路由硬编码**

`tags-dict.js` 导出 27 项；打卡写入规范化 ID；今日和趋势读取时规范化旧值；AI 总结按 `MOODS.score` 判断低情绪，不再使用旧 Emoji Set。

- [ ] **Step 6: 更新 Windows 现有 v2 契约断言**

将 `dict.moods.length === 6` 改为 27；打卡测试使用 `xnz_tired`、`xnz_calm`，并保留一条旧 Emoji 兼容断言。

- [ ] **Step 7: 运行服务端测试至通过**

Run: `cd server && npm run test:little-energy && npm run test:unit`

Expected: PASS。

- [ ] **Step 8: 提交**

```bash
git add server/src/schema.js server/src/index.js server/src/middleware.js server/src/routes/profile.js server/src/routes/tags-dict.js server/src/routes/mood.js server/test/little-energy.test.mjs win-app/test-v2.js
git commit -m "feat: persist outfits and support 27 moods"
```

---

### Task 3: 支持聊天小能仔 Emoji 协议

**Files:**
- Modify: `server/src/routes/chat.js`
- Modify: `server/src/socket.js`
- Modify: `server/test/little-energy.test.mjs`
- Modify: `server/test/smoke.mjs`

**Interfaces:**
- Consumes: `isLittleEnergyEmoji(id)` 与目录标签。
- Produces: `mediaType="little_energy_emoji"`、`mediaUrl=<mood id>`、`text="[小能仔·名称]"` 的 REST 与 Socket 消息。

- [ ] **Step 1: 写 REST 与 Socket 失败测试**

```js
const sent = await api('/api/messages', {
  method: 'POST', token,
  body: { conversationId, text: '', mediaType: 'little_energy_emoji', mediaUrl: 'xnz_happy' }
})
assert.equal(sent.status, 201)
assert.equal(sent.data.message.mediaUrl, 'xnz_happy')
assert.equal(sent.data.message.text, '[小能仔·开心]')

const invalid = await api('/api/messages', {
  method: 'POST', token,
  body: { conversationId, mediaType: 'little_energy_emoji', mediaUrl: '../bad.png' }
})
assert.equal(invalid.status, 400)
```

Socket 测试发送相同 payload，并断言双方收到同一 `mediaType/mediaUrl/text`。

- [ ] **Step 2: 运行测试并确认空文本或媒体白名单导致失败**

Run: `cd server && npm run test:little-energy`

Expected: FAIL，接口未识别 `little_energy_emoji`。

- [ ] **Step 3: 在 REST 保存路径加入 Emoji 规范化**

Emoji 消息必须命中白名单；服务端根据目录生成兼容文本，不信任客户端提供的文本。其他媒体与风控流程保持不变。

- [ ] **Step 4: 在 Socket 保存路径复用同一校验**

将协议规范化抽到聊天保存函数或共享 helper，确保 REST 与 Socket 不出现两套行为。

- [ ] **Step 5: 运行聊天和现有后端回归**

Run: `cd server && npm run test:little-energy && npm test`

Expected: PASS，现有文字消息风控、媒体消息和实时消息不回归。

- [ ] **Step 6: 提交**

```bash
git add server/src/routes/chat.js server/src/socket.js server/test/little-energy.test.mjs server/test/smoke.mjs
git commit -m "feat: add little energy chat emoji protocol"
```

---

### Task 4: 制作并校验跨端小能仔图片资源

**Files:**
- Create: `work/little-energy-source/*`（不提交，仅制作过程）
- Create: `win-app/assets/little-energy/emotions/*.png`
- Create: `win-app/assets/little-energy/outfits/{tops,bottoms,shoes,accessories}/*.png`
- Create: `win-app/assets/little-energy/colleague/dark-colleague.png`
- Create: `TuS/Assets.xcassets/LittleEnergy/**/*.imageset/*`
- Modify: `TuS.xcodeproj/project.pbxproj`（仅在资源目录未被自动包含时）

**Interfaces:**
- Consumes: Task 1 的 `assetName` 和服装 ID。
- Produces: 两端同名透明 PNG；情绪资源固定画布，服装图层固定锚点。

- [ ] **Step 1: 运行完整资源检查并确认缺失失败**

Run: `node tools/verify-little-energy-assets.mjs`

Expected: FAIL，逐项列出尚未制作的两端资源。

- [ ] **Step 2: 使用 imagegen 技能基于四张参考图制作正常情绪和黑化同事资源**

要求：透明背景、角色比例统一、紫蓝材质一致、无文字无编号；黑化同事单独导出且不能复用为用户服装。

- [ ] **Step 3: 制作分层服装资源**

按共享目录导出上衣、下装、鞋子和配饰；所有图层使用同一画布、角色中心和脚底基线。为会遮挡身体的单品保留透明区域，不把基础身体烘焙进服装层。

- [ ] **Step 4: 生成 iOS imageset 与 Windows 文件树**

每个 iOS imageset 的 `Contents.json` 指向对应 1x PNG；Windows 使用同名 PNG。不得提交参考图原始临时路径或中间白底拼图。

- [ ] **Step 5: 运行资源检查至通过并抽样视觉检查**

Run: `node tools/verify-little-energy-assets.mjs`

Expected: PASS，27 个情绪和所有目录单品在两端齐全。抽查开心、愤怒、困倦、默认穿搭、帽子叠加和黑化同事。

- [ ] **Step 6: 提交**

```bash
git add win-app/assets/little-energy TuS/Assets.xcassets/LittleEnergy TuS.xcodeproj/project.pbxproj
git commit -m "feat: add little energy character assets"
```

---

### Task 5: 接入 iOS 模型、全局状态与统一角色组件

**Files:**
- Create: `TuS/Models/LittleEnergyModels.swift`
- Create: `TuS/Views/Components/LittleEnergyAvatarView.swift`
- Modify: `TuS/Models/SkillModel.swift`
- Modify: `TuS/Models/ServerModels.swift`
- Modify: `TuS/Services/APIClient.swift`
- Modify: `TuS/Services/MockDataStore.swift`
- Modify: `TuS.xcodeproj/project.pbxproj`
- Create: `TuSTests/LittleEnergyModelsTests.swift`（若仓库无测试 target，则先加入最小 `TuSTests` target）

**Interfaces:**
- Produces: `LittleEnergyMood`, `LittleEnergyOutfit`, `LittleEnergyCatalog`。
- Produces: `LittleEnergyAvatarView(moodID:outfit:role:size:)`，`role` 为 `.user` 或 `.darkColleague`。
- Produces: `MockDataStore.currentMoodID` 从 `moodToday` 派生；`updateProfile(...littleEnergyOutfit:)`。

- [ ] **Step 1: 写 iOS 模型与回退规则失败测试**

```swift
func testLegacyMoodMapsToStableID() {
    XCTAssertEqual(LittleEnergyCatalog.normalizeMood("😄"), "xnz_happy")
}

func testUnknownOutfitFallsBackToDefaults() {
    let outfit = LittleEnergyOutfit(topId: "bad", bottomId: nil, shoesId: nil, accessoryIds: ["../x"])
    XCTAssertEqual(outfit.normalized, .default)
}
```

- [ ] **Step 2: 运行测试并确认类型不存在而失败**

Run（macOS/GitHub Actions）: `xcodebuild test -project TuS.xcodeproj -scheme TuS -destination 'platform=iOS Simulator,name=iPhone 15'`

Expected: FAIL，缺少 `LittleEnergyCatalog`。

- [ ] **Step 3: 实现模型、Codable 契约和用户资料字段**

`ServerUser` 与 `UserModel` 增加 `littleEnergyOutfit`；旧响应缺字段时使用默认值。API 更新资料时将结构体编码为字典；Store 仅在服务器成功响应后替换 `currentUser`。

- [ ] **Step 4: 实现统一角色组件**

`.user` 按基础、情绪、上衣、下装、鞋子、配饰层级用 `ZStack` 合成；`.darkColleague` 只显示黑化资源。任何未知图片名回退默认资源。

- [ ] **Step 5: 让打卡成功立即更新全局状态**

保持 `moodToday` 为唯一状态；新增只读 `currentMoodID`。快速与完整打卡继续调用 `checkinMood`，成功响应写入 `moodToday`，不另存 `@AppStorage`。

- [ ] **Step 6: 运行 iOS 测试/静态检查**

Run: `xcodebuild test ...`（GitHub Actions）或当前环境先运行 `node tools/verify-little-energy-assets.mjs` 与项目文件引用检查。

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add TuS/Models TuS/Views/Components/LittleEnergyAvatarView.swift TuS/Services TuSTests TuS.xcodeproj/project.pbxproj
git commit -m "feat: add ios little energy state and renderer"
```

---

### Task 6: 接入 iOS 首页、27 情绪、换装与聊天 Emoji

**Files:**
- Modify: `TuS/Views/Match/MatchHomeView.swift`
- Modify: `TuS/Views/Profile/ProfileEditView.swift`
- Modify: `TuS/Views/Profile/MineView.swift`
- Modify: `TuS/Views/Profile/UserProfileView.swift`
- Modify: `TuS/Views/Chat/MessageView.swift`
- Modify: `TuS/Views/Components/Components.swift`
- Modify: `TuSTests/LittleEnergyModelsTests.swift`

**Interfaces:**
- Consumes: Task 5 的模型、Store 和 `LittleEnergyAvatarView`。
- Produces: 27 项打卡网格、分部件换装编辑器、聊天 Emoji 面板和气泡。

- [ ] **Step 1: 写 UI 派生逻辑失败测试**

测试 `MoodCheckinSelection.items.count == 27`、服装草稿只有保存成功才写回用户、Emoji payload 为：

```swift
XCTAssertEqual(ChatEmojiPayload(id: "xnz_happy").mediaType, "little_energy_emoji")
XCTAssertEqual(ChatEmojiPayload(id: "xnz_happy").fallbackText, "[小能仔·开心]")
```

- [ ] **Step 2: 运行测试并确认新派生类型不存在而失败**

Run: `xcodebuild test ...`

Expected: FAIL。

- [ ] **Step 3: 修改首页和情绪界面**

首页顶部显示当前用户穿搭与 `store.currentMoodID`；快速选择使用 27 项可滚动网格，完整打卡复用同一目录。AI 人格和情绪展示用小能仔组件替换系统 Emoji，趋势仍保留现有布局。

- [ ] **Step 4: 实现编辑资料换装器**

使用四个分类 Tab、实时预览和“无配饰”；状态初始化自 `currentUser.littleEnergyOutfit`。保存时与昵称/简介一并调用现有更新资料流程，失败不写回全局。

- [ ] **Step 5: 替换用户与同事角色引用**

当前用户和正常用户卡片使用正常小能仔；被吐槽同事相关组件显式传 `.darkColleague`。保留用户上传头像优先级的页面需按产品规则选择：小能仔角色位使用小能仔，真实头像位继续显示照片。

- [ ] **Step 6: 实现聊天 Emoji 面板和消息气泡**

输入工具栏增加 Emoji 按钮；点击 27 项之一调用 `sendMediaMessage(mediaType:"little_energy_emoji", mediaUrl:id, text:fallback)`。气泡优先识别该类型并渲染本地情绪图；对方旧消息只有 fallback 文本时仍按文字显示。

- [ ] **Step 7: 运行 iOS 测试和资源检查**

Run: `node tools/verify-little-energy-assets.mjs`；GitHub Actions 运行 `xcodebuild test/build`。

Expected: PASS。

- [ ] **Step 8: 提交**

```bash
git add TuS/Views TuSTests/LittleEnergyModelsTests.swift
git commit -m "feat: integrate little energy across ios"
```

---

### Task 7: 接入 Windows 状态、角色、换装与聊天 Emoji

**Files:**
- Create: `win-app/src/little-energy.js`
- Create: `win-app/test-little-energy.js`
- Modify: `win-app/src/index.html`
- Modify: `win-app/src/app.js`
- Modify: `win-app/src/api.js`
- Modify: `win-app/src/views.js`
- Modify: `win-app/src/style.css`

**Interfaces:**
- Produces: `normalizeMood`, `normalizeOutfit`, `littleEnergyAvatarHtml`, `littleEnergyEmojiPayload`。
- Consumes: 服务端 `user.littleEnergyOutfit`、今日 `mood` 与聊天媒体协议。

- [ ] **Step 1: 写 Windows 失败测试**

```js
const L = require('./src/little-energy.js')
OK('catalog has 27 moods', L.MOODS.length === 27)
OK('legacy mood normalized', L.normalizeMood('😄') === 'xnz_happy')
OK('dark colleague isolated', L.littleEnergyAvatarHtml({ role: 'darkColleague' }).includes('dark-colleague.png'))
OK('emoji payload', L.littleEnergyEmojiPayload('xnz_happy').mediaType === 'little_energy_emoji')
```

- [ ] **Step 2: 运行测试并确认模块不存在而失败**

Run: `cd win-app && node test-little-energy.js`

Expected: FAIL，`MODULE_NOT_FOUND`。

- [ ] **Step 3: 实现 Windows 目录模块与 API 状态更新**

模块导出与服务端一致的目录；`updateProfile` 接受 `littleEnergyOutfit`；`checkinMood` 成功后更新 `App.state.moodToday`，首页重渲染从该状态读取。

- [ ] **Step 4: 接入首页、情绪和人格显示**

首页顶部增加统一角色；快速打卡和弹窗显示 27 项图片网格；趋势图按目录 score 计算 y 坐标；人格卡的系统 Emoji 替换为小能仔或黑化同事规则。

- [ ] **Step 5: 接入我的页换装器**

编辑资料弹窗增加四分类单品选择和实时预览；保存成功更新 `App.state.user` 并刷新我的页，失败保留草稿。

- [ ] **Step 6: 接入聊天 Emoji**

输入区增加 Emoji 面板；发送 `sendMessageRest(conv.id, fallback, 'little_energy_emoji', id)`；消息渲染器识别该类型并生成本地 `<img>`，会话摘要显示 fallback 文本。

- [ ] **Step 7: 替换同事黑化角色引用并补样式**

被吐槽同事卡片和同事人格使用黑化资源；用户卡和当前用户仍使用正常资源与穿搭。CSS 保持现有布局，仅增加角色层叠、情绪网格、换装网格和 Emoji 面板样式。

- [ ] **Step 8: 运行 Windows 测试**

Run:

```bash
cd win-app
node test-little-energy.js
node test-core.js
node test-v2.js
node test-v2b.js
node test-v3.js
node test-v3b.js
```

Expected: 全部 PASS。

- [ ] **Step 9: 提交**

```bash
git add win-app/src win-app/test-little-energy.js
git commit -m "feat: integrate little energy across windows"
```

---

### Task 8: 全局替换审计、构建和视觉验收

**Files:**
- Modify: 仅限审计发现仍引用旧情绪/人格 Emoji 的已列范围文件。
- Modify: `.github/workflows/build-ipa.yml`（仅当缺少测试/构建步骤）。
- Modify: `README.md`（记录 27 情绪、换装和聊天 Emoji）。

**Interfaces:**
- Consumes: Tasks 1-7 的完整功能。
- Produces: 无遗漏引用、两端构建证据和最终变更说明。

- [ ] **Step 1: 搜索旧视觉引用并建立失败清单**

Run:

```bash
rg -n "😄|🙂|😐|😮‍💨|😡|💀|profile\.emoji|avatarSymbol" TuS win-app/src server/src
```

Expected: 只允许兼容映射、文本内容、真实照片/SF Symbol 非角色用途；任何角色位置的旧 Emoji 都列为待修复。

- [ ] **Step 2: 为每个遗漏先补断言，再做最小替换**

服务端遗漏加入 `little-energy.test.mjs`；Windows 遗漏加入 `test-little-energy.js`；iOS 纯逻辑遗漏加入 `LittleEnergyModelsTests.swift`。修复后重新运行对应测试。

- [ ] **Step 3: 运行完整本地验证**

Run:

```bash
node tools/verify-little-energy-assets.mjs
cd server && npm run test:little-energy && npm run test:unit && npm test
cd ../win-app && node test-little-energy.js && node test-core.js && node test-v2.js && node test-v2b.js && node test-v3.js && node test-v3b.js
node --check src/api.js
node --check src/app.js
node --check src/views.js
```

Expected: 全部 PASS，且无语法错误。

- [ ] **Step 4: 运行 Windows UI 冒烟并检查截图**

Run: `cd win-app && node smoke-ui.js`

检查：首页顶部情绪同步、27 项选择器、我的换装、聊天 Emoji、黑化同事、无资源错位或溢出。

- [ ] **Step 5: 推送功能分支并等待 GitHub Actions iOS 构建**

检查 workflow 的 Xcode build/test 结果；若失败，先按 `superpowers:systematic-debugging` 定位根因并补回归测试，再修复。

- [ ] **Step 6: 更新 README 并提交最终审计**

```bash
git add README.md .github/workflows TuS win-app/src server/src server/test tools shared
git commit -m "docs: document little energy system"
```

- [ ] **Step 7: 请求代码审查**

使用 `superpowers:requesting-code-review` 对设计要求、数据兼容、两端视觉引用和测试证据做最终审查；修复高优先级问题后重新运行 Step 3-5。
