(() => {
  const main = document.querySelector("main");
  if (!main) return;

  const modalTitles = {
    "Confirm Team Removal": "팀원 이동 확인",
    "Remove Member": "팀원 제외",
    "Delete Team": "팀 삭제",
    "Delete Teams": "선택한 팀 삭제",
    "Edit Teams": "선택한 팀 수정",
    "Correct Submissions": "정답 처리",
    "Delete Solves": "정답 제출 삭제",
    "Delete Fails": "오답 제출 삭제",
    "Delete Awards": "보상 삭제",
    "Mark Correct": "정답 처리",
    "User Attribution": "제출자 선택",
  };
  const footerLabels = { Yes: "예", No: "아니요", Submit: "저장", "Mark Correct": "정답 처리" };
  const deleteLabels = { team: "팀", solve: "정답 제출", fail: "오답 제출", award: "보상" };
  const recordWarning = "All of their challenge solves, attempts, awards, and unlocked hints will also be deleted!";
  const translatedWarning = "이 참가자의 정답·오답 제출, 보상, 잠금 해제한 힌트 기록도 삭제됩니다.";

  function translateText(node, from, to) {
    if (node?.textContent.trim() === from) {
      node.textContent = node.textContent.replace(from, to);
    }
  }

  function translateMemberForm(modal) {
    const input = modal.querySelector('.modal-body input[placeholder="Search for users"]');
    if (input) input.placeholder = "참가자 검색";
    modal.querySelectorAll(".modal-body .form-group > label").forEach(label => {
      translateText(label, "Search Users", "참가자 검색");
    });
    modal.querySelectorAll(".modal-body .text-center > .text-muted").forEach(label => {
      translateText(label, "No users found", "검색 결과가 없습니다.");
    });
    modal.querySelectorAll(".modal-body .list-group-item > small").forEach(label => {
      translateText(label, "already in a team", "다른 팀에 소속됨");
    });
    modal.querySelectorAll(".modal-body button.btn-success").forEach(button => {
      translateText(button, "Add Users", "선택한 참가자 추가");
    });
  }

  function translateBulkEdit(modal) {
    const banned = modal.querySelector('#teams-bulk-edit select[name="banned"]');
    const hidden = modal.querySelector('#teams-bulk-edit select[name="hidden"]');
    for (const [field, title, enabled, disabled] of [
      [banned, "차단", "차단함", "차단 해제"],
      [hidden, "숨김", "숨김", "공개"],
    ]) {
      if (!field) continue;
      const label = field.parentElement.querySelector("label");
      translateText(label, field === banned ? "Banned" : "Hidden", title);
      translateText(field.querySelector('option[value="true"]'), "True", enabled);
      translateText(field.querySelector('option[value="false"]'), "False", disabled);
    }
  }

  function translateDialogBody(modal, title) {
    if (title === "Edit Teams") {
      translateBulkEdit(modal);
      return;
    }

    const paragraph = modal.querySelector(".modal-body > p");
    if (!paragraph) return;
    const text = Array.from(paragraph.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
    const bold = paragraph.querySelectorAll(":scope > strong");

    if (title === "Confirm Team Removal") {
      // The second text node holds the selected participant names.
      translateText(text[0], "The following users are currently in teams:", "다음 참가자는 이미 팀에 소속되어 있습니다.");
      translateText(text[2], "Are you sure you want to remove them from their current teams and add them to this one?", "기존 팀에서 제외하고 이 팀으로 이동할까요?");
      translateText(text[3], recordWarning, translatedWarning);
    } else if (title === "Remove Member") {
      translateText(text[0], "Are you sure you want to remove", "팀원");
      translateText(text[1], "from", "님을");
      translateText(text[2], "?", " 팀에서 제외할까요?");
      translateText(bold[2], recordWarning, translatedWarning);
    } else if (title === "Delete Team") {
      translateText(text[0], "Are you sure you want to delete", "다음 팀을 삭제할까요?");
    } else if (text.length === 1 && !bold.length) {
      const prompt = text[0].textContent.trim();
      const deletion = prompt.match(/^Are you sure you want to delete (\d+) (team|solve|fail|award)s?\?$/);
      const correction = prompt.match(/^Are you sure you want to mark (\d+) submissions? correct\?$/);
      const markCorrect = prompt.match(/^Are you sure you want to mark (\d+) challenges? correct for (.+)\?$/);
      const attribution = prompt.match(/^Which user on (.+) solved these challenges\?$/);
      if (deletion) text[0].textContent = `${deleteLabels[deletion[2]]} ${deletion[1]}건을 삭제할까요?`;
      if (correction) text[0].textContent = `제출 ${correction[1]}건을 정답 처리할까요?`;
      if (markCorrect) text[0].textContent = `${markCorrect[2]} 팀의 문제 ${markCorrect[1]}개를 정답 처리할까요?`;
      if (attribution) text[0].textContent = `${attribution[1]} 팀에서 이 문제를 해결한 참가자를 선택하세요.`;
    }
  }

  function translateModal(modal) {
    if (modal.id === "team-add-modal") {
      translateMemberForm(modal);
      return;
    }
    const titleElement = modal.querySelector(".modal-header .modal-title");
    const title = titleElement?.textContent.trim();
    if (!Object.hasOwn(modalTitles, title)) return;

    translateDialogBody(modal, title);
    const close = modal.querySelector('.modal-header [aria-label="Close"]');
    if (close) close.setAttribute("aria-label", "닫기");
    modal.querySelectorAll(".modal-footer button").forEach(button => {
      const label = button.textContent.trim();
      if (Object.hasOwn(footerLabels, label)) translateText(button, label, footerLabels[label]);
    });
    translateText(titleElement, title, modalTitles[title]);
  }

  main.querySelectorAll(".modal").forEach(translateModal);
  new MutationObserver(records => {
    const modals = new Set();
    for (const record of records) {
      const element = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      const parent = element?.closest(".modal");
      if (parent) {
        modals.add(parent);
        continue;
      }
      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches(".modal")) modals.add(node);
        node.querySelectorAll(".modal").forEach(modal => modals.add(modal));
      }
    }
    modals.forEach(translateModal);
  }).observe(main, { childList: true, characterData: true, subtree: true });
})();
