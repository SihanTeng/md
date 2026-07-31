# COPR / Fedora package for md (prebuilt AppImage from GitHub Releases).
# Version is rewritten by scripts/update-copr-spec.sh on each release.
#
# Build SRPM locally:
#   ./scripts/publish-copr.sh <version> <appimage-path> --srpm-only
# Push to COPR (needs ~/.config/copr):
#   ./scripts/publish-copr.sh <version> <appimage-path>

Name:           md
Version:        0.2.0
Release:        1%{?dist}
Summary:        Calm, cross-platform Markdown viewer and editor

License:        LicenseRef-Unknown
URL:            https://github.com/SihanTeng/md
# Fetched during the COPR/local build (see publish-copr.sh which stages this file).
Source0:        md-%{version}-linux-x64.AppImage
Source1:        md.desktop

BuildArch:      x86_64
# AppImage is a prebuilt payload — no compile step.
BuildRequires:  desktop-file-utils

Requires:       webkit2gtk4.1
Requires:       gtk3
Recommends:     libappindicator-gtk3
Recommends:     xdg-utils

%description
md is a calm desktop Markdown viewer and editor.

Visual (WYSIWYG) editing, presentation mode from headings, portable .md files,
and light/dark themes. This package installs the official Linux AppImage from
GitHub Releases as /usr/bin/md.

%prep
# No extraction — Source0 is a self-contained AppImage binary.
cp -a %{SOURCE0} .
cp -a %{SOURCE1} .

%build
# nothing to build

%install
install -Dm755 "md-%{version}-linux-x64.AppImage" %{buildroot}%{_bindir}/md
install -Dm644 md.desktop %{buildroot}%{_datadir}/applications/md.desktop

%check
desktop-file-validate %{buildroot}%{_datadir}/applications/md.desktop || true
test -x %{buildroot}%{_bindir}/md

%files
%{_bindir}/md
%{_datadir}/applications/md.desktop

%changelog
* Wed Jul 30 2026 md contributors <noreply@users.noreply.github.com> - 0.2.0-1
- Initial COPR package (AppImage from GitHub Releases)
