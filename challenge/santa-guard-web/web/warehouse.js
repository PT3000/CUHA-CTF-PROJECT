(() => {
  "use strict";
  const root = document.getElementById("poly-game");
  if (!root) return;

  const board = document.getElementById("poly-board");
  const tray = document.getElementById("poly-tray");
  const rotateButton = document.getElementById("poly-rotate");
  const removeButton = document.getElementById("poly-remove");
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.id = "poly-reset";
  resetButton.textContent = "이 단계 초기화";
  document.getElementById("poly-board-size").after(resetButton);
  const status = document.getElementById("poly-status");
  const reloadButton = document.getElementById("poly-reload");
  const stageNames = ["작은 선물 창고", "회전 작업장", "고정 화물 창고", "다락 창고"];
  const ghost = document.createElement("div");
  ghost.setAttribute("aria-hidden", "true");
  ghost.hidden = true;
  const dragLayer = document.createElement("div");
  dragLayer.className = "poly-drag-layer";
  dragLayer.append(ghost);
  document.body.append(dragLayer);

  let game;
  let selected = null;
  let aim = null;
  let cursor = {x: 0, y: 0};
  let rotations = new Map();
  let floors = new Map();
  let occupants = new Map();
  let busy = false;
  let uncertain = false;
  let gesture = null;
  let pointerGrip = null;
  let hoverPoint = null;
  let skipClick = false;
  let scrollFrame = 0;

  const key = (x, y) => x + "," + y;
  const cellAt = (x, y) => board.children[y * game.size + x];
  const pieceById = id => game.pieces.find(piece => piece.id === id);
  const color = id => "poly-color-" + (game.pieces.findIndex(piece => piece.id === id) % 9);
  const angle = id => rotations.get(id) ?? game.layout[id]?.rotation ?? 0;
  const locked = () => busy || uncertain;

  function shape(piece, rotation) {
    let cells = piece.cells;
    for (let turn = 0; turn < rotation; turn++) {
      cells = cells.map(([x, y]) => [-y, x]);
    }
    const left = Math.min(...cells.map(([x]) => x));
    const top = Math.min(...cells.map(([, y]) => y));
    return cells.map(([x, y]) => [x - left, y - top]);
  }

  function miniShape(cells) {
    const mini = document.createElement("span");
    mini.className = "poly-mini";
    mini.setAttribute("aria-hidden", "true");
    const cellsSet = new Set(cells.map(([x, y]) => key(x, y)));
    const width = Math.max(...cells.map(([x]) => x)) + 1;
    const height = Math.max(...cells.map(([, y]) => y)) + 1;
    for (let y = 0; y < height; y++) {
      const row = document.createElement("span");
      row.className = "poly-mini-row";
      for (let x = 0; x < width; x++) {
        const dot = document.createElement("span");
        dot.className = "poly-mini-cell";
        if (cellsSet.has(key(x, y))) {
          dot.classList.add("filled");
          dot.dataset.dx = x;
          dot.dataset.dy = y;
        }
        row.append(dot);
      }
      mini.append(row);
    }
    return mini;
  }

  function message(text, error = false) {
    status.textContent = text;
    status.dataset.error = String(error);
  }

  function fits(id, origin) {
    return shape(pieceById(id), angle(id)).every(([dx, dy]) => {
      const x = origin.x + dx;
      const y = origin.y + dy;
      const pos = key(x, y);
      return x >= 0 && x < game.size && y >= 0 && y < game.size && !floors.has(pos)
        && (!occupants.has(pos) || occupants.get(pos) === id);
    });
  }

  function preview(origin) {
    aim = origin;
    board.querySelectorAll("[data-preview]").forEach(cell => { delete cell.dataset.preview; });
    if (!selected || !origin || locked()) return;
    const state = fits(selected, origin) ? "valid" : "invalid";
    for (const [dx, dy] of shape(pieceById(selected), angle(selected))) {
      const x = origin.x + dx;
      const y = origin.y + dy;
      if (x >= 0 && x < game.size && y >= 0 && y < game.size) {
        cellAt(x, y).dataset.preview = state;
      }
    }
  }

  function syncControls() {
    for (const button of tray.children) {
      const id = button.dataset.piece;
      const rotation = angle(id);
      if (button.dataset.rotation !== String(rotation)) {
        button.querySelector(".poly-mini")?.remove();
        button.prepend(miniShape(shape(pieceById(id), rotation)));
        button.dataset.rotation = rotation;
      }
      button.setAttribute("aria-pressed", String(id === selected));
      button.toggleAttribute("data-placed", Boolean(game.layout[id]));
      button.setAttribute("aria-label", pieceById(id).name + (game.layout[id] ? ", 배치됨" : ", 미배치"));
      button.disabled = locked();
    }
    for (const cell of board.children) {
      cell.toggleAttribute("data-selected", Boolean(selected) && selected === cell.dataset.occupant);
    }
    rotateButton.disabled = locked() || !selected;
    removeButton.disabled = locked() || !selected || !game.layout[selected];
    resetButton.disabled = locked();
    root.setAttribute("aria-busy", String(busy));
    reloadButton.hidden = !uncertain;
  }

  function focusCell(point, moveFocus) {
    cellAt(cursor.x, cursor.y).tabIndex = -1;
    cursor = point;
    const cell = cellAt(point.x, point.y);
    cell.tabIndex = 0;
    if (moveFocus) cell.focus();
  }

  function setGame(next) {
    const newStage = next.stage !== game?.stage;
    game = next;
    selected = null;
    aim = null;
    pointerGrip = null;
    hoverPoint = null;
    root.dataset.stage = game.stage;
    root.dataset.version = game.version;
    if (newStage) {
      rotations = new Map();
      cursor = {x: 0, y: 0};
      board.dataset.size = game.size;
      board.replaceChildren();
      for (let y = 0; y < game.size; y++) {
        for (let x = 0; x < game.size; x++) {
          const cell = document.createElement("button");
          cell.type = "button";
          cell.dataset.x = x;
          cell.dataset.y = y;
          cell.tabIndex = x === 0 && y === 0 ? 0 : -1;
          board.append(cell);
        }
      }
      tray.replaceChildren();
      for (const piece of game.pieces) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "poly-piece " + color(piece.id);
        button.dataset.piece = piece.id;
        const name = document.createElement("span");
        name.textContent = piece.name;
        button.append(name);
        tray.append(button);
      }
    }
    floors = new Map();
    game.blocked.forEach(([x, y]) => floors.set(key(x, y), "blocked"));
    game.outside.forEach(([x, y]) => floors.set(key(x, y), "outside"));
    occupants = new Map();
    for (const [id, placement] of Object.entries(game.layout)) {
      rotations.set(id, placement.rotation);
      for (const [dx, dy] of shape(pieceById(id), placement.rotation)) {
        occupants.set(key(placement.x + dx, placement.y + dy), id);
      }
    }
    for (const cell of board.children) {
      const x = Number(cell.dataset.x);
      const y = Number(cell.dataset.y);
      const pos = key(x, y);
      const id = occupants.get(pos);
      const floor = floors.get(pos) || "empty";
      cell.className = "poly-cell" + (id ? " " + color(id) : "");
      cell.dataset.floor = floor;
      delete cell.dataset.preview;
      if (id) cell.dataset.occupant = id;
      else delete cell.dataset.occupant;
      const label = id ? pieceById(id).name : ({blocked:"고정 화물", outside:"창고 밖", empty:"빈칸"})[floor];
      cell.setAttribute("aria-label", (y + 1) + "행 " + (x + 1) + "열 " + label);
    }
    document.getElementById("poly-stage-text").textContent = game.stage + "단계";
    document.getElementById("poly-stage-name").textContent = stageNames[game.stage - 1];
    document.getElementById("poly-board-size").textContent = game.size + " × " + game.size;
    document.getElementById("poly-area").textContent = "채운 칸 " + occupants.size + " / " + (game.size ** 2 - floors.size);
    document.getElementById("poly-count").textContent = Object.keys(game.layout).length + " / " + game.pieces.length + " 배치";
    document.getElementById("poly-fixed-key").hidden = game.blocked.length === 0;
    for (const item of document.querySelectorAll("#poly-stages li")) {
      const step = Number(item.dataset.step);
      item.dataset.state = step < game.stage ? "complete" : "pending";
      if (step === game.stage) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
      item.setAttribute("aria-label", step + "단계" + (step < game.stage ? " 완료" : ""));
    }
    syncControls();
  }

  function select(id, grip = centerGrip(shape(pieceById(id), angle(id)))) {
    if (selected && selected !== id && game.layout[selected]) {
      rotations.set(selected, game.layout[selected].rotation);
    }
    selected = id;
    pointerGrip = grip;
    const placement = game.layout[id];
    preview(placement ? {x: placement.x, y: placement.y} : null);
    syncControls();
    message(pieceById(id).name + " 선택");
  }

  async function recover() {
    const response = await fetch(root.dataset.endpoint, {cache:"no-store"});
    if (response.redirected) { location.assign(response.url); return; }
    if (!response.ok) throw new Error();
    const page = new DOMParser().parseFromString(await response.text(), "text/html");
    const snapshot = page.querySelector("#poly-game");
    if (!snapshot) throw new Error();
    setGame(JSON.parse(snapshot.dataset.game));
    message("서버에 저장된 배치를 다시 불러왔습니다.");
  }

  async function save(layout, success) {
    if (locked()) return;
    busy = true;
    preview(null);
    syncControls();
    const oldStage = game.stage;
    try {
      const response = await fetch(root.dataset.endpoint, {
        method: "POST", headers: {"Content-Type":"application/json", "X-CSRF-Token":document.querySelector('meta[name="csrf-token"]').content},
        body: JSON.stringify({stage: game.stage, version: game.version, layout}),
      });
      if (response.redirected) { location.assign(response.url); return; }
      const result = await response.json();
      if (result.reward && (response.ok || response.status === 409)) { location.assign(result.reward); return; }
      if (result.game && (response.ok || response.status === 409)) {
        setGame(result.game);
        if (response.status === 409) message(result.message || "다른 창에서 변경한 배치를 불러왔습니다.");
        else message(game.stage !== oldStage ? oldStage + "단계 완료! 다음 창고를 열었습니다." : success);
      } else if (response.status === 422) {
        message(result.message || "그 위치에 블록을 놓을 수 없습니다.", true);
      } else {
        throw new Error();
      }
    } catch {
      try { await recover(); }
      catch {
        uncertain = true;
        message("저장 상태를 확인할 수 없습니다. 연결을 확인한 뒤 다시 불러와 주세요.", true);
      }
    } finally {
      busy = false;
      syncControls();
    }
  }

  function place(origin) {
    if (!selected || locked()) return;
    if (!fits(selected, origin)) {
      preview(origin);
      message("블록이 모두 들어가는 빈칸을 골라 주세요.", true);
      return;
    }
    const id = selected;
    const previous = game.layout[id];
    const rotation = angle(id);
    if (previous && previous.x === origin.x && previous.y === origin.y && previous.rotation === rotation) {
      message("이미 이 위치에 놓여 있습니다.");
      return;
    }
    save({...game.layout, [id]: {x: origin.x, y: origin.y, rotation}}, pieceById(id).name + " 배치 완료");
  }

  function remove() {
    if (!selected || !game.layout[selected] || locked()) return;
    const layout = {...game.layout};
    delete layout[selected];
    save(layout, pieceById(selected).name + " 블록을 꺼냈습니다.");
  }

  function rotate() {
    if (!selected || locked()) return;
    const oldShape = shape(pieceById(selected), angle(selected));
    const rotation = (angle(selected) + 1) % 4;
    rotations.set(selected, rotation);
    syncControls();
    pointerGrip = rotateGrip(pointerGrip, oldShape);
    if (gesture?.dragging) {
      gesture.grip = rotateGrip(gesture.grip, oldShape);
      ghost.replaceChildren(miniShape(shape(pieceById(selected), rotation)));
      moveGhost(gesture.lastX, gesture.lastY);
    } else if (hoverPoint) {
      preview(dragPosition(hoverPoint.x, hoverPoint.y, pointerGrip).origin);
    } else {
      preview(aim);
    }
    message(pieceById(selected).name + " " + (rotation * 90) + "°. 놓을 위치를 선택하세요.");
  }

  function pointAt(event) {
    return {x: Number(event.dataset.x), y: Number(event.dataset.y)};
  }

  // Grips are continuous coordinates in block cells, including the point inside a square.
  function centerGrip(cells) {
    const x = cells.reduce((sum, cell) => sum + cell[0] + 0.5, 0) / cells.length;
    const y = cells.reduce((sum, cell) => sum + cell[1] + 0.5, 0) / cells.length;
    if (cells.some(([dx, dy]) => x >= dx && x <= dx + 1 && y >= dy && y <= dy + 1)) return {x, y};
    const distance = ([dx, dy]) => (dx + 0.5 - x) ** 2 + (dy + 0.5 - y) ** 2;
    const [dx, dy] = cells.reduce((best, cell) => distance(cell) < distance(best) ? cell : best);
    return {x: dx + 0.5, y: dy + 0.5};
  }

  function rotateGrip(grip, cells) {
    const height = Math.max(...cells.map(([, y]) => y)) + 1;
    return {x: height - grip.y, y: grip.x};
  }

  function gripAt(tile, event, id) {
    const fromBoard = Boolean(tile.dataset.occupant);
    const square = fromBoard ? tile : event.target.closest(".poly-mini-cell.filled");
    const piece = pieceById(id);
    if (!square || (event.type === "click" && event.detail === 0)) return centerGrip(shape(piece, angle(id)));
    const rect = square.getBoundingClientRect();
    let grip = {x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height};
    if (!fromBoard) {
      return {x: Number(square.dataset.dx) + grip.x, y: Number(square.dataset.dy) + grip.y};
    }
    const placed = game.layout[id];
    grip.x += Number(tile.dataset.x) - placed.x;
    grip.y += Number(tile.dataset.y) - placed.y;
    for (let turn = placed.rotation; turn !== angle(id); turn = (turn + 1) % 4) {
      grip = rotateGrip(grip, shape(piece, turn));
    }
    return grip;
  }

  function dragPosition(clientX, clientY, grip, fromBoard = false) {
    const first = board.firstElementChild.getBoundingClientRect();
    const last = board.lastElementChild.getBoundingClientRect();
    const width = (last.right - first.left) / game.size;
    const height = (last.bottom - first.top) / game.size;
    const left = clientX - grip.x * width;
    const top = clientY - grip.y * height;
    const overBoard = clientX >= first.left && clientX < last.right && clientY >= first.top && clientY < last.bottom;
    let origin = overBoard ? {
      x: Math.round((left - first.left) / width),
      y: Math.round((top - first.top) / height),
    } : null;
    if (fromBoard && origin) {
      const col = Math.floor((clientX - first.left) / width);
      const row = Math.floor((clientY - first.top) / height);
      if (floors.get(key(col, row)) === "outside" && !fits(selected, origin)) origin = null;
    }
    return {left, top, width, height, origin};
  }

  function moveGhost(clientX, clientY) {
    gesture.lastX = clientX;
    gesture.lastY = clientY;
    const frame = dragPosition(clientX, clientY, gesture.grip, gesture.fromBoard);
    ghost.style.setProperty("--drag-cell-width", frame.width + "px");
    ghost.style.setProperty("--drag-cell-height", frame.height + "px");
    ghost.style.transform = "translate(" + frame.left + "px," + frame.top + "px)";
    ghost.toggleAttribute("data-over-board", Boolean(frame.origin));
    ghost.hidden = false;
    preview(frame.origin);
  }

  function scrollDuringDrag() {
    if (!gesture?.dragging) return;
    const {lastX, lastY} = gesture;
    const edge = 48;
    const distance = lastY < edge ? lastY - edge : Math.max(0, lastY - (innerHeight - edge));
    if (distance) {
      const before = window.scrollY;
      window.scrollBy(0, Math.max(-12, Math.min(12, distance / 4)));
      if (window.scrollY !== before) moveGhost(lastX, lastY);
    }
    scrollFrame = requestAnimationFrame(scrollDuringDrag);
  }

  function endGesture() {
    cancelAnimationFrame(scrollFrame);
    if (gesture && root.hasPointerCapture(gesture.pointer)) root.releasePointerCapture(gesture.pointer);
    gesture = null;
    delete root.dataset.dragging;
    ghost.hidden = true;
  }

  root.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0 || locked() || gesture) return;
    const tile = event.target.closest("[data-piece], .poly-cell[data-occupant]");
    if (!tile) return;
    const id = tile.dataset.piece || tile.dataset.occupant;
    gesture = {
      id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY,
      grip: gripAt(tile, event, id), dragging: false, fromBoard: Boolean(tile.dataset.occupant),
    };
  });

  document.addEventListener("pointermove", event => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    if (!gesture.dragging) {
      if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 6) return;
      gesture.dragging = true;
      root.setPointerCapture(event.pointerId);
      select(gesture.id, gesture.grip);
      root.dataset.dragging = gesture.id;
      hoverPoint = null;
      scrollFrame = requestAnimationFrame(scrollDuringDrag);
      ghost.className = "poly-float " + color(selected);
      ghost.replaceChildren(miniShape(shape(pieceById(selected), angle(selected))));
    }
    event.preventDefault();
    moveGhost(event.clientX, event.clientY);
  }, {passive:false});

  document.addEventListener("pointerup", event => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    const {dragging, fromBoard, grip} = gesture;
    endGesture();
    if (!dragging) return;
    skipClick = true;
    setTimeout(() => { skipClick = false; }, 0);
    const {origin} = dragPosition(event.clientX, event.clientY, grip, fromBoard);
    if (origin) place(origin);
    else if (fromBoard) remove();
    else preview(null);
  });

  document.addEventListener("pointercancel", event => {
    if (gesture?.pointer === event.pointerId) { endGesture(); preview(null); }
  });
  window.addEventListener("blur", () => { endGesture(); preview(null); });

  root.addEventListener("click", event => {
    if (skipClick || locked()) return;
    const piece = event.target.closest("[data-piece]");
    if (piece) {
      select(piece.dataset.piece, gripAt(piece, event, piece.dataset.piece));
      if (event.detail === 0) {
        const placed = game.layout[selected];
        focusCell(placed ? {x: placed.x, y: placed.y} : cursor, true);
        preview(cursor);
      } else if (matchMedia("(max-width: 750px)").matches && board.getBoundingClientRect().top < 0) {
        board.scrollIntoView({block: "center"});
      }
      return;
    }
    const cell = event.target.closest(".poly-cell");
    if (!cell) return;
    const pos = pointAt(cell);
    focusCell(pos, false);
    if (selected) {
      const useGrip = event.detail > 0 && event.pointerType === "mouse";
      const origin = useGrip ? dragPosition(event.clientX, event.clientY, pointerGrip).origin : pos;
      if (origin) place(origin);
    } else if (cell.dataset.occupant) {
      select(cell.dataset.occupant, gripAt(cell, event, cell.dataset.occupant));
      if (event.detail === 0) focusCell(game.layout[selected], true);
    }
    else message("먼저 선물 블록을 선택하세요.");
  });

  board.addEventListener("pointermove", event => {
    if (event.pointerType === "touch" || gesture?.dragging || !selected || locked()) return;
    hoverPoint = {x: event.clientX, y: event.clientY};
    preview(dragPosition(event.clientX, event.clientY, pointerGrip).origin);
  });
  board.addEventListener("pointerleave", () => {
    hoverPoint = null;
    if (!gesture?.dragging) preview(null);
  });
  board.addEventListener("focusin", event => {
    if (event.target.matches(".poly-cell")) {
      focusCell(pointAt(event.target), false);
      if (selected && !gesture?.dragging) {
        preview(hoverPoint ? dragPosition(hoverPoint.x, hoverPoint.y, pointerGrip).origin : cursor);
      }
    }
  });
  root.addEventListener("keydown", event => {
    if (locked() || event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-piece], .poly-cell")) {
      event.preventDefault();
      if (!event.repeat) event.target.click();
    } else if (event.key.toLowerCase() === "r" && selected) {
      event.preventDefault();
      if (!event.repeat) rotate();
    } else if (event.key === "Escape") {
      endGesture();
      if (selected && game.layout[selected]) rotations.set(selected, game.layout[selected].rotation);
      selected = null;
      preview(null);
      syncControls();
      message("선택을 해제했습니다.");
    } else if (event.target.matches(".poly-cell")) {
      const direction = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
      if (!direction) return;
      event.preventDefault();
      hoverPoint = null;
      const x = Math.max(0, Math.min(cursor.x + direction[0], game.size - 1));
      const y = Math.max(0, Math.min(cursor.y + direction[1], game.size - 1));
      focusCell({x, y}, true);
      if (selected) preview(cursor);
    }
  });

  rotateButton.addEventListener("click", rotate);
  removeButton.addEventListener("click", remove);
  resetButton.addEventListener("click", () => {
    if (locked() || gesture) return;
    rotations.clear();
    save({}, game.stage + "단계를 초기화했습니다.");
  });
  reloadButton.addEventListener("click", () => location.reload());
  setGame(JSON.parse(root.dataset.game));
})();
