(function () {
  let socket = null;
  let clientId = "";
  let roomId = "";
  let nick = "";
  let seq = 0;
  let serverArena = null;
  const peers = new Map();
  const remoteSnapshots = new Map();
  const listeners = new Map();

  function emit(type, payload) {
    const handlers = listeners.get(type);
    if (!handlers) return;

    for (const handler of handlers) {
      handler(payload);
    }
  }

  function getDefaultUrl() {
    const configured =
      window.GUNS_CONFIG?.multiplayer?.localWebSocketUrl ||
      "ws://127.0.0.1:3000/ws";
    if (!canUseLocalEndpoint(configured)) return "";

    const url = new URL(configured);

    url.searchParams.set("room", roomId || "main");
    url.searchParams.set("nick", nick || getStoredNick());

    return url.toString();
  }

  function getStoredNick() {
    try {
      return window.GUNS_APP?.playerNick || localStorage.getItem("guns.playerNick") || "pilot";
    } catch {
      return "pilot";
    }
  }

  function getApiUrl(path) {
    const base =
      window.GUNS_CONFIG?.multiplayer?.localHttpUrl ||
      "http://127.0.0.1:3000";
    if (!canUseLocalEndpoint(base)) return "";

    return `${base}${path}`;
  }

  function canUseLocalEndpoint(rawUrl) {
    let endpoint = null;

    try {
      endpoint = new URL(rawUrl);
    } catch {
      return false;
    }

    const endpointHost = endpoint.hostname;
    const pageHost = window.location.hostname;
    const pageIsLocal =
      pageHost === "localhost" ||
      pageHost === "127.0.0.1" ||
      pageHost === "::1" ||
      pageHost === "";
    const endpointIsLocal =
      endpointHost === "localhost" ||
      endpointHost === "127.0.0.1" ||
      endpointHost === "::1";

    return pageIsLocal || !endpointIsLocal;
  }

  function send(message) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  function apiFetch(path, options = {}) {
    const url = getApiUrl(path);

    if (!url) {
      return Promise.resolve(null);
    }

    return fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    })
      .then((response) =>
        response.json().then((data) => ({
          ok: response.ok,
          status: response.status,
          data
        }))
      )
      .catch(() => null);
  }

  function handleMessage(event) {
    let message = null;

    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (message.type === "welcome") {
      clientId = message.clientId || "";
      roomId = message.roomId || roomId;
      nick = message.nick || nick;
    }

    if (message.type === "room:state" && message.room?.players) {
      peers.clear();

      for (const peer of message.room.players) {
        peers.set(peer.id, peer);
      }

      if (message.room.arena) {
        serverArena = message.room.arena;
        syncArenaSnapshots();
      }
    }

    if (message.type === "peer:left") {
      peers.delete(message.clientId);
      remoteSnapshots.delete(message.clientId);
    }

    if (message.type === "peer:snapshot" && message.from && message.snapshot) {
      remoteSnapshots.set(message.from, {
        ...message.snapshot,
        clientId: message.from,
        receivedAt: Date.now(),
        serverTime: message.serverTime || 0
      });
    }

    if ((message.type === "arena:state" || message.type === "arena") && message.arena) {
      serverArena = message.arena;
      syncArenaSnapshots();
    }

    emit(message.type, message);
    emit("message", message);
  }

  function syncArenaSnapshots() {
    if (!serverArena?.players) return;

    for (const player of serverArena.players) {
      if (player.id === clientId) continue;

      remoteSnapshots.set(player.id, {
        ...player,
        clientId: player.id,
        receivedAt: Date.now(),
        serverTime: serverArena.serverTime || 0
      });
    }
  }

  window.GUNS_NET = {
    mode: "local-only",
    connected: false,
    clientId: "",
    roomId: "",
    connect(options = {}) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        return Promise.resolve(this.describe());
      }

      nick = options.nick || getStoredNick();
      roomId = options.roomId || "main";

      const url = options.url || getDefaultUrl();

      if (!url) {
        this.mode = "public-static";
        return Promise.resolve(this.describe());
      }

      return new Promise((resolve, reject) => {
        socket = new WebSocket(url);

        socket.addEventListener("open", () => {
          this.mode = "multiplayer-client";
          this.connected = true;
          emit("open", this.describe());
          resolve(this.describe());
        });

        socket.addEventListener("message", handleMessage);

        socket.addEventListener("close", () => {
          this.connected = false;
          this.clientId = "";
          clientId = "";
          emit("close", this.describe());
        });

        socket.addEventListener("error", () => {
          this.connected = false;
          emit("error", this.describe());
          reject(new Error("GUNS multiplayer connection failed"));
        });
      });
    },
    disconnect() {
      if (socket) {
        socket.close();
      }
    },
    startAnonymousVisit(meta = {}) {
      return apiFetch("/visits/start", {
        method: "POST",
        body: JSON.stringify({
          meta
        })
      }).then((result) => result?.data || null);
    },
    getAuthSession() {
      return apiFetch("/auth/me").then((result) => result?.data || null);
    },
    checkPilot(nickValue) {
      const nickParam = encodeURIComponent(String(nickValue || "").trim());
      return apiFetch(`/pilots/check?nick=${nickParam}`).then((result) => result?.data || null);
    },
    useUnclaimedNick(nickValue, meta = {}) {
      return apiFetch("/visits/unclaimed-nick", {
        method: "POST",
        body: JSON.stringify({
          nick: nickValue,
          meta
        })
      }).then((result) => result?.data || null);
    },
    claimPilot(nickValue, passwordValue, meta = {}) {
      return apiFetch("/pilots/claim", {
        method: "POST",
        body: JSON.stringify({
          nick: nickValue,
          password: passwordValue,
          meta
        })
      }).then((result) => result?.data || null);
    },
    loginPilot(nickValue, passwordValue, meta = {}) {
      return apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          nick: nickValue,
          password: passwordValue,
          meta
        })
      }).then((result) => result?.data || null);
    },
    logout() {
      return apiFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({})
      }).then((result) => result?.data || null);
    },
    registerUser(nickValue) {
      const cleanNick = String(nickValue || getStoredNick()).trim();

      if (!cleanNick) {
        return Promise.resolve(null);
      }

      return apiFetch("/users/register", {
        method: "POST",
        body: JSON.stringify({
          nick: cleanNick,
          clientTime: Date.now()
        })
      })
        .then((result) => result?.data || null);
    },
    on(type, handler) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }

      listeners.get(type).add(handler);

      return () => listeners.get(type)?.delete(handler);
    },
    sendInput(input) {
      return send({
        type: "input",
        seq: ++seq,
        input,
        clientTime: Date.now()
      });
    },
    sendSnapshot(snapshot) {
      return send({
        type: "client:snapshot",
        snapshot,
        clientTime: Date.now()
      });
    },
    getRemoteSnapshots(maxAge = 2000) {
      const now = Date.now();

      return Array.from(remoteSnapshots.values())
        .filter((snapshot) => now - snapshot.receivedAt <= maxAge);
    },
    getArenaState(maxAge = 2000) {
      if (!serverArena) return null;
      if (Date.now() - (serverArena.serverTime || 0) > maxAge) return null;
      return serverArena;
    },
    getScoreboardRows() {
      return serverArena?.scoreboard || null;
    },
    ping() {
      return send({
        type: "ping",
        clientTime: Date.now()
      });
    },
    applySnapshot() {},
    describe() {
      return {
        mode: this.mode,
        connected: this.connected,
        clientId,
        roomId,
        nick,
        peerCount: peers.size,
        peers: Array.from(peers.values()),
        remoteSnapshots: this.getRemoteSnapshots(),
        arena: this.getArenaState(),
        readyForServerAdapter: true
      };
    }
  };
})();
