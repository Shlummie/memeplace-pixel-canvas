#!/usr/bin/env sh
set -euo pipefail

: "${S3_BUCKET:?S3_BUCKET is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_PORT:=5432}"

export PGPASSWORD="$POSTGRES_PASSWORD"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
DUMP_FILE="/tmp/postgres-${POSTGRES_DB}-${TIMESTAMP}.sql.gz"

pg_dump \
  --host "$POSTGRES_HOST" \
  --port "$POSTGRES_PORT" \
  --username "$POSTGRES_USER" \
  --format=plain \
  "$POSTGRES_DB" | gzip > "$DUMP_FILE"

aws s3 cp "$DUMP_FILE" "s3://$S3_BUCKET/postgres/$POSTGRES_DB/$TIMESTAMP.sql.gz"

rm -f "$DUMP_FILE"
