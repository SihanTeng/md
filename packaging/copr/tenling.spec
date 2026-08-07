# COPR / Fedora package for TenLing (prebuilt AppImage from GitHub Releases).
# Version is rewritten by scripts/update-copr-spec.sh on release.

Name:           tenling
Version:        0.3.2
Release:        1%{?dist}
Summary:        Calm, cross-platform Markdown viewer and editor

License:        LicenseRef-Unknown
URL:            https://github.com/SihanTeng/tenling
Source0:        tenling-%{version}-linux-x64.AppImage
Source1:        tenling.desktop
Source2:        tenling.png

BuildArch:      x86_64
# AppImage is a prebuilt payload — no compile step.
BuildRequires:  desktop-file-utils

Requires:       webkit2gtk4.1
Requires:       gtk3

%description
TenLing is a calm desktop Markdown viewer and editor with visual editing,
presentation mode from document headings, portable plain Markdown files,
and light/dark themes. This package installs the official Linux AppImage from
GitHub Releases as /usr/bin/tenling.

%prep
# No extraction — Source0 is a self-contained AppImage binary.

%build
# Nothing to build.

%install
install -Dm755 "tenling-%{version}-linux-x64.AppImage" %{buildroot}%{_bindir}/tenling
install -Dm644 tenling.desktop %{buildroot}%{_datadir}/applications/tenling.desktop
install -Dm644 tenling.png %{buildroot}%{_datadir}/icons/hicolor/512x512/apps/tenling.png

%check
desktop-file-validate %{buildroot}%{_datadir}/applications/tenling.desktop || true

%files
%{_bindir}/tenling
%{_datadir}/applications/tenling.desktop
%{_datadir}/icons/hicolor/512x512/apps/tenling.png

%changelog
* Fri Aug 07 2026 TenLing contributors <noreply@users.noreply.github.com> - 0.3.0-1
- Rebrand package to TenLing (AppImage from GitHub Releases)

* Wed Jul 30 2026 md contributors <noreply@users.noreply.github.com> - 0.2.0-1
- Initial COPR package (AppImage from GitHub Releases)
