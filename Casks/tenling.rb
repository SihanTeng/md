# Homebrew cask for TenLing. This file is the canonical template; the Release
# workflow renders it (version + sha256) into the SihanTeng/homebrew-tenling tap
# on every release via scripts/update-homebrew-cask.sh.
cask "tenling" do
  version "0.3.1"
  sha256 "329cff90de726a404235dff0570242c962fff11fd2050c0793f19d231c70d4ff"

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
