import SwiftUI

@main
struct ScowldApp: App {
    @State private var memoryStore = MemoryStore()

    var body: some Scene {
        WindowGroup {
            ScowldRootView(memoryStore: memoryStore)
                .preferredColorScheme(.dark)
        }
    }
}

private enum ScowldTab: Hashable {
    case chat
    case pastChats
    case settings
    case about
}

struct ScowldRootView: View {
    var memoryStore: MemoryStore
    @AppStorage("startup_onboarding_completed") private var hasCompletedStartupOnboarding = false
    @State private var selectedTab: ScowldTab = .chat
    @State private var appUpdateState: AppUpdateState = .idle

    var body: some View {
        Group {
            if !hasCompletedStartupOnboarding {
                StartupOnboardingView {
                    hasCompletedStartupOnboarding = true
                }
            } else {
                appTabs
            }
        }
        .task {
            await checkForAppUpdateIfNeeded()
        }
    }

    private var appTabs: some View {
        TabView(selection: $selectedTab) {
            HomeView(memoryStore: memoryStore, isActive: selectedTab == .chat)
                .tabItem {
                    Label("Chat", systemImage: "message.fill")
                }
                .tag(ScowldTab.chat)

            NavigationStack {
                MemoryView(memoryStore: memoryStore)
            }
            .tabItem {
                Label("Chats", systemImage: "text.bubble.fill")
            }
            .tag(ScowldTab.pastChats)

            SettingsView(showsDismissControls: false)
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
                .tag(ScowldTab.settings)

            AboutView(updateState: $appUpdateState)
                .tabItem {
                    Label("About", systemImage: "info.circle.fill")
                }
            .tag(ScowldTab.about)
                .aboutUpdateBadge(isVisible: appUpdateState.isUpdateAvailable)
        }
    }

    @MainActor
    private func checkForAppUpdateIfNeeded() async {
        guard appUpdateState == .idle else { return }
        appUpdateState = .checking
        appUpdateState = await AppUpdateChecker.check(currentVersion: AppUpdateChecker.currentVersion)
    }
}

struct AboutView: View {
    @Environment(\.openURL) private var openURL
    @Binding var updateState: AppUpdateState

    /// Único enlace que queda de Scowld: el crédito que pide su licencia MIT.
    private let githubRepoURL = URL(string: "https://github.com/apoorvdarshan/scowld")!

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    headerCard

                    aboutSection("App", icon: "app.badge") {
                        aboutActionRow(
                            title: updateButtonTitle,
                            subtitle: updateStatusText,
                            systemImage: updateButtonIcon,
                            trailing: updateState == .checking ? .progress : .chevron,
                            subtitleColor: updateStatusColor
                        ) {
                            handleUpdateTap()
                        }

                        aboutInfoRow(
                            title: "Gaby en la web",
                            subtitle: "gaby-c76cf.web.app",
                            systemImage: "globe"
                        )
                    }

                    // La licencia MIT de Scowld pide conservar su atribución, así
                    // que el crédito se queda — lo que se quitó fueron sus enlaces
                    // de promoción (Product Hunt, Instagram, el correo y la cuenta
                    // de X del autor), que no corresponden a esta app.
                    aboutSection("Créditos", icon: "doc.plaintext") {
                        linkRow(
                            title: "Basada en Scowld",
                            subtitle: "github.com/apoorvdarshan/scowld (MIT)",
                            systemImage: "chevron.left.forwardslash.chevron.right",
                            url: githubRepoURL
                        )
                    }
                }
                .padding(20)
                .padding(.bottom, 96)
            }
            .background(Color.black.ignoresSafeArea())
            .navigationTitle("About")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var versionDisplay: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        return "v\(version)"
    }

    private var currentVersion: String {
        AppUpdateChecker.currentVersion
    }

    private var updateButtonTitle: String {
        if case .updateAvailable = updateState {
            return "Open App Store Update"
        }

        return "Check for Updates"
    }

    private var updateButtonIcon: String {
        if case .updateAvailable = updateState {
            return "arrow.down.app.fill"
        }

        return "arrow.triangle.2.circlepath"
    }

    private var updateStatusText: String? {
        switch updateState {
        case .idle, .checking:
            return nil
        case .upToDate:
            return "Up to date"
        case .updateAvailable(let version, _):
            return "v\(version)"
        case .notOnAppStore:
            return "Not live yet"
        case .failed:
            return "Failed"
        }
    }

    private var updateStatusColor: Color {
        switch updateState {
        case .updateAvailable:
            return .amicaBlue
        case .failed:
            return .red
        default:
            return .secondary
        }
    }

    private func handleUpdateTap() {
        if case .updateAvailable(_, let appStoreURL) = updateState {
            openURL(appStoreURL)
            return
        }

        Task {
            await checkForUpdates()
        }
    }

    @MainActor
    private func checkForUpdates() async {
        updateState = .checking
        updateState = await AppUpdateChecker.check(currentVersion: currentVersion)
    }

    private var headerCard: some View {
        HStack(spacing: 14) {
            // Sin imagen de logo: el de Scowld no se copió (por licencia) y
            // dejaba un recuadro vacío. Hasta que haya uno propio, el símbolo
            // del sistema se ve intencional en vez de roto.
            Image(systemName: "waveform.circle.fill")
                .resizable()
                .scaledToFit()
                .frame(width: 64, height: 64)
                .foregroundStyle(Color.amicaBlue)

            VStack(alignment: .leading, spacing: 4) {
                Text("Gaby")
                    .font(.title2.bold())
                    .foregroundStyle(.primary)
                Text(versionDisplay)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text("Tu asistente")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .padding(16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(.white.opacity(0.08), lineWidth: 0.5)
        )
    }

    private func aboutSection<Content: View>(
        _ title: String,
        icon: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(title, systemImage: icon)
                .font(.headline)
                .foregroundStyle(.primary)

            VStack(spacing: 0) {
                content()
            }
            .background(.black.opacity(0.22), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .padding(16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(.white.opacity(0.08), lineWidth: 0.5)
        )
    }

    private func linkRow(
        title: String,
        subtitle: String? = nil,
        systemImage: String,
        url: URL
    ) -> some View {
        aboutActionRow(title: title, subtitle: subtitle, systemImage: systemImage) {
            openURL(url)
        }
    }

    private func aboutActionRow(
        title: String,
        subtitle: String? = nil,
        systemImage: String,
        trailing: AboutRowTrailing = .chevron,
        subtitleColor: Color = .secondary,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            aboutRowContent(
                title: title,
                subtitle: subtitle,
                systemImage: systemImage,
                trailing: trailing,
                subtitleColor: subtitleColor
            )
        }
        .buttonStyle(.plain)
    }

    private func aboutInfoRow(
        title: String,
        subtitle: String,
        systemImage: String
    ) -> some View {
        aboutRowContent(
            title: title,
            subtitle: subtitle,
            systemImage: systemImage,
            trailing: .none
        )
    }

    private func aboutRowContent(
        title: String,
        subtitle: String? = nil,
        systemImage: String,
        trailing: AboutRowTrailing = .chevron,
        subtitleColor: Color = .secondary
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.primary)
                .frame(width: 34, height: 34)
                .background(.white.opacity(0.08), in: Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(.primary)

                if let subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(subtitleColor)
                        .lineLimit(2)
                }
            }

            Spacer(minLength: 10)

            switch trailing {
            case .chevron:
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.tertiary)
            case .progress:
                ProgressView()
            case .none:
                EmptyView()
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(.white.opacity(0.08))
                .frame(height: 0.5)
                .padding(.leading, 62)
        }
        .contentShape(Rectangle())
    }
}

private enum AboutRowTrailing {
    case chevron
    case progress
    case none
}

enum AppUpdateState: Equatable {
    case idle
    case checking
    case upToDate
    case updateAvailable(version: String, appStoreURL: URL)
    case notOnAppStore
    case failed

    var isUpdateAvailable: Bool {
        if case .updateAvailable = self {
            return true
        }

        return false
    }
}

private struct AppUpdateChecker {
    static var currentVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
    }

    static func check(currentVersion: String) async -> AppUpdateState {
        guard let bundleID = Bundle.main.bundleIdentifier,
              let url = URL(string: "https://itunes.apple.com/lookup?bundleId=\(bundleID)") else {
            return .failed
        }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let response = try JSONDecoder().decode(AppStoreLookupResponse.self, from: data)

            guard let result = response.results.first,
                  let storeVersion = result.version else {
                return .notOnAppStore
            }

            if isVersion(storeVersion, newerThan: currentVersion),
               let appStoreURL = result.trackViewURL {
                return .updateAvailable(version: storeVersion, appStoreURL: appStoreURL)
            }

            return .upToDate
        } catch {
            return .failed
        }
    }

    private static func isVersion(_ lhs: String, newerThan rhs: String) -> Bool {
        let left = lhs.split(separator: ".").map { Int($0) ?? 0 }
        let right = rhs.split(separator: ".").map { Int($0) ?? 0 }
        let count = max(left.count, right.count)

        for index in 0..<count {
            let leftValue = index < left.count ? left[index] : 0
            let rightValue = index < right.count ? right[index] : 0

            if leftValue != rightValue {
                return leftValue > rightValue
            }
        }

        return false
    }
}

private struct AppStoreLookupResponse: Decodable {
    let results: [AppStoreLookupResult]
}

private struct AppStoreLookupResult: Decodable {
    let version: String?
    let trackViewURL: URL?

    private enum CodingKeys: String, CodingKey {
        case version
        case trackViewURL = "trackViewUrl"
    }
}

private extension View {
    @ViewBuilder
    func aboutUpdateBadge(isVisible: Bool) -> some View {
        if isVisible {
            badge("")
        } else {
            self
        }
    }
}
