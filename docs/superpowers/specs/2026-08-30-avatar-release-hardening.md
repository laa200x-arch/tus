# Avatar, Navigation and Release Hardening Spec

## Goal

Repair the cross-platform Little Energy presentation and complaint flows, bring the Messages experience in line with the supplied design reference, and make client/server/release versioning deterministic.

## Decisions

- A user avatar is rendered from one complete, precomposed PNG per `(mood, look)` instead of layering two full-body PNGs at runtime.
- The supplied purple Little Energy office illustration is the only application identity artwork: iOS app icon, Windows executable/window/tray icon, and launch branding use derivatives of it. Functional UI controls retain semantic icons.
- Production route support is the source-of-truth contract: authenticated `GET /api/complaints/:id`, `POST /api/complaints/:id/favorite`, and `GET /api/complaints/favorites` must be deployed with the server version clients advertise.
- Update checks do not interrupt the user. They populate an actionable Version Notice entry/page.
- Full-screen flows always provide an explicit leading close/back control. Desktop subpages use the existing content history stack.
- Windows keeps its desktop layout; the message content, hierarchy, and interaction style follow the mobile reference without emulating a phone shell.

## Acceptance Criteria

1. No visible Little Energy avatar uses two full-body DOM/Swift image layers.
2. A complaint detail and favorite operation work against the production API after deployment.
3. `xnz_*` values never appear as visible sentiment text.
4. The profile editor changes turntable angle during a drag with preloaded views.
5. iOS and Windows launch screens use animated purple/lavender gradients and the unified app identity art.
6. Version messages are user-opened from Messages; no startup update modal is presented.
7. "我的档案" appears inside the user profile / "查看主页" flow rather than as a duplicate entry in Mine.
8. Messages use the supplied conversation-screen layout language and retain existing send/media/emoji behavior.
9. iOS release build, Windows build/tests, and server regression tests run before publishing.
