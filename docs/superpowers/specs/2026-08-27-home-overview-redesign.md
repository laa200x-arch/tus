# 首页聚合接口与双端首页重构设计

日期：2026-08-27

## 目标

以用户提供的移动端参考图为 iOS 首页视觉目标，同时为 Windows 设计符合宽屏操作逻辑的 Dashboard。两端消费同一个后端首页聚合接口，复用现有用户、情绪、穿搭、吐槽、同事和职场人格数据，不创建第二套首页状态源。

完成后：

- 首页首屏只需一个聚合请求即可得到主要内容。
- 今日情绪打卡后，小能仔和首页数据即时更新，并继续保持跨页面一致。
- iOS 使用移动端纵向信息流和新的五项导航。
- Windows 保留侧栏和宽屏分栏，不机械复制 iOS 卡片比例或底部导航。
- 任一首页模块失败时有明确降级，不阻塞整个页面进入。

## 非目标

- 不重写现有情绪打卡、吐槽发布、聊天或个人资料写接口。
- 不新增独立首页数据库表或缓存副本。
- 不改变黑化小能仔仅代表被吐槽同事的规则。
- 不在本次改造中重做广场、消息、我的和 AI 详情页内部布局。

## 后端架构

### 接口

新增认证接口：

`GET /api/home/overview`

返回结构：

```json
{
  "serverTime": "2026-08-27T12:11:00.000Z",
  "greetingPeriod": "afternoon",
  "user": {
    "id": 1,
    "userName": "阿青",
    "littleEnergyOutfit": {
      "topId": "top_tshirt",
      "bottomId": "bottom_slacks",
      "shoesId": "shoes_sneakers",
      "accessoryIds": []
    }
  },
  "stats": {
    "moodCheckedToday": false,
    "plazaComplaintCount": 1,
    "myComplaintCount": 0,
    "colleagueCount": 2,
    "unreadMessageCount": 0
  },
  "moodToday": null,
  "quickMoods": [
    { "id": "xnz_motivated", "label": "元气", "assetName": "xnz_motivated" }
  ],
  "latestComplaints": [],
  "personality": {
    "name": "摸鱼哲学家",
    "totalComplaints": 0,
    "summary": "完整报告在 AI 洞察中查看"
  },
  "colleagueSummary": {
    "count": 2,
    "averageScore": null,
    "healthScore": null
  }
}
```

### 数据来源

接口在一次请求中读取现有数据：用户资料与穿搭、当天 mood check-in、吐槽统计与最新吐槽、同事统计、会话未读数、职场人格摘要。所有字段都由现有表和纯派生函数生成，不落地聚合结果。

`quickMoods` 使用 27 情绪共享目录的稳定 ID。默认五项为元气、还行、一般、好累、想辞职语义，对应目录中最接近的稳定情绪 ID；显示文案可以面向首页调整，但提交值始终是稳定 ID。

### 错误与兼容

- 未认证返回 401。
- 旧用户没有穿搭时返回规范化默认穿搭。
- 没有打卡、吐槽、人格或同事时返回结构化空值，不缺字段。
- 单个可选摘要查询失败时记录服务端日志并返回该模块空状态；身份和核心统计失败时返回 500。
- 保留 `/api/home/stats` 以兼容旧客户端，新客户端只使用 `/api/home/overview`。

## 共享前端状态流

两端各自只保留一个 `homeOverview` 状态对象。首页加载流程为：

1. 进入首页时显示稳定骨架或缓存内容。
2. 请求 `/api/home/overview`。
3. 将响应中的用户穿搭和 `moodToday` 同步回现有全局用户/情绪状态。
4. 首页组件只从聚合对象和既有全局状态派生 UI。
5. 情绪打卡、发布吐槽、编辑穿搭成功后先更新相关全局状态，再刷新 overview 校准统计。

请求设置超时。失败时移除启动或页面级加载遮罩，显示分区错误与重试按钮；不允许无限加载。

## iOS 设计

### 导航

根 Tab 调整为：

1. 首页
2. 广场
3. 中间发布按钮
4. 消息
5. 我的

中间按钮打开现有吐槽发布 Sheet，不创建空 Tab 页面。原 AI Tab 移除；AI 洞察通过首页人格卡和“我的”中的现有入口访问。

### 首页结构

按移动端参考图实现纵向 ScrollView：

- 顶部问候、辅助文案、搜索入口与穿搭后的当前情绪小能仔。
- 四张横向统计卡：今日打卡、广场吐槽、我的吐槽、同事档案。
- 今日情绪打卡大卡：标题、说明、五个快捷情绪、完整打卡入口。
- 最新吐槽标题、进入广场入口和一条重点吐槽卡。
- 职场人格摘要卡，点击进入 AI 洞察。

沿用现有主题色和内容，不复制参考图中的手机状态栏、设备外框或系统时间。

### 交互

- 点击快捷情绪直接调用现有打卡接口；成功后立即更新顶部小能仔、统计卡和情绪卡。
- 完整打卡进入现有压力源/备注 Sheet。
- 四张统计卡均可导航到对应页面。
- 搜索入口进入现有搜索能力；若 iOS 当前没有完整搜索页，则本次只接入已有可用搜索结果界面，不新建搜索子系统。
- 最新吐槽保持点赞、共鸣、评论和分享的现有能力。

## Windows 设计

Windows 保留左侧导航和顶部栏，首页调整为三层宽屏 Dashboard：

- 顶部 Hero：问候、辅助文案、搜索框和当前小能仔。
- 第二层四张等宽统计卡，支持点击导航。
- 主区域两栏：左侧宽栏放情绪打卡与最新吐槽；右侧窄栏放职场人格、同事概况和快捷入口。

在窗口宽度不足时两栏降为单栏，但不引入手机底部 Tab。Windows 现有关系雷达和热榜如果仍有业务价值，作为右栏次级模块保留；它们从 overview 或现有按需接口加载，不阻塞首屏。

## 组件边界

### 后端

- `buildHomeOverview(db, userId, now)`：聚合和规范化数据。
- 路由层：认证、调用聚合器、返回 HTTP 结果。
- 纯函数：问候时段、快捷情绪映射和空状态规范化。

### iOS

- `HomeOverview` Codable 模型。
- `APIClient.fetchHomeOverview()`。
- Store 的 `loadHomeOverview()` 与写操作后的刷新协调。
- 独立首页区块 View，避免继续扩大单个 `MatchHomeView.swift`。

### Windows

- API 层 `fetchHomeOverview()`。
- 首页状态应用函数，负责同步 `moodToday` 和用户穿搭。
- 独立渲染函数：Hero、统计卡、情绪卡、吐槽卡、侧栏摘要。

## 测试与验收

### 后端

- overview 完整响应契约。
- 空账号、匿名吐槽、默认穿搭、已打卡和未打卡。
- 统计值与现有单项接口一致。
- 旧 `/api/home/stats` 不回归。

### iOS

- Codable 解码完整与缺省响应。
- overview 同步全局情绪和穿搭。
- 快捷打卡成功/失败状态。
- Tab 顺序和中间发布行为。
- GitHub Actions `Release-iphoneos arm64` 构建成功。

### Windows

- 浏览器脚本按真实顺序加载。
- overview 状态同步与各模块空/错/成功状态。
- 点击统计卡和快捷情绪的导航/提交行为。
- 正式 portable 与 NSIS 包启动后离开 Splash，进入登录页或首页。

### 视觉验收

- iOS 与参考图同一视口截图对比，检查信息顺序、留白、卡片层级和小能仔资产。
- Windows 以 1100×760 和最小支持宽度验收，确认宽屏逻辑、无溢出、无无限加载。
- 设计 QA 中 P0/P1/P2 全部修复后方可发布。

## 发布

实现完成后同步本地与 GitHub `main`。iOS 通过 GitHub Actions 生成未签名 IPA；Windows 提升补丁版本并发布新的安装包与便携版。生产服务需部署包含 `/api/home/overview` 的后端后，再向用户宣告首页已上线。
