#!/bin/sh
# Pull Vercel development env and merge only Gateway/OIDC lines into .env.local.
# Does not overwrite Neon, Redis, or other local secrets.
set -eu
cd "$(dirname "$0")/.."

if [ ! -d .vercel ]; then
  echo "Link this folder first: npx vercel link --yes --scope rovos-projects-18979ae1"
  exit 1
fi

tmp="$(mktemp)"
cleanup() { rm -f "$tmp"; }
trap cleanup EXIT

npx vercel env pull "$tmp" --yes --environment development

python3 - "$tmp" .env.local <<'PY'
import sys
from pathlib import Path

src, dest = Path(sys.argv[1]), Path(sys.argv[2])
wanted = {}
for raw in src.read_text().splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    name, value = line.split("=", 1)
    if name in {"VERCEL_OIDC_TOKEN", "AI_GATEWAY_API_KEY"} and value:
        wanted[name] = value

if not wanted:
    print("No VERCEL_OIDC_TOKEN or AI_GATEWAY_API_KEY in the pulled file.")
    sys.exit(1)

existing = dest.read_text() if dest.exists() else ""
lines = existing.splitlines()
kept = []
seen = set()
for line in lines:
    name = line.split("=", 1)[0] if "=" in line and not line.startswith("#") else None
    if name in wanted:
        kept.append(f"{name}={wanted[name]}")
        seen.add(name)
    else:
        kept.append(line)
for name, value in wanted.items():
    if name not in seen:
        kept.append(f"{name}={value}")
if kept and kept[-1] != "":
    kept.append("")
dest.write_text("\n".join(kept))
print("Merged: " + ", ".join(sorted(wanted)))
PY
