(() => {
  const refreshInterval = 5000;
  const requestTimeout = 6000;

  window.startVisiblePoll = ({ element, url, shouldRefresh = () => true, onData }) => {
    let timer;
    let request;
    let pageLeft = false;
    let sessionEnded = false;

    function canRefresh() {
      return !sessionEnded && !pageLeft && !document.hidden && element.isConnected;
    }

    function scheduleRefresh() {
      clearTimeout(timer);
      if (canRefresh()) timer = setTimeout(refresh, refreshInterval);
    }

    async function refresh() {
      clearTimeout(timer);
      if (!canRefresh() || request) return;
      if (!shouldRefresh()) {
        scheduleRefresh();
        return;
      }

      const current = new AbortController();
      request = current;
      const deadline = setTimeout(() => current.abort(), requestTimeout);
      try {
        const response = await window.CTFd.fetch(url, {
          redirect: "manual",
          signal: current.signal,
        });
        if (response.status === 401 || response.status === 403 || response.type === "opaqueredirect") {
          sessionEnded = true;
          return;
        }
        if (!response.ok) return;
        const { data } = await response.json();
        if (!Array.isArray(data) || current.signal.aborted || !canRefresh()) return;
        await onData(data);
      } catch {
        // Keep the current page usable and retry on the next poll.
      } finally {
        clearTimeout(deadline);
        request = undefined;
        scheduleRefresh();
      }
    }

    function updateVisibility() {
      if (!canRefresh()) {
        clearTimeout(timer);
        request?.abort();
        return;
      }
      refresh();
    }

    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("pagehide", () => {
      pageLeft = true;
      updateVisibility();
    });
    window.addEventListener("pageshow", event => {
      if (!event.persisted) return;
      pageLeft = false;
      updateVisibility();
    });
    scheduleRefresh();

    return () => request?.abort();
  };
})();
