#!/bin/sh
set -eu

mode="${1:-pre-commit}"
allowed_branch="$(git config --local --get shortpulse.allowedBranch || true)"
current_branch="$(git branch --show-current)"

if [ -z "$allowed_branch" ]; then
  echo "Blocked: git config shortpulse.allowedBranch is not set for this repo." >&2
  echo "Set it explicitly for the current user-approved branch before committing or pushing." >&2
  exit 1
fi

if [ -z "$current_branch" ]; then
  echo "Blocked: unable to determine the current branch." >&2
  exit 1
fi

if [ "$current_branch" != "$allowed_branch" ]; then
  echo "Blocked: current branch '$current_branch' does not match allowed branch '$allowed_branch'." >&2
  echo "Do not work on another branch unless the user explicitly authorizes it and the local allowed branch is updated." >&2
  exit 1
fi

if [ "$mode" = "pre-push" ]; then
  while IFS=' ' read -r local_ref local_sha remote_ref remote_sha; do
    if [ -z "${local_ref:-}" ]; then
      continue
    fi

    remote_branch="${remote_ref#refs/heads/}"
    local_branch="${local_ref#refs/heads/}"

    if [ "$local_branch" != "$allowed_branch" ]; then
      echo "Blocked: attempted to push local ref '$local_ref' while allowed branch is '$allowed_branch'." >&2
      exit 1
    fi

    if [ "$remote_branch" != "$allowed_branch" ]; then
      echo "Blocked: attempted to push to remote branch '$remote_branch' while allowed branch is '$allowed_branch'." >&2
      exit 1
    fi
  done
fi
