#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${DEFILLAMA_ADAPTER_DIR:-/tmp/dimension-adapters-accrued}"

if [[ ! -d "$WORK/.git" ]]; then
  git clone --depth 1 https://github.com/DefiLlama/dimension-adapters.git "$WORK"
fi

cp "$ROOT/analytics/defillama/dexs/accrued.ts" "$WORK/dexs/accrued.ts"
cp "$ROOT/analytics/defillama/fees/accrued.ts" "$WORK/fees/accrued.ts"

echo "Copied adapters to $WORK"
echo "Next:"
echo "  1. Set START_BLOCK in dexs/accrued.ts and fees/accrued.ts"
echo "  2. Register exports in dexs/index.ts and fees/index.ts"
echo "  3. cd $WORK && npm install && npm test"
echo "  4. gh pr create --title 'Add Accrued volume adapter' --body-file $ROOT/analytics/defillama/PR_BODY.md"
