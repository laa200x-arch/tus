import SwiftUI
import PhotosUI

/// 同事属性（Tab）：同事档案 + 公司属性 两大维度
struct ColleagueTabView: View {
    @EnvironmentObject private var store: MockDataStore
    @State private var segment: Segment = .colleagues
    @State private var showAddColleague = false
    @State private var showAddCompany = false

    enum Segment: String, CaseIterable, Identifiable {
        case colleagues = "同事档案"
        case companies = "公司属性"
        var id: String { rawValue }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header
                segmentPicker
                if segment == .colleagues {
                    colleaguesSection
                } else {
                    companiesSection
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(Theme.bg)
        .navigationTitle("同事属性")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable {
            if store.isServerMode {
                try? await store.refreshAll()
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    if segment == .colleagues { showAddColleague = true }
                    else { showAddCompany = true }
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddColleague) {
            ColleagueEditView()
        }
        .sheet(isPresented: $showAddCompany) {
            CompanyEditView()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("同事属性 · 公司属性")
                .font(.title2)
                .bold()
                .foregroundStyle(Theme.textPrimary)
            Text("给同事建个档案，给公司做个记录。四维标签，越记越清楚。")
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(.top, 4)
    }

    private var segmentPicker: some View {
        Picker("分类", selection: $segment) {
            ForEach(Segment.allCases) { s in
                Text(s.rawValue).tag(s)
            }
        }
        .pickerStyle(.segmented)
    }

    private var colleaguesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if store.colleagues.isEmpty {
                EmptyStateView(
                    icon: "person.2",
                    title: "还没有同事档案",
                    message: "点右上角「+」，记录第一位同事的属性"
                )
            } else {
                ForEach(store.colleagues) { colleague in
                    NavigationLink(destination: ColleagueDetailView(colleague: colleague)) {
                        ColleagueCardView(colleague: colleague)
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button(role: .destructive) {
                            Task { await store.deleteColleague(id: colleague.id) }
                        } label: {
                            Label("删除档案", systemImage: "trash")
                        }
                    }
                }
            }
        }
    }

    private var companiesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if store.companies.isEmpty {
                EmptyStateView(
                    icon: "building.2",
                    title: "还没有公司属性",
                    message: "点右上角「+」，记录第一家公司的加班文化与福利"
                )
            } else {
                ForEach(store.companies) { company in
                    CompanyCardView(company: company)
                        .contextMenu {
                            Button(role: .destructive) {
                                Task { await store.deleteCompany(id: company.id) }
                            } label: {
                                Label("删除公司", systemImage: "trash")
                            }
                        }
                }
            }
        }
    }
}

/// 同事档案卡片
struct ColleagueCardView: View {
    let colleague: ColleagueModel

    var body: some View {
        HStack(spacing: 12) {
            // v3.1：照片头像优先
            if let avatarUrl = colleague.avatarUrl, let url = URL(string: AppConfig.serverBase + avatarUrl) {
                AsyncImage(url: url) { img in
                    img.resizable().scaledToFill()
                } placeholder: {
                    ProgressView()
                }
                .frame(width: 46, height: 46)
                .clipShape(Circle())
            } else {
                LittleEnergyAvatarView(role: .darkColleague, size: 52)
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(colleague.name)
                        .font(.subheadline)
                        .bold()
                        .foregroundStyle(Theme.textPrimary)
                    if !colleague.relation.isEmpty {
                        Text(colleague.relation)
                            .font(.caption2)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(Theme.secondary))
                    }
                }
                Text([
                    colleague.position,
                    colleague.department
                ].filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.caption2)
                    .foregroundStyle(Theme.textSecondary)
                if !colleague.attributeTags.isEmpty {
                    tagLine(colleague.attributeTags, color: Theme.primary)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(Theme.textSecondary.opacity(0.6))
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }

    private func tagLine(_ tags: [String], color: Color) -> some View {
        HStack(spacing: 5) {
            ForEach(tags.prefix(4), id: \.self) { tag in
                Text(tag)
                    .font(.caption2)
                    .foregroundStyle(color)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(color.opacity(0.10)))
            }
            if tags.count > 4 {
                Text("+\(tags.count - 4)")
                    .font(.caption2)
                    .foregroundStyle(Theme.textSecondary)
            }
        }
    }
}

/// 公司属性卡片
struct CompanyCardView: View {
    let company: CompanyModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "building.2.fill")
                    .foregroundStyle(Theme.primary)
                Text(company.name)
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                if !company.scale.isEmpty {
                    Text(company.scale)
                        .font(.caption2)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            if !company.industry.isEmpty || !company.location.isEmpty {
                Text([company.industry, company.location].filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.caption2)
                    .foregroundStyle(Theme.textSecondary)
            }
            HStack(alignment: .top, spacing: 6) {
                Text("加班")
                    .font(.caption2)
                    .foregroundStyle(Theme.warning)
                Text(company.overtimeCulture.isEmpty ? "—" : company.overtimeCulture)
                    .font(.caption2)
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                Text("福利")
                    .font(.caption2)
                    .foregroundStyle(Theme.success)
                Text(company.welfare.isEmpty ? "—" : company.welfare)
                    .font(.caption2)
                    .foregroundStyle(Theme.textPrimary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }
}

/// 同事档案编辑（新增 / 修改）
struct ColleagueEditView: View {
    @EnvironmentObject private var store: MockDataStore
    @Environment(\.dismiss) private var dismiss

    let editing: ColleagueModel?

    @State private var name = ""
    @State private var position = ""
    @State private var department = ""
    @State private var relation = ""
    @State private var attributeTags: Set<String> = []
    @State private var companyId: UUID? = nil
    @State private var notes = ""
    @State private var avatarSymbol = "👤"
    @State private var showError = false
    // v3.1：照片头像 + 经典语录
    @State private var avatarUrl: String? = nil
    @State private var quote = ""
    @State private var avatarItem: PhotosPickerItem?
    @State private var isUploadingAvatar = false

    init(editing: ColleagueModel? = nil) {
        self.editing = editing
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("基本信息") {
                    TextField("姓名 / 称呼", text: $name)
                    TextField("职位（如：技术经理）", text: $position)
                    TextField("部门（如：研发部）", text: $department)
                    Picker("关系", selection: $relation) {
                        Text("未选择").tag("")
                        ForEach(ColleagueRelations.all, id: \.self) { r in
                            Text(r).tag(r)
                        }
                    }
                    Picker("关联公司（可选）", selection: $companyId) {
                        Text("未关联").tag(UUID?.none)
                        ForEach(store.companies) { c in
                            Text(c.name).tag(UUID?.some(c.id))
                        }
                    }
                }
                Section("头像") {
                    HStack(spacing: 14) {
                        // 照片预览或符号
                        Group {
                            if let avatarUrl, let url = URL(string: AppConfig.serverBase + avatarUrl) {
                                AsyncImage(url: url) { img in
                                    img.resizable().scaledToFill()
                                } placeholder: {
                                    ProgressView()
                                }
                                .frame(width: 56, height: 56)
                                .clipShape(Circle())
                            } else {
                                LittleEnergyAvatarView(role: .darkColleague, size: 62)
                            }
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            PhotosPicker(selection: $avatarItem, matching: .images) {
                                Label(isUploadingAvatar ? "上传中…" : "从相册选照片", systemImage: "photo")
                                    .font(.footnote)
                            }
                            .disabled(isUploadingAvatar)
                            if avatarUrl != nil {
                                Button("清除照片") {
                                    avatarUrl = nil
                                    avatarItem = nil
                                }
                                .font(.footnote)
                                .foregroundStyle(.red)
                            }
                        }
                    }
                    Text("未上传照片时固定显示无穿搭的黑化小能仔")
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                    .onChange(of: avatarItem) { newItem in
                        guard let newItem else { return }
                        Task {
                            isUploadingAvatar = true
                            defer { isUploadingAvatar = false }
                            if let data = try? await newItem.loadTransferable(type: Data.self) {
                                do {
                                    let url = try await APIClient.shared.uploadMedia(data: data, fileName: "colleague-avatar.jpg", mimeType: "image/jpeg")
                                    await MainActor.run {
                                        avatarUrl = url
                                        avatarSymbol = "👤"
                                    }
                                } catch {
                                    await MainActor.run { showError = true }
                                }
                            }
                        }
                    }
                }
                Section("属性标签（多选）") {
                    tagGrid(ColleagueAttrs.all, selected: $attributeTags)
                }
                Section("备注") {
                    TextField("TA 的经典语录（口头禅 / 名场面）", text: $quote)
                    TextField("记录 TA 的离谱瞬间…", text: $notes, axis: .vertical)
                        .lineLimit(2...5)
                }
            }
            .navigationTitle(editing == nil ? "添加同事" : "编辑同事")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .alert("保存失败", isPresented: $showError) {
                Button("好的", role: .cancel) {}
            } message: {
                Text("请检查网络后重试")
            }
            .onAppear(perform: load)
        }
    }

    private func load() {
        guard let c = editing else { return }
        name = c.name
        position = c.position
        department = c.department
        relation = c.relation
        attributeTags = Set(c.attributeTags)
        companyId = c.companyId
        notes = c.notes
        avatarSymbol = c.avatarSymbol.isEmpty ? "👤" : c.avatarSymbol
        avatarUrl = c.avatarUrl
        quote = c.quote
    }

    private func tagGrid(_ all: [String], selected: Binding<Set<String>>) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 76), spacing: 8)], spacing: 8) {
            ForEach(all, id: \.self) { tag in
                let active = selected.wrappedValue.contains(tag)
                Button {
                    if active { selected.wrappedValue.remove(tag) }
                    else { selected.wrappedValue.insert(tag) }
                } label: {
                    Text(tag)
                        .font(.caption2)
                        .foregroundStyle(active ? .white : Theme.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .background(Capsule().fill(active ? Theme.primary : Theme.cardBg))
                        .overlay(Capsule().stroke(Theme.divider, lineWidth: active ? 0 : 1))
                }
            }
        }
    }

    private func save() {
        let n = name.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty else { return }
        Task {
            do {
                if var c = editing {
                    c.name = n
                    c.position = position.trimmingCharacters(in: .whitespaces)
                    c.department = department.trimmingCharacters(in: .whitespaces)
                    c.relation = relation
                    c.attributeTags = Array(attributeTags)
                    c.companyId = companyId
                    c.notes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
                    c.avatarSymbol = avatarSymbol
                    c.avatarUrl = avatarUrl
                    c.quote = quote.trimmingCharacters(in: .whitespacesAndNewlines)
                    try await store.updateColleague(c)
                } else {
                    _ = try await store.addColleague(
                        name: n,
                        position: position.trimmingCharacters(in: .whitespaces),
                        department: department.trimmingCharacters(in: .whitespaces),
                        relation: relation,
                        attributeTags: Array(attributeTags),
                        companyId: companyId,
                        notes: notes.trimmingCharacters(in: .whitespacesAndNewlines),
                        avatarSymbol: avatarSymbol,
                        avatarUrl: avatarUrl,
                        quote: quote.trimmingCharacters(in: .whitespacesAndNewlines)
                    )
                }
                dismiss()
            } catch {
                showError = true
            }
        }
    }
}

/// 公司属性编辑（新增 / 修改）
struct CompanyEditView: View {
    @EnvironmentObject private var store: MockDataStore
    @Environment(\.dismiss) private var dismiss

    let editing: CompanyModel?

    @State private var name = ""
    @State private var industry = ""
    @State private var scale = ""
    @State private var overtimeCulture = ""
    @State private var welfare = ""
    @State private var location = ""
    @State private var showError = false

    init(editing: CompanyModel? = nil) {
        self.editing = editing
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("基本信息") {
                    TextField("公司名称", text: $name)
                    TextField("行业（如：互联网）", text: $industry)
                    TextField("规模（如：500-2000人）", text: $scale)
                    TextField("地点（如：北京·中关村）", text: $location)
                }
                Section("文化") {
                    TextField("加班文化（如：996 常态化）", text: $overtimeCulture)
                    TextField("福利（如：下午茶 + 健身房）", text: $welfare)
                }
            }
            .navigationTitle(editing == nil ? "添加公司" : "编辑公司")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .alert("保存失败", isPresented: $showError) {
                Button("好的", role: .cancel) {}
            } message: {
                Text("请检查网络后重试")
            }
            .onAppear(perform: load)
        }
    }

    private func load() {
        guard let c = editing else { return }
        name = c.name
        industry = c.industry
        scale = c.scale
        overtimeCulture = c.overtimeCulture
        welfare = c.welfare
        location = c.location
    }

    private func save() {
        let n = name.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty else { return }
        Task {
            do {
                if var c = editing {
                    c.name = n
                    c.industry = industry.trimmingCharacters(in: .whitespaces)
                    c.scale = scale.trimmingCharacters(in: .whitespaces)
                    c.overtimeCulture = overtimeCulture.trimmingCharacters(in: .whitespaces)
                    c.welfare = welfare.trimmingCharacters(in: .whitespaces)
                    c.location = location.trimmingCharacters(in: .whitespaces)
                    try await store.updateCompany(c)
                } else {
                    _ = try await store.addCompany(
                        name: n,
                        industry: industry.trimmingCharacters(in: .whitespaces),
                        scale: scale.trimmingCharacters(in: .whitespaces),
                        overtimeCulture: overtimeCulture.trimmingCharacters(in: .whitespaces),
                        welfare: welfare.trimmingCharacters(in: .whitespaces),
                        location: location.trimmingCharacters(in: .whitespaces)
                    )
                }
                dismiss()
            } catch {
                showError = true
            }
        }
    }
}

#Preview {
    NavigationStack {
        ColleagueTabView()
            .environmentObject(MockDataStore.shared)
    }
}
