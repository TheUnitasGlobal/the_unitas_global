#!/usr/bin/env bash
# UNITAS deploy-with-rollback
#
# Wraps `vercel --prod` with a post-deploy health check. If the freshly
# deployed commit doesn't answer with HTTP 200, this script reverts that one
# commit (git revert -- never reset --hard / force-push, both stay in
# .claude/settings.json's deny list) and redeploys the reverted state, so
# origin/main and production never sit on a broken commit unattended.
#
# Run from the repo root, AFTER `git push origin main` has already landed the
# commit to deploy (matches the documented "ok" pipeline order in CLAUDE.md:
# typecheck -> build -> add -> commit -> push -> this script).
#
# Optional: export UNITAS_PROD_URL=https://theunitas.global to health-check
# the canonical custom domain instead of the per-deploy URL `vercel --prod`
# prints. Left unset by default -- this repo's CNAME file points the legacy
# GitHub Pages site at theunitas.global, and nothing here confirms that's
# also where Vercel currently aliases the /web app, so it is not assumed.

set -euo pipefail

BAD_COMMIT="$(git rev-parse HEAD)"
BAD_COMMIT_SHORT="$(git rev-parse --short HEAD)"

echo "[deploy] deploying commit $BAD_COMMIT_SHORT to production..."
DEPLOY_OUTPUT="$(vercel --prod --yes 2>&1)" || {
  echo "[deploy] vercel --prod failed outright (build/deploy error) -- no live traffic is on this commit, so there is nothing to roll back."
  echo "$DEPLOY_OUTPUT"
  exit 1
}
echo "$DEPLOY_OUTPUT"

DEPLOY_URL="$(echo "$DEPLOY_OUTPUT" | tail -1 | tr -d '\r')"
CHECK_URL="${UNITAS_PROD_URL:-$DEPLOY_URL}"

echo "[deploy] health-checking $CHECK_URL ..."
sleep 5

STATUS="000"
for _ in 1 2 3; do
  STATUS="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$CHECK_URL" || echo "000")"
  [ "$STATUS" = "200" ] && break
  sleep 5
done

if [ "$STATUS" = "200" ]; then
  echo "[deploy] health check OK ($STATUS) -- commit $BAD_COMMIT_SHORT is live and healthy."
  exit 0
fi

echo "[deploy] health check FAILED (status=$STATUS) on $CHECK_URL -- rolling back."
git revert --no-edit "$BAD_COMMIT"
git push origin main
echo "[deploy] reverted $BAD_COMMIT_SHORT, redeploying the previous good state..."
vercel --prod --yes
echo "[deploy] rollback complete: origin/main and production are back on the pre-$BAD_COMMIT_SHORT state."
exit 1
