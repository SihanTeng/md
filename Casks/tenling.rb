# Homebrew cask for TenLing. This file is the canonical template; the Release
# workflow renders it (version + sha256) into the SihanTeng/homebrew-tenling tap
# on every release via scripts/update-homebrew-cask.sh.
cask "tenling" do
  version "0.3.1"
  sha256 "da6c750374c8ae3b0b4457bddc4267356d52cd26cd09514d620f6a81bd89749c"

  url "https://github.com/SihanTeng/tenling/releases/download/v#{version}/tenling-#{version}-macos-universal.dmg"
  name "TenLing"
  desc "Calm, cross-platform Markdown viewer and editor"
  homepage "https://github.com/SihanTeng/tenling"

  livecheck do
    url "https://github.com/SihanTeng/tenling/releases/latest"
    strategy :github_latest
  end

  depends_on macos: ">= :catalina"

  app "TenLing.app"

  zap trash: [
    "~/Library/Application Support/com.tenling.app",
    "~/Library/Caches/com.tenling.app",
    "~/Library/WebKit/com.tenling.app",
  ]
end
