import SwiftUI

/// 消息发送结果（用于 UI 展示风控拦截 / 发送失败）
enum MessageSendResult: Equatable {
    case sent
    case blocked(warning: String)
    case failed(warning: String)
}

/// 全局数据层（方案 4.2 数据层）
/// 双模式：
///   - 服务端模式（登录后）：数据来自 Node.js + Express 后端（APIClient），
///     实时消息走 Socket.io（RealtimeClient），风控由服务端执行
///   - 演示模式（未登录/离线）：内置示例数据，纯本地运行
@MainActor
final class MockDataStore: ObservableObject {
    static let shared = MockDataStore()

    // MARK: - 发布数据

    @Published var currentUser: UserModel
    @Published var allUsers: [UserModel]
    @Published var conversations: [Conversation]

    /// 吐槽同事核心数据
    @Published var statuses: [StatusModel] = []        // 同事状态（吐槽动态）
    @Published var colleagues: [ColleagueModel] = []   // 同事档案（同事属性）
    @Published var companies: [CompanyModel] = []      // 公司属性

    /// 当前打开中的会话（用于实时消息未读计数）
    var activeConversationID: UUID?

    /// 服务端用户 id（非空 = 服务端模式）
    private(set) var serverUserID: String?

    /// 会话消息缓存（@Published：消息加载完成后驱动聊天界面重绘）
    @Published private var messagesByConversation: [UUID: [ChatMessage]] = [:]
    /// 会话是否还有更早消息（分页加载）
    @Published private var hasMoreByConversation: [UUID: Bool] = [:]

    var isServerMode: Bool { serverUserID != nil }

    // MARK: - 初始化

    private init() {
        currentUser = Self.makeCurrentUser()
        allUsers = Self.makeOtherUsers()
        conversations = []
        seedData()
    }

    // MARK: - 登录 / 会话（服务端模式）

    func login(username: String, password: String) async throws {
        do {
            let user = try await APIClient.shared.login(username: username, password: password)
            try await activateServerSession(user)
        } catch {
            // 登录失败：清除可能残留的旧 token，避免重启后"误自动登录"
            TokenStore.token = nil
            serverUserID = nil
            throw error
        }
    }

    func register(username: String, password: String, nickname: String, phone: String? = nil, code: String? = nil) async throws {
        do {
            let user = try await APIClient.shared.register(username: username, password: password, nickname: nickname, phone: phone, code: code)
            try await activateServerSession(user)
        } catch {
            TokenStore.token = nil
            serverUserID = nil
            throw error
        }
    }

    /// 用已保存账号的 token 直接登录（切换账号免输密码）
    /// 401（token 真失效）→ 清 token 抛错；网络异常 → 保留 token 与账号（登录页可重试）
    func loginWithSavedAccount(_ account: SavedAccount) async throws {
        TokenStore.token = account.token
        do {
            let user = try await APIClient.shared.fetchMe()
            try await activateServerSession(user)
        } catch let error as APIError {
            if error == .unauthorized {
                TokenStore.token = nil
            }
            throw error
        }
    }

    /// 自动登录：App 启动时若存在持久化 Token，从服务器拉取该账号数据
    /// - 返回 true：会话有效，已恢复账号数据
    /// - 返回 false：回登录页（401 清 token；网络异常保留 token 与账号，可重试）
    @discardableResult
    func autoLogin() async -> Bool {
        guard TokenStore.token != nil else { return false }
        do {
            let user = try await APIClient.shared.fetchMe()
            try await activateServerSession(user)
            return true
        } catch let error as APIError {
            serverUserID = nil
            RealtimeClient.shared.disconnect()
            if error == .unauthorized {
                // token 真失效：清除
                TokenStore.token = nil
            }
            return false
        } catch {
            serverUserID = nil
            RealtimeClient.shared.disconnect()
            return false
        }
    }

    private func activateServerSession(_ user: ServerUser) async throws {
        serverUserID = user.id
        currentUser = UserModel(server: user)
        // 保存账号到本机（切换账号时免输密码，手动删除前一直保留）
        if let token = TokenStore.token {
            TokenStore.saveAccount(SavedAccount(
                username: user.username,
                nickname: user.userName,
                avatarSymbol: user.avatarSymbol,
                token: token
            ))
        }
        try await refreshAll()
        NotificationService.requestPermission()
        RealtimeClient.shared.onMessage = { [weak self] payload in
            Task { @MainActor in
                self?.handleSocketMessage(payload)
            }
        }
        if let token = TokenStore.token {
            RealtimeClient.shared.connect(token: token)
        }
    }

    func logout() {
        TokenStore.token = nil
        serverUserID = nil
        RealtimeClient.shared.disconnect()
        // 重置为演示数据
        currentUser = Self.makeCurrentUser()
        allUsers = Self.makeOtherUsers()
        conversations = []
        messagesByConversation = [:]
        // v2 状态重置
        tagDict = Self.demoTagDict
        feedComplaints = []
        myComplaints = []
        topics = []
        moodCheckedToday = false
        moodToday = nil
        moodTrend = []
        moodSummary = nil
        personality = nil
        radarByColleague = [:]
        seedData()
    }

    /// 全量刷新（登录后 / 下拉刷新）
    func refreshAll() async throws {
        async let users = APIClient.shared.fetchUsers()
        async let convs = APIClient.shared.fetchConversations()
        async let stats = APIClient.shared.fetchStatuses()
        async let cols = APIClient.shared.fetchColleagues()
        async let comps = APIClient.shared.fetchCompanies()
        allUsers = try await users.map { UserModel(server: $0) }
        conversations = try await convs.map { Conversation(server: $0) }
        statuses = try await stats.map { StatusModel(server: $0) }
        colleagues = try await cols.map { ColleagueModel(server: $0) }
        companies = try await comps.map { CompanyModel(server: $0) }
        // v2：吐槽广场 / 情绪打卡 / 雷达（尽力拉取，失败不阻塞登录）
        await loadTags()
        await refreshComplaints()
        await refreshMood()
        await loadRadarBatch()
    }

    /// 拉取指定用户最新资料并同步本地快照（动态资料页/匹配详情打开时调用）
    func refreshUser(_ user: UserModel) async -> UserModel {
        guard isServerMode, let serverID = user.id.serverIDString else { return user }
        guard let fresh = try? await APIClient.shared.fetchUser(id: serverID) else { return user }
        let updated = UserModel(server: fresh)
        syncUserSnapshot(updated)
        return updated
    }

    /// 同步用户快照到 allUsers / currentUser / 会话 partner
    private func syncUserSnapshot(_ updated: UserModel) {
        if let idx = allUsers.firstIndex(where: { $0.id == updated.id }) {
            allUsers[idx] = updated
        }
        if updated.id == currentUser.id {
            currentUser = updated
        }
        for i in conversations.indices where conversations[i].partner.id == updated.id {
            conversations[i].partner = updated
        }
    }

    /// 更新档案后同步本地快照
    private func syncCurrentUserInAllUsers() {
        syncUserSnapshot(currentUser)
    }

    // MARK: - 内置 IM（方案 2.3.3）

    func messages(for conversationID: UUID) -> [ChatMessage] {
        messagesByConversation[conversationID] ?? []
    }

    /// 获取与某用户的会话（服务端模式：优先走服务器，失败返回 nil 由界面提示重试；演示模式：本地创建）
    func openConversation(with partner: UserModel) async -> Conversation? {
        if let existing = conversations.first(where: { $0.partner.id == partner.id }) {
            return existing
        }
        if isServerMode, let partnerServerID = partner.id.serverIDString {
            do {
                let server = try await APIClient.shared.openConversation(partnerId: partnerServerID)
                let convo = Conversation(server: server)
                if !conversations.contains(where: { $0.id == convo.id }) {
                    conversations.insert(convo, at: 0)
                }
                return convo
            } catch {
                print("[store] openConversation 失败: \(error)")
                return nil
            }
        }
        let convo = Conversation(
            id: UUID(),
            partner: partner,
            lastMessageText: "你们已建立会话，开始吐槽吧～",
            lastTime: Date(),
            unreadCount: 0
        )
        conversations.insert(convo, at: 0)
        messagesByConversation[convo.id] = [
            ChatMessage(
                senderIsMe: false,
                text: "你们已建立会话，开始吐槽吧～ 请文明发言，禁止人身攻击与泄露隐私。",
                isSystemNote: true
            )
        ]
        return convo
    }

    /// 拉取会话历史消息（服务端模式，默认最近 50 条）
    func loadMessages(conversationID: UUID) async {
        guard isServerMode, let serverID = conversationID.serverIDString else { return }
        do {
            let (serverMessages, hasMore) = try await APIClient.shared.fetchMessages(conversationId: serverID)
            messagesByConversation[conversationID] = serverMessages.map { ChatMessage(server: $0) }
            hasMoreByConversation[conversationID] = hasMore
        } catch {
            // 保留现有消息
        }
    }

    /// 会话是否还有更早消息（聊天页显示「加载更早消息」按钮）
    func hasMoreMessages(for conversationID: UUID) -> Bool {
        hasMoreByConversation[conversationID] ?? false
    }

    /// 加载更早消息（分页，插入到现有消息之前）
    func loadEarlierMessages(conversationID: UUID) async {
        guard isServerMode, let serverID = conversationID.serverIDString else { return }
        let existing = messagesByConversation[conversationID] ?? []
        guard let oldest = existing.first, let oldestServerID = oldest.id.serverIDString else { return }
        do {
            let (serverMessages, hasMore) = try await APIClient.shared.fetchMessages(
                conversationId: serverID, before: oldestServerID
            )
            let earlier = serverMessages.map { ChatMessage(server: $0) }
            messagesByConversation[conversationID] = earlier + existing
            hasMoreByConversation[conversationID] = hasMore
        } catch {
            // 保留现有消息
        }
    }

    func markConversationRead(_ conversationID: UUID) {
        activeConversationID = conversationID
        guard let idx = conversations.firstIndex(where: { $0.id == conversationID }) else { return }
        conversations[idx].unreadCount = 0
        if isServerMode, let serverID = conversationID.serverIDString {
            Task {
                try? await APIClient.shared.markConversationRead(conversationId: serverID)
            }
        }
    }

    /// 发送消息（前置风控拦截）
    /// 服务端模式：Socket.io 实时发送（服务端风控），失败自动 REST 兜底保证必达
    /// orderId：兼容旧聊天卡片引用（可选，新版本通常为空）
    @discardableResult
    func sendMessage(conversationID: UUID, text: String, orderId: String? = nil) async -> MessageSendResult {
        if isServerMode {
            guard let serverID = conversationID.serverIDString else {
                return .failed(warning: "会话未同步，请返回消息列表重新进入")
            }
            // 1) Socket 实时发送
            let socketResult = await sendViaSocket(serverID: serverID, text: text, orderId: orderId)
            switch socketResult {
            case .sent:
                return .sent
            case .blocked(let warning):
                return .blocked(warning: warning)
            case .failed:
                break // 连接类失败 → REST 兜底
            }
            // 2) REST 兜底（服务端同一套风控与落库，消息必达服务器）
            do {
                let response = try await APIClient.shared.sendMessage(conversationId: serverID, text: text, orderId: orderId)
                if response.blocked == true {
                    return .blocked(warning: response.warning ?? "内容违规，已被拦截")
                }
                return .sent
            } catch {
                return .failed(warning: (error as? LocalizedError)?.errorDescription ?? "发送失败，请重试")
            }
        }

        // 演示模式：本地风控
        let risk = TradeRiskControlManager.shared.checkTextRisk(text: text)
        if risk.isIllegal {
            let note = ChatMessage(
                senderIsMe: false,
                text: "⚠️ 该消息含违禁词：\(risk.matchedWords.joined(separator: "、"))，已被平台风控拦截。请文明发言，禁止人身攻击与泄露隐私。",
                isSystemNote: true
            )
            appendMessage(conversationID, note)
            updateConversationPreview(conversationID, text: note.text, time: note.time)
            return .blocked(warning: risk.warning)
        }
        let msg = ChatMessage(senderIsMe: true, text: text, orderId: orderId)
        appendMessage(conversationID, msg)
        updateConversationPreview(conversationID, text: text, time: msg.time)
        return .sent
    }

    /// 发送媒体消息（图片/视频）
    /// 媒体走 REST 通道（先上传文件再发消息），文本走 Socket 实时
    func sendMediaMessage(conversationID: UUID, mediaType: String, mediaUrl: String, text: String = "") async -> MessageSendResult {
        guard isServerMode, let serverID = conversationID.serverIDString else {
            return .failed(warning: "会话未同步，请返回消息列表重新进入")
        }
        do {
            let response = try await APIClient.shared.sendMessage(
                conversationId: serverID,
                text: text,
                mediaType: mediaType,
                mediaUrl: mediaUrl
            )
            if response.blocked == true {
                return .blocked(warning: response.warning ?? "内容违规，已被拦截")
            }
            return .sent
        } catch {
            return .failed(warning: (error as? LocalizedError)?.errorDescription ?? "发送失败，请重试")
        }
    }

    /// Socket 实时发送（失败返回 .failed，由调用方决定 REST 兜底）
    private func sendViaSocket(serverID: String, text: String, orderId: String? = nil) async -> MessageSendResult {
        await withCheckedContinuation { continuation in
            RealtimeClient.shared.send(conversationId: serverID, text: text, orderId: orderId) { ok, blocked, warning in
                Task { @MainActor in
                    if blocked {
                        continuation.resume(returning: .blocked(warning: warning ?? "内容违规，已被拦截"))
                    } else if ok {
                        continuation.resume(returning: .sent)
                    } else {
                        continuation.resume(returning: .failed(warning: warning ?? "发送失败，请重试"))
                    }
                }
            }
        }
    }

    /// 实时消息处理（服务端 chat:message 广播 + 本地通知）
    private func handleSocketMessage(_ payload: RealtimeClient.SocketMessagePayload) {
        let convID = UUID(serverID: payload.conversationId)
        let isMe = payload.senderId == serverUserID
        let message = ChatMessage(
            id: UUID(serverID: payload.id),
            senderIsMe: isMe,
            text: payload.text,
            mediaType: payload.mediaType,
            mediaUrl: payload.mediaUrl,
            orderId: payload.orderId,
            time: payload.time,
            isSystemNote: false
        )
        appendMessage(convID, message)
        guard let idx = conversations.firstIndex(where: { $0.id == convID }) else { return }
        conversations[idx].lastMessageText = payload.text
        conversations[idx].lastTime = payload.time
        if !isMe && activeConversationID != convID {
            conversations[idx].unreadCount += 1
            // 本地通知（对方发来新消息）
            NotificationService.post(
                title: "\(conversations[idx].partner.userName) 发来消息",
                body: payload.text
            )
        }
    }

    // MARK: - 同事状态（吐槽动态）

    /// 发布一条同事状态
    @discardableResult
    func postStatus(
        content: String,
        colleagueId: UUID? = nil,
        themeTags: [String] = [],
        softwareTags: [String] = [],
        mood: String? = nil
    ) async -> MessageSendResult {
        if isServerMode {
            do {
                let server = try await APIClient.shared.postStatus(
                    content: content,
                    colleagueId: colleagueId?.serverIDString,
                    themeTags: themeTags,
                    softwareTags: softwareTags,
                    mood: mood
                )
                let model = StatusModel(server: server)
                if !statuses.contains(where: { $0.id == model.id }) {
                    statuses.insert(model, at: 0)
                }
                return .sent
            } catch {
                return .blocked(warning: (error as? LocalizedError)?.errorDescription ?? "发布失败")
            }
        }
        // 演示模式：本地风控
        let risk = TradeRiskControlManager.shared.checkProfileText(text: content)
        guard !risk.isIllegal else { return .blocked(warning: risk.warning) }
        let model = StatusModel(
            authorName: currentUser.userName,
            avatarSymbol: currentUser.avatarSymbol,
            colleagueId: colleagueId,
            colleagueName: colleagueId.flatMap { id in colleagues.first(where: { $0.id == id })?.name },
            content: content,
            themeTags: themeTags,
            softwareTags: softwareTags,
            mood: mood,
            time: Date()
        )
        statuses.insert(model, at: 0)
        return .sent
    }

    /// 删除自己的同事状态
    func deleteStatus(id: UUID) async {
        if isServerMode, let serverID = id.serverIDString {
            do {
                try await APIClient.shared.deleteStatus(id: serverID)
            } catch {
                print("[store] 删除状态失败: \(error)")
            }
        }
        statuses.removeAll { $0.id == id }
    }

    // MARK: - 同事档案（同事属性）

    /// 新增同事档案
    @discardableResult
    func addColleague(
        name: String,
        position: String = "",
        department: String = "",
        relation: String = "",
        attributeTags: [String] = [],
        companyId: UUID? = nil,
        notes: String = "",
        avatarSymbol: String = "👤"
    ) async throws -> ColleagueModel {
        if isServerMode {
            var body: [String: Any] = [
                "name": name, "position": position, "department": department,
                "relation": relation, "attributeTags": attributeTags,
                "notes": notes, "avatarSymbol": avatarSymbol
            ]
            if let companyId { body["companyId"] = companyId.serverIDString }
            let server = try await APIClient.shared.addColleague(body)
            let model = ColleagueModel(server: server)
            colleagues.insert(model, at: 0)
            return model
        }
        let model = ColleagueModel(
            name: name,
            position: position,
            department: department,
            relation: relation,
            attributeTags: attributeTags,
            companyId: companyId,
            companyName: companyId.flatMap { id in companies.first(where: { $0.id == id })?.name },
            notes: notes,
            avatarSymbol: avatarSymbol,
            time: Date()
        )
        colleagues.insert(model, at: 0)
        return model
    }

    /// 更新同事档案
    func updateColleague(_ model: ColleagueModel) async throws {
        if isServerMode, let serverID = model.id.serverIDString {
            var body: [String: Any] = [
                "name": model.name, "position": model.position, "department": model.department,
                "relation": model.relation, "attributeTags": model.attributeTags,
                "notes": model.notes, "avatarSymbol": model.avatarSymbol
            ]
            if let cid = model.companyId { body["companyId"] = cid.serverIDString }
            let server = try await APIClient.shared.updateColleague(id: serverID, body)
            if let idx = colleagues.firstIndex(where: { $0.id == model.id }) {
                colleagues[idx] = ColleagueModel(server: server)
            }
            return
        }
        if let idx = colleagues.firstIndex(where: { $0.id == model.id }) {
            var updated = model
            updated.time = Date()
            updated.companyName = model.companyId.flatMap { id in companies.first(where: { $0.id == id })?.name } ?? model.companyName
            colleagues[idx] = updated
        }
    }

    /// 删除同事档案
    func deleteColleague(id: UUID) async {
        if isServerMode, let serverID = id.serverIDString {
            try? await APIClient.shared.deleteColleague(id: serverID)
        }
        colleagues.removeAll { $0.id == id }
    }

    // MARK: - 公司属性

    /// 新增公司属性
    @discardableResult
    func addCompany(
        name: String,
        industry: String = "",
        scale: String = "",
        overtimeCulture: String = "",
        welfare: String = "",
        location: String = ""
    ) async throws -> CompanyModel {
        if isServerMode {
            let body: [String: Any] = [
                "name": name, "industry": industry, "scale": scale,
                "overtimeCulture": overtimeCulture, "welfare": welfare, "location": location
            ]
            let server = try await APIClient.shared.addCompany(body)
            let model = CompanyModel(server: server)
            companies.insert(model, at: 0)
            return model
        }
        let model = CompanyModel(
            name: name,
            industry: industry,
            scale: scale,
            overtimeCulture: overtimeCulture,
            welfare: welfare,
            location: location
        )
        companies.insert(model, at: 0)
        return model
    }

    /// 更新公司属性
    func updateCompany(_ model: CompanyModel) async throws {
        if isServerMode, let serverID = model.id.serverIDString {
            let body: [String: Any] = [
                "name": model.name, "industry": model.industry, "scale": model.scale,
                "overtimeCulture": model.overtimeCulture, "welfare": model.welfare, "location": model.location
            ]
            let server = try await APIClient.shared.updateCompany(id: serverID, body)
            if let idx = companies.firstIndex(where: { $0.id == model.id }) {
                companies[idx] = CompanyModel(server: server)
            }
            return
        }
        if let idx = companies.firstIndex(where: { $0.id == model.id }) {
            companies[idx] = model
        }
    }

    /// 删除公司属性
    func deleteCompany(id: UUID) async {
        if isServerMode, let serverID = id.serverIDString {
            try? await APIClient.shared.deleteCompany(id: serverID)
        }
        companies.removeAll { $0.id == id }
    }

    // MARK: - v2 职场关系操作系统（吐槽广场 / 情绪打卡 / AI / 关系雷达）

    @Published var tagDict: TagDict = MockDataStore.demoTagDict
    @Published var feedComplaints: [ComplaintModel] = []     // 吐槽广场 feed
    @Published var myComplaints: [ComplaintModel] = []       // 我的吐槽
    @Published var topics: [TopicItem] = []                  // 热搜榜
    @Published var moodCheckedToday: Bool = false            // 今日是否已打卡
    @Published var moodToday: MoodCheckin?                   // 今日打卡内容
    @Published var moodTrend: [MoodTrendPoint] = []          // 30 天情绪曲线
    @Published var moodSummary: MoodSummary?                 // 情绪 AI 总结
    @Published var personality: PersonalityProfile?          // 职场人格
    @Published var radarByColleague: [String: RadarMap] = [:] // 同事雷达（key=同事 server id）

    /// 拉取字典（公开接口；失败保留本地兜底）
    func loadTags() async {
        if let tags = try? await APIClient.shared.fetchTags() {
            tagDict = tags
        }
    }

    /// 刷新吐槽广场（feed + 我的 + 热搜榜）
    func refreshComplaints(sort: String = "hot") async {
        guard isServerMode else { return }
        async let feed = APIClient.shared.fetchFeedComplaints(sort: sort)
        async let mine = APIClient.shared.fetchMineComplaints()
        async let tops = APIClient.shared.fetchTopics()
        if let f = try? await feed { feedComplaints = f }
        if let m = try? await mine { myComplaints = m }
        if let t = try? await tops { topics = t }
    }

    /// 发布吐槽（v2，含 AI 识别结果）
    @discardableResult
    func postComplaint(
        content: String,
        colleagueId: String? = nil,
        category: String? = nil,
        behaviorTags: [String] = [],
        sentiment: String? = nil,
        isAnonymous: Bool = false,
        aiExtracted: AIExtracted? = nil
    ) async -> MessageSendResult {
        if isServerMode {
            do {
                let model = try await APIClient.shared.postComplaint(
                    content: content,
                    colleagueId: colleagueId,
                    category: category,
                    behaviorTags: behaviorTags,
                    sentiment: sentiment,
                    isAnonymous: isAnonymous,
                    aiExtracted: aiExtracted
                )
                feedComplaints.insert(model, at: 0)
                myComplaints.insert(model, at: 0)
                return .sent
            } catch {
                return .blocked(warning: (error as? LocalizedError)?.errorDescription ?? "发布失败，请重试")
            }
        }
        // 演示模式：本地风控 + 本地插入
        let risk = TradeRiskControlManager.shared.checkTextRisk(text: content)
        guard !risk.isIllegal else { return .blocked(warning: risk.warning) }
        let model = ComplaintModel(
            id: UUID().uuidString,
            userId: "local-me",
            authorName: isAnonymous ? "匿名用户" : currentUser.userName,
            avatarSymbol: isAnonymous ? "🎭" : currentUser.avatarSymbol,
            isAnonymous: isAnonymous,
            content: content,
            colleagueId: colleagueId,
            colleagueName: colleagueId.flatMap { cid in colleagues.first(where: { $0.id.serverIDString == cid })?.name },
            category: category,
            behaviorTags: behaviorTags,
            sentiment: sentiment,
            aiExtracted: aiExtracted,
            likeCount: 0, resonanceCount: 0, hotScore: 0,
            liked: false, resonated: false,
            time: Date()
        )
        feedComplaints.insert(model, at: 0)
        myComplaints.insert(model, at: 0)
        return .sent
    }

    /// 删除自己的吐槽
    func deleteComplaint(id: String) async {
        if isServerMode {
            try? await APIClient.shared.deleteComplaint(id: id)
        }
        feedComplaints.removeAll { $0.id == id }
        myComplaints.removeAll { $0.id == id }
        topics.removeAll { $0.id == id }
    }

    /// 点赞（toggle）
    func toggleLike(_ complaint: ComplaintModel) async {
        if isServerMode {
            guard let result = try? await APIClient.shared.toggleLikeComplaint(id: complaint.id) else { return }
            applyComplaintToggle(id: complaint.id, liked: result.liked, likeCount: result.likeCount)
        } else {
            let liked = !complaint.liked
            applyComplaintToggle(id: complaint.id, liked: liked, likeCount: complaint.likeCount + (liked ? 1 : -1))
        }
    }

    /// 共鸣（toggle）
    func toggleResonate(_ complaint: ComplaintModel) async {
        if isServerMode {
            guard let result = try? await APIClient.shared.toggleResonateComplaint(id: complaint.id) else { return }
            applyComplaintToggle(id: complaint.id, resonated: result.resonated, resonanceCount: result.resonanceCount)
        } else {
            let resonated = !complaint.resonated
            applyComplaintToggle(id: complaint.id, resonated: resonated, resonanceCount: complaint.resonanceCount + (resonated ? 1 : -1))
        }
    }

    private func applyComplaintToggle(
        id: String,
        liked: Bool? = nil,
        likeCount: Int? = nil,
        resonated: Bool? = nil,
        resonanceCount: Int? = nil
    ) {
        for i in feedComplaints.indices where feedComplaints[i].id == id {
            if let liked { feedComplaints[i].liked = liked }
            if let likeCount { feedComplaints[i].likeCount = likeCount }
            if let resonated { feedComplaints[i].resonated = resonated }
            if let resonanceCount { feedComplaints[i].resonanceCount = resonanceCount }
        }
        for i in myComplaints.indices where myComplaints[i].id == id {
            if let liked { myComplaints[i].liked = liked }
            if let likeCount { myComplaints[i].likeCount = likeCount }
            if let resonated { myComplaints[i].resonated = resonated }
            if let resonanceCount { myComplaints[i].resonanceCount = resonanceCount }
        }
    }

    /// 刷新今日打卡状态 + 30 天趋势
    func refreshMood() async {
        guard isServerMode else { return }
        if let (checked, checkin) = try? await APIClient.shared.fetchMoodToday() {
            moodCheckedToday = checked
            moodToday = checkin
        }
        if let trend = try? await APIClient.shared.fetchMoodTrends() {
            moodTrend = trend
        }
    }

    /// 每日打卡（同日覆盖）
    @discardableResult
    func checkinMood(mood: String, stressSources: [String], note: String = "") async -> Bool {
        if isServerMode {
            guard let checkin = try? await APIClient.shared.checkinMood(mood: mood, stressSources: stressSources, note: note) else {
                return false
            }
            moodToday = checkin
            moodCheckedToday = true
            if let trend = try? await APIClient.shared.fetchMoodTrends() {
                moodTrend = trend
            }
            return true
        }
        // 演示模式：本地记录
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        moodToday = MoodCheckin(
            date: formatter.string(from: Date()),
            mood: mood, stressSources: stressSources, note: note, createdAt: nil
        )
        moodCheckedToday = true
        return true
    }

    /// 情绪 AI 总结
    func loadMoodSummary() async {
        guard isServerMode else { return }
        if let summary = try? await APIClient.shared.fetchMoodSummary() {
            moodSummary = summary
        }
    }

    /// AI 识别吐槽文本（演示模式返回 nil，界面隐藏识别提示）
    func extractTags(text: String) async -> AIExtracted? {
        guard isServerMode else { return nil }
        guard let (extracted, _) = try? await APIClient.shared.extractTagsAI(text: text) else { return nil }
        return extracted
    }

    /// AI 同事关系解读
    func relationshipSummary(colleagueId: String) async -> RelationshipSummary? {
        guard isServerMode else { return nil }
        return try? await APIClient.shared.getRelationshipSummary(colleagueId: colleagueId)
    }

    /// 职场人格
    func loadPersonality() async {
        guard isServerMode else { return }
        if let profile = try? await APIClient.shared.getPersonality() {
            personality = profile
        }
    }

    /// 批量拉取同事雷达（同事列表页）
    func loadRadarBatch() async {
        guard isServerMode, !colleagues.isEmpty else { return }
        let ids = colleagues.compactMap { $0.id.serverIDString }
        guard !ids.isEmpty else { return }
        if let items = try? await APIClient.shared.batchRadar(ids: ids) {
            radarByColleague = items
        }
    }

    /// 某同事的雷达评分（无记录返回默认 60）
    func radar(for colleague: ColleagueModel) -> RadarMap {
        if let serverID = colleague.id.serverIDString, let scores = radarByColleague[serverID] {
            return scores
        }
        return RadarMap(cooperation: 60, expertise: 60, communication: 60, support: 60, trust: 60)
    }

    /// 提交雷达评分（成功后本地同步）
    @discardableResult
    func saveRadar(colleagueId: String, scores: RadarMap) async -> Bool {
        if isServerMode {
            guard let saved = try? await APIClient.shared.postRadar(colleagueId: colleagueId, scores: scores) else {
                return false
            }
            radarByColleague[colleagueId] = saved
            return true
        }
        radarByColleague[colleagueId] = scores
        return true
    }

    // MARK: - v2 标签翻译（id → label）

    /// 行为标签 id（如 shift_blame）→ 中文标签（甩锅）
    func label(forBehaviorTag id: String) -> String {
        tagDict.behaviorTags.first(where: { $0.id == id })?.label ?? id
    }

    /// 同事类型 id（如 fish）→ 中文标签（摸鱼型）
    func label(forColleagueType id: String) -> String {
        tagDict.colleagueTypes.first(where: { $0.id == id })?.label ?? id
    }

    /// 压力源 id（如 boss）→ 中文标签（领导）
    func label(forStressSource id: String) -> String {
        tagDict.stressSources.first(where: { $0.id == id })?.label ?? id
    }

    /// 情绪倾向 id（如 tired）→ 中文标签（好累）
    func label(forSentiment id: String) -> String {
        tagDict.moods.first(where: { $0.id == id })?.label ?? id
    }

    // MARK: - 档案

    /// 更新自定义头像（上传已完成后调用）
    func updateAvatar(url: String) async {
        if isServerMode {
            if let user = try? await APIClient.shared.updateProfile(avatarUrl: url) {
                currentUser = UserModel(server: user)
                syncCurrentUserInAllUsers()
                return
            }
        }
        currentUser.avatarUrl = url
        syncCurrentUserInAllUsers()
    }

    /// 更新个人资料（昵称/简介/位置/头像）
    func updateProfile(nickname: String? = nil, bio: String? = nil, locationLabel: String? = nil, avatarUrl: String? = nil) async throws {
        if isServerMode {
            let user = try await APIClient.shared.updateProfile(nickname: nickname, bio: bio, locationLabel: locationLabel, avatarUrl: avatarUrl)
            currentUser = UserModel(server: user)
            syncCurrentUserInAllUsers()
            return
        }
        if let nickname { currentUser.userName = nickname }
        if let bio { currentUser.bio = bio }
        if let locationLabel { currentUser.locationLabel = locationLabel }
        if let avatarUrl { currentUser.avatarUrl = avatarUrl }
        syncCurrentUserInAllUsers()
    }

    /// 未读消息总数（消息 Tab 红点）
    var unreadTotal: Int {
        conversations.reduce(0) { $0 + $1.unreadCount }
    }

    // MARK: - 私有工具

    private func appendMessage(_ conversationID: UUID, _ message: ChatMessage) {
        var list = messagesByConversation[conversationID] ?? []
        list.append(message)
        messagesByConversation[conversationID] = list
    }

    private func updateConversationPreview(_ conversationID: UUID, text: String, time: Date) {
        guard let idx = conversations.firstIndex(where: { $0.id == conversationID }) else { return }
        conversations[idx].lastMessageText = text
        conversations[idx].lastTime = time
        conversations[idx].unreadCount = 0
    }

    // MARK: - 演示数据

    private static func user(
        _ id: String, _ name: String, _ avatar: String, _ bio: String, _ location: String,
        _ distance: Double?, _ credit: Double, _ verification: UserVerification, _ vip: Bool
    ) -> UserModel {
        UserModel(
            id: UUID(uuidString: id)!,
            userName: name,
            avatarSymbol: avatar,
            avatarUrl: nil,
            bio: bio,
            locationLabel: location,
            distanceKm: distance,
            creditScore: credit,
            verification: verification,
            isExposureVip: vip
        )
    }

    private static func makeCurrentUser() -> UserModel {
        user(
            "00000000-0000-0000-0000-000000000001",
            "阿青", "face.smiling", "职场吐槽选手 · 记录同事的千奇百怪", "北京 · 中关村",
            nil, 82, .full, false
        )
    }

    private static func makeOtherUsers() -> [UserModel] {
        [
            user("00000000-0000-0000-0000-000000000002", "林晓", "person.fill",
                 "互联网运营 · 爱吐槽需求变更", "北京 · 国贸", 3.2, 90, .full, true),
            user("00000000-0000-0000-0000-000000000003", "陈默", "person.circle",
                 "后端工程师 · 加班常客", "北京 · 798", 12.0, 78, .student, false),
            user("00000000-0000-0000-0000-000000000004", "苏晴", "person.crop.circle",
                 "UI 设计师 · 改稿专业户", "北京 · 中关村", 6.5, 85, .realname, false),
            user("00000000-0000-0000-0000-000000000005", "王野", "person.2.fill",
                 "产品经理 · 需求制造机", "北京 · 天桥", 8.0, 88, .realname, false),
            user("00000000-0000-0000-0000-000000000006", "周可", "person.3.fill",
                 "测试工程师 · 找茬达人", "北京 · 五道口", 1.5, 92, .full, false),
            user("00000000-0000-0000-0000-000000000007", "高远", "person.crop.square",
                 "运维 · 背锅侠", "北京 · 东四", 15.0, 75, .none, false),
            user("00000000-0000-0000-0000-000000000008", "韩雪", "person.crop.rectangle",
                 "数据分析 · 报表民工", "北京 · 西二旗", 5.8, 76, .realname, false),
            user("00000000-0000-0000-0000-000000000009", "白一凡", "person.and.person",
                 "实习僧 · 职场小白", "北京 · 清华园", 4.0, 84, .student, false),
            user("00000000-0000-0000-0000-00000000000A", "米粒", "person.fill.checkmark",
                 "HR · 招聘 KPI 选手", "北京 · 三里屯", 8.2, 88, .full, true),
            user("00000000-0000-0000-0000-00000000000B", "阿哲", "person.fill.questionmark",
                 "销售 · 背业绩压力", "北京 · 科技园", 20.0, 70, .none, false)
        ]
    }

    private func seedData() {
        // ---- 公司属性 ----
        let starTech = CompanyModel(
            id: UUID(uuidString: "A0000000-0000-0000-0000-000000000001")!,
            name: "星河科技", industry: "互联网", scale: "500-2000人",
            overtimeCulture: "996 常态化", welfare: "下午茶 + 健身房", location: "北京 · 中关村"
        )
        let blueWhale = CompanyModel(
            id: UUID(uuidString: "A0000000-0000-0000-0000-000000000002")!,
            name: "蓝鲸传媒", industry: "广告营销", scale: "50-200人",
            overtimeCulture: "项目制加班", welfare: "弹性打卡", location: "上海 · 静安"
        )
        let cloudEdu = CompanyModel(
            id: UUID(uuidString: "A0000000-0000-0000-0000-000000000003")!,
            name: "云图教育", industry: "在线教育", scale: "200-500人",
            overtimeCulture: "偶尔加班", welfare: "餐补 + 节日礼", location: "杭州 · 西湖"
        )
        companies = [starTech, blueWhale, cloudEdu]

        // ---- 同事档案（同事属性）----
        let wang = ColleagueModel(
            id: UUID(uuidString: "B0000000-0000-0000-0000-000000000001")!,
            name: "王经理", position: "技术经理", department: "研发部",
            relation: ColleagueRelation.boss.rawValue,
            attributeTags: ["画饼高手", "双标", "甩锅倾向"],
            companyId: starTech.id, companyName: starTech.name,
            notes: "周一画饼，周五甩锅，需求来回改", avatarSymbol: "👔", time: Date(timeIntervalSinceNow: -86400 * 30)
        )
        let zhang = ColleagueModel(
            id: UUID(uuidString: "B0000000-0000-0000-0000-000000000002")!,
            name: "张姐", position: "产品经理", department: "产品部",
            relation: ColleagueRelation.peer.rawValue,
            attributeTags: ["甩锅倾向", "难沟通"],
            companyId: starTech.id, companyName: starTech.name,
            notes: "需求文档经常改，上线出问题先甩锅", avatarSymbol: "💼", time: Date(timeIntervalSinceNow: -86400 * 20)
        )
        let li = ColleagueModel(
            id: UUID(uuidString: "B0000000-0000-0000-0000-000000000003")!,
            name: "李总", position: "CEO", department: "管理层",
            relation: ColleagueRelation.boss.rawValue,
            attributeTags: ["加班狂", "PUA"],
            companyId: blueWhale.id, companyName: blueWhale.name,
            notes: "深夜拉会，口头禅'辛苦一下'", avatarSymbol: "🧑‍💼", time: Date(timeIntervalSinceNow: -86400 * 15)
        )
        let wangXiao = ColleagueModel(
            id: UUID(uuidString: "B0000000-0000-0000-0000-000000000004")!,
            name: "运营小王", position: "运营专员", department: "运营部",
            relation: ColleagueRelation.peer.rawValue,
            attributeTags: ["抢功", "八卦"],
            companyId: cloudEdu.id, companyName: cloudEdu.name,
            notes: "汇报时把团队成果写成自己主导", avatarSymbol: "📣", time: Date(timeIntervalSinceNow: -86400 * 10)
        )
        let liTao = ColleagueModel(
            id: UUID(uuidString: "B0000000-0000-0000-0000-000000000005")!,
            name: "前端小李", position: "前端工程师", department: "研发部",
            relation: ColleagueRelation.subordinate.rawValue,
            attributeTags: ["细致", "靠谱"],
            companyId: starTech.id, companyName: starTech.name,
            notes: "code review 很认真，但同一个 bug 反复挑", avatarSymbol: "💻", time: Date(timeIntervalSinceNow: -86400 * 5)
        )
        colleagues = [wang, zhang, li, wangXiao, liTao]

        // ---- 同事状态（吐槽动态）----
        statuses = [
            StatusModel(
                authorName: currentUser.userName, avatarSymbol: currentUser.avatarSymbol,
                colleagueId: wang.id, colleagueName: wang.name,
                content: "周一例会又画饼：'明年上市大家都有股份'，去年也是这么说的🤡",
                themeTags: ["画饼", "双标"], softwareTags: ["腾讯会议"],
                mood: StatusMood.speechless.rawValue, time: Date(timeIntervalSinceNow: -1800)
            ),
            StatusModel(
                authorName: currentUser.userName, avatarSymbol: currentUser.avatarSymbol,
                colleagueId: zhang.id, colleagueName: zhang.name,
                content: "甩锅现场：需求是她提的，上线出问题说是我写的，聊天记录全在🙃",
                themeTags: ["甩锅"], softwareTags: ["企业微信"],
                mood: StatusMood.angry.rawValue, time: Date(timeIntervalSinceNow: -3600)
            ),
            StatusModel(
                userId: UUID(uuidString: "E0000000-0000-0000-0000-000000000001"),
                authorName: "陈默", avatarSymbol: "😩",
                colleagueId: li.id, colleagueName: li.name,
                content: "深夜 11 点拉群说'有个小改动，不急，明天聊'——然后发了一堆需求文档",
                themeTags: ["加班", "PUA"], softwareTags: ["钉钉"],
                mood: StatusMood.worried.rawValue, time: Date(timeIntervalSinceNow: -7200)
            ),
            StatusModel(
                userId: UUID(uuidString: "E0000000-0000-0000-0000-000000000002"),
                authorName: "苏晴", avatarSymbol: "😂",
                colleagueId: wangXiao.id, colleagueName: wangXiao.name,
                content: "抢功达人：明明是团队做的方案，汇报时全写成他主导，离谱",
                themeTags: ["抢功"], softwareTags: ["飞书"],
                mood: StatusMood.funny.rawValue, time: Date(timeIntervalSinceNow: -86400)
            ),
            StatusModel(
                userId: UUID(uuidString: "E0000000-0000-0000-0000-000000000003"),
                authorName: "周可", avatarSymbol: "🙄",
                colleagueId: liTao.id, colleagueName: liTao.name,
                content: "同一个 bug 我改了三遍，code review 每次都挑不同地方，心态崩了😇",
                themeTags: ["双标", "形式主义"], softwareTags: ["企业微信", "Git"],
                mood: StatusMood.helpless.rawValue, time: Date(timeIntervalSinceNow: -86400 * 2)
            )
        ]

        // ---- 会话（消息页演示数据）----
        let linXiao = allUsers[0]   // 林晓
        let zhouKe = allUsers[4]    // 周可
        let miLi = allUsers[8]      // 米粒

        let convo1 = Conversation(id: UUID(uuidString: "10000000-0000-0000-0000-000000000001")!,
                                  partner: linXiao, lastMessageText: "明天周会又要过进度，头大",
                                  lastTime: Date(timeIntervalSinceNow: -3600), unreadCount: 1)
        let convo2 = Conversation(id: UUID(uuidString: "10000000-0000-0000-0000-000000000002")!,
                                  partner: zhouKe, lastMessageText: "你们公司也天天开会吗",
                                  lastTime: Date(timeIntervalSinceNow: -86400 * 2), unreadCount: 0)
        let convo3 = Conversation(id: UUID(uuidString: "10000000-0000-0000-0000-000000000003")!,
                                  partner: miLi, lastMessageText: "摸鱼都摸不踏实",
                                  lastTime: Date(timeIntervalSinceNow: -7200), unreadCount: 2)
        conversations = [convo1, convo3, convo2]

        messagesByConversation[convo1.id] = [
            ChatMessage(senderIsMe: false, text: "你那个需求文档又改了三版吧😮‍💨", time: Date(timeIntervalSinceNow: -86400 * 2)),
            ChatMessage(senderIsMe: true, text: "可不是，产品经理说'就调一个小地方'", time: Date(timeIntervalSinceNow: -86400 * 2 + 600)),
            ChatMessage(senderIsMe: false, text: "最后改了半个页面", time: Date(timeIntervalSinceNow: -86400)),
            ChatMessage(senderIsMe: false, text: "明天周会又要过进度，头大", time: Date(timeIntervalSinceNow: -3600))
        ]
        messagesByConversation[convo2.id] = [
            ChatMessage(senderIsMe: false, text: "你们公司也天天开会吗", time: Date(timeIntervalSinceNow: -86400 * 4)),
            ChatMessage(senderIsMe: true, text: "一天三个会，下午全废了", time: Date(timeIntervalSinceNow: -86400 * 2))
        ]
        messagesByConversation[convo3.id] = [
            ChatMessage(senderIsMe: false, text: "我们一天三个会，下午全废了", time: Date(timeIntervalSinceNow: -86400)),
            ChatMessage(senderIsMe: true, text: "摸鱼都摸不踏实", time: Date(timeIntervalSinceNow: -86400 + 600)),
            ChatMessage(senderIsMe: false, text: "摸鱼都摸不踏实", time: Date(timeIntervalSinceNow: -7200))
        ]

        // ---- v2 吐槽广场演示数据（由内置吐槽动态生成）----
        feedComplaints = statuses.enumerated().map { index, s in
            ComplaintModel(
                id: "demo-\(index + 1)",
                userId: s.userId == nil ? "local-me" : "demo-user-\(index)",
                authorName: s.authorName,
                avatarSymbol: s.avatarSymbol,
                isAnonymous: false,
                content: s.content,
                colleagueId: s.colleagueId?.uuidString,
                colleagueName: s.colleagueName,
                category: nil,
                behaviorTags: [],
                sentiment: nil,
                aiExtracted: nil,
                likeCount: [23, 8, 45, 12, 5][index % 5],
                resonanceCount: [11, 3, 32, 6, 2][index % 5],
                hotScore: Double([98, 41, 133, 66, 20][index % 5]),
                liked: false,
                resonated: false,
                time: s.time
            )
        }
        myComplaints = feedComplaints.filter { $0.userId == "local-me" }
        topics = feedComplaints.prefix(3).map { c in
            TopicItem(
                id: c.id,
                snippet: c.content.count > 30 ? String(c.content.prefix(30)) + "…" : c.content,
                category: nil, sentiment: nil,
                hotScore: c.hotScore,
                resonanceCount: c.resonanceCount,
                likeCount: c.likeCount
            )
        }
    }

    // MARK: - v2 演示字典（离线兜底，与服务端 tags-dict 对齐）

    private static let demoTagDict = TagDict(
        colleagueTypes: [
            TagItem(id: "fish", label: "摸鱼型", emoji: "🐟"),
            TagItem(id: "loudmouth", label: "大嘴巴型", emoji: "📢"),
            TagItem(id: "invisible", label: "隐身型", emoji: "🥷"),
            TagItem(id: "shark", label: "竞争型", emoji: "🦈"),
            TagItem(id: "niceguy", label: "老好人型", emoji: "🤝"),
            TagItem(id: "leader", label: "领导型", emoji: "👑"),
            TagItem(id: "bomb", label: "情绪炸弹型", emoji: "🧨"),
            TagItem(id: "techstar", label: "技术大佬型", emoji: "🧠"),
            TagItem(id: "snake", label: "表面友好型", emoji: "🐍"),
            TagItem(id: "flat", label: "躺平型", emoji: "🧱"),
            TagItem(id: "rollking", label: "卷王型", emoji: "🚀"),
            TagItem(id: "twoface", label: "两面派", emoji: "🎭"),
            TagItem(id: "blamer", label: "甩锅型", emoji: "🧹"),
            TagItem(id: "ghost", label: "临时消失型", emoji: "🏃"),
            TagItem(id: "phoneaddict", label: "随时打电话型", emoji: "📞"),
            TagItem(id: "nightowl", label: "深夜消息型", emoji: "🌙")
        ],
        behaviorTags: [
            TagItem(id: "credit", label: "抢功劳", emoji: nil),
            TagItem(id: "shift_blame", label: "甩锅", emoji: nil),
            TagItem(id: "sudden_req", label: "临时加需求", emoji: nil),
            TagItem(id: "read_noreply", label: "已读不回", emoji: nil),
            TagItem(id: "meeting_bs", label: "会议废话", emoji: nil),
            TagItem(id: "spamm_at", label: "疯狂@人", emoji: nil),
            TagItem(id: "bigcake", label: "喜欢画大饼", emoji: nil),
            TagItem(id: "push_work", label: "工作推给别人", emoji: nil),
            TagItem(id: "faceup", label: "领导面前一个样", emoji: nil),
            TagItem(id: "faceprivate", label: "私下一个样", emoji: nil),
            TagItem(id: "pua", label: "喜欢PUA", emoji: nil),
            TagItem(id: "spam_msg", label: "消息轰炸", emoji: nil),
            TagItem(id: "aftershift", label: "下班找人", emoji: nil),
            TagItem(id: "weekend_job", label: "周末安排工作", emoji: nil)
        ],
        moods: [
            MoodItem(id: "happy", emoji: "😄", label: "元气"),
            MoodItem(id: "ok", emoji: "🙂", label: "还行"),
            MoodItem(id: "meh", emoji: "😐", label: "一般"),
            MoodItem(id: "tired", emoji: "😮‍💨", label: "好累"),
            MoodItem(id: "rage", emoji: "😡", label: "想辞职"),
            MoodItem(id: "doom", emoji: "💀", label: "不想活了")
        ],
        stressSources: [
            TagItem(id: "boss", label: "领导", emoji: nil),
            TagItem(id: "coworker", label: "同事", emoji: nil),
            TagItem(id: "client", label: "客户", emoji: nil),
            TagItem(id: "overtime", label: "加班", emoji: nil),
            TagItem(id: "meeting", label: "会议", emoji: nil),
            TagItem(id: "salary", label: "工资", emoji: nil),
            TagItem(id: "slack", label: "摸鱼", emoji: nil),
            TagItem(id: "sudden", label: "临时需求", emoji: nil),
            TagItem(id: "pua", label: "职场PUA", emoji: nil),
            TagItem(id: "other", label: "其他", emoji: nil)
        ],
        personalityTemplates: [
            PersonalityTemplate(id: "rational", label: "理智型打工人", emoji: "🐱", desc: "冷静观察职场，能用咖啡解决的问题绝不内耗"),
            PersonalityTemplate(id: "philosopher", label: "摸鱼哲学家", emoji: "🐟", desc: "深谙摸鱼之道，工作只是生活的间歇"),
            PersonalityTemplate(id: "loner", label: "独狼型职场人", emoji: "🐺", desc: "专注交付，少说多做，沟通成本=0"),
            PersonalityTemplate(id: "volatile", label: "高压易燃型", emoji: "🧨", desc: "情绪雷达全开，看不惯就炸，老板也敢怼"),
            PersonalityTemplate(id: "island", label: "技术孤岛", emoji: "🧑‍💻", desc: "沉浸在自己的代码宇宙，bug 是唯一的对手")
        ]
    )
}
