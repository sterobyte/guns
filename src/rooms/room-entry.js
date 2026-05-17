(function () {
  const DEFAULT_ROOM_RADIUS = 1200;
  const DEFAULT_ROOM_WIDTH = DEFAULT_ROOM_RADIUS * 2;
  const DEFAULT_ROOM_HEIGHT = DEFAULT_ROOM_RADIUS * 2;

  function getRoomById(roomId) {
    const rooms = window.GUNS_SHARED_CONFIG?.rooms || {};
    return rooms[roomId] || rooms.main || null;
  }

  function getDefaultRoomId() {
    const rooms = window.GUNS_SHARED_CONFIG?.rooms || {};
    const defaultRoomId =
      window.GUNS_CONFIG?.multiplayer?.defaultRoomId || "main";

    return (
      isSelectableRoom(rooms[defaultRoomId])
        ? defaultRoomId
        : Object.values(rooms).find(isSelectableRoom)?.id ||
          defaultRoomId
    );
  }

  function isSelectableRoom(room) {
    return (
      !!room &&
      room.enabled !== false &&
      (room.published === true || window.GUNS_CONFIG?.admin?.enabled === true)
    );
  }

  function getRoomRadius(room) {
    const radius = Number(
      room?.arena?.params?.radius ??
      room?.arena?.params?.outerRadius ??
      room?.arena?.radius
    );
    return Number.isFinite(radius) && radius > 0
      ? radius
      : DEFAULT_ROOM_RADIUS;
  }

  function getRoomShape(room) {
    const shape = String(room?.arena?.shape || "circle").toLowerCase();
    return ["rectangle", "five-pointed-star", "triangle"].includes(shape)
      ? shape
      : "circle";
  }

  function getRoomWidthValue(room) {
    if (getRoomShape(room) === "rectangle") {
      const width = Number(room?.arena?.params?.width);
      return Number.isFinite(width) && width > 0 ? width : DEFAULT_ROOM_WIDTH;
    }

    return getRoomRadius(room) * 2;
  }

  function getRoomHeightValue(room) {
    if (getRoomShape(room) === "rectangle") {
      const height = Number(room?.arena?.params?.height);
      return Number.isFinite(height) && height > 0 ? height : DEFAULT_ROOM_HEIGHT;
    }

    return getRoomRadius(room) * 2;
  }

  function createRoomGeometryState(room) {
    const shape = getRoomShape(room);
    const radius = getRoomRadius(room);
    const width = getRoomWidthValue(room);
    const height = getRoomHeightValue(room);

    return {
      room,
      shape,
      radius,
      width,
      height,
      left: -width / 2,
      right: width / 2,
      top: -height / 2,
      bottom: height / 2
    };
  }

  function createRoomEntryState(roomId) {
    const activeRoom = getRoomById(roomId);
    const activeRoomId = activeRoom?.id || "main";

    return {
      activeRoomId,
      activeRoom,
      geometry: createRoomGeometryState(activeRoom),
      runtimeState: window.GUNS_ROOM_SESSION.createRoomRuntimeState(activeRoomId)
    };
  }

  window.GUNS_ROOM_ENTRY = {
    DEFAULT_ROOM_RADIUS,
    DEFAULT_ROOM_WIDTH,
    DEFAULT_ROOM_HEIGHT,
    getRoomById,
    getDefaultRoomId,
    isSelectableRoom,
    getRoomRadius,
    getRoomShape,
    getRoomWidthValue,
    getRoomHeightValue,
    createRoomGeometryState,
    createRoomEntryState
  };
})();
