const GUNS_PANEL_API_BASE_URL = (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === ""
)
  ? "http://127.0.0.1:3000"
  : "https://api.guns.gs";

window.GUNS_PANEL_CONFIG = {
  project: {
    name: "guns-panel",
    version: "0.2.10",
    brand: "GUNS Panel"
  },
  api: {
    baseUrl: GUNS_PANEL_API_BASE_URL,
    usersUrl: `${GUNS_PANEL_API_BASE_URL}/admin/users`,
    objectsUrl: `${GUNS_PANEL_API_BASE_URL}/api/objects`,
    settingsUrl: `${GUNS_PANEL_API_BASE_URL}/api/settings`,
    economyUrl: `${GUNS_PANEL_API_BASE_URL}/api/economy`,
    walletTransactionsUrl: `${GUNS_PANEL_API_BASE_URL}/admin/wallet-transactions`,
    auditLogUrl: `${GUNS_PANEL_API_BASE_URL}/admin/audit-log`,
    databaseStatusUrl: `${GUNS_PANEL_API_BASE_URL}/admin/database-status`,
    cannonFireRateUrl: `${GUNS_PANEL_API_BASE_URL}/api/objects/cannons/fire-rate`,
    roomsUrl: `${GUNS_PANEL_API_BASE_URL}/api/rooms`,
    roomDraftUrl: `${GUNS_PANEL_API_BASE_URL}/api/rooms/draft`,
    roomEnabledUrl: `${GUNS_PANEL_API_BASE_URL}/api/rooms/enabled`,
    roomPublishUrl: `${GUNS_PANEL_API_BASE_URL}/api/rooms/publish`,
    roomDeleteUrl: `${GUNS_PANEL_API_BASE_URL}/api/rooms`,
    roomArenaUrl: `${GUNS_PANEL_API_BASE_URL}/api/rooms/arena`,
    modesUrl: `${GUNS_PANEL_API_BASE_URL}/api/modes`,
    configStatusUrl: `${GUNS_PANEL_API_BASE_URL}/api/config/status`,
    configDraftUrl: `${GUNS_PANEL_API_BASE_URL}/api/config/draft`,
    configPublishUrl: `${GUNS_PANEL_API_BASE_URL}/api/config/publish`,
    configDiscardUrl: `${GUNS_PANEL_API_BASE_URL}/api/config/discard`
  }
};
