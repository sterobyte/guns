(function () {
  function createRoomRuntimeState(roomId = "") {
    return {
      roomId,
      bullets: [],
      ammoPacks: [],
      explosions: [],
      smokePuffs: [],
      rearSmokePuffs: [],
      trails: [],
      stains: [],
      deathOverlays: []
    };
  }

  window.GUNS_ROOM_SESSION = {
    createRoomRuntimeState
  };
})();
