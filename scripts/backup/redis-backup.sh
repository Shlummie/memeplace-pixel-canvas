#!/usr/bin/env sh
set -euo pipefail

: "${S3_BUCKET:?S3_BUCKET is required}"
: "${REDIS_HOST:=redis}"
: "${REDIS_PORT:=6379}"

SNAPSHOT_PATH=${REDIS_SNAPSHOT_PATH:-/data/dump.rdb}
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
TMP_FILE="/tmp/redis-${TIMESTAMP}.rdb"

redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SAVE
cp "$SNAPSHOT_PATH" "$TMP_FILE"
aws s3 cp "$TMP_FILE" "s3://$S3_BUCKET/redis/$TIMESTAMP.rdb"
rm -f "$TMP_FILE"
