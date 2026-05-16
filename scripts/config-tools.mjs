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
  const roomObjects = readJsonDirectory(
    path.join(sharedRoot, "objects", "room-objects")
  );
  const rooms = readJsonDirectory(path.join(sharedRoot, "rooms"));
  const modes = readJsonDirectory(path.join(sharedRoot, "modes"));
  const settings = readJson(path.join(sharedRoot, "settings.json"));

  const config = {
    schemaVersion: 1,
    configVersion: "0.1.22",
    status: "published",
    objects: {
      cannons,
      roomObjects
    },
    rooms,
    modes,
    settings
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
  requireObject(config.objects.roomObjects, "objects.roomObjects");
  requireObject(config.rooms, "rooms");
  requireObject(config.modes, "modes");
  validateSettings(config.settings);

  for (const [id, cannon] of Object.entries(config.objects.cannons)) {
    validateCannon(id, cannon);
  }

  for (const [id, roomObject] of Object.entries(config.objects.roomObjects)) {
    validateRoomObject(id, roomObject);
  }

  for (const [id, mode] of Object.entries(config.modes)) {
    validateMode(id, mode);
  }

  for (const [id, room] of Object.entries(config.rooms)) {
    validateRoom(id, room, config);
  }

}

function validateSettings(settings) {
  requireObject(settings, "settings");
  requireBoolean(settings.botNameBrackets, "settings.botNameBrackets");
  requireObject(settings.economy, "settings.economy");
  requireObject(settings.economy.gunsCoin, "settings.economy.gunsCoin");
  requireNonNegativeNumber(
    settings.economy.gunsCoin.visitorGrant,
    "settings.economy.gunsCoin.visitorGrant"
  );
  requireNonNegativeNumber(
    settings.economy.gunsCoin.playGrant,
    "settings.economy.gunsCoin.playGrant"
  );
  requireNonNegativeNumber(
    settings.economy.gunsCoin.registrationGrant,
    "settings.economy.gunsCoin.registrationGrant"
  );
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
  if (cannon.gameplay.fireRate !== undefined) {
    requireObject(cannon.gameplay.fireRate, `cannon.${id}.gameplay.fireRate`);
    requirePositiveNumber(
      cannon.gameplay.fireRate.player,
      `cannon.${id}.gameplay.fireRate.player`
    );
    requirePositiveNumber(
      cannon.gameplay.fireRate.bot,
      `cannon.${id}.gameplay.fireRate.bot`
    );
  }
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

function validateRoomObject(id, roomObject) {
  requireMatchingId(id, roomObject, "roomObject");
  requireString(roomObject.kind, `roomObject.${id}.kind`);
  requireString(roomObject.title, `roomObject.${id}.title`);
  requireNumber(roomObject.version, `roomObject.${id}.version`);
  requireObject(roomObject.render, `roomObject.${id}.render`);
  requireObject(roomObject.interaction, `roomObject.${id}.interaction`);
  requirePositiveNumber(
    roomObject.interaction.radius,
    `roomObject.${id}.interaction.radius`
  );
}

function validateRoom(id, room, config) {
  requireMatchingId(id, room, "room");
  requireString(room.title, `room.${id}.title`);
  if (room.roomKind !== undefined) {
    requireString(room.roomKind, `room.${id}.roomKind`);
  }
  requireBoolean(room.enabled, `room.${id}.enabled`);
  requireBoolean(room.published, `room.${id}.published`);
  if (room.inherits !== undefined) {
    requireString(room.inherits, `room.${id}.inherits`);
  }
  requireString(room.modeId, `room.${id}.modeId`);
  requireObject(room.arena, `room.${id}.arena`);
  validateRoomArena(id, room.arena);
  requireObject(room.limits, `room.${id}.limits`);
  requireNumber(room.limits.maxPlayers, `room.${id}.limits.maxPlayers`);

  if (!config.modes[room.modeId]) {
    throw new Error(`room.${id}.modeId references missing mode ${room.modeId}`);
  }

  if (room.inherits && !config.rooms[room.inherits]) {
    throw new Error(`room.${id}.inherits references missing room ${room.inherits}`);
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

  if (room.spawns !== undefined) {
    validateRoomSpawns(id, room.spawns, config);
  }

  if (room.objects !== undefined) {
    validateRoomObjectInstances(id, room.objects, config);
  }
}

function validateRoomObjectInstances(roomId, objects, config) {
  if (!Array.isArray(objects)) {
    throw new Error(`room.${roomId}.objects must be an array`);
  }

  for (const item of objects) {
    requireObject(item, `room.${roomId}.objects.item`);
    requireString(item.instanceId, `room.${roomId}.objects.item.instanceId`);
    requireString(item.objectId, `room.${roomId}.objects.item.objectId`);
    requireNumber(item.x, `room.${roomId}.objects.item.x`);
    requireNumber(item.y, `room.${roomId}.objects.item.y`);

    if (item.rotation !== undefined) {
      requireNumber(item.rotation, `room.${roomId}.objects.item.rotation`);
    }

    if (item.params !== undefined) {
      requireObject(item.params, `room.${roomId}.objects.item.params`);
    }

    if (!config.objects.roomObjects[item.objectId]) {
      throw new Error(
        `room.${roomId}.objects.item.objectId references missing room object ${item.objectId}`
      );
    }
  }
}

function validateRoomArena(roomId, arena) {
  const shape = arena.shape || "circle";

  requireString(shape, `room.${roomId}.arena.shape`);

  if (!["circle", "rectangle", "five-pointed-star", "triangle"].includes(shape)) {
    throw new Error(`room.${roomId}.arena.shape is not supported: ${shape}`);
  }

  if (arena.params !== undefined) {
    requireObject(arena.params, `room.${roomId}.arena.params`);
  }

  if (shape === "circle") {
    const radius = arena.params?.radius ?? arena.radius;
    requirePositiveNumber(radius, `room.${roomId}.arena.params.radius`);
  }

  if (shape === "triangle") {
    requirePositiveNumber(arena.params?.radius, `room.${roomId}.arena.params.radius`);

    if (arena.params.rotation !== undefined) {
      requireNumber(arena.params.rotation, `room.${roomId}.arena.params.rotation`);
    }
  }

  if (shape === "rectangle") {
    requirePositiveNumber(arena.params?.width, `room.${roomId}.arena.params.width`);
    requirePositiveNumber(arena.params?.height, `room.${roomId}.arena.params.height`);
  }

  if (shape === "five-pointed-star") {
    requirePositiveNumber(arena.params?.outerRadius, `room.${roomId}.arena.params.outerRadius`);
    requirePositiveNumber(arena.params?.innerRadius, `room.${roomId}.arena.params.innerRadius`);

    if (arena.params.innerRadius >= arena.params.outerRadius) {
      throw new Error(`room.${roomId}.arena.params.innerRadius must be less than outerRadius`);
    }

    if (arena.params.rotation !== undefined) {
      requireNumber(arena.params.rotation, `room.${roomId}.arena.params.rotation`);
    }
  }
}

function validateRoomSpawns(roomId, spawns, config) {
  requireObject(spawns, `room.${roomId}.spawns`);

  if (spawns.bots !== undefined && !Array.isArray(spawns.bots)) {
    throw new Error(`room.${roomId}.spawns.bots must be an array`);
  }

  if (spawns.cannons !== undefined && !Array.isArray(spawns.cannons)) {
    throw new Error(`room.${roomId}.spawns.cannons must be an array`);
  }

  if (spawns.player !== undefined) {
    validateActorSpawn(roomId, "player", spawns.player, config);
  }

  for (const bot of spawns.bots || []) {
    validateActorSpawn(roomId, "bot", bot, config);
  }

  for (const cannon of spawns.cannons || []) {
    requireObject(cannon, `room.${roomId}.spawns.cannon`);
    requireString(cannon.unitId, `room.${roomId}.spawns.cannon.unitId`);
    requireString(cannon.gunType, `room.${roomId}.spawns.cannon.gunType`);
    requireNumber(cannon.x, `room.${roomId}.spawns.cannon.x`);
    requireNumber(cannon.y, `room.${roomId}.spawns.cannon.y`);

    if (!config.objects.cannons[cannon.gunType]) {
      throw new Error(
        `room.${roomId}.spawns.cannon.gunType references missing cannon ${cannon.gunType}`
      );
    }
  }
}

function validateActorSpawn(roomId, label, spawn, config) {
  requireObject(spawn, `room.${roomId}.spawns.${label}`);
  if (label !== "player") {
    requireString(spawn.unitId, `room.${roomId}.spawns.${label}.unitId`);
  }
  if (!["alive", "pilot"].includes(spawn.state)) {
    throw new Error(`room.${roomId}.spawns.${label}.state must be alive or pilot`);
  }
  if (spawn.name !== undefined) {
    requireString(spawn.name, `room.${roomId}.spawns.${label}.name`);
  }
  if (spawn.gunType !== undefined) {
    requireString(spawn.gunType, `room.${roomId}.spawns.${label}.gunType`);

    if (!config.objects.cannons[spawn.gunType]) {
      throw new Error(
        `room.${roomId}.spawns.${label}.gunType references missing cannon ${spawn.gunType}`
      );
    }
  }
  if (spawn.cannonEntityId !== undefined) {
    requireString(
      spawn.cannonEntityId,
      `room.${roomId}.spawns.${label}.cannonEntityId`
    );
  }
  if (spawn.x !== undefined) {
    requireNumber(spawn.x, `room.${roomId}.spawns.${label}.x`);
  }
  if (spawn.y !== undefined) {
    requireNumber(spawn.y, `room.${roomId}.spawns.${label}.y`);
  }
  if (spawn.pilotX !== undefined) {
    requireNumber(spawn.pilotX, `room.${roomId}.spawns.${label}.pilotX`);
  }
  if (spawn.pilotY !== undefined) {
    requireNumber(spawn.pilotY, `room.${roomId}.spawns.${label}.pilotY`);
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

function requirePositiveNumber(value, label) {
  requireNumber(value, label);

  if (value <= 0) {
    throw new Error(`${label} must be greater than 0`);
  }
}

function requireNonNegativeNumber(value, label) {
  requireNumber(value, label);

  if (value < 0) {
    throw new Error(`${label} must be greater than or equal to 0`);
  }
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
}
