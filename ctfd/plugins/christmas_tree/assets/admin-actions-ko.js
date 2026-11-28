(() => {
  const modeWarnings = new Map([
    ["Are you sure you'd like to switch user modes?\n\nAll submissions, awards, unlocks, and tracking will be deleted!", "참가 방식을 변경하시겠습니까?\n\n모든 제출, 보상, 잠금 해제 및 활동 기록이 삭제됩니다."],
    ["Are you sure you'd like to switch user modes?\n\nAll teams, submissions, awards, unlocks, and tracking will be deleted!", "참가 방식을 변경하시겠습니까?\n\n모든 팀과 제출, 보상, 잠금 해제 및 활동 기록이 삭제됩니다."],
  ]);
  const flagWarnings = new Map([
    ["Are you sure you'd like to delete this flag?", "이 플래그를 삭제하시겠습니까?"],
  ]);

  function translateNextConfirmation(messages) {
    const nativeConfirm = window.confirm;
    const localizedConfirm = message => nativeConfirm.call(window, messages.get(message) ?? message);
    window.confirm = localizedConfirm;
    setTimeout(() => {
      if (window.confirm === localizedConfirm) window.confirm = nativeConfirm;
    }, 0);
  }

  document.getElementById("user-mode-form")?.addEventListener("submit", () => {
    translateNextConfirmation(modeWarnings);
  }, true);
  document.getElementById("challenge-flags")?.addEventListener("click", event => {
    if (event.target.closest?.(".delete-flag")) translateNextConfirmation(flagWarnings);
  }, true);

  const main = document.querySelector("main");
  const submissions = document.getElementById("teamsboard") && document.getElementById("submission-delete-button");
  const flags = document.getElementById("challenge-flags");
  const files = document.getElementById("challenge-files");
  if (!main || (!submissions && !flags && !files)) return;

  const flagLabels = new Map([
    ["Type", "유형"], ["Flag", "플래그"], ["Settings", "설정"],
    ["Create Flag", "플래그 추가"], ["Edit Flag", "플래그 수정"],
    ["Choose Flag Type", "플래그 유형 선택"],
    ["Static", "고정값"], ["static", "고정값"],
    ["Regex", "정규 표현식"], ["regex", "정규 표현식"], ["Regex Flag", "정규 표현식 플래그"],
    ["Enter static flag data", "고정 플래그를 입력하세요."],
    ["Enter regex flag data", "플래그를 확인할 정규 표현식을 입력하세요."],
    ["Enter regex key data", "플래그를 확인할 정규 표현식을 입력하세요."],
    ["Case Sensitive", "대소문자 구분"], ["Case Insensitive", "대소문자 무시"],
    ["Examples", "예시"], ["Description", "설명"], ["Update", "저장"],
    ["Match any content inside of flag{}:", "flag{} 안의 모든 문자열과 일치"],
    ["Match numeric flags:", "숫자로 이루어진 플래그와 일치"],
    ["Accept flags with or without the flag format prefix:", "flag{} 형식을 붙인 값과 붙이지 않은 값 모두 허용"],
  ]);
  const fileLabels = new Map([
    ["File", "파일"], ["Settings", "설정"],
    ["Attach multiple files using Control+Click or Cmd+Click.", "Ctrl 또는 Cmd를 누른 채 클릭하면 여러 파일을 선택할 수 있습니다."],
  ]);
  const buttons = new Map([["Yes", "예"], ["No", "아니요"], ["Cancel", "취소"]]);

  function translateLabels(root, selector, labels) {
    if (!root) return;
    for (const element of root.querySelectorAll(selector)) {
      for (const node of element.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const text = node.data.trim();
        if (labels.has(text)) node.data = node.data.replace(text, labels.get(text));
      }
    }
  }

  function translateDialog(modal) {
    const title = modal.querySelector(".modal-title");
    const body = modal.querySelector(".modal-body > p");
    const heading = title?.textContent.trim();
    if (!body) return;
    const message = body.textContent.trim();
    if (heading === "Delete Submission" && submissions) {
      const names = body.querySelectorAll("strong");
      if (names.length !== 2 || !message.startsWith("Are you sure you want to delete correct submission from ")) return;
      const [team, challenge] = names;
      title.textContent = "제출 삭제";
      body.replaceChildren("문제 ", challenge, "에 대한 ", team, "의 정답 제출을 삭제하시겠습니까?");
    } else if (heading === "Delete Submissions" && submissions) {
      const deletion = message.match(/^Are you sure you want to delete (\d+) submissions?\?$/);
      if (!deletion) return;
      title.textContent = "선택한 제출 삭제";
      body.textContent = `제출 ${deletion[1]}건을 삭제하시겠습니까?`;
    } else if (submissions && ["Correct Submissions", "Incorrect Submissions"].includes(heading)) {
      const correction = message.match(/^Are you sure you want to mark (\d+) submissions? (correct|incorrect)\?$/);
      if (!correction) return;
      const result = correction[2] === "correct" ? "정답" : "오답";
      title.textContent = `${result} 처리`;
      body.textContent = `제출 ${correction[1]}건을 ${result}으로 처리하시겠습니까?`;
    } else if (heading === "Delete Files" && files && message === "Are you sure you want to delete this file?") {
      title.textContent = "첨부 파일 삭제";
      body.textContent = "이 첨부 파일을 삭제하시겠습니까?";
    } else {
      return;
    }
    translateLabels(modal, ".modal-footer button", buttons);
    modal.querySelector('[aria-label="Close"]')?.setAttribute("aria-label", "닫기");
  }

  function translateFlagControls() {
    translateLabels(flags, "thead b, h3, label, small, option, button, tbody td:first-child, th", flagLabels);
    for (const close of flags?.querySelectorAll('[aria-label="Close"]') ?? []) {
      close.setAttribute("aria-label", "닫기");
    }
  }

  function translateFileControls() {
    translateLabels(files, "thead b, sub", fileLabels);
    const upload = files?.querySelector('input[type="submit"][value="Upload"]');
    if (upload) upload.value = "업로드";
  }

  const dialogSelector = '.modal[role="dialog"]';
  translateFlagControls();
  translateFileControls();
  main.querySelectorAll(`:scope > ${dialogSelector}`).forEach(translateDialog);

  new MutationObserver(records => {
    let flagsChanged = false;
    let filesChanged = false;
    const dialogs = new Set();

    for (const { target, addedNodes } of records) {
      flagsChanged ||= flags?.contains(target) ?? false;
      filesChanged ||= files?.contains(target) ?? false;
      const changed = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
      const modal = changed?.closest(dialogSelector);
      if (modal?.parentElement === main) dialogs.add(modal);

      if (target === main) {
        for (const node of addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && node.matches(dialogSelector)) dialogs.add(node);
        }
      }
    }

    if (flagsChanged) translateFlagControls();
    if (filesChanged) translateFileControls();
    dialogs.forEach(translateDialog);
  }).observe(main, { childList: true, characterData: true, subtree: true });
})();
