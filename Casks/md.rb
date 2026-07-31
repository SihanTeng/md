# Homebrew cask for md. This file is the canonical template; the Release
# workflow renders it (version + sha256) into the SihanTeng/homebrew-md tap
# on every release via scripts/update-homebrew-cask.sh.
cask "md" do
  version "0.2.0"
  sha256 "c46937c8b70316d00babc55d147a2341aed8c9a47d4b531535e7f1cee64ad1d0"

  url "https://github.com/SihanTeng/md/releases/download/v#{version}/md-#{version}-macos-universal.dmg"
  name "md"
  desc "Calm, cross-platform markdown viewer and editor"
  homepage "https://github.com/SihanTeng/md"

  livecheck do
    url "https://github.com/SihanTeng/md/releases/latest"
    strategy :github_latest
  end

  depends_on macos: ">= :catalina"

  app "md.app"

  zap trash: [
    "~/Library/Application Support/com.md.app",
    "~/Library/Caches/com.md.app",
    "~/Library/WebKit/com.md.app",
  ]
end
