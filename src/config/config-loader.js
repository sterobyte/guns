(function () {
  const localConfigUrl = "./shared/game-config.json";
  const apiUrl =
    window.GUNS_CONFIG?.multiplayer?.localHttpUrl &&
    canUseLocalEndpoint(window.GUNS_CONFIG.multiplayer.localHttpUrl)
      ? `${window.GUNS_CONFIG.multiplayer.localHttpUrl}/api/config/current`
      : "";

  const apiConfig = loadConfig(apiUrl);
  const localConfig = loadConfig(localConfigUrl);

  window.GUNS_SHARED_CONFIG =
    chooseNewestConfig(apiConfig, localConfig) ||
    apiConfig ||
    localConfig ||
    null;

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
    ) > 0
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
})();
