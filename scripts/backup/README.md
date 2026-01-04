# Backup Scripts

These helpers support scheduled backups inside Docker:

- `postgres-backup.sh` – runs `pg_dump` and uploads the gzip file to `s3://$S3_BUCKET/postgres/...`.
- `redis-backup.sh` – forces a Redis snapshot, copies the RDB file, and uploads to `s3://$S3_BUCKET/redis/...`.

Required environment variables:

- `S3_BUCKET`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (provided to the container environment)
- Postgres: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, optional `POSTGRES_HOST`, `POSTGRES_PORT`
- Redis: optional `REDIS_HOST`, `REDIS_PORT`, `REDIS_SNAPSHOT_PATH`

When running via Docker Compose, mount `/tmp` for staging artifacts and ensure the backup container shares volumes or network with Postgres/Redis.
