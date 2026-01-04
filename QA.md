# Memeplace QA Scenarios

## Valid single-pixel placement

1. Connect wallet in web UI.
2. Select an empty pixel on the current tile.
3. Stage the pixel and run burn flow.
4. Expect transaction succeeds, staged list clears, pixel appears on canvas and in `/v1/tile/:id` response.

## Multi-pixel same tile batch

1. Stage multiple pixels on the same tile.
2. Burn and submit.
3. Confirm submit response is `202` and all pixels apply in a single diff.

## Wrong commit error

1. Intercept `/v1/submit` request and modify `commit` payload.
2. Expect server responds with error indicating commit mismatch.

## Insufficient credits error

1. Stage more pixels than wallet burn covers.
2. Submit without additional credits.
3. Expect `Insufficient credits` error and no pixels applied.

## Wrong wallet signature error

1. Alter `signedMsgB64` before calling `/v1/submit`.
2. Expect server rejects with `Invalid signed message`.

## Race: two submits consume last credits

1. Prepare two batches that would consume the remaining credits.
2. Submit both nearly simultaneously.
3. Expect one success and one failure due to depleted credits.

## WebSocket diff renders in second browser

1. Open two browsers on the same tile.
2. Place pixels from the first browser.
3. Confirm second browser receives WebSocket diff and updates canvas without reload.

## Tile persistence survives server restart

1. Place distinct pixels on a tile and note coordinates.
2. Restart server (and Redis if needed).
3. Reload tile: pixels remain present, confirming persistence.


