import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const USER_STORE_SCHEMA_VERSION = 1;

export class FileUserStore {
  constructor(options = {}) {
    this.storageFile = options.storageFile || "";
    this.mode = "file";
  }

  loadSnapshot() {
    if (!this.storageFile || !fs.existsSync(this.storageFile)) return null;

    return JSON.parse(fs.readFileSync(this.storageFile, "utf8"));
  }

  saveSnapshot(snapshot) {
    if (!this.storageFile) return;

    const data = {
      version: USER_STORE_SCHEMA_VERSION,
      savedAt: Date.now(),
      ...snapshot
    };

    fs.mkdirSync(path.dirname(this.storageFile), { recursive: true });
    fs.writeFileSync(this.storageFile, `${JSON.stringify(data, null, 2)}\n`);
  }

  recordWalletTransaction() {}

  listWalletTransactions() {
    return [];
  }

  recordAdminAudit() {}

  listAdminAudit() {
    return [];
  }

  recordMatchResult() {}

  listMatchResults() {
    return [];
  }

  async getDatabaseStatus() {
    const snapshot = this.loadSnapshot() || {};

    return {
      ...this.describe(),
      healthy: true,
      warning: this.mode === "file" ? "file-store-active" : "",
      counts: {
        visits: snapshot.anonymousVisits?.length || 0,
        pilots: snapshot.pilots?.length || 0,
        authSessions: snapshot.authSessions?.length || 0,
        devices: snapshot.devices?.length || 0,
        walletTransactions: 0,
        adminAuditLog: 0,
        matchResults: 0
      },
      latestWalletTransaction: null,
      latestAdminAuditEntry: null,
      latestMatchResult: null
    };
  }

  describe() {
    return {
      mode: this.mode,
      storageFile: this.storageFile
    };
  }

  close() {}
}

export class MongoUserStore {
  constructor(options = {}) {
    this.client = options.client;
    this.collection = options.collection;
    this.snapshot = options.snapshot || null;
    this.pendingSave = Promise.resolve();
    this.mode = "mongo";
    this.mongoDatabase = options.mongoDatabase || "guns";
    this.mongoCollection = options.mongoCollection || "user_snapshots";
  }

  static async connect(options = {}) {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(options.mongoUrl);

    await client.connect();

    const db = client.db(options.mongoDatabase || "guns");
    const collection = db.collection(options.mongoCollection || "user_snapshots");
    const stored = await collection.findOne({ _id: "users" });
    let snapshot = stored?.snapshot || null;

    if (!snapshot && options.seedStore && options.seedFromFile !== false) {
      snapshot = options.seedStore.loadSnapshot();

      if (snapshot) {
        await collection.updateOne(
          { _id: "users" },
          {
            $set: {
              schemaVersion: USER_STORE_SCHEMA_VERSION,
              savedAt: Date.now(),
              snapshot
            }
          },
          { upsert: true }
        );
      }
    }

    await collection.createIndex({ _id: 1 }, { unique: true });

    return new MongoUserStore({
      client,
      collection,
      snapshot,
      mongoDatabase: options.mongoDatabase || "guns",
      mongoCollection: options.mongoCollection || "user_snapshots"
    });
  }

  loadSnapshot() {
    return this.snapshot;
  }

  saveSnapshot(snapshot) {
    this.snapshot = snapshot;
    this.pendingSave = this.pendingSave
      .catch(() => {})
      .then(() => this.collection.updateOne(
        { _id: "users" },
        {
          $set: {
            schemaVersion: USER_STORE_SCHEMA_VERSION,
            savedAt: Date.now(),
            snapshot
          }
        },
        { upsert: true }
      ))
      .catch((error) => {
        console.warn(`Failed to save Mongo user snapshot: ${error.message}`);
      });
  }

  recordWalletTransaction() {}

  listWalletTransactions() {
    return [];
  }

  recordAdminAudit() {}

  listAdminAudit() {
    return [];
  }

  recordMatchResult() {}

  listMatchResults() {
    return [];
  }

  async getDatabaseStatus() {
    const snapshot = this.loadSnapshot() || {};

    return {
      ...this.describe(),
      healthy: true,
      warning: this.mode === "file" ? "file-store-active" : "",
      counts: {
        visits: snapshot.anonymousVisits?.length || 0,
        pilots: snapshot.pilots?.length || 0,
        authSessions: snapshot.authSessions?.length || 0,
        devices: snapshot.devices?.length || 0,
        walletTransactions: 0,
        adminAuditLog: 0,
        matchResults: 0
      },
      latestWalletTransaction: null,
      latestAdminAuditEntry: null,
      latestMatchResult: null
    };
  }

  describe() {
    return {
      mode: this.mode,
      mongoDatabase: this.mongoDatabase,
      mongoCollection: this.mongoCollection
    };
  }

  async close() {
    await this.pendingSave;
    return this.client?.close?.();
  }
}

export class MongoCollectionsUserStore {
  constructor(options = {}) {
    this.client = options.client;
    this.collections = options.collections;
    this.snapshot = options.snapshot || null;
    this.pendingSave = Promise.resolve();
    this.mode = "mongo-collections";
    this.mongoDatabase = options.mongoDatabase || "guns";
  }

  static async connect(options = {}) {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(options.mongoUrl);

    await client.connect();

    const db = client.db(options.mongoDatabase || "guns");
    const collections = {
      visits: db.collection("visits"),
      pilots: db.collection("pilots"),
      authSessions: db.collection("auth_sessions"),
      devices: db.collection("devices"),
      walletTransactions: db.collection("wallet_transactions"),
      adminAuditLog: db.collection("admin_audit_log"),
      matchResults: db.collection("match_results")
    };
    let snapshot = await loadCollectionsSnapshot(collections);

    if (!hasSnapshotData(snapshot) && options.seedStore && options.seedFromFile !== false) {
      snapshot = options.seedStore.loadSnapshot();

      if (snapshot) {
        await saveCollectionsSnapshot(collections, snapshot);
      }
    }

    await ensureCollectionsIndexes(collections);

    return new MongoCollectionsUserStore({
      client,
      collections,
      snapshot,
      mongoDatabase: options.mongoDatabase || "guns"
    });
  }

  loadSnapshot() {
    return this.snapshot;
  }

  saveSnapshot(snapshot) {
    this.snapshot = snapshot;
    this.pendingSave = this.pendingSave
      .catch(() => {})
      .then(async () => {
        await saveCollectionsSnapshot(this.collections, snapshot);
      })
      .catch((error) => {
        console.warn(`Failed to save Mongo user collections: ${error.message}`);
      });
  }

  recordWalletTransaction(transaction = {}) {
    const amount = Number(transaction.amount) || 0;

    if (amount === 0) return;

    const document = {
      _id: randomUUID(),
      currency: "gs",
      createdAt: Date.now(),
      meta: {},
      ...transaction,
      amount
    };

    this.pendingSave = this.pendingSave
      .catch(() => {})
      .then(() => this.collections.walletTransactions.insertOne(document))
      .catch((error) => {
        console.warn(`Failed to record wallet transaction: ${error.message}`);
      });
  }

  async listWalletTransactions(options = {}) {
    const limit = normalizeLimit(options.limit, 50, 200);
    const filter = buildWalletTransactionFilter(options);

    return this.collections.walletTransactions
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
      .then((items) => items.map(stripMongoId));
  }

  recordAdminAudit(entry = {}) {
    const document = {
      _id: randomUUID(),
      createdAt: Date.now(),
      actor: "admin-api",
      before: null,
      after: null,
      meta: {},
      ...entry
    };

    this.pendingSave = this.pendingSave
      .catch(() => {})
      .then(() => this.collections.adminAuditLog.insertOne(document))
      .catch((error) => {
        console.warn(`Failed to record admin audit: ${error.message}`);
      });
  }

  async listAdminAudit(options = {}) {
    const limit = normalizeLimit(options.limit, 50, 200);
    const filter = buildAdminAuditFilter(options);

    return this.collections.adminAuditLog
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
      .then((items) => items.map(stripMongoId));
  }

  recordMatchResult(result = {}) {
    const document = {
      _id: result.matchId || randomUUID(),
      savedAt: Date.now(),
      ...result
    };

    this.pendingSave = this.pendingSave
      .catch(() => {})
      .then(() => this.collections.matchResults.updateOne(
        { _id: document._id },
        { $set: document },
        { upsert: true }
      ))
      .catch((error) => {
        console.warn(`Failed to record match result: ${error.message}`);
      });
  }

  async listMatchResults(options = {}) {
    const limit = normalizeLimit(options.limit, 50, 200);
    const filter = buildMatchResultFilter(options);

    return this.collections.matchResults
      .find(filter)
      .sort({ finishedAt: -1, savedAt: -1 })
      .limit(limit)
      .toArray()
      .then((items) => items.map(stripMongoId));
  }

  async getDatabaseStatus() {
    const [
      visits,
      pilots,
      authSessions,
      devices,
      walletTransactions,
      adminAuditLog,
      matchResults,
      latestWalletTransaction,
      latestAdminAuditEntry,
      latestMatchResult
    ] = await Promise.all([
      this.collections.visits.countDocuments({}),
      this.collections.pilots.countDocuments({}),
      this.collections.authSessions.countDocuments({}),
      this.collections.devices.countDocuments({}),
      this.collections.walletTransactions.countDocuments({}),
      this.collections.adminAuditLog.countDocuments({}),
      this.collections.matchResults.countDocuments({}),
      this.collections.walletTransactions.find({}).sort({ createdAt: -1 }).limit(1).toArray(),
      this.collections.adminAuditLog.find({}).sort({ createdAt: -1 }).limit(1).toArray(),
      this.collections.matchResults.find({}).sort({ finishedAt: -1, savedAt: -1 }).limit(1).toArray()
    ]);

    return {
      ...this.describe(),
      healthy: true,
      warning: this.mode === "file" ? "file-store-active" : "",
      counts: {
        visits,
        pilots,
        authSessions,
        devices,
        walletTransactions,
        adminAuditLog,
        matchResults
      },
      latestWalletTransaction: latestWalletTransaction[0]
        ? stripMongoId(latestWalletTransaction[0])
        : null,
      latestAdminAuditEntry: latestAdminAuditEntry[0]
        ? stripMongoId(latestAdminAuditEntry[0])
        : null,
      latestMatchResult: latestMatchResult[0]
        ? stripMongoId(latestMatchResult[0])
        : null
    };
  }

  describe() {
    return {
      mode: this.mode,
      mongoDatabase: this.mongoDatabase,
      collections: [
        "devices",
        "visits",
        "pilots",
        "auth_sessions",
        "wallet_transactions",
        "admin_audit_log",
        "match_results"
      ]
    };
  }

  async close() {
    await this.pendingSave;
    return this.client?.close?.();
  }
}

export async function createUserStore(options = {}) {
  const fileStore = new FileUserStore(options);
  const useMongoCollections = options.mode === "mongo-collections";
  const useMongoSnapshot =
    options.mode === "mongo" ||
    (options.mode !== "file" && Boolean(options.mongoUrl));

  if (useMongoCollections) {
    return MongoCollectionsUserStore.connect({
      ...options,
      seedStore: fileStore
    });
  }

  if (!useMongoSnapshot) return fileStore;

  return MongoUserStore.connect({
    ...options,
    seedStore: fileStore
  });
}

export function createFileUserStore(options = {}) {
  return new FileUserStore(options);
}

async function loadCollectionsSnapshot(collections) {
  const [visits, pilots, authSessions, devices] = await Promise.all([
    collections.visits.find({}).toArray(),
    collections.pilots.find({}).toArray(),
    collections.authSessions.find({}).toArray(),
    collections.devices.find({}).toArray()
  ]);

  return {
    version: USER_STORE_SCHEMA_VERSION,
    savedAt: Date.now(),
    anonymousVisits: visits.map(stripMongoId),
    pilots: pilots.map(stripMongoId),
    authSessions: authSessions.map(stripMongoId),
    devices: devices.map(stripMongoId)
  };
}

async function saveCollectionsSnapshot(collections, snapshot = {}) {
  await Promise.all([
    replaceCollection(
      collections.visits,
      snapshot.anonymousVisits || [],
      (visit) => visit.deviceId || visit.id
    ),
    replaceCollection(
      collections.pilots,
      snapshot.pilots || [],
      (pilot) => pilot.id || pilot.normalizedNick
    ),
    replaceCollection(
      collections.authSessions,
      snapshot.authSessions || [],
      (session) => session.tokenHash
    ),
    replaceCollection(
      collections.devices,
      snapshot.devices || [],
      (device) => device.id || device.tokenHash
    )
  ]);
}

async function replaceCollection(collection, items, getId) {
  const documents = items.map((item) => ({
    _id: getId(item) || randomUUID(),
    ...item
  }));
  const ids = documents.map((item) => item._id);

  if (ids.length <= 0) {
    await collection.deleteMany({});
    return;
  }

  await collection.bulkWrite(
    documents.map((document) => ({
      replaceOne: {
        filter: { _id: document._id },
        replacement: document,
        upsert: true
      }
    }))
  );
  await collection.deleteMany({
    _id: { $nin: ids }
  });
}

async function ensureCollectionsIndexes(collections) {
  await Promise.all([
    collections.devices.createIndex({ tokenHash: 1 }, { unique: true }),
    collections.visits.createIndex({ deviceId: 1 }),
    collections.pilots.createIndex({ normalizedNick: 1 }, { unique: true }),
    collections.authSessions.createIndex({ tokenHash: 1 }, { unique: true }),
    collections.authSessions.createIndex({ pilotId: 1 }),
    collections.walletTransactions.createIndex({
      entityType: 1,
      entityId: 1,
      createdAt: -1
    }),
    collections.adminAuditLog.createIndex({
      entityType: 1,
      entityId: 1,
      createdAt: -1
    }),
    collections.adminAuditLog.createIndex({
      action: 1,
      createdAt: -1
    }),
    collections.matchResults.createIndex({
      matchId: 1
    }, {
      unique: true
    }),
    collections.matchResults.createIndex({
      roomId: 1,
      finishedAt: -1
    })
  ]);
}


function stripMongoId(document) {
  const { _id, ...data } = document;

  return data;
}

function hasSnapshotData(snapshot) {
  return Boolean(
    snapshot &&
    (
      snapshot.anonymousVisits?.length ||
      snapshot.pilots?.length ||
      snapshot.authSessions?.length ||
      snapshot.devices?.length
    )
  );
}

function normalizeLimit(value, fallback, max) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) return fallback;

  return Math.min(max, Math.floor(number));
}

function buildWalletTransactionFilter(options = {}) {
  const filter = {};

  for (const key of ["entityType", "entityId", "reason"]) {
    const value = String(options[key] || "").trim();

    if (value) {
      filter[key] = value;
    }
  }

  return filter;
}

function buildAdminAuditFilter(options = {}) {
  const filter = {};

  for (const key of ["action", "entityType", "entityId", "actor"]) {
    const value = String(options[key] || "").trim();

    if (value) {
      filter[key] = value;
    }
  }

  return filter;
}

function buildMatchResultFilter(options = {}) {
  const filter = {};

  for (const key of ["matchId", "roomId", "modeId", "winnerId"]) {
    const value = String(options[key] || "").trim();

    if (value) {
      filter[key] = value;
    }
  }

  return filter;
}
