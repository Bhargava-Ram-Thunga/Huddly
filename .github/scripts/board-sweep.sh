#!/usr/bin/env bash
# Release-train sweep: move every board item in <from-status> to <to-status>.
# Used when a deployment succeeds (see docs/process/board-automation.md S13/S15).
#
# Usage: board-sweep.sh "<from-status>" "<to-status>"
set -euo pipefail

# shellcheck source=./board-lib.sh
source "$(dirname "$0")/board-lib.sh"

FROM="${1:?from status required}"
TO="${2:?to status required}"

# Collect item ids whose Status equals FROM (paginated).
items_in_status() {
  local cursor="null" query
  while :; do
    query='
      query($project:ID!, $cursor:String) {
        node(id:$project) {
          ... on ProjectV2 {
            items(first:100, after:$cursor) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                fieldValues(first:20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2SingleSelectField { name } }
                    }
                  }
                }
              }
            }
          }
        }
      }'
    local page
    if [[ "$cursor" == "null" ]]; then
      page="$(gh api graphql -f query="$query" -f project="$PROJECT_ID")"
    else
      page="$(gh api graphql -f query="$query" -f project="$PROJECT_ID" -f cursor="$cursor")"
    fi

    echo "$page" | jq -r --arg from "$FROM" '
      .data.node.items.nodes[]
      | select(
          [.fieldValues.nodes[]
           | select(.field.name == "Status" and .name == $from)] | length > 0
        )
      | .id'

    local has_next
    has_next="$(echo "$page" | jq -r '.data.node.items.pageInfo.hasNextPage')"
    [[ "$has_next" != "true" ]] && break
    cursor="$(echo "$page" | jq -r '.data.node.items.pageInfo.endCursor')"
  done
}

count=0
while read -r item_id; do
  [[ -z "$item_id" ]] && continue
  board_set_status "$item_id" "$TO"
  count=$((count + 1))
done < <(items_in_status)

echo "swept $count item(s): $FROM → $TO"
