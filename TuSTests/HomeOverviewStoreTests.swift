import XCTest
@testable import TuS

@MainActor
final class HomeOverviewStoreTests: XCTestCase {
    func testLoadHomeOverviewStoresPayloadAndReconcilesMoodAndOutfit() async {
        let overview = makeOverview(
            mood: "😡",
            outfit: HomeOverviewOutfit(
                topId: "top_hoodie",
                bottomId: "bottom_jeans",
                shoesId: "shoes_canvas",
                accessoryIds: ["accessory_hat"]
            )
        )
        let store = MockDataStore(homeOverviewLoader: { overview })

        await store.loadHomeOverview()

        XCTAssertEqual(store.homeOverview, overview)
        XCTAssertEqual(store.homeOverviewPhase, .loaded)
        XCTAssertTrue(store.moodCheckedToday)
        XCTAssertEqual(store.moodToday?.mood, "xnz_angry")
        XCTAssertEqual(store.currentMoodID, "xnz_angry")
        XCTAssertEqual(store.currentUser.littleEnergyOutfit, overview.user.littleEnergyOutfit.asLittleEnergyOutfit.normalized)
    }

    func testLoadFailurePreservesCachedOverviewAndRetryLoadsFreshPayload() async {
        let cached = makeOverview(mood: "xnz_calm")
        let refreshed = makeOverview(mood: "xnz_excited")
        let loader = OverviewLoaderStub(results: [
            .success(cached),
            .failure(OverviewLoaderError.unavailable),
            .success(refreshed)
        ])
        let store = MockDataStore(homeOverviewLoader: { try await loader.load() })

        await store.loadHomeOverview()
        await store.loadHomeOverview(force: true)

        XCTAssertEqual(store.homeOverview, cached)
        XCTAssertEqual(store.homeOverviewPhase, .failed(message: "首页概览暂时不可用，请重试"))

        await store.loadHomeOverview(force: true)

        XCTAssertEqual(store.homeOverview, refreshed)
        XCTAssertEqual(store.homeOverviewPhase, .loaded)
        XCTAssertEqual(store.currentMoodID, "xnz_excited")
    }

    func testStaleHomeOverviewResponseCannotOverwriteNewerResponse() async {
        let older = makeOverview(mood: "xnz_tired")
        let newer = makeOverview(mood: "xnz_motivated")
        let loader = DeferredOverviewLoader()
        let store = MockDataStore(homeOverviewLoader: { try await loader.load() })

        let first = Task { @MainActor in await store.loadHomeOverview(force: true) }
        await waitForRequestCount(1, from: loader)
        let second = Task { @MainActor in await store.loadHomeOverview(force: true) }
        await waitForRequestCount(2, from: loader)

        await loader.resolveRequest(at: 1, with: newer)
        await second.value
        await loader.resolveRequest(at: 0, with: older)
        await first.value

        XCTAssertEqual(store.homeOverview, newer)
        XCTAssertEqual(store.homeOverviewPhase, .loaded)
        XCTAssertEqual(store.currentMoodID, "xnz_motivated")
    }

    func testLogoutResetsHomeOverviewState() async {
        let overview = makeOverview(mood: "xnz_calm")
        let store = MockDataStore(homeOverviewLoader: { overview })

        await store.loadHomeOverview()
        store.logout()

        XCTAssertNil(store.homeOverview)
        XCTAssertEqual(store.homeOverviewPhase, .idle)
    }

    private func waitForRequestCount(_ expected: Int, from loader: DeferredOverviewLoader) async {
        while await loader.requestCount < expected {
            await Task.yield()
        }
    }

    private func makeOverview(
        mood: String?,
        outfit: HomeOverviewOutfit = HomeOverviewOutfit(
            topId: "top_tshirt",
            bottomId: "bottom_slacks",
            shoesId: "shoes_sneakers",
            accessoryIds: []
        )
    ) -> HomeOverview {
        HomeOverview(
            serverTime: Date(timeIntervalSince1970: 1_788_000_000),
            greetingPeriod: "afternoon",
            user: HomeOverviewUser(id: "42", userName: "小王", littleEnergyOutfit: outfit),
            stats: HomeOverviewStats(
                moodCheckedToday: mood != nil,
                plazaComplaintCount: 18,
                myComplaintCount: 4,
                colleagueCount: 7,
                unreadMessageCount: 3
            ),
            moodToday: mood.map { HomeMoodToday(mood: $0, stressSources: ["deadline"], note: "继续加油", date: "2026-08-27") },
            quickMoods: [],
            latestComplaints: [],
            personality: nil,
            colleagueSummary: HomeColleagueSummary(count: 7, averageScore: nil, healthScore: nil)
        )
    }
}

private enum OverviewLoaderError: LocalizedError {
    case unavailable

    var errorDescription: String? { "首页概览暂时不可用，请重试" }
}

private actor OverviewLoaderStub {
    private var results: [Result<HomeOverview, Error>]

    init(results: [Result<HomeOverview, Error>]) {
        self.results = results
    }

    func load() throws -> HomeOverview {
        try results.removeFirst().get()
    }
}

private actor DeferredOverviewLoader {
    private var continuations: [CheckedContinuation<HomeOverview, Error>] = []

    var requestCount: Int { continuations.count }

    func load() async throws -> HomeOverview {
        try await withCheckedThrowingContinuation { continuation in
            continuations.append(continuation)
        }
    }

    func resolveRequest(at index: Int, with overview: HomeOverview) {
        continuations[index].resume(returning: overview)
    }
}
