#!/usr/bin/env bash
set -euo pipefail

latest_release_url="https://api.github.com/repos/scalpelpoe/scalpel/releases/latest"

dry_run=0
explicit_version=""

usage() {
    cat <<'EOF'
Usage: update-aur-packages.sh [--dry-run] [--version VERSION]

Updates release-based AUR package metadata:
  - packaging/aur/scalpel-poe-bin
  - packaging/aur/scalpel-poe

Options:
  --dry-run          Print commands without changing files
  --version VERSION  Use VERSION instead of GitHub latest release
EOF
}

while (($#)); do
    case "$1" in
    --dry-run)
        dry_run=1
        shift
        ;;
    --version)
        if [[ $# -lt 2 || -z "${2:-}" ]]; then
            echo "error: --version requires a value" >&2
            exit 2
        fi
        explicit_version="$2"
        shift 2
        ;;
    -h | --help)
        usage
        exit 0
        ;;
    *)
        echo "error: unknown argument: $1" >&2
        usage >&2
        exit 2
        ;;
    esac
done

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd -- "$script_dir/.." && pwd)"

packages=(
    "scalpel-poe-bin"
    "scalpel-poe"
)

is_prerelease_version() {
    [[ "$1" =~ -(alpha|beta|rc|exp)([.-]?[0-9]*)?$ ]]
}

assert_stable_version() {
    local version="$1"

    if is_prerelease_version "$version"; then
        echo "error: refusing to update AUR packages to prerelease $version" >&2
        exit 1
    fi
}

get_latest_stable_version() {
    if [[ -n "$explicit_version" ]]; then
        local version="${explicit_version#v}"
        assert_stable_version "$version"
        printf '%s\n' "$version"
        return
    fi

    if [[ -n "${GITHUB_REF_NAME:-}" ]]; then
        local version="${GITHUB_REF_NAME#v}"
        assert_stable_version "$version"
        printf '%s\n' "$version"
        return
    fi

    local json
    json="$(curl -fsSL \
        -H 'Accept: application/vnd.github+json' \
        -H 'User-Agent: scalpel-aur-updater' \
        "$latest_release_url")"

    local tag_name draft prerelease
    tag_name="$(sed -nE 's/.*"tag_name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' <<<"$json" | head -n1)"
    draft="$(sed -nE 's/.*"draft"[[:space:]]*:[[:space:]]*(true|false).*/\1/p' <<<"$json" | head -n1)"
    prerelease="$(sed -nE 's/.*"prerelease"[[:space:]]*:[[:space:]]*(true|false).*/\1/p' <<<"$json" | head -n1)"

    if [[ -z "$tag_name" ]]; then
        echo "error: failed to read latest release tag_name" >&2
        exit 1
    fi

    if [[ "$draft" == "true" || "$prerelease" == "true" ]]; then
        echo "error: latest release $tag_name is not stable" >&2
        exit 1
    fi

    local version="${tag_name#v}"
    assert_stable_version "$version"
    printf '%s\n' "$version"
}

run() {
    if ((dry_run)); then
        printf '[dry-run]'
        printf ' %q' "$@"
        printf '\n'
        return
    fi

    "$@"
}

update_pkgbuild() {
    local package_dir="$1"
    local version="$2"
    local pkgver="${version//-/_}"
    local pkgbuild="$package_dir/PKGBUILD"
    local tmp

    tmp="$(mktemp)"
    sed -E \
        -e "s/^pkgver=.*/pkgver=$pkgver/" \
        -e 's/^pkgrel=.*/pkgrel=1/' \
        "$pkgbuild" >"$tmp"

    if cmp -s "$pkgbuild" "$tmp"; then
        rm -f "$tmp"
        return 1
    fi

    if ((dry_run)); then
        echo "[dry-run] update $pkgbuild"
        rm -f "$tmp"
    else
        mv "$tmp" "$pkgbuild"
    fi

    return 0
}

regenerate_metadata() {
    local package_dir="$1"

    (
        cd "$package_dir"

        run updpkgsums

        if ((dry_run)); then
            echo "[dry-run] makepkg --printsrcinfo > .SRCINFO"
        else
            makepkg --printsrcinfo >.SRCINFO
        fi
    )
}

version="$(get_latest_stable_version)"
echo "Using stable release $version"

for package in "${packages[@]}"; do
    package_dir="$root_dir/packaging/aur/$package"

    changed=0
    if update_pkgbuild "$package_dir" "$version"; then
        changed=1
    fi

    regenerate_metadata "$package_dir"

    if ((changed)); then
        echo "$package: updated PKGBUILD"
    else
        echo "$package: PKGBUILD already current"
    fi
done
