-- Refactor batches schema to support multi-tile submissions

ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS memo_b64 TEXT;

CREATE TABLE IF NOT EXISTS batch_tiles (
  signature TEXT NOT NULL REFERENCES batches(signature) ON DELETE CASCADE,
  tile INTEGER NOT NULL,
  commit TEXT NOT NULL,
  pixel_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (signature, tile)
);

CREATE TABLE IF NOT EXISTS batch_tile_bytes (
  signature TEXT NOT NULL,
  tile INTEGER NOT NULL,
  batch_bytes BYTEA NOT NULL,
  PRIMARY KEY (signature, tile),
  FOREIGN KEY (signature, tile) REFERENCES batch_tiles(signature, tile) ON DELETE CASCADE
);

INSERT INTO batch_tiles (signature, tile, commit, pixel_count)
SELECT signature, tile, commit, 0
FROM batches
ON CONFLICT (signature, tile) DO NOTHING;

INSERT INTO batch_tile_bytes (signature, tile, batch_bytes)
SELECT b.signature, b.tile, bb.batch_bytes
FROM batches b
JOIN batch_bytes bb ON bb.signature = b.signature
ON CONFLICT (signature, tile) DO NOTHING;

DROP TABLE IF EXISTS batch_bytes;

ALTER TABLE batches
  DROP COLUMN IF EXISTS tile,
  DROP COLUMN IF EXISTS commit;

