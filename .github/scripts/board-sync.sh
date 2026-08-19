#!/usr/bin/env bash
# Move a single issue/PR (and, for PRs, its linked issues) to a board status.
#
# Usage: board-sync.sh <status> <content-node-id> [owner repo pr-number]
# When owner/repo/pr-number are supplied, issues closed by that PR move too.
set -euo pipefail

# shellcheck source=./board-lib.sh
source "$(dirname "$0")/board-lib.sh"

STATUS="${1:?status required}"
CONTENT_ID="${2:?content node id required}"
OWNER="${3:-}"
REPO="${4:-}"
PR_NUMBER="${5:-}"

board_move_content "$CONTENT_ID" "$STATUS"

if [[ -n "$OWNER" && -n "$REPO" && -n "$PR_NUMBER" ]]; then
  while read -r issue_id; do
    [[ -z "$issue_id" ]] && continue
    board_move_content "$issue_id" "$STATUS"
  done < <(pr_linked_issue_ids "$OWNER" "$REPO" "$PR_NUMBER")
fi
