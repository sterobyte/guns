(function () {
  const config = window.GUNS_PANEL_CONFIG || {};
  const api = config.api || {};
  const version = config.project?.version || "0.0.0";
  const tokenStorageKey = "guns.panel.adminToken";
  const views = {
    users: {
      title: "Users",
      load: loadUsers
    },
    devices: {
      title: "Devices",
      load: loadDevices
    },
    sessions: {
      title: "Sessions",
      load: loadSessions
    },
    objects: {
      title: "Objects",
      load: loadObjects
    },
    rooms: {
      title: "Rooms",
      load: loadRooms
    },
    modes: {
      title: "Modes",
      load: loadModes
    },
    settings: {
      title: "Settings",
      load: loadSettings
    },
    economy: {
      title: "Economy",
      load: loadEconomy
    },
    wallet: {
      title: "Wallet",
      load: loadWallet
    },
    audit: {
      title: "Audit",
      load: loadAudit
    },
    database: {
      title: "Database",
      load: loadDatabaseStatus
    },
    config: {
      title: "Config",
      load: loadConfigStatus
    }
  };

  let activeView = "users";
  let adminAccessReady = false;
  const walletFilters = {
    entityType: "",
    entityId: "",
    reason: "",
    limit: "50"
  };
  const auditFilters = {
    action: "",
    entityType: "",
    entityId: "",
    actor: "",
    limit: "50"
  };

  const navItems = Array.from(document.querySelectorAll("[data-view]"));
  const tableHead = document.getElementById("table-head");
  const tableBody = document.getElementById("table-body");
  const state = document.getElementById("server-state");
  const total = document.getElementById("metric-total");
  const online = document.getElementById("metric-online");
  const connections = document.getElementById("metric-connections");
  const uptime = document.getElementById("metric-uptime");
  const totalLabel = document.getElementById("metric-total-label");
  const onlineLabel = document.getElementById("metric-online-label");
  const connectionsLabel = document.getElementById("metric-connections-label");
  const uptimeLabel = document.getElementById("metric-uptime-label");
  const panelVersion = document.getElementById("panel-version");
  const viewTitle = document.getElementById("view-title");
  const shell = document.querySelector(".shell");
  const authGate = document.getElementById("auth-gate");
  const authInput = document.getElementById("admin-token-input");
  const authSubmit = document.getElementById("admin-token-submit");
  const authMessage = document.getElementById("admin-token-message");

  if (panelVersion) {
    panelVersion.textContent = `v${version}`;
  }

  for (const item of navItems) {
    item.addEventListener("click", () => {
      const nextView = item.dataset.view;
      if (!views[nextView]) return;
      activeView = nextView;
      renderActiveNav();
      bootPanel();
    });
  }

  authSubmit?.addEventListener("click", async () => {
    await submitAdminToken();
  });

  authInput?.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    await submitAdminToken();
  });

  async function loadActiveView() {
    viewTitle.textContent = views[activeView].title;
    setServerState(true, "Loading");

    try {
      await views[activeView].load();
      setServerState(true, "Server online");
    } catch (error) {
      if (isAdminAuthError(error)) {
        adminAccessReady = false;
        await bootPanel();
        return;
      }

      setServerState(false, "Server offline");
      renderEmpty(error.message || "Backend unavailable");
    }
  }

  async function bootPanel() {
    if (!adminAccessReady) {
      adminAccessReady = await ensureAdminAccess();
    }

    if (!adminAccessReady) {
      lockPanel("ACCESS REQUIRED");
      return;
    }

    unlockPanel();
    await loadActiveView();
  }

  async function loadUsers() {
    const data = await fetchJson(getUsersUrl());
    const users = Array.isArray(data.users) ? data.users : [];

    setMetricLabels("Total", "Online", "Connections", "Uptime");
    total.textContent = String(data.total || users.length);
    online.textContent = String(
      data.online || users.filter((user) => user.online).length
    );
    connections.textContent = String(
      data.connections ||
        users.reduce((sum, user) => sum + getActiveConnections(user), 0)
    );
    uptime.textContent = formatUptime(data.uptimeMs);

    setColumns([
      "Type",
      "Callsign",
      "Pilot ID",
      "Linked Pilot",
      "Device ID",
      "Session ID",
      "Devices",
      "Sessions",
      "Online",
      "Active",
      "Guns Coin",
      "First seen",
      "Last seen",
      "Room",
      "Actions"
    ]);

    if (users.length === 0) {
      renderEmpty("No users yet");
      return;
    }

    tableBody.textContent = "";

    for (const user of users) {
      const row = document.createElement("tr");
      row.append(
        accountStatusCell(user.status || user.kind),
        cell(user.nick || user.callsign || "-"),
        idCell(user.pilotId),
        linkedPilotCell(user),
        idListCell(user.deviceIds || user.deviceId),
        sessionListCell(user.authSessions || user.sessionIds || user.sessionId),
        cell(user.deviceCount ?? getCount(user.deviceIds, user.deviceId)),
        cell(user.sessionCount ?? getCount(user.sessionIds, user.sessionId)),
        onlineCell(user.online),
        cell(getActiveConnections(user)),
        gunsCoinCell(user),
        cell(formatDate(user.firstSeenAt)),
        cell(formatDate(user.lastSeenAt)),
        cell(user.roomId || "-"),
        actionsCell(user)
      );
      tableBody.appendChild(row);
    }
  }

  async function loadUserDetail(userId) {
    const data = await fetchJson(`${getUsersUrl()}/${encodeURIComponent(userId)}`);
    const user = data.user || {};
    const devices = Array.isArray(data.devices) ? data.devices : [];
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const linkedVisits = Array.isArray(data.linkedVisits) ? data.linkedVisits : [];
    const transactions = Array.isArray(data.walletTransactions)
      ? data.walletTransactions
      : [];

    viewTitle.textContent = `User: ${user.nick || user.id || "-"}`;
    setMetricLabels("Devices", "Sessions", "Wallet tx", "Store");
    total.textContent = String(devices.length);
    online.textContent = String(sessions.length);
    connections.textContent = String(transactions.length);
    uptime.textContent = data.userStore?.mode || "unknown";
    setColumns(["Section", "Key", "Value"]);
    tableBody.textContent = "";

    const backRow = document.createElement("tr");
    const backCell = document.createElement("td");
    const backButton = document.createElement("button");

    backCell.colSpan = 3;
    backButton.type = "button";
    backButton.className = "detail-user";
    backButton.textContent = "BACK TO USERS";
    backButton.addEventListener("click", () => loadActiveView());
    backCell.appendChild(backButton);
    backRow.appendChild(backCell);
    tableBody.appendChild(backRow);

    appendDetailRow("User", "Type", normalizeAccountStatus(user.status || user.kind));
    appendDetailRow("User", "Callsign", user.nick || user.callsign || "-");
    appendDetailRow("User", "User ID", user.id || "-");
    appendDetailRow("User", "Pilot ID", user.pilotId || "-");
    appendDetailRow("User", "Linked pilot", user.claimedNick || user.claimedPilotId || "-");
    appendDetailRow("User", "Guns Coin", gunsCoinEditor(user, async () => {
      await loadUserDetail(user.id);
    }));
    appendDetailRow("User", "First seen", formatDate(user.firstSeenAt));
    appendDetailRow("User", "Last seen", formatDate(user.lastSeenAt));
    appendDetailRow("User", "Room", user.roomId || "-");
    appendDetailRow("Admin", "Delete user", actionButton("DELETE USER", "delete-user", async () => {
      if (!window.confirm(`Delete ${user.nick || user.id}?`)) return;
      await requestAdminDelete(`${getUsersUrl()}/${encodeURIComponent(user.id)}`);
      await loadUsers();
      viewTitle.textContent = views.users.title;
    }));

    for (const device of devices) {
      appendDetailRow("Device", shortId(device.id), [
        `id=${device.id || "-"}`,
        `claimed=${device.claimedNick || device.claimedPilotId || "-"}`,
        `first=${formatDate(device.firstSeenAt)}`,
        `last=${formatDate(device.lastSeenAt)}`
      ].join(" / "));
      if (device.claimedPilotId) {
        appendDetailRow("Device action", shortId(device.id), actionButton("UNLINK DEVICE", "delete-user", async () => {
          await requestAdminDelete(`${getAdminBaseUrl()}/devices/${encodeURIComponent(device.id)}/claim`);
          await loadUserDetail(user.id);
        }));
      }
    }

    for (const session of sessions) {
      appendDetailRow("Session", shortId(session.id), [
        `device=${shortId(session.deviceId)}`,
        `created=${formatDate(session.createdAt)}`,
        `last=${formatDate(session.lastSeenAt)}`
      ].join(" / "));
      appendDetailRow("Session action", shortId(session.id), actionButton("REVOKE SESSION", "delete-user", async () => {
        await requestAdminDelete(`${getAdminBaseUrl()}/sessions/${encodeURIComponent(session.id)}`);
        await loadUserDetail(user.id);
      }));
    }

    for (const visit of linkedVisits) {
      appendDetailRow("Linked visit", visit.nick || shortId(visit.id), visit.id || "-");
    }

    for (const tx of transactions) {
      appendDetailRow("Wallet", formatDate(tx.createdAt), [
        `${tx.amount > 0 ? "+" : ""}${tx.amount || 0} gs`,
        `balance=${tx.balanceAfter ?? "-"}`,
        tx.reason || "-"
      ].join(" / "));
    }
  }

  async function loadDevices() {
    const data = await fetchJson(getUsersUrl());
    const devices = Array.isArray(data.devices) ? data.devices : [];

    setMetricLabels("Devices", "Claimed", "Anonymous", "Uptime");
    total.textContent = String(devices.length);
    online.textContent = String(devices.filter((device) => device.claimedPilotId).length);
    connections.textContent = String(devices.filter((device) => !device.claimedPilotId).length);
    uptime.textContent = formatUptime(data.uptimeMs);

    setColumns([
      "Device ID",
      "Claimed Pilot",
      "Claimed Nick",
      "Views",
      "First seen",
      "Last seen",
      "Last login",
      "Meta"
    ]);

    renderRows(devices, (device) => [
      idCell(device.id),
      idCell(device.claimedPilotId),
      cell(device.claimedNick || "-"),
      cell(device.views || 0),
      cell(formatDate(device.firstSeenAt)),
      cell(formatDate(device.lastSeenAt)),
      cell(formatDate(device.lastLoginAt)),
      jsonCell(device.meta)
    ], "No devices yet");
  }

  async function loadSessions() {
    const data = await fetchJson(api.usersUrl || `${api.baseUrl}/admin/users`);
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];

    setMetricLabels("Sessions", "Active", "Revoked", "Uptime");
    total.textContent = String(sessions.length);
    online.textContent = String(sessions.filter((session) => !session.revokedAt).length);
    connections.textContent = String(sessions.filter((session) => session.revokedAt).length);
    uptime.textContent = formatUptime(data.uptimeMs);

    setColumns([
      "Session ID",
      "Pilot ID",
      "Device ID",
      "Created",
      "Last seen",
      "Expires",
      "Revoked",
      "Meta"
    ]);

    renderRows(sessions, (session) => [
      idCell(session.id),
      idCell(session.pilotId),
      idCell(session.deviceId),
      cell(formatDate(session.createdAt)),
      cell(formatDate(session.lastSeenAt)),
      cell(session.expiresAt ? formatDate(session.expiresAt) : "permanent"),
      cell(session.revokedAt ? formatDate(session.revokedAt) : "-"),
      jsonCell(session.meta)
    ], "No sessions yet");
  }

  async function loadObjects() {
    const data = await fetchJson(api.objectsUrl || `${api.baseUrl}/api/objects`);
    const cannons = Object.values(data.objects?.cannons || {});
    const pilotWeapons = Object.values(data.objects?.pilotWeapons || {});
    const rows = [
      ...cannons.map((item) => ({ library: "gun", item })),
      ...pilotWeapons.map((item) => ({ library: "pilot weapon", item }))
    ];

    setMetricLabels("Objects", "Guns", "Pilot weapons", "Source");
    total.textContent = String(rows.length);
    online.textContent = String(cannons.length);
    connections.textContent = String(pilotWeapons.length);
    uptime.textContent = "shared";

    setColumns([
      "Library",
      "ID",
      "Type",
      "Title",
      "Description",
      "Price gs",
      "Version",
      "Damage/HP",
      "Magazine/Ammo",
      "Fire rate",
      "Fire bot",
      "Renderer"
    ]);
    renderRows(
      rows,
      ({ library, item }) => [
        cell(library),
        idCell(item.id),
        cell(item.typeId || item.kind),
        library === "pilot weapon"
          ? pilotWeaponTextCell(item, "title")
          : cell(item.title),
        library === "pilot weapon"
          ? pilotWeaponTextCell(item, "description")
          : mutedCell(item.description || "-"),
        library === "pilot weapon"
          ? pilotWeaponNumberCell(item, "priceGs", item.economy?.priceGs ?? 0)
          : cell(item.economy?.priceGs ?? "-"),
        cell(item.version),
        library === "pilot weapon"
          ? pilotWeaponNumberCell(item, "damage", item.gameplay?.damage ?? 0)
          : cell(item.gameplay?.maxHp),
        library === "pilot weapon"
          ? (
              item.typeId === "pistol"
                ? pilotWeaponNumberCell(item, "magazine", item.gameplay?.magazine ?? 1, "1")
                : mutedCell("-")
            )
          : cell(item.gameplay?.maxAmmo),
        library === "gun"
          ? fireRateCell(item, "player")
          : (
              item.typeId === "pistol"
                ? pilotWeaponNumberCell(item, "fireRate", item.gameplay?.fireRate ?? 0, "0.01")
                : mutedCell("-")
            ),
        library === "gun"
          ? fireRateCell(item, "bot")
          : mutedCell("-"),
        mutedCell(item.render?.renderer ?? "-")
      ],
      "No objects"
    );
  }

  function fireRateCell(cannon, controller) {
    const td = document.createElement("td");
    const input = document.createElement("input");

    input.type = "number";
    input.className = "number-param-input";
    input.min = "0.001";
    input.step = "0.001";
    input.value = String(cannon.gameplay?.fireRate?.[controller] ?? "");
    input.title = `fireRate.${controller}`;
    input.addEventListener("change", () => {
      setCannonFireRate(cannon.id, controller, input.value);
    });

    td.appendChild(input);
    return td;
  }

  function pilotWeaponTextCell(weapon, field) {
    const td = document.createElement("td");
    const input = document.createElement("input");

    input.type = "text";
    input.className = "text-param-input";
    input.value = String(weapon[field] || "");
    input.title = field;
    input.addEventListener("change", () => {
      setPilotWeaponField(weapon.id, field, input.value);
    });

    td.appendChild(input);
    return td;
  }

  function pilotWeaponNumberCell(weapon, field, value, step = "1") {
    const td = document.createElement("td");
    const input = document.createElement("input");

    input.type = "number";
    input.className = "number-param-input";
    input.min = field === "damage" || field === "magazine" ? "0.001" : "0";
    input.step = step;
    input.value = String(value ?? "");
    input.title = field;
    input.addEventListener("change", () => {
      setPilotWeaponField(weapon.id, field, input.value);
    });

    td.appendChild(input);
    return td;
  }

  async function loadSettings() {
    const data = await fetchJson(api.settingsUrl || `${api.baseUrl}/api/settings`);
    const settings = data.settings || {};

    setMetricLabels("Global", "Scope", "Editable", "Source");
    total.textContent = "settings";
    online.textContent = "all";
    connections.textContent = "yes";
    uptime.textContent = "shared";

    setColumns(["Setting", "Value", "Description"]);
    tableBody.textContent = "";

    const row = document.createElement("tr");
    row.append(
      cell("Bot name brackets"),
      settingCheckboxCell(
        settings.botNameBrackets !== false,
        (checked) => setGlobalSetting("botNameBrackets", checked)
      ),
      cell("Wrap bot names over guns and pilots in square brackets")
    );
    tableBody.appendChild(row);
  }

  function settingCheckboxCell(checked, onChange) {
    const td = document.createElement("td");
    const input = document.createElement("input");

    input.type = "checkbox";
    input.className = "room-enabled-toggle";
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));

    td.appendChild(input);
    return td;
  }

  async function setGlobalSetting(key, value) {
    try {
      await fetchJson(api.settingsUrl || `${api.baseUrl}/api/settings`, {
        method: "POST",
        body: JSON.stringify({ [key]: value })
      });
      await loadSettings();
    } catch (error) {
      window.alert(error.message || "Settings update rejected");
      await loadSettings();
    }
  }

  async function loadEconomy() {
    const data = await fetchJson(api.economyUrl || `${api.baseUrl}/api/economy`);
    const gunsCoin = data.economy?.gunsCoin || {};

    setMetricLabels("Currency", "Visitor", "Register", "Exchange");
    total.textContent = "guns coin";
    online.textContent = String(gunsCoin.visitorGrant ?? 0);
    connections.textContent = String(gunsCoin.registrationGrant ?? 0);
    uptime.textContent = `${gunsCoin.exchangeScorePerCoin ?? 100}:1`;

    setColumns(["Setting", "Value", "Description"]);
    tableBody.textContent = "";

    const rows = [
      {
        key: "visitorGrant",
        title: "New visitor grant",
        value: gunsCoin.visitorGrant ?? 0,
        description: "Guns Coin granted once to a new visitor"
      },
      {
        key: "playGrant",
        title: "Play with nick grant",
        value: gunsCoin.playGrant ?? 0,
        description: "Guns Coin granted once after choosing a free nick and playing"
      },
      {
        key: "registrationGrant",
        title: "Registration grant",
        value: gunsCoin.registrationGrant ?? 0,
        description: "Guns Coin granted once after claiming a nick"
      },
      {
        key: "exchangeScorePerCoin",
        title: "Score exchange rate",
        value: gunsCoin.exchangeScorePerCoin ?? 100,
        description: "Score required to convert into 1 gs in the base exchanger"
      }
    ];

    for (const item of rows) {
      const row = document.createElement("tr");
      row.append(
        cell(item.title),
        economyNumberCell(item.key, item.value),
        cell(item.description)
      );
      tableBody.appendChild(row);
    }
  }

  async function loadWallet() {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(walletFilters)) {
      if (String(value || "").trim()) {
        params.set(key, String(value).trim());
      }
    }

    const data = await fetchJson(
      buildUrl(api.walletTransactionsUrl || `${api.baseUrl}/admin/wallet-transactions`, params)
    );
    const transactions = Array.isArray(data.transactions)
      ? data.transactions
      : [];

    setMetricLabels("Transactions", "Income", "Outcome", "Store");
    total.textContent = String(transactions.length);
    online.textContent = String(
      transactions
        .filter((item) => Number(item.amount) > 0)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0)
    );
    connections.textContent = String(
      Math.abs(
        transactions
          .filter((item) => Number(item.amount) < 0)
          .reduce((sum, item) => sum + Number(item.amount || 0), 0)
      )
    );
    uptime.textContent = data.userStore?.mode || "unknown";

    renderWalletFilters();

    setColumns([
      "Time",
      "Entity",
      "Entity ID",
      "Amount",
      "Balance",
      "Reason",
      "Meta"
    ]);

    renderRows(transactions, (item) => [
      cell(formatDate(item.createdAt)),
      cell(item.entityType || "-"),
      idCell(item.entityId),
      amountCell(item.amount),
      cell(item.balanceAfter ?? "-"),
      cell(item.reason || "-"),
      jsonCell(item.meta)
    ], "No wallet transactions yet");
  }

  function renderWalletFilters() {
    const filters = document.createElement("div");

    filters.className = "filters";
    filters.append(
      walletSelectFilter("entityType", [
        ["", "All entities"],
        ["visit", "Visits"],
        ["pilot", "Pilots"]
      ]),
      walletTextFilter("entityId", "Entity ID"),
      walletTextFilter("reason", "Reason"),
      walletNumberFilter("limit", "Limit"),
      walletFilterButton()
    );
    tableBody.textContent = "";
    tableBody.appendChild(filterRow(filters, 7));
  }

  function walletSelectFilter(key, options) {
    const select = document.createElement("select");

    select.className = "select-param-input filter-input";
    for (const [value, label] of options) {
      const option = document.createElement("option");

      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
    select.value = walletFilters[key] || "";
    select.addEventListener("change", () => {
      walletFilters[key] = select.value;
    });

    return select;
  }

  function walletTextFilter(key, placeholder) {
    const input = document.createElement("input");

    input.className = "filter-input";
    input.placeholder = placeholder;
    input.value = walletFilters[key] || "";
    input.addEventListener("input", () => {
      walletFilters[key] = input.value;
    });

    return input;
  }

  function walletNumberFilter(key, placeholder) {
    const input = walletTextFilter(key, placeholder);

    input.type = "number";
    input.min = "1";
    input.max = "200";
    input.step = "1";
    return input;
  }

  function walletFilterButton() {
    const button = document.createElement("button");

    button.className = "filter-button";
    button.type = "button";
    button.textContent = "APPLY";
    button.addEventListener("click", () => loadWallet());
    return button;
  }

  async function loadAudit() {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(auditFilters)) {
      if (String(value || "").trim()) {
        params.set(key, String(value).trim());
      }
    }

    const data = await fetchJson(
      buildUrl(api.auditLogUrl || `${api.baseUrl}/admin/audit-log`, params)
    );
    const entries = Array.isArray(data.entries) ? data.entries : [];

    setMetricLabels("Entries", "Deletes", "Unlinks", "Store");
    total.textContent = String(entries.length);
    online.textContent = String(entries.filter((item) => item.action === "delete-user").length);
    connections.textContent = String(entries.filter((item) => item.action === "unlink-device").length);
    uptime.textContent = data.userStore?.mode || "unknown";
    renderAuditFilters();
    setColumns(["Time", "Actor", "Action", "Entity", "Entity ID", "Before", "After"]);
    renderRows(entries, (item) => [
      cell(formatDate(item.createdAt)),
      cell(item.actor || "-"),
      cell(item.action || "-"),
      cell(item.entityType || "-"),
      idCell(item.entityId),
      jsonCell(item.before),
      jsonCell(item.after)
    ], "No audit entries yet");
  }

  function renderAuditFilters() {
    const filters = document.createElement("div");

    filters.className = "filters";
    filters.append(
      auditSelectFilter("action", [
        ["", "All actions"],
        ["delete-user", "Delete user"],
        ["unlink-device", "Unlink device"],
        ["revoke-session", "Revoke session"]
      ]),
      auditSelectFilter("entityType", [
        ["", "All entities"],
        ["visit", "Visits"],
        ["pilot", "Pilots"],
        ["device", "Devices"],
        ["session", "Sessions"]
      ]),
      auditTextFilter("entityId", "Entity ID"),
      auditTextFilter("actor", "Actor"),
      auditNumberFilter("limit", "Limit"),
      auditFilterButton()
    );
    tableBody.textContent = "";
    tableBody.appendChild(filterRow(filters, 7));
  }

  function auditSelectFilter(key, options) {
    const select = document.createElement("select");

    select.className = "select-param-input filter-input";
    for (const [value, label] of options) {
      const option = document.createElement("option");

      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
    select.value = auditFilters[key] || "";
    select.addEventListener("change", () => {
      auditFilters[key] = select.value;
    });
    return select;
  }

  function auditTextFilter(key, placeholder) {
    const input = document.createElement("input");

    input.className = "filter-input";
    input.placeholder = placeholder;
    input.value = auditFilters[key] || "";
    input.addEventListener("change", () => {
      auditFilters[key] = input.value;
    });
    return input;
  }

  function auditNumberFilter(key, placeholder) {
    const input = auditTextFilter(key, placeholder);

    input.type = "number";
    input.min = "1";
    input.max = "200";
    input.step = "1";
    return input;
  }

  function auditFilterButton() {
    const button = document.createElement("button");

    button.className = "filter-button";
    button.type = "button";
    button.textContent = "APPLY";
    button.addEventListener("click", () => loadAudit());
    return button;
  }

  async function loadDatabaseStatus() {
    const data = await fetchJson(
      api.databaseStatusUrl || `${api.baseUrl}/admin/database-status`
    );
    const database = data.database || {};
    const counts = database.counts || {};

    setMetricLabels("Mode", "Database", "Health", "Warning");
    total.textContent = database.mode || "-";
    online.textContent = database.mongoDatabase || database.storageFile || "-";
    connections.textContent = database.healthy ? "ok" : "error";
    uptime.textContent = database.warning || "-";
    setColumns(["Section", "Key", "Value"]);
    tableBody.textContent = "";

    appendDetailRow("Runtime", "backend version", data.version || "-");
    appendDetailRow("Runtime", "uptime", formatUptime(data.uptimeMs));
    appendDetailRow("Backup", "latest", formatMongoBackup(data.latestMongoBackup));
    appendDetailRow("Store", "mode", database.mode || "-");
    appendDetailRow("Store", "mongo database", database.mongoDatabase || "-");
    appendDetailRow("Store", "mongo collection", database.mongoCollection || "-");
    appendDetailRow("Store", "storage file", database.storageFile || "-");
    appendDetailRow("Store", "warning", database.warning || "-");

    for (const [key, value] of Object.entries(counts)) {
      appendDetailRow("Counts", key, value);
    }

    appendDetailRow("Latest", "wallet transaction", jsonPreview(database.latestWalletTransaction));
    appendDetailRow("Latest", "audit entry", jsonPreview(database.latestAdminAuditEntry));
  }

  function filterRow(node, colspan) {
    const row = document.createElement("tr");
    const td = document.createElement("td");

    td.colSpan = colspan;
    td.appendChild(node);
    row.appendChild(td);
    return row;
  }

  function appendDetailRow(section, key, value) {
    const row = document.createElement("tr");
    const valueCell = document.createElement("td");

    if (value instanceof Node) {
      valueCell.appendChild(value);
    } else {
      valueCell.textContent = String(value ?? "");
    }

    row.append(cell(section), cell(key), valueCell);
    tableBody.appendChild(row);
  }

  function amountCell(value) {
    const amount = Number(value) || 0;
    const td = cell(amount > 0 ? `+${amount}` : amount);

    td.className = amount >= 0 ? "status-online" : "status-offline";
    return td;
  }

  function economyNumberCell(key, value) {
    const td = document.createElement("td");
    const input = document.createElement("input");

    input.type = "number";
    input.className = "number-param-input";
    input.min = "0";
    input.step = "1";
    input.value = String(value ?? 0);
    input.addEventListener("change", () => {
      setEconomyValue(key, input.value);
    });

    td.appendChild(input);
    return td;
  }

  async function setEconomyValue(key, rawValue) {
    const value = Number(rawValue);

    if (!Number.isFinite(value) || value < 0) {
      await loadEconomy();
      return;
    }

    try {
      await fetchJson(api.economyUrl || `${api.baseUrl}/api/economy`, {
        method: "POST",
        body: JSON.stringify({
          gunsCoin: {
            [key]: value
          }
        })
      });
      await loadEconomy();
    } catch (error) {
      window.alert(error.message || "Economy update rejected");
      await loadEconomy();
    }
  }

  async function setCannonFireRate(cannonId, controller, rawValue) {
    const value = Number(rawValue);

    if (!Number.isFinite(value) || value <= 0) {
      await loadObjects();
      return;
    }

    try {
      await fetchJson(
        api.cannonFireRateUrl ||
          `${api.baseUrl}/api/objects/cannons/fire-rate`,
        {
          method: "POST",
          body: JSON.stringify({
            cannonId,
            controller,
            value
          })
        }
      );
      await loadObjects();
    } catch {
      await loadObjects();
    }
  }

  async function setPilotWeaponField(weaponId, field, rawValue) {
    const numericFields = new Set(["priceGs", "damage", "fireRate", "magazine"]);
    const value = numericFields.has(field)
      ? Number(rawValue)
      : String(rawValue || "").trim();

    if (numericFields.has(field) && !Number.isFinite(value)) {
      await loadObjects();
      return;
    }

    if (!numericFields.has(field) && !value) {
      await loadObjects();
      return;
    }

    try {
      await fetchJson(
        `${api.pilotWeaponsUrl || `${api.baseUrl}/api/objects/pilot-weapons`}/${encodeURIComponent(weaponId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            [field]: value
          })
        }
      );
      await loadObjects();
    } catch (error) {
      window.alert(error.message || "Pilot weapon update rejected");
      await loadObjects();
    }
  }

  async function loadRooms() {
    const data = await fetchJson(api.roomsUrl || `${api.baseUrl}/api/rooms`);
    const rooms = Object.values(data.rooms || {});
    const marketItems = rooms.flatMap((room) => getRoomMarketItems(room));

    window.GUNS_PANEL_LAST_OBJECTS = data.objects || window.GUNS_PANEL_LAST_OBJECTS || {};
    setMetricLabels("Rooms", "Enabled", "Max players", "Source");
    total.textContent = String(rooms.length);
    online.textContent = String(rooms.filter((room) => room.enabled).length);
    connections.textContent = String(
      rooms.reduce((sum, room) => sum + Number(room.limits?.maxPlayers || 0), 0)
    );
    uptime.textContent = `items ${marketItems.length}`;

    setColumns([
      "Enabled",
      "Published",
      "ID",
      "Title",
      "Mode",
      "Shape",
      "Radius",
      "Size X",
      "Size Y",
      "Outer",
      "Inner",
      "Rotation",
      "Max players",
      "Guns",
      "Spawns",
      "Actions"
    ]);
    renderRoomRows(rooms);
    renderMarketItemRows(rooms);
  }

  function renderRoomRows(rooms) {
    tableBody.textContent = "";

    const createRow = document.createElement("tr");
    const createCell = document.createElement("td");
    const createButton = document.createElement("button");

    createCell.colSpan = 13;
    createButton.type = "button";
    createButton.className = "room-action";
    createButton.textContent = "CREATE DRAFT";
    createButton.addEventListener("click", () => createDraftRoom("main"));
    createCell.appendChild(createButton);
    createRow.appendChild(createCell);
    tableBody.appendChild(createRow);

    if (rooms.length === 0) {
      return;
    }

    for (const room of rooms) {
      const row = document.createElement("tr");
      row.append(
        roomEnabledCell(room),
        roomPublishedCell(room),
        idCell(room.id),
        cell(room.title),
        mutedCell(room.modeId),
        roomShapeCell(room),
        roomRadiusCell(room),
        roomSizeCell(room, "width"),
        roomSizeCell(room, "height"),
        roomStarCell(room, "outerRadius"),
        roomStarCell(room, "innerRadius"),
        roomStarCell(room, "rotation"),
        cell(room.limits?.maxPlayers),
        mutedCell((room.allowedCannons || []).join(", ") || "-"),
        mutedCell(formatRoomSpawns(room.spawns)),
        roomActionsCell(room)
      );
      tableBody.appendChild(row);
    }
  }

  function getRoomMarketItems(room) {
    return (room.objects || [])
      .filter((instance) => instance.objectId === "market-item")
      .map((instance) => ({ room, instance }));
  }

  function renderMarketItemRows(rooms) {
    const marketItems = rooms.flatMap((room) => getRoomMarketItems(room));

    if (!marketItems.length) return;

    const titleRow = document.createElement("tr");
    const titleCell = document.createElement("td");

    titleCell.colSpan = 16;
    titleCell.className = "section-row";
    titleCell.textContent = "Market items";
    titleRow.appendChild(titleCell);
    tableBody.appendChild(titleRow);

    for (const { room, instance } of marketItems) {
      const row = document.createElement("tr");

      row.className = "market-item-row";
      row.append(
        mutedCell("item"),
        mutedCell(room.id),
        idCell(instance.instanceId),
        marketItemWeaponCell(room, instance),
        marketItemNumberCell(room, instance, "stock", instance.params?.stock ?? 0, "0", "1"),
        marketItemNumberCell(room, instance, "x", instance.x ?? 0, "", "1"),
        marketItemNumberCell(room, instance, "y", instance.y ?? 0, "", "1"),
        mutedCell(instance.params?.icon || "-"),
        mutedCell("price from weapon")
      );
      tableBody.appendChild(row);
    }
  }

  function marketItemWeaponCell(room, instance) {
    const td = document.createElement("td");
    const select = document.createElement("select");
    const weapons = getPilotWeapons();

    select.className = "select-param-input wide";
    select.disabled = room.published === true;

    for (const weapon of weapons) {
      const option = document.createElement("option");

      option.value = weapon.id;
      option.textContent = weapon.title || weapon.id;
      select.appendChild(option);
    }

    select.value = instance.params?.weaponId || "";
    select.addEventListener("change", () => {
      setRoomObjectField(room.id, instance.instanceId, "weaponId", select.value);
    });

    td.appendChild(select);
    return td;
  }

  function marketItemNumberCell(room, instance, field, value, min = "", step = "1") {
    const td = document.createElement("td");
    const input = document.createElement("input");

    input.type = "number";
    input.className = "number-param-input";
    input.min = min;
    input.step = step;
    input.value = String(value ?? "");
    input.disabled = room.published === true;
    input.title = field;
    input.addEventListener("change", () => {
      setRoomObjectField(room.id, instance.instanceId, field, input.value);
    });

    td.appendChild(input);
    return td;
  }

  function getPilotWeapons() {
    return Object.values(window.GUNS_PANEL_LAST_OBJECTS?.pilotWeapons || {});
  }

  function roomActionsCell(room) {
    const td = document.createElement("td");
    const button = document.createElement("button");

    button.type = "button";
    button.className = "room-action";
    button.textContent = "CLONE DRAFT";
    button.addEventListener("click", () => createDraftRoom(room.id));
    td.appendChild(button);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-user";
    deleteButton.textContent = "DELETE";
    deleteButton.disabled = room.published === true;
    deleteButton.title = room.published === true
      ? "Locked rooms cannot be deleted"
      : "Delete room";
    deleteButton.addEventListener("click", () => deleteRoom(room));
    td.appendChild(deleteButton);
    return td;
  }

  function roomPublishedCell(room) {
    const td = document.createElement("td");

    if (room.published === true) {
      const badge = document.createElement("span");
      badge.className = "online-state online";
      badge.textContent = "locked";
      td.appendChild(badge);
      return td;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "publish-room";
    button.textContent = "PUBLISH";
    button.addEventListener("click", () => publishRoom(room.id));
    td.appendChild(button);
    return td;
  }

  function roomEnabledCell(room) {
    const td = document.createElement("td");
    const input = document.createElement("input");

    input.type = "checkbox";
    input.className = "room-enabled-toggle";
    input.checked = room.enabled !== false;
    input.disabled = room.published === true;
    input.title = "Show on start screen";
    input.addEventListener("change", () => {
      setRoomEnabled(room.id, input.checked);
    });

    td.appendChild(input);
    return td;
  }

  function roomShapeCell(room) {
    const td = document.createElement("td");
    const select = document.createElement("select");

    select.className = "select-param-input";
    select.append(
      roomShapeOption("circle", "Circle"),
      roomShapeOption("rectangle", "Rectangle"),
      roomShapeOption("five-pointed-star", "Five-pointed star"),
      roomShapeOption("triangle", "Triangle")
    );
    select.value = room.arena?.shape || "circle";
    select.disabled = room.published === true;
    select.addEventListener("change", () => {
      setRoomArena(room.id, select.value, getRoomArenaParamsForShape(room, select.value));
    });

    td.appendChild(select);
    return td;
  }

  function roomShapeOption(value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function roomRadiusCell(room) {
    const td = document.createElement("td");
    const input = document.createElement("input");
    const shape = room.arena?.shape || "circle";
    const locked = room.published === true;

    input.type = "number";
    input.className = "number-param-input";
    input.min = "1";
    input.step = "1";
    input.value = String(getRoomArenaParams(room).radius ?? "");
    input.title = "arena.params.radius";
    input.disabled = locked || !["circle", "triangle"].includes(shape);
    input.addEventListener("change", () => {
      setRoomArena(room.id, shape, {
        ...getRoomArenaParams(room),
        radius: input.value
      });
    });

    td.appendChild(input);
    return td;
  }

  function roomSizeCell(room, key) {
    const td = document.createElement("td");
    const input = document.createElement("input");
    const shape = room.arena?.shape || "circle";
    const locked = room.published === true;

    input.type = "number";
    input.className = "number-param-input";
    input.min = "1";
    input.step = "1";
    input.value = String(getRoomArenaParams(room)[key] ?? "");
    input.title = `arena.params.${key}`;
    input.disabled = locked || shape !== "rectangle";
    input.addEventListener("change", () => {
      setRoomArena(room.id, shape, {
        ...getRoomArenaParams(room),
        [key]: input.value
      });
    });

    td.appendChild(input);
    return td;
  }

  function roomStarCell(room, key) {
    const td = document.createElement("td");
    const input = document.createElement("input");
    const shape = room.arena?.shape || "circle";
    const locked = room.published === true;

    input.type = "number";
    input.className = "number-param-input";
    input.step = "1";
    input.value = String(getRoomArenaParams(room)[key] ?? "");
    input.title = `arena.params.${key}`;
    input.disabled = locked || shape !== "five-pointed-star";
    input.addEventListener("change", () => {
      setRoomArena(room.id, shape, {
        ...getRoomArenaParams(room),
        [key]: input.value
      });
    });

    td.appendChild(input);
    return td;
  }

  function getRoomArenaParams(room) {
    return {
      ...(room.arena?.params || {}),
      radius: room.arena?.params?.radius ?? room.arena?.radius,
      width: room.arena?.params?.width ?? room.arena?.params?.x ?? getFallbackRoomSize(room),
      height: room.arena?.params?.height ?? room.arena?.params?.y ?? getFallbackRoomSize(room),
      outerRadius: room.arena?.params?.outerRadius ?? getFallbackRoomSize(room) / 2,
      innerRadius: room.arena?.params?.innerRadius ?? Math.round(getFallbackRoomSize(room) * 0.21),
      rotation: room.arena?.params?.rotation ?? -90
    };
  }

  function getRoomArenaParamsForShape(room, shape) {
    const params = getRoomArenaParams(room);

    if (shape === "circle" && (!Number.isFinite(Number(params.radius)) || Number(params.radius) <= 0)) {
      params.radius = Math.round(Math.min(Number(params.width), Number(params.height)) / 2);
    }

    if (shape === "triangle") {
      params.radius = Number(params.radius) || Math.round(getFallbackRoomSize(room) / 2);
      params.rotation = Number(params.rotation ?? -90);
    }

    if (shape === "rectangle") {
      params.width = Number(params.width) || getFallbackRoomSize(room);
      params.height = Number(params.height) || getFallbackRoomSize(room);
    }

    if (shape === "five-pointed-star") {
      params.outerRadius = Number(params.outerRadius) || Math.round(getFallbackRoomSize(room) / 2);
      params.innerRadius = Number(params.innerRadius) || Math.round(params.outerRadius * 0.42);
      params.rotation = Number(params.rotation ?? -90);
    }

    return params;
  }

  function getFallbackRoomSize(room) {
    const radius = Number(room.arena?.params?.radius ?? room.arena?.radius);
    return Number.isFinite(radius) && radius > 0 ? radius * 2 : 1200;
  }

  async function setRoomArena(roomId, shape, rawParams) {
    const params = { ...rawParams };

    if (shape === "circle") {
      params.radius = Number(params.radius);
      if (!Number.isFinite(params.radius) || params.radius <= 0) {
        await loadRooms();
        return;
      }
    }

    if (shape === "triangle") {
      params.radius = Number(params.radius);
      params.rotation = Number(params.rotation ?? -90);
      if (
        !Number.isFinite(params.radius) ||
        params.radius <= 0 ||
        !Number.isFinite(params.rotation)
      ) {
        await loadRooms();
        return;
      }
    }

    if (shape === "rectangle") {
      params.width = Number(params.width);
      params.height = Number(params.height);
      if (
        !Number.isFinite(params.width) ||
        params.width <= 0 ||
        !Number.isFinite(params.height) ||
        params.height <= 0
      ) {
        await loadRooms();
        return;
      }
    }

    if (shape === "five-pointed-star") {
      params.outerRadius = Number(params.outerRadius);
      params.innerRadius = Number(params.innerRadius);
      params.rotation = Number(params.rotation ?? -90);
      if (
        !Number.isFinite(params.outerRadius) ||
        params.outerRadius <= 0 ||
        !Number.isFinite(params.innerRadius) ||
        params.innerRadius <= 0 ||
        params.innerRadius >= params.outerRadius ||
        !Number.isFinite(params.rotation)
      ) {
        await loadRooms();
        return;
      }
    }

    try {
      await fetchJson(api.roomArenaUrl || `${api.baseUrl}/api/rooms/arena`, {
        method: "POST",
        body: JSON.stringify({
          roomId,
          shape,
          params
        })
      });
      await loadRooms();
    } catch (error) {
      window.alert(error.message || "Room arena update rejected");
      await loadRooms();
    }
  }

  async function setRoomObjectField(roomId, instanceId, field, rawValue) {
    const numericFields = new Set(["stock", "x", "y", "rotation"]);
    const value = numericFields.has(field)
      ? Number(rawValue)
      : String(rawValue || "").trim();

    if (numericFields.has(field) && !Number.isFinite(value)) {
      await loadRooms();
      return;
    }

    if (!numericFields.has(field) && !value) {
      await loadRooms();
      return;
    }

    try {
      await fetchJson(api.roomObjectUrl || `${api.baseUrl}/api/rooms/object`, {
        method: "PATCH",
        body: JSON.stringify({
          roomId,
          instanceId,
          [field]: value
        })
      });
      await loadRooms();
    } catch (error) {
      window.alert(error.message || "Room object update rejected");
      await loadRooms();
    }
  }

  async function publishRoom(roomId) {
    const confirmed = window.confirm(`Publish ${roomId}? Published rooms become locked.`);

    if (!confirmed) return;

    try {
      await fetchJson(api.roomPublishUrl || `${api.baseUrl}/api/rooms/publish`, {
        method: "POST",
        body: JSON.stringify({ roomId })
      });
      await loadRooms();
    } catch (error) {
      window.alert(error.message || "Room publish rejected");
      await loadRooms();
    }
  }

  async function createDraftRoom(sourceRoomId) {
    try {
      await fetchJson(api.roomDraftUrl || `${api.baseUrl}/api/rooms/draft`, {
        method: "POST",
        body: JSON.stringify({ sourceRoomId })
      });
      await loadRooms();
    } catch (error) {
      window.alert(error.message || "Draft room creation rejected");
      await loadRooms();
    }
  }

  async function deleteRoom(room) {
    if (!room?.id || room.published === true) return;

    const confirmed = window.confirm(`Delete ${room.title || room.id}?`);

    if (!confirmed) return;

    try {
      const baseUrl = api.roomDeleteUrl || `${api.baseUrl}/api/rooms`;
      await fetchJson(`${baseUrl}/${encodeURIComponent(room.id)}`, {
        method: "DELETE"
      });
      await loadRooms();
    } catch (error) {
      window.alert(error.message || "Room delete rejected");
      await loadRooms();
    }
  }

  async function setRoomEnabled(roomId, enabled) {
    try {
      await fetchJson(api.roomEnabledUrl || `${api.baseUrl}/api/rooms/enabled`, {
        method: "POST",
        body: JSON.stringify({ roomId, enabled })
      });
      await loadRooms();
    } catch {
      await loadRooms();
    }
  }

  function formatRoomSpawns(spawns) {
    if (!spawns) return "default";

    const bots = Array.isArray(spawns.bots) ? spawns.bots.length : "default";
    const cannons = Array.isArray(spawns.cannons)
      ? spawns.cannons.map((item) => item.gunType || item.unitId).join(", ")
      : "default";

    return `bots: ${bots}; guns: ${cannons || "0"}`;
  }

  async function loadModes() {
    const data = await fetchJson(api.modesUrl || `${api.baseUrl}/api/modes`);
    const modes = Object.values(data.modes || {});

    setMetricLabels("Modes", "Enabled", "Rules", "Source");
    total.textContent = String(modes.length);
    online.textContent = String(modes.filter((mode) => mode.enabled).length);
    connections.textContent = String(
      modes.reduce((sum, mode) => sum + Object.keys(mode.rules || {}).length, 0)
    );
    uptime.textContent = "shared";

    setColumns(["ID", "Kind", "Title", "Enabled", "Rules"]);
    renderRows(
      modes,
      (mode) => [
        idCell(mode.id),
        cell(mode.kind || "-"),
        cell(mode.title),
        booleanCell(mode.enabled),
        mutedCell(formatRules(mode.rules))
      ],
      "No modes"
    );
  }

  async function loadConfigStatus() {
    const data = await fetchJson(api.configStatusUrl || `${api.baseUrl}/api/config/status`);
    const draftData = await fetchJson(api.configDraftUrl || `${api.baseUrl}/api/config/draft`);
    const counts = data.counts || {};
    const draft = data.draft || {};

    setMetricLabels("Game", "Config", "Status", "Schema");
    total.textContent = data.version || "-";
    online.textContent = data.configVersion || "-";
    connections.textContent = draft.exists
      ? `draft ${draft.valid ? "valid" : "invalid"}`
      : data.status || "-";
    uptime.textContent = String(data.schemaVersion || "-");

    renderConfigEditor(draftData.draft, draftData.source, counts);
  }

  function renderConfigEditor(configValue, source, counts) {
    setColumns(["Draft editor"]);
    tableBody.textContent = "";

    const row = document.createElement("tr");
    const td = document.createElement("td");
    const editor = document.createElement("textarea");
    const actions = document.createElement("div");
    const meta = document.createElement("div");
    const saveButton = document.createElement("button");
    const publishButton = document.createElement("button");
    const discardButton = document.createElement("button");
    const message = document.createElement("span");

    td.colSpan = 1;
    editor.className = "config-editor";
    editor.spellcheck = false;
    editor.value = JSON.stringify(configValue, null, 2);

    actions.className = "config-actions";
    meta.className = "config-meta";
    meta.textContent =
      `source: ${source}; guns: ${counts.guns ?? counts.cannons ?? 0}; ` +
      `rooms: ${counts.rooms || 0}; modes: ${counts.modes || 0}`;

    saveButton.type = "button";
    saveButton.textContent = "SAVE DRAFT";
    saveButton.addEventListener("click", () => saveDraft(editor, message));

    publishButton.type = "button";
    publishButton.textContent = "PUBLISH";
    publishButton.addEventListener("click", () => publishDraft(message));

    discardButton.type = "button";
    discardButton.textContent = "DISCARD";
    discardButton.addEventListener("click", () => discardDraft(message));

    message.className = "config-message";

    actions.append(saveButton, publishButton, discardButton, message);
    td.append(meta, editor, actions);
    row.appendChild(td);
    tableBody.appendChild(row);
  }

  async function saveDraft(editor, message) {
    try {
      const configValue = JSON.parse(editor.value);
      await fetchJson(api.configDraftUrl || `${api.baseUrl}/api/config/draft`, {
        method: "PUT",
        body: JSON.stringify({
          config: configValue
        })
      });
      message.textContent = "draft saved";
      await loadConfigStatus();
    } catch (error) {
      message.textContent = error.message || "draft error";
    }
  }

  async function publishDraft(message) {
    try {
      await fetchJson(api.configPublishUrl || `${api.baseUrl}/api/config/publish`, {
        method: "POST",
        body: JSON.stringify({})
      });
      message.textContent = "published";
      await loadConfigStatus();
    } catch (error) {
      message.textContent = error.message || "publish error";
    }
  }

  async function discardDraft(message) {
    try {
      await fetchJson(api.configDiscardUrl || `${api.baseUrl}/api/config/discard`, {
        method: "POST",
        body: JSON.stringify({})
      });
      message.textContent = "discarded";
      await loadConfigStatus();
    } catch (error) {
      message.textContent = error.message || "discard error";
    }
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getAdminAuthHeaders(),
        ...(options.headers || {})
      }
    });
    const data = await response.json();

    if (response.status === 401 || response.status === 503) {
      clearAdminToken();
    }

    if (!response.ok) {
      const error = new Error(data.message || data.error || `HTTP ${response.status}`);

      error.status = response.status;
      error.code = data.error || "";
      throw error;
    }

    return data;
  }

  function renderRows(items, toCells, emptyText) {
    if (items.length === 0) {
      if (tableBody.children.length > 0) {
        const row = document.createElement("tr");
        const td = document.createElement("td");

        td.colSpan = tableHead.querySelectorAll("th").length || 1;
        td.className = "empty";
        td.textContent = emptyText;
        row.appendChild(td);
        tableBody.appendChild(row);
      } else {
        renderEmpty(emptyText);
      }
      return;
    }

    if (tableBody.children.length === 0) {
      tableBody.textContent = "";
    }

    for (const item of items) {
      const row = document.createElement("tr");
      row.append(...toCells(item));
      tableBody.appendChild(row);
    }
  }

  function setColumns(columns) {
    const row = document.createElement("tr");
    for (const column of columns) {
      const th = document.createElement("th");
      th.textContent = column;
      row.appendChild(th);
    }
    tableHead.textContent = "";
    tableHead.appendChild(row);
  }

  function renderEmpty(text) {
    const columnCount = tableHead.querySelectorAll("th").length || 1;
    tableBody.innerHTML = `<tr><td colspan="${columnCount}" class="empty">${text}</td></tr>`;
  }

  function setMetricLabels(a, b, c, d) {
    totalLabel.textContent = a;
    onlineLabel.textContent = b;
    connectionsLabel.textContent = c;
    uptimeLabel.textContent = d;
  }

  function renderActiveNav() {
    for (const item of navItems) {
      item.classList.toggle("active", item.dataset.view === activeView);
    }
  }

  function setServerState(isOnline, label) {
    state.textContent = label || (isOnline ? "Server online" : "Server offline");
    state.classList.toggle("online", isOnline);
    state.classList.toggle("offline", !isOnline);
  }

  function cell(value) {
    const td = document.createElement("td");
    td.textContent = String(value ?? "");
    return td;
  }

  function mutedCell(value) {
    const td = cell(value);
    td.className = "muted-cell";
    return td;
  }

  function idCell(value) {
    const td = cell(shortId(value));
    td.className = "id-cell";
    td.title = String(value || "");
    return td;
  }

  function jsonCell(value) {
    const json = jsonPreview(value);
    const td = cell(json);
    td.className = "id-cell";
    td.title = JSON.stringify(value || {}, null, 2);
    return td;
  }

  function jsonPreview(value) {
    const json = JSON.stringify(value || {});

    return json.length > 72 ? `${json.slice(0, 72)}...` : json;
  }

  function idListCell(value) {
    const values = Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
    const td = cell(values.length ? values.map(shortId).join(", ") : "-");
    td.className = "id-cell";
    td.title = values.join("\n");
    return td;
  }

  function linkedPilotCell(user) {
    if (!user?.claimedPilotId) return mutedCell("-");

    const label = user.claimedNick || shortId(user.claimedPilotId);
    const td = cell(label);
    td.className = "id-cell";
    td.title = user.claimedPilotId;
    return td;
  }

  function sessionListCell(value) {
    if (!Array.isArray(value) || !value.some((item) => item?.id)) {
      return idListCell(value);
    }

    const labels = value.map((item) => shortId(item.id)).filter(Boolean);
    const details = value
      .map((item) => `${shortId(item.id)} / ${shortId(item.deviceId)}`)
      .join("\n");
    const td = cell(labels.length ? labels.join(", ") : "-");
    td.className = "id-cell";
    td.title = details;
    return td;
  }

  function accountStatusCell(status) {
    const td = document.createElement("td");
    const badge = document.createElement("span");
    const normalizedStatus = normalizeAccountStatus(status);

    badge.className = `account-status ${normalizedStatus}`;
    badge.textContent = normalizedStatus.toUpperCase();
    td.appendChild(badge);

    return td;
  }

  function onlineCell(isOnline) {
    const td = document.createElement("td");
    const badge = document.createElement("span");

    badge.className = `online-state ${isOnline ? "online" : "offline"}`;
    badge.textContent = isOnline ? "online" : "offline";
    td.appendChild(badge);

    return td;
  }

  function booleanCell(value) {
    const td = document.createElement("td");
    const badge = document.createElement("span");

    badge.className = `online-state ${value ? "online" : "offline"}`;
    badge.textContent = value ? "yes" : "no";
    td.appendChild(badge);

    return td;
  }

  function actionsCell(user) {
    const td = document.createElement("td");
    const detailButton = document.createElement("button");
    const button = document.createElement("button");

    detailButton.type = "button";
    detailButton.className = "detail-user";
    detailButton.textContent = "DETAILS";
    detailButton.addEventListener("click", () => {
      loadUserDetail(user.id);
    });
    td.appendChild(detailButton);

    button.type = "button";
    button.className = "delete-user";
    button.textContent = "DELETE";
    button.addEventListener("click", () => {
      deleteUser(user);
    });
    td.appendChild(button);

    return td;
  }

  function gunsCoinCell(user) {
    const td = document.createElement("td");

    td.appendChild(gunsCoinEditor(user, loadUsers));
    return td;
  }

  function gunsCoinEditor(user, afterSave) {
    const wrapper = document.createElement("span");
    const input = document.createElement("input");
    const button = document.createElement("button");

    wrapper.className = "gs-editor";
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.className = "number-param-input gs-input";
    input.value = String(user.wallet?.gunsCoin ?? 0);
    button.type = "button";
    button.className = "detail-user gs-save";
    button.textContent = "SET";
    button.addEventListener("click", async () => {
      try {
        await setUserGunsCoin(user, input.value);
        await afterSave?.();
      } catch (error) {
        window.alert(error.message || "GS update rejected");
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        button.click();
      }
    });

    wrapper.append(input, button);
    return wrapper;
  }

  async function setUserGunsCoin(user, value) {
    const rawValue = String(value ?? "").trim();

    if (!rawValue) {
      throw new Error("GS value is required");
    }

    const gunsCoin = Math.max(0, Math.floor(Number(rawValue) || 0));

    return fetchJson(`${getUsersUrl()}/${encodeURIComponent(user.id)}/wallet`, {
      method: "PATCH",
      body: JSON.stringify({
        gunsCoin
      })
    });
  }

  async function deleteUser(user) {
    if (!user?.id) return;

    const confirmed = window.confirm(`Delete ${user.nick || user.id}?`);

    if (!confirmed) return;

    try {
      await requestAdminDelete(`${getUsersUrl()}/${encodeURIComponent(user.id)}`);
      await loadUsers();
    } catch {
      setServerState(false, "Server offline");
    }
  }

  async function requestAdminDelete(url) {
    const response = await fetch(url, {
      method: "DELETE",
      credentials: "include",
      headers: getAdminAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  function actionButton(label, className, onClick) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", async () => {
      try {
        await onClick();
      } catch {
        setServerState(false, "Server offline");
      }
    });
    return button;
  }

  function getUsersUrl() {
    return api.usersUrl || `${api.baseUrl}/admin/users`;
  }

  function getAdminBaseUrl() {
    return `${api.baseUrl || "http://127.0.0.1:3000"}/admin`;
  }

  function buildUrl(baseUrl, params) {
    const url = new URL(baseUrl, window.location.href);

    for (const [key, value] of params.entries()) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  }

  function formatMongoBackup(backup) {
    if (!backup) return "-";

    const counts = backup.collections
      ? Object.entries(backup.collections)
        .map(([name, value]) => `${name}:${value.count ?? 0}`)
        .join(", ")
      : "";

    return `${formatDate(backup.createdAt)} / ${backup.directory || "-"}${counts ? ` / ${counts}` : ""}`;
  }

  function shortId(value) {
    const id = String(value || "");
    return id.length > 8 ? id.slice(0, 8) : id || "-";
  }

  function normalizeAccountStatus(status) {
    if (status === "claimed" || status === "registered" || status === "pilot") return "claimed";
    if (status === "unclaimed" || status === "nick") return "unclaimed";
    return "visitor";
  }

  function getCount(list, fallback) {
    if (Array.isArray(list)) return list.filter(Boolean).length;
    return fallback ? 1 : 0;
  }

  function getActiveConnections(user) {
    const value = Number(user?.activeConnections || 0);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  function formatUptime(value) {
    const milliseconds = Number(value);

    if (!Number.isFinite(milliseconds)) {
      return "--";
    }

    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    }

    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  function formatRules(rules) {
    return Object.entries(rules || {})
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
  }

  async function ensureAdminAccess() {
    if (getAdminToken() && await validateAdminToken()) {
      return true;
    }

    clearAdminToken();
    lockPanel("ACCESS REQUIRED");
    return false;
  }

  async function submitAdminToken() {
    const token = String(authInput?.value || "").trim();

    if (!token) {
      lockPanel("TOKEN REQUIRED", true);
      return;
    }

    setAdminToken(token);
    setAuthMessage("CHECKING...", false);

    if (await validateAdminToken()) {
      adminAccessReady = true;
      await bootPanel();
      return;
    }

    adminAccessReady = false;
    clearAdminToken();
    if (authInput) authInput.value = "";
    lockPanel("ACCESS DENIED", true);
  }

  function lockPanel(message, isError = false) {
    shell?.classList.add("auth-locked");
    authGate?.classList.remove("hidden");
    setAuthMessage(message, isError);
    window.setTimeout(() => authInput?.focus(), 0);
  }

  function unlockPanel() {
    shell?.classList.remove("auth-locked");
    authGate?.classList.add("hidden");
  }

  function setAuthMessage(message, isError) {
    if (!authMessage) return;
    authMessage.textContent = message || "";
    authMessage.classList.toggle("error", Boolean(isError));
  }

  async function validateAdminToken() {
    try {
      await fetchJson(`${getAdminBaseUrl()}/auth-check`);
      return true;
    } catch (error) {
      if (isAdminAuthError(error)) return false;
      throw error;
    }
  }

  function isAdminAuthError(error) {
    return error?.status === 401 || error?.status === 503;
  }

  function getAdminToken() {
    try {
      return window.localStorage.getItem(tokenStorageKey) || "";
    } catch {
      return "";
    }
  }

  function setAdminToken(token) {
    try {
      window.localStorage.setItem(tokenStorageKey, String(token || "").trim());
    } catch {
      // ignore storage failures; the next request will fail closed.
    }
  }

  function clearAdminToken() {
    try {
      window.localStorage.removeItem(tokenStorageKey);
    } catch {
      // ignore storage failures
    }
  }

  function getAdminAuthHeaders() {
    const token = getAdminToken();

    return token
      ? {
          Authorization: `Bearer ${token}`,
          "X-GUNS-ADMIN-TOKEN": token
        }
      : {};
  }

  renderActiveNav();
  bootPanel();
  window.setInterval(() => {
    if (activeView === "users") {
      if (document.activeElement?.closest?.(".gs-editor")) return;
      bootPanel();
    }
  }, 2000);
})();
