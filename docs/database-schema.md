# GUNS Database Schema Draft

This is the target MongoDB shape. Runtime code talks to a store interface now, so persistence can switch without changing gameplay/auth logic.

## current bridge

The first Mongo step uses a snapshot document, not final normalized collections yet.

Env:

- `GUNS_USER_STORE=file`: local file store.
- `GUNS_USER_STORE=mongo`: use Mongo snapshot store.
- `GUNS_USER_STORE=mongo-collections`: use normalized Mongo collections.
- `GUNS_MONGO_URL`: Mongo connection string.
- `GUNS_MONGO_DATABASE`: default `guns`.
- `GUNS_MONGO_USER_COLLECTION`: default `user_snapshots`.

If `GUNS_USER_STORE` is not set but `GUNS_MONGO_URL` is set, the backend now starts in `mongo-collections` mode automatically. Without `GUNS_MONGO_URL`, it falls back to `file` mode.

For public multiplayer, the browser uses:

- `https://api.guns.gs` for HTTP API;
- `wss://api.guns.gs/ws` for WebSocket.

See `docs/public-multiplayer-deploy.md`.

Env files:

- `.env`
- `.env.local`

Both are gitignored. See `.env.example`.

Mongo bridge document:

- collection: `user_snapshots`
- `_id`: `users`
- `schemaVersion`
- `savedAt`
- `snapshot`: current users JSON shape

If Mongo is empty and `server/data/users.json` exists, startup seeds Mongo from the file once.

`mongo-collections` is the next bridge step: runtime still passes one snapshot to the store, but the store persists it into `devices`, `visits`, `pilots`, and `auth_sessions` collections. Wallet changes are recorded explicitly into `wallet_transactions`. Dangerous admin actions are recorded into `admin_audit_log`.

Debug/admin endpoints:

- `/health` returns current `userStore` mode.
- `/admin/users` returns current `userStore` mode with the users snapshot.
- `/admin/database-status` returns current store mode, collection counts, latest wallet transaction, latest audit entry, and latest match result.
- `/admin/wallet-transactions?limit=50` returns recent wallet transactions when using `mongo-collections`.
- `/admin/audit-log?limit=50` returns recent admin actions when using `mongo-collections`.
- `/admin/match-results?limit=50` returns recent persisted match results when using `mongo-collections`.

Migration script:

- backup: `npm run backup:users`
- dry run: `npm run migrate:users:mongo`
- dry run with target check: `npm run migrate:users:mongo -- --check-target`
- write: `npm run migrate:users:mongo -- --write`
- compare after write: `npm run compare:users:mongo`
- validate live Mongo: `npm run compare:users:mongo -- --direction=mongo-live`
- full guarded pipeline: `npm run migrate:users:mongo:pipeline`
- Mongo backup: `npm run backup:mongo`
- Mongo restore: `npm run restore:mongo -- --from <backup-directory> --yes`
- required env: `GUNS_MONGO_URL`
- optional env: `GUNS_USER_STORE=mongo-collections`, `GUNS_MONGO_DATABASE=guns`

## collections

### devices

- `_id`: device id, current `device.id`
- `tokenHash`: hashed `guns_did` cookie, unique
- `firstSeenAt`, `lastSeenAt`
- `views`
- `claimedPilotId`, `claimedNick`, `claimedAt`
- `meta`

### visits

- `_id`: visit id, currently same as device id for anonymous visitors
- `deviceId`
- `callsign`, `code`
- `firstSeenAt`, `lastSeenAt`
- `views`, `sessions`
- `source`, `roomId`
- `claimedPilotId`, `claimedNick`, `convertedAt`
- `wallet`: `{ gunsCoin }`
- `meta`

### pilots

- `_id`: pilot id
- `nick`, `normalizedNick`
- `passwordHash`
- `createdAt`, `lastSeenAt`, `lastLoginAt`
- `sessions`
- `firstDeviceId`
- `source`
- `wallet`: `{ gunsCoin }`
- `telegramId`, `telegramUsername`

### auth_sessions

- `_id`: session token hash
- `tokenHash`
- `pilotId`
- `deviceId`
- `createdAt`, `lastSeenAt`
- `expiresAt`: `0` means permanent
- `revokedAt`
- `meta`

### wallet_transactions

- `_id`
- `entityType`: `visit` or `pilot`
- `entityId`
- `currency`: `score` or `gs`
- `amount`
- `reason`: `exchange`, `pickup`, `admin`, etc.
- `createdAt`
- `meta`

### admin_audit_log

- `_id`
- `createdAt`
- `actor`
- `action`: `delete-user`, `unlink-device`, `revoke-session`
- `entityType`: `visit`, `pilot`, `device`, or `session`
- `entityId`
- `before`
- `after`
- `meta`

### match_results

- `_id`: match id
- `matchId`
- `roomId`
- `modeId`
- `modeKind`
- `state`
- `createdAt`, `startedAt`, `finishedAt`
- `finishReason`
- `durationMs`
- `winnerId`, `winnerNick`
- `leaderboard`
- `events`
- `savedAt`

### settings

- `_id`: setting group, for example `economy`
- `value`
- `updatedAt`

## indexes

- `devices.tokenHash` unique
- `visits.deviceId`
- `pilots.normalizedNick` unique
- `auth_sessions.tokenHash` unique
- `auth_sessions.pilotId`
- `wallet_transactions.entityType + entityId + createdAt`
- `admin_audit_log.entityType + entityId + createdAt`
- `admin_audit_log.action + createdAt`
- `match_results.matchId` unique
- `match_results.roomId + finishedAt`
