(function () {
  const state = {
    running: false,
    raf: 0,
    lastTime: 0,
    dpr: 1,
    width: 0,
    height: 0,
    cameraX: 0,
    pointerActive: false,
    pointerX: 0,
    pointerY: 0,
    completed: false,
    player: {
      x: 64,
      y: 0,
      radius: 7,
      speed: 260
    },
    gates: [
      { x: 900, open: 0 },
      { x: 1850, open: 0 },
      { x: 3400, open: 0 }
    ]
  };

  const world = {
    left: 48,
    right: 4980,
    corridorTop: -42,
    corridorBottom: 42,
    corridorEnd: 3600,
    roomSize: 1260,
    roomX: 3600,
    roomY: -630,
    cannonX: 4230,
    cannonY: 0
  };

  function start() {
    if (state.running) return;

    const screen = getScreen();
    const canvas = getCanvas();

    if (!screen || !canvas) return;

    state.running = true;
    state.lastTime = 0;
    resetLesson();
    copyStartAccent();

    window.GUNS_APP.mode = "tutorial";
    window.GUNS_APP.started = false;
    document.getElementById("start-screen")?.classList.add("hidden");
    screen.classList.remove("hidden");
    hidePopup();
    window.GUNS_I18N?.apply(screen);
    resize();

    state.raf = requestAnimationFrame(loop);
  }

  function stop() {
    state.running = false;
    cancelAnimationFrame(state.raf);
    getScreen()?.classList.add("hidden");
    hidePopup();

    window.GUNS_APP.mode = "game";
    window.GUNS_APP.started = false;
    document.getElementById("start-screen")?.classList.remove("hidden");
  }

  function resetLesson() {
    state.cameraX = 0;
    state.pointerActive = false;
    state.completed = false;
    state.player.x = world.left + 34;
    state.player.y = 0;
    state.gates.forEach(gate => {
      gate.open = 0;
    });
  }

  function loop(now) {
    if (!state.running) return;

    const dt = Math.min((now - (state.lastTime || now)) / 1000, 0.05);
    state.lastTime = now;

    update(dt);
    draw();
    state.raf = requestAnimationFrame(loop);
  }

  function update(dt) {
    for (const gate of state.gates) {
      if (state.player.x > gate.x - 165) {
        gate.open = Math.min(1, gate.open + dt * 1.5);
      }
    }

    if (state.pointerActive && !state.completed) {
      movePlayerTowardPointer(dt);
    }

    const viewWorldW = state.width / getScale();
    const cameraTarget = state.player.x - viewWorldW * 0.34;
    const maxCamera = Math.max(0, world.right - viewWorldW + 90);
    state.cameraX = lerp(
      state.cameraX,
      clamp(cameraTarget, 0, maxCamera),
      1 - Math.pow(0.001, dt)
    );

    if (!state.completed && state.player.x > world.roomX + world.roomSize * 0.5) {
      state.completed = true;
      showPopup();
    }
  }

  function movePlayerTowardPointer(dt) {
    const target = clampToWalkable({
      x: state.pointerX,
      y: state.pointerY
    });
    const player = state.player;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 1) return;

    const step = Math.min(distance, player.speed * dt);
    const next = clampToWalkable({
      x: player.x + dx / distance * step,
      y: player.y + dy / distance * step
    });

    for (const gate of state.gates) {
      if (gate.open < 0.55 && player.x < gate.x && next.x > gate.x - player.radius) {
        next.x = gate.x - player.radius;
      }
    }

    player.x = next.x;
    player.y = next.y;
  }

  function clampToWalkable(point) {
    const player = state.player;
    const roomLeft = world.roomX;
    const roomRight = world.roomX + world.roomSize;
    const roomTop = world.roomY;
    const roomBottom = world.roomY + world.roomSize;
    const x = clamp(point.x, world.left + player.radius, roomRight - player.radius);

    if (x >= roomLeft) {
      return {
        x,
        y: clamp(point.y, roomTop + player.radius, roomBottom - player.radius)
      };
    }

    return {
      x,
      y: clamp(point.y, world.corridorTop + player.radius, world.corridorBottom - player.radius)
    };
  }

  function resize() {
    const canvas = getCanvas();
    if (!canvas) return;

    state.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    canvas.style.width = state.width + "px";
    canvas.style.height = state.height + "px";
  }

  function draw() {
    const canvas = getCanvas();
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, state.width, state.height);

    const skin = getSkin();
    ctx.fillStyle = skin.roomOutside;
    ctx.fillRect(0, 0, state.width, state.height);
    drawGrid(ctx, skin);

    ctx.save();
    ctx.translate(0, state.height / 2);
    ctx.scale(getScale(), getScale());
    ctx.translate(-state.cameraX, 0);

    drawLessonSpace(ctx, skin);
    drawGates(ctx, skin);
    drawCannon(ctx, skin);
    drawCadet(ctx, skin);

    ctx.restore();
  }

  function drawGrid(ctx, skin) {
    ctx.strokeStyle = skin.gridMinor;
    ctx.lineWidth = 1;

    for (let x = 0; x <= state.width; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, state.height);
      ctx.stroke();
    }

    for (let y = 0; y <= state.height; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(state.width, y);
      ctx.stroke();
    }
  }

  function drawLessonSpace(ctx, skin) {
    const corridorTop = world.corridorTop;
    const corridorBottom = world.corridorBottom;
    const roomRight = world.roomX + world.roomSize;
    const roomBottom = world.roomY + world.roomSize;

    ctx.fillStyle = skin.roomTop;
    ctx.fillRect(world.left, corridorTop, world.corridorEnd - world.left, corridorBottom - corridorTop);
    ctx.fillRect(world.roomX, world.roomY, world.roomSize, world.roomSize);

    ctx.strokeStyle = skin.ink;
    ctx.lineWidth = 6;
    ctx.lineJoin = "miter";
    ctx.strokeRect(world.left, corridorTop, world.corridorEnd - world.left, corridorBottom - corridorTop);
    ctx.strokeRect(world.roomX, world.roomY, world.roomSize, world.roomSize);

    ctx.fillStyle = skin.soft;
    ctx.fillRect(world.left - 18, corridorTop, 18, corridorBottom - corridorTop);
    ctx.fillRect(roomRight, world.roomY, 18, world.roomSize);

    ctx.strokeStyle = skin.gridMajor;
    ctx.lineWidth = 1;
    for (let x = world.left + 40; x < roomRight; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, corridorTop);
      ctx.lineTo(x, corridorBottom);
      ctx.stroke();
    }

    for (let y = world.roomY + 42; y < roomBottom; y += 42) {
      ctx.beginPath();
      ctx.moveTo(world.roomX, y);
      ctx.lineTo(roomRight, y);
      ctx.stroke();
    }
  }

  function drawGates(ctx, skin) {
    for (const gate of state.gates) {
      const gap = lerp(0, 112, easeOutCubic(gate.open));
      const center = (world.corridorTop + world.corridorBottom) / 2;
      const topEnd = center - gap / 2;
      const bottomStart = center + gap / 2;

      ctx.fillStyle = skin.ink;
      drawGateSegment(ctx, gate.x, world.corridorTop - 7, topEnd + 7);
      drawGateSegment(ctx, gate.x, bottomStart, world.corridorBottom + 7);
    }
  }

  function drawGateSegment(ctx, x, y1, y2) {
    const height = Math.max(0, y2 - y1);

    if (height < 0.5) return;

    ctx.fillRect(x - 8, y1, 16, height);
  }

  function drawCannon(ctx, skin) {
    const x = world.cannonX;
    const y = world.cannonY;
    const radiusOuter = 34;
    const radiusInner = 13;
    const angle = 0;

    ctx.save();
    ctx.translate(x, y);

    ctx.beginPath();
    ctx.arc(0, 0, radiusOuter, 0, Math.PI * 2);
    ctx.arc(0, 0, radiusInner + 16, 0, Math.PI * 2, true);
    ctx.fillStyle = skin.ink;
    ctx.fill("evenodd");

    ctx.save();
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = skin.ink;
    ctx.fillRect(-5, -85, 10, 95);
    ctx.fillStyle = skin.roomTop;
    ctx.fillRect(-2, -85, 4, 62);

    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fillStyle = skin.roomTop;
    ctx.fill();

    ctx.save();
    ctx.rotate(Math.sin(performance.now() * 0.003) * 0.25);
    ctx.fillStyle = skin.ink;
    ctx.roundRect(-4, -14, 8, 28, 4);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    ctx.restore();
  }

  function drawCadet(ctx, skin) {
    const player = state.player;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = skin.ink;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawNameLabel(ctx, getTutorialPilotName(), player.x, player.y - player.radius - 15, skin.ink, 1);
  }

  function drawNameLabel(ctx, text, x, y, color, scale = 1) {
    ctx.save();
    ctx.font = `${Math.round(12 * scale)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = getSkin().roomTop;
    ctx.fillStyle = color;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function getTutorialPilotName() {
    return document.getElementById("pilot-nick")?.value || "visitor-0000";
  }

  function showPopup() {
    document.getElementById("tutorial-popup")?.classList.remove("hidden");
  }

  function hidePopup() {
    document.getElementById("tutorial-popup")?.classList.add("hidden");
  }

  function copyStartAccent() {
    const startScreen = document.getElementById("start-screen");
    const tutorialScreen = getScreen();
    if (!startScreen || !tutorialScreen) return;

    const accent = getComputedStyle(startScreen)
      .getPropertyValue("--start-accent")
      .trim();

    if (accent) {
      tutorialScreen.style.setProperty("--start-accent", accent);
    }
  }

  function getScale() {
    return clamp(Math.min(state.width / 760, state.height / 420), 0.72, 1.16);
  }

  function getSkin() {
    const visual = window.GUNS_CONFIG?.visual;
    const skinId = visual?.activeSkin || "lcd";
    return visual?.skins?.[skinId] || visual?.skins?.lcd || {
      roomOutside: "#223018",
      roomTop: "#bdd08a",
      roomMiddle: "#a9bd78",
      gridMinor: "rgba(31, 43, 22, 0.08)",
      gridMajor: "rgba(31, 43, 22, 0.14)",
      ink: "#1f2b16",
      ink2: "#33451f",
      soft: "rgba(31, 43, 22, 0.32)"
    };
  }

  function onPointerMove(event) {
    if (!state.running || state.completed) return;

    const point = screenToWorld(event.clientX, event.clientY);
    state.pointerActive = true;
    state.pointerX = point.x;
    state.pointerY = point.y;
  }

  function screenToWorld(x, y) {
    const scale = getScale();
    return {
      x: x / scale + state.cameraX,
      y: (y - state.height / 2) / scale
    };
  }

  function getScreen() {
    return document.getElementById("tutorial-screen");
  }

  function getCanvas() {
    return document.getElementById("tutorial-canvas");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    const k = clamp(t, 0, 1) - 1;
    return k * k * k + 1;
  }

  window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("tutorial-exit")?.addEventListener("click", stop);
    document.getElementById("tutorial-next")?.addEventListener("click", () => {});
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onPointerMove);
  });

  window.GUNS_TUTORIAL = {
    start,
    stop
  };
})();
