import Foundation

/// 后端 API 错误
enum APIError: LocalizedError, Equatable {
    case server(message: String)
    case network
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .server(let message): return message
        case .network: return "网络连接失败，请检查网络或服务器状态"
        case .unauthorized: return "登录已过期，请重新登录"
        }
    }
}

/// 后端 API 客户端（方案 4.1：Express 后端，REST）
final class APIClient {
    static let shared = APIClient()

    private let base = AppConfig.serverBase
    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        session = URLSession(configuration: config)
    }

    private var token: String? { TokenStore.token }

    // MARK: - JSON 解码（ISO8601 含/不含毫秒）

    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        decoder.dateDecodingStrategy = .custom { decoder in
            let raw = try decoder.singleValueContainer().decode(String.self)
            if let date = fractional.date(from: raw) ?? plain.date(from: raw) { return date }
            throw DecodingError.dataCorrupted(.init(
                codingPath: decoder.codingPath,
                debugDescription: "无法解析日期: \(raw)"
            ))
        }
        return decoder
    }()

    static func parseDate(_ string: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        return fractional.date(from: string) ?? plain.date(from: string)
    }

    // MARK: - 基础请求

    private func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        body: [String: Any]? = nil,
        query: [String: String]? = nil
    ) async throws -> T {
        var urlString = "\(base)\(path)"
        if let query, !query.isEmpty {
            var components = URLComponents(string: urlString)!
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
            urlString = components.url!.absoluteString
        }
        var request = URLRequest(url: URL(string: urlString)!)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.network
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.network }
        guard (200...299).contains(http.statusCode) else {
            if http.statusCode == 401 { throw APIError.unauthorized }
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
                ?? "请求失败（HTTP \(http.statusCode)）"
            throw APIError.server(message: message)
        }
        return try Self.decoder.decode(T.self, from: data)
    }

    // MARK: - 认证

    func login(username: String, password: String) async throws -> ServerUser {
        let response: TokenResponse = try await request("/api/auth/login", method: "POST",
            body: ["username": username, "password": password])
        TokenStore.token = response.token
        return response.user
    }

    func register(username: String, password: String, nickname: String, phone: String? = nil, code: String? = nil) async throws -> ServerUser {
        var body: [String: Any] = ["username": username, "password": password, "nickname": nickname]
        if let phone { body["phone"] = phone }
        if let code { body["code"] = code }
        let response: TokenResponse = try await request("/api/auth/register", method: "POST", body: body)
        TokenStore.token = response.token
        return response.user
    }

    /// 发送注册手机验证码（每个手机号仅可注册一个账号）
    /// 返回 devCode（测试通道自动附带；接入真实短信网关后不再返回）
    func sendSmsCode(phone: String) async throws -> (message: String, devCode: String?) {
        let response: SmsCodeResponse = try await request("/api/auth/phone/send-code", method: "POST",
            body: ["phone": phone])
        return (response.message, response.devCode)
    }

    /// 忘记密码：向已注册手机号发送重置验证码
    func sendForgotCode(phone: String) async throws -> (message: String, devCode: String?) {
        let response: SmsCodeResponse = try await request("/api/auth/phone/forgot-code", method: "POST",
            body: ["phone": phone])
        return (response.message, response.devCode)
    }

    /// 重置密码（手机号 + 验证码 + 新密码）
    func resetPassword(phone: String, code: String, newPassword: String) async throws {
        let _: OkResponse = try await request("/api/auth/reset-password", method: "POST",
            body: ["phone": phone, "code": code, "newPassword": newPassword])
    }

    // MARK: - 用户与匹配

    func fetchMe() async throws -> ServerUser {
        let response: UserResponse = try await request("/api/me")
        return response.user
    }

    // MARK: - 吐槽同事核心数据

    /// 拉取同事状态（吐槽动态）列表
    func fetchStatuses() async throws -> [ServerStatus] {
        let response: StatusesResponse = try await request("/api/statuses")
        return response.statuses
    }

    /// 发布一条同事状态（content 必填；colleagueId/themeTags/softwareTags/mood 可选）
    @discardableResult
    func postStatus(
        content: String,
        colleagueId: String? = nil,
        themeTags: [String] = [],
        softwareTags: [String] = [],
        mood: String? = nil
    ) async throws -> ServerStatus {
        var body: [String: Any] = [
            "content": content,
            "themeTags": themeTags,
            "softwareTags": softwareTags
        ]
        if let colleagueId { body["colleagueId"] = colleagueId }
        if let mood { body["mood"] = mood }
        let response: StatusResponse = try await request("/api/statuses", method: "POST", body: body)
        return response.status
    }

    /// 删除自己的同事状态
    func deleteStatus(id: String) async throws {
        let _: OkResponse = try await request("/api/statuses/\(id)", method: "DELETE")
    }

    /// 拉取同事档案列表
    func fetchColleagues() async throws -> [ServerColleague] {
        let response: ColleaguesResponse = try await request("/api/colleagues")
        return response.colleagues
    }

    /// 新增同事档案
    func addColleague(_ body: [String: Any]) async throws -> ServerColleague {
        let response: ColleagueResponse = try await request("/api/colleagues", method: "POST", body: body)
        return response.colleague
    }

    /// 更新同事档案
    func updateColleague(id: String, _ body: [String: Any]) async throws -> ServerColleague {
        let response: ColleagueResponse = try await request("/api/colleagues/\(id)", method: "PUT", body: body)
        return response.colleague
    }

    /// 删除同事档案
    func deleteColleague(id: String) async throws {
        let _: OkResponse = try await request("/api/colleagues/\(id)", method: "DELETE")
    }

    /// 拉取公司属性列表
    func fetchCompanies() async throws -> [ServerCompany] {
        let response: CompaniesResponse = try await request("/api/companies")
        return response.companies
    }

    /// 新增公司属性
    func addCompany(_ body: [String: Any]) async throws -> ServerCompany {
        let response: CompanyResponse = try await request("/api/companies", method: "POST", body: body)
        return response.company
    }

    /// 更新公司属性
    func updateCompany(id: String, _ body: [String: Any]) async throws -> ServerCompany {
        let response: CompanyResponse = try await request("/api/companies/\(id)", method: "PUT", body: body)
        return response.company
    }

    /// 删除公司属性
    func deleteCompany(id: String) async throws {
        let _: OkResponse = try await request("/api/companies/\(id)", method: "DELETE")
    }

    // MARK: - 用户列表

    func fetchUsers(keyword: String = "") async throws -> [ServerUser] {
        var query: [String: String] = [:]
        if !keyword.isEmpty { query["keyword"] = keyword }
        let response: UsersResponse = try await request("/api/users", query: query)
        return response.users
    }

    /// 拉取指定用户最新资料（资料页打开时刷新快照）
    func fetchUser(id: String) async throws -> ServerUser {
        let response: UserResponse = try await request("/api/users/\(id)")
        return response.user
    }

    // MARK: - 聊天

    func fetchConversations() async throws -> [ServerConversation] {
        let response: ConversationsResponse = try await request("/api/conversations")
        return response.conversations
    }

    func openConversation(partnerId: String) async throws -> ServerConversation {
        let response: ConversationResponse = try await request("/api/conversations/open", method: "POST",
            body: ["partnerId": partnerId])
        return response.conversation
    }

    /// 拉取会话历史消息（分页：默认最近 50 条；before 加载更早）
    /// 返回 (消息, 是否还有更早)
    func fetchMessages(conversationId: String, limit: Int = 50, before: String? = nil) async throws -> ([ServerMessage], Bool) {
        var query: [String: String] = ["limit": String(limit)]
        if let before { query["before"] = before }
        let response: MessagesResponse = try await request(
            "/api/conversations/\(conversationId)/messages",
            query: query
        )
        return (response.messages, response.hasMore ?? false)
    }

    func markConversationRead(conversationId: String) async throws {
        let _: OkResponse = try await request("/api/conversations/\(conversationId)/read", method: "POST")
    }

    /// REST 发送消息（Socket 失败时的兜底通道，服务端同一套风控；支持媒体消息与订单引用）
    func sendMessage(conversationId: String, text: String, mediaType: String? = nil, mediaUrl: String? = nil, orderId: String? = nil) async throws -> MessageSendResponse {
        var body: [String: Any] = ["conversationId": conversationId, "text": text]
        if let mediaType { body["mediaType"] = mediaType }
        if let mediaUrl { body["mediaUrl"] = mediaUrl }
        if let orderId { body["orderId"] = orderId }
        return try await request("/api/messages", method: "POST", body: body)
    }

    /// 上传媒体文件（聊天图片/视频），返回相对路径（如 /uploads/xxx.jpg）
    func uploadMedia(data: Data, fileName: String, mimeType: String) async throws -> String {
        var request = URLRequest(url: URL(string: "\(base)/api/upload")!)
        request.httpMethod = "POST"
        request.setValue("application/octet-stream", forHTTPHeaderField: "Accept")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let boundary = "Boundary-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        let responseData: Data
        let response: URLResponse
        do {
            (responseData, response) = try await session.data(for: request)
        } catch {
            throw APIError.network
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.network }
        guard (200...299).contains(http.statusCode) else {
            if http.statusCode == 401 { throw APIError.unauthorized }
            let message = (try? JSONDecoder().decode([String: String].self, from: responseData))?["error"]
                ?? "上传失败（HTTP \(http.statusCode)）"
            throw APIError.server(message: message)
        }
        struct UploadResponse: Decodable { let url: String }
        return try Self.decoder.decode(UploadResponse.self, from: responseData).url
    }

    // MARK: - 小程序市场

    func fetchApps(keyword: String = "") async throws -> [MiniApp] {
        var query: [String: String] = [:]
        if !keyword.isEmpty { query["keyword"] = keyword }
        let response: MiniAppsResponse = try await request("/api/apps", query: query)
        return response.apps
    }

    func fetchAppDetail(id: String) async throws -> MiniApp {
        let response: MiniAppResponse = try await request("/api/apps/\(id)")
        return response.app
    }

    func fetchScores(appId: String) async throws -> [ScoreEntry] {
        let response: ScoresResponse = try await request("/api/apps/\(appId)/scores")
        return response.scores
    }

    func submitScore(appId: String, score: Int, playerName: String) async throws {
        let _: OkResponse = try await request("/api/apps/\(appId)/score", method: "POST",
            body: ["score": score, "playerName": playerName])
    }

    // MARK: - 档案

    /// 更新资料（支持昵称/简介/位置/自定义头像）
    func updateProfile(nickname: String? = nil, bio: String? = nil, locationLabel: String? = nil, avatarUrl: String? = nil) async throws -> ServerUser {
        var body: [String: Any] = [:]
        if let nickname { body["nickname"] = nickname }
        if let bio { body["bio"] = bio }
        if let locationLabel { body["locationLabel"] = locationLabel }
        if let avatarUrl { body["avatarUrl"] = avatarUrl }
        let response: UserResponse = try await request("/api/me/profile", method: "PUT", body: body)
        return response.user
    }

    // MARK: - 版本检查

    func fetchVersion() async throws -> ServerVersion {
        try await request("/api/version")
    }

    // MARK: - v2 职场关系操作系统（吐槽广场 / 情绪打卡 / AI / 关系雷达）

    /// 字典（同事类型/行为标签/情绪/压力源/人格模板，公开接口）
    func fetchTags() async throws -> TagDict {
        try await request("/api/tags")
    }

    /// 吐槽广场 feed（sort: "hot" 热度 / "new" 最新；filter: recommend/new/anonymous/colleague/mine）
    func fetchFeedComplaints(sort: String = "hot", filter: String = "recommend") async throws -> [ComplaintModel] {
        let response: ComplaintsFeedResponse = try await request("/api/complaints/feed", query: ["sort": sort, "filter": filter])
        return response.complaints
    }

    /// 我的吐槽
    func fetchMineComplaints() async throws -> [ComplaintModel] {
        let response: ComplaintsFeedResponse = try await request("/api/complaints/mine")
        return response.complaints
    }

    /// 热搜榜（top 10，按热度）
    func fetchTopics() async throws -> [TopicItem] {
        let response: TopicsResponse = try await request("/api/complaints/topics")
        return response.topics
    }

    /// 评论列表
    func fetchComplaintComments(id: String) async throws -> [ComplaintComment] {
        let response: CommentsResponse = try await request("/api/complaints/\(id)/comments")
        return response.comments
    }

    /// 发表评论
    @discardableResult
    func postComplaintComment(id: String, content: String) async throws -> ComplaintComment {
        let response: CommentResponse = try await request("/api/complaints/\(id)/comments", method: "POST", body: ["content": content])
        return response.comment
    }

    /// 删除评论（仅本人或吐槽作者）
    func deleteComplaintComment(complaintId: String, commentId: String) async throws {
        let _: OkResponse = try await request("/api/complaints/\(complaintId)/comments/\(commentId)", method: "DELETE")
    }

    /// 首页统计（设计稿 4 卡：今日吐槽 / 共鸣点赞 / 同事评分 / 关系健康）
    func fetchHomeStats() async throws -> HomeStats {
        let response: HomeStatsResponse = try await request("/api/home/stats")
        return response.stats
    }

    /// 全局搜索（吐槽 / 同事 / 公司）
    func searchAll(query: String) async throws -> SearchResults {
        try await request("/api/search", query: ["q": query])
    }

    // MARK: - v3 品行系统 + 聊天分析

    /// 拉取我对同事的六维品行打分
    func getPersona(colleagueId: String) async throws -> (scored: Bool, scores: PersonaScores) {
        let response: PersonaGetResponse = try await request("/api/persona/\(colleagueId)")
        return (response.scored, response.scores)
    }

    /// 提交六维品行打分
    @discardableResult
    func postPersona(colleagueId: String, scores: PersonaScores) async throws -> PersonaScores {
        let response: PersonaPostResponse = try await request("/api/persona/\(colleagueId)", method: "POST", body: ["scores": [
            "eq": scores.eq, "responsibility": scores.responsibility, "control": scores.control,
            "execution": scores.execution, "showmanship": scores.showmanship, "temper": scores.temper
        ]])
        return response.scores
    }

    /// 品行预测（人格标签 + 行为预测）
    func getPersonaPrediction(colleagueId: String) async throws -> PersonaPrediction {
        try await request("/api/persona/\(colleagueId)/prediction")
    }

    /// 聊天记录分析（text：多行消息）
    func analyzeChat(text: String) async throws -> ChatAnalysis {
        try await request("/api/analysis/chat", method: "POST", body: ["text": text])
    }

    /// 发布吐槽（内容必填；其余可选；AI 识别结果一并随 aiExtracted 提交）
    @discardableResult
    func postComplaint(
        content: String,
        colleagueId: String? = nil,
        category: String? = nil,
        behaviorTags: [String] = [],
        sentiment: String? = nil,
        isAnonymous: Bool = false,
        aiExtracted: AIExtracted? = nil
    ) async throws -> ComplaintModel {
        var body: [String: Any] = [
            "content": content,
            "behaviorTags": behaviorTags,
            "isAnonymous": isAnonymous
        ]
        if let colleagueId { body["colleagueId"] = colleagueId }
        if let category { body["category"] = category }
        if let sentiment { body["sentiment"] = sentiment }
        if let aiExtracted {
            var extracted: [String: Any] = [:]
            if let c = aiExtracted.category { extracted["category"] = c }
            if let t = aiExtracted.behaviorTags { extracted["behaviorTags"] = t }
            if let s = aiExtracted.sentiment { extracted["sentiment"] = s }
            body["aiExtracted"] = extracted
        }
        let response: ComplaintResponse = try await request("/api/complaints", method: "POST", body: body)
        return response.complaint
    }

    /// 删除自己的吐槽
    func deleteComplaint(id: String) async throws {
        let _: OkResponse = try await request("/api/complaints/\(id)", method: "DELETE")
    }

    /// 点赞（toggle），返回最新状态与计数
    @discardableResult
    func toggleLikeComplaint(id: String) async throws -> (liked: Bool, likeCount: Int) {
        let response: LikeToggleResponse = try await request("/api/complaints/\(id)/like", method: "POST")
        return (response.liked, response.likeCount)
    }

    /// 共鸣（toggle），返回最新状态与计数
    @discardableResult
    func toggleResonateComplaint(id: String) async throws -> (resonated: Bool, resonanceCount: Int) {
        let response: ResonateToggleResponse = try await request("/api/complaints/\(id)/resonate", method: "POST")
        return (response.resonated, response.resonanceCount)
    }

    /// 今日情绪打卡状态（未打卡时 checkin 为 nil）
    func fetchMoodToday() async throws -> (checked: Bool, checkin: MoodCheckin?) {
        let response: MoodTodayResponse = try await request("/api/mood/today")
        guard response.checked else { return (false, nil) }
        let checkin = MoodCheckin(
            date: response.date,
            mood: response.mood,
            stressSources: response.stressSources,
            note: response.note,
            createdAt: response.createdAt
        )
        return (true, checkin)
    }

    /// 每日打卡（同日重复提交为覆盖更新）
    @discardableResult
    func checkinMood(mood: String, stressSources: [String] = [], note: String = "") async throws -> MoodCheckin {
        let response: MoodCheckinResponse = try await request("/api/mood/checkin", method: "POST",
            body: ["mood": mood, "stressSources": stressSources, "note": note])
        return MoodCheckin(
            date: response.date,
            mood: response.mood,
            stressSources: response.stressSources,
            note: response.note,
            createdAt: nil
        )
    }

    /// 最近 N 天情绪趋势（按日聚合，缺失日 mood 为 nil；N 取值 7-60）
    func fetchMoodTrends(days: Int = 30) async throws -> [MoodTrendPoint] {
        let response: MoodTrendsResponse = try await request("/api/mood/trends", query: ["days": String(days)])
        return response.trend
    }

    /// 情绪 AI 总结（最近 30 天压力源分布 + 高低峰 + 洞察）
    func fetchMoodSummary() async throws -> MoodSummary {
        try await request("/api/mood/summary")
    }

    /// AI 识别吐槽文本 → 同事类型 / 行为标签 / 情绪倾向（关键词词典版）
    func extractTagsAI(text: String) async throws -> (extracted: AIExtracted, hasMatch: Bool) {
        let response: ExtractTagsResponse = try await request("/api/ai/extract-tags", method: "POST",
            body: ["text": text])
        let extracted = AIExtracted(
            category: response.category,
            behaviorTags: response.behaviorTags ?? [],
            sentiment: response.sentiment
        )
        return (extracted, response.hasMatch)
    }

    /// AI 同事关系解读（基于吐槽记录 + 雷达评分）
    func getRelationshipSummary(colleagueId: String) async throws -> RelationshipSummary {
        try await request("/api/ai/relationship/\(colleagueId)")
    }

    /// 我的职场人格
    func getPersonality() async throws -> PersonalityProfile {
        let response: PersonalityResponse = try await request("/api/ai/personality")
        return PersonalityProfile(
            personality: response.personality,
            emoji: response.emoji,
            desc: response.desc,
            stats: response.stats,
            disclaimer: response.disclaimer
        )
    }

    /// 拉取我对某同事的雷达评分（未评分时返回默认 60 分，scored=false）
    func getRadar(colleagueId: String) async throws -> (scored: Bool, scores: RadarMap) {
        let response: RadarGetResponse = try await request("/api/radar/\(colleagueId)")
        return (response.scored, response.scores)
    }

    /// 提交雷达评分（5 维 0-100，单人对单同事唯一，重复提交覆盖）
    @discardableResult
    func postRadar(colleagueId: String, scores: RadarMap) async throws -> RadarMap {
        let body: [String: Any] = ["scores": [
            "cooperation": scores.cooperation,
            "expertise": scores.expertise,
            "communication": scores.communication,
            "support": scores.support,
            "trust": scores.trust
        ]]
        let response: RadarPostResponse = try await request("/api/radar/\(colleagueId)", method: "POST", body: body)
        return response.scores
    }

    /// 批量拉取多个同事的雷达评分（key 为同事 id 字符串，未评分返回默认 60）
    func batchRadar(ids: [String]) async throws -> [String: RadarMap] {
        struct BatchRadarResponse: Decodable { let items: [String: RadarMap] }
        let response: BatchRadarResponse = try await request("/api/radar/batch", method: "POST",
            body: ["ids": ids])
        return response.items
    }
}

// MARK: - v2 响应包装

private struct ComplaintsFeedResponse: Decodable {
    let complaints: [ComplaintModel]
}

private struct ComplaintResponse: Decodable {
    let complaint: ComplaintModel
}

private struct TopicsResponse: Decodable {
    let topics: [TopicItem]
}

private struct LikeToggleResponse: Decodable {
    let liked: Bool
    let likeCount: Int
}

private struct ResonateToggleResponse: Decodable {
    let resonated: Bool
    let resonanceCount: Int
}

private struct MoodTodayResponse: Decodable {
    let checked: Bool
    let date: String
    let mood: String?
    let stressSources: [String]?
    let note: String?
    let createdAt: String?
}

private struct MoodCheckinResponse: Decodable {
    let ok: Bool
    let date: String
    let mood: String
    let stressSources: [String]
    let note: String?
}

private struct MoodTrendsResponse: Decodable {
    let days: Int
    let trend: [MoodTrendPoint]
}

private struct ExtractTagsResponse: Decodable {
    let category: String?
    let behaviorTags: [String]?
    let sentiment: String?
    let hasMatch: Bool
}

private struct PersonalityResponse: Decodable {
    let personality: String
    let emoji: String
    let desc: String
    let stats: PersonalityStats
    let disclaimer: String
}

private struct RadarGetResponse: Decodable {
    let scored: Bool
    let colleagueId: String
    let scores: RadarMap
}

private struct RadarPostResponse: Decodable {
    let ok: Bool
    let scores: RadarMap
}

private struct CommentsResponse: Decodable {
    let comments: [ComplaintComment]
}

private struct CommentResponse: Decodable {
    let comment: ComplaintComment
}

private struct HomeStatsResponse: Decodable {
    let stats: HomeStats
}

private struct PersonaGetResponse: Decodable {
    let scored: Bool
    let colleagueId: String
    let scores: PersonaScores
}

private struct PersonaPostResponse: Decodable {
    let ok: Bool
    let scores: PersonaScores
}
