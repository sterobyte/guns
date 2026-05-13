(function () {
  window.GUNS_NET = {
    mode: "local-only",
    connected: false,
    sendInput() {},
    applySnapshot() {},
    describe() {
      return {
        mode: this.mode,
        readyForServerAdapter: true
      };
    }
  };
})();
