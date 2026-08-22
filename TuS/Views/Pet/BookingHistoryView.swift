import SwiftUI

/// 公司属性管理（列表 + 新增 / 编辑 / 删除）
struct CompanyListView: View {
    @EnvironmentObject private var store: MockDataStore
    @Environment(\.dismiss) private var dismiss

    @State private var showAdd = false
    @State private var editing: CompanyModel?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if store.companies.isEmpty {
                        EmptyStateView(
                            icon: "building.2",
                            title: "还没有公司属性",
                            message: "点右上角「+」，记录公司的加班文化与福利"
                        )
                        .padding(.top, 60)
                    } else {
                        ForEach(store.companies) { company in
                            CompanyCardView(company: company)
                                .onTapGesture {
                                    editing = company
                                }
                                .contextMenu {
                                    Button {
                                        editing = company
                                    } label: {
                                        Label("编辑", systemImage: "pencil")
                                    }
                                    Button(role: .destructive) {
                                        Task { await store.deleteCompany(id: company.id) }
                                    } label: {
                                        Label("删除", systemImage: "trash")
                                    }
                                }
                        }
                    }
                }
                .padding(16)
            }
            .background(Theme.bg)
            .navigationTitle("公司属性")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showAdd = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAdd) {
                CompanyEditView()
            }
            .sheet(item: $editing) { company in
                CompanyEditView(editing: company)
            }
        }
    }
}

#Preview {
    CompanyListView()
        .environmentObject(MockDataStore.shared)
}
