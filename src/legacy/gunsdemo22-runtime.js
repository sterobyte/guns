const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const blurCanvas = document.createElement("canvas");
const blurCtx = blurCanvas.getContext("2d");

const gridSize = 40;

const ROOM_RADIUS = 1200;
const ROOM_WIDTH = ROOM_RADIUS * 2;
const ROOM_HEIGHT = ROOM_RADIUS * 2;
const ROOM_LEFT = -ROOM_RADIUS;
const ROOM_RIGHT = ROOM_RADIUS;
const ROOM_TOP = -ROOM_RADIUS;
const ROOM_BOTTOM = ROOM_RADIUS;
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

applySkinPalette(SKIN);
const GAME_VERSION =
  window.GUNS_CONFIG?.project?.version ||
  "0.0.1";
const HEALTH_BAR_OPACITY =
  window.GUNS_CONFIG?.render?.healthBarOpacity ??
  0.5;

function text(key, params) {
  return window.GUNS_I18N?.t?.(key, params) || key;
}

const bullets = [];
const ammoPacks = [];
const explosions = [];
const smokePuffs = [];
const rearSmokePuffs = [];
const trails = [];
const stains = [];
const deathOverlays = [];
const hintMessages = [];
const scoreboardRows = new Map();
const remoteRenderStates = new Map();
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

const KNOCKBACK_TIME = 0.75;
const KNOCKBACK_DISTANCE = 170;

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
const GRAVE_NAME_TRIGGER_RADIUS = 32;
const GRAVE_NAME_SHOW_TIME = 1;

const CANNON_TYPE_CONFIG = {
  autogun: {
    maxAmmo: AMMO_MAX,
    entryScoreRequired: 0
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
  z: false,
  p: false,
  f: false
};

let paused = false;
let cameraUserZoom = CAMERA_ZOOM_MIN;

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

const TUTORIAL_TOTAL_STEPS = 6;

function isTutorialMode() {
  return window.GUNS_APP?.mode === "tutorial";
}

function getCameraBaseScale() {
  return CAMERA_BASE_SCALE * cameraUserZoom;
}

function adjustCameraZoom(direction) {
  cameraUserZoom = clamp(
    cameraUserZoom + direction * CAMERA_ZOOM_STEP,
    CAMERA_ZOOM_MIN,
    CAMERA_ZOOM_MAX
  );
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

  return {
    id,
    pilotEntityId: id,
    cannonEntityId: `${id}-autogun`,
    isPlayer,
    isCannonOnly: false,

    state: "pilot",

    x,
    y,

    radiusOuter: 34,
    radiusInner: 13,

    speed,

    slowdownRadius: isPlayer ? 220 : 0,
    stopRadius: isPlayer ? 50 : 0,

    moveAngle: 0,
    lastMoveVx: 0,
    lastMoveVy: 0,
    turretAngle: 0,

    repairAngle: 0,
    repairSpinDir: 1,

    fireCooldown: 0,
    fireRate: isPlayer ? 0.12 : 0.35,
    recoilTime: 0,
    recoilDuration: 0.085,

    color,

    hp: 100,
    maxHp: 100,
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
    entryScoreRequired: cannonConfig.entryScoreRequired,
    entryLocked: false,
    damageMultiplier:
      1
  };
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
  false
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
  false
);

const autoGun2 = makeUnit(
  "autogun2",
  520,
  0,
  GREEN_COLOR,
  0,
  false
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

function syncDomainEntities() {
  pilots.length = 0;
  cannons.length = 0;
  pilotUnitById.clear();
  cannonUnitById.clear();

  const occupantByCannonId = new Map();

  for (const unit of units) {
    if (unit.tutorialHidden) continue;

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
    if (unit.tutorialHidden) continue;

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
          occupantByCannonId.get(unit.cannonEntityId) || null,
        free:
          unit.state === "pilot" &&
          !unit.cannonDestroyed &&
          unit.wreckRepair <= 0 &&
          unit.hp > 0
      });
    }
  }
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
  bullets,
  ammoPacks,
  explosions,
  smokePuffs,
  rearSmokePuffs,
  trails,
  stains,
  deathOverlays,
  hintMessages,
  skin: SKIN,
  skins: window.GUNS_CONFIG?.visual?.skins || { lcd: SKIN },
  setActiveSkin,
  getActiveSkin: () => SKIN,
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
  unit.pilotX = ROOM_RIGHT - 80;
  unit.pilotY = ROOM_BOTTOM - 80;
  unit.x = ROOM_RIGHT - 80;
  unit.y = ROOM_BOTTOM - 80;
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

  bullets.length = 0;
  ammoPacks.length = 0;
  explosions.length = 0;
  smokePuffs.length = 0;
  rearSmokePuffs.length = 0;
  trails.length = 0;
  stains.length = 0;
  deathOverlays.length = 0;
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

const collisionLocks = new Set();

function resize() {
  const dpr = window.devicePixelRatio || 1;

  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;

  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function clampToRoomPoint(obj, radius = 0) {
  const maxDistance = Math.max(0, ROOM_RADIUS - radius);
  const d = Math.hypot(obj.x, obj.y);

  if (d <= maxDistance || d === 0) return;

  obj.x = (obj.x / d) * maxDistance;
  obj.y = (obj.y / d) * maxDistance;
}

function isOutsideRoom(x, y, margin = 0) {
  return Math.hypot(x, y) > ROOM_RADIUS + margin;
}

function clampPointToRoom(x, y, radius = 0) {
  const point = { x, y };
  clampToRoomPoint(point, radius);
  return point;
}

function randomPointInRoom(padding = 0) {
  const maxDistance = Math.max(0, ROOM_RADIUS - padding);
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * maxDistance;

  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance
  };
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
  const halfW = window.innerWidth / 2 / camera.scale;
  const halfH = window.innerHeight / 2 / camera.scale;
  const visibleRadius =
    Math.hypot(halfW, halfH) -
    CAMERA_WALL_OVERSCAN / camera.scale;

  if (visibleRadius >= ROOM_RADIUS) {
    camera.x = 0;
    camera.y = 0;
    return;
  }

  const maxCameraDistance = ROOM_RADIUS - Math.max(0, visibleRadius);
  const d = Math.hypot(camera.x, camera.y);

  if (d > maxCameraDistance && d > 0) {
    camera.x = (camera.x / d) * maxCameraDistance;
    camera.y = (camera.y / d) * maxCameraDistance;
  }

  if (ROOM_WIDTH <= halfW * 2 && ROOM_HEIGHT <= halfH * 2) {
    camera.y = 0;
    camera.x = 0;
  }
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
  if (unit.isCannonOnly) return [];

  return units.filter(u => {
    if (u === unit) return false;
    if (u.tutorialHidden) return false;
    if (u.isCannonOnly) return false;

    if (
      isPilotAirborne(u) &&
      unit !== player &&
      u === player &&
      player.state === "pilot"
    ) {
      return false;
    }

    return true;
  });
}

function addScore(unit, value) {
  if (!unit) return;
  if (unit.isCannonOnly) return;
  unit.score += value;
}

function updatePassiveScore(unit, dt) {
  if (unit.isCannonOnly) return;

  unit.passiveScoreTimer += dt;

  const ticks =
    Math.floor(unit.passiveScoreTimer / 0.1);

  if (ticks <= 0) return;

  addScore(unit, ticks);
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
  return deathOverlays.length > 0;
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
  return [a.id, b.id].sort().join("|");
}

function getNearestEnemy(unit) {
  let best = null;
  let bestD = Infinity;

  const self = getActivePoint(unit);

  for (const enemy of getEnemies(unit)) {
    const d = distance(self, getActivePoint(enemy));

    if (d < bestD) {
      best = enemy;
      bestD = d;
    }
  }

  return best;
}

function fireBullet(owner, angle) {
  if (owner.state !== "alive") return;
  if (owner.ammo <= 0) return;

  const perpX = Math.cos(angle + Math.PI / 2);
  const perpY = Math.sin(angle + Math.PI / 2);

  const makeBullet = (offset) => {
    bullets.push({
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
      color: owner.color,

      damage:
        10 * owner.damageMultiplier
    });
  };

  owner.recoilTime = owner.recoilDuration;

  makeBullet(0);

  owner.ammo = Math.max(0, owner.ammo - 1);

  if (isTutorialMode() && owner === player) {
    tutorial.shotCount++;
  }
}

function addPowerup(x, y, type, value) {
  ammoPacks.push({
    x,
    y,
    radius: 16,
    type,
    value,
    time: 0
  });
}

function addAmmoPack(x, y, value = AMMO_PACK_VALUE) {
  addPowerup(x, y, POWERUP_AMMO, value);
}

function addRepairPack(x, y, value = REPAIR_PACK_HEAL_RATIO) {
  addPowerup(x, y, POWERUP_REPAIR, value);
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
  if (Math.random() < 0.28) {
    spawnRepairPack();
  } else {
    spawnAmmoPack();
  }
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
  dropCarriedAmmo(unit);
  dropCarriedRepair(unit);
}

function addExplosion(x, y) {
  explosions.push({
    x,
    y,
    time: 0,
    life: 0.55
  });
}

function addSmoke(x, y) {
  smokePuffs.push({
    x: x + (Math.random() - 0.5) * 14,
    y: y - 28 + (Math.random() - 0.5) * 8,

    radius: 7 + Math.random() * 8,

    time: 0,
    life: 1.55
  });
}

function addRearSmoke(unit) {
  const angle = unit.moveAngle + Math.PI;

  rearSmokePuffs.push({
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
  trails.push({
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
  stains.push({
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
  deathOverlays.push({
    time: 0,
    life: 3
  });
}

function chooseBotTarget(bot) {
  let best = null;
  let bestScore = Infinity;

  const self = getActivePoint(bot);

  for (const enemy of getEnemies(bot)) {
    if (enemy.cannonDestroyed && enemy.state !== "pilot") continue;

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
  }

  bot.aiTarget = best;
  bot.aiTargetTimer = randomRange(0.06, 0.16);
}

function chooseBotMode(bot) {
  chooseBotTarget(bot);

  const maxAmmo = getMaxAmmo(bot);
  const lowAmmo =
    bot.ammo <= Math.max(4, Math.floor(maxAmmo * 0.22));

  if (lowAmmo && ammoPacks.length > 0) {
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

  for (const pack of ammoPacks) {
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
    addScore(attacker, 50);
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

  if (victim.isPlayer) {
    addDeathOverlay();
  }

  victim.pilotDeaths++;

  if (killer && killer !== victim) {
    killer.frags++;
    killer.pilotKills++;
    addScore(killer, 100);
  }

  victim.pilotHp = 1;
  victim.pilotImmunity = PILOT_IMMUNITY_TIME;

  victim.pilotKnockback = null;
  victim.pilotEject = null;

  victim.pilotRadius = PILOT_RADIUS;
  victim.pilotFlyState = "ground";
  victim.pilotFlyTime = 0;
  victim.carriedAmmoValue = 0;
  victim.carriedRepairValue = 0;
  victim.pilotLastMoveVx = 0;
  victim.pilotLastMoveVy = 0;

  clampPilotToRoom(victim);

  victim.state = "pilot";
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
    }
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
    if (cannon.tutorialHidden) continue;
    if (cannon.cannonDestroyed) continue;
    if (cannon.cannonDestroyed) continue;
    if (cannon.state !== "pilot") continue;
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

      addScore(unit, 40);
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

function updateAmmoPickup() {
  for (let i = ammoPacks.length - 1; i >= 0; i--) {
    const pack = ammoPacks[i];

    let picked = false;

    for (const unit of units) {
      if (unit.tutorialHidden) continue;

      if (
        unit.state === "alive" &&
        distance(unit, pack) <=
          unit.radiusOuter + pack.radius
      ) {
        if (pack.type === POWERUP_AMMO) {
          if (unit.ammo >= getMaxAmmo(unit)) continue;

          unit.ammo = Math.min(
            getMaxAmmo(unit),
            unit.ammo + pack.value
          );

          addScore(unit, 40);

          if (isTutorialMode() && unit === player) {
            tutorial.ammoPicked = true;
          }
        } else if (pack.type === POWERUP_REPAIR) {
          if (unit.hp >= unit.maxHp) continue;

          unit.hp = Math.min(
            unit.maxHp,
            unit.hp + unit.maxHp * pack.value
          );
        }

        ammoPacks.splice(i, 1);

        picked = true;
        break;
      }

      if (
        unit.state === "pilot" &&
        !unit.isCannonOnly &&
        !isPilotAirborne(unit) &&
        unit.carriedAmmoValue <= 0 &&
        unit.carriedRepairValue <= 0 &&
        Math.hypot(
          unit.pilotX - pack.x,
          unit.pilotY - pack.y
        ) <= unit.pilotRadius + pack.radius
      ) {
        if (pack.type === POWERUP_AMMO) {
          unit.carriedAmmoValue = pack.value;

          if (isTutorialMode() && unit === player) {
            tutorial.ammoPicked = true;
          }
        } else if (pack.type === POWERUP_REPAIR) {
          unit.carriedRepairValue = pack.value;
        }

        ammoPacks.splice(i, 1);

        picked = true;
        break;
      }
    }

    if (picked) continue;
  }
}

function updateAmmoPacks(dt) {
  for (let i = ammoPacks.length - 1; i >= 0; i--) {
    const pack = ammoPacks[i];

    pack.time += dt;

    if (pack.time >= AMMO_PACK_LIFE_TIME + AMMO_PACK_FADE_TIME) {
      ammoPacks.splice(i, 1);
    }
  }
}

function updateAmmoSpawning(dt) {
  ammoSpawnTimer -= dt;

  if (ammoSpawnTimer <= 0) {
    spawnPowerup();

    ammoSpawnTimer = 4 + Math.random() * 3;
  }
}

function updateCannonCollisions() {
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i];
      const b = units[j];

      if (a.tutorialHidden || b.tutorialHidden) continue;
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
  if (pilotUnit.tutorialHidden || otherUnit.tutorialHidden) return;
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

function updatePilotRunover(cannonUnit, pilotUnit) {
  if (cannonUnit.tutorialHidden || pilotUnit.tutorialHidden) return;
  if (cannonUnit.cannonDestroyed) return;
  if (cannonUnit.isCannonOnly) return;
  if (pilotUnit.isCannonOnly) return;
  if (isPilotAirborne(pilotUnit)) return;

  // Only occupied/active cannon can kill by contact.
  if (cannonUnit.state !== "alive") return;
  if (pilotUnit.state !== "pilot") return;
  if (pilotUnit.pilotEject) return;
  if (pilotUnit.pilotImmunity > 0) return;

  const d = Math.hypot(
    cannonUnit.x - pilotUnit.pilotX,
    cannonUnit.y - pilotUnit.pilotY
  );

  if (
    d <=
    cannonUnit.radiusOuter +
      pilotUnit.pilotRadius
  ) {
    killPilot(pilotUnit, cannonUnit);
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];

    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    bullet.life -= dt;

    let removed = false;

    if (isOutsideRoom(bullet.x, bullet.y, bullet.radius)) {
      bullets.splice(i, 1);
      continue;
    }

    for (const target of units) {
      if (target === bullet.owner) continue;
      if (target.tutorialHidden) continue;

      if (target.state === "alive") {
        const d = Math.hypot(
          bullet.x - target.x,
          bullet.y - target.y
        );

        if (
          d <= target.radiusOuter + bullet.radius
        ) {
          target.hp = Math.max(0, target.hp - bullet.damage);
          addScore(bullet.owner, 30);

          bullets.splice(i, 1);

          removed = true;

          if (target.hp <= 0) {
            destroyCannon(target);
            bullet.owner.cannonBreaks++;
            addScore(bullet.owner, 50);
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
          addScore(bullet.owner, 30);

          if (
            !target.pilotEject &&
            target.pilotImmunity <= 0
          ) {
            killPilot(target, bullet.owner);
          }

          bullets.splice(i, 1);

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
              addScore(bullet.owner, 30);

              target.wreckRepair =
                WRECK_REPAIR_TIME *
                (1 - clamp(target.hp / target.maxHp, 0, 1));

              bullets.splice(i, 1);

              removed = true;

              break;
            }

            if (target.wreckRepair <= 0) {
              target.hp = Math.max(0, target.hp - bullet.damage);
              addScore(bullet.owner, 30);

              bullets.splice(i, 1);

              removed = true;

              if (target.hp <= 0) {
                breakEmptyCannon(target);
                bullet.owner.cannonBreaks++;
                addScore(bullet.owner, 50);
              }

              break;
            }
          }
        }
      }
    }

    if (removed) continue;

    if (bullet.life <= 0) {
      bullets.splice(i, 1);
    }
  }
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
      const valid = [t1, t2].filter(v => v > 0);

      if (valid.length > 0) {
        t = Math.min(...valid);
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

  const maxAmmo = getMaxAmmo(bot);
  const lowAmmo =
    bot.ammo <= Math.max(2, Math.floor(maxAmmo * 0.10));

  if (lowAmmo && ammoPacks.length > 0) {
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
    if (cannon.tutorialHidden) continue;
    if (cannon.cannonDestroyed) continue;
    if (cannon.state !== "pilot") continue;
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

  for (const enemy of getEnemies(bot)) {
    if (enemy.state !== "alive") continue;
    if (enemy.cannonDestroyed) continue;

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
  }

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
  if (player.pilotImmunity > 0) {
    player.pilotImmunity = Math.max(
      0,
      player.pilotImmunity - dt
    );
  }

  if (player.state === "alive") {
    if (keys.z) {
      keys.z = false;
      startPlayerExitEject();
      return;
    }

    const inKnockback =
      updateKnockback(player, dt);

    if (!inKnockback && mouse.active) {
      const target =
        screenToWorld(mouse.x, mouse.y);

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
    }

    camera.x = player.x;
    camera.y = player.y;

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
      !ejecting &&
      !pilotKnock &&
      mouse.active
    ) {
      const target =
        screenToWorld(mouse.x, mouse.y);

      movePilotToward(
        player,
        target,
        dt,
        PILOT_STOP_RADIUS
      );
    }

    camera.x = player.pilotX;
    camera.y = player.pilotY;

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

      const maxAmmo = getMaxAmmo(bot);
      const lowAmmo =
        bot.ammo <= Math.max(4, Math.floor(maxAmmo * 0.22));

      if (lowAmmo && ammoPacks.length > 0) {
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
  if (player.state !== "alive") return;
  if (player.exitRequested) return;

  player.fireCooldown -= dt;

  if (
    mouse.down &&
    mouse.active &&
    player.fireCooldown <= 0
  ) {
    fireBullet(
      player,
      player.turretAngle
    );

    player.fireCooldown =
      player.fireRate;
  }
}

function updateEffects(dt) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].time += dt;

    if (
      explosions[i].time >=
      explosions[i].life
    ) {
      explosions.splice(i, 1);
    }
  }

  for (let i = smokePuffs.length - 1; i >= 0; i--) {
    smokePuffs[i].time += dt;

    if (
      smokePuffs[i].time >=
      smokePuffs[i].life
    ) {
      smokePuffs.splice(i, 1);
    }
  }

  for (let i = rearSmokePuffs.length - 1; i >= 0; i--) {
    const s = rearSmokePuffs[i];

    s.time += dt;

    s.x += s.vx * dt;
    s.y += s.vy * dt;

    if (s.time >= s.life) {
      rearSmokePuffs.splice(i, 1);
    }
  }

  for (let i = trails.length - 1; i >= 0; i--) {
    trails[i].time += dt;

    if (trails[i].time >= trails[i].life) {
      trails.splice(i, 1);
    }
  }

  for (let i = stains.length - 1; i >= 0; i--) {
    const grave = stains[i];

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
      stains.splice(i, 1);
    }
  }

  for (let i = deathOverlays.length - 1; i >= 0; i--) {
    deathOverlays[i].time += dt;

    if (deathOverlays[i].time >= deathOverlays[i].life) {
      deathOverlays.splice(i, 1);
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

function update(dt) {
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

  updatePlayer(dt);

  for (const bot of units) {
    if (bot.tutorialHidden) continue;
    if (isTutorialMode()) continue;

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

  for (const unit of units) {
    unit.recoilTime = Math.max(
      0,
      unit.recoilTime - dt
    );

    updatePostEjectBrake(unit, dt);
    updateWreckRepair(unit, dt);
    tryEnterRepairedCannon(unit);
    updateHealthRegen(unit, dt);
  }

  updateRearSmoke(dt);
  updateMovementTrails();

  updatePlayerShooting(dt);

  if (!isTutorialMode()) {
    updateAmmoSpawning(dt);
  }

  updateAmmoPacks(dt);
  updateAmmoPickup();

  updateBullets(dt);

  if (isTutorialMode()) {
    updateTutorial(dt);
  }

  clampUnitsToRoom();

  updateEffects(dt);
}

function drawGrid() {
  ctx.fillStyle = SKIN.roomOutside;
  ctx.fillRect(
    0,
    0,
    window.innerWidth,
    window.innerHeight
  );

  const topLeft = worldToScreen(ROOM_LEFT, ROOM_TOP);
  const bottomRight = worldToScreen(ROOM_RIGHT, ROOM_BOTTOM);
  const center = worldToScreen(0, 0);
  const arenaRadius = z(ROOM_RADIUS);

  const grad = ctx.createLinearGradient(
    0,
    topLeft.y,
    0,
    bottomRight.y
  );

  grad.addColorStop(0, LCD_BG_LIGHT);
  grad.addColorStop(0.52, LCD_BG);
  grad.addColorStop(1, LCD_BG_DARK);

  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.arc(center.x, center.y, arenaRadius, 0, Math.PI * 2);
  ctx.fill();

  const left = ROOM_LEFT;
  const top = ROOM_TOP;
  const endX = ROOM_RIGHT;
  const endY = ROOM_BOTTOM;

  const startX =
    Math.ceil(left / gridSize) *
    gridSize;

  const startY =
    Math.ceil(top / gridSize) *
    gridSize;

  ctx.save();

  ctx.beginPath();
  ctx.arc(center.x, center.y, arenaRadius, 0, Math.PI * 2);
  ctx.clip();

  ctx.strokeStyle = SKIN.gridMinor;
  ctx.lineWidth = 1;

  ctx.beginPath();

  for (let x = startX; x <= endX; x += gridSize) {
    const p1 = worldToScreen(x, ROOM_TOP);
    const p2 = worldToScreen(x, ROOM_BOTTOM);

    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
  }

  for (let y = startY; y <= endY; y += gridSize) {
    const p1 = worldToScreen(ROOM_LEFT, y);
    const p2 = worldToScreen(ROOM_RIGHT, y);

    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
  }

  ctx.stroke();

  ctx.strokeStyle = SKIN.gridMajor;
  ctx.lineWidth = 1;

  const bigGrid = gridSize * 4;
  const bigStartX = Math.ceil(left / bigGrid) * bigGrid;
  const bigStartY = Math.ceil(top / bigGrid) * bigGrid;

  ctx.beginPath();

  for (let x = bigStartX; x <= endX; x += bigGrid) {
    const p1 = worldToScreen(x, ROOM_TOP);
    const p2 = worldToScreen(x, ROOM_BOTTOM);

    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
  }

  for (let y = bigStartY; y <= endY; y += bigGrid) {
    const p1 = worldToScreen(ROOM_LEFT, y);
    const p2 = worldToScreen(ROOM_RIGHT, y);

    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
  }

  ctx.stroke();

  ctx.fillStyle = SKIN.roomVignette;

  for (let x = startX; x <= endX; x += gridSize) {
    for (let y = startY; y <= endY; y += gridSize) {
      if (((Math.floor(x / gridSize) + Math.floor(y / gridSize)) % 4) === 0) {
        const p = worldToScreen(x, y);

        ctx.fillRect(
          p.x - 1,
          p.y - 1,
          2,
          2
        );
      }
    }
  }

  ctx.restore();

  ctx.strokeStyle = LCD_INK;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(center.x, center.y, arenaRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = LCD_BG_DARK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(center.x, center.y, Math.max(0, arenaRadius - 8), 0, Math.PI * 2);
  ctx.stroke();
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
    flying: isPilotAirborne(player),
    alive: player.pilotAlive !== false,
    hp: inCannon ? player.hp : 0,
    maxHp: inCannon ? player.maxHp : 100,
    ammo: inCannon ? player.ammo : 0,
    maxAmmo: inCannon ? getMaxAmmo(player) : 0,
    radiusOuter: player.radiusOuter,
    radiusInner: player.radiusInner,
    score: player.score || 0,
    pilotKills: player.pilotKills || 0,
    cannonBreaks: player.cannonBreaks || 0,
    pilotDeaths: player.pilotDeaths || 0,
    bots: getLocalBotNetworkSnapshots()
  };
}

function getLocalBotNetworkSnapshots() {
  return units
    .filter(unit => !unit.isPlayer && !unit.isCannonOnly && !unit.tutorialHidden)
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
    getUnitDisplayName(unit),
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
  for (const pack of ammoPacks) {
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
  for (const bullet of bullets) {
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

function drawTrails() {
  for (const tr of trails) {
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
  for (const grave of stains) {
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
  const p = worldToScreen(unit.x, unit.y);

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

  ctx.fillRect(-5, -85 + recoil, 10, 95);

  ctx.fillStyle = LCD_BG;

  ctx.fillRect(-2, -85 + recoil, 4, 62);

  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fillStyle = LCD_BG;
  ctx.fill();

  ctx.save();

  ctx.rotate(
    Math.sin(performance.now() * 0.003) * 0.25
  );

  ctx.fillStyle = CANNON_INK;

  ctx.beginPath();
  ctx.roundRect(-4, -14, 8, 28, 4);
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

  if (unit.pilotImmunity > 0) {
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
      unit.pilotImmunity > 0 ? 0.22 : 1;

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
    getUnitDisplayName(unit),
    p.x,
    p.y - z(unit.pilotRadius + 15),
    unit.color,
    unit.pilotRadius / PILOT_RADIUS
  );
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
  for (const smoke of smokePuffs) {
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
  for (const smoke of rearSmokePuffs) {
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
  for (const ex of explosions) {
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
          displayName: row.nick,
          color: getServerScoreboardRowColor(row),
          score: row.score || 0,
          pilotKills: row.pilotKills || 0,
          cannonBreaks: row.cannonBreaks || 0,
          pilotDeaths: row.pilotDeaths || 0
        }))
      : units
          .filter(unit => !unit.isCannonOnly && !unit.tutorialHidden)
          .sort(
          (a, b) => b.score - a.score
        );

  const panelX = 12;
  const panelY = 12;
  const panelW = 306;
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

  drawScoreboardPilotIcon(panelX + 154, headerY + 1);
  drawScoreboardCannonIcon(panelX + 190, headerY + 1);
  drawScoreboardSkullIcon(panelX + 226, headerY + 1);

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
      getUnitDisplayName(unit),
      panelX + 40,
      rowY
    );

    ctx.textAlign = "right";
    ctx.fillText(
      unit.pilotKills || 0,
      panelX + 154,
      rowY
    );

    ctx.fillText(
      unit.cannonBreaks || 0,
      panelX + 190,
      rowY
    );

    ctx.fillText(
      unit.pilotDeaths || 0,
      panelX + 226,
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
    if (cannon.tutorialHidden) continue;
    if (cannon.cannonDestroyed) continue;
    if (cannon.state !== "pilot") continue;

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

function drawLCDOverlay() {
  ctx.save();

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = LCD_INK;

  for (let y = 0; y < window.innerHeight; y += 4) {
    ctx.fillRect(0, y, window.innerWidth, 1);
  }

  // LCD frame removed.

  // LCD vignette removed.

  ctx.restore();
}

function drawDeathBlur() {
  let blur = 0;

  for (const overlay of deathOverlays) {
    const t = clamp(overlay.time / overlay.life, 0, 1);
    blur = Math.max(
      blur,
      7 * (1 - easeInOutSine(t) * 0.65)
    );
  }

  if (blur <= 0) return;

  if (
    blurCanvas.width !== canvas.width ||
    blurCanvas.height !== canvas.height
  ) {
    blurCanvas.width = canvas.width;
    blurCanvas.height = canvas.height;
  }

  blurCtx.setTransform(1, 0, 0, 1, 0, 0);
  blurCtx.clearRect(
    0,
    0,
    blurCanvas.width,
    blurCanvas.height
  );
  blurCtx.drawImage(canvas, 0, 0);

  ctx.save();
  ctx.filter = "blur(" + blur + "px)";
  ctx.drawImage(
    blurCanvas,
    0,
    0,
    blurCanvas.width,
    blurCanvas.height,
    0,
    0,
    window.innerWidth,
    window.innerHeight
  );
  ctx.restore();
}

function drawDeathOverlays() {
  for (const overlay of deathOverlays) {
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
  if (unit.tutorialHidden) return;

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
      !unit.tutorialHidden &&
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

function drawFlyMode() {
  if (!isPilotAirborne(player)) return;

  ctx.save();

  ctx.font = "12px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillStyle = LCD_INK;

  ctx.fillText(
    text("mode.fly"),
    window.innerWidth - 16,
    16
  );

  ctx.restore();
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
  drawGrid();

  drawTrails();

  drawStains();

  drawAmmoPacks();

  drawSmoke();
  drawRearSmoke();

  drawBullets();

  for (const unit of units) {
    drawUnit(unit);
  }

  drawExplosions();

  drawPlayerCannonMarker();

  drawAirbornePilots();
  drawRemotePilots();

  drawLCDOverlay();

  drawDeathBlur();

  drawScoreboard();

  drawFlyMode();
  drawHints();
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
    update(dt);
    syncDomainEntities();
    sendNetworkSnapshot(now);
    draw();
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
    keys.space = true;
    e.preventDefault();
  }

  if (e.code === "KeyZ") {
    keys.z = true;
    e.preventDefault();
  }

  if (e.code === "KeyP") {
    if (!keys.p) {
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

spawnPowerup();
spawnPowerup();
spawnPowerup();
spawnPowerup();

syncDomainEntities();

requestAnimationFrame(loop);
