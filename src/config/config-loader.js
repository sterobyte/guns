(function () {
  const localConfigUrl = "./shared/game-config.json";
  const apiUrl =
    window.GUNS_CONFIG?.multiplayer?.localHttpUrl &&
    canUseLocalEndpoint(window.GUNS_CONFIG.multiplayer.localHttpUrl)
      ? `${window.GUNS_CONFIG.multiplayer.localHttpUrl}/api/config/current`
      : "";

  window.GUNS_SHARED_CONFIG =
    loadConfig(apiUrl) ||
    loadConfig(localConfigUrl) ||
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
