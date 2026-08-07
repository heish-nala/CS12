#!/bin/bash
# CS12 health check — verifies the live site, database, and mentorship feature
# end to end. Run from the repo root:  npm run health
# Safe to run anytime: the write test uses one row and reverts itself.

set -u
cd "$(dirname "$0")/.."

PASS=0
FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ✗ $1"; FAIL=$((FAIL+1)); }

URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL" .env.local | cut -d= -f2)
KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d= -f2)
AUTH=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY")

echo "CS12 Health Check — $(date '+%Y-%m-%d %H:%M')"
echo ""
echo "1. Live site"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 https://cs12.allsolutions.consulting/login)
[ "$CODE" = "200" ] && ok "cs12.allsolutions.consulting responds (200)" || bad "live site returned $CODE"

echo ""
echo "2. Database (production Supabase)"
ROW=$(curl -s --max-time 15 "${AUTH[@]}" "$URL/rest/v1/period_data?select=id,mentorship_call_date&limit=1")
echo "$ROW" | grep -q "mentorship_call_date" && ok "mentorship_call_date column exists" || bad "mentorship_call_date column missing: $ROW"

ROW_ID=$(echo "$ROW" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null)
if [ -n "${ROW_ID:-}" ]; then
    ORIG=$(echo "$ROW" | python3 -c "import json,sys; v=json.load(sys.stdin)[0]['mentorship_call_date']; print(v if v else 'null')")
    W=$(curl -s --max-time 15 -X PATCH "${AUTH[@]}" -H "Content-Type: application/json" -H "Prefer: return=representation" \
        "$URL/rest/v1/period_data?id=eq.$ROW_ID" -d '{"mentorship_call_date":"2001-01-01"}')
    echo "$W" | grep -q "2001-01-01" && ok "mentorship date saves (round-trip write)" || bad "write failed: $W"
    if [ "$ORIG" = "null" ]; then RESTORE='{"mentorship_call_date":null}'; else RESTORE="{\"mentorship_call_date\":\"$ORIG\"}"; fi
    R=$(curl -s --max-time 15 -X PATCH "${AUTH[@]}" -H "Content-Type: application/json" -H "Prefer: return=representation" \
        "$URL/rest/v1/period_data?id=eq.$ROW_ID" -d "$RESTORE")
    echo "$R" | grep -qv "2001-01-01" && ok "test value reverted (no trace left)" || bad "REVERT FAILED on row $ROW_ID — fix manually"
else
    bad "could not pick a test row"
fi

echo ""
echo "3. Report wiring (this code copy)"
grep -q "Mentorship Call" public/report-template.html && ok "report template has Mentorship Call column" || bad "template missing Mentorship Call column"
grep -q "mentorshipCallDate" src/lib/report-engine.ts && ok "report engine reads mentorship dates" || bad "report engine missing mentorship wiring"
grep -q "MENTORSHIP CALL" src/lib/report-rules.ts && ok "AI report rules cover mentorship accuracy" || bad "report rules missing mentorship rule"

echo ""
echo "4. Code freshness"
git fetch origin -q 2>/dev/null
BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
[ "$BEHIND" = "0" ] && ok "this copy matches the live code" || bad "this copy is $BEHIND commit(s) behind the live code — run: git pull"

echo ""
if [ "$FAIL" = "0" ]; then
    echo "ALL $PASS CHECKS PASSED — CS12 is healthy."
else
    echo "$FAIL CHECK(S) FAILED ($PASS passed) — see ✗ lines above."
    exit 1
fi
