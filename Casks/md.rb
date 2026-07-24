# Homebrew cask for md. This file is the canonical template; the Release
# workflow renders it (version + sha256) into the SihanTeng/homebrew-md tap
# on every release via scripts/update-homebrew-cask.sh.
cask "md" do
  version "0.1.0"
  sha256 "REPLACE_WITH_DMG_SHA256"

  url "https://github.com/SihanTeng/md/releases/download/v#{version}/md_#{version}_universal.dmg"
  name "md"
  desc "Calm, cross-platform markdown viewer and editor"
  homepage "https://github.com/SihanTeng/md"

  depends_on macos: ">= :catalina"

  app "md.app"

  zap trash: [
    "~/Library/Application Support/com.md.app",
    "~/Library/Caches/com.md.app",
    "~/Library/WebKit/com.md.app",
  ]
end
