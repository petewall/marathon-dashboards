#!/usr/bin/env bash
set -euo pipefail

dashboardFilePath=$1
templateFile=templates/level-dashboard-template.yaml

export GAME_SLUG=$(basename $(dirname "${dashboardFilePath}"))
gameData="data/${GAME_SLUG}.yaml"
export GAME_TITLE=$(yq -r '.name' "${gameData}")

export LEVEL_NUMBER=$(basename "${dashboardFilePath}" | sed -e "s/^\([0-9]*\)-.*/\1/")
export LEVEL_TITLE=$(yq -r ".levels[$LEVEL_NUMBER - 1].name" "${gameData}")
export LEVEL_MAP_URL=$(yq -r ".levels[$LEVEL_NUMBER - 1].mapUrl" "${gameData}")
envsubst '${GAME_SLUG},${GAME_TITLE},${LEVEL_NUMBER},${LEVEL_TITLE},${LEVEL_MAP_URL}' < "${templateFile}"
