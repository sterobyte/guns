const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const blurCanvas = document.createElement("canvas");
const blurCtx = blurCanvas.getContext("2d");

const gridSize = 40;
const USER_BASE_ROOM_ID = "user-cabinet";
const USER_BASE_ROOM_KIND = "user-base";
const LEGACY_USER_BASE_ROOM_KIND = "user-cabinet";

const {
  DEFAULT_ROOM_RADIUS,
  DEFAULT_ROOM_WIDTH,
  DEFAULT_ROOM_HEIGHT
} = window.GUNS_ROOM_ENTRY;
const MENU_TERMINAL_DEFAULT_WIDTH = 150;
const MENU_TERMINAL_DEFAULT_HEIGHT = 54;
const CAMERA_WALL_OVERSCAN = 340;
const CAMERA_BASE_SCALE = 0.86;
const CAMERA_ZOOM_MIN =
  window.GUNS_CONFIG?.render?.cameraZoom?.min ??
  0.72;
const CAMERA_ZOOM_MAX =
  window.GUNS_CONFIG?.render?.cameraZoom?.max ??
  1.22;
const CAMERA_ZOOM_STEP =
  window.GUNS_CONFIG?.render?.cameraZoom?.step ??
  0.06;

const DEFAULT_SKIN = {
  name: "LCD",
  pageBackground: "#1b2414",
  roomOutside: "#223018",
  roomTop: "#bdd08a",
  roomMiddle: "#a9bd78",
  roomBottom: "#7f9558",
  ink: "#1f2b16",
  ink2: "#33451f",
  ink3: "#4b5f2f",
  faint: "rgba(31, 43, 22, 0.16)",
  soft: "rgba(31, 43, 22, 0.32)",
  panel: "rgba(189, 208, 138, 0.62)",
  tutorialPanel: "rgba(189, 208, 138, 0.86)",
  gridMinor: "rgba(31, 43, 22, 0.08)",
  gridMajor: "rgba(31, 43, 22, 0.14)",
  roomVignette: "rgba(31, 43, 22, 0.09)",
  headerShade: "rgba(31, 43, 22, 0.12)",
  player: "#1f2b16",
  bot1: "#33451f",
  bot2: "#4b5f2f",
  bot3: "#26391b",
  bot4: "#6a7f47",
  bot5: "#405629"
};

function getSkinById(skinId) {
  const visual = window.GUNS_CONFIG?.visual || {};
  const skin =
    visual.skins?.[skinId] ||
    visual.skins?.lcd ||
    {};

  return { ...DEFAULT_SKIN, ...skin };
}

function getActiveSkin() {
  return getSkinById(window.GUNS_CONFIG?.visual?.activeSkin);
}

let SKIN = getActiveSkin();
let LCD_BG;
let LCD_BG_LIGHT;
let LCD_BG_DARK;
let LCD_INK;
let LCD_INK_2;
let LCD_INK_3;
let LCD_FAINT;
let LCD_SOFT;
let LCD_PANEL;
let CANNON_INK;
let PILOT_INK;
let PLAYER_COLOR;
let RED_COLOR;
let GREEN_COLOR;
let BOT3_COLOR;
let BOT4_COLOR;
let BOT5_COLOR;
let activeRoomId =
  window.GUNS_APP?.roomId ||
  getDefaultRoomId();
let ACTIVE_ROOM = getRoomById(activeRoomId);
let ROOM_GEOMETRY = window.GUNS_ROOM_ENTRY.createRoomGeometryState(ACTIVE_ROOM);
let ROOM_SHAPE = ROOM_GEOMETRY.shape;
let ROOM_RADIUS = ROOM_GEOMETRY.radius;
let ROOM_WIDTH = ROOM_GEOMETRY.width;
let ROOM_HEIGHT = ROOM_GEOMETRY.height;
let activeModeState = window.GUNS_MODE_REGISTRY?.createModeState?.(ACTIVE_ROOM) || null;

function getRoomById(roomId) {
  return window.GUNS_ROOM_ENTRY.getRoomById(roomId);
}

function getDefaultRoomId() {
  return window.GUNS_ROOM_ENTRY.getDefaultRoomId();
}

function isSelectableRoom(room) {
  return window.GUNS_ROOM_ENTRY.isSelectableRoom(room);
}

function getRoomRadius(room) {
  return window.GUNS_ROOM_ENTRY.getRoomRadius(room);
}

function getRoomShape(room) {
  return window.GUNS_ROOM_ENTRY.getRoomShape(room);
}

function getRoomWidthValue(room) {
  return window.GUNS_ROOM_ENTRY.getRoomWidthValue(room);
}

function getRoomHeightValue(room) {
  return window.GUNS_ROOM_ENTRY.getRoomHeightValue(room);
}

function getActiveMode() {
  return window.GUNS_MODE_REGISTRY?.getRoomMode?.(ACTIVE_ROOM) || null;
}

function getActiveModeRule(ruleName, fallbackValue = 0) {
  return window.GUNS_MODE_REGISTRY?.getModeRule?.(
    getActiveMode(),
    ruleName,
    fallbackValue
  ) ?? fallbackValue;
}

function isActiveModeEnded() {
  return Boolean(activeModeState?.ended);
}

function getRoomWidth() {
  return ROOM_GEOMETRY.width;
}

function getRoomHeight() {
  return ROOM_GEOMETRY.height;
}

function getRoomLeft() {
  return ROOM_GEOMETRY.left;
}

function getRoomRight() {
  return ROOM_GEOMETRY.right;
}

function getRoomTop() {
  return ROOM_GEOMETRY.top;
}

function getRoomBottom() {
  return ROOM_GEOMETRY.bottom;
}

function isCannonAllowedInActiveRoom(gunType) {
  const allowed = ACTIVE_ROOM?.allowedCannons;
  return !Array.isArray(allowed) || allowed.includes(gunType || "autogun");
}

function getActiveRoomObjectInstances() {
  const objects = Array.isArray(ACTIVE_ROOM?.objects)
    ? ACTIVE_ROOM.objects
    : [];

  if (!isUserBaseRoom()) return objects;

  return objects.filter(item =>
    String(item.params?.role || "") !== "language-terminal"
  );
}

function getBaseLanguageTerminalInstances() {
  return [
    {
      instanceId: "language-ru-terminal",
      objectId: "menu-terminal",
      x: -156,
      y: getRoomTop() + 72,
      rotation: 0,
      params: {
        role: "language-terminal",
        label: "РУС",
        action: "set-language",
        language: "ru",
        width: 54,
        height: 38
      }
    },
    {
      instanceId: "language-en-terminal",
      objectId: "menu-terminal",
      x: 156,
      y: getRoomTop() + 72,
      rotation: 0,
      params: {
        role: "language-terminal",
        label: "ENG",
        action: "set-language",
        language: "en",
        width: 54,
        height: 38
      }
    }
  ];
}

function getRoomObjectPosition(instance) {
  const anchor = instance?.anchor;

  if (!anchor?.position) {
    return {
      x: Number(instance?.x || 0),
      y: Number(instance?.y || 0)
    };
  }

  const marginX = Number(anchor.marginX || 0);
  const marginY = Number(anchor.marginY || 0);
  const position = String(anchor.position);

  if (position === "top-center") {
    return { x: marginX, y: getRoomTop() + marginY };
  }

  if (position === "bottom-center") {
    return { x: marginX, y: getRoomBottom() - marginY };
  }

  if (position === "left-center") {
    return { x: getRoomLeft() + marginX, y: marginY };
  }

  if (position === "right-center") {
    return { x: getRoomRight() - marginX, y: marginY };
  }

  return { x: marginX, y: marginY };
}

function getRoomObjectDefinition(objectId) {
  return window.GUNS_SHARED_CONFIG?.objects?.roomObjects?.[objectId] || null;
}

function isUserBaseRoom() {
  return (
    ACTIVE_ROOM?.id === USER_BASE_ROOM_ID ||
    ACTIVE_ROOM?.roomKind === USER_BASE_ROOM_KIND ||
    ACTIVE_ROOM?.roomKind === LEGACY_USER_BASE_ROOM_KIND
  );
}

function isMarketRoom() {
  return ACTIVE_ROOM?.roomKind === "market";
}

function isFixedCameraRoom() {
  return isUserBaseRoom() || isMarketRoom();
}

function getPlayerCallsign() {
  return (
    window.GUNS_APP?.playerNick ||
    player?.displayName ||
    "visitor-0000"
  );
}

function isServicePlayerCallsign() {
  return getPlayerCallsign().toLocaleLowerCase("en-US").startsWith("visitor-");
}

function getPlayerGunsCoinBalance() {
  const coins = Number(window.GUNS_APP?.getWalletGunsCoin?.());

  return Number.isFinite(coins) ? Math.max(0, Math.floor(coins)) : 0;
}

function getPlayerExchangeScoreBalance() {
  const score = Number(window.GUNS_APP?.getExchangeScore?.());

  return Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
}

function isPilotDialogOpen() {
  return window.GUNS_APP?.isPilotDialogOpen?.() === true;
}

function canMoveTowardMouse(unit, target, radius) {
  return true;
}

function isUnitHidden(unit) {
  return !!unit?.tutorialHidden || !!unit?.roomHidden;
}

function applyActiveRoomToUnits() {
  window.GUNS_ROOM_SPAWNS.applyRoomSpawns({
    room: ACTIVE_ROOM,
    units,
    pilotRadius: PILOT_RADIUS,
    defaultCannonColor: LCD_INK_2,
    resetUnit: resetUnitRuntimeState,
    applyCannonType: applyCannonTypeToUnit,
    isCannonAllowed: isCannonAllowedInActiveRoom,
    createUnit: makeUnit,
    makeCannonOnly,
    randomPointInRoom
  });
}

function enterRoom(roomId) {
  if (roomId === USER_BASE_ROOM_ID && !isUserBaseRoom()) {
    window.GUNS_APP?.bankExchangeScore?.(player.score);
  }

  const entryState = window.GUNS_ROOM_ENTRY.createRoomEntryState(roomId);

  applyRoomEntryState(entryState);
  resetActiveModeState();
  resetRoomRuntimeState();
  resetRoomControlState();
  applyRoomGameplayState();
  spawnInitialRoomPowerups();
  window.GUNS_MODE_REGISTRY?.onRoomEnter?.(activeModeState, {
    room: ACTIVE_ROOM
  });
  window.GUNS_APP?.syncBaseRoomPanel?.();

  return ACTIVE_ROOM;
}

function setActiveRoom(roomId) {
  return enterRoom(roomId);
}

function applyRoomEntryState(entryState) {
  activeRoomId = entryState.activeRoomId;
  ACTIVE_ROOM = entryState.activeRoom;
  ROOM_GEOMETRY = entryState.geometry;
  ROOM_SHAPE = ROOM_GEOMETRY.shape;
  ROOM_RADIUS = ROOM_GEOMETRY.radius;
  ROOM_WIDTH = ROOM_GEOMETRY.width;
  ROOM_HEIGHT = ROOM_GEOMETRY.height;
  bindRoomRuntimeState(entryState.runtimeState);
}

function applyRoomGameplayState() {
  applyActiveRoomToUnits();
  player.score = getPlayerExchangeScoreBalance();

  if (isUserBaseRoom()) {
    player.pilotImmunity = 0;
  }

  applyLiveCannonFireRates();
  invalidateRenderCaches();
  clampUnitsToRoom();
}

function resetUnitRuntimeState(unit) {
  unit.knockback = null;
  unit.pilotKnockback = null;
  unit.pilotEject = null;
  unit.postEjectBrake = null;
  unit.exitRequested = false;
  unit.exitStopTimer = 0;
  unit.recoilTime = 0;
  unit.fireCooldown = 0;
  unit.aiTarget = null;
  unit.aiTimer = 0;
  unit.aiTargetTimer = 0;
  unit.aiBurstShots = 0;
  unit.aiBurstPause = 0;
  unit.pilotFlyState = "ground";
  unit.pilotFlyTime = 0;
  unit.pilotRadius = PILOT_RADIUS;
  unit.pilotHp = 1;
  unit.pilotImmunity = unit.isPlayer ? PILOT_IMMUNITY_TIME : 0;
  unit.activePilotWeaponId = "";
  unit.pilotWeaponCooldown = 0;
  unit.pilotFireCooldown = 0;
  unit.carriedAmmoValue = 0;
  unit.carriedRepairValue = 0;
  unit.wreckRepair = 0;
  unit.wreckHp = 0;
  unit.cannonDestroyed = false;
  unit.hp = unit.maxHp;
  unit.ammo = getMaxAmmo(unit);
  unit.score = 0;
  unit.passiveScoreTimer = 0;
  unit.pilotKills = 0;
  unit.cannonBreaks = 0;
  unit.pilotDeaths = 0;
  unit.lastMoveVx = 0;
  unit.lastMoveVy = 0;
  unit.pilotLastMoveVx = 0;
  unit.pilotLastMoveVy = 0;
  unit.smokeTimer = 0;
  unit.rearSmokeTimer = 0;
}

function bindRoomRuntimeState(nextState) {
  roomRuntimeState = nextState;
  syncLegacyRuntimeCollections();
}

function syncLegacyRuntimeCollections() {
  if (!window.GUNS_LEGACY) return;

  window.GUNS_LEGACY.roomRuntimeState = roomRuntimeState;
  window.GUNS_LEGACY.activeModeState = activeModeState;
}

function resetActiveModeState() {
  activeModeState = window.GUNS_MODE_REGISTRY?.createModeState?.(ACTIVE_ROOM) || null;
  syncLegacyRuntimeCollections();
}

function syncActiveModeStateFromServer() {
  const match = window.GUNS_NET?.getMatchState?.();

  if (!match || !activeModeState || match.roomId !== activeRoomId) return;

  activeModeState.serverMatchId = match.id || "";
  activeModeState.serverState = match.state || "";
  activeModeState.startedAt = match.startedAt || activeModeState.startedAt;
  activeModeState.durationMs = Math.max(0, Number(match.durationMs) || 0);
  activeModeState.remainingMs = Math.max(0, Number(match.remainingMs) || 0);
  activeModeState.ended = match.state === "finished";
  activeModeState.endedAt = match.finishedAt || activeModeState.endedAt;
  activeModeState.endReason = match.finishReason || activeModeState.endReason;
  activeModeState.results = match.results || activeModeState.results || null;
  activeModeState.winnerId = match.results?.winnerId || activeModeState.winnerId || "";
  activeModeState.winnerNick = match.results?.winnerNick || activeModeState.winnerNick || "";
  syncLegacyRuntimeCollections();
}

function resetRoomRuntimeState() {
  hintMessages.length = 0;
  scoreboardRows.clear();
  remoteRenderStates.clear();
  collisionLocks.clear();
  roomRuntimeState.bullets.length = 0;
  roomRuntimeState.ammoPacks.length = 0;
  roomRuntimeState.explosions.length = 0;
  roomRuntimeState.smokePuffs.length = 0;
  roomRuntimeState.rearSmokePuffs.length = 0;
  roomRuntimeState.trails.length = 0;
  roomRuntimeState.stains.length = 0;
  roomRuntimeState.deathOverlays.length = 0;
  ammoSpawnTimer = 0;
  roomObjectActivationCooldown = 0;
  pendingTeleportActivation = null;
  clearPlayerDeathPrompt();
}

function resetRoomControlState() {
  mouse.down = false;
  paused = false;
}

function applySkinPalette(skin) {
  SKIN = { ...DEFAULT_SKIN, ...skin };
  LCD_BG = SKIN.roomMiddle;
  LCD_BG_LIGHT = SKIN.roomTop;
  LCD_BG_DARK = SKIN.roomBottom;
  LCD_INK = SKIN.ink;
  LCD_INK_2 = SKIN.ink2;
  LCD_INK_3 = SKIN.ink3;
  LCD_FAINT = SKIN.faint;
  LCD_SOFT = SKIN.soft;
  LCD_PANEL = SKIN.panel;
  CANNON_INK = LCD_INK;
  PILOT_INK = LCD_INK;
  PLAYER_COLOR = SKIN.player;
  RED_COLOR = SKIN.bot1;
  GREEN_COLOR = SKIN.bot2;
  BOT3_COLOR = SKIN.bot3;
  BOT4_COLOR = SKIN.bot4;
  BOT5_COLOR = SKIN.bot5;
}

function invalidateRenderCaches() {
  arenaBackgroundCache = null;
  lcdOverlayPattern = null;
  lcdOverlayPatternColor = "";
  cannonTintedSpriteCache?.clear?.();
  cannonScaledSpriteCache?.clear?.();
  deathUiSpriteCache?.clear?.();
  modeBadgeSpriteCache?.clear?.();
}

applySkinPalette(SKIN);
const GAME_VERSION =
  window.GUNS_CONFIG?.project?.version ||
  "0.0.1";
const HEALTH_BAR_OPACITY =
  window.GUNS_CONFIG?.render?.healthBarOpacity ??
  0.5;
const CANVAS_MAX_DEVICE_PIXEL_RATIO =
  window.GUNS_CONFIG?.render?.canvasMaxDevicePixelRatio ??
  1;
const ARENA_BACKGROUND_CACHE_SCALE =
  window.GUNS_CONFIG?.render?.arenaBackgroundCacheScale ??
  1;
const PERF_DEBUG =
  new URLSearchParams(window.location.search).has("fps");
const MULTIPLAYER_DEBUG =
  new URLSearchParams(window.location.search).has("mp");
const PERF_DEBUG_LABEL =
  new URLSearchParams(window.location.search).get("fps") ||
  "1";
const PERF_REPORT_RATE_MS = 250;
const PERF_SMOOTHING = 0.18;
const LIVE_CONFIG_REFRESH_MS = 5000;
const SERVER_POSITION_CORRECTION_DEADZONE = 36;
const SERVER_POSITION_CORRECTION_SNAP_DISTANCE = 220;
const SERVER_POSITION_CORRECTION_BLEND = 0.35;
let liveConfigVersion =
  window.GUNS_SHARED_CONFIG?.configVersion ||
  "";

function text(key, params) {
  return window.GUNS_I18N?.t?.(key, params) || key;
}

function createRoomRuntimeState(roomId = activeRoomId) {
  return window.GUNS_ROOM_SESSION.createRoomRuntimeState(roomId);
}

let roomRuntimeState = createRoomRuntimeState();
const hintMessages = [];
const scoreboardRows = new Map();
const remoteRenderStates = new Map();
const playerDeathPrompt = window.GUNS_DEATH_FLOW.createPlayerDeathPrompt();
let arenaBackgroundCache = null;
const cabinetBackdropImages = [];
const CABINET_BACKDROP_INTERVAL_MS = 30000;
const CABINET_BACKDROP_FADE_MS = 2400;
const CABINET_BACKDROP_PULSE_MS = 16000;
let lcdOverlayPattern = null;
let lcdOverlayPatternColor = "";
const pilots = [];
const cannons = [];
const pilotUnitById = new Map();
const cannonUnitById = new Map();

const AMMO_MAX = 30;
const AMMO_PACK_VALUE = 30;
const REPAIR_PACK_HEAL_RATIO = 0.25;
const AMMO_PACK_FADE_TIME = 2;
const AMMO_PACK_LIFE_TIME = 60;
const POWERUP_AMMO = "ammo";
const POWERUP_REPAIR = "repair";
const BULLET_SPEED = 720;

const BOT_TURRET_TURN_SPEED = 5.8;
const BOT_MAX_SHOOT_DISTANCE = 1320;
const BOT_MIN_SHOT_CONFIDENCE = 0.46;
const BOT_AMMO_SEEK_THRESHOLD = 2;

const KNOCKBACK_TIME = 0.75;
const KNOCKBACK_DISTANCE = 170;
const CANNON_COLLISION_DAMAGE_RATIO = 0.05;
const CANNON_RUNOVER_MIN_SPEED = 45;
const CANNON_RUNOVER_DOT = 0.3;

const WRECK_REPAIR_TIME = 16;
const WRECK_HP = 500;

const HP_REGEN_TIME = 60;
const HP_REGEN_PER_SECOND = 100 / HP_REGEN_TIME;

const PILOT_RADIUS = 7;
const PILOT_STOP_RADIUS = 18;
const PILOT_IMMUNITY_TIME = 5;

const PILOT_EJECT_TIME = 2.5;
const PILOT_EJECT_DISTANCE = 510;
const PILOT_EJECT_PEAK_RADIUS = 27;
const PILOT_FLY_PEAK_RADIUS = 17;
const PILOT_FLY_TRANSITION_TIME = 0.75;
const PILOT_WEAPON_CONTACT_COOLDOWN = 0.65;
const GRAVE_NAME_TRIGGER_RADIUS = 32;
const GRAVE_NAME_SHOW_TIME = 1;

function getCannonDefinition(type = "autogun") {
  return window.GUNS_OBJECTS?.cannons?.get?.(type) || null;
}

function getCannonDefinitionNumber(type, path, fallback) {
  const definition = getCannonDefinition(type);
  const value = window.GUNS_OBJECTS?.byPath?.(
    definition,
    path,
    fallback
  );
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function getPilotWeaponDefinition(type = "basic-pistol") {
  return window.GUNS_OBJECTS?.pilotWeapons?.get?.(type) || null;
}

function getPilotWeaponNumber(type, path, fallback) {
  const definition = getPilotWeaponDefinition(type);
  const value = window.GUNS_OBJECTS?.byPath?.(
    definition,
    path,
    fallback
  );
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function getDefaultPilotWeaponId() {
  return getPilotWeaponDefinition("basic-knife")
    ? "basic-knife"
    : "basic-pistol";
}

function playerHasPilotWeapon(weaponId) {
  return window.GUNS_APP?.hasPilotWeapon?.(weaponId) === true;
}

function getOwnedPilotWeaponByType(typeId) {
  const type = String(typeId || "").trim();
  const owned = window.GUNS_APP?.getPilotWeapons?.() || [];

  return owned.find(weaponId => {
    return getPilotWeaponDefinition(weaponId)?.typeId === type;
  }) || "";
}

const cannonRenderMetrics = new Map();
const cannonSpriteCache = new Map();
const cannonTintedSpriteCache = new Map();
const cannonScaledSpriteCache = new Map();
const deathUiSpriteCache = new Map();
const modeBadgeSpriteCache = new Map();

function getCannonRenderMetrics(type = "autogun") {
  const key = type || "autogun";

  if (cannonRenderMetrics.has(key)) {
    return cannonRenderMetrics.get(key);
  }

  const definition = getCannonDefinition(key);
  const render = definition?.render || {};
  const metrics = {
    barrelWidth: Number(render.barrel?.width) || 10,
    barrelHeight: Number(render.barrel?.height) || 95,
    barrelY: Number(render.barrel?.y) || -85,
    barrelInnerWidth: Number(render.barrel?.innerWidth) || 4,
    barrelInnerHeight: Number(render.barrel?.innerHeight) || 62,
    coreRadius: Number(render.core?.radius) || 28,
    antennaWidth: Number(render.antenna?.width) || 8,
    antennaHeight: Number(render.antenna?.height) || 28,
    antennaRadius: Number(render.antenna?.radius) || 4,
    antennaSwing: Number(render.antenna?.swing) || 0.25,
    antennaSwingSpeed: Number(render.antenna?.swingSpeed) || 0.003
  };

  cannonRenderMetrics.set(key, metrics);
  return metrics;
}

const CANNON_TYPE_CONFIG = {
  autogun: {
    maxAmmo: getCannonDefinitionNumber(
      "autogun",
      "gameplay.maxAmmo",
      AMMO_MAX
    ),
    entryScoreRequired: getCannonDefinitionNumber(
      "autogun",
      "gameplay.entryScoreRequired",
      0
    )
  },
  doublegun: {
    maxAmmo: getCannonDefinitionNumber(
      "doublegun",
      "gameplay.maxAmmo",
      AMMO_MAX * 2
    ),
    entryScoreRequired: getCannonDefinitionNumber(
      "doublegun",
      "gameplay.entryScoreRequired",
      0
    )
  },
  heavygun: {
    maxAmmo: getCannonDefinitionNumber(
      "heavygun",
      "gameplay.maxAmmo",
      AMMO_MAX
    ),
    entryScoreRequired: getCannonDefinitionNumber(
      "heavygun",
      "gameplay.entryScoreRequired",
      0
    )
  },
  machinegun: {
    maxAmmo: getCannonDefinitionNumber(
      "machinegun",
      "gameplay.maxAmmo",
      AMMO_MAX * 3
    ),
    entryScoreRequired: getCannonDefinitionNumber(
      "machinegun",
      "gameplay.entryScoreRequired",
      0
    )
  }
};

const STAIN_LIFE = 60;

const mouse = {
  x: 0,
  y: 0,
  active: false,
  down: false
};

const keys = {
  space: false,
  enter: false,
  z: false,
  p: false,
  f: false
};

let paused = false;
let baseCursorFollowEnabled = true;
let cameraUserZoom = CAMERA_ZOOM_MIN;
let roomObjectActivationCooldown = 0;
let pendingTeleportActivation = null;

const camera = {
  x: 0,
  y: 0,
  scale: getCameraBaseScale()
};

const tutorial = {
  initialized: false,
  stepIndex: 0,
  enteredStep: -1,
  shotCount: 0,
  targetBroken: false,
  ammoSpawned: false,
  ammoPicked: false,
  completed: false
};

const LEGACY_TUTORIAL_ENABLED = false;
const TUTORIAL_TOTAL_STEPS = 6;

function isTutorialMode() {
  return LEGACY_TUTORIAL_ENABLED && window.GUNS_APP?.mode === "tutorial";
}

function getCameraBaseScale() {
  const cameraHeight = getCameraHeight();

  if (isFixedCameraRoom()) {
    return Math.min(
      window.innerWidth / Math.max(1, getRoomWidth() + 96),
      window.innerHeight / Math.max(1, getRoomHeight() + 96)
    ) / cameraHeight;
  }

  return CAMERA_BASE_SCALE * cameraUserZoom / cameraHeight;
}

function getCameraHeight() {
  const value = Number(
    window.GUNS_SHARED_CONFIG?.settings?.camera?.height ??
    window.GUNS_CONFIG?.render?.cameraHeight ??
    1
  );

  return Number.isFinite(value) && value > 0
    ? clamp(value, 0.5, 3)
    : 1;
}

function adjustCameraZoom(direction) {
  if (isFixedCameraRoom()) return;

  cameraUserZoom = clamp(
    cameraUserZoom + direction * CAMERA_ZOOM_STEP,
    CAMERA_ZOOM_MIN,
    CAMERA_ZOOM_MAX
  );
}

function canUseCursorFollow() {
  return !isUserBaseRoom() || baseCursorFollowEnabled;
}

function randomPilotOffset() {
  const maxScreen = Math.max(window.innerWidth, window.innerHeight);

  const dist = 300 + Math.random() * maxScreen * 1.5;
  const angle = Math.random() * Math.PI * 2;

  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist
  };
}

function makeUnit(
  id,
  x,
  y,
  color,
  speed,
  isPlayer,
  gunType = "autogun"
) {
  const offset = randomPilotOffset();
  const cannonConfig =
    CANNON_TYPE_CONFIG[gunType] ||
    CANNON_TYPE_CONFIG.autogun;
  const cannonDefinition = getCannonDefinition(gunType);
  const controllerKey = isPlayer ? "player" : "bot";

  return {
    id,
    pilotEntityId: id,
    cannonEntityId: `${id}-${gunType}`,
    isPlayer,
    isCannonOnly: false,

    state: "pilot",

    x,
    y,

    radiusOuter: getCannonDefinitionNumber(
      gunType,
      "physics.radiusOuter",
      34
    ),
    radiusInner: getCannonDefinitionNumber(
      gunType,
      "physics.radiusInner",
      13
    ),

    speed:
      speed ??
      getCannonDefinitionNumber(
        gunType,
        `physics.speed.${controllerKey}`,
        0
      ),

    slowdownRadius: getCannonDefinitionNumber(
      gunType,
      `physics.slowdownRadius.${controllerKey}`,
      isPlayer ? 220 : 0
    ),
    stopRadius: getCannonDefinitionNumber(
      gunType,
      `physics.stopRadius.${controllerKey}`,
      isPlayer ? 50 : 0
    ),

    moveAngle: 0,
    lastMoveVx: 0,
    lastMoveVy: 0,
    turretAngle: 0,

    repairAngle: 0,
    repairSpinDir: 1,

    fireCooldown: 0,
    fireRate: getCannonDefinitionNumber(
      gunType,
      `gameplay.fireRate.${controllerKey}`,
      isPlayer ? 0.12 : 0.35
    ),
    recoilTime: 0,
    recoilDuration: getCannonDefinitionNumber(
      gunType,
      "gameplay.recoilDuration",
      0.085
    ),

    color,

    hp: getCannonDefinitionNumber(
      gunType,
      "gameplay.maxHp",
      100
    ),
    maxHp: getCannonDefinitionNumber(
      gunType,
      "gameplay.maxHp",
      100
    ),
    wreckHp: 0,
    cannonDestroyed: false,

    ammo: cannonConfig.maxAmmo,

    frags: 0,
    pilotKills: 0,
    cannonBreaks: 0,
    pilotDeaths: 0,
    score: 0,
    passiveScoreTimer: 0,

    knockback: null,

    exitRequested: false,
    exitStopTimer: 0,
    postEjectBrake: null,

    pilotX: x + offset.x,
    pilotY: y + offset.y,

    pilotRadius: PILOT_RADIUS,
    pilotSpeed: isPlayer ? 230 : 145,

    pilotHp: 1,
    pilotImmunity: PILOT_IMMUNITY_TIME,
    activePilotWeaponId: "",
    pilotWeaponCooldown: 0,
    pilotFireCooldown: 0,

    pilotKnockback: null,
    pilotEject: null,
    pilotLastMoveVx: 0,
    pilotLastMoveVy: 0,
    pilotFlyState: "ground",
    pilotFlyTime: 0,
    carriedAmmoValue: 0,
    carriedRepairValue: 0,

    wreckRepair: 0,

    smokeTimer: 0,
    rearSmokeTimer: 0,

    aiMode: "approach",
    aiTimer: 0,
    aiTargetTimer: 0,
    aiTarget: null,
    aiBurstShots: 0,
    aiBurstPause: 0,

    gunType,
    objectDefinitionId: cannonDefinition?.id || gunType,
    entryScoreRequired: cannonConfig.entryScoreRequired,
    entryLocked: false,
    damageMultiplier: getCannonDefinitionNumber(
      gunType,
      "gameplay.damageMultiplier",
      1
    ),
    bulletDamage: getCannonDefinitionNumber(
      gunType,
      "gameplay.damage",
      10
    )
  };
}

function getUnitFireRate(unit) {
  const controllerKey = unit.isPlayer ? "player" : "bot";

  return getCannonDefinitionNumber(
    unit.gunType,
    `gameplay.fireRate.${controllerKey}`,
    unit.isPlayer ? 0.12 : 0.35
  );
}

function applyLiveCannonFireRates() {
  for (const unit of units) {
    const nextFireRate = getUnitFireRate(unit);

    unit.fireRate = nextFireRate;
    unit.fireCooldown = Math.min(unit.fireCooldown, nextFireRate);
  }
}

async function refreshLiveConfig() {
  const config = await window.GUNS_CONFIG_LOADER?.refresh?.();
  const nextVersion = config?.configVersion || "";

  if (!nextVersion || nextVersion === liveConfigVersion) return;

  liveConfigVersion = nextVersion;
  applyLiveCannonFireRates();
}

function applyCannonTypeToUnit(unit, gunType) {
  const cannonConfig =
    CANNON_TYPE_CONFIG[gunType] ||
    CANNON_TYPE_CONFIG.autogun;
  const cannonDefinition = getCannonDefinition(gunType);
  const controllerKey = unit.isPlayer ? "player" : "bot";

  unit.gunType = gunType;
  unit.objectDefinitionId = cannonDefinition?.id || gunType;
  unit.cannonEntityId = unit.cannonEntityId || `${unit.id}-${gunType}`;
  unit.radiusOuter = getCannonDefinitionNumber(
    gunType,
    "physics.radiusOuter",
    34
  );
  unit.radiusInner = getCannonDefinitionNumber(
    gunType,
    "physics.radiusInner",
    13
  );
  unit.speed = getCannonDefinitionNumber(
    gunType,
    `physics.speed.${controllerKey}`,
    unit.speed || 0
  );
  unit.fireRate = getUnitFireRate(unit);
  unit.recoilDuration = getCannonDefinitionNumber(
    gunType,
    "gameplay.recoilDuration",
    0.085
  );
  unit.maxHp = getCannonDefinitionNumber(
    gunType,
    "gameplay.maxHp",
    100
  );
  unit.hp = Math.min(Math.max(unit.hp, 1), unit.maxHp);
  unit.ammo = getCannonDefinitionNumber(
    gunType,
    "gameplay.maxAmmo",
    cannonConfig.maxAmmo
  );
  unit.entryScoreRequired = cannonConfig.entryScoreRequired;
  unit.damageMultiplier = getCannonDefinitionNumber(
    gunType,
    "gameplay.damageMultiplier",
    1
  );
  unit.bulletDamage = getCannonDefinitionNumber(
    gunType,
    "gameplay.damage",
    10
  );
}

const player = makeUnit("player", 0, 0, PLAYER_COLOR, 260, true);

const bot1 = makeUnit(
  "bot1",
  950,
  620,
  RED_COLOR,
  126,
  false
);

const bot2 = makeUnit(
  "bot2",
  -950,
  -620,
  GREEN_COLOR,
  126,
  false
);

const bot3 = makeUnit(
  "bot3",
  -760,
  520,
  BOT3_COLOR,
  126,
  false
);

const bot4 = makeUnit(
  "bot4",
  760,
  -520,
  BOT4_COLOR,
  126,
  false,
  "machinegun"
);

const bot5 = makeUnit(
  "bot5",
  0,
  620,
  BOT5_COLOR,
  126,
  false
);

const autoGun1 = makeUnit(
  "autogun1",
  -520,
  0,
  RED_COLOR,
  0,
  false,
  "heavygun"
);

const autoGun2 = makeUnit(
  "autogun2",
  520,
  0,
  GREEN_COLOR,
  0,
  false,
  "machinegun"
);

player.cannonEntityId = "autogun0";
bot1.cannonEntityId = "autogun1";
bot2.cannonEntityId = "autogun2";
autoGun1.cannonEntityId = "autogun3";
autoGun2.cannonEntityId = "autogun4";

bot1.displayName = "Yuriy";
bot2.displayName = "Sidorova";
bot3.displayName = "Kirk";
bot4.displayName = "Lara";
bot5.displayName = "Danila";

function setActiveSkin(skinId) {
  const visual = window.GUNS_CONFIG?.visual;

  if (!visual?.skins?.[skinId]) return null;

  visual.activeSkin = skinId;
  applySkinPalette(getSkinById(skinId));

  player.color = PLAYER_COLOR;
  bot1.color = RED_COLOR;
  bot2.color = GREEN_COLOR;
  bot3.color = BOT3_COLOR;
  bot4.color = BOT4_COLOR;
  bot5.color = BOT5_COLOR;
  autoGun1.color = RED_COLOR;
  autoGun2.color = GREEN_COLOR;
  invalidateRenderCaches();

  if (window.GUNS_LEGACY) {
    window.GUNS_LEGACY.skin = SKIN;
    window.GUNS_LEGACY.skins = visual.skins;
  }

  return SKIN;
}

function makePilotOnly(unit) {
  unit.cannonEntityId = null;
  unit.cannonDestroyed = true;
  unit.hp = 0;
  unit.wreckHp = 0;
  unit.wreckRepair = 0;
  unit.knockback = null;
  unit.postEjectBrake = null;
  return unit;
}

function makeCannonOnly(unit) {
  unit.isCannonOnly = true;
  unit.pilotEntityId = null;
  unit.pilotImmunity = 0;
  return unit;
}

makePilotOnly(bot3);
makePilotOnly(bot4);
makePilotOnly(bot5);

makeCannonOnly(autoGun1);
makeCannonOnly(autoGun2);

const units = [
  player,
  bot1,
  bot2,
  bot3,
  bot4,
  bot5,
  autoGun1,
  autoGun2
];

applyActiveRoomToUnits();

function syncDomainEntities() {
  pilots.length = 0;
  cannons.length = 0;
  pilotUnitById.clear();
  cannonUnitById.clear();

  const occupantByCannonId = new Map();

  for (const unit of units) {
    if (isUnitHidden(unit)) continue;

    if (
      unit.pilotEntityId &&
      unit.state === "alive" &&
      unit.cannonEntityId
    ) {
      occupantByCannonId.set(
        unit.cannonEntityId,
        unit.pilotEntityId
      );
    }
  }

  for (const unit of units) {
    if (isUnitHidden(unit)) continue;

    if (unit.pilotEntityId) {
      pilotUnitById.set(unit.pilotEntityId, unit);

      pilots.push({
        id: unit.pilotEntityId,
        unitId: unit.id,
        nick: getUnitDisplayName(unit),
        controller: unit.isPlayer ? "human" : "bot",
        isPlayer: !!unit.isPlayer,
        color: unit.color,
        state: unit.state === "alive" ? "in-cannon" : "on-foot",
        occupiedCannonId:
          unit.state === "alive" ? unit.cannonEntityId : null,
        x: unit.state === "alive" ? unit.x : unit.pilotX,
        y: unit.state === "alive" ? unit.y : unit.pilotY,
        score: unit.score,
        pilotKills: unit.pilotKills || 0,
        cannonBreaks: unit.cannonBreaks || 0,
        pilotDeaths: unit.pilotDeaths || 0,
        carriedAmmoValue: unit.carriedAmmoValue || 0,
        carriedRepairValue: unit.carriedRepairValue || 0,
        immune: unit.pilotImmunity > 0,
        flying: unit.pilotFlyState !== "ground"
      });
    }

    if (unit.cannonEntityId) {
      cannonUnitById.set(unit.cannonEntityId, unit);

      cannons.push({
        id: unit.cannonEntityId,
        unitId: unit.id,
        type: unit.gunType,
        x: unit.x,
        y: unit.y,
        hp: unit.hp,
        maxHp: unit.maxHp,
        ammo: unit.ammo,
        maxAmmo: getMaxAmmo(unit),
        entryScoreRequired: getEntryScoreRequired(unit),
        entryLocked: !!unit.entryLocked,
        broken: unit.wreckRepair > 0,
        destroyed: !!unit.cannonDestroyed,
        occupantPilotId:
          getServerCannonOccupant(unit) ||
          occupantByCannonId.get(unit.cannonEntityId) ||
          null,
        free:
          unit.state === "pilot" &&
          !unit.cannonDestroyed &&
          unit.wreckRepair <= 0 &&
          unit.hp > 0 &&
          !isCannonOccupiedByRemote(unit)
      });
    }
  }
}

function getServerCannonState(unit) {
  if (!unit?.cannonEntityId) return null;

  const serverCannons = window.GUNS_NET?.getServerCannons?.() || [];

  return serverCannons.find(cannon => cannon.id === unit.cannonEntityId) || null;
}

function getServerCannonOccupant(unit) {
  const serverCannon = getServerCannonState(unit);

  return serverCannon?.occupiedBy || "";
}

function isCannonOccupiedByRemote(unit) {
  const occupiedBy = getServerCannonOccupant(unit);
  const ownClientId = window.GUNS_NET?.describe?.().clientId || "";

  return Boolean(occupiedBy && occupiedBy !== ownClientId);
}

function getPilotEntityById(id) {
  syncDomainEntities();
  return pilots.find(pilot => pilot.id === id) || null;
}

function getCannonEntityById(id) {
  syncDomainEntities();
  return cannons.find(cannon => cannon.id === id) || null;
}

window.GUNS_LEGACY = {
  player,
  bot1,
  bot2,
  bot3,
  bot4,
  bot5,
  autoGun1,
  autoGun2,
  units,
  pilots,
  cannons,
  pilotUnitById,
  cannonUnitById,
  syncDomainEntities,
  getPilotEntityById,
  getCannonEntityById,
  hintMessages,
  skin: SKIN,
  skins: window.GUNS_CONFIG?.visual?.skins || { lcd: SKIN },
  setActiveSkin,
  getActiveSkin: () => SKIN,
  setActiveRoom,
  getActiveRoom: () => ACTIVE_ROOM,
  getActiveRoomId: () => activeRoomId,
  roomRuntimeState,
  getRoomRuntimeState: () => roomRuntimeState,
  refreshLiveConfig,
  clearPlayerDeathPrompt,
  bouncePlayerFromRoomObject,
  setPlayerNick(nick) {
    player.displayName = nick;
  }
};

if (window.GUNS_APP?.playerNick) {
  window.GUNS_LEGACY.setPlayerNick(
    window.GUNS_APP.playerNick
  );
}

function resetUnitForTutorial(unit) {
  unit.tutorialHidden = false;
  unit.knockback = null;
  unit.pilotKnockback = null;
  unit.pilotEject = null;
  unit.postEjectBrake = null;
  unit.exitRequested = false;
  unit.exitStopTimer = 0;
  unit.recoilTime = 0;
  unit.fireCooldown = 0;
  unit.aiTarget = null;
  unit.aiTimer = 0;
  unit.aiTargetTimer = 0;
  unit.aiBurstShots = 0;
  unit.aiBurstPause = 0;
  unit.pilotFlyState = "ground";
  unit.pilotFlyTime = 0;
  unit.pilotRadius = PILOT_RADIUS;
  unit.pilotImmunity = 0;
  unit.carriedAmmoValue = 0;
  unit.carriedRepairValue = 0;
  unit.wreckRepair = 0;
  unit.cannonDestroyed = false;
  unit.hp = unit.maxHp;
  unit.wreckHp = 0;
  unit.ammo = getMaxAmmo(unit);
}

function hideTutorialUnit(unit) {
  resetUnitForTutorial(unit);
  unit.tutorialHidden = true;
  unit.state = "pilot";
  unit.cannonDestroyed = true;
  unit.wreckRepair = 0;
  unit.hp = 0;
  unit.ammo = 0;
  unit.pilotX = getRoomRight() - 80;
  unit.pilotY = getRoomBottom() - 80;
  unit.x = getRoomRight() - 80;
  unit.y = getRoomBottom() - 80;
}

function setupTutorialScenario() {
  tutorial.initialized = true;
  tutorial.stepIndex = 0;
  tutorial.enteredStep = -1;
  tutorial.shotCount = 0;
  tutorial.targetBroken = false;
  tutorial.ammoSpawned = false;
  tutorial.ammoPicked = false;
  tutorial.completed = false;

  roomRuntimeState.bullets.length = 0;
  roomRuntimeState.ammoPacks.length = 0;
  roomRuntimeState.explosions.length = 0;
  roomRuntimeState.smokePuffs.length = 0;
  roomRuntimeState.rearSmokePuffs.length = 0;
  roomRuntimeState.trails.length = 0;
  roomRuntimeState.stains.length = 0;
  roomRuntimeState.deathOverlays.length = 0;
  hintMessages.length = 0;

  paused = false;
  mouse.down = false;
  cameraUserZoom = CAMERA_ZOOM_MIN;
  camera.scale = getCameraBaseScale();

  resetUnitForTutorial(player);
  player.state = "pilot";
  player.x = -30;
  player.y = 0;
  player.pilotX = -310;
  player.pilotY = 0;
  player.turretAngle = 0;
  player.moveAngle = 0;
  player.ammo = 30;
  player.score = 0;
  player.pilotKills = 0;
  player.cannonBreaks = 0;
  player.pilotDeaths = 0;

  resetUnitForTutorial(bot1);
  bot1.state = "alive";
  bot1.x = 520;
  bot1.y = 0;
  bot1.speed = 0;
  bot1.turretAngle = Math.PI;
  bot1.moveAngle = Math.PI;
  bot1.ammo = 0;
  bot1.score = 0;
  bot1.pilotKills = 0;
  bot1.cannonBreaks = 0;
  bot1.pilotDeaths = 0;
  bot1.displayName = "TARGET";

  hideTutorialUnit(bot2);
  hideTutorialUnit(bot3);
  hideTutorialUnit(bot4);
  hideTutorialUnit(bot5);
  hideTutorialUnit(autoGun1);
  hideTutorialUnit(autoGun2);

  camera.x = player.pilotX;
  camera.y = player.pilotY;
}

for (const unit of units) {
  unit.state = "pilot";

  clampToRoomPoint(unit, unit.radiusOuter);
  clampPilotToRoom(unit);
}

let ammoSpawnTimer = 0;
let lastTime = performance.now();
let lastNetworkSnapshotAt = 0;
let lastDomainSyncAt = 0;
let networkCombatEventsInitialized = false;
let networkRoomConfigEventsInitialized = false;
let networkInventoryEventsInitialized = false;
let networkServerSnapshotEventsInitialized = false;
let lastAppliedServerSnapshotAt = 0;
let perfLastFrameAt = performance.now();
let perfLastReportAt = performance.now();
let perfLastFps = 0;
let perfFrameMs = 1000 / 60;
let arenaGraphicsPrewarmed = false;
const DOMAIN_SYNC_RATE_MS = 250;

const collisionLocks = new Set();

setupNetworkCombatEvents();
setupNetworkRoomConfigEvents();
setupNetworkInventoryEvents();
setupNetworkServerSnapshotEvents();

function resize() {
  const rawDpr = window.devicePixelRatio || 1;
  const dpr = Math.max(
    1,
    Math.min(rawDpr, CANVAS_MAX_DEVICE_PIXEL_RATIO)
  );

  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;

  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function reportPerf(now) {
  const frameMs = now - perfLastFrameAt;
  perfLastFrameAt = now;

  if (frameMs > 0) {
    perfFrameMs += (frameMs - perfFrameMs) * PERF_SMOOTHING;
    perfLastFps = 1000 / perfFrameMs;

    window.GUNS_PERF = {
      fps: perfLastFps,
      frameMs: perfFrameMs,
      at: now
    };
  }

  const elapsed = now - perfLastReportAt;

  if (elapsed < PERF_REPORT_RATE_MS) return;

  perfLastReportAt = now;

  if (PERF_DEBUG) {
    console.log(
      `[GUNS FPS ${PERF_DEBUG_LABEL}] ${perfLastFps.toFixed(1)}`
    );
  }
}

function getCannonSpriteRender(type = "autogun") {
  const definition = getCannonDefinition(type);
  const render = definition?.render || {};

  if (render.renderer !== "sprite-cannon-canvas") {
    return null;
  }

  const sprites = render.sprites || {};
  const body = getSpriteImage(sprites.body?.src);
  const turret = getSpriteImage(sprites.turret?.src);

  if (!body?.complete || !turret?.complete) {
    return null;
  }

  return {
    body: getPaletteSprite(body, sprites.body?.src),
    turret: getPaletteSprite(turret, sprites.turret?.src),
    bodySrc: sprites.body?.src || "",
    turretSrc: sprites.turret?.src || "",
    bodyConfig: sprites.body || {},
    turretConfig: sprites.turret || {}
  };
}

function getSpriteImage(src) {
  if (!src) return null;

  if (cannonSpriteCache.has(src)) {
    return cannonSpriteCache.get(src);
  }

  const image = new Image();
  image.decoding = "async";
  image.src = src;
  cannonSpriteCache.set(src, image);

  return image;
}

function isSpriteImageReady(image) {
  return Boolean(
    image?.complete &&
    (image.naturalWidth || image.width) &&
    (image.naturalHeight || image.height)
  );
}

function watchSpriteImagePrewarm(image) {
  if (!image || image.gunsPrewarmWatch) return;

  image.gunsPrewarmWatch = true;
  image.addEventListener(
    "load",
    () => {
      arenaGraphicsPrewarmed = prewarmArenaGraphics();
    },
    { once: true }
  );
}

function preloadCannonSprites() {
  const definitions = window.GUNS_OBJECTS?.definitions?.cannons || {};

  for (const definition of Object.values(definitions)) {
    const sprites = definition?.render?.sprites || {};

    watchSpriteImagePrewarm(getSpriteImage(sprites.body?.src));
    watchSpriteImagePrewarm(getSpriteImage(sprites.turret?.src));
  }
}

function prewarmArenaGraphics() {
  const definitions = window.GUNS_OBJECTS?.definitions?.cannons || {};
  let allReady = true;

  for (const definition of Object.values(definitions)) {
    const render = definition?.render || {};

    if (render.renderer !== "sprite-cannon-canvas") continue;

    const sprites = render.sprites || {};
    const bodyConfig = sprites.body || {};
    const turretConfig = sprites.turret || {};
    const body = getSpriteImage(sprites.body?.src);
    const turret = getSpriteImage(sprites.turret?.src);
    const bodyReady = isSpriteImageReady(body);
    const turretReady = isSpriteImageReady(turret);

    if (!bodyReady || !turretReady) {
      watchSpriteImagePrewarm(body);
      watchSpriteImagePrewarm(turret);
      allReady = false;
      continue;
    }

    const bodySprite = getPaletteSprite(body, sprites.body?.src);
    const turretSprite = getPaletteSprite(turret, sprites.turret?.src);
    const bodyRadiusPx = Number(bodyConfig.radiusPx) || 207;
    const radiusOuter = Number(definition?.physics?.radiusOuter) || 34;
    const spriteScale = radiusOuter / bodyRadiusPx;

    getScaledSprite(bodySprite, sprites.body?.src || "", bodyConfig, spriteScale);
    getScaledSprite(turretSprite, sprites.turret?.src || "", turretConfig, spriteScale);
  }

  prewarmDeathUiGraphics();

  return allReady;
}

preloadCannonSprites();

function getPaletteSprite(image, src) {
  const primary = parseCanvasColor(CANNON_INK);
  const secondary = parseCanvasColor(LCD_BG_LIGHT);
  const cacheKey =
    `${src || ""}|${CANNON_INK}|${LCD_BG_LIGHT}|${image.naturalWidth}x${image.naturalHeight}`;

  if (cannonTintedSpriteCache.has(cacheKey)) {
    return cannonTintedSpriteCache.get(cacheKey);
  }

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) return image;

  const tintedCanvas = document.createElement("canvas");
  const tintedCtx = tintedCanvas.getContext("2d");

  tintedCanvas.width = width;
  tintedCanvas.height = height;
  tintedCtx.drawImage(image, 0, 0);

  const imageData = tintedCtx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;

    const luminance =
      pixels[i] * 0.2126 +
      pixels[i + 1] * 0.7152 +
      pixels[i + 2] * 0.0722;
    const color = luminance < 128 ? primary : secondary;

    pixels[i] = color.r;
    pixels[i + 1] = color.g;
    pixels[i + 2] = color.b;
  }

  tintedCtx.putImageData(imageData, 0, 0);
  cannonTintedSpriteCache.set(cacheKey, tintedCanvas);

  return tintedCanvas;
}

function getScaledSprite(image, src, config, spriteScale) {
  const sourceWidth = image.width || image.naturalWidth;
  const sourceHeight = image.height || image.naturalHeight;
  const renderWidth = Number(config.width) || sourceWidth;
  const renderHeight = Number(config.height) || sourceHeight;
  const width = Math.max(1, Math.round(renderWidth * spriteScale));
  const height = Math.max(1, Math.round(renderHeight * spriteScale));
  const cacheKey =
    `${src}|${CANNON_INK}|${LCD_BG_LIGHT}|${sourceWidth}x${sourceHeight}|${width}x${height}`;

  if (cannonScaledSpriteCache.has(cacheKey)) {
    return cannonScaledSpriteCache.get(cacheKey);
  }

  const canvas = document.createElement("canvas");
  const scaledCtx = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  scaledCtx.imageSmoothingEnabled = true;
  scaledCtx.drawImage(image, 0, 0, width, height);
  cannonScaledSpriteCache.set(cacheKey, canvas);

  return canvas;
}

function parseCanvasColor(value) {
  const scratch = parseCanvasColor.canvas ||
    (parseCanvasColor.canvas = document.createElement("canvas"));
  const scratchCtx = parseCanvasColor.ctx ||
    (parseCanvasColor.ctx = scratch.getContext("2d"));

  scratchCtx.fillStyle = "#000";
  scratchCtx.fillStyle = value || "#000";

  const normalized = scratchCtx.fillStyle;

  if (normalized.startsWith("#")) {
    const hex = normalized.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16)
    };
  }

  const match = normalized.match(/\d+(\.\d+)?/g) || [];

  return {
    r: Number(match[0]) || 0,
    g: Number(match[1]) || 0,
    b: Number(match[2]) || 0
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getRoomGeometryState() {
  return ROOM_GEOMETRY;
}

function clampToRoomPoint(obj, radius = 0) {
  window.GUNS_ROOM_GEOMETRY.clampToRoomPoint(
    obj,
    getRoomGeometryState(),
    radius
  );
}

function isOutsideRoom(x, y, margin = 0) {
  return window.GUNS_ROOM_GEOMETRY.isOutsideRoom(
    x,
    y,
    getRoomGeometryState(),
    margin
  );
}

function clampPointToRoom(x, y, radius = 0) {
  return window.GUNS_ROOM_GEOMETRY.clampPointToRoom(
    x,
    y,
    getRoomGeometryState(),
    radius
  );
}

function randomPointInRoom(padding = 0) {
  return window.GUNS_ROOM_GEOMETRY.randomPointInRoom(
    getRoomGeometryState(),
    padding,
    randomRange
  );
}

function isPolygonRoomShape() {
  return window.GUNS_ROOM_GEOMETRY.isPolygonRoomShape(ROOM_SHAPE);
}

function getRoomPolygonPoints(radiusOffset = 0) {
  return window.GUNS_ROOM_GEOMETRY.getRoomPolygonPoints(
    getRoomGeometryState(),
    radiusOffset
  );
}

function clampPilotToRoom(unit) {
  const pilotPoint =
    clampPointToRoom(unit.pilotX, unit.pilotY, unit.pilotRadius);

  unit.pilotX = pilotPoint.x;
  unit.pilotY = pilotPoint.y;

  if (unit.pilotEject) {
    const ejectEnd =
      clampPointToRoom(
        unit.pilotEject.endX,
        unit.pilotEject.endY,
        unit.pilotRadius
      );

    unit.pilotEject.endX = ejectEnd.x;
    unit.pilotEject.endY = ejectEnd.y;
  }
}

function clampUnitsToRoom() {
  for (const unit of units) {
    if (!unit.cannonDestroyed) {
      clampToRoomPoint(unit, unit.radiusOuter);
    }

    clampPilotToRoom(unit);
  }
}


function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleToTarget(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function angleDelta(from, to) {
  return Math.atan2(
    Math.sin(to - from),
    Math.cos(to - from)
  );
}

function rotateTowardAngle(from, to, maxStep) {
  const delta = angleDelta(from, to);

  if (Math.abs(delta) <= maxStep) {
    return to;
  }

  return from + Math.sign(delta) * maxStep;
}

function worldToScreen(x, y) {
  return {
    x: (x - camera.x) * camera.scale + window.innerWidth / 2,
    y: (y - camera.y) * camera.scale + window.innerHeight / 2
  };
}

function screenToWorld(x, y) {
  return {
    x: (x - window.innerWidth / 2) / camera.scale + camera.x,
    y: (y - window.innerHeight / 2) / camera.scale + camera.y
  };
}

function clampCamera() {
  if (isFixedCameraRoom()) {
    camera.x = 0;
    camera.y = 0;
    return;
  }

  const halfW = window.innerWidth / 2 / camera.scale;
  const halfH = window.innerHeight / 2 / camera.scale;
  const overscan = CAMERA_WALL_OVERSCAN / camera.scale;

  const maxX = Math.max(
    0,
    getRoomWidth() / 2 - Math.max(0, halfW - overscan)
  );
  const maxY = Math.max(
    0,
    getRoomHeight() / 2 - Math.max(0, halfH - overscan)
  );

  camera.x = clamp(camera.x, -maxX, maxX);
  camera.y = clamp(camera.y, -maxY, maxY);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function getMaxAmmo(unit) {
  return (
    CANNON_TYPE_CONFIG[unit.gunType]?.maxAmmo ||
    AMMO_MAX
  );
}

function getEntryScoreRequired(cannon) {
  return Math.max(
    0,
    cannon.entryScoreRequired ??
      CANNON_TYPE_CONFIG[cannon.gunType]
        ?.entryScoreRequired ??
      0
  );
}

function z(v) {
  return v * camera.scale;
}

function getActivePoint(unit) {
  return unit.state === "pilot"
    ? { x: unit.pilotX, y: unit.pilotY }
    : { x: unit.x, y: unit.y };
}

function getActiveVelocity(unit) {
  return unit.state === "pilot"
    ? {
        x: unit.pilotLastMoveVx || 0,
        y: unit.pilotLastMoveVy || 0
      }
    : {
        x: unit.lastMoveVx || 0,
        y: unit.lastMoveVy || 0
      };
}

function getPilotPoint(unit) {
  return unit.state === "alive"
    ? { x: unit.x, y: unit.y }
    : { x: unit.pilotX, y: unit.pilotY };
}

function getEnemies(unit) {
  const enemies = [];

  forEachEnemy(unit, enemy => enemies.push(enemy));

  return enemies;
}

function forEachEnemy(unit, callback) {
  if (unit.isCannonOnly) return;

  for (const enemy of units) {
    if (enemy === unit) continue;
    if (isUnitHidden(enemy)) continue;
    if (enemy.isCannonOnly) continue;

    if (
      isPilotAirborne(enemy) &&
      unit !== player &&
      enemy === player &&
      player.state === "pilot"
    ) {
      continue;
    }

    callback(enemy);
  }
}

function addScore(unit, value, reason = "", context = {}) {
  if (!unit) return;
  if (unit.isCannonOnly) return;
  const scoreValue = Number(value) || 0;

  if (unit.isPlayer && isServerCombatAuthoritative() && isCombatScoreReason(reason)) {
    return;
  }

  unit.score += scoreValue;
  if (unit.isPlayer) {
    window.GUNS_APP?.addExchangeScore?.(scoreValue);
    const sendServerPointEvent = isCombatScoreReason(reason)
      ? window.GUNS_NET?.sendCombatEvent
      : window.GUNS_NET?.sendScoreEvent;

    sendServerPointEvent?.({
      value: scoreValue,
      reason,
      total: unit.score,
      ...context
    });
  }
  window.GUNS_MODE_REGISTRY?.onScore?.(activeModeState, {
    unit,
    value: scoreValue,
    reason
  });
}

function isServerCombatAuthoritative() {
  return window.GUNS_NET?.connected === true;
}

function isCombatScoreReason(reason) {
  return (
    reason === "bullet-hit" ||
    reason === "pilot-kill" ||
    reason === "cannon-break" ||
    reason === "pilot-death"
  );
}

function getCombatTargetContext(unit, targetKind = "unit") {
  if (!unit) return {};

  return {
    targetId:
      unit.pilotEntityId ||
      unit.cannonEntityId ||
      unit.id ||
      "",
    targetKind
  };
}

function updatePassiveScore(unit, dt) {
  if (unit.isCannonOnly) return;

  unit.passiveScoreTimer += dt;

  const ticks =
    Math.floor(unit.passiveScoreTimer / 0.1);

  if (ticks <= 0) return;

  addScore(unit, ticks * getActiveModeRule("passiveScorePerTick", 1), "passive");
  unit.passiveScoreTimer -= ticks * 0.1;
}

function canEnterCannon(unit, cannon) {
  return (
    !cannon.entryLocked &&
    unit.score >= getEntryScoreRequired(cannon)
  );
}

function addHint(text) {
  const existing =
    hintMessages.find(h => h.text === text);

  if (existing) {
    existing.time = 0;
    return;
  }

  hintMessages.push({
    text,
    time: 0,
    life: 1.7
  });
}

function isPilotAirborne(unit) {
  return (
    unit.state === "pilot" &&
    unit.pilotFlyState !== "ground"
  );
}

function isDeathBlurActive() {
  return window.GUNS_DEATH_FLOW.isDeathPromptActive(playerDeathPrompt);
}

function getPilotFlyAmount(unit) {
  if (unit.pilotFlyState === "ground") return 0;
  if (unit.pilotFlyState === "flying") return 1;

  const t = clamp(
    unit.pilotFlyTime / PILOT_FLY_TRANSITION_TIME,
    0,
    1
  );

  const k = Math.sin((Math.PI / 2) * t);

  return unit.pilotFlyState === "rising"
    ? k
    : 1 - k;
}

function startPlayerFlyToggle() {
  if (isDeathBlurActive()) return;
  if (isUserBaseRoom()) return;
  if (player.state !== "pilot") return;
  if (player.pilotEject) return;

  if (
    player.pilotFlyState === "ground" ||
    player.pilotFlyState === "falling"
  ) {
    dropCarriedPowerups(player);
    player.pilotFlyState = "rising";
    player.pilotFlyTime = 0;
    player.pilotKnockback = null;
    return;
  }

  if (
    player.pilotFlyState === "flying" ||
    player.pilotFlyState === "rising"
  ) {
    player.pilotFlyState = "falling";
    player.pilotFlyTime = 0;
  }
}

function clearPlayerDeathPrompt() {
  window.GUNS_DEATH_FLOW.clearPlayerDeathPrompt(
    playerDeathPrompt,
    roomRuntimeState
  );
}

function startPlayerDeathPrompt() {
  window.GUNS_DEATH_FLOW.startPlayerDeathPrompt({
    prompt: playerDeathPrompt,
    roomRuntimeState,
    player,
    mouse,
    pilotImmunityTime: PILOT_IMMUNITY_TIME
  });
}

function continuePlayerAfterDeath() {
  window.GUNS_DEATH_FLOW.continuePlayerAfterDeath({
    prompt: playerDeathPrompt,
    player,
    mouse,
    pilotImmunityTime: PILOT_IMMUNITY_TIME
  });
  sendNetworkRespawnEvent();
}

function exitPlayerAfterDeath() {
  window.GUNS_DEATH_FLOW.exitPlayerAfterDeath({
    prompt: playerDeathPrompt,
    player,
    mouse,
    pilotRadius: PILOT_RADIUS,
    pilotImmunityTime: PILOT_IMMUNITY_TIME
  });
}

function updatePilotFly(unit, dt) {
  if (unit.pilotFlyState === "ground") return;

  if (unit.pilotFlyState === "flying") {
    unit.pilotRadius = PILOT_FLY_PEAK_RADIUS;
    unit.pilotLastMoveVx = 0;
    unit.pilotLastMoveVy = 0;
    return;
  }

  unit.pilotFlyTime += dt;

  const t = clamp(
    unit.pilotFlyTime / PILOT_FLY_TRANSITION_TIME,
    0,
    1
  );

  const k = Math.sin((Math.PI / 2) * t);
  const up =
    unit.pilotFlyState === "rising"
      ? k
      : 1 - k;

  unit.pilotRadius =
    PILOT_RADIUS +
    up * (PILOT_FLY_PEAK_RADIUS - PILOT_RADIUS);

  unit.pilotLastMoveVx = 0;
  unit.pilotLastMoveVy = 0;

  if (t >= 1) {
    if (unit.pilotFlyState === "rising") {
      unit.pilotFlyState = "flying";
      unit.pilotRadius = PILOT_FLY_PEAK_RADIUS;
    } else {
      unit.pilotFlyState = "ground";
      unit.pilotRadius = PILOT_RADIUS;
    }

    unit.pilotFlyTime = 0;
  }
}

function pairKey(a, b) {
  return a.id < b.id
    ? a.id + "|" + b.id
    : b.id + "|" + a.id;
}

function getNearestEnemy(unit) {
  let best = null;
  let bestD = Infinity;

  const self = getActivePoint(unit);

  forEachEnemy(unit, enemy => {
    const d = distance(self, getActivePoint(enemy));

    if (d < bestD) {
      best = enemy;
      bestD = d;
    }
  });

  return best;
}

function fireBullet(owner, angle) {
  if (owner.state !== "alive") return [];
  if (owner.ammo <= 0) return [];

  const perpX = Math.cos(angle + Math.PI / 2);
  const perpY = Math.sin(angle + Math.PI / 2);
  const bulletColor = getBulletColor(owner);
  const bullets = [];

  const makeBullet = (offset) => {
    const bullet = {
      x:
        owner.x +
        Math.cos(angle) * 85 +
        perpX * offset,

      y:
        owner.y +
        Math.sin(angle) * 85 +
        perpY * offset,

      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,

      radius: 4,
      life: 1.8,

      owner,
      color: bulletColor,

      damage:
        owner.bulletDamage * owner.damageMultiplier
    };

    roomRuntimeState.bullets.push(bullet);
    bullets.push(bullet);
  };

  const definition = getCannonDefinition(owner.gunType);
  const barrels = Array.isArray(definition?.weapon?.barrels)
    ? definition.weapon.barrels
    : [0];

  owner.recoilTime = owner.recoilDuration;

  for (const offset of barrels) {
    makeBullet(Number(offset) || 0);
  }

  owner.ammo = Math.max(0, owner.ammo - 1);

  if (isTutorialMode() && owner === player) {
    tutorial.shotCount++;
  }

  return bullets;
}

function firePilotPistol(owner, weaponId, angle) {
  const weapon = getPilotWeaponDefinition(weaponId);
  const fireRate = getPilotWeaponNumber(weaponId, "gameplay.fireRate", 0);

  if (owner.state !== "pilot") return false;
  if (isPilotAirborne(owner)) return false;
  if (weapon?.typeId !== "pistol") return false;
  if (fireRate <= 0) return false;

  const bullet = {
    x: owner.pilotX + Math.cos(angle) * (owner.pilotRadius + 10),
    y: owner.pilotY + Math.sin(angle) * (owner.pilotRadius + 10),
    vx: Math.cos(angle) * BULLET_SPEED * 0.72,
    vy: Math.sin(angle) * BULLET_SPEED * 0.72,
    radius: 3,
    life: 1.05,
    owner,
    color: owner.color,
    damage: getPilotWeaponNumber(weaponId, "gameplay.damage", 0)
  };

  roomRuntimeState.bullets.push(bullet);

  return bullet;
}

function getBulletColor(owner) {
  return owner.color;
}

function getPowerupOptions() {
  return {
    roomRuntimeState,
    room: ACTIVE_ROOM,
    units,
    ammoPackValue: AMMO_PACK_VALUE,
    repairPackHealRatio: REPAIR_PACK_HEAL_RATIO,
    packFadeTime: AMMO_PACK_FADE_TIME,
    packLifeTime: AMMO_PACK_LIFE_TIME,
    wreckRepairTime: WRECK_REPAIR_TIME,
    spawnTimer: ammoSpawnTimer,
    randomPointInRoom,
    clampPointToRoom,
    getMaxAmmo,
    addScore,
    getActiveModeRule,
    isUnitHidden,
    isPilotAirborne,
    isUserBaseRoom,
    distance,
    clamp,
    onAmmoPicked(unit) {
      if (isTutorialMode() && unit === player) {
        tutorial.ammoPicked = true;
      }
    }
  };
}

function addPowerup(x, y, type, value) {
  roomRuntimeState.ammoPacks.push({
    x,
    y,
    radius: 16,
    type,
    value,
    time: 0
  });
}

function addAmmoPack(x, y, value = AMMO_PACK_VALUE) {
  window.GUNS_POWERUPS.addAmmoPack(getPowerupOptions(), x, y, value);
}

function addRepairPack(x, y, value = REPAIR_PACK_HEAL_RATIO) {
  window.GUNS_POWERUPS.addRepairPack(getPowerupOptions(), x, y, value);
}

function spawnAmmoPack() {
  const point = randomPointInRoom(90);
  addAmmoPack(point.x, point.y);
}

function spawnRepairPack() {
  const point = randomPointInRoom(90);
  addRepairPack(point.x, point.y);
}

function spawnPowerup() {
  window.GUNS_POWERUPS.spawnPowerup(getPowerupOptions());
}

function getInitialRoomPowerupCount() {
  const count = Number(ACTIVE_ROOM?.powerups?.initialCount ?? 0);

  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function spawnInitialRoomPowerups() {
  window.GUNS_POWERUPS.spawnInitialRoomPowerups(getPowerupOptions());
}

function dropCarriedAmmo(unit) {
  if (unit.carriedAmmoValue <= 0) return;

  const point = clampPointToRoom(unit.pilotX, unit.pilotY, 90);
  addAmmoPack(point.x, point.y, unit.carriedAmmoValue);

  unit.carriedAmmoValue = 0;
}

function dropCarriedRepair(unit) {
  if (unit.carriedRepairValue <= 0) return;

  const point = clampPointToRoom(unit.pilotX, unit.pilotY, 90);
  addRepairPack(point.x, point.y, unit.carriedRepairValue);

  unit.carriedRepairValue = 0;
}

function dropCarriedPowerups(unit) {
  window.GUNS_POWERUPS.dropCarriedPowerups(getPowerupOptions(), unit);
}

function getCarriedPowerup(unit) {
  return window.GUNS_POWERUPS.getCarriedPowerup(unit);
}

function clearCarriedPowerups(unit) {
  window.GUNS_POWERUPS.clearCarriedPowerups(unit);
}

function setCarriedPowerup(unit, type, value) {
  window.GUNS_POWERUPS.setCarriedPowerup(unit, type, value);
}

function getPowerupSwapDropPoint(unit, pack) {
  const speed = Math.hypot(
    unit.pilotLastMoveVx || 0,
    unit.pilotLastMoveVy || 0
  );
  const angle =
    speed > 4
      ? Math.atan2(unit.pilotLastMoveVy, unit.pilotLastMoveVx) + Math.PI
      : Math.atan2(
          unit.pilotY - pack.y,
          unit.pilotX - pack.x
        );

  return clampPointToRoom(
    unit.pilotX + Math.cos(angle) * 42,
    unit.pilotY + Math.sin(angle) * 42,
    pack.radius
  );
}

function addExplosion(x, y) {
  roomRuntimeState.explosions.push({
    x,
    y,
    time: 0,
    life: 0.55
  });
}

function addSmoke(x, y) {
  roomRuntimeState.smokePuffs.push({
    x: x + (Math.random() - 0.5) * 14,
    y: y - 28 + (Math.random() - 0.5) * 8,

    radius: 7 + Math.random() * 8,

    time: 0,
    life: 1.55
  });
}

function addRearSmoke(unit) {
  const angle = unit.moveAngle + Math.PI;

  roomRuntimeState.rearSmokePuffs.push({
    x: unit.x + Math.cos(angle) * 60 + (Math.random() - 0.5) * 3,
    y: unit.y + Math.sin(angle) * 60 + (Math.random() - 0.5) * 3,

    vx: Math.cos(angle) * 42,
    vy: Math.sin(angle) * 42,

    radius: 2.5 + Math.random() * 1.5,

    time: 0,
    life: 0.36,

    color: unit.color
  });
}

function addTrail(x, y, radius, color, life = 0.34) {
  roomRuntimeState.trails.push({
    x,
    y,
    radius,
    color,
    time: 0,
    life
  });
}

function updateMovementTrails() {
  for (const unit of units) {
    if (unit.isCannonOnly) continue;
    if (isUnitHidden(unit)) continue;

    const cannonMoving =
      Math.hypot(unit.lastMoveVx || 0, unit.lastMoveVy || 0) > 18;

    if (
      unit.state === "alive" &&
      cannonMoving &&
      Math.random() < 0.45
    ) {
      addTrail(
        unit.x,
        unit.y,
        unit.radiusOuter * 0.62,
        CANNON_INK,
        0.28
      );
    }

    const pilotMoving =
      unit.state === "pilot" &&
      !unit.pilotEject &&
      Math.hypot(
        unit.pilotLastMoveVx || 0,
        unit.pilotLastMoveVy || 0
      ) > 18;

    if (
      pilotMoving &&
      Math.random() < 0.22
    ) {
      addTrail(
        unit.pilotX,
        unit.pilotY,
        unit.pilotRadius * 0.9,
        PILOT_INK,
        0.24
      );
    }

    if (
      unit.pilotEject &&
      Math.random() < 0.55
    ) {
      addTrail(
        unit.pilotX,
        unit.pilotY,
        unit.pilotRadius * 0.8,
        PILOT_INK,
        0.30
      );
    }
  }
}

function addStain(x, y, color, pilotName) {
  roomRuntimeState.stains.push({
    x,
    y,
    color,
    pilotName,
    nameTime: 0,

    time: 0,
    life: STAIN_LIFE
  });
}

function addDeathOverlay() {
  roomRuntimeState.deathOverlays.push({
    time: 0,
    life: 3
  });
}

function chooseBotTarget(bot) {
  let best = null;
  let bestScore = Infinity;

  const self = getActivePoint(bot);

  forEachEnemy(bot, enemy => {
    if (enemy.cannonDestroyed && enemy.state !== "pilot") return;

    const p = getActivePoint(enemy);
    const d = distance(self, p);

    let score = d;

    if (enemy.state === "alive") score -= 80;
    if (enemy.state === "pilot" && enemy.pilotImmunity <= 0 && !enemy.pilotEject) score -= 140;
    if (enemy.pilotImmunity > 0) score += 120;
    if (enemy.pilotEject) score += 220;
    score += Math.random() * 35;

    if (score < bestScore) {
      bestScore = score;
      best = enemy;
    }
  });

  bot.aiTarget = best;
  bot.aiTargetTimer = randomRange(0.06, 0.16);
}

function chooseBotMode(bot) {
  chooseBotTarget(bot);

  const lowAmmo =
    bot.ammo <= BOT_AMMO_SEEK_THRESHOLD;

  if (lowAmmo && roomRuntimeState.ammoPacks.length > 0) {
    bot.aiMode = "ammo";
  } else {
    bot.aiMode = "approach";
  }

  bot.aiTimer = randomRange(0.08, 0.22);
}

function getNearestAmmo(unit) {
  let best = null;
  let bestD = Infinity;

  const p = getActivePoint(unit);

  for (const pack of roomRuntimeState.ammoPacks) {
    const d = Math.hypot(
      p.x - pack.x,
      p.y - pack.y
    );

    if (d < bestD) {
      bestD = d;
      best = pack;
    }
  }

  return best;
}

function moveToward(unit, target, dt, stopDistance = 0) {
  const dx = target.x - unit.x;
  const dy = target.y - unit.y;

  const d = Math.hypot(dx, dy);

  const hardStop = Math.max(stopDistance, unit.stopRadius);

  if (d <= hardStop) return;

  let speedFactor = 1;

  if (unit.slowdownRadius > 0) {
    speedFactor = clamp(
      (d - hardStop) / Math.max(1, unit.slowdownRadius - hardStop),
      0,
      1
    );
  }

  const speed = unit.speed * speedFactor;
  const step = Math.min(speed * dt, d - hardStop);

  unit.x += (dx / d) * step;
  unit.y += (dy / d) * step;

  clampToRoomPoint(unit, unit.radiusOuter);
}

function moveAwayFrom(unit, target, dt) {
  const dx = unit.x - target.x;
  const dy = unit.y - target.y;

  const d = Math.hypot(dx, dy);

  if (d <= unit.stopRadius) return;

  const speedFactor = clamp(
    (d - unit.stopRadius) / Math.max(1, unit.slowdownRadius - unit.stopRadius),
    0,
    1
  );

  const speed = unit.speed * speedFactor;

  unit.x += (dx / d) * speed * dt;
  unit.y += (dy / d) * speed * dt;

  clampToRoomPoint(unit, unit.radiusOuter);
}

function moveBotCombatCannon(bot, target, dt) {
  const ranges = getBotCombatRange(bot);
  const d = distance(bot, target);
  const deadZone = 34;

  if (d < ranges.min) {
    moveAwayFrom(bot, target, dt);
    return;
  }

  if (d > ranges.ideal + deadZone) {
    moveToward(bot, target, dt, ranges.ideal);
    return;
  }

  if (d < ranges.ideal - deadZone) {
    moveAwayFrom(bot, target, dt);
  }
}

function movePilotToward(unit, target, dt, stopDistance = 0) {
  if (unit.pilotKnockback || unit.pilotEject) return;

  const oldX = unit.pilotX;
  const oldY = unit.pilotY;

  const dx = target.x - unit.pilotX;
  const dy = target.y - unit.pilotY;

  const d = Math.hypot(dx, dy);

  if (d <= stopDistance) {
    unit.pilotLastMoveVx = 0;
    unit.pilotLastMoveVy = 0;
    return;
  }

  const step = Math.min(unit.pilotSpeed * dt, d - stopDistance);

  unit.pilotX += (dx / d) * step;
  unit.pilotY += (dy / d) * step;

  clampPilotToRoom(unit);

  unit.pilotLastMoveVx =
    (unit.pilotX - oldX) / Math.max(dt, 0.0001);
  unit.pilotLastMoveVy =
    (unit.pilotY - oldY) / Math.max(dt, 0.0001);
}

function startRepair(unit) {
  unit.hp = 0;
  unit.wreckHp = WRECK_HP;
  unit.cannonDestroyed = false;

  unit.wreckRepair = WRECK_REPAIR_TIME;

  unit.repairAngle = unit.turretAngle || unit.moveAngle || 0;
  unit.repairSpinDir = Math.random() < 0.5 ? -1 : 1;
}

function destroyCannon(unit) {
  if (unit.state !== "alive") return;

  unit.state = "pilot";

  startRepair(unit);

  unit.knockback = null;

  const moveSpeed =
    Math.hypot(unit.lastMoveVx || 0, unit.lastMoveVy || 0);

  const angle =
    moveSpeed > 8
      ? Math.atan2(unit.lastMoveVy, unit.lastMoveVx)
      : (unit.turretAngle || unit.moveAngle || 0);

  unit.pilotX = unit.x;
  unit.pilotY = unit.y;

  unit.pilotHp = 1;
  unit.pilotImmunity = PILOT_IMMUNITY_TIME;

  unit.pilotKnockback = null;

  unit.pilotRadius = PILOT_RADIUS;
  unit.pilotFlyState = "ground";
  unit.pilotFlyTime = 0;

  const ejectEnd =
    clampPointToRoom(
      unit.x + Math.cos(angle) * PILOT_EJECT_DISTANCE,
      unit.y + Math.sin(angle) * PILOT_EJECT_DISTANCE,
      PILOT_RADIUS
    );

  unit.pilotEject = {
    startX: unit.x,
    startY: unit.y,
    endX: ejectEnd.x,
    endY: ejectEnd.y,

    time: 0,
    duration: PILOT_EJECT_TIME
  };



  addExplosion(unit.x, unit.y);
}

function breakEmptyCannon(unit) {
  startRepair(unit);
  addExplosion(unit.x, unit.y);
}


function destroyCannonCompletely(unit, attacker) {
  if (unit.cannonDestroyed) return;

  unit.cannonDestroyed = true;
  unit.wreckRepair = 0;
  unit.wreckHp = 0;
  unit.hp = 0;
  unit.knockback = null;
  unit.postEjectBrake = null;

  addExplosion(unit.x, unit.y);

  if (attacker && attacker !== unit) {
    attacker.frags++;
    attacker.cannonBreaks++;
    addScore(attacker, getActiveModeRule("cannonBreakScore", 50), "cannon-break", getCombatTargetContext(unit, "cannon"));
    window.GUNS_MODE_REGISTRY?.onCannonBreak?.(activeModeState, {
      unit,
      attacker
    });
  }
}

function killPilot(victim, killer) {
  if (victim.pilotImmunity > 0) return;
  if (isPilotAirborne(victim)) return;

  addStain(
    victim.pilotX,
    victim.pilotY,
    victim.color,
    getUnitDisplayName(victim)
  );

  victim.pilotDeaths++;

  if (victim.isPlayer && !isServerCombatAuthoritative()) {
    window.GUNS_NET?.sendCombatEvent?.({
      value: 0,
      reason: "pilot-death",
      total: victim.score,
      ...getCombatTargetContext(victim, "pilot")
    });
  }

  if (killer && killer !== victim) {
    killer.frags++;
    killer.pilotKills++;
    addScore(killer, getActiveModeRule("pilotKillScore", 100), "pilot-kill", getCombatTargetContext(victim, "pilot"));
    window.GUNS_MODE_REGISTRY?.onPilotKill?.(activeModeState, {
      victim,
      killer
    });
  }

  window.GUNS_DEATH_FLOW.applyPilotDeathState({
    victim,
    pilotRadius: PILOT_RADIUS,
    pilotImmunityTime: PILOT_IMMUNITY_TIME,
    clampPilotToRoom
  });

  if (victim.isPlayer) {
    startPlayerDeathPrompt();
  }
}

function updatePilotWeaponCollisions() {
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i];
      const b = units[j];

      if (!canPilotWeaponContact(a, b)) continue;

      const dx = b.pilotX - a.pilotX;
      const dy = b.pilotY - a.pilotY;
      const d = Math.hypot(dx, dy) || 1;

      if (d > a.pilotRadius + b.pilotRadius) continue;

      applyPilotWeaponContact(a, b);
      applyPilotWeaponContact(b, a);

      if (!a.pilotKnockback) {
        startPilotKnockback(a, -dx / d, -dy / d);
      }

      if (!b.pilotKnockback) {
        startPilotKnockback(b, dx / d, dy / d);
      }
    }
  }

  updateNetworkPilotWeaponCollisions();
}

function updateNetworkPilotWeaponCollisions() {
  if (!window.GUNS_NET?.connected) return;
  if (player.state !== "pilot") return;
  if ((player.pilotWeaponCooldown || 0) > 0) return;
  if (player.pilotImmunity > 0) return;
  if (player.pilotEject) return;
  if (isPilotAirborne(player)) return;

  const weaponId = getOwnedPilotWeaponByType("knife");
  const weapon = getPilotWeaponDefinition(weaponId);

  if (weapon?.typeId !== "knife") return;

  const damage = getPilotWeaponNumber(weaponId, "gameplay.damage", 0);

  if (damage <= 0) return;

  const snapshots = window.GUNS_NET.getRemoteSnapshots?.() || [];

  for (const snapshot of snapshots) {
    if (!snapshot || snapshot.alive === false) continue;
    if (snapshot.state !== "on-foot") continue;
    if (snapshot.flying) continue;

    const targetId = snapshot.clientId || snapshot.id || "";
    const targetRadius = Number(snapshot.radiusInner) || PILOT_RADIUS;
    const d = Math.hypot(
      Number(snapshot.x) - player.pilotX,
      Number(snapshot.y) - player.pilotY
    );

    if (!targetId || d > player.pilotRadius + targetRadius) continue;

    player.pilotWeaponCooldown = PILOT_WEAPON_CONTACT_COOLDOWN;
    window.GUNS_NET.sendMeleeEvent?.({
      targetId,
      weapon: weaponId,
      damage
    });
    break;
  }
}

function canPilotWeaponContact(a, b) {
  return (
    a !== b &&
    !isUnitHidden(a) &&
    !isUnitHidden(b) &&
    !a.isCannonOnly &&
    !b.isCannonOnly &&
    a.state === "pilot" &&
    b.state === "pilot" &&
    !a.pilotEject &&
    !b.pilotEject &&
    !isPilotAirborne(a) &&
    !isPilotAirborne(b)
  );
}

function applyPilotWeaponContact(attacker, victim) {
  if ((attacker.pilotWeaponCooldown || 0) > 0) return;
  if (attacker.pilotImmunity > 0) return;
  if (victim.pilotImmunity > 0) return;

  const weaponId = attacker.isPlayer
    ? getOwnedPilotWeaponByType("knife")
    : attacker.activePilotWeaponId || "";
  const weapon = getPilotWeaponDefinition(weaponId);

  if (weapon?.typeId !== "knife") return;

  const damage = getPilotWeaponNumber(weaponId, "gameplay.damage", 0);

  if (damage <= 0) return;

  attacker.pilotWeaponCooldown = PILOT_WEAPON_CONTACT_COOLDOWN;
  victim.pilotHp = Math.max(0, Number(victim.pilotHp || 1) - damage);

  if (victim.pilotHp <= 0) {
    dropCarriedPowerups(victim);
    killPilot(victim, attacker);
  }
}

function startKnockbackUnit(unit, nx, ny) {
  unit.knockback = {
    startX: unit.x,
    startY: unit.y,

    endX: unit.x + nx * KNOCKBACK_DISTANCE,
    endY: unit.y + ny * KNOCKBACK_DISTANCE,

    time: 0
  };
}

function startPilotKnockback(unit, nx, ny) {
  if (unit.pilotEject) return;

  unit.pilotKnockback = {
    startX: unit.pilotX,
    startY: unit.pilotY,

    endX: unit.pilotX + nx * 90,
    endY: unit.pilotY + ny * 90,

    time: 0,
    duration: 0.35
  };
}

function startCannonKnockback(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  const d = Math.hypot(dx, dy) || 1;

  const nx = dx / d;
  const ny = dy / d;

  startKnockbackUnit(a, nx, ny);
  startKnockbackUnit(b, -nx, -ny);

  collisionLocks.add(pairKey(a, b));
}

function applyCannonCollisionDamage(unit) {
  if (unit.cannonDestroyed) return;
  if (unit.hp <= 0) return;

  unit.hp = Math.max(
    0,
    unit.hp - unit.maxHp * CANNON_COLLISION_DAMAGE_RATIO
  );

  if (unit.hp > 0) return;

  if (unit.state === "alive") {
    destroyCannon(unit);
    return;
  }

  if (unit.state === "pilot" && unit.wreckRepair <= 0) {
    breakEmptyCannon(unit);
    return;
  }

  if (unit.state === "pilot" && unit.wreckRepair > 0) {
    unit.wreckRepair =
      WRECK_REPAIR_TIME *
      (1 - clamp(unit.hp / unit.maxHp, 0, 1));
  }
}

function updateKnockback(unit, dt) {
  if (!unit.knockback) return false;

  unit.knockback.time += dt;

  const t = Math.min(1, unit.knockback.time / KNOCKBACK_TIME);
  const k = easeOutCubic(t);

  unit.x =
    unit.knockback.startX +
    (unit.knockback.endX - unit.knockback.startX) * k;

  unit.y =
    unit.knockback.startY +
    (unit.knockback.endY - unit.knockback.startY) * k;

  clampToRoomPoint(unit, unit.radiusOuter);

  if (t >= 1) {
    unit.knockback = null;
  }

  return true;
}

function updatePilotKnockback(unit, dt) {
  if (!unit.pilotKnockback) return false;

  const oldX = unit.pilotX;
  const oldY = unit.pilotY;

  unit.pilotKnockback.time += dt;

  const t = Math.min(
    1,
    unit.pilotKnockback.time / unit.pilotKnockback.duration
  );

  const k = easeOutCubic(t);

  unit.pilotX =
    unit.pilotKnockback.startX +
    (unit.pilotKnockback.endX - unit.pilotKnockback.startX) * k;

  unit.pilotY =
    unit.pilotKnockback.startY +
    (unit.pilotKnockback.endY - unit.pilotKnockback.startY) * k;

  clampPilotToRoom(unit);

  unit.pilotLastMoveVx =
    (unit.pilotX - oldX) / Math.max(dt, 0.0001);
  unit.pilotLastMoveVy =
    (unit.pilotY - oldY) / Math.max(dt, 0.0001);

  if (t >= 1) {
    unit.pilotKnockback = null;
  }

  return true;
}

function updatePilotEject(unit, dt) {
  if (!unit.pilotEject) return false;

  const oldX = unit.pilotX;
  const oldY = unit.pilotY;

  unit.pilotEject.time += dt;

  const t = Math.min(
    1,
    unit.pilotEject.time / unit.pilotEject.duration
  );

  const k = easeInOutSine(t);

  unit.pilotX =
    unit.pilotEject.startX +
    (unit.pilotEject.endX - unit.pilotEject.startX) * k;

  unit.pilotY =
    unit.pilotEject.startY +
    (unit.pilotEject.endY - unit.pilotEject.startY) * k;

  clampPilotToRoom(unit);

  const arc = Math.sin(Math.PI * t);

  unit.pilotRadius =
    PILOT_RADIUS +
    arc * (PILOT_EJECT_PEAK_RADIUS - PILOT_RADIUS);

  unit.pilotLastMoveVx =
    (unit.pilotX - oldX) / Math.max(dt, 0.0001);
  unit.pilotLastMoveVy =
    (unit.pilotY - oldY) / Math.max(dt, 0.0001);

  if (t >= 1) {
    unit.pilotEject = null;
    unit.pilotRadius = PILOT_RADIUS;
  }

  return true;
}

function updateHealthRegen(unit, dt) {
  if (unit.wreckRepair > 0) return;
  if (unit.hp <= 0) return;
  if (unit.hp >= unit.maxHp) return;

  unit.hp = Math.min(
    unit.maxHp,
    unit.hp + HP_REGEN_PER_SECOND * dt
  );
}

function updateRearSmoke(dt) {
  for (const unit of units) {
    if (unit.state === "alive") {
      unit.rearSmokeTimer -= dt;

      if (unit.rearSmokeTimer <= 0) {
        addRearSmoke(unit);
        unit.rearSmokeTimer = 0.12;
      }
    }
  }
}

function updateTurrets(dt) {
  if (player.state === "alive") {
    if (mouse.active) {
      const target = screenToWorld(mouse.x, mouse.y);
      player.turretAngle = angleToTarget(player, target);
    } else {
      player.turretAngle = player.moveAngle;
    }
  }

  for (const unit of units) {
    if (!unit.isPlayer && unit.state === "alive") {
      unit.aiTargetTimer -= dt;

      if (
        !unit.aiTarget ||
        unit.aiTargetTimer <= 0
      ) {
        chooseBotTarget(unit);
      }

      if (unit.aiTarget) {
        const target =
          getActivePoint(unit.aiTarget);

        unit.turretAngle =
          angleToTarget(unit, target);
      }
    }
  }
}

function updateWreckRepair(unit, dt) {
  if (unit.cannonDestroyed) return;
  if (unit.state !== "pilot") return;

  if (unit.wreckRepair > 0) {
    unit.hp = Math.min(
      unit.maxHp,
      unit.hp + (unit.maxHp / WRECK_REPAIR_TIME) * dt
    );

    unit.wreckRepair =
      WRECK_REPAIR_TIME *
      (1 - clamp(unit.hp / unit.maxHp, 0, 1));

    unit.smokeTimer -= dt;

    if (unit.smokeTimer <= 0) {
      addSmoke(unit.x, unit.y);
      unit.smokeTimer = 0.18;
    }

    if (unit.hp >= unit.maxHp) {
      unit.wreckRepair = 0;
      unit.hp = unit.maxHp;
      unit.turretAngle = unit.repairAngle;
      tryEnterNearbyRepairedCannonPilots(unit);
    }
  }
}

function tryEnterNearbyRepairedCannonPilots(cannonUnit) {
  for (const pilotUnit of units) {
    if (pilotUnit === cannonUnit) continue;
    if (pilotUnit.isCannonOnly) continue;

    tryEnterRepairedCannon(pilotUnit);
  }
}

function tryEnterRepairedCannon(unit) {
  if (unit.isCannonOnly) return;
  if (unit.state !== "pilot") return;
  if (unit.pilotEject) return;
  if (isPilotAirborne(unit)) return;

  let targetCannon = null;
  let bestD = Infinity;

  for (const cannon of units) {
    if (isUnitHidden(cannon)) continue;
    if (cannon.cannonDestroyed) continue;
    if (cannon.cannonDestroyed) continue;
    if (cannon.state !== "pilot") continue;
    if (isCannonOccupiedByRemote(cannon)) continue;
    if (cannon.wreckRepair > 0) continue;
    if (cannon.hp <= 0) continue;

    const d = Math.hypot(
      unit.pilotX - cannon.x,
      unit.pilotY - cannon.y
    );

    if (
      d <= cannon.radiusOuter + unit.pilotRadius + 6 &&
      d < bestD
    ) {
      targetCannon = cannon;
      bestD = d;
    }
  }

  if (!targetCannon) return;

  if (!canEnterCannon(unit, targetCannon)) {
    if (unit.isPlayer) {
      addHint(
        text("hint.cannonRequiresScore", {
          score: getEntryScoreRequired(targetCannon)
        })
      );
    }

    const dx = unit.pilotX - targetCannon.x;
    const dy = unit.pilotY - targetCannon.y;
    const d = Math.hypot(dx, dy);
    const fallbackAngle = Math.random() * Math.PI * 2;
    const nx = d > 0 ? dx / d : Math.cos(fallbackAngle);
    const ny = d > 0 ? dy / d : Math.sin(fallbackAngle);

    if (!unit.pilotKnockback) {
      startPilotKnockback(unit, nx, ny);
    }

    return;
  }

  const oldBody = {
    x: unit.x,
    y: unit.y,
    radiusOuter: unit.radiusOuter,
    radiusInner: unit.radiusInner,
    moveAngle: unit.moveAngle,
    turretAngle: unit.turretAngle,
    repairAngle: unit.repairAngle,
    repairSpinDir: unit.repairSpinDir,
    hp: unit.hp,
    maxHp: unit.maxHp,
    ammo: unit.ammo,
    gunType: unit.gunType,
    cannonEntityId: unit.cannonEntityId,
    entryScoreRequired: unit.entryScoreRequired,
    entryLocked: unit.entryLocked,
    damageMultiplier: unit.damageMultiplier,
    bulletDamage: unit.bulletDamage,
    wreckRepair: unit.wreckRepair,
    wreckHp: unit.wreckHp,
    cannonDestroyed: unit.cannonDestroyed
  };

  const newBody = {
    x: targetCannon.x,
    y: targetCannon.y,
    radiusOuter: targetCannon.radiusOuter,
    radiusInner: targetCannon.radiusInner,
    moveAngle: targetCannon.moveAngle,
    turretAngle: targetCannon.turretAngle,
    repairAngle: targetCannon.repairAngle,
    repairSpinDir: targetCannon.repairSpinDir,
    hp: targetCannon.hp,
    maxHp: targetCannon.maxHp,
    ammo: targetCannon.ammo,
    gunType: targetCannon.gunType,
    cannonEntityId: targetCannon.cannonEntityId,
    entryScoreRequired: targetCannon.entryScoreRequired,
    entryLocked: targetCannon.entryLocked,
    damageMultiplier: targetCannon.damageMultiplier,
    bulletDamage: targetCannon.bulletDamage,
    wreckRepair: targetCannon.wreckRepair,
    wreckHp: targetCannon.wreckHp,
    cannonDestroyed: targetCannon.cannonDestroyed
  };

  unit.x = newBody.x;
  unit.y = newBody.y;
  unit.radiusOuter = newBody.radiusOuter;
  unit.radiusInner = newBody.radiusInner;
  unit.moveAngle = newBody.moveAngle;
  unit.turretAngle = newBody.turretAngle;
  unit.repairAngle = newBody.repairAngle;
  unit.repairSpinDir = newBody.repairSpinDir;
  unit.hp = Math.max(1, newBody.hp);
  unit.maxHp = newBody.maxHp;
  unit.gunType = newBody.gunType;
  unit.entryScoreRequired = newBody.entryScoreRequired;
  unit.entryLocked = newBody.entryLocked;
  unit.damageMultiplier = newBody.damageMultiplier;
  unit.bulletDamage = newBody.bulletDamage;
  unit.ammo = Math.min(getMaxAmmo(unit), Math.max(newBody.ammo, 10));
  unit.cannonEntityId = newBody.cannonEntityId;
  unit.wreckRepair = 0;
  unit.wreckHp = 0;
  unit.cannonDestroyed = false;

  unit.state = "alive";
  unit.knockback = null;
  unit.pilotKnockback = null;
  unit.pilotEject = null;
  unit.pilotImmunity = 0;
  unit.pilotRadius = PILOT_RADIUS;
  unit.pilotFlyState = "ground";
  unit.pilotFlyTime = 0;

  if (unit.carriedAmmoValue > 0) {
    if (unit.ammo < getMaxAmmo(unit)) {
      unit.ammo = Math.min(
        getMaxAmmo(unit),
        unit.ammo + unit.carriedAmmoValue
      );

      addScore(unit, getActiveModeRule("ammoLoadScore", 40), "ammo-load");
    }

    unit.carriedAmmoValue = 0;
  }

  if (targetCannon !== unit) {
    targetCannon.x = oldBody.x;
    targetCannon.y = oldBody.y;
    targetCannon.radiusOuter = oldBody.radiusOuter;
    targetCannon.radiusInner = oldBody.radiusInner;
    targetCannon.moveAngle = oldBody.moveAngle;
    targetCannon.turretAngle = oldBody.turretAngle;
    targetCannon.repairAngle = oldBody.repairAngle;
    targetCannon.repairSpinDir = oldBody.repairSpinDir;
    targetCannon.hp = Math.max(1, oldBody.hp);
    targetCannon.maxHp = oldBody.maxHp;
    targetCannon.ammo = oldBody.ammo;
    targetCannon.gunType = oldBody.gunType;
    targetCannon.cannonEntityId = oldBody.cannonEntityId;
    targetCannon.entryScoreRequired = oldBody.entryScoreRequired;
    targetCannon.entryLocked = oldBody.entryLocked;
    targetCannon.damageMultiplier = oldBody.damageMultiplier;
    targetCannon.bulletDamage = oldBody.bulletDamage;
    targetCannon.wreckRepair = oldBody.wreckRepair;
    targetCannon.wreckHp = oldBody.wreckHp;
    targetCannon.cannonDestroyed = oldBody.cannonDestroyed;
    targetCannon.state = "pilot";
    targetCannon.knockback = null;
  }

  if (!unit.isPlayer) {
    unit.aiTimer = 0;
    unit.aiTargetTimer = 0;
    unit.aiBurstShots = 0;
    unit.aiBurstPause = randomRange(0.4, 1.0);
  }
}

function applyCarriedRepairToCannon(pilotUnit, cannonUnit) {
  if (pilotUnit.carriedRepairValue <= 0) return false;
  if (cannonUnit.hp >= cannonUnit.maxHp) return false;

  cannonUnit.hp = Math.min(
    cannonUnit.maxHp,
    cannonUnit.hp + cannonUnit.maxHp * pilotUnit.carriedRepairValue
  );

  if (cannonUnit.wreckRepair > 0) {
    cannonUnit.wreckRepair =
      cannonUnit.hp >= cannonUnit.maxHp
        ? 0
        : WRECK_REPAIR_TIME *
          (1 - clamp(cannonUnit.hp / cannonUnit.maxHp, 0, 1));
  }

  pilotUnit.carriedRepairValue = 0;

  return true;
}

function applyCarriedPowerupToCannon(pilotUnit, cannonUnit) {
  return window.GUNS_POWERUPS.applyCarriedPowerupToCannon(
    getPowerupOptions(),
    pilotUnit,
    cannonUnit
  );
}

function updateAmmoPickup() {
  window.GUNS_POWERUPS.updatePowerupPickup(getPowerupOptions());
}

function updateAmmoPacks(dt) {
  window.GUNS_POWERUPS.updatePowerupTimers(getPowerupOptions(), dt);
}

function updateAmmoSpawning(dt) {
  ammoSpawnTimer = window.GUNS_POWERUPS.updatePowerupSpawning(
    getPowerupOptions(),
    dt
  );
}

function updateCannonCollisions() {
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i];
      const b = units[j];

      if (isUnitHidden(a) || isUnitHidden(b)) continue;
      if (a.cannonDestroyed || b.cannonDestroyed) continue;

      const key = pairKey(a, b);

      const d = distance(a, b);

      const minDistance =
        a.radiusOuter + b.radiusOuter;

      if (
        d <= minDistance &&
        !collisionLocks.has(key) &&
        !a.knockback &&
        !b.knockback
      ) {
        applyCannonCollisionDamage(a);
        applyCannonCollisionDamage(b);
        startCannonKnockback(a, b);
      }

      if (
        d > minDistance + 20 &&
        !a.knockback &&
        !b.knockback
      ) {
        collisionLocks.delete(key);
      }
    }
  }
}

function updatePilotWreckOrEnemyContact(pilotUnit, otherUnit) {
  if (isUnitHidden(pilotUnit) || isUnitHidden(otherUnit)) return;
  if (pilotUnit.isCannonOnly) return;
  if (pilotUnit.state !== "pilot") return;
  if (pilotUnit.pilotEject) return;
  if (isPilotAirborne(pilotUnit)) return;
  if (otherUnit.cannonDestroyed) return;

  const d = Math.hypot(
    pilotUnit.pilotX - otherUnit.x,
    pilotUnit.pilotY - otherUnit.y
  );

  const minD =
    pilotUnit.pilotRadius + otherUnit.radiusOuter;

  if (d > minD) return;

  const nx =
    (pilotUnit.pilotX - otherUnit.x) /
    (d || 1);

  const ny =
    (pilotUnit.pilotY - otherUnit.y) /
    (d || 1);

  // Free repaired cannon -> enter if allowed.
  const isFreeRepairedCannon =
    otherUnit.state === "pilot" &&
    otherUnit.wreckRepair <= 0 &&
    otherUnit.hp > 0;

  if (isFreeRepairedCannon) {
    if (
      pilotUnit.carriedRepairValue > 0 &&
      otherUnit.hp < otherUnit.maxHp
    ) {
      applyCarriedRepairToCannon(pilotUnit, otherUnit);

      if (otherUnit.hp < otherUnit.maxHp) {
        if (!pilotUnit.pilotKnockback) {
          startPilotKnockback(pilotUnit, nx, ny);
        }

        return;
      }
    }

    tryEnterRepairedCannon(pilotUnit);
    return;
  }

  // Broken cannon -> always bounce, never kill.
  if (
    otherUnit.state === "pilot" &&
    otherUnit.wreckRepair > 0
  ) {
    if (pilotUnit.carriedRepairValue > 0) {
      applyCarriedRepairToCannon(pilotUnit, otherUnit);

      if (
        otherUnit.wreckRepair <= 0 &&
        otherUnit.hp >= otherUnit.maxHp
      ) {
        otherUnit.hp = otherUnit.maxHp;
        otherUnit.turretAngle = otherUnit.repairAngle;
        tryEnterRepairedCannon(pilotUnit);
        return;
      }
    }

    if (!pilotUnit.pilotKnockback) {
      startPilotKnockback(pilotUnit, nx, ny);
    }

    return;
  }

  // Any other empty cannon state -> bounce only.
  if (otherUnit.state === "pilot") {
    if (!pilotUnit.pilotKnockback) {
      startPilotKnockback(pilotUnit, nx, ny);
    }

    return;
  }
}

function isCannonMovingTowardPilot(cannonUnit, pilotUnit) {
  const vx = cannonUnit.lastMoveVx || 0;
  const vy = cannonUnit.lastMoveVy || 0;
  const speed = Math.hypot(vx, vy);

  if (speed < CANNON_RUNOVER_MIN_SPEED) {
    return false;
  }

  const dx = pilotUnit.pilotX - cannonUnit.x;
  const dy = pilotUnit.pilotY - cannonUnit.y;
  const d = Math.hypot(dx, dy) || 1;

  const dot =
    (vx / speed) * (dx / d) +
    (vy / speed) * (dy / d);

  return dot >= CANNON_RUNOVER_DOT;
}

function updatePilotRunover(cannonUnit, pilotUnit) {
  if (isUnitHidden(cannonUnit) || isUnitHidden(pilotUnit)) return;
  if (cannonUnit.cannonDestroyed) return;
  if (cannonUnit.isCannonOnly) return;
  if (pilotUnit.isCannonOnly) return;
  if (isPilotAirborne(pilotUnit)) return;

  // Only occupied/active cannon can kill by contact.
  if (cannonUnit.state !== "alive") return;
  if (pilotUnit.state !== "pilot") return;
  if (pilotUnit.pilotEject) return;

  const d = Math.hypot(
    cannonUnit.x - pilotUnit.pilotX,
    cannonUnit.y - pilotUnit.pilotY
  );

  if (
    d <=
    cannonUnit.radiusOuter +
      pilotUnit.pilotRadius
  ) {
    const nx =
      (pilotUnit.pilotX - cannonUnit.x) /
      (d || 1);

    const ny =
      (pilotUnit.pilotY - cannonUnit.y) /
      (d || 1);

    if (
      pilotUnit.pilotImmunity > 0 ||
      !isCannonMovingTowardPilot(cannonUnit, pilotUnit)
    ) {
      if (!pilotUnit.pilotKnockback) {
        startPilotKnockback(pilotUnit, nx, ny);
      }

      return;
    }

    applyCarriedPowerupToCannon(pilotUnit, cannonUnit);
    killPilot(pilotUnit, cannonUnit);
  }
}

function updateBullets(dt) {
  for (let i = roomRuntimeState.bullets.length - 1; i >= 0; i--) {
    const bullet = roomRuntimeState.bullets[i];

    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    bullet.life -= dt;

    let removed = false;

    if (isOutsideRoom(bullet.x, bullet.y, bullet.radius)) {
      removeBulletAt(i);
      continue;
    }

    for (const target of units) {
      if (target === bullet.owner) continue;
      if (isUnitHidden(target)) continue;

      if (target.state === "alive") {
        const d = Math.hypot(
          bullet.x - target.x,
          bullet.y - target.y
        );

        if (
          d <= target.radiusOuter + bullet.radius
        ) {
          target.hp = Math.max(0, target.hp - bullet.damage);
          addScore(bullet.owner, getActiveModeRule("bulletHitScore", 30), "bullet-hit", getCombatTargetContext(target, "cannon"));

          removeBulletAt(i);

          removed = true;

          if (target.hp <= 0) {
            destroyCannon(target);
            bullet.owner.cannonBreaks++;
            addScore(bullet.owner, getActiveModeRule("cannonBreakScore", 50), "cannon-break", getCombatTargetContext(target, "cannon"));
            window.GUNS_MODE_REGISTRY?.onCannonBreak?.(activeModeState, {
              unit: target,
              attacker: bullet.owner
            });
          }

          break;
        }
      }

      if (target.state === "pilot") {
        if (isPilotAirborne(target)) {
          continue;
        }

        const pilotD = Math.hypot(
          bullet.x - target.pilotX,
          bullet.y - target.pilotY
        );

        if (
          !target.isCannonOnly &&
          pilotD <=
          target.pilotRadius + bullet.radius
        ) {
          addScore(bullet.owner, getActiveModeRule("bulletHitScore", 30), "bullet-hit", getCombatTargetContext(target, "pilot"));

          if (
            !target.pilotEject &&
            target.pilotImmunity <= 0
          ) {
            dropCarriedPowerups(target);
            killPilot(target, bullet.owner);
          }

          removeBulletAt(i);

          removed = true;
          break;
        }

        if (!target.cannonDestroyed) {
          const cannonD = Math.hypot(
            bullet.x - target.x,
            bullet.y - target.y
          );

          if (
            cannonD <=
            target.radiusOuter + bullet.radius
          ) {
            if (target.wreckRepair > 0) {
              target.hp = Math.max(
                0,
                target.hp - bullet.damage
              );
              addScore(bullet.owner, getActiveModeRule("bulletHitScore", 30), "bullet-hit", getCombatTargetContext(target, "broken-cannon"));

              target.wreckRepair =
                WRECK_REPAIR_TIME *
                (1 - clamp(target.hp / target.maxHp, 0, 1));

              removeBulletAt(i);

              removed = true;

              break;
            }

            if (target.wreckRepair <= 0) {
              target.hp = Math.max(0, target.hp - bullet.damage);
              addScore(bullet.owner, getActiveModeRule("bulletHitScore", 30), "bullet-hit", getCombatTargetContext(target, "free-cannon"));

              removeBulletAt(i);

              removed = true;

              if (target.hp <= 0) {
                breakEmptyCannon(target);
                bullet.owner.cannonBreaks++;
                addScore(bullet.owner, getActiveModeRule("cannonBreakScore", 50), "cannon-break", getCombatTargetContext(target, "free-cannon"));
                window.GUNS_MODE_REGISTRY?.onCannonBreak?.(activeModeState, {
                  unit: target,
                  attacker: bullet.owner
                });
              }

              break;
            }
          }
        }
      }
    }

    if (removed) continue;

    if (bullet.life <= 0) {
      removeBulletAt(i);
    }
  }
}

function removeBulletAt(index) {
  const lastIndex = roomRuntimeState.bullets.length - 1;

  if (index !== lastIndex) {
    roomRuntimeState.bullets[index] = roomRuntimeState.bullets[lastIndex];
  }

  roomRuntimeState.bullets.pop();
}

function getBotCombatRange(bot) {
  return { ideal: 560, min: 280, max: 980 };
}

function getInterceptPoint(shooter, targetUnit, bulletSpeed) {
  const target = getActivePoint(targetUnit);
  const velocity = getActiveVelocity(targetUnit);

  const rx = target.x - shooter.x;
  const ry = target.y - shooter.y;
  const vx = velocity.x;
  const vy = velocity.y;

  const a = vx * vx + vy * vy - bulletSpeed * bulletSpeed;
  const b = 2 * (rx * vx + ry * vy);
  const c = rx * rx + ry * ry;

  let t = 0;

  if (Math.abs(a) < 0.0001) {
    t = Math.abs(b) > 0.0001 ? -c / b : 0;
  } else {
    const disc = b * b - 4 * a * c;

    if (disc >= 0) {
      const root = Math.sqrt(disc);
      const t1 = (-b - root) / (2 * a);
      const t2 = (-b + root) / (2 * a);

      if (t1 > 0 && t2 > 0) {
        t = Math.min(t1, t2);
      } else if (t1 > 0) {
        t = t1;
      } else if (t2 > 0) {
        t = t2;
      }
    }
  }

  t = clamp(t, 0, 1.55);

  return {
    x: target.x + velocity.x * t,
    y: target.y + velocity.y * t,
    time: t
  };
}

function getBotAimSolution(bot, targetUnit) {
  const target = getActivePoint(targetUnit);
  const intercept = getInterceptPoint(
    bot,
    targetUnit,
    BULLET_SPEED
  );

  const d = distance(bot, target);
  const velocity = getActiveVelocity(targetUnit);
  const targetSpeed = Math.hypot(velocity.x, velocity.y);
  const ranges = getBotCombatRange(bot);

  let confidence = 1;

  confidence -= clamp((d - ranges.ideal) / 1050, 0, 0.36);
  confidence -= clamp((targetSpeed - 100) / 820, 0, 0.22);

  if (targetUnit.state === "pilot") {
    confidence += 0.13;
  }

  if (targetUnit.pilotImmunity > 0 || targetUnit.pilotEject) {
    confidence -= 0.36;
  }

  return {
    angle: angleToTarget(bot, intercept),
    distance: d,
    confidence: clamp(confidence, 0, 1)
  };
}

function botCanHopeToHit(bot, solution) {
  if (bot.state !== "alive") return false;
  if (bot.ammo <= 0) return false;
  if (!solution) return false;

  return (
    solution.distance <= BOT_MAX_SHOOT_DISTANCE &&
    solution.confidence >= BOT_MIN_SHOT_CONFIDENCE
  );
}

function updateBotShooting(bot, dt) {
  bot.fireCooldown -= dt;
  bot.aiBurstPause = Math.max(0, bot.aiBurstPause - dt);

  const lowAmmo =
    bot.ammo <= BOT_AMMO_SEEK_THRESHOLD;

  if (lowAmmo && roomRuntimeState.ammoPacks.length > 0) {
    bot.aiMode = "ammo";
    return;
  }

  if (
    !bot.aiTarget ||
    bot.aiTargetTimer <= 0 ||
    bot.aiTarget === bot
  ) {
    chooseBotTarget(bot);
  }

  if (!bot.aiTarget) return;

  const solution =
    getBotAimSolution(bot, bot.aiTarget);

  bot.turretAngle =
    rotateTowardAngle(
      bot.turretAngle,
      solution.angle,
      BOT_TURRET_TURN_SPEED * dt
    );

  const aimError =
    Math.abs(angleDelta(bot.turretAngle, solution.angle));

  const maxAimError = 0.12;

  if (
    bot.ammo > 0 &&
    bot.fireCooldown <= 0 &&
    bot.aiBurstPause <= 0 &&
    aimError <= maxAimError &&
    botCanHopeToHit(bot, solution)
  ) {
    if (bot.aiBurstShots <= 0) {
      bot.aiBurstShots = Math.floor(randomRange(1, 4));
    }

    const spread =
      randomRange(-0.02, 0.02) +
      randomRange(-0.095, 0.095) *
        (1 - solution.confidence);

    fireBullet(
      bot,
      bot.turretAngle + spread
    );

    bot.fireCooldown = randomRange(0.12, 0.22);

    bot.aiBurstShots--;

    if (bot.aiBurstShots <= 0) {
      bot.aiBurstPause = randomRange(0.48, 1.05);
    }
  }
}

function getNearestFreeCannonForPilot(unit) {
  let best = null;
  let bestScore = Infinity;

  for (const cannon of units) {
    if (isUnitHidden(cannon)) continue;
    if (cannon.cannonDestroyed) continue;
    if (cannon.state !== "pilot") continue;
    if (isCannonOccupiedByRemote(cannon)) continue;
    if (cannon.wreckRepair > 0) continue;
    if (cannon.hp <= 0) continue;
    if (!canEnterCannon(unit, cannon)) continue;

    const d = Math.hypot(
      unit.pilotX - cannon.x,
      unit.pilotY - cannon.y
    );

    let score = d;

    if (score < bestScore) {
      best = cannon;
      bestScore = score;
    }
  }

  return best;
}

function moveBotPilotTowardSafely(bot, target, dt, stopDistance = 0) {
  const dx = target.x - bot.pilotX;
  const dy = target.y - bot.pilotY;
  const targetDistance = Math.hypot(dx, dy);

  if (targetDistance <= stopDistance) {
    bot.pilotLastMoveVx = 0;
    bot.pilotLastMoveVy = 0;
    return;
  }

  const oldX = bot.pilotX;
  const oldY = bot.pilotY;

  let vx = dx / (targetDistance || 1);
  let vy = dy / (targetDistance || 1);

  forEachEnemy(bot, enemy => {
    if (enemy.state !== "alive") return;
    if (enemy.cannonDestroyed) return;

    const awayX = bot.pilotX - enemy.x;
    const awayY = bot.pilotY - enemy.y;
    const d = Math.hypot(awayX, awayY) || 1;
    const dangerRadius = 300;

    if (d < dangerRadius) {
      const danger =
        (dangerRadius - d) / dangerRadius;
      const panic =
        d < enemy.radiusOuter + bot.pilotRadius + 70
          ? 3.3
          : 2.0;

      vx += (awayX / d) * danger * panic;
      vy += (awayY / d) * danger * panic;
    }
  });

  const len = Math.hypot(vx, vy);

  if (len <= 0.001) return;

  const step =
    Math.min(bot.pilotSpeed * dt, targetDistance - stopDistance);

  bot.pilotX += (vx / len) * step;
  bot.pilotY += (vy / len) * step;

  clampPilotToRoom(bot);

  bot.pilotLastMoveVx =
    (bot.pilotX - oldX) / Math.max(dt, 0.0001);
  bot.pilotLastMoveVy =
    (bot.pilotY - oldY) / Math.max(dt, 0.0001);
}

function updateBotPilotMovement(bot, dt) {
  if (bot.pilotKnockback || bot.pilotEject) return;

  const oldX = bot.pilotX;
  const oldY = bot.pilotY;

  const freeCannon = getNearestFreeCannonForPilot(bot);

  if (freeCannon) {
    moveBotPilotTowardSafely(
      bot,
      { x: freeCannon.x, y: freeCannon.y },
      dt
    );

    return;
  }

  const enemy = getNearestEnemy(bot);
  const enemyPoint = getActivePoint(enemy);

  const toEnemyX =
    bot.pilotX - enemyPoint.x;

  const toEnemyY =
    bot.pilotY - enemyPoint.y;

  const enemyDistance =
    Math.hypot(toEnemyX, toEnemyY) || 1;

  const toWreckX = bot.x - bot.pilotX;
  const toWreckY = bot.y - bot.pilotY;

  const wreckDistance =
    Math.hypot(toWreckX, toWreckY) || 1;

  let vx = 0;
  let vy = 0;

  vx += (toEnemyX / enemyDistance) * 1.8;
  vy += (toEnemyY / enemyDistance) * 1.8;

  if (wreckDistance > 180) {
    vx += (toWreckX / wreckDistance) * 1.4;
    vy += (toWreckY / wreckDistance) * 1.4;
  }

  if (wreckDistance < 70) {
    vx -= (toWreckX / wreckDistance) * 1.1;
    vy -= (toWreckY / wreckDistance) * 1.1;
  }

  const len = Math.hypot(vx, vy);

  if (len > 0.001) {
    bot.pilotX +=
      (vx / len) * bot.pilotSpeed * dt;

    bot.pilotY +=
      (vy / len) * bot.pilotSpeed * dt;
  } else {
    const a = performance.now() * 0.001 + bot.id.length;
    bot.pilotX += Math.cos(a) * bot.pilotSpeed * 0.35 * dt;
    bot.pilotY += Math.sin(a) * bot.pilotSpeed * 0.35 * dt;
  }

  clampPilotToRoom(bot);

  bot.pilotLastMoveVx =
    (bot.pilotX - oldX) / Math.max(dt, 0.0001);
  bot.pilotLastMoveVy =
    (bot.pilotY - oldY) / Math.max(dt, 0.0001);
}

function startPlayerExitEject() {
  if (player.state !== "alive") return;

  const target = mouse.active
    ? screenToWorld(mouse.x, mouse.y)
    : { x: player.x + Math.cos(player.moveAngle), y: player.y + Math.sin(player.moveAngle) };

  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const d = Math.hypot(dx, dy) || 1;

  const speedFactor = player.slowdownRadius > 0
    ? clamp(
        (d - player.stopRadius) /
          Math.max(1, player.slowdownRadius - player.stopRadius),
        0,
        1
      )
    : 1;

  let driftAngle = player.moveAngle || player.turretAngle || 0;
  let driftSpeed = player.speed * speedFactor;

  if (keys.space) {
    driftAngle = Math.atan2(player.y - target.y, player.x - target.x);
  } else if (mouse.active && d > player.stopRadius) {
    driftAngle = Math.atan2(dy, dx);
  }

  player.postEjectBrake = {
    angle: driftAngle,
    speed: driftSpeed
  };

  finishPlayerExitEject();
}

function finishPlayerExitEject() {
  if (player.state !== "alive") return;

  const moveSpeed =
    Math.hypot(player.lastMoveVx || 0, player.lastMoveVy || 0);

  const angle =
    moveSpeed > 8
      ? Math.atan2(player.lastMoveVy, player.lastMoveVx)
      : (player.turretAngle || player.moveAngle || 0);

  player.state = "pilot";

  player.exitRequested = false;
  player.exitStopTimer = 0;

  player.knockback = null;

  player.pilotX = player.x;
  player.pilotY = player.y;

  player.pilotHp = 1;
  player.pilotImmunity = 0;

  player.pilotKnockback = null;

  player.pilotRadius = PILOT_RADIUS;
  player.pilotFlyState = "ground";
  player.pilotFlyTime = 0;

  const ejectEnd =
    clampPointToRoom(
      player.x +
        Math.cos(angle + Math.PI) *
          PILOT_EJECT_DISTANCE,
      player.y +
        Math.sin(angle + Math.PI) *
          PILOT_EJECT_DISTANCE,
      PILOT_RADIUS
    );

  player.pilotEject = {
    startX: player.x,
    startY: player.y,
    endX: ejectEnd.x,
    endY: ejectEnd.y,

    time: 0,
    duration: PILOT_EJECT_TIME
  };

  tryEnterNearbyRepairedCannonPilots(player);
}

function updatePostEjectBrake(unit, dt) {
  if (!unit.postEjectBrake) return;

  const b = unit.postEjectBrake;

  if (b.speed <= 0) {
    unit.postEjectBrake = null;
    return;
  }

  const vx = Math.cos(b.angle) * b.speed;
  const vy = Math.sin(b.angle) * b.speed;

  unit.x += vx * dt;
  unit.y += vy * dt;

  clampToRoomPoint(unit, unit.radiusOuter);

  unit.lastMoveVx = vx;
  unit.lastMoveVy = vy;

  b.speed = Math.max(
    0,
    b.speed - unit.speed * 3.2 * dt
  );

  if (b.speed <= 0) {
    unit.postEjectBrake = null;
  }
}

function updatePlayer(dt) {
  const controlsLocked = isPilotDialogOpen();

  if (playerDeathPrompt.active) {
    player.pilotImmunity = Math.max(
      player.pilotImmunity,
      PILOT_IMMUNITY_TIME
    );
  }

  if (player.pilotImmunity > 0) {
    player.pilotImmunity = Math.max(
      0,
      player.pilotImmunity - dt
    );
  }

  if (player.state === "alive") {
    if (!controlsLocked && keys.z) {
      keys.z = false;
      startPlayerExitEject();
      return;
    }

    const inKnockback =
      updateKnockback(player, dt);

    if (!controlsLocked && !inKnockback && mouse.active && canUseCursorFollow()) {
      const target =
        screenToWorld(mouse.x, mouse.y);

      if (canMoveTowardMouse(player, target, player.radiusOuter)) {
        const oldX = player.x;
        const oldY = player.y;

        if (keys.space) {
          moveAwayFrom(player, target, dt);
        } else {
          moveToward(player, target, dt, 0);
        }

        const dx = player.x - oldX;
        const dy = player.y - oldY;

        player.lastMoveVx = dx / Math.max(dt, 0.0001);
        player.lastMoveVy = dy / Math.max(dt, 0.0001);

        if (Math.hypot(dx, dy) > 0.01) {
          player.moveAngle =
            Math.atan2(dy, dx);
        }
      } else {
        player.lastMoveVx *= Math.max(0, 1 - dt * 8);
        player.lastMoveVy *= Math.max(0, 1 - dt * 8);
      }
    }

    if (!isFixedCameraRoom()) {
      camera.x = player.x;
      camera.y = player.y;
    }

    camera.scale +=
      (getCameraBaseScale() - camera.scale) *
      Math.min(1, dt * 8);

    clampCamera();

    return;
  }

  updateKnockback(player, dt);

  const ejecting =
    updatePilotEject(player, dt);

  if (player.state === "pilot") {
    updatePilotFly(player, dt);
  }

  if (player.pilotEject) {
    const t = Math.min(
      1,
      player.pilotEject.time / player.pilotEject.duration
    );

    const arc = Math.sin(Math.PI * t);

    camera.scale =
      getCameraBaseScale() * (1 - arc * 0.18);
  } else {
    const flyAmount =
      player.state === "pilot"
        ? getPilotFlyAmount(player)
        : 0;

    const targetScale =
      getCameraBaseScale() * (1 - flyAmount * 0.18);

    camera.scale +=
      (targetScale - camera.scale) *
      Math.min(1, dt * 8);
  }

  if (player.state === "pilot") {
    const pilotKnock =
      isPilotAirborne(player)
        ? false
        : updatePilotKnockback(player, dt);

    if (
      !controlsLocked &&
      !ejecting &&
      !pilotKnock &&
      mouse.active &&
      canUseCursorFollow()
    ) {
      const target =
        screenToWorld(mouse.x, mouse.y);

      if (canMoveTowardMouse(player, target, player.pilotRadius)) {
        movePilotToward(
          player,
          target,
          dt,
          PILOT_STOP_RADIUS
        );
      }
    }

    if (!isFixedCameraRoom()) {
      camera.x = player.pilotX;
      camera.y = player.pilotY;
    }

    clampCamera();
  }
}

function updateBot(bot, dt) {
  if (bot.pilotImmunity > 0) {
    bot.pilotImmunity = Math.max(
      0,
      bot.pilotImmunity - dt
    );
  }

  if (bot.state === "alive") {
    const inKnockback =
      updateKnockback(bot, dt);

    if (!inKnockback) {
      bot.aiTimer -= dt;
      bot.aiTargetTimer -= dt;

      if (
        bot.aiTargetTimer <= 0 ||
        !bot.aiTarget
      ) {
        chooseBotTarget(bot);
      }

      if (bot.aiTimer <= 0) {
        chooseBotMode(bot);
      }

      const lowAmmo =
        bot.ammo <= BOT_AMMO_SEEK_THRESHOLD;

      if (lowAmmo && roomRuntimeState.ammoPacks.length > 0) {
        bot.aiMode = "ammo";
      }

      let target;

      if (bot.aiMode === "ammo") {
        target =
          getNearestAmmo(bot) ||
          getActivePoint(
            bot.aiTarget ||
              getNearestEnemy(bot)
          );
      } else {
        target = getActivePoint(
          bot.aiTarget ||
            getNearestEnemy(bot)
        );
      }

      const oldX = bot.x;
      const oldY = bot.y;

      if (bot.aiMode === "ammo") {
        moveToward(
          bot,
          target,
          dt,
          35
        );
      } else {
        moveBotCombatCannon(
          bot,
          target,
          dt
        );
      }

      const dx = bot.x - oldX;
      const dy = bot.y - oldY;

      bot.lastMoveVx = dx / Math.max(dt, 0.0001);
      bot.lastMoveVy = dy / Math.max(dt, 0.0001);

      if (Math.hypot(dx, dy) > 0.01) {
        bot.moveAngle =
          Math.atan2(dy, dx);
      }
    }

    updateBotShooting(bot, dt);

    return;
  }

  updateKnockback(bot, dt);

  const ejecting =
    updatePilotEject(bot, dt);

  if (bot.state === "pilot") {
    const pilotKnock =
      updatePilotKnockback(bot, dt);

    if (!ejecting && !pilotKnock) {
      updateBotPilotMovement(bot, dt);
    }
  }
}

function updatePlayerShooting(dt) {
  if (player.exitRequested) return;

  if (player.state === "pilot") {
    updatePlayerPilotShooting();
    return;
  }

  if (player.state !== "alive") return;

  player.fireCooldown -= dt;

  if (
    mouse.down &&
    mouse.active &&
    player.fireCooldown <= 0
  ) {
    const bullets = fireBullet(
      player,
      player.turretAngle
    );

    sendNetworkShootEvent("gun", bullets);

    player.fireCooldown =
      player.fireRate;
  }
}

function updatePlayerPilotShooting() {
  if (isUserBaseRoom()) return;
  if (isPilotDialogOpen()) return;
  if (!mouse.down || !mouse.active || player.pilotFireCooldown > 0) return;

  const weaponId = getOwnedPilotWeaponByType("pistol");

  if (!weaponId) return;

  const target = screenToWorld(mouse.x, mouse.y);
  const angle = Math.atan2(
    target.y - player.pilotY,
    target.x - player.pilotX
  );

  const bullet = firePilotPistol(player, weaponId, angle);

  if (bullet) {
    sendNetworkShootEvent(weaponId, bullet);
    player.pilotFireCooldown = getPilotWeaponNumber(
      weaponId,
      "gameplay.fireRate",
      0
    );
  }
}

function updateEffects(dt) {
  for (let i = roomRuntimeState.explosions.length - 1; i >= 0; i--) {
    roomRuntimeState.explosions[i].time += dt;

    if (
      roomRuntimeState.explosions[i].time >=
      roomRuntimeState.explosions[i].life
    ) {
      roomRuntimeState.explosions.splice(i, 1);
    }
  }

  for (let i = roomRuntimeState.smokePuffs.length - 1; i >= 0; i--) {
    roomRuntimeState.smokePuffs[i].time += dt;

    if (
      roomRuntimeState.smokePuffs[i].time >=
      roomRuntimeState.smokePuffs[i].life
    ) {
      roomRuntimeState.smokePuffs.splice(i, 1);
    }
  }

  for (let i = roomRuntimeState.rearSmokePuffs.length - 1; i >= 0; i--) {
    const s = roomRuntimeState.rearSmokePuffs[i];

    s.time += dt;

    s.x += s.vx * dt;
    s.y += s.vy * dt;

    if (s.time >= s.life) {
      roomRuntimeState.rearSmokePuffs.splice(i, 1);
    }
  }

  for (let i = roomRuntimeState.trails.length - 1; i >= 0; i--) {
    roomRuntimeState.trails[i].time += dt;

    if (roomRuntimeState.trails[i].time >= roomRuntimeState.trails[i].life) {
      roomRuntimeState.trails.splice(i, 1);
    }
  }

  for (let i = roomRuntimeState.stains.length - 1; i >= 0; i--) {
    const grave = roomRuntimeState.stains[i];

    grave.time += dt;
    grave.nameTime = Math.max(
      0,
      (grave.nameTime || 0) - dt
    );

    if (
      player.state === "pilot" &&
      !isPilotAirborne(player) &&
      Math.hypot(
        player.pilotX - grave.x,
        player.pilotY - grave.y
      ) <= GRAVE_NAME_TRIGGER_RADIUS + player.pilotRadius
    ) {
      grave.nameTime = GRAVE_NAME_SHOW_TIME;
    }

    if (grave.time >= grave.life) {
      roomRuntimeState.stains.splice(i, 1);
    }
  }

  for (let i = roomRuntimeState.deathOverlays.length - 1; i >= 0; i--) {
    roomRuntimeState.deathOverlays[i].time += dt;

    if (roomRuntimeState.deathOverlays[i].time >= roomRuntimeState.deathOverlays[i].life) {
      roomRuntimeState.deathOverlays.splice(i, 1);
    }
  }

  for (let i = hintMessages.length - 1; i >= 0; i--) {
    hintMessages[i].time += dt;

    if (hintMessages[i].time >= hintMessages[i].life) {
      hintMessages.splice(i, 1);
    }
  }
}

function enterTutorialStep(stepIndex) {
  if (tutorial.enteredStep === stepIndex) return;

  tutorial.enteredStep = stepIndex;

  if (stepIndex === 3 && !tutorial.ammoSpawned) {
    tutorial.ammoSpawned = true;
    player.ammo = 0;
    addAmmoPack(player.x + 120, player.y - 115, AMMO_PACK_VALUE);
  }
}

function updateTutorial(dt) {
  if (!tutorial.initialized) {
    setupTutorialScenario();
  }

  enterTutorialStep(tutorial.stepIndex);

  if (tutorial.completed) return;

  if (tutorial.stepIndex === 0 && player.state === "alive") {
    tutorial.stepIndex = 1;
    return;
  }

  if (tutorial.stepIndex === 1 && tutorial.shotCount > 0) {
    tutorial.stepIndex = 2;
    return;
  }

  if (
    tutorial.stepIndex === 2 &&
    (bot1.state !== "alive" || bot1.wreckRepair > 0 || bot1.hp <= 0)
  ) {
    tutorial.targetBroken = true;
    tutorial.stepIndex = 3;
    return;
  }

  if (tutorial.stepIndex === 3 && tutorial.ammoPicked) {
    tutorial.stepIndex = 4;
    return;
  }

  if (tutorial.stepIndex === 4 && player.state === "pilot") {
    tutorial.stepIndex = 5;
    return;
  }

  if (tutorial.stepIndex === 5 && isPilotAirborne(player)) {
    tutorial.completed = true;
    tutorial.stepIndex = 6;
  }
}

function updateRoomObjects(dt) {
  roomObjectActivationCooldown = Math.max(0, roomObjectActivationCooldown - dt);

  if (isPilotDialogOpen()) {
    clearPendingTeleportActivation();
    return;
  }

  if (player.state !== "pilot" || isPilotAirborne(player)) {
    clearPendingTeleportActivation();
    return;
  }

  const hit = getNearRoomObjectInstance();

  if (!hit) {
    clearPendingTeleportActivation();
    return;
  }

  const label = String(hit.instance.params?.label || hit.definition?.title || hit.instance.objectId);
  if (
    hit.definition?.kind !== "teleport" &&
    hit.definition?.kind !== "market-item" &&
    !(isUserBaseRoom() && hit.definition?.kind === "menu-terminal")
  ) {
    addHint(`${label}: ENTER`);
  }

  if (hit.definition?.kind === "teleport" && roomObjectActivationCooldown <= 0) {
    updateTeleportActivation(hit.instance, hit.definition, dt);
  } else if (hit.definition?.kind === "menu-terminal" && roomObjectActivationCooldown <= 0) {
    clearPendingTeleportActivation();
    activateMenuTerminal(hit.instance);
  } else if (hit.definition?.kind === "market-item" && roomObjectActivationCooldown <= 0) {
    clearPendingTeleportActivation();
    activateMarketItem(hit.instance);
  } else if (hit.definition?.kind !== "teleport") {
    clearPendingTeleportActivation();
  }
}

function getNearRoomObjectInstance() {
  for (const instance of getActiveRoomObjectInstances()) {
    const definition = getRoomObjectDefinition(instance.objectId);

    if (isPlayerOverRoomObject(instance, definition)) {
      return { instance, definition };
    }
  }

  return null;
}

function isPlayerOverRoomObject(instance, definition) {
  const position = getRoomObjectPosition(instance);
  const dx = player.pilotX - position.x;
  const dy = player.pilotY - position.y;

  if (definition?.kind === "teleport") {
    const radius = Number(definition.render?.radius) || 42;
    return Math.hypot(dx, dy) <= radius;
  }

  if (definition?.kind === "menu-terminal") {
    const width =
      Number(instance.params?.width || definition.render?.width) ||
      MENU_TERMINAL_DEFAULT_WIDTH;
    const height =
      Number(instance.params?.height || definition.render?.height) ||
      MENU_TERMINAL_DEFAULT_HEIGHT;

    return Math.abs(dx) <= width / 2 && Math.abs(dy) <= height / 2;
  }

  const radius = Number(definition?.interaction?.radius) || 24;
  return Math.hypot(dx, dy) <= radius;
}

function activateTeleport(instance) {
  performTeleport(instance);
}

function updateTeleportActivation(instance, definition, dt) {
  const delay = getTeleportTriggerDelaySeconds(instance, definition);

  if (delay <= 0) {
    clearPendingTeleportActivation();
    activateTeleport(instance);
    return;
  }

  if (pendingTeleportActivation?.instanceId !== instance.instanceId) {
    pendingTeleportActivation = {
      instanceId: instance.instanceId,
      remaining: delay
    };
  }

  pendingTeleportActivation.remaining = Math.max(
    0,
    pendingTeleportActivation.remaining - dt
  );

  addHint(`TELEPORT ${Math.ceil(pendingTeleportActivation.remaining)}s`);

  if (pendingTeleportActivation.remaining <= 0) {
    clearPendingTeleportActivation();
    activateTeleport(instance);
  }
}

function getTeleportTriggerDelaySeconds(instance, definition) {
  const value =
    instance.params?.triggerDelaySeconds ??
    instance.params?.delaySeconds ??
    definition?.behavior?.triggerDelaySeconds ??
    0;
  const delay = Number(value);

  return Number.isFinite(delay) ? Math.max(0, delay) : 0;
}

function clearPendingTeleportActivation() {
  pendingTeleportActivation = null;
}

function handleTeleportClick(pointerX, pointerY) {
  if (isPilotDialogOpen()) return false;
  if (player.state !== "pilot" || isPilotAirborne(player)) return false;

  const worldPoint = screenToWorld(pointerX, pointerY);

  for (const instance of getActiveRoomObjectInstances()) {
    const definition = getRoomObjectDefinition(instance.objectId);

    if (definition?.kind !== "teleport") continue;
    if (!isPlayerOverRoomObject(instance, definition)) continue;
    if (!isWorldPointOverTeleport(worldPoint, instance, definition)) continue;

    clearPendingTeleportActivation();
    activateTeleport(instance);
    return true;
  }

  return false;
}

function isWorldPointOverTeleport(point, instance, definition) {
  const position = getRoomObjectPosition(instance);
  const radius = Number(definition.render?.radius) || 42;

  return Math.hypot(point.x - position.x, point.y - position.y) <= radius;
}

function performTeleport(instance) {
  const targetRoomId = String(instance.params?.targetRoomId || "").trim();

  if (!targetRoomId || !getRoomById(targetRoomId)) return;

  window.GUNS_APP.roomId = targetRoomId;
  setActiveRoom(targetRoomId);
  roomObjectActivationCooldown = 0.6;

  window.GUNS_NET?.disconnect?.();
  window.GUNS_NET?.connect?.({
    roomId: targetRoomId,
    nick: window.GUNS_APP?.playerNick || player.displayName || "pilot"
  }).catch(() => {});
}

function bouncePlayerFromRoomObject(instance) {
  if (typeof instance === "string") {
    instance = getActiveRoomObjectInstances()
      .find(item => item.instanceId === instance);
  }

  if (!instance) return;

  const position = getRoomObjectPosition(instance);
  const dx = player.pilotX - position.x;
  const dy = player.pilotY - position.y;
  const distanceToPlayer = Math.hypot(dx, dy) || 1;

  if (!player.pilotKnockback) {
    startPilotKnockback(
      player,
      dx / distanceToPlayer,
      dy / distanceToPlayer
    );
  }

  roomObjectActivationCooldown = 0.8;
}

function activateMenuTerminal(instance) {
  const action = String(instance.params?.action || "").trim();

  if (action === "open-pilot") {
    roomObjectActivationCooldown = 0.6;
    window.GUNS_APP?.handleBasePilotAction?.();
    return;
  }

  if (action === "exchange-score") {
    roomObjectActivationCooldown = 0.6;
    window.GUNS_APP?.handleBaseExchange?.();
    return;
  }

  if (action === "set-language") {
    const language = String(instance.params?.language || "").trim();
    if (language) {
      roomObjectActivationCooldown = 0.45;
      window.GUNS_I18N?.setLanguage?.(language);
    }
  }
}

function getMarketItemStock(instance) {
  const stock = Number(instance.params?.stock ?? 0);

  return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0;
}

function setMarketItemStock(instance, stock) {
  if (!instance.params) {
    instance.params = {};
  }

  instance.params.stock = Math.max(0, Math.floor(Number(stock) || 0));
}

function getMarketItemPrice(instance) {
  const weapon = getPilotWeaponDefinition(instance.params?.weaponId);
  const price = Number(weapon?.economy?.priceGs);

  return Number.isFinite(price) ? Math.max(0, Math.floor(price)) : 0;
}

function getPurchasedMarketItemStock(instance, result) {
  const serverInstance = result?.room?.objects
    ?.find(item => item.instanceId === instance.instanceId);
  const stock = Number(serverInstance?.params?.stock ?? result?.stock);

  return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null;
}

function activateMarketItem(instance) {
  const stock = getMarketItemStock(instance);
  const price = getMarketItemPrice(instance);
  const weaponId = String(instance.params?.weaponId || "");

  if (
    stock <= 0 ||
    !weaponId ||
    instance.purchasePending ||
    getPlayerGunsCoinBalance() < price
  ) {
    bouncePlayerFromRoomObject(instance);
    return;
  }

  instance.purchasePending = true;
  roomObjectActivationCooldown = 0.8;

  Promise.resolve(window.GUNS_APP?.purchasePilotWeapon?.(weaponId, price, {
    roomId: activeRoomId,
    instanceId: instance.instanceId
  }))
    .then((purchased) => {
      if (!purchased) {
        bouncePlayerFromRoomObject(instance);
        return;
      }

      const serverStock = getPurchasedMarketItemStock(instance, purchased);
      setMarketItemStock(instance, serverStock ?? stock - 1);

      if (getMarketItemStock(instance) <= 0) {
        bouncePlayerFromRoomObject(instance);
      }
    })
    .catch(() => bouncePlayerFromRoomObject(instance))
    .finally(() => {
      instance.purchasePending = false;
    });
}

function getMenuTerminalLabel(instance, definition) {
  const action = String(instance.params?.action || "").trim();

  if (action === "open-pilot") {
    return window.GUNS_APP?.getBasePilotActionLabel?.() || "CHANGE CALLSIGN";
  }

  return String(instance.params?.label || definition.title || "MENU");
}

function update(dt) {
  syncActiveModeStateFromServer();

  if (!activeModeState?.serverMatchId) {
    window.GUNS_MODE_REGISTRY?.onTick?.(activeModeState, {
      room: ACTIVE_ROOM,
      units,
      player,
      dt
    });
  }

  if (isTutorialMode() && !tutorial.initialized) {
    setupTutorialScenario();
  }

  if (
    player.state !== "pilot" &&
    player.pilotFlyState !== "ground"
  ) {
    player.pilotFlyState = "ground";
    player.pilotFlyTime = 0;
    player.pilotRadius = PILOT_RADIUS;
  }

  updateTurrets(dt);

  if (!isActiveModeEnded()) {
    updatePlayer(dt);
  }

  for (const bot of units) {
    if (isUnitHidden(bot)) continue;
    if (isTutorialMode()) continue;
    if (isActiveModeEnded()) continue;

    if (!bot.isPlayer && !bot.isCannonOnly) {
      updateBot(bot, dt);
    }
  }

  updateCannonCollisions();

  for (const pilotUnit of units) {
    for (const otherUnit of units) {
      updatePilotWreckOrEnemyContact(
        pilotUnit,
        otherUnit
      );
    }
  }

  for (const cannonUnit of units) {
    for (const pilotUnit of units) {
      if (cannonUnit !== pilotUnit) {
        updatePilotRunover(
          cannonUnit,
          pilotUnit
        );
      }
    }
  }

  if (!isActiveModeEnded()) {
    updatePilotWeaponCollisions();
  }

  for (const unit of units) {
    unit.recoilTime = Math.max(
      0,
      unit.recoilTime - dt
    );
    unit.pilotWeaponCooldown = Math.max(
      0,
      (unit.pilotWeaponCooldown || 0) - dt
    );
    unit.pilotFireCooldown = Math.max(
      0,
      (unit.pilotFireCooldown || 0) - dt
    );

    updatePostEjectBrake(unit, dt);
    updateWreckRepair(unit, dt);
    updateHealthRegen(unit, dt);
  }

  updateRearSmoke(dt);
  updateMovementTrails();

  if (!isActiveModeEnded()) {
    updatePlayerShooting(dt);
  }

  if (!isTutorialMode() && !isActiveModeEnded()) {
    updateAmmoSpawning(dt);
  }

  if (!isActiveModeEnded()) {
    updateAmmoPacks(dt);
    updateAmmoPickup();
    updateRoomObjects(dt);
  }

  if (!isActiveModeEnded()) {
    updateBullets(dt);
  }

  if (isTutorialMode()) {
    updateTutorial(dt);
  }

  clampUnitsToRoom();

  updateEffects(dt);
}

function getArenaBackgroundCache() {
  const scale = Math.max(0.5, ARENA_BACKGROUND_CACHE_SCALE);
  const cacheKey = [
    scale,
    activeRoomId,
    SKIN.name,
    SKIN.roomTop,
    SKIN.roomMiddle,
    SKIN.roomBottom,
    SKIN.gridMinor,
    SKIN.gridMajor,
    SKIN.roomVignette,
    LCD_INK,
    LCD_BG_DARK,
    ROOM_SHAPE,
    getRoomWidth(),
    getRoomHeight(),
    ROOM_RADIUS
  ].join("|");

  if (arenaBackgroundCache?.key === cacheKey) {
    return arenaBackgroundCache;
  }

  const cacheCanvas = document.createElement("canvas");
  const paddingWorld = 16;
  const cacheWidth = Math.ceil((getRoomWidth() + paddingWorld * 2) * scale);
  const cacheHeight = Math.ceil((getRoomHeight() + paddingWorld * 2) * scale);

  cacheCanvas.width = cacheWidth;
  cacheCanvas.height = cacheHeight;

  const cacheCtx = cacheCanvas.getContext("2d");
  const centerX = cacheWidth / 2;
  const centerY = cacheHeight / 2;
  const radius = ROOM_RADIUS * scale;
  const toCacheX = value => (value - getRoomLeft() + paddingWorld) * scale;
  const toCacheY = value => (value - getRoomTop() + paddingWorld) * scale;
  const lineScale = Math.max(1, scale);

  const grad = cacheCtx.createLinearGradient(0, 0, 0, cacheHeight);
  grad.addColorStop(0, LCD_BG_LIGHT);
  grad.addColorStop(0.52, LCD_BG);
  grad.addColorStop(1, LCD_BG_DARK);

  cacheCtx.fillStyle = grad;
  cacheCtx.beginPath();
  drawRoomShapePath(cacheCtx, centerX, centerY, radius, scale);
  cacheCtx.fill();

  const left = getRoomLeft();
  const top = getRoomTop();
  const endX = getRoomRight();
  const endY = getRoomBottom();
  const startX = Math.ceil(left / gridSize) * gridSize;
  const startY = Math.ceil(top / gridSize) * gridSize;

  cacheCtx.save();
  cacheCtx.beginPath();
  drawRoomShapePath(cacheCtx, centerX, centerY, radius, scale);
  cacheCtx.clip();

  cacheCtx.strokeStyle = SKIN.gridMinor;
  cacheCtx.lineWidth = lineScale;
  cacheCtx.beginPath();

  for (let x = startX; x <= endX; x += gridSize) {
    const cx = toCacheX(x);

    cacheCtx.moveTo(cx, 0);
    cacheCtx.lineTo(cx, cacheHeight);
  }

  for (let y = startY; y <= endY; y += gridSize) {
    const cy = toCacheY(y);

    cacheCtx.moveTo(0, cy);
    cacheCtx.lineTo(cacheWidth, cy);
  }

  cacheCtx.stroke();

  cacheCtx.strokeStyle = SKIN.gridMajor;
  cacheCtx.lineWidth = lineScale;

  const bigGrid = gridSize * 4;
  const bigStartX = Math.ceil(left / bigGrid) * bigGrid;
  const bigStartY = Math.ceil(top / bigGrid) * bigGrid;

  cacheCtx.beginPath();

  for (let x = bigStartX; x <= endX; x += bigGrid) {
    const cx = toCacheX(x);

    cacheCtx.moveTo(cx, 0);
    cacheCtx.lineTo(cx, cacheHeight);
  }

  for (let y = bigStartY; y <= endY; y += bigGrid) {
    const cy = toCacheY(y);

    cacheCtx.moveTo(0, cy);
    cacheCtx.lineTo(cacheWidth, cy);
  }

  cacheCtx.stroke();

  cacheCtx.fillStyle = SKIN.roomVignette;

  for (let x = startX; x <= endX; x += gridSize) {
    for (let y = startY; y <= endY; y += gridSize) {
      if (((Math.floor(x / gridSize) + Math.floor(y / gridSize)) % 4) !== 0) {
        continue;
      }

      cacheCtx.fillRect(
        toCacheX(x) - scale,
        toCacheY(y) - scale,
        2 * scale,
        2 * scale
      );
    }
  }

  cacheCtx.restore();

  cacheCtx.strokeStyle = LCD_INK;
  cacheCtx.lineWidth = 10 * scale;
  cacheCtx.beginPath();
  drawRoomShapePath(cacheCtx, centerX, centerY, radius, scale);
  cacheCtx.stroke();

  cacheCtx.strokeStyle = LCD_BG_DARK;
  cacheCtx.lineWidth = 3 * scale;
  cacheCtx.beginPath();
  drawRoomShapePath(cacheCtx, centerX, centerY, Math.max(0, radius - 8 * scale), scale, 8 * scale);
  cacheCtx.stroke();

  arenaBackgroundCache = {
    key: cacheKey,
    canvas: cacheCanvas
  };

  return arenaBackgroundCache;
}

function drawRoomShapePath(targetCtx, centerX, centerY, radius, scale, inset = 0) {
  if (isPolygonRoomShape()) {
    const points = getRoomPolygonPoints(-inset / scale);

    for (let i = 0; i < points.length; i++) {
      const x = centerX + points[i].x * scale;
      const y = centerY + points[i].y * scale;

      if (i === 0) {
        targetCtx.moveTo(x, y);
      } else {
        targetCtx.lineTo(x, y);
      }
    }

    targetCtx.closePath();
    return;
  }

  if (ROOM_SHAPE === "rectangle") {
    targetCtx.rect(
      paddingToPixels(inset, scale),
      paddingToPixels(inset, scale),
      Math.max(0, getRoomWidth() * scale - inset * 2),
      Math.max(0, getRoomHeight() * scale - inset * 2)
    );
    return;
  }

  targetCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
}

function paddingToPixels(inset, scale) {
  return 16 * scale + inset;
}

function getBaseBackdropSources() {
  const backgrounds = window.GUNS_CONFIG?.visual?.startBackgrounds || [];

  return backgrounds
    .map(item => (typeof item === "string" ? item : item?.image || ""))
    .filter(Boolean);
}

function getBaseBackdropImage(src) {
  let entry = cabinetBackdropImages.find(item => item.src === src);

  if (entry) return entry;

  const image = new Image();
  entry = {
    src,
    image,
    loaded: false
  };
  image.onload = () => {
    entry.loaded = true;
  };
  image.src = src;
  cabinetBackdropImages.push(entry);

  return entry;
}

function drawBaseBackdropImage(entry, alpha, transform) {
  if (!entry?.loaded) return;

  const scale =
    Math.max(
      window.innerWidth / entry.image.naturalWidth,
      window.innerHeight / entry.image.naturalHeight
    ) * transform.pulse;
  const width = entry.image.naturalWidth * scale;
  const height = entry.image.naturalHeight * scale;
  const x = (window.innerWidth - width) / 2 + transform.driftX;
  const y = (window.innerHeight - height) / 2 + transform.driftY;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(entry.image, x, y, width, height);
  ctx.restore();
}

function drawBaseBackdrop() {
  const sources = getBaseBackdropSources();

  if (!sources.length) {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    return;
  }

  const cycle = Math.floor(performance.now() / CABINET_BACKDROP_INTERVAL_MS);
  const currentIndex = cycle % sources.length;
  const nextIndex = (currentIndex + 1) % sources.length;
  const cycleProgress =
    (performance.now() % CABINET_BACKDROP_INTERVAL_MS) /
    CABINET_BACKDROP_INTERVAL_MS;
  const fade = clamp(
    (cycleProgress * CABINET_BACKDROP_INTERVAL_MS -
      (CABINET_BACKDROP_INTERVAL_MS - CABINET_BACKDROP_FADE_MS)) /
      CABINET_BACKDROP_FADE_MS,
    0,
    1
  );
  const phase = performance.now() / CABINET_BACKDROP_PULSE_MS * Math.PI * 2;
  const transform = {
    pulse: 1.02 + Math.sin(phase) * 0.02,
    driftX: Math.sin(phase) * 10,
    driftY: Math.cos(phase) * 8
  };

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  drawBaseBackdropImage(getBaseBackdropImage(sources[currentIndex]), 1 - fade, transform);
  drawBaseBackdropImage(getBaseBackdropImage(sources[nextIndex]), fade, transform);
}

function drawGrid() {
  if (isUserBaseRoom()) {
    drawBaseBackdrop();
  } else {
    ctx.fillStyle = SKIN.roomOutside;
    ctx.fillRect(
      0,
      0,
      window.innerWidth,
      window.innerHeight
    );
  }

  const topLeft = worldToScreen(getRoomLeft() - 16, getRoomTop() - 16);
  const cache = getArenaBackgroundCache();

  ctx.drawImage(
    cache.canvas,
    topLeft.x,
    topLeft.y,
    z(getRoomWidth() + 32),
    z(getRoomHeight() + 32)
  );

  drawUserBaseFloorCallsign();
  drawArenaFloorTimer();

  if (isUserBaseRoom()) {
    drawBaseVersion();
  }
}

function drawBaseVersion() {
  ctx.save();
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = "rgba(247, 247, 240, 0.78)";
  ctx.fillStyle = LCD_INK;
  ctx.globalAlpha = 0.88;
  ctx.strokeText(`v${GAME_VERSION}`, window.innerWidth / 2, 2);
  ctx.fillText(`v${GAME_VERSION}`, window.innerWidth / 2, 2);
  ctx.restore();
}

function drawUserBaseFloorCallsign() {
  if (!isUserBaseRoom()) return;

  const p = worldToScreen(0, 34);
  const callsign = getPlayerCallsign();
  const maxWidth = z(Math.min(getRoomWidth() * 0.82, 760));
  let fontSize = z(82);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = LCD_INK;
  ctx.strokeStyle = LCD_INK;
  ctx.lineWidth = Math.max(1, z(2));

  do {
    ctx.font = `bold ${fontSize}px monospace`;
    if (ctx.measureText(callsign).width <= maxWidth || fontSize <= z(24)) {
      break;
    }
    fontSize -= z(4);
  } while (fontSize > z(24));

  ctx.strokeText(callsign, p.x, p.y);
  ctx.globalAlpha = 0.08;
  ctx.fillText(callsign, p.x, p.y);

  ctx.restore();
}

function shouldDrawArenaFloorTimer() {
  return (
    !isUserBaseRoom() &&
    !!activeModeState &&
    activeModeState.durationMs > 0 &&
    getActiveModeRule("showTimer", 0) > 0
  );
}

function drawArenaFloorTimer() {
  if (!shouldDrawArenaFloorTimer()) return;

  const p = worldToScreen(0, 34);
  const label = formatModeTime(activeModeState.remainingMs);
  const maxWidth = z(Math.min(getRoomWidth() * 0.58, 560));
  let fontSize = z(112);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = LCD_INK;
  ctx.strokeStyle = LCD_INK;
  ctx.lineWidth = Math.max(1, z(2));

  do {
    ctx.font = `bold ${fontSize}px monospace`;
    if (ctx.measureText(label).width <= maxWidth || fontSize <= z(32)) {
      break;
    }
    fontSize -= z(4);
  } while (fontSize > z(32));

  ctx.strokeText(label, p.x, p.y);
  ctx.globalAlpha = 0.08;
  ctx.fillText(label, p.x, p.y);
  ctx.restore();
}

function drawRoomObjects() {
  for (const instance of getActiveRoomObjectInstances()) {
    const definition = getRoomObjectDefinition(instance.objectId);

    if (definition?.kind === "menu-terminal") {
      drawMenuTerminal(instance, definition);
    } else if (definition?.kind === "teleport") {
      drawTeleport(instance, definition);
    } else if (definition?.kind === "market-item") {
      drawMarketItem(instance, definition);
    }
  }
}

function drawMarketItem(instance, definition) {
  const position = getRoomObjectPosition(instance);
  const p = worldToScreen(position.x, position.y);
  const weapon = getPilotWeaponDefinition(instance.params?.weaponId);
  const icon = String(instance.params?.icon || weapon?.typeId || "").toLowerCase();
  const title = String(weapon?.title || instance.params?.label || "item");
  const price = Number(weapon?.economy?.priceGs);
  const stock = getMarketItemStock(instance);
  const width = z(Number(definition.render?.width) || 120);
  const height = z(Number(definition.render?.height) || 120);
  const iconSize = z(Number(definition.render?.iconSize) || 64);
  const isNear =
    player.state === "pilot" &&
    isPlayerOverRoomObject(instance, definition);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Number(instance.rotation || 0));

  ctx.fillStyle = isNear ? LCD_PANEL : "rgba(31, 43, 22, 0.10)";
  ctx.strokeStyle = isNear ? LCD_INK : LCD_SOFT;
  ctx.lineWidth = Math.max(1, z(isNear ? 2 : 1.25));
  ctx.fillRect(-width / 2, -height / 2, width, height);
  ctx.strokeRect(-width / 2, -height / 2, width, height);

  ctx.save();
  ctx.translate(0, -height * 0.12);
  if (icon === "knife") {
    drawKnifeMarketIcon(iconSize);
  } else {
    drawPistolMarketIcon(iconSize);
  }
  ctx.restore();

  ctx.fillStyle = LCD_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `${Math.max(11, z(13))}px monospace`;
  ctx.fillText(title, 0, height * 0.24);
  if (Number.isFinite(price)) {
    ctx.font = `${Math.max(10, z(12))}px monospace`;
    ctx.fillText(`${price} gs`, 0, height * 0.38);
  }
  ctx.font = `bold ${Math.max(11, z(14))}px monospace`;
  ctx.fillText(`x${stock}`, width * 0.32, -height * 0.42);

  ctx.restore();
}

function drawPistolMarketIcon(size) {
  const s = size / 64;

  ctx.fillStyle = LCD_INK;
  ctx.strokeStyle = LCD_INK;
  ctx.lineWidth = Math.max(1, z(2));

  ctx.fillRect(-26 * s, -18 * s, 42 * s, 10 * s);
  ctx.fillRect(10 * s, -14 * s, 20 * s, 6 * s);
  ctx.fillRect(-18 * s, -8 * s, 20 * s, 13 * s);
  ctx.save();
  ctx.translate(-1 * s, 4 * s);
  ctx.rotate(-0.28);
  ctx.fillRect(-8 * s, 0, 14 * s, 30 * s);
  ctx.restore();
  ctx.fillRect(3 * s, 0, 15 * s, 6 * s);
}

function drawKnifeMarketIcon(size) {
  const s = size / 64;

  ctx.fillStyle = LCD_INK;
  ctx.strokeStyle = LCD_INK;
  ctx.lineWidth = Math.max(1, z(2));

  ctx.beginPath();
  ctx.moveTo(-5 * s, -30 * s);
  ctx.lineTo(12 * s, -6 * s);
  ctx.lineTo(2 * s, 11 * s);
  ctx.lineTo(-14 * s, -11 * s);
  ctx.closePath();
  ctx.fill();

  ctx.fillRect(-13 * s, 9 * s, 27 * s, 7 * s);
  ctx.save();
  ctx.translate(0, 20 * s);
  ctx.rotate(0.12);
  ctx.fillRect(-7 * s, -4 * s, 14 * s, 25 * s);
  ctx.restore();
}

function drawMenuTerminal(instance, definition) {
  const position = getRoomObjectPosition(instance);
  const p = worldToScreen(position.x, position.y);
  const width = z(Number(instance.params?.width || definition.render?.width) || MENU_TERMINAL_DEFAULT_WIDTH);
  const height = z(Number(instance.params?.height || definition.render?.height) || MENU_TERMINAL_DEFAULT_HEIGHT);
  const label = getMenuTerminalLabel(instance, definition);
  const isNear =
    player.state === "pilot" &&
    isPlayerOverRoomObject(instance, definition);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Number(instance.rotation || 0));

  ctx.fillStyle = isNear ? LCD_PANEL : "rgba(31, 43, 22, 0.12)";
  ctx.strokeStyle = isNear ? LCD_INK : LCD_SOFT;
  ctx.lineWidth = Math.max(1, z(isNear ? 2 : 1.25));
  ctx.fillRect(-width / 2, -height / 2, width, height);
  ctx.strokeRect(-width / 2, -height / 2, width, height);

  ctx.fillStyle = LCD_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.max(10, z(Math.min(13, Number(instance.params?.fontSize || 13))))}px monospace`;
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function drawTeleport(instance, definition) {
  const position = getRoomObjectPosition(instance);
  const p = worldToScreen(position.x, position.y);
  const radius = z(Number(definition.render?.radius) || 42);
  const targetRoom = getRoomById(instance.params?.targetRoomId);
  const label = String(instance.params?.label || targetRoom?.title || definition.title || "TELEPORT");
  const description = String(instance.params?.description || targetRoom?.description || "");
  const isNear =
    player.state === "pilot" &&
    isPlayerOverRoomObject(instance, definition);
  const countdown =
    pendingTeleportActivation?.instanceId === instance.instanceId
      ? Math.ceil(Math.max(0, pendingTeleportActivation.remaining))
      : 0;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Number(instance.rotation || 0));

  ctx.strokeStyle = isNear ? LCD_INK : LCD_SOFT;
  ctx.fillStyle = isNear ? LCD_PANEL : "rgba(31, 43, 22, 0.10)";
  ctx.lineWidth = z(isNear ? 4 : 2);

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-radius * 0.9, 0);
  ctx.lineTo(radius * 0.9, 0);
  ctx.moveTo(0, -radius * 0.9);
  ctx.lineTo(0, radius * 0.9);
  ctx.stroke();

  ctx.fillStyle = LCD_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  if (countdown > 0) {
    ctx.font = `bold ${Math.max(12, z(15))}px monospace`;
    ctx.fillText(`${countdown}s`, 0, -radius - z(30));
  }
  ctx.font = `${Math.max(12, z(15))}px monospace`;
  ctx.fillText(label, 0, radius + z(12));
  if (description) {
    ctx.font = `${Math.max(11, z(13))}px monospace`;
    ctx.fillText(description, 0, radius + z(31));
  }
  ctx.restore();
}

function drawHealthBar(unit) {
  const p = worldToScreen(unit.x, unit.y);

  const width = z(70);
  const height = z(7);

  const x = p.x - width / 2;
  const y = p.y - z(52);

  const ratio = clamp(unit.hp / unit.maxHp, 0, 1);

  ctx.save();
  ctx.globalAlpha = HEALTH_BAR_OPACITY;

  ctx.fillStyle = LCD_BG_LIGHT;
  ctx.fillRect(x, y, width, height);

  ctx.strokeStyle = CANNON_INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = CANNON_INK;
  ctx.fillRect(
    x,
    y,
    width * ratio,
    height
  );

  ctx.restore();
}

function getUnitDisplayName(unit) {
  return unit.displayName || unit.id;
}

function isBotNameBracketsEnabled() {
  return window.GUNS_SHARED_CONFIG?.settings?.botNameBrackets === true;
}

function getUnitLabelName(unit) {
  const name = getUnitDisplayName(unit);

  if (unit?.isPlayer || !isBotNameBracketsEnabled() || hasNameBrackets(name)) {
    return name;
  }

  return `[${name}]`;
}

function getScoreboardDisplayName(row) {
  const name = row.displayName || row.nick || row.id;

  if (row.kind !== "bot" || !isBotNameBracketsEnabled() || hasNameBrackets(name)) {
    return name;
  }

  return `[${name}]`;
}

function hasNameBrackets(name) {
  return /^\[.*\]$/.test(String(name || ""));
}

function getServerScoreboardRowColor(row) {
  if (row.id === window.GUNS_NET?.describe?.().clientId) {
    return PLAYER_COLOR;
  }

  if (row.color && SKIN[row.color]) {
    return SKIN[row.color];
  }

  if (row.kind === "bot") {
    return LCD_INK_2;
  }

  return LCD_INK;
}

function getLocalNetworkSnapshot() {
  const inCannon = player.state === "alive";

  return {
    nick: getUnitDisplayName(player),
    x: inCannon ? player.x : player.pilotX,
    y: inCannon ? player.y : player.pilotY,
    angle: inCannon ? player.turretAngle : player.pilotAngle,
    state: inCannon ? "in-cannon" : "on-foot",
    cannonEntityId: inCannon ? player.cannonEntityId : "",
    gunType: inCannon ? player.gunType : "",
    flying: isPilotAirborne(player),
    alive: player.pilotAlive !== false,
    hp: inCannon ? player.hp : player.pilotHp,
    maxHp: inCannon ? player.maxHp : 1,
    ammo: inCannon ? player.ammo : 0,
    maxAmmo: inCannon ? getMaxAmmo(player) : 0,
    radiusOuter: player.radiusOuter,
    radiusInner: player.radiusInner,
    score: player.score || 0,
    pilotKills: player.pilotKills || 0,
    cannonBreaks: player.cannonBreaks || 0,
    pilotDeaths: player.pilotDeaths || 0,
    inventory: {
      pilotWeapons: window.GUNS_APP?.getPilotWeapons?.() || []
    },
    bots: getLocalBotNetworkSnapshots()
  };
}

function getLocalBotNetworkSnapshots() {
  return units
    .filter(unit => !unit.isPlayer && !unit.isCannonOnly && !isUnitHidden(unit))
    .map(unit => ({
      id: unit.id,
      nick: getUnitDisplayName(unit),
      score: unit.score || 0,
      pilotKills: unit.pilotKills || 0,
      cannonBreaks: unit.cannonBreaks || 0,
      pilotDeaths: unit.pilotDeaths || 0
    }));
}

function sendNetworkSnapshot(now) {
  if (!window.GUNS_NET?.connected) return;
  const rate =
    window.GUNS_CONFIG?.multiplayer?.snapshotRateMs ||
    100;
  if (now - lastNetworkSnapshotAt < rate) return;

  lastNetworkSnapshotAt = now;
  window.GUNS_NET.sendSnapshot?.(getLocalNetworkSnapshot());
}

function sendNetworkShootEvent(weapon, bullets) {
  if (!window.GUNS_NET?.connected) return;

  const cannonEntityId =
    weapon === "gun" && player.state === "alive"
      ? player.cannonEntityId || ""
      : "";

  const list = (Array.isArray(bullets) ? bullets : [bullets])
    .filter(Boolean)
    .map(bullet => ({
      weapon,
      cannonEntityId,
      x: bullet.x,
      y: bullet.y,
      vx: bullet.vx,
      vy: bullet.vy,
      radius: bullet.radius,
      damage: bullet.damage,
      lifeMs: Math.max(100, Math.round((bullet.life || 1.4) * 1000))
    }));

  if (!list.length) return;

  window.GUNS_NET.sendShootEvent?.({
    weapon,
    cannonEntityId,
    bullets: list
  });
}

function sendNetworkRespawnEvent() {
  if (!window.GUNS_NET?.connected) return;

  window.GUNS_NET.sendRespawnEvent?.({
    x: player.pilotX,
    y: player.pilotY,
    state: "on-foot",
    flying: isPilotAirborne(player),
    maxHp: 1
  });
}

function setupNetworkCombatEvents() {
  if (networkCombatEventsInitialized) return;
  if (!window.GUNS_NET?.on) return;

  networkCombatEventsInitialized = true;
  window.GUNS_NET.on("damage:event", message => {
    applyNetworkDamageEvent(message.damage);
  });
  window.GUNS_NET.on("death:event", message => {
    applyNetworkDeathEvent(message.death);
  });
  window.GUNS_NET.on("respawn:event", message => {
    applyNetworkRespawnEvent(message.respawn);
  });
}

function setupNetworkRoomConfigEvents() {
  if (networkRoomConfigEventsInitialized) return;
  if (!window.GUNS_NET?.on) return;

  networkRoomConfigEventsInitialized = true;
  window.GUNS_NET.on("room:config", message => {
    applyNetworkRoomConfig(message.room);
  });
}

function setupNetworkInventoryEvents() {
  if (networkInventoryEventsInitialized) return;
  if (!window.GUNS_NET?.on) return;

  networkInventoryEventsInitialized = true;
  window.GUNS_NET.on("inventory:sync", message => {
    window.GUNS_APP?.syncInventory?.(message.user || message.inventory);
  });
}

function setupNetworkServerSnapshotEvents() {
  if (networkServerSnapshotEventsInitialized) return;
  if (!window.GUNS_NET?.on) return;

  networkServerSnapshotEventsInitialized = true;
  window.GUNS_NET.on("server:snapshot", message => {
    applyNetworkServerSnapshot(message.snapshot, message.serverTime);
  });
}

function applyNetworkServerSnapshot(snapshot, serverTime = 0) {
  if (!snapshot) return;
  if (serverTime && serverTime <= lastAppliedServerSnapshotAt) return;

  lastAppliedServerSnapshotAt = serverTime || Date.now();

  if (snapshot.state === "on-foot" && player.state === "alive") {
    forcePlayerToServerFootSnapshot(snapshot);
    return;
  }

  applyServerPositionCorrection(snapshot);
}

function forcePlayerToServerFootSnapshot(snapshot) {
  const x = Number(snapshot.x);
  const y = Number(snapshot.y);

  player.state = "pilot";
  player.exitRequested = false;
  player.exitStopTimer = 0;
  player.knockback = null;
  player.pilotKnockback = null;
  player.pilotEject = null;
  player.pilotHp = Math.max(1, Number(snapshot.hp) || player.pilotHp || 1);
  player.pilotImmunity = Math.max(player.pilotImmunity || 0, 0.35);
  player.pilotFlyState = snapshot.flying ? "flying" : "ground";
  player.pilotFlyTime = 0;

  if (Number.isFinite(x)) {
    player.pilotX = x;
  }

  if (Number.isFinite(y)) {
    player.pilotY = y;
  }

  clampPilotToRoom(player);
}

function applyServerPositionCorrection(snapshot) {
  const x = Number(snapshot.x);
  const y = Number(snapshot.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  if (snapshot.state === "in-cannon" && player.state === "alive") {
    correctPointTowardServer(player, "x", "y", x, y, player.radiusOuter);
    return;
  }

  if (snapshot.state === "on-foot" && player.state === "pilot") {
    correctPointTowardServer(player, "pilotX", "pilotY", x, y, player.pilotRadius);
  }
}

function correctPointTowardServer(unit, xKey, yKey, serverX, serverY, radius = 0) {
  const dx = serverX - unit[xKey];
  const dy = serverY - unit[yKey];
  const distance = Math.hypot(dx, dy);

  if (distance <= SERVER_POSITION_CORRECTION_DEADZONE) return;

  const ratio = distance >= SERVER_POSITION_CORRECTION_SNAP_DISTANCE
    ? 1
    : SERVER_POSITION_CORRECTION_BLEND;

  unit[xKey] += dx * ratio;
  unit[yKey] += dy * ratio;

  if (xKey === "x") {
    clampToRoomPoint(unit, radius);
  } else {
    clampPilotToRoom(unit);
  }
}

function applyNetworkRoomConfig(room) {
  if (!room?.id) return;

  window.GUNS_SHARED_CONFIG ||= {};
  window.GUNS_SHARED_CONFIG.rooms ||= {};
  window.GUNS_SHARED_CONFIG.rooms[room.id] = room;

  if (room.id !== activeRoomId) return;

  ACTIVE_ROOM = room;
  ROOM_GEOMETRY = window.GUNS_ROOM_ENTRY.createRoomGeometryState(ACTIVE_ROOM);
  ROOM_SHAPE = ROOM_GEOMETRY.shape;
  ROOM_RADIUS = ROOM_GEOMETRY.radius;
  ROOM_WIDTH = ROOM_GEOMETRY.width;
  ROOM_HEIGHT = ROOM_GEOMETRY.height;
}

function isNetworkEventForPlayer(event) {
  const ownClientId = window.GUNS_NET?.describe?.().clientId || "";

  return !!ownClientId && event?.targetId === ownClientId;
}

function applyNetworkDamageEvent(event) {
  if (!isNetworkEventForPlayer(event)) return;

  const afterHp = Math.max(0, Number(event.afterHp) || 0);

  if (event.targetKind === "cannon" && player.state === "alive") {
    player.hp = afterHp;
    return;
  }

  if (event.targetKind === "pilot" && player.state === "pilot") {
    player.pilotHp = afterHp;
  }
}

function applyNetworkDeathEvent(event) {
  if (!isNetworkEventForPlayer(event)) return;

  if (event.targetKind === "cannon" && player.state === "alive") {
    destroyCannon(player);
    return;
  }

  if (event.targetKind !== "pilot") return;
  if (isPilotDialogOpen()) return;

  addStain(
    player.pilotX,
    player.pilotY,
    player.color,
    getUnitDisplayName(player)
  );
  dropCarriedPowerups(player);
  window.GUNS_DEATH_FLOW.applyPilotDeathState({
    victim: player,
    pilotRadius: PILOT_RADIUS,
    pilotImmunityTime: PILOT_IMMUNITY_TIME,
    clampPilotToRoom
  });
  startPlayerDeathPrompt();
}

function applyNetworkRespawnEvent(event) {
  if (!isNetworkEventForPlayer({
    targetId: event?.clientId
  })) {
    return;
  }

  player.pilotX = Number(event.x) || player.pilotX;
  player.pilotY = Number(event.y) || player.pilotY;
  player.pilotHp = Math.max(1, Number(event.hp) || 1);
  player.pilotImmunity = PILOT_IMMUNITY_TIME;
  player.pilotKnockback = null;
  player.pilotEject = null;
  player.pilotWeaponCooldown = 0;
  player.pilotFlyState = event.flying ? player.pilotFlyState : "falling";
  player.pilotFlyTime = 0;
  player.state = "pilot";
}

function drawNameLabel(text, x, y, color = LCD_INK, scale = 1) {
  ctx.save();

  ctx.font = `${Math.round(12 * scale)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = LCD_BG_LIGHT;
  ctx.fillStyle = color;

  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);

  ctx.restore();
}

function drawCannonPilotName(unit) {
  if (unit.isCannonOnly) return;
  if (unit.state !== "alive") return;

  const p = worldToScreen(unit.x, unit.y);

  drawNameLabel(
    getUnitLabelName(unit),
    p.x,
    p.y - z(68),
    unit.color
  );
}

function isFreeCannonForLabel(unit) {
  return (
    unit.state === "pilot" &&
    !unit.cannonDestroyed &&
    unit.wreckRepair <= 0 &&
    unit.hp > 0
  );
}

function isCannonEntryLocked(unit) {
  return unit.entryLocked === true;
}

function drawCannonStateLabel(unit, text, color) {
  const p = worldToScreen(unit.x, unit.y);
  const bob =
    Math.sin(performance.now() * 0.004) * z(7);

  drawNameLabel(
    text,
    p.x,
    p.y - z(88) + bob,
    color,
    1.2
  );
}

function drawFreeCannonLabel(unit) {
  if (!isFreeCannonForLabel(unit)) return;
  if (isCannonEntryLocked(unit)) return;

  drawCannonStateLabel(
    unit,
    text("cannon.free"),
    LCD_INK
  );
}

function drawLockedCannonLabel(unit) {
  if (!isFreeCannonForLabel(unit)) return;
  if (!isCannonEntryLocked(unit)) return;

  drawCannonStateLabel(
    unit,
    text("cannon.lock"),
    LCD_INK_3
  );
}

function isWaitingCannonForLabel(unit) {
  return (
    unit.state === "pilot" &&
    !unit.cannonDestroyed &&
    unit.wreckRepair > 0
  );
}

function drawWaitingCannonLabel(unit) {
  if (!isWaitingCannonForLabel(unit)) return;

  drawCannonStateLabel(
    unit,
    text("cannon.wait"),
    LCD_INK_2
  );
}

function drawAmmoText(unit) {
  const p = worldToScreen(unit.x, unit.y);

  ctx.fillStyle = unit.color;
  ctx.font = "12px monospace";

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(
    unit.ammo + "/" + getMaxAmmo(unit),
    p.x,
    p.y + z(68)
  );
}

function getAmmoPackAlpha(pack) {
  if (pack.time < AMMO_PACK_FADE_TIME) {
    return clamp(pack.time / AMMO_PACK_FADE_TIME, 0, 1);
  }

  if (pack.time > AMMO_PACK_LIFE_TIME) {
    return clamp(
      1 -
        (pack.time - AMMO_PACK_LIFE_TIME) /
          AMMO_PACK_FADE_TIME,
      0,
      1
    );
  }

  return 1;
}

function drawRepairPackIcon(x, y) {
  ctx.save();

  ctx.strokeStyle = LCD_INK;
  ctx.fillStyle = LCD_INK;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 4);

  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(6, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(8, 0, 4, -0.9, 0.9);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-9, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawAmmoPacks() {
  for (const pack of roomRuntimeState.ammoPacks) {
    const p = worldToScreen(pack.x, pack.y);
    const alpha = getAmmoPackAlpha(pack);

    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.arc(
      p.x,
      p.y,
      z(pack.radius),
      0,
      Math.PI * 2
    );

    ctx.fillStyle = LCD_BG_LIGHT;
    ctx.fill();

    ctx.strokeStyle = LCD_INK;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = LCD_INK;

    ctx.font = "11px monospace";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (pack.type === POWERUP_REPAIR) {
      drawRepairPackIcon(p.x, p.y);
    } else {
      ctx.fillText("30", p.x, p.y);
    }

    ctx.restore();
  }
}

function drawBullets() {
  for (const bullet of roomRuntimeState.bullets) {
    const p = worldToScreen(
      bullet.x,
      bullet.y
    );

    ctx.fillStyle = bullet.color;

    ctx.beginPath();

    ctx.arc(
      p.x,
      p.y,
      z(bullet.radius),
      0,
      Math.PI * 2
    );

    ctx.fill();
  }
}

function drawServerBullets() {
  const bullets = window.GUNS_NET?.getServerBullets?.() || [];
  const ownClientId = window.GUNS_NET?.describe?.().clientId || "";

  if (!bullets.length) return;

  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = LCD_INK;

  for (const bullet of bullets) {
    if (bullet.ownerId === ownClientId) continue;

    const p = worldToScreen(
      bullet.x,
      bullet.y
    );

    ctx.beginPath();
    ctx.arc(
      p.x,
      p.y,
      z(bullet.radius || 4),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.restore();
}

function drawTrails() {
  for (const tr of roomRuntimeState.trails) {
    const p = worldToScreen(tr.x, tr.y);

    const t = tr.time / tr.life;

    ctx.save();

    ctx.globalAlpha = 0.18 * (1 - t);
    ctx.fillStyle = tr.color;

    ctx.beginPath();
    ctx.arc(
      p.x,
      p.y,
      z(tr.radius * (1 + t * 0.55)),
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
  }
}

function drawStains() {
  for (const grave of roomRuntimeState.stains) {
    const p = worldToScreen(
      grave.x,
      grave.y
    );

    const t =
      grave.time / grave.life;

    ctx.save();

    ctx.globalAlpha =
      0.9 * (1 - t);

    ctx.fillStyle = LCD_INK;
    ctx.strokeStyle = LCD_BG_LIGHT;
    ctx.lineWidth = Math.max(1, z(1.5));

    const w = z(18);
    const h = z(24);

    ctx.beginPath();
    ctx.moveTo(p.x - w / 2, p.y + h / 2);
    ctx.lineTo(p.x - w / 2, p.y - h / 4);
    ctx.quadraticCurveTo(
      p.x,
      p.y - h / 2,
      p.x + w / 2,
      p.y - h / 4
    );
    ctx.lineTo(p.x + w / 2, p.y + h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = LCD_BG;
    ctx.lineWidth = Math.max(1, z(2));

    ctx.beginPath();
    ctx.moveTo(p.x, p.y - z(6));
    ctx.lineTo(p.x, p.y + z(7));
    ctx.moveTo(p.x - z(6), p.y - z(1));
    ctx.lineTo(p.x + z(6), p.y - z(1));
    ctx.stroke();

    ctx.restore();

    if (grave.pilotName && grave.nameTime > 0) {
      drawNameLabel(
        grave.pilotName,
        p.x,
        p.y - z(28),
        grave.color,
        1.05
      );
    }
  }
}

function drawCannonBody(unit, angle, alpha = 1) {
  if (drawSpriteCannonBody(unit, angle, alpha)) {
    return;
  }

  const p = worldToScreen(unit.x, unit.y);
  const renderMetrics = getCannonRenderMetrics(unit.gunType);

  ctx.save();

  ctx.globalAlpha = alpha;

  ctx.beginPath();

  ctx.arc(
    p.x,
    p.y,
    z(unit.radiusOuter),
    0,
    Math.PI * 2
  );

  ctx.arc(
    p.x,
    p.y,
    z(unit.radiusInner + 16),
    0,
    Math.PI * 2,
    true
  );

  ctx.fillStyle = CANNON_INK;
  ctx.fill("evenodd");

  ctx.save();

  ctx.translate(p.x, p.y);
  ctx.scale(camera.scale, camera.scale);

  ctx.rotate(angle + Math.PI / 2);

  const recoil =
    unit.recoilTime > 0
      ? Math.sin(
          (unit.recoilTime / unit.recoilDuration) *
            Math.PI
        ) * 9
      : 0;

  ctx.fillStyle = CANNON_INK;

  ctx.fillRect(
    -renderMetrics.barrelWidth / 2,
    renderMetrics.barrelY + recoil,
    renderMetrics.barrelWidth,
    renderMetrics.barrelHeight
  );

  ctx.fillStyle = LCD_BG;

  ctx.fillRect(
    -renderMetrics.barrelInnerWidth / 2,
    renderMetrics.barrelY + recoil,
    renderMetrics.barrelInnerWidth,
    renderMetrics.barrelInnerHeight
  );

  ctx.beginPath();
  ctx.arc(0, 0, renderMetrics.coreRadius, 0, Math.PI * 2);
  ctx.fillStyle = LCD_BG;
  ctx.fill();

  ctx.save();

  ctx.rotate(
    Math.sin(performance.now() * renderMetrics.antennaSwingSpeed) *
      renderMetrics.antennaSwing
  );

  ctx.fillStyle = CANNON_INK;

  ctx.beginPath();
  ctx.roundRect(
    -renderMetrics.antennaWidth / 2,
    -renderMetrics.antennaHeight / 2,
    renderMetrics.antennaWidth,
    renderMetrics.antennaHeight,
    renderMetrics.antennaRadius
  );
  ctx.fill();

  ctx.restore();
  ctx.restore();
  ctx.restore();
}

function drawCannon(unit, angle) {
  drawCannonBody(unit, angle);

  drawHealthBar(unit);
  drawCannonPilotName(unit);
  drawAmmoText(unit);
}

function drawWreck(unit) {
  const angle =
    unit.wreckRepair > 0
      ? unit.repairAngle
      : performance.now() * 0.00065;

  drawCannonBody(unit, angle);
  drawFreeCannonLabel(unit);
  drawLockedCannonLabel(unit);
  drawWaitingCannonLabel(unit);

  if (unit.wreckRepair > 0) {
    const p = worldToScreen(
      unit.x,
      unit.y
    );

    const repairRatio = clamp(
      1 -
        unit.wreckRepair /
          WRECK_REPAIR_TIME,
      0,
      1
    );

    ctx.save();
    ctx.globalAlpha = HEALTH_BAR_OPACITY;

    ctx.fillStyle = LCD_BG_LIGHT;

    ctx.fillRect(
      p.x - z(35),
      p.y - z(52),
      z(70),
      z(7)
    );

    ctx.strokeStyle = CANNON_INK;

    ctx.strokeRect(
      p.x - z(35),
      p.y - z(52),
      z(70),
      z(7)
    );

    ctx.fillStyle = CANNON_INK;

    ctx.fillRect(
      p.x - z(35),
      p.y - z(52),
      z(70) * repairRatio,
      z(7)
    );

    ctx.restore();
  } else {
    drawHealthBar(unit);
  }

  drawAmmoText(unit);
}

function drawParachute(unit, p) {
  if (!unit.pilotEject) return;

  const t = Math.min(
    1,
    unit.pilotEject.time / unit.pilotEject.duration
  );

  if (t <= 0.5) return;

  const open = clamp((t - 0.5) / 0.18, 0, 1);
  const s = camera.scale;

  const px = p.x;
  const py = p.y - z(26 + 10 * open);

  ctx.save();

  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = PILOT_INK;
  ctx.fillStyle = LCD_BG_LIGHT;
  ctx.lineWidth = Math.max(1, z(2));

  ctx.beginPath();
  ctx.arc(
    px,
    py,
    z(18 * open),
    Math.PI,
    Math.PI * 2
  );
  ctx.lineTo(px + z(18 * open), py);
  ctx.lineTo(px - z(18 * open), py);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(px - z(14 * open), py + z(2));
  ctx.lineTo(p.x - z(5), p.y - z(8));
  ctx.moveTo(px + z(14 * open), py + z(2));
  ctx.lineTo(p.x + z(5), p.y - z(8));
  ctx.stroke();

  ctx.restore();
}

function drawPilot(unit) {
  const p = worldToScreen(
    unit.pilotX,
    unit.pilotY
  );

  drawParachute(unit, p);

  ctx.save();

  if (!isUserBaseRoom() && unit.pilotImmunity > 0) {
    ctx.globalAlpha = 0.22;
  }

  ctx.fillStyle = PILOT_INK;

  ctx.beginPath();

  ctx.arc(
    p.x,
    p.y,
    unit.pilotRadius * camera.scale,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.restore();

  if (unit.carriedAmmoValue > 0 || unit.carriedRepairValue > 0) {
    ctx.save();

    const ax = p.x + z(unit.pilotRadius + 10);
    const ay = p.y + z(unit.pilotRadius + 4);
    const r = z(8);

    ctx.globalAlpha =
      !isUserBaseRoom() && unit.pilotImmunity > 0 ? 0.22 : 1;

    ctx.beginPath();
    ctx.arc(ax, ay, r, 0, Math.PI * 2);
    ctx.fillStyle = LCD_BG_LIGHT;
    ctx.fill();

    ctx.strokeStyle = LCD_INK;
    ctx.lineWidth = Math.max(1, z(1.5));
    ctx.stroke();

    ctx.fillStyle = LCD_INK;
    ctx.font = `${Math.max(8, Math.round(9 * camera.scale))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (unit.carriedRepairValue > 0) {
      drawRepairPackIcon(ax, ay);
    } else {
      ctx.fillText(unit.carriedAmmoValue, ax, ay);
    }

    ctx.restore();
  }

  drawNameLabel(
    getUnitLabelName(unit),
    p.x,
    p.y - z(unit.pilotRadius + 15),
    unit.color,
    unit.pilotRadius / PILOT_RADIUS
  );

  if (unit.isPlayer && isUserBaseRoom()) {
    drawNameLabel(
      `${getPlayerGunsCoinBalance()} gs`,
      p.x,
      p.y - z(unit.pilotRadius + 32),
      unit.color,
      unit.pilotRadius / PILOT_RADIUS
    );
  } else if (unit.isPlayer && isMarketRoom()) {
    drawNameLabel(
      `${getPlayerGunsCoinBalance()} gs`,
      p.x,
      p.y - z(unit.pilotRadius + 32),
      unit.color,
      unit.pilotRadius / PILOT_RADIUS
    );
  }
}

function angleDelta(from, to) {
  let delta = to - from;

  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;

  return delta;
}

function smoothRemoteSnapshot(snapshot) {
  const id =
    snapshot.clientId ||
    snapshot.id ||
    snapshot.nick ||
    "remote";
  const x = Number(snapshot.x) || 0;
  const y = Number(snapshot.y) || 0;
  const angle = Number(snapshot.angle) || 0;
  const current = remoteRenderStates.get(id);

  if (!current) {
    const initial = {
      ...snapshot,
      id,
      x,
      y,
      angle,
      lastSeenAt: performance.now()
    };

    remoteRenderStates.set(id, initial);
    return initial;
  }

  current.x += (x - current.x) * 0.28;
  current.y += (y - current.y) * 0.28;
  current.angle += angleDelta(current.angle, angle) * 0.32;
  current.state = snapshot.state;
  current.flying = snapshot.flying;
  current.alive = snapshot.alive;
  current.nick = snapshot.nick;
  current.hp = snapshot.hp;
  current.maxHp = snapshot.maxHp;
  current.ammo = snapshot.ammo;
  current.maxAmmo = snapshot.maxAmmo;
  current.radiusOuter = snapshot.radiusOuter;
  current.radiusInner = snapshot.radiusInner;
  current.receivedAt = snapshot.receivedAt;
  current.lastSeenAt = performance.now();

  return current;
}

function pruneRemoteRenderStates(activeIds) {
  for (const [id, state] of remoteRenderStates) {
    if (!activeIds.has(id) && performance.now() - state.lastSeenAt > 1800) {
      remoteRenderStates.delete(id);
    }
  }
}

function drawRemoteCannon(snapshot) {
  const unit = {
    x: snapshot.x,
    y: snapshot.y,
    radiusOuter: Number(snapshot.radiusOuter) || 34,
    radiusInner: Number(snapshot.radiusInner) || 13,
    recoilTime: 0,
    recoilDuration: 1,
    hp: Number(snapshot.hp) || 0,
    maxHp: Number(snapshot.maxHp) || 100,
    ammo: Math.max(0, Math.floor(Number(snapshot.ammo) || 0)),
    color: LCD_INK_2
  };
  const p = worldToScreen(unit.x, unit.y);

  drawCannonBody(unit, snapshot.angle, 0.82);

  if (unit.hp > 0) {
    drawHealthBar(unit);
  }

  if (Number(snapshot.maxAmmo) > 0) {
    ctx.save();
    ctx.fillStyle = LCD_INK_2;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      unit.ammo + "/" + Math.floor(Number(snapshot.maxAmmo)),
      p.x,
      p.y + z(68)
    );
    ctx.restore();
  }

  drawNameLabel(
    snapshot.nick || "remote",
    p.x,
    p.y - z(68),
    LCD_INK_2
  );
}

function drawRemoteFootPilot(snapshot) {
  const p = worldToScreen(snapshot.x, snapshot.y);
  const baseRadius =
    snapshot.flying
      ? PILOT_RADIUS * 1.8
      : PILOT_RADIUS;
  const radius = z(baseRadius);
  const alpha = snapshot.flying ? 0.45 : 0.78;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = PILOT_INK;

  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = LCD_INK_2;
  ctx.lineWidth = Math.max(1, z(1.5));
  ctx.stroke();
  ctx.restore();

  drawNameLabel(
    snapshot.nick || "remote",
    p.x,
    p.y - radius - z(15),
    LCD_INK_2,
    snapshot.flying ? 1.12 : 1
  );
}

function drawRemotePilot(snapshot) {
  if (!snapshot || snapshot.alive === false) return;

  const rendered = smoothRemoteSnapshot(snapshot);

  if (rendered.state === "in-cannon") {
    drawRemoteCannon(rendered);
    return;
  }

  drawRemoteFootPilot(rendered);
}

function drawRemotePilots() {
  if (isUserBaseRoom()) return;

  const snapshots = window.GUNS_NET?.getRemoteSnapshots?.() || [];
  const activeIds = new Set();

  for (const snapshot of snapshots) {
    activeIds.add(
      snapshot.clientId ||
        snapshot.id ||
        snapshot.nick ||
        "remote"
    );
    drawRemotePilot(snapshot);
  }

  pruneRemoteRenderStates(activeIds);
}

function drawSmoke() {
  for (const smoke of roomRuntimeState.smokePuffs) {
    const p = worldToScreen(
      smoke.x,
      smoke.y
    );

    const t =
      smoke.time / smoke.life;

    ctx.globalAlpha =
      0.35 * (1 - t);

    ctx.fillStyle = LCD_INK_2;

    ctx.beginPath();

    ctx.arc(
      p.x,
      p.y - z(t * 58),
      z(smoke.radius + t * 18),
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.globalAlpha = 1;
  }
}

function drawRearSmoke() {
  for (const smoke of roomRuntimeState.rearSmokePuffs) {
    const p = worldToScreen(
      smoke.x,
      smoke.y
    );

    const t =
      smoke.time / smoke.life;

    ctx.globalAlpha =
      0.24 * (1 - t);

    ctx.fillStyle = smoke.color;

    ctx.beginPath();

    ctx.arc(
      p.x,
      p.y,
      z(smoke.radius + t * 3),
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.globalAlpha = 1;
  }
}

function drawExplosions() {
  for (const ex of roomRuntimeState.explosions) {
    const p = worldToScreen(
      ex.x,
      ex.y
    );

    const t =
      ex.time / ex.life;

    const r =
      20 + t * 60;

    ctx.globalAlpha = 1 - t;

    ctx.strokeStyle = LCD_INK;

    ctx.lineWidth = 4;

    ctx.beginPath();

    ctx.arc(
      p.x,
      p.y,
      z(r),
      0,
      Math.PI * 2
    );

    ctx.stroke();

    ctx.beginPath();

    ctx.arc(
      p.x,
      p.y,
      z(r * 0.45),
      0,
      Math.PI * 2
    );

    ctx.stroke();

    ctx.globalAlpha = 1;
  }
}

function drawScoreboardPilotIcon(x, y) {
  ctx.save();
  ctx.fillStyle = LCD_INK;

  ctx.beginPath();
  ctx.arc(x, y + 6, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawScoreboardCannonIcon(x, y) {
  ctx.save();
  ctx.strokeStyle = LCD_INK;
  ctx.fillStyle = LCD_INK;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(x - 3, y + 7, 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y + 5);
  ctx.lineTo(x + 9, y - 1);
  ctx.stroke();

  ctx.restore();
}

function drawScoreboardSkullIcon(x, y) {
  ctx.save();
  ctx.strokeStyle = LCD_INK;
  ctx.fillStyle = LCD_INK;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(x - 7, y + 12);
  ctx.lineTo(x + 7, y);
  ctx.moveTo(x - 7, y);
  ctx.lineTo(x + 7, y + 12);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y + 5, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = LCD_PANEL;
  ctx.beginPath();
  ctx.arc(x - 2, y + 4, 1.3, 0, Math.PI * 2);
  ctx.arc(x + 2, y + 4, 1.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSpriteCannonBody(unit, angle, alpha = 1) {
  const spriteRender = getCannonSpriteRender(unit.gunType);

  if (!spriteRender) return false;

  const p = worldToScreen(unit.x, unit.y);
  const bodyConfig = spriteRender.bodyConfig;
  const turretConfig = spriteRender.turretConfig;
  const bodyRadiusPx = Number(bodyConfig.radiusPx) || 207;
  const spriteScale = unit.radiusOuter / bodyRadiusPx;
  const bodyPivotX = Number(bodyConfig.pivotX) || 256;
  const bodyPivotY = Number(bodyConfig.pivotY) || 256;
  const turretPivotX = Number(turretConfig.pivotX) || 256;
  const turretPivotY = Number(turretConfig.pivotY) || 401;
  const recoilDistance = Number(turretConfig.recoilDistance) || 9;
  const bodySprite = getScaledSprite(
    spriteRender.body,
    spriteRender.bodySrc,
    bodyConfig,
    spriteScale
  );
  const turretSprite = getScaledSprite(
    spriteRender.turret,
    spriteRender.turretSrc,
    turretConfig,
    spriteScale
  );
  const recoil =
    unit.recoilTime > 0
      ? Math.sin(
          (unit.recoilTime / unit.recoilDuration) *
            Math.PI
        ) * recoilDistance
      : 0;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.translate(p.x, p.y);
  ctx.scale(camera.scale, camera.scale);

  ctx.drawImage(
    bodySprite,
    -bodyPivotX * spriteScale,
    -bodyPivotY * spriteScale
  );

  ctx.save();
  ctx.rotate(angle + Math.PI / 2);
  ctx.translate(0, recoil);
  ctx.drawImage(
    turretSprite,
    -turretPivotX * spriteScale,
    -turretPivotY * spriteScale
  );
  ctx.restore();
  ctx.restore();

  return true;
}

function drawScoreboard() {
  ctx.save();

  ctx.font = "14px monospace";

  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const serverRows = window.GUNS_NET?.getScoreboardRows?.();
  const sorted =
    serverRows && serverRows.length > 0
      ? serverRows.map(row => ({
          id: row.id,
          displayName: getScoreboardDisplayName(row),
          color: getServerScoreboardRowColor(row),
          score: row.score || 0
        }))
      : units
          .filter(unit => !unit.isCannonOnly && !isUnitHidden(unit))
          .sort((a, b) => b.score - a.score);

  const panelX = 12;
  const panelY = 12;
  const panelW = 244;
  const versionY = panelY + 10;
  const headerY = panelY + 32;
  const separatorY = panelY + 54;
  const rowsStartY = panelY + 62;
  const rowH = 22;
  const panelHeight = 70 + sorted.length * rowH;

  ctx.fillStyle = LCD_PANEL;

  ctx.fillRect(panelX, panelY, panelW, panelHeight);

  ctx.strokeStyle = LCD_INK;
  ctx.lineWidth = 1;

  ctx.strokeRect(panelX, panelY, panelW, panelHeight);

  ctx.fillStyle = SKIN.headerShade;
  ctx.fillRect(panelX + 1, headerY - 6, panelW - 2, 24);

  ctx.strokeStyle = LCD_INK;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(panelX + 8, separatorY);
  ctx.lineTo(panelX + panelW - 8, separatorY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = LCD_INK;
  ctx.font = "12px monospace";
  ctx.textAlign = "left";
  ctx.fillText(
    "v" + GAME_VERSION,
    panelX + 12,
    versionY
  );

  ctx.textAlign = "right";
  ctx.fillText(
    "FPS " + (perfLastFps ? perfLastFps.toFixed(1) : "--"),
    panelX + panelW - 12,
    versionY
  );

  ctx.font = "14px monospace";
  ctx.textAlign = "left";
  ctx.fillText(
    text("scoreboard.rank"),
    panelX + 12,
    headerY
  );

  ctx.fillText(
    text("scoreboard.pilot"),
    panelX + 40,
    headerY
  );

  ctx.textAlign = "right";
  ctx.fillText(
    text("scoreboard.score"),
    panelX + panelW - 12,
    headerY
  );

  for (let i = 0; i < sorted.length; i++) {
    const unit = sorted[i];
    const targetY = rowsStartY + i * rowH;
    const currentY =
      scoreboardRows.has(unit.id)
        ? scoreboardRows.get(unit.id)
        : targetY;

    const rowY =
      currentY + (targetY - currentY) * 0.18;

    scoreboardRows.set(unit.id, rowY);

    ctx.fillStyle = unit.color;
    ctx.textAlign = "left";
    ctx.fillText(
      i + 1,
      panelX + 12,
      rowY
    );

    ctx.fillText(
      unit.displayName || getUnitLabelName(unit),
      panelX + 40,
      rowY
    );

    ctx.textAlign = "right";
    ctx.fillText(
      Math.floor(unit.score),
      panelX + panelW - 12,
      rowY
    );
  }

  ctx.restore();
}

function getNearestPilotlessCannon(fromUnit) {
  let best = null;
  let bestD = Infinity;

  for (const cannon of units) {
    if (isUnitHidden(cannon)) continue;
    if (cannon.cannonDestroyed) continue;
    if (cannon.state !== "pilot") continue;
    if (isCannonOccupiedByRemote(cannon)) continue;

    const d = Math.hypot(
      fromUnit.pilotX - cannon.x,
      fromUnit.pilotY - cannon.y
    );

    if (d < bestD) {
      best = cannon;
      bestD = d;
    }
  }

  return best;
}

function drawPlayerCannonMarker() {
  if (player.state !== "pilot") return;

  const cannon = getNearestPilotlessCannon(player);
  if (!cannon) return;

  const p = worldToScreen(cannon.x, cannon.y);

  if (
    p.x >= 30 &&
    p.x <= window.innerWidth - 30 &&
    p.y >= 30 &&
    p.y <= window.innerHeight - 30
  ) {
    return;
  }

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  let dx = p.x - cx;
  let dy = p.y - cy;

  if (
    Math.abs(dx) < 0.001 &&
    Math.abs(dy) < 0.001
  ) {
    dx = 1;
  }

  const margin = 24;
  const scaleX =
    dx === 0
      ? Infinity
      : (window.innerWidth / 2 - margin) / Math.abs(dx);

  const scaleY =
    dy === 0
      ? Infinity
      : (window.innerHeight / 2 - margin) / Math.abs(dy);

  const scale = Math.min(scaleX, scaleY);
  const mx = cx + dx * scale;
  const my = cy + dy * scale;
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(angle);

  ctx.fillStyle = cannon.color;
  ctx.strokeStyle = LCD_BG_LIGHT;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function getLCDOverlayPattern() {
  if (lcdOverlayPattern && lcdOverlayPatternColor === LCD_INK) {
    return lcdOverlayPattern;
  }

  const patternCanvas = document.createElement("canvas");
  const patternCtx = patternCanvas.getContext("2d");

  patternCanvas.width = 1;
  patternCanvas.height = 4;
  patternCtx.fillStyle = LCD_INK;
  patternCtx.fillRect(0, 0, 1, 1);

  lcdOverlayPattern = ctx.createPattern(patternCanvas, "repeat");
  lcdOverlayPatternColor = LCD_INK;

  return lcdOverlayPattern;
}

function drawLCDOverlay() {
  ctx.save();

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = getLCDOverlayPattern() || LCD_INK;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  // LCD frame removed.

  // LCD vignette removed.

  ctx.restore();
}

function drawDeathBlur() {
  let strength = 0;

  for (const overlay of roomRuntimeState.deathOverlays) {
    const t = clamp(overlay.time / overlay.life, 0, 1);
    strength = Math.max(
      strength,
      1 - easeInOutSine(t) * 0.65
    );
  }

  if (strength <= 0) return;

  ctx.save();

  ctx.globalAlpha = 0.22 * strength;
  ctx.fillStyle = LCD_BG_LIGHT;
  ctx.fillRect(
    0,
    0,
    window.innerWidth,
    window.innerHeight
  );

  ctx.globalAlpha = 0.12 * strength;
  ctx.fillStyle = LCD_INK;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  ctx.restore();
}

function drawDeathOverlays() {
  for (const overlay of roomRuntimeState.deathOverlays) {
    const t = overlay.time / overlay.life;
    const alpha = 0.28 * (1 - t);

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const s = Math.min(window.innerWidth, window.innerHeight) * 0.42;

    ctx.save();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = LCD_INK;
    ctx.strokeStyle = LCD_INK;
    ctx.lineWidth = Math.max(3, s * 0.035);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // crossed bones behind skull
    ctx.save();
    ctx.translate(cx, cy + s * 0.24);
    ctx.rotate(-0.42);

    ctx.fillRect(
      -s * 0.55,
      -s * 0.055,
      s * 1.1,
      s * 0.11
    );

    for (const x of [-s * 0.58, s * 0.58]) {
      ctx.beginPath();
      ctx.arc(x, -s * 0.055, s * 0.105, 0, Math.PI * 2);
      ctx.arc(x, s * 0.055, s * 0.105, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy + s * 0.24);
    ctx.rotate(0.42);

    ctx.fillRect(
      -s * 0.55,
      -s * 0.055,
      s * 1.1,
      s * 0.11
    );

    for (const x of [-s * 0.58, s * 0.58]) {
      ctx.beginPath();
      ctx.arc(x, -s * 0.055, s * 0.105, 0, Math.PI * 2);
      ctx.arc(x, s * 0.055, s * 0.105, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // skull
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.18, s * 0.34, Math.PI, Math.PI * 2);
    ctx.lineTo(cx + s * 0.31, cy + s * 0.18);
    ctx.quadraticCurveTo(
      cx + s * 0.19,
      cy + s * 0.36,
      cx,
      cy + s * 0.36
    );
    ctx.quadraticCurveTo(
      cx - s * 0.19,
      cy + s * 0.36,
      cx - s * 0.31,
      cy + s * 0.18
    );
    ctx.closePath();
    ctx.fill();

    // eye holes and nose cut out
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,1)";

    ctx.beginPath();
    ctx.arc(cx - s * 0.13, cy - s * 0.08, s * 0.075, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.13, cy - s * 0.08, s * 0.075, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.02);
    ctx.lineTo(cx - s * 0.055, cy + s * 0.14);
    ctx.lineTo(cx + s * 0.055, cy + s * 0.14);
    ctx.closePath();
    ctx.fill();

    // teeth cut lines
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = LCD_BG;
    ctx.lineWidth = Math.max(2, s * 0.018);

    ctx.beginPath();
    ctx.moveTo(cx - s * 0.16, cy + s * 0.23);
    ctx.lineTo(cx + s * 0.16, cy + s * 0.23);
    ctx.stroke();

    for (const x of [-0.09, -0.03, 0.03, 0.09]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * x, cy + s * 0.19);
      ctx.lineTo(cx + s * x, cy + s * 0.31);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawUnit(unit) {
  if (isUnitHidden(unit)) return;

  if (unit.state === "alive") {
    drawCannon(unit, unit.turretAngle);
  } else {
    if (!unit.cannonDestroyed) {
      drawWreck(unit);
    }

    if (
      !unit.isCannonOnly &&
      !isPilotAirborne(unit)
    ) {
      drawPilot(unit);
    }
  }
}

function drawAirbornePilots() {
  for (const unit of units) {
    if (
      !isUnitHidden(unit) &&
      !unit.isCannonOnly &&
      isPilotAirborne(unit)
    ) {
      drawPilot(unit);
    }
  }
}

function drawPauseOverlay() {
  if (!paused) return;

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(
    0,
    0,
    window.innerWidth,
    window.innerHeight
  );

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font =
    "bold " +
    Math.floor(
      Math.min(window.innerWidth, window.innerHeight) * 0.12
    ) +
    "px monospace";

  ctx.fillStyle = LCD_BG_LIGHT;
  ctx.strokeStyle = LCD_INK;
  ctx.lineWidth = 6;

  ctx.strokeText(
    "PAUSED",
    window.innerWidth / 2,
    window.innerHeight / 2
  );

  ctx.fillText(
    "PAUSED",
    window.innerWidth / 2,
    window.innerHeight / 2
  );

  ctx.restore();
}

function drawModeBadge(label) {
  const sprite = getModeBadgeSprite(label);
  const width = sprite.width;
  const height = sprite.height;
  const x = window.innerWidth - 16 - width;
  const y = 16;

  ctx.drawImage(sprite, x, y);
}

function getModeBadgeSprite(label) {
  const textValue = String(label || "");
  const key = `${textValue}|${LCD_BG_LIGHT}|${LCD_INK}`;

  if (modeBadgeSpriteCache.has(key)) {
    return modeBadgeSpriteCache.get(key);
  }

  const scratch = getModeBadgeSprite.scratch ||
    (getModeBadgeSprite.scratch = document.createElement("canvas"));
  const scratchCtx = getModeBadgeSprite.ctx ||
    (getModeBadgeSprite.ctx = scratch.getContext("2d"));
  const paddingX = 8;
  const paddingY = 5;

  scratchCtx.font = "12px monospace";
  const width = Math.ceil(scratchCtx.measureText(textValue).width + paddingX * 2);
  const height = 22;
  const canvas = document.createElement("canvas");
  const spriteCtx = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  spriteCtx.font = "12px monospace";
  spriteCtx.textAlign = "right";
  spriteCtx.textBaseline = "top";
  spriteCtx.globalAlpha = 0.90;
  spriteCtx.fillStyle = LCD_BG_LIGHT;
  spriteCtx.fillRect(0, 0, width, height);
  spriteCtx.globalAlpha = 1;
  spriteCtx.strokeStyle = LCD_INK;
  spriteCtx.lineWidth = 1;
  spriteCtx.strokeRect(0.5, 0.5, width - 1, height - 1);
  spriteCtx.fillStyle = LCD_INK;
  spriteCtx.fillText(textValue, width - paddingX, paddingY);
  modeBadgeSpriteCache.set(key, canvas);

  return canvas;
}

function formatModeTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil((ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getModeWinnerLabel() {
  if (activeModeState?.winnerNick) {
    return activeModeState.winnerNick;
  }

  const winnerId = activeModeState?.winnerId;
  const winner = units.find(unit => unit.id === winnerId);

  return winner?.displayName || winnerId || "NO WINNER";
}

function drawModeStateOverlay() {
  if (!activeModeState || isUserBaseRoom()) return;

  if (
    !activeModeState.ended &&
    activeModeState.durationMs > 0 &&
    getActiveModeRule("showTimer", 0) > 0
  ) {
    return;
  }

  if (!activeModeState.ended) return;

  const panelW = Math.min(420, window.innerWidth - 36);
  const panelH = 116;
  const x = (window.innerWidth - panelW) / 2;
  const y = Math.max(70, window.innerHeight * 0.18);

  ctx.save();
  ctx.fillStyle = LCD_PANEL;
  ctx.strokeStyle = LCD_INK;
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, panelW, panelH);
  ctx.strokeRect(x, y, panelW, panelH);

  ctx.fillStyle = LCD_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 24px monospace";
  ctx.fillText("MATCH ENDED", x + panelW / 2, y + 38);

  ctx.font = "14px monospace";
  ctx.fillText(`WINNER ${getModeWinnerLabel()}`, x + panelW / 2, y + 76);
  ctx.restore();
}

function drawMultiplayerDebugOverlay() {
  if (!MULTIPLAYER_DEBUG) return;

  const state = window.GUNS_NET?.getDebugState?.() || {};
  const lines = [
    `net ${state.connected ? "on" : "off"} ${state.mode || "-"}`,
    `client ${shortDebugId(state.clientId)}`,
    `room ${state.roomId || "-"}`,
    `clients ${state.roomClientCount ?? 0}`,
    `peers ${state.peerCount ?? 0}`,
    `remote ${state.remoteSnapshotCount ?? 0}`,
    `match ${shortDebugId(state.matchId)}`,
    `state ${state.matchState || "-"}`,
    `left ${formatModeTime(state.matchRemainingMs || 0)}`
  ];
  const panelW = 278;
  const panelH = 18 + lines.length * 18;
  const x = window.innerWidth - panelW - 12;
  const y = 12;

  ctx.save();
  ctx.fillStyle = LCD_PANEL;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(x, y, panelW, panelH);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = LCD_INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, panelW, panelH);
  ctx.fillStyle = LCD_INK;
  ctx.font = "13px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + 10, y + 9 + i * 18);
  }

  ctx.restore();
}

function shortDebugId(value) {
  const textValue = String(value || "");

  if (!textValue) return "-";

  return textValue.length > 18
    ? `${textValue.slice(0, 8)}...${textValue.slice(-6)}`
    : textValue;
}

function drawFlyMode() {
  if (playerDeathPrompt.active) {
    drawModeBadge(text("mode.dead"));
    return;
  }

  if (!isPilotAirborne(player)) return;

  drawModeBadge(text("mode.fly"));
}

function getDeathPromptButtons() {
  if (!playerDeathPrompt.active) return [];

  const p = worldToScreen(player.pilotX, player.pilotY);
  const buttonW = 116;
  const buttonH = 28;
  const gap = 8;
  const groupW = buttonW * 2 + gap;
  const x = clamp(
    p.x - groupW / 2,
    12,
    window.innerWidth - groupW - 12
  );
  const y = clamp(
    p.y + z(player.pilotRadius + 26),
    52,
    window.innerHeight - buttonH - 12
  );

  return [
    {
      action: "continue",
      label: text("death.continue"),
      x,
      y,
      w: buttonW,
      h: buttonH
    },
    {
      action: "exit",
      label: text("death.exit"),
      x: x + buttonW + gap,
      y,
      w: buttonW,
      h: buttonH
    }
  ];
}

function drawDeathPromptButtons() {
  if (!playerDeathPrompt.active) return;

  const buttons = getDeathPromptButtons();
  playerDeathPrompt.buttons = buttons;

  for (const button of buttons) {
    ctx.drawImage(
      getDeathButtonSprite(
        button.label,
        button.w,
        button.h
      ),
      button.x,
      button.y
    );
  }
}

function getDeathButtonSprite(label, width = 116, height = 28) {
  const textValue = String(label || "");
  const key = `${textValue}|${width}x${height}|${LCD_BG_LIGHT}|${LCD_INK}`;

  if (deathUiSpriteCache.has(key)) {
    return deathUiSpriteCache.get(key);
  }

  const canvas = document.createElement("canvas");
  const spriteCtx = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  spriteCtx.font = "12px monospace";
  spriteCtx.textAlign = "center";
  spriteCtx.textBaseline = "middle";
  spriteCtx.globalAlpha = 0.92;
  spriteCtx.fillStyle = LCD_BG_LIGHT;
  spriteCtx.fillRect(0, 0, width, height);
  spriteCtx.globalAlpha = 1;
  spriteCtx.strokeStyle = LCD_INK;
  spriteCtx.lineWidth = 1;
  spriteCtx.strokeRect(0.5, 0.5, width - 1, height - 1);
  spriteCtx.fillStyle = LCD_INK;
  spriteCtx.fillText(
    textValue,
    width / 2,
    height / 2
  );
  deathUiSpriteCache.set(key, canvas);

  return canvas;
}

function prewarmDeathUiGraphics() {
  getModeBadgeSprite(text("mode.dead"));
  getModeBadgeSprite(text("mode.fly"));
  getDeathButtonSprite(text("death.continue"), 116, 28);
  getDeathButtonSprite(text("death.exit"), 116, 28);
}

function handleDeathPromptClick(x, y) {
  if (!playerDeathPrompt.active) return false;

  const buttons = playerDeathPrompt.buttons.length
    ? playerDeathPrompt.buttons
    : getDeathPromptButtons();
  const hit = buttons.find(button =>
    x >= button.x &&
    x <= button.x + button.w &&
    y >= button.y &&
    y <= button.y + button.h
  );

  if (hit?.action === "continue") {
    continuePlayerAfterDeath();
  } else if (hit?.action === "exit") {
    exitPlayerAfterDeath();
  } else {
    return false;
  }

  return true;
}

function getCanvasPointerPoint(e) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function drawHints() {
  if (hintMessages.length === 0) return;

  const hint = hintMessages[hintMessages.length - 1];
  const alpha = 1 - hint.time / hint.life;

  ctx.save();

  ctx.globalAlpha = Math.min(1, alpha * 1.6);
  ctx.font = "14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = LCD_INK;

  ctx.fillText(
    hint.text,
    window.innerWidth / 2,
    window.innerHeight - 54
  );

  ctx.restore();
}

function getTutorialMessageKey() {
  if (tutorial.completed) return "tutorial.ready";

  const keys = [
    "tutorial.moveToCannon",
    "tutorial.driveAndAim",
    "tutorial.breakTarget",
    "tutorial.pickAmmo",
    "tutorial.eject",
    "tutorial.fly"
  ];

  return keys[tutorial.stepIndex] || "tutorial.ready";
}

function wrapCanvasText(message, maxWidth) {
  const words = String(message).split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? line + " " + word : word;

    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);

  return lines;
}

function drawTutorialOverlay() {
  if (!isTutorialMode()) return;
  if (!tutorial.initialized) return;

  const panelW = Math.min(520, window.innerWidth - 32);
  const panelX = (window.innerWidth - panelW) / 2;
  const panelY = window.innerHeight - 128;
  const panelH = 88;

  const stepNumber =
    tutorial.completed
      ? TUTORIAL_TOTAL_STEPS
      : Math.min(tutorial.stepIndex + 1, TUTORIAL_TOTAL_STEPS);

  const title = text("tutorial.progress", {
    step: stepNumber,
    total: TUTORIAL_TOTAL_STEPS
  });

  const message = text(getTutorialMessageKey());

  ctx.save();

  ctx.fillStyle = SKIN.tutorialPanel;
  ctx.strokeStyle = LCD_INK;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = LCD_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  ctx.font = "12px monospace";
  ctx.fillText(title, window.innerWidth / 2, panelY + 12);

  ctx.font = tutorial.completed ? "bold 18px monospace" : "15px monospace";

  const lines = wrapCanvasText(message, panelW - 34);
  const lineHeight = tutorial.completed ? 22 : 19;
  const firstLineY =
    panelY + 39 + Math.max(0, 2 - lines.length) * 8;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(
      lines[i],
      window.innerWidth / 2,
      firstLineY + i * lineHeight
    );
  }

  ctx.restore();
}

function draw() {
  const isBase = isUserBaseRoom();

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  drawGrid();
  drawTrails();

  if (!isBase) {
    drawStains();

    drawAmmoPacks();

    drawSmoke();
    drawRearSmoke();
  }

  drawRoomObjects();

  if (!isBase) {
    drawBullets();
    drawServerBullets();
  }

  for (const unit of units) {
    drawUnit(unit);
  }

  if (!isBase) {
    drawExplosions();

    drawPlayerCannonMarker();

    drawAirbornePilots();
    drawRemotePilots();
  }

  drawLCDOverlay();

  if (!isBase) {
    drawScoreboard();
  }

  drawFlyMode();
  drawModeStateOverlay();
  if (!isBase) {
    drawDeathPromptButtons();
  }
  drawHints();
  drawMultiplayerDebugOverlay();
  drawTutorialOverlay();

  drawPauseOverlay();
}

function loop(now) {
  const dt = Math.min(
    (now - lastTime) / 1000,
    0.05
  );

  lastTime = now;

  if (window.GUNS_APP?.started !== false) {
    if (!arenaGraphicsPrewarmed) {
      arenaGraphicsPrewarmed = prewarmArenaGraphics();
    }

    update(dt);
    if (now - lastDomainSyncAt >= DOMAIN_SYNC_RATE_MS) {
      lastDomainSyncAt = now;
      syncDomainEntities();
    }
    sendNetworkSnapshot(now);
    draw();
    reportPerf(now);
  }

  requestAnimationFrame(loop);
}

window.addEventListener("resize", resize);

window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;

  mouse.active = true;
});

window.addEventListener("mousedown", e => {
  if (e.button === 0) {
    const pointer = getCanvasPointerPoint(e);

    if (handleDeathPromptClick(pointer.x, pointer.y)) {
      mouse.down = false;
      e.preventDefault();
      return;
    }

    if (handleTeleportClick(pointer.x, pointer.y)) {
      mouse.down = false;
      e.preventDefault();
      return;
    }

    mouse.down = true;
  }
});

window.addEventListener("mouseup", e => {
  if (e.button === 0) {
    mouse.down = false;
  }
});

function shouldIgnoreGameKeyboard(e) {
  const target = e.target;

  return (
    window.GUNS_APP?.started === false ||
    target?.tagName === "INPUT" ||
    target?.tagName === "TEXTAREA" ||
    target?.isContentEditable
  );
}

window.addEventListener("keydown", e => {
  if (shouldIgnoreGameKeyboard(e)) return;

  if (
    (e.code === "Equal" || e.code === "NumpadAdd")
  ) {
    adjustCameraZoom(1);
    e.preventDefault();
  }

  if (
    (e.code === "Minus" || e.code === "NumpadSubtract")
  ) {
    adjustCameraZoom(-1);
    e.preventDefault();
  }

  if (e.code === "Space") {
    if (isUserBaseRoom()) {
      if (!keys.space) {
        baseCursorFollowEnabled = !baseCursorFollowEnabled;
      }

      keys.space = true;
      e.preventDefault();
      return;
    }

    keys.space = true;
    e.preventDefault();
  }

  if (e.code === "Enter") {
    keys.enter = true;
    e.preventDefault();
  }

  if (e.code === "KeyZ") {
    keys.z = true;
    e.preventDefault();
  }

  if (e.code === "KeyP") {
    if (!keys.p && !isUserBaseRoom()) {
      paused = !paused;
    }

    keys.p = true;
    e.preventDefault();
  }

  if (e.code === "KeyF") {
    if (!keys.f) {
      startPlayerFlyToggle();
    }

    keys.f = true;
    e.preventDefault();
  }
});

window.addEventListener("keyup", e => {
  if (shouldIgnoreGameKeyboard(e)) return;

  if (e.code === "Space") {
    keys.space = false;
    e.preventDefault();
  }

  if (e.code === "Enter") {
    keys.enter = false;
    e.preventDefault();
  }

  if (e.code === "KeyZ") {
    keys.z = false;
    e.preventDefault();
  }

  if (e.code === "KeyP") {
    keys.p = false;
    e.preventDefault();
  }

  if (e.code === "KeyF") {
    keys.f = false;
    e.preventDefault();
  }
});

window.addEventListener("blur", () => {
  mouse.down = false;
  keys.space = false;
  keys.enter = false;
  keys.z = false;
  keys.p = false;
  keys.f = false;
});

resize();

for (const bot of units) {
  if (!bot.isPlayer && !bot.isCannonOnly) {
    chooseBotMode(bot);
  }
}

spawnInitialRoomPowerups();

syncDomainEntities();
applyLiveCannonFireRates();
setInterval(refreshLiveConfig, LIVE_CONFIG_REFRESH_MS);

requestAnimationFrame(loop);
