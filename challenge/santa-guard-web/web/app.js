"use strict";

const byId = (id) => document.getElementById(id);
const csrf = document.querySelector('meta[name="csrf-token"]').content;

function notice(id, message = "", error = false) {
  const el = byId(id);
  el.textContent = message;
  el.hidden = !message;
  el.classList.toggle("error", error);
}

async function call(path, body) {
  const response = await fetch(path, body === undefined ? {} : {
    method: "POST",
    headers: {"Content-Type": "application/json", "X-CSRF-Token": csrf},
    body: JSON.stringify(body),
  });
  if (response.redirected) throw new Error("세션이 끝났습니다. 페이지를 새로고침해 주세요.");
  if (!(response.headers.get("Content-Type") || "").includes("application/json")) {
    throw new Error("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || "요청을 처리하지 못했습니다.");
    error.handoffNotes = data.handoff_notes;
    throw error;
  }
  return data;
}

const flagForm = byId("flag-form");
if (flagForm) {
  flagForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    if (button) button.disabled = true;
    notice("flag-notice");
    try {
      const result = await call(flagForm.getAttribute("action"), Object.fromEntries(new FormData(flagForm)));
      notice("flag-notice", result.message);
    } catch (error) {
      notice("flag-notice", error.message, true);
    } finally {
      if (button) button.disabled = false;
    }
  });
}

const toggle = byId("chat-toggle");
if (toggle) {
  const panel = byId("guard-panel");
  const question = byId("question");
  let loaded = false;
  let busy = false;

  function render({messages}) {
    const items = messages.map(({role, text}) => {
      const element = document.createElement("p");
      element.className = role === "visitor" ? "msg visitor" : "msg";
      element.textContent = text;
      return element;
    });
    const log = byId("messages");
    log.replaceChildren(...items);
    log.scrollTop = log.scrollHeight;
  }

  async function show(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (!open) {
      toggle.focus();
      return;
    }
    question.focus();
    if (loaded || busy) return;
    busy = true;
    try {
      render(await call("/api/chat"));
      loaded = true;
    } catch (error) {
      notice("chat-status", error.message, true);
    } finally {
      busy = false;
    }
  }

  async function chat(path, body, status) {
    if (busy) return false;
    busy = true;
    const controls = [byId("chat-reset"), byId("chat-form").querySelector("button")];
    controls.forEach((button) => {button.disabled = true;});
    const head = panel.querySelector(".chat-head");
    head.classList.add("is-thinking");
    panel.setAttribute("aria-busy", "true");
    notice("chat-status", status);
    try {
      render(await call(path, body));
      loaded = true;
      byId("handoff-notes").hidden = true;
      notice("chat-status");
      return true;
    } catch (error) {
      notice("chat-status", error.message, true);
      if (typeof error.handoffNotes === "string") {
        byId("handoff-note-text").textContent = error.handoffNotes;
        byId("handoff-notes").hidden = false;
      }
      return false;
    } finally {
      busy = false;
      head.classList.remove("is-thinking");
      panel.setAttribute("aria-busy", "false");
      controls.forEach((button) => {button.disabled = false;});
    }
  }

  toggle.addEventListener("click", () => show(panel.hidden));
  byId("chat-help").addEventListener("click", () => show(true));
  byId("chat-close").addEventListener("click", () => show(false));
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") show(false);
  });
  byId("chat-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (question.value.trim() && await chat("/api/chat", {text: question.value}, "ELF-01이 답변을 준비하고 있어요.")) {
      question.value = "";
      if (!panel.hidden) question.focus();
    }
  });
  byId("chat-reset").addEventListener("click", () => chat("/api/chat/reset", {}, "대화 기록을 초기화하고 있어요."));
}
