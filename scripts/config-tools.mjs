import fs from "node:fs";
import path from "node:path";

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function readJsonDirectory(dir) {
  const items = {};

  if (!fs.existsSync(dir)) return items;

  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort();

  for (const file of files) {
    const item = readJson(path.join(dir, file));

    if (!item.id) {
      throw new Error(`${file} is missing id`);
    }

    if (items[item.id]) {
      throw new Error(`Duplicate config id: ${item.id}`);
    }

    items[item.id] = item;
  }

  return items;
}

export function buildGameConfig(root) {
  const sharedRoot = path.join(root, "shared");
  const cannons = readJsonDirectory(
    path.join(sharedRoot, "objects", "cannons")
  );
  const rooms = readJsonDirectory(path.join(sharedRoot, "rooms"));
  const modes = readJsonDirectory(path.join(sharedRoot, "modes"));

  const config = {
    schemaVersion: 1,
    configVersion: "0.1.2",
    status: "published",
    objects: {
      cannons
    },
    rooms,
    modes
  };

  validateGameConfig(config);

  return config;
}

export function validateGameConfig(config) {
  requireObject(config, "config");
  requireNumber(config.schemaVersion, "schemaVersion");
  requireString(config.configVersion, "configVersion");
  requireObject(config.objects, "objects");
  requireObject(config.objects.cannons, "objects.cannons");
  requireObject(config.rooms, "rooms");
  requireObject(config.modes, "modes");

  for (const [id, cannon] of Object.entries(config.objects.cannons)) {
    validateCannon(id, cannon);
  }

  for (const [id, mode] of Object.entries(config.modes)) {
    validateMode(id, mode);
  }

  for (const [id, room] of Object.entries(config.rooms)) {
    validateRoom(id, room, config);
  }
}

function validateCannon(id, cannon) {
  requireMatchingId(id, cannon, "cannon");
  requireString(cannon.kind, `cannon.${id}.kind`);
  requireString(cannon.title, `cannon.${id}.title`);
  requireNumber(cannon.version, `cannon.${id}.version`);
  requireObject(cannon.gameplay, `cannon.${id}.gameplay`);
  requireNumber(cannon.gameplay.maxHp, `cannon.${id}.gameplay.maxHp`);
  requireNumber(cannon.gameplay.maxAmmo, `cannon.${id}.gameplay.maxAmmo`);
  requireNumber(
    cannon.gameplay.entryScoreRequired,
    `cannon.${id}.gameplay.entryScoreRequired`
  );
  requireObject(cannon.physics, `cannon.${id}.physics`);
  requireNumber(cannon.physics.radiusOuter, `cannon.${id}.physics.radiusOuter`);
  requireNumber(cannon.physics.radiusInner, `cannon.${id}.physics.radiusInner`);
  requireObject(cannon.render, `cannon.${id}.render`);
}

function validateMode(id, mode) {
  requireMatchingId(id, mode, "mode");
  requireString(mode.title, `mode.${id}.title`);
  requireBoolean(mode.enabled, `mode.${id}.enabled`);
  requireObject(mode.rules, `mode.${id}.rules`);
}

function validateRoom(id, room, config) {
  requireMatchingId(id, room, "room");
  requireString(room.title, `room.${id}.title`);
  requireBoolean(room.enabled, `room.${id}.enabled`);
  requireString(room.modeId, `room.${id}.modeId`);
  requireObject(room.arena, `room.${id}.arena`);
  requireNumber(room.arena.radius, `room.${id}.arena.radius`);
  requireObject(room.limits, `room.${id}.limits`);
  requireNumber(room.limits.maxPlayers, `room.${id}.limits.maxPlayers`);

  if (!config.modes[room.modeId]) {
    throw new Error(`room.${id}.modeId references missing mode ${room.modeId}`);
  }

  if (!Array.isArray(room.allowedCannons)) {
    throw new Error(`room.${id}.allowedCannons must be an array`);
  }

  for (const cannonId of room.allowedCannons) {
    if (!config.objects.cannons[cannonId]) {
      throw new Error(
        `room.${id}.allowedCannons references missing cannon ${cannonId}`
      );
    }
  }
}

function requireMatchingId(id, item, label) {
  requireObject(item, label);
  requireString(item.id, `${label}.${id}.id`);

  if (item.id !== id) {
    throw new Error(`${label}.${id}.id must match key ${id}`);
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function requireNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
}
