(() => {
  const refreshInterval = 8000;
  const tableSelector = "#teamsboard";
  const table = document.querySelector(tableSelector);
  const url = new URL(window.location.href);
  const page = Number(url.searchParams.get("page") || "1");

  if (!table || page !== 1) {
    return;
  }

  let timer;
  let activeRequest;
  let pageLeft = false;
  let sessionEnded = false;

  function rowSummary(row) {
    return JSON.stringify(Array.from(row.cells).slice(1).map(cell => {
      const recorded = cell.querySelector("[data-time]");
      if (recorded) return recorded.getAttribute("data-time");
      const provided = cell.querySelector("pre[title]");
      return provided ? provided.title : cell.textContent.trim();
    }));
  }

  function bindNewRow(row) {
    for (const timestamp of row.querySelectorAll("[data-time]")) {
      const { time, timeFormat } = timestamp.dataset;
      timestamp.textContent = window.dayjs?.(time).format(timeFormat || "MMMM Do, h:mm:ss A") ?? time;
    }

    const checkboxCell = row.querySelector("[data-checkbox]");
    const checkbox = checkboxCell?.querySelector("input[type=checkbox]");
    checkboxCell?.addEventListener("click", event => {
      if (event.target !== checkbox) checkbox?.click();
    });

    const flag = row.querySelector("pre[title]");
    if (!flag) return;
    const truncated = flag.textContent;
    row.querySelector(".show-flag")?.addEventListener("click", event => {
      const full = flag.classList.toggle("full-flag");
      flag.textContent = full ? flag.title : truncated;
      const icon = event.currentTarget.querySelector("i");
      icon?.classList.toggle("fa-eye", !full);
      icon?.classList.toggle("fa-eye-slash", full);
    });
    row.querySelector(".copy-flag")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      try {
        await navigator.clipboard.writeText(flag.title);
      } catch {
        return;
      }
      const tooltip = window.$?.(button);
      tooltip?.tooltip?.({ title: "복사됨", trigger: "manual" });
      tooltip?.tooltip?.("show");
      window.setTimeout(() => tooltip?.tooltip?.("dispose"), 1500);
    });
  }

  function updateRows(latest) {
    const body = table.tBodies[0];
    const currentRows = Array.from(body.rows);
    const currentSummaries = currentRows.map(rowSummary);
    const incomingRows = Array.from(latest.tBodies[0].rows);
    const incomingSummaries = incomingRows.map(rowSummary);
    if (JSON.stringify(currentSummaries) === JSON.stringify(incomingSummaries)) return;

    const existing = new Map(currentSummaries.map((summary, index) => [summary, currentRows[index]]));
    const rows = incomingRows.map((row, index) => {
      const preserved = existing.get(incomingSummaries[index]);
      if (preserved) return preserved;
      const next = document.importNode(row, true);
      bindNewRow(next);
      return next;
    });
    body.replaceChildren(...rows);
  }

  function updatePagination(latest) {
    const current = table.parentElement.querySelector(".page-select")?.parentElement;
    const incoming = latest.parentElement.querySelector(".page-select")?.parentElement;
    if (!incoming) {
      current?.remove();
      return;
    }
    if (current?.isEqualNode(incoming)) return;

    const pagination = document.importNode(incoming, true);
    pagination.querySelector(".page-select").addEventListener("change", event => {
      const destination = new URL(url);
      destination.searchParams.set("page", event.target.value);
      window.location.assign(destination);
    });
    if (current) current.replaceWith(pagination);
    else table.after(pagination);
  }

  function canRefresh() {
    return !sessionEnded && !pageLeft && document.visibilityState === "visible" && table.isConnected;
  }

  function pauseRefresh() {
    const focus = document.activeElement;
    return (
      window.getSelection()?.isCollapsed === false ||
      table.contains(focus) ||
      focus?.matches("input, select, textarea, [contenteditable]") ||
      document.querySelector(".modal.show, .modal.in, dialog[open], .dropdown-menu.show") ||
      table.querySelector("[data-submission-id]:checked, [data-checkbox-all]:checked, .full-flag") ||
      Array.from(table.querySelectorAll("thead .sort-col")).some(heading => typeof heading.asc === "boolean")
    );
  }

  function scheduleRefresh() {
    window.clearTimeout(timer);
    if (canRefresh()) timer = window.setTimeout(refreshSubmissions, refreshInterval);
  }

  async function refreshSubmissions() {
    window.clearTimeout(timer);
    if (!canRefresh() || activeRequest) return;
    if (pauseRefresh()) {
      scheduleRefresh();
      return;
    }

    const request = new AbortController();
    activeRequest = request;
    const deadline = window.setTimeout(() => request.abort(), 6000);
    try {
      const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        redirect: "manual",
        signal: request.signal,
      });
      if (response.status === 401 || response.status === 403 || response.type === "opaqueredirect") {
        sessionEnded = true;
        return;
      }
      if (response.ok) {
        const html = await response.text();
        if (request.signal.aborted || !canRefresh() || pauseRefresh()) return;
        const latestPage = new DOMParser().parseFromString(html, "text/html");
        const latest = latestPage.querySelector(tableSelector);
        if (latest?.tBodies[0]) {
          updateRows(latest);
          updatePagination(latest);
        }
      }
    } catch {
      // A failed request leaves the current view usable until the next refresh.
    } finally {
      window.clearTimeout(deadline);
      activeRequest = undefined;
      scheduleRefresh();
    }
  }

  function updateVisibility() {
    if (!canRefresh()) {
      window.clearTimeout(timer);
      activeRequest?.abort();
      return;
    }
    refreshSubmissions();
  }

  document.addEventListener("visibilitychange", updateVisibility);
  window.addEventListener("pagehide", () => {
    pageLeft = true;
    updateVisibility();
  });
  window.addEventListener("pageshow", event => {
    if (event.persisted) {
      pageLeft = false;
      updateVisibility();
    }
  });
  scheduleRefresh();
})();
