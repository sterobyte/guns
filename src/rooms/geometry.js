(function () {
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function isPolygonRoomShape(shape) {
    return shape === "five-pointed-star" || shape === "triangle";
  }

  function clampToRoomPoint(obj, state, radius = 0) {
    if (isPolygonRoomShape(state.shape)) {
      const points = getRoomPolygonPoints(state, -radius);

      if (isPointInPolygon(obj.x, obj.y, points)) return;

      const point = closestPointOnPolygon(obj.x, obj.y, points);
      obj.x = point.x;
      obj.y = point.y;
      return;
    }

    if (state.shape === "rectangle") {
      obj.x = clamp(obj.x, state.left + radius, state.right - radius);
      obj.y = clamp(obj.y, state.top + radius, state.bottom - radius);
      return;
    }

    const maxDistance = Math.max(0, state.radius - radius);
    const d = Math.hypot(obj.x, obj.y);

    if (d <= maxDistance || d === 0) return;

    obj.x = (obj.x / d) * maxDistance;
    obj.y = (obj.y / d) * maxDistance;
  }

  function isOutsideRoom(x, y, state, margin = 0) {
    if (isPolygonRoomShape(state.shape)) {
      return !isPointInPolygon(x, y, getRoomPolygonPoints(state, margin));
    }

    if (state.shape === "rectangle") {
      return (
        x < state.left - margin ||
        x > state.right + margin ||
        y < state.top - margin ||
        y > state.bottom + margin
      );
    }

    return Math.hypot(x, y) > state.radius + margin;
  }

  function clampPointToRoom(x, y, state, radius = 0) {
    const point = { x, y };
    clampToRoomPoint(point, state, radius);
    return point;
  }

  function randomPointInRoom(state, padding = 0, randomRange) {
    const nextRandomRange =
      randomRange ||
      ((min, max) => min + Math.random() * (max - min));

    if (isPolygonRoomShape(state.shape)) {
      for (let i = 0; i < 80; i++) {
        const point = {
          x: nextRandomRange(state.left + padding, state.right - padding),
          y: nextRandomRange(state.top + padding, state.bottom - padding)
        };

        if (isPointInPolygon(point.x, point.y, getRoomPolygonPoints(state, -padding))) {
          return point;
        }
      }

      return { x: 0, y: 0 };
    }

    if (state.shape === "rectangle") {
      return {
        x: nextRandomRange(state.left + padding, state.right - padding),
        y: nextRandomRange(state.top + padding, state.bottom - padding)
      };
    }

    const maxDistance = Math.max(0, state.radius - padding);
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * maxDistance;

    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance
    };
  }

  function getRoomPolygonPoints(state, radiusOffset = 0) {
    return state.shape === "triangle"
      ? getRoomTrianglePoints(state, radiusOffset)
      : getRoomStarPoints(state, radiusOffset);
  }

  function getRoomTrianglePoints(state, radiusOffset = 0) {
    const params = state.room?.arena?.params || {};
    const radius = Math.max(1, (Number(params.radius) || state.radius) + radiusOffset);
    const rotation = ((Number(params.rotation ?? -90) || 0) * Math.PI) / 180;
    const points = [];

    for (let i = 0; i < 3; i++) {
      const angle = rotation + i * Math.PI * 2 / 3;

      points.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      });
    }

    return points;
  }

  function getRoomStarPoints(state, radiusOffset = 0) {
    const params = state.room?.arena?.params || {};
    const outerRadius = Math.max(1, Number(params.outerRadius) || state.radius);
    const innerRadius = Math.max(1, Number(params.innerRadius) || outerRadius * 0.42);
    const rotation = ((Number(params.rotation ?? -90) || 0) * Math.PI) / 180;
    const points = [];

    for (let i = 0; i < 10; i++) {
      const baseRadius = i % 2 === 0 ? outerRadius : innerRadius;
      const pointRadius = Math.max(1, baseRadius + radiusOffset);
      const angle = rotation + i * Math.PI / 5;

      points.push({
        x: Math.cos(angle) * pointRadius,
        y: Math.sin(angle) * pointRadius
      });
    }

    return points;
  }

  function isPointInPolygon(x, y, points) {
    let inside = false;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i];
      const b = points[j];
      const intersects =
        ((a.y > y) !== (b.y > y)) &&
        (x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y || 1) + a.x);

      if (intersects) inside = !inside;
    }

    return inside;
  }

  function closestPointOnPolygon(x, y, points) {
    let best = { x: 0, y: 0 };
    let bestDistance = Infinity;

    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const point = closestPointOnSegment(x, y, a, b);
      const d = Math.hypot(x - point.x, y - point.y);

      if (d < bestDistance) {
        best = point;
        bestDistance = d;
      }
    }

    return best;
  }

  function closestPointOnSegment(x, y, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq > 0
      ? clamp(((x - a.x) * dx + (y - a.y) * dy) / lengthSq, 0, 1)
      : 0;

    return {
      x: a.x + dx * t,
      y: a.y + dy * t
    };
  }

  window.GUNS_ROOM_GEOMETRY = {
    clampToRoomPoint,
    isOutsideRoom,
    clampPointToRoom,
    randomPointInRoom,
    isPolygonRoomShape,
    getRoomPolygonPoints,
    isPointInPolygon,
    closestPointOnPolygon,
    closestPointOnSegment
  };
})();
