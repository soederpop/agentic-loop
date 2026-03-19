// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "LucaVoiceLauncher",
    platforms: [
        .macOS("15.4")
    ],
    products: [
        .executable(name: "LucaVoiceLauncher", targets: ["LucaVoiceLauncher"])
    ],
    dependencies: [
        .package(url: "https://github.com/migueldeicaza/SwiftTerm.git", from: "1.2.0")
    ],
    targets: [
        .executableTarget(
            name: "LucaVoiceLauncher",
            dependencies: [
                "SwiftTerm"
            ],
            path: "Sources",
            exclude: [
                "Managers/SpeechManager.swift"
            ]
        ),
        .testTarget(
            name: "LucaVoiceLauncherTests",
            dependencies: ["LucaVoiceLauncher"],
            path: "Tests"
        )
    ]
)
