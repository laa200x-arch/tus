# TUS 全量设计稿资产与双端界面应用规格

日期：2026-08-28

## 目标与视觉基准

以用户提供的《TUS 职场那些事 · 全量设计稿 Design Draft v1.0》为唯一视觉基准，覆盖设计板中的首页、广场、吐槽详情、发布菜单、消息、我的、情绪打卡、AI 洞察、同事档案和设置十类界面。

本次交付必须：

- 为设计板中每一个应用自有图标建立独立透明背景 PNG 文件，不使用雪碧图、不从设计截图裁切小图、不以 emoji、文字字符、临时 SVG、CSS 图形或占位块代替。
- 生成并保存设计所需的独立背景与装饰图片。
- 在 iOS 与 Windows 中实际引用这些图片，并移除目标界面中对应的系统符号、emoji 或代码绘制替代物。
- 保留现有业务、数据结构、导航和状态流；只按设计稿重构信息呈现和资产引用。
- 完成自动化测试、视觉对比、iOS Release 构建、Windows 安装包与便携版打包，然后同步本地与 GitHub。

参考图只约束应用内容，不复制手机状态栏、时间、电量、信号、Home Indicator 或设计板编号标签。

## 资产生成方案

采用统一清单驱动的混合方案：

- 品牌化彩色功能图标、匿名头像、徽章和装饰背景使用内置 ImageGen 独立生成，每个资产单独调用、单独检查、单独输出。
- 搜索、返回、更多、喜欢、评论、分享、发送、箭头等通用线性图标选用同一套接近设计稿的开源圆角线性图标库，并逐个导出为透明 PNG；不得手绘 SVG。
- 所有图标的规范源文件为 256×256 RGBA PNG，主体安全区不小于 184×184，边缘无白底、无色边和无水印。
- 背景图以目标显示槽位生成，不拉伸截图或雪碧图。
- 颜色围绕设计板主色：能量紫 `#765BFF`、浅紫 `#A695FF`、柔粉 `#FF6B88`、薄荷绿 `#30D6A1`、天蓝 `#43BDF2`、深夜文字 `#10152F`。

## 规范目录与同步

```text
assets/ui/
  asset-manifest.json
  icons/*.png
  backgrounds/*.png
  reference/tus-full-design-v1.jpg

TuS/Assets.xcassets/UI/
  Icons/<asset-name>.imageset/<asset-name>.png
  Backgrounds/<asset-name>.imageset/<asset-name>.png

win-app/assets/ui/
  icons/*.png
  backgrounds/*.png
```

`assets/ui/asset-manifest.json` 是唯一资产映射清单，至少记录：稳定名称、类别、生成方式、透明要求、尺寸、设计板出现屏幕、iOS imageset 名称、Windows 相对路径和使用组件。同步脚本只复制/校验，不修改图片内容。

## 独立 PNG 图标清单

### 品牌与导航

| 稳定名称 | 设计含义 | 使用位置 |
|---|---|---|
| `ui_brand_tus` | TUS 紫色圆角品牌标 | 启动、关于、产品标识 |
| `ui_nav_home` | 首页房屋 | 主导航 |
| `ui_nav_plaza` | 广场搜索/发现 | 主导航 |
| `ui_nav_publish` | 紫色加号发布 | 主导航中央按钮 |
| `ui_nav_messages` | 心形消息 | 主导航 |
| `ui_nav_profile` | 个人轮廓 | 主导航 |

### 全局操作

| 稳定名称 | 设计含义 | 使用位置 |
|---|---|---|
| `ui_action_search` | 搜索 | 首页、广场、个人页 |
| `ui_action_back` | 返回 | 详情、同事档案等 |
| `ui_action_more` | 竖向更多 | 吐槽卡、个人页 |
| `ui_action_chevron` | 右箭头 | 列表、卡片入口、设置 |
| `ui_action_like` | 空心喜欢 | 吐槽卡、详情 |
| `ui_action_comment` | 评论气泡 | 吐槽卡、详情 |
| `ui_action_share` | 分享箭头 | 吐槽卡、详情 |
| `ui_action_send` | 圆形发送 | 评论输入 |
| `ui_action_add` | 添加 | 添加同事等入口 |

### 首页与功能入口

| 稳定名称 | 设计含义 | 使用位置 |
|---|---|---|
| `ui_feature_checkin` | 紫色打卡簿 | 首页统计、情绪入口 |
| `ui_feature_plaza` | 橙色火焰 | 首页统计、广场入口 |
| `ui_feature_my_complaints` | 蓝色对话 | 首页统计、我的吐槽 |
| `ui_feature_colleagues` | 绿色同事群组 | 首页统计、同事档案 |

### 发布菜单

| 稳定名称 | 设计含义 | 使用位置 |
|---|---|---|
| `ui_publish_complaint` | 发布吐槽 | 中央发布菜单 |
| `ui_publish_dynamic` | 发布动态 | 中央发布菜单 |
| `ui_publish_mood` | 记录情绪 | 中央发布菜单 |
| `ui_publish_colleague` | 新建同事档案 | 中央发布菜单 |

### 消息中心

| 稳定名称 | 设计含义 | 使用位置 |
|---|---|---|
| `ui_message_interaction` | 互动消息 | 消息列表 |
| `ui_message_system` | 系统通知 | 消息列表 |
| `ui_message_ai` | AI 助手头像 | 消息列表、AI 入口 |
| `ui_message_update` | 系统更新/版本 | 消息列表 |

### 我的快捷入口

| 稳定名称 | 设计含义 | 使用位置 |
|---|---|---|
| `ui_profile_complaints` | 我的吐槽 | 我的快捷入口 |
| `ui_profile_favorites` | 我的收藏 | 我的快捷入口 |
| `ui_profile_posts` | 我的点赞/动态 | 我的快捷入口 |
| `ui_profile_history` | 浏览记录 | 我的快捷入口 |
| `ui_tool_report` | 情绪报告 | 我的工具 |
| `ui_tool_ai` | AI 洞察 | 我的工具 |
| `ui_tool_stress` | 压力分析 | 我的工具 |
| `ui_tool_relationship` | 关系雷达 | 我的工具 |
| `ui_row_colleague` | 同事档案 | 我的列表入口 |
| `ui_row_company` | 公司画像 | 我的列表入口 |
| `ui_badge_level` | 金色等级徽章 | 用户等级 |
| `ui_avatar_anonymous` | 紫色匿名面具头像 | 匿名吐槽作者 |

清单共 39 个独立图标 PNG。若实现检查发现设计板中还有应用自有图标未被上述名称覆盖，必须先补充清单和测试，再生成并接入；不得以“系统图标相近”为理由跳过。

## 背景与装饰图片清单

| 稳定名称 | 类型与尺寸 | 使用位置 |
|---|---|---|
| `ui_bg_app_soft` | 1024×1536 RGB/RGBA，极浅紫白纹理背景 | iOS 十类页面与 Windows 主内容区 |
| `ui_decor_home_hero` | 1024×1024 RGBA，透明，小能仔周围气泡、星光和柔光 | 首页 Hero；角色本体仍由现有小能仔资产绘制 |

模态遮罩、卡片底色、边框和纯色渐变属于可响应的界面样式，不固化成图片。

## 明确复用而不重复生成的素材

- 现有 27 个 `xnz_*` 小能仔情绪 PNG。
- `dark-colleague.png`，仅用于被吐槽“同事”的黑化形象，禁止叠加用户穿搭。
- 现有上衣、下装、鞋子和配饰换装 PNG。
- 用户与同事真实头像；这些是动态数据，缺省时使用已有头像策略或 `ui_avatar_anonymous`，不把设计板示例人物固化进应用。
- AI 趋势折线、统计数字和标签；它们由真实数据绘制，不作为静态图片。

## 十类界面资产映射

### 首页 / Home

- 使用 `ui_bg_app_soft`、`ui_decor_home_hero`、当前情绪与当前穿搭小能仔。
- 四张统计卡分别使用四个 `ui_feature_*` 图标。
- 情绪打卡使用现有五个快捷情绪资源；底部导航使用五个 `ui_nav_*`。
- 最新吐槽卡使用匿名头像与喜欢/评论/分享/更多 PNG。

### 广场 / Square 与吐槽详情

- 顶部搜索、返回和更多全部使用 PNG。
- 吐槽交互使用 `ui_action_like/comment/share`；评论发送使用 `ui_action_send`。
- 匿名用户使用 `ui_avatar_anonymous`，实名用户使用动态头像/小能仔穿搭。

### 发布 / Publish

- 发布弹层按设计稿顺序使用四个 `ui_publish_*` 图标。
- 中央发布按钮使用 `ui_nav_publish`，关闭/取消保持文本交互。

### 消息 / Messages

- 四类系统会话使用四个 `ui_message_*` 图标；真人私信使用动态头像。
- 未读数字点为实时 UI，不生成进图片。

### 我的 / Profile

- 使用四个 `ui_profile_*`、四个 `ui_tool_*`、两个 `ui_row_*` 和等级徽章。
- 用户头像/穿搭从现有用户资料读取，不固定为设计板示例头像。

### 情绪打卡 / Mood Check-in

- 当前选择与完整 27 情绪都使用现有小能仔 PNG；压力源标签和按钮为实时 UI。

### AI 洞察 / AI Insight

- 使用 `ui_tool_ai` 或 `ui_message_ai` 作为入口标识；折线、关键词与报告内容由真实数据渲染。

### 同事档案 / Colleague

- 返回、添加使用通用 PNG；同事照片来自真实数据；关系标签与好感度由真实数据渲染。

### 设置 / Settings

- 行尾统一使用 `ui_action_chevron`；退出登录为文本按钮。设计板没有左侧功能图标，不额外发明图标。

## iOS 应用规则

- 每个规范图标建立独立 `.imageset`，只包含对应 PNG 和 `Contents.json`。
- 线性图标使用 template rendering 以适配选中紫/未选灰；彩色图标保持 original rendering。
- 首页及十类界面按设计板的字体、20pt 卡片圆角、留白和紫色层级重构；不重建系统状态栏。
- 新图片引用封装为稳定的 `UIAsset` 名称，禁止散落字符串。
- 新文件必须加入 `TuS` target；测试文件必须加入 `TuSTests` target。

## Windows 应用规则

- 使用同一批规范 PNG，不另画一套风格。
- 保持左侧导航与桌面宽屏信息架构；将设计板移动端页面转换为桌面主栏/侧栏或弹层，不复制手机底部栏。
- 使用 `<img>` 或 CSS background-image 引用文件，不使用 emoji、CSS 绘图或内联 SVG 替代已列图标。
- 窗口缩小时允许两栏降为一栏，但图标比例、卡片层级和真实交互保持一致。

## 测试与防漏验收

### 资产自动检查

- 清单中的每个图标必须存在于规范目录、iOS imageset 和 Windows 目录。
- 所有图标必须为 PNG、256×256、RGBA 且至少包含一个透明像素。
- 背景尺寸和颜色模式必须匹配清单。
- 扫描目标界面代码，确保清单资产至少有一个消费位置；禁止孤儿资产。
- 扫描目标界面可见文案附近的 emoji、SF Symbol、内联 SVG 和 CSS 图形替代，发现后失败，明确允许的动态文本 emoji 除外。

### 行为与视觉检查

- iOS：相同视口逐屏对比十类界面，修复 P0/P1/P2，`design-qa.md` 最终为 `passed`。
- Windows：1100×760 与最小窗口逐屏检查，不出现手机底栏、溢出、拉伸或无限加载。
- 今日情绪、穿搭、匿名/实名显示、发布、评论、消息、同事和 AI 数据流保持现有行为。
- iOS XCTest/Release arm64 构建通过；Windows 脚本测试与 packaged-app 启动验证通过。

## 发布

- 先提交规范资产、清单和同步/校验脚本，再分屏接入界面，最后进行视觉 QA 与行为回归。
- Windows 提升补丁版本，生成 NSIS 安装包和便携版。
- iOS 触发 GitHub Actions Release-iphoneos arm64，保留未签名 IPA 构建产物。
- 所有验证通过后推送 GitHub `main` 并发布 Windows Release；报告资产总数、屏幕映射、测试结果、构建链接和未解决问题。

## 完成定义

- 39 个应用自有图标各自拥有独立透明 PNG，并全部被界面引用。
- 两张背景/装饰图片存在并应用到对应位置。
- 现有小能仔 27 情绪、黑化同事和换装资源按规则复用。
- 十类 iOS 界面符合全量设计稿；Windows 使用同一视觉体系且符合桌面逻辑。
- 资产校验、行为测试、视觉 QA、iOS 构建、Windows 打包与启动验证全部通过。
- 本地与 GitHub `main`、Windows Release 和 iOS 构建产物均更新。
