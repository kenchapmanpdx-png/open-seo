#!/usr/bin/env bash
# Preflight for the unattended build. Prints PASS / MISS (required) / OPT (optional, missing).
# Never prints secret values: .env.local is only checked for KEY=<non-empty>.
# Exit 0 = every required item passes.
cd "$(git rev-parse --show-toplevel)" || exit 1
pass=0; miss=0; opt=0
row() { printf '%-5s %s\n' "$1" "$2"; case "$1" in PASS) pass=$((pass+1));; MISS) miss=$((miss+1));; OPT) opt=$((opt+1));; esac; }
check() { if eval "$2" >/dev/null 2>&1; then row PASS "$1"; else row "$3" "$1"; fi; }
haskey() { grep -qE "^$1=.+" .env.local; }

echo "== tools"
check "node >= 20" 'node -e "process.exit(+process.versions.node.split(\".\")[0]>=20?0:1)"' MISS
check "corepack" 'command -v corepack' MISS
check "claude CLI" 'command -v claude' MISS
check "docker running (WSL)" 'docker info' MISS
check "gh authenticated (push to fork)" 'gh auth status' MISS
check "repo in WSL filesystem (not /mnt/c)" '[ "${PWD#/mnt/}" = "$PWD" ]' MISS
check ".claude/settings.local.json present" '[ -f .claude/settings.local.json ]' MISS
check ".env.local present" '[ -f .env.local ]' MISS

echo "== keys in .env.local (required)"
for k in DATAFORSEO_API_KEY OPENROUTER_API_KEY SUPABASE_DB_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY VERCEL_TOKEN; do check "$k" "haskey $k" MISS; done
check "SUPABASE_DB_URL is the Session pooler (pooler.supabase.com:5432, IPv4)" "grep -qE '^SUPABASE_DB_URL=.*pooler\.supabase\.com:5432/' .env.local" MISS

echo "== keys in .env.local (optional: missing → those features BLOCKED-KEN)"
for k in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_MAPS_API_KEY OPENAI_API_KEY ANTHROPIC_API_KEY GEMINI_API_KEY PERPLEXITY_API_KEY BING_WEBMASTER_API_KEY REPORTS_DOMAIN; do check "$k" "haskey $k" OPT; done

echo "== reachability (no secrets printed)"
check "Supabase pooler host resolves" "getent hosts \"\$(grep -E '^SUPABASE_DB_URL=' .env.local | sed -E 's#.*@([^:/]+).*#\\1#')\"" MISS
check "Supabase transaction pooler reachable (:6543)" "timeout 3 bash -c \"exec 3<>/dev/tcp/\$(grep -E '^SUPABASE_DB_URL=' .env.local | sed -E 's#.*@([^:/]+).*#\\1#')/6543\"" OPT
check "Vercel API reachable" "curl -s -o /dev/null -m 8 https://api.vercel.com" MISS

echo "---"
echo "PASS $pass · MISS $miss · OPT $opt"
[ "$miss" -eq 0 ]
