#!/usr/bin/env bash
# Purpose: inspect GitHub environment secret presence and release-branch governance state.
# Responsibilities: help Nuclo confirm that staging/production GitHub Environment wiring
# and branch ruleset posture match the release ladder before a cutover or branch-promotion run.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/github_env_audit.sh [options]

Options:
  --repo <owner/name>           GitHub repository slug.
  --environment <name>          Repeatable. Default: staging, production
  --branch <name>               Repeatable branch to inspect. Default: staging-preview, production
  --help                        Show this message.

Env fallbacks:
  SHORTPULSE_GITHUB_REPO

Requirements:
  - gh CLI must be installed and authenticated for the target repo.
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[nuclo-github-audit] missing required command: $1" >&2
    exit 1
  }
}

derive_repo_from_git() {
  local remote_url
  remote_url="$(git remote get-url origin 2>/dev/null || true)"
  REMOTE_URL="$remote_url" python3 - <<'PY'
import os
import re
import sys

raw = os.environ.get("REMOTE_URL", "").strip()
patterns = [
    r'git@github\.com:(?P<repo>[^/]+/[^/.]+)(?:\.git)?$',
    r'https://github\.com/(?P<repo>[^/]+/[^/.]+)(?:\.git)?$',
]
for pattern in patterns:
    match = re.search(pattern, raw)
    if match:
        print(match.group("repo"))
        sys.exit(0)
sys.exit(1)
PY
}

REPO="${SHORTPULSE_GITHUB_REPO:-}"
ENVIRONMENTS=("staging" "production")
BRANCHES=("staging-preview" "production")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    --environment)
      if [[ "${ENVIRONMENTS[*]}" == "staging production" ]]; then
        ENVIRONMENTS=()
      fi
      ENVIRONMENTS+=("${2:-}")
      shift 2
      ;;
    --branch)
      if [[ "${BRANCHES[*]}" == "staging-preview production" ]]; then
        BRANCHES=()
      fi
      BRANCHES+=("${2:-}")
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[nuclo-github-audit] unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$REPO" ]]; then
  REPO="$(derive_repo_from_git || true)"
fi

if [[ -z "$REPO" ]]; then
  echo "[nuclo-github-audit] missing repo slug. Pass --repo or set SHORTPULSE_GITHUB_REPO." >&2
  exit 1
fi

require_command gh
require_command python3

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "[nuclo-github-audit] repo=$REPO"

for environment in "${ENVIRONMENTS[@]}"; do
  gh api "repos/$REPO/environments/$environment" > "$TMP_DIR/$environment.environment.json"
  gh api "repos/$REPO/environments/$environment/secrets?per_page=100" > "$TMP_DIR/$environment.secrets.json"
done

for branch in "${BRANCHES[@]}"; do
  gh api "repos/$REPO/branches/$branch" > "$TMP_DIR/$branch.branch.json"
  if gh api "repos/$REPO/branches/$branch/protection" > "$TMP_DIR/$branch.protection.json" 2>"$TMP_DIR/$branch.protection.err"; then
    :
  else
    if grep -qi '404' "$TMP_DIR/$branch.protection.err"; then
      printf '{}\n' > "$TMP_DIR/$branch.protection.json"
    else
      cat "$TMP_DIR/$branch.protection.err" >&2
      exit 1
    fi
  fi
  gh api "repos/$REPO/rules/branches/$branch" -H 'Accept: application/vnd.github+json' > "$TMP_DIR/$branch.rules.json"
done

python3 - "$TMP_DIR" "${ENVIRONMENTS[*]}" "${BRANCHES[*]}" <<'PY'
import json
import sys
from pathlib import Path

tmp_dir = Path(sys.argv[1])
environments = [item for item in sys.argv[2].split() if item]
branches = [item for item in sys.argv[3].split() if item]

required_env_secrets = {
    "staging": {"SUPABASE_DB_URL"},
    "production": {"SUPABASE_DB_URL"},
}

status = 0

for environment in environments:
    env_payload = json.loads((tmp_dir / f"{environment}.environment.json").read_text())
    secrets_payload = json.loads((tmp_dir / f"{environment}.secrets.json").read_text())
    secrets = sorted(secret["name"] for secret in secrets_payload.get("secrets", []))
    required = required_env_secrets.get(environment, set())
    missing = sorted(required.difference(secrets))
    reviewers = env_payload.get("protection_rules", [])
    print(f"Environment {environment}:")
    print(f"  secrets={', '.join(secrets) if secrets else '(none)'}")
    if reviewers:
        print(f"  protection_rules={len(reviewers)}")
    else:
        print("  protection_rules=0")
    if missing:
        status = 1
        print(f"  missing_required_secrets={', '.join(missing)}")

for branch in branches:
    branch_payload = json.loads((tmp_dir / f"{branch}.branch.json").read_text())
    protection_payload = json.loads((tmp_dir / f"{branch}.protection.json").read_text())
    branch_rules = json.loads((tmp_dir / f"{branch}.rules.json").read_text())
    protected = branch_payload.get("protected", False) or bool(branch_rules)
    if not protected:
        status = 1
        print(f"Branch {branch}: protected=false")
        continue

    contexts = []
    review_count = None
    rule_types = []
    ruleset_ids = []

    for rule in branch_rules:
        rule_type = rule.get("type")
        if rule_type:
            rule_types.append(rule_type)
        ruleset_id = rule.get("ruleset_id")
        if ruleset_id is not None and ruleset_id not in ruleset_ids:
            ruleset_ids.append(ruleset_id)
        if rule_type == "required_status_checks":
            for check in (rule.get("parameters", {}) or {}).get("required_status_checks", []) or []:
                context = check.get("context")
                if context and context not in contexts:
                    contexts.append(context)
        if rule_type == "pull_request":
            review_count = (rule.get("parameters", {}) or {}).get("required_approving_review_count")

    if not contexts:
        contexts = (
            protection_payload.get("required_status_checks", {}) or {}
        ).get("contexts", []) or []
    if review_count is None:
        review_count = (protection_payload.get("required_pull_request_reviews", {}) or {}).get(
            "required_approving_review_count"
        )

    print(f"Branch {branch}: protected=true")
    if ruleset_ids:
        print(f"  ruleset_ids={', '.join(str(item) for item in ruleset_ids)}")
    print(f"  rule_types={', '.join(rule_types) if rule_types else '(none)'}")
    print(f"  required_status_checks={', '.join(contexts) if contexts else '(none)'}")
    print(f"  required_approving_review_count={review_count if review_count is not None else 0}")

sys.exit(status)
PY
