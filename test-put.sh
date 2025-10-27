#!/usr/bin/env bash
# Usage: TOKEN=ghp_xxx bash test-put.sh

set -euo pipefail
REPO=jeepscape/gym-plan
FILE=fitness.json
API="https://api.github.com/repos/$REPO/contents/$FILE"

# GET current SHA
SHA=$(curl -sS -H "Authorization: Bearer ${TOKEN:?}" -H "Accept: application/vnd.github+json" "$API" | jq -r .sha)

# Build JSON
NOW=$(date -u +"%Y-%m-%d")
JSON=$(jq -n --arg d "$NOW" '{date:$d,steps:1234,distance_km:2.34,active_energy_kcal:345,exercise_minutes:22,workouts:[{type:"Test",minutes:10}]}' )

# Base64
B64=$(printf "%s" "$JSON" | base64)

# PUT
curl -sS -X PUT "$API"   -H "Authorization: Bearer ${TOKEN:?}"   -H "Accept: application/vnd.github+json"   -H "Content-Type: application/json"   -d "{"message":"test update via curl","content":"$B64","sha":"$SHA"}" | jq .
