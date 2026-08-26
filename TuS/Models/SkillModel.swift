import Foundation

/// 档案认证级别（学生认证 / 实名认证，提升可信度）
enum UserVerification: String, Codable, CaseIterable, Identifiable {
    case none = "未认证"
    case student = "学生认证"
    case realname = "实名认证"
    case full = "双重认证"

    var id: String { rawValue }
}

/// 用户核心模型（吐槽同事：去掉技能维度，仅保留基础档案）
/// avatarSymbol：SF Symbol 占位；avatarUrl：自定义头像（服务器上传后返回的相对路径，优先显示）
struct UserModel: Codable, Identifiable, Hashable {
    let id: UUID
    var userName: String
    var avatarSymbol: String
    var avatarUrl: String?
    var bio: String
    var locationLabel: String
    var distanceKm: Double?          // 同城距离（同城匹配）
    var creditScore: Double          // 信用评分 0-100
    var verification: UserVerification
    var isExposureVip: Bool          // 保留字段（服务端兼容，UI 不再展示曝光）
    var exposureUntil: Date?
    var littleEnergyOutfit: LittleEnergyOutfit

    init(
        id: UUID = UUID(),
        userName: String,
        avatarSymbol: String,
        avatarUrl: String? = nil,
        bio: String,
        locationLabel: String,
        distanceKm: Double?,
        creditScore: Double,
        verification: UserVerification,
        isExposureVip: Bool = false,
        exposureUntil: Date? = nil,
        littleEnergyOutfit: LittleEnergyOutfit = .default
    ) {
        self.id = id
        self.userName = userName
        self.avatarSymbol = avatarSymbol
        self.avatarUrl = avatarUrl
        self.bio = bio
        self.locationLabel = locationLabel
        self.distanceKm = distanceKm
        self.creditScore = creditScore
        self.verification = verification
        self.isExposureVip = isExposureVip
        self.exposureUntil = exposureUntil
        self.littleEnergyOutfit = littleEnergyOutfit.normalized
    }
}
