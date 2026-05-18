(function () {
  const localConfigUrl = "./shared/game-config.json";
  const apiBaseUrl = getHttpBaseUrl();
  const apiUrl = apiBaseUrl ? `${apiBaseUrl}/api/config/current` : "";

  const apiConfig = loadConfig(apiUrl);
  const localConfig = loadConfig(localConfigUrl);

  window.GUNS_SHARED_CONFIG =
    chooseNewestConfig(apiConfig, localConfig) ||
    apiConfig ||
    localConfig ||
    null;

  window.GUNS_CONFIG_LOADER = {
    refresh
  };

  async function refresh() {
    if (!apiUrl) return window.GUNS_SHARED_CONFIG;

    try {
      const url = new URL(apiUrl);
      url.searchParams.set("_", String(Date.now()));

      const response = await fetch(url.toString(), {
        cache: "no-store"
      });

      if (!response.ok) return window.GUNS_SHARED_CONFIG;

      const payload = await response.json();
      const config = payload?.config || payload;

      if (config) {
        const nextConfig =
          chooseNewestConfig(window.GUNS_SHARED_CONFIG, config) ||
          window.GUNS_SHARED_CONFIG;

        window.GUNS_SHARED_CONFIG = nextConfig;
        window.GUNS_OBJECTS?.refreshFromConfig?.(nextConfig);
      }
    } catch {}

    return window.GUNS_SHARED_CONFIG;
  }

  function loadConfig(url) {
    if (!url) return null;

    try {
      const request = new XMLHttpRequest();
      request.open("GET", url, false);
      request.send(null);

      if (request.status < 200 || request.status >= 300) return null;

      const payload = JSON.parse(request.responseText);
      return payload?.config || payload;
    } catch {
      return null;
    }
  }

  function chooseNewestConfig(apiConfig, localConfig) {
    if (!apiConfig || !localConfig) {
      return apiConfig || localConfig;
    }

    return compareVersions(
      localConfig.configVersion,
      apiConfig.configVersion
    ) >= 0
      ? localConfig
      : apiConfig;
  }

  function compareVersions(a, b) {
    const left = String(a || "0")
      .split(".")
      .map(Number);
    const right = String(b || "0")
      .split(".")
      .map(Number);
    const length = Math.max(left.length, right.length);

    for (let i = 0; i < length; i++) {
      const diff = (left[i] || 0) - (right[i] || 0);
      if (diff !== 0) return diff;
    }

    return 0;
  }

  function getHttpBaseUrl() {
    const config = window.GUNS_CONFIG?.multiplayer || {};

    if (isLocalPage()) {
      return config.localHttpUrl || "";
    }

    return config.publicHttpUrl || window.location.origin;
  }

  function isLocalPage() {
    const pageHost = window.location.hostname;

    return (
      pageHost === "localhost" ||
      pageHost === "127.0.0.1" ||
      pageHost === "::1" ||
      pageHost === ""
    );
  }
})();
