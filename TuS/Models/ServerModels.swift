import Foundation

// ============================================================
// 服务端数据模型（Server DTO）
// 服务端 JSON 为 camelCase，字段与 Swift 模型对齐，可直接解码；
// 服务端 id 为数字字符串，经 UUID(serverID:) 确定性映射为本地 UUID。
// ============================================================

// MARK: - 服务端枚举编码（服务端英文代码 ↔ 客户端中文展示）

extension UserVerification {
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        switch raw {
        case "student": self = .student
        case "realname": self = .realname
        case "full": self = .full
        default: self = .none
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(serverCode)
    }

    var serverCode: String {
        switch self {
        case .none: return "none"
        case .student: return "student"
        case .realname: return "realname"
        case .full: return "full"
        }
    }
}

// MARK: - 服务端 id ↔ 本地 UUID 确定性映射

extension UUID {
    /// 服务端数字 id → 稳定 UUID（"00000000-0000-0000-0000-" + 12 位**前导**补零）
    /// 注意：不能用 String.padding（它是在末尾补字符），必须手动前导补零
    init(serverID: String) {
        let digits = serverID.filter { $0.isNumber }
        let trimmed = digits.count > 12 ? String(digits.suffix(12)) : digits
        let padded = String(repeating: "0", count: max(0, 12 - trimmed.count)) + trimmed
        self = UUID(uuidString: "00000000-0000-0000-0000-\(padded)") ?? UUID()
    }

    /// 本地 UUID → 服务端数字 id（仅对 serverID 映射的 UUID 有效）
    var serverIDString: String? {
        let s = uuidString
        guard s.hasPrefix("00000000-0000-0000-0000-") else { return nil }
        let digits = String(s.suffix(12))
        let number = Int(digits) ?? 0
        return String(number)
    }
}

// MARK: - DTO（与服务端 JSON 一一对应）

struct ServerUser: Decodable {
    let id: String
    let username: String
    let userName: String
    let avatarSymbol: String
    let avatarUrl: String?
    let bio: String
    let locationLabel: String
    let distanceKm: Double?
    let creditScore: Double
    let verification: UserVerification
    let isExposureVip: Bool
    let exposureUntil: String?
    private let decodedLittleEnergyOutfit: LittleEnergyOutfit?

    var littleEnergyOutfit: LittleEnergyOutfit {
        decodedLittleEnergyOutfit?.normalized ?? .default
    }

    private enum CodingKeys: String, CodingKey {
        case id, username, userName, avatarSymbol, avatarUrl, bio, locationLabel
        case distanceKm, creditScore, verification, isExposureVip, exposureUntil
        case decodedLittleEnergyOutfit = "littleEnergyOutfit"
    }
}

struct ServerConversation: Decodable {
    let id: String
    let partner: ServerUser
    let lastMessageText: String
    let lastTime: Date
    let unreadCount: Int
}

struct ServerMessage: Decodable {
    let id: String
    let senderIsMe: Bool
    let text: String
    let mediaType: String?
    let mediaUrl: String?
    let orderId: String?
    let time: Date
    let isSystemNote: Bool
}

// MARK: - 吐槽同事核心 DTO

struct ServerStatus: Decodable {
    let id: String
    let userId: String
    let authorName: String
    let avatarSymbol: String
    let content: String
    let colleagueName: String?
    let themeTags: [String]
    let softwareTags: [String]
    let mood: String?
    let time: Date
}

struct ServerColleague: Decodable {
    let id: String
    let name: String
    let position: String
    let department: String
    let relation: String
    let attributeTags: [String]
    let companyId: String?
    let notes: String
    let avatarSymbol: String
    // v3 画像扩展（可选兼容旧响应）
    let age: Int?
    let weight: Double?
    let personalityScore: Double?
    let workplaceType: String?
    let riskLevel: String?
    // v3.1：照片头像 + 经典语录
    let avatarUrl: String?
    let quote: String?
}

struct ServerCompany: Decodable {
    let id: String
    let name: String
    let industry: String
    let scale: String
    let overtimeCulture: String
    let welfare: String
    let location: String
}

// MARK: - 首页概览 DTO

struct HomeOverview: Decodable, Equatable {
    let serverTime: Date
    let greetingPeriod: String
    let user: HomeOverviewUser
    let stats: HomeOverviewStats
    let moodToday: HomeMoodToday?
    let quickMoods: [HomeQuickMood]
    let latestComplaints: [HomeComplaintSummary]
    let personality: HomePersonalitySummary?
    let colleagueSummary: HomeColleagueSummary
}

struct HomeOverviewUser: Decodable, Equatable {
    let id: String
    let userName: String
    let littleEnergyOutfit: LittleEnergyOutfit
}

struct HomeOverviewStats: Decodable, Equatable {
    let moodCheckedToday: Bool
    let plazaComplaintCount: Int
    let myComplaintCount: Int
    let colleagueCount: Int
    let unreadMessageCount: Int
}

struct HomeMoodToday: Decodable, Equatable {
    let mood: String
    let stressSources: [String]
    let note: String
    let date: String
}

struct HomeQuickMood: Decodable, Identifiable, Equatable {
    let id: String
    let label: String
    let assetName: String
}

struct HomeComplaintSummary: Decodable, Identifiable, Equatable {
    let id: String
    let userId: String?
    let authorName: String
    let avatarSymbol: String
    let littleEnergyOutfit: LittleEnergyOutfit?
    let isAnonymous: Bool
    let content: String
    let sentiment: String?
    let likeCount: Int
    let resonanceCount: Int
    let commentCount: Int
    let time: Date
}

struct HomePersonalitySummary: Decodable, Equatable {
    let name: String
    let totalComplaints: Int
    let summary: String
}

struct HomeColleagueSummary: Decodable, Equatable {
    let count: Int
    let averageScore: Double?
    let healthScore: Int?
}

// MARK: - 响应包装

struct ServerVersion: Decodable {
    let current: String
    let updateMessage: String
    let downloadUrl: String
}

struct TokenResponse: Decodable { let token: String; let user: ServerUser }

/// 发送手机验证码响应（测试通道附带 devCode）
struct SmsCodeResponse: Decodable {
    let ok: Bool?
    let message: String
    let devCode: String?
}
struct UserResponse: Decodable { let user: ServerUser }
struct UsersResponse: Decodable { let users: [ServerUser] }
struct ConversationsResponse: Decodable { let conversations: [ServerConversation] }
struct ConversationResponse: Decodable { let conversation: ServerConversation }
struct MessagesResponse: Decodable {
    let messages: [ServerMessage]
    let hasMore: Bool?
}

struct StatusesResponse: Decodable { let statuses: [ServerStatus] }
struct StatusResponse: Decodable { let status: ServerStatus }
struct ColleaguesResponse: Decodable { let colleagues: [ServerColleague] }
struct ColleagueResponse: Decodable { let colleague: ServerColleague }
struct CompaniesResponse: Decodable { let companies: [ServerCompany] }
struct CompanyResponse: Decodable { let company: ServerCompany }

struct MessageSendResponse: Decodable {
    let message: ServerMessage?
    let blocked: Bool?
    let warning: String?
}
struct OkResponse: Decodable { let ok: Bool? }

/// 小程序（市场条目；详情接口附带 htmlContent 供沙箱运行）
struct MiniApp: Decodable {
    let id: String
    let userId: String
    let authorName: String
    let name: String
    let description: String
    let icon: String
    let version: String
    let sizeKb: Int
    let downloads: Int
    let htmlContent: String?
}
struct MiniAppsResponse: Decodable { let apps: [MiniApp] }
struct MiniAppResponse: Decodable { let app: MiniApp }
extension MiniApp: Identifiable {}

/// 小程序排行榜条目
struct ScoreEntry: Decodable, Identifiable {
    let rank: Int
    let playerName: String
    let score: Int
    var id: Int { rank }
}
struct ScoresResponse: Decodable { let scores: [ScoreEntry] }

// MARK: - DTO → 本地模型映射

extension UserModel {
    init(server: ServerUser) {
        self.init(
            id: UUID(serverID: server.id),
            userName: server.userName,
            avatarSymbol: server.avatarSymbol,
            avatarUrl: server.avatarUrl,
            bio: server.bio,
            locationLabel: server.locationLabel,
            distanceKm: server.distanceKm,
            creditScore: server.creditScore,
            verification: server.verification,
            isExposureVip: server.isExposureVip,
            exposureUntil: server.exposureUntil.flatMap { APIClient.parseDate($0) },
            littleEnergyOutfit: server.littleEnergyOutfit
        )
    }
}

extension Conversation {
    init(server: ServerConversation) {
        self.init(
            id: UUID(serverID: server.id),
            partner: UserModel(server: server.partner),
            lastMessageText: server.lastMessageText,
            lastTime: server.lastTime,
            unreadCount: server.unreadCount
        )
    }
}

extension ChatMessage {
    init(server: ServerMessage) {
        self.init(
            id: UUID(serverID: server.id),
            senderIsMe: server.senderIsMe,
            text: server.text,
            mediaType: server.mediaType,
            mediaUrl: server.mediaUrl,
            orderId: server.orderId,
            time: server.time,
            isSystemNote: server.isSystemNote
        )
    }
}

extension StatusModel {
    init(server: ServerStatus) {
        self.init(
            id: UUID(serverID: server.id),
            userId: UUID(serverID: server.userId),
            authorName: server.authorName,
            avatarSymbol: server.avatarSymbol,
            colleagueId: nil,
            colleagueName: server.colleagueName,
            content: server.content,
            themeTags: server.themeTags,
            softwareTags: server.softwareTags,
            mood: server.mood,
            time: server.time
        )
    }
}

extension ColleagueModel {
    init(server: ServerColleague) {
        self.init(
            id: UUID(serverID: server.id),
            name: server.name,
            position: server.position,
            department: server.department,
            relation: server.relation,
            attributeTags: server.attributeTags,
            companyId: server.companyId.flatMap { UUID(serverID: $0) },
            companyName: nil,
            notes: server.notes,
            avatarSymbol: server.avatarSymbol,
            avatarUrl: server.avatarUrl,
            quote: server.quote ?? ""
        )
    }
}

extension CompanyModel {
    init(server: ServerCompany) {
        self.init(
            id: UUID(serverID: server.id),
            name: server.name,
            industry: server.industry,
            scale: server.scale,
            overtimeCulture: server.overtimeCulture,
            welfare: server.welfare,
            location: server.location
        )
    }
}
