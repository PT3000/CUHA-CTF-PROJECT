"use strict";

async function loadWorkshopStock(ledger) {
  const failure = ledger.querySelector(".stock-failure");
  try {
    const response = await fetch(ledger.dataset.stockUrl, {credentials: "same-origin"});
    if (!response.ok || response.redirected) throw new Error("delivery list unavailable");

    const page = new DOMParser().parseFromString(await response.text(), "text/html");
    const list = page.querySelector(".quest-list");
    if (!list) throw new Error("delivery list missing");
    const rows = Array.from(list.querySelectorAll("[data-delivery-id]"));
    for (const field of ledger.querySelectorAll("[data-stock-ref]")) {
      field.textContent = String(rows.filter(row =>
        row.dataset.deliveryId === field.dataset.stockRef && row.dataset.finished === "0"
      ).length);
    }
  } catch {
    failure.hidden = false;
  }
}

const stockLedger = document.querySelector("[data-stock-url]");
if (stockLedger) loadWorkshopStock(stockLedger);

function showWorkshopHistory() {
  const key = "santa-workshop.recent-pages";
  const log = document.querySelector("[data-visit-list]");
  const pages = {
    "/employee": "직원 대시보드",
    "/employee/delivery": "배송 기록",
    "/employee/inventory": "재고 현황",
    "/employee/notice": "공방 게시판",
    "/admin/login": "관리자 인증",
    "/admin/warehouse": "창고 정리",
    "/admin/files": "기밀 자료실"
  };
  const page = location.pathname;
  if (!Object.hasOwn(pages, page)) return;

  let entries = [];
  let storage;
  try {
    storage = window.sessionStorage;
    const saved = JSON.parse(storage.getItem(key) || "[]");
    if (Array.isArray(saved)) {
      entries = saved.filter(entry => entry && Object.hasOwn(pages, entry.page) &&
        Number.isFinite(entry.time) && entry.time > 0 && entry.time <= Date.now());
    }
  } catch {
    // The current page can still be shown when local storage is unavailable.
  }

  entries = [{page, time: Date.now()}, ...entries].slice(0, 6);
  try {
    storage?.setItem(key, JSON.stringify(entries));
  } catch {
    // Private browsing policies can restrict writes.
  }

  if (log) {
    const formatter = new Intl.DateTimeFormat("ko-KR", {hour: "2-digit", minute: "2-digit", hourCycle: "h23"});
    const items = entries.map(entry => {
      const item = document.createElement("li");
      const time = document.createElement("time");
      time.dateTime = new Date(entry.time).toISOString();
      time.textContent = formatter.format(entry.time);
      item.append(time, document.createTextNode(pages[entry.page]));
      return item;
    });
    log.replaceChildren(...items);
  }

  document.querySelector('form[action="/logout"]')?.addEventListener("submit", () => {
    try {
      storage?.removeItem(key);
    } catch {
      // A restricted storage area has no accessible history to clear.
    }
  });
}
showWorkshopHistory();