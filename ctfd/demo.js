(() => {
  const challengeLink = document.querySelector('#ctfd-challenges');
  const refreshButton = document.querySelector('#refresh-team');
  const teamFeedback = document.querySelector('#team-feedback');
  const layoutFeedback = document.querySelector('#layout-feedback');
  const treeTitle = document.querySelector('#tree-title');
  const tray = document.querySelector('#ornament-tray');
  const unlockedCount = document.querySelector('#unlocked-count');
  const placedCount = document.querySelector('#placed-count');
  const decorations = document.querySelector('#tree-decorations');
  const santa = document.querySelector('#santa');
  const santaParcel = santa.querySelector('.santa-parcel');
  const giftPackages = document.querySelector('#gift-packages').content.querySelectorAll('img');
  const giftRow = document.querySelector('#gift-row');
  const openNextGift = document.querySelector('#open-next-gift');
  const stageStatus = document.querySelector('#stage-status');
  const resetLayout = document.querySelector('#reset-layout');
  const removeDecoration = document.querySelector('#remove-decoration');
  const sizeControl = document.querySelector('#ornament-size-control');
  const sizeLabel = document.querySelector('#ornament-size-label');
  const sizeInput = document.querySelector('#ornament-size');
  const sizeValue = document.querySelector('#ornament-size-value');
  const pointBalance = document.querySelector('#point-balance');
  const solvedCount = document.querySelector('#solved-count');
  const challengeCount = document.querySelector('#challenge-count');
  const shop = document.querySelector('#shop-items');
  const shopFeedback = document.querySelector('#shop-feedback');
  const scene = document.querySelector('.tree-scene');
  const scenePicker = document.querySelector('#scene-picker');
  const outdoorChoice = scenePicker.querySelector('[data-scene-choice="outdoor"]');
  const indoorChoice = scenePicker.querySelector('[data-scene-choice="indoor"]');
  const treeArt = document.querySelector('#tree-art');
  const lightCords = document.querySelector('#light-cords');
  const growthName = document.querySelector('#growth-name');
  const growthNext = document.querySelector('#growth-next');
  const growthPicker = document.querySelector('#growth-picker');
  const growthChoices = Array.from(growthPicker.querySelectorAll('button[data-growth-choice]'));

  const ornaments = new Map(
    Array.from(tray.querySelectorAll('button[data-ornament]'), (button) => [button.dataset.ornament, button]),
  );
  const shopItems = Array.from(shop.querySelectorAll('.shop-card[data-shop-id]'), (card) => ({
    card,
    id: card.dataset.shopId,
    action: card.querySelector('.shop-action'),
    ownedCount: card.querySelector('.shop-owned-count'),
    name: card.dataset.name,
    price: Number(card.dataset.price),
    limit: Number(card.dataset.limit ?? Infinity),
    ornamentId: card.dataset.ornamentId,
    effect: card.dataset.effect,
  }));
  let owned = new Map();
  const placed = new Map();
  let purchasedEffects = new Set();
  let activeEffects = new Set();
  const pointFormat = new Intl.NumberFormat('ko-KR');
  const presentId = '10';
  const presentColors = Array.from(giftPackages, (image) => image.getAttribute('src'));
  const remainingPresentColors = [...presentColors];
  const cordId = '8';
  const ledStrandId = '9';
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reviewTeam = new URLSearchParams(window.location.search).get('review_team');
  const growthStages = ['묘목', '어린 전나무', '성탄 전나무', '별빛 전나무', '세계수'];
  const defaultPositions = {
    1: { x: 0.5, y: 0.095 },
    2: { x: 0.39, y: 0.44 },
    3: { x: 0.62, y: 0.5 },
    4: { x: 0.32, y: 0.67 },
    5: { x: 0.68, y: 0.73 },
    6: { x: 0.48, y: 0.68 },
    7: { x: 0.5, y: 0.24 },
    8: { x: 0.8, y: 0.48 },
    9: { x: 0.6, y: 0.62 },
    10: { x: 0.13, y: 0.9 },
    11: { x: 0.79, y: 0.83 },
    13: { x: 0.55, y: 0.55 },
    14: { x: 0.43, y: 0.76 },
    15: { x: 0.56, y: 0.37 },
    16: { x: 0.44, y: 0.34 },
    17: { x: 0.38, y: 0.56 },
  };

  let selection = null;
  let nextPlacementId = 1;
  let growthIndex = -1;
  let pointer = null;
  let suppressPointerClick = false;
  let points = 0;
  let solved = 0;
  let totalChallenges = 0;
  let growthThresholds = [0, Infinity, Infinity, Infinity, Infinity];
  let pendingGifts = 0;
  let deliverySlot = 0;
  let csrfToken = '';
  let ready = false;
  let readOnly = reviewTeam !== null;
  let economyBusy = false;
  let refreshing = false;
  let pendingRequests = 0;
  let requestQueue = Promise.resolve();
  let maxPlacements = Infinity;
  let layoutVersion = 0;
  let layoutDirty = false;
  let savingLayout = false;
  let saveTimer = 0;

  function ornamentName(id) {
    const button = ornaments.get(id);
    return button.dataset.name || button.getAttribute('aria-label') || button.textContent.trim();
  }

  function drawPresentColor() {
    if (remainingPresentColors.length === 0) remainingPresentColors.push(...presentColors);

    const colorIndex = Math.floor(Math.random() * remainingPresentColors.length);
    return remainingPresentColors.splice(colorIndex, 1)[0];
  }

  function cloneIcon(id, presentColor) {
    const icon = ornaments.get(id).querySelector('.ornament-icon').cloneNode(true);
    icon.setAttribute('aria-hidden', 'true');
    if (presentColor) icon.querySelector('img').src = presentColor;
    return icon;
  }

  function quantityOwned(id) {
    return owned.get(id) ?? 0;
  }

  function quantityAvailable(id) {
    let available = quantityOwned(id);
    for (const entry of placed.values()) {
      if (entry.ornamentId === id) available -= 1;
    }
    return available;
  }

  function updateSizeControl(entry) {
    sizeControl.hidden = !entry;
    if (!entry) return;

    sizeLabel.textContent = entry.start ? '전구 줄 길이' : '장식 크기';
    sizeInput.value = entry.size;
    sizeValue.value = `${entry.size}%`;
    sizeInput.setAttribute('aria-valuetext', sizeValue.value);
  }

  function updateInterface() {
    let total = 0;
    const layoutFull = placed.size >= maxPlacements;
    for (const [id, button] of ornaments) {
      const count = quantityOwned(id);
      const available = quantityAvailable(id);
      total += count;
      const unavailable = readOnly || layoutFull || available <= 0;
      button.setAttribute('aria-disabled', String(unavailable));
      button.toggleAttribute('disabled', unavailable);

      if (count > 0) button.dataset.unlocked = 'true';
      if (count > 0 && available === 0) button.dataset.exhausted = 'true';
      else delete button.dataset.exhausted;

      const quantity = button.querySelector('.ornament-quantity');
      quantity.textContent = count > 0 ? `${available}/${count}` : '';
      const availableLabel = layoutFull ? '배치 한도 도달' : `배치 가능 ${available}개`;
      button.setAttribute('aria-label', count > 0 ? `${ornamentName(id)}, ${availableLabel}, 보유 ${count}개` : `${ornamentName(id)}, 잠김`);
      button.setAttribute('aria-pressed', String(selection?.ornamentId === id));
    }

    for (const [id, { button, start }] of placed) {
      const selected = selection?.placementId === id;
      button.setAttribute('aria-pressed', String(selected && selection.cordEnd !== 'start'));
      if (start) start.button.setAttribute('aria-pressed', String(selected && selection.cordEnd === 'start'));
    }

    tray.dataset.count = String(total);
    unlockedCount.textContent = total;
    placedCount.textContent = placed.size;
    resetLayout.disabled = readOnly || placed.size === 0;
    removeDecoration.disabled = readOnly || !selection?.placementId;
    updateSizeControl(placed.get(selection?.placementId));
    scene.toggleAttribute('data-placing', selection !== null || Boolean(pointer?.preview));
  }

  function announce(message) {
    stageStatus.textContent = message;
  }

  function updateShop() {
    pointBalance.textContent = ready ? pointFormat.format(points) : '—';
    solvedCount.textContent = ready ? solved : '—';
    challengeCount.textContent = ready ? totalChallenges : '—';
    const isIndoor = activeEffects.has('indoor');
    outdoorChoice.setAttribute('aria-pressed', String(!isIndoor));
    indoorChoice.setAttribute('aria-pressed', String(isIndoor));
    outdoorChoice.disabled = readOnly || !ready || economyBusy;
    indoorChoice.disabled = readOnly || !ready || economyBusy || !purchasedEffects.has('indoor');

    for (const { card, action, ownedCount, name, price, limit, ornamentId, effect } of shopItems) {
      const count = quantityOwned(ornamentId);
      if (ownedCount) ownedCount.textContent = count > 0 ? `보유 ${count}개` : '';

      const atLimit = Boolean(ornamentId) && count >= limit;
      let label;
      if (atLimit) {
        card.dataset.state = 'owned';
        label = limit === 1 ? '보유 중' : '한도 도달';
      } else if (purchasedEffects.has(effect)) {
        const active = activeEffects.has(effect);
        card.dataset.state = active ? 'active' : 'inactive';
        label = active ? '해제' : '적용';
      } else {
        card.dataset.state = points >= price ? 'available' : 'unaffordable';
        label = points >= price ? '구매' : '포인트 부족';
      }
      action.disabled = readOnly || !ready || economyBusy || atLimit || card.dataset.state === 'unaffordable';
      action.textContent = label;
      action.setAttribute('aria-label', `${name} ${label}`);
    }
  }

  function showShopFeedback(state, message) {
    setFeedback(shopFeedback, state, message);
  }

  function setFeedback(element, state, message) {
    element.dataset.state = state;
    if (element.textContent !== message) element.textContent = message;
  }

  function showTeamFeedback(state, message) {
    setFeedback(teamFeedback, state, message);
  }

  function enqueueRequest(task) {
    pendingRequests += 1;
    const run = requestQueue.then(task).finally(() => { pendingRequests -= 1; });
    requestQueue = run.catch(() => {});
    return run;
  }

  async function requestTeam(payload) {
    const query = reviewTeam === null ? '' : `?${new URLSearchParams({ review_team: reviewTeam })}`;
    const response = await fetch(payload ? './api/action' : `./api/state${query}`, {
      method: payload ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      headers: payload
        ? { 'Accept': 'application/json', 'Content-Type': 'application/json', 'CSRF-Token': csrfToken }
        : { 'Accept': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!response.headers.get('Content-Type')?.includes('application/json')) {
      const expired = response.redirected || response.status === 401 || response.status === 403;
      throw new Error(expired ? 'CTFd에 로그인하고 팀 트리를 다시 열어 주세요.' : '팀 트리 서버에 연결하지 못했어요.');
    }
    return { response, data: await response.json() };
  }

  function applyTeamState(state, forceLayout = false) {
    const initial = !ready;
    ready = true;
    readOnly ||= state.readOnly === true;
    document.body.toggleAttribute('data-read-only', readOnly);
    csrfToken = state.csrfToken ?? '';
    points = state.points;
    solved = state.solved;
    totalChallenges = state.total;
    growthThresholds = state.growthThresholds;
    maxPlacements = state.maxPlacements ?? Infinity;
    owned = new Map(Object.entries(state.inventory));
    purchasedEffects = new Set(state.purchasedEffects);
    const nextEffects = new Set(state.activeEffects);
    for (const effect of new Set([...activeEffects, ...nextEffects])) {
      scene.toggleAttribute(`data-effect-${effect}`, nextEffects.has(effect));
    }
    activeEffects = nextEffects;

    treeTitle.textContent = `${state.teamName} 팀 트리`;
    challengeLink.href = state.challengeUrl;
    challengeLink.removeAttribute('aria-disabled');

    const receivedGift = !initial && state.pendingGifts > pendingGifts;
    pendingGifts = state.pendingGifts;
    if (!readOnly && receivedGift) {
      showTeamFeedback('success', '문제 풀이 보상으로 선물이 도착했어요.');
      if (pendingGifts <= giftPackages.length) deliverGift(pendingGifts);
    }
    renderGifts();

    if (initial || forceLayout || (state.layoutVersion !== layoutVersion && !layoutDirty && !savingLayout && !pointer)) {
      layoutVersion = state.layoutVersion;
      restoreLayout(state.placements, state.growth);
    }
    updateInterface();
    updateShop();
    updateGrowthChoices();
  }

  async function refreshTeam(notify = false) {
    if (refreshing || (!notify && pendingRequests)) return;
    refreshing = true;
    refreshButton.disabled = true;
    try {
      await enqueueRequest(async () => {
        const { response, data } = await requestTeam();
        if (!response.ok || !data.state) throw new Error(data.error || '팀 트리 정보를 불러오지 못했어요.');
        const initial = !ready;
        applyTeamState(data.state);
        if (initial || notify || teamFeedback.dataset.state === 'error') showTeamFeedback('success', '팀 트리와 연동됐어요.');
      });
    } catch (error) {
      showTeamFeedback('error', error instanceof TypeError ? '서버 연결이 끊겼어요. 잠시 후 다시 시도해 주세요.' : error.message);
    } finally {
      refreshing = false;
      refreshButton.disabled = false;
    }
  }

  async function runEconomyAction(payload, onSuccess, feedback) {
    if (!ready || readOnly || economyBusy) return false;
    economyBusy = true;
    updateShop();
    renderGifts();
    try {
      return await enqueueRequest(async () => {
        const { response, data } = await requestTeam(payload);
        if (!response.ok || !data.state) {
          if (data.state) applyTeamState(data.state);
          throw new Error(data.error || '요청을 처리하지 못했어요.');
        }
        onSuccess(data.reward);
        applyTeamState(data.state);
        return true;
      });
    } catch (error) {
      feedback('error', error instanceof TypeError ? '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' : error.message);
      return false;
    } finally {
      economyBusy = false;
      updateShop();
      renderGifts();
    }
  }

  function layoutSnapshot() {
    const placements = Array.from(placed.values(), (entry) => {
      const data = { ornamentId: entry.ornamentId, ...entry.position, size: entry.size };
      if (entry.start) {
        data.startX = entry.start.position.x;
        data.startY = entry.start.position.y;
      }
      if (entry.ornamentId === presentId) data.presentColor = presentColors.indexOf(entry.presentColor);
      return data;
    });
    return { layoutVersion, placements, growth: growthIndex + 1 };
  }

  async function saveLayout() {
    if (!layoutDirty || readOnly) return;
    layoutDirty = false;
    savingLayout = true;
    try {
      const { response, data } = await requestTeam({ action: 'save-layout', ...layoutSnapshot() });
      if (response.status >= 400 && response.status < 500 && data.state) {
        layoutDirty = false;
        window.clearTimeout(saveTimer);
        saveTimer = 0;
        applyTeamState(data.state, true);
        const conflictMessage = '팀원이 먼저 저장한 배치를 불러왔어요. 방금 변경하려던 장식은 다시 배치해 주세요.';
        setFeedback(layoutFeedback, 'error', response.status === 409 ? conflictMessage : data.error || '배치를 저장하지 못했어요.');
        return;
      }
      if (!response.ok || !data.state) throw new Error(data.error || '배치를 저장하지 못했어요.');
      layoutVersion = data.state.layoutVersion;
      applyTeamState(data.state);
      if (!layoutDirty) setFeedback(layoutFeedback, 'success', '팀 트리에 저장했어요.');
    } catch {
      layoutDirty = true;
      setFeedback(layoutFeedback, 'error', '배치를 저장하지 못했어요. 연결이 복구되면 다시 시도해요.');
    } finally {
      savingLayout = false;
    }
  }

  function scheduleLayoutSave(delay = 450) {
    if (!ready || readOnly) return;
    layoutDirty = true;
    setFeedback(layoutFeedback, '', '팀 트리에 저장하는 중이에요.');
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = 0;
      enqueueRequest(saveLayout);
    }, delay);
  }

  scenePicker.addEventListener('click', (event) => {
    const choice = event.target.closest('button[data-scene-choice]');
    if (!choice || choice.disabled) return;

    const isIndoor = choice === indoorChoice;
    if (isIndoor === activeEffects.has('indoor')) return;

    runEconomyAction({ action: 'toggle-effect', effect: 'indoor', active: isIndoor }, () => {
      showShopFeedback('success', `${isIndoor ? '집 안' : '집 밖'} 배경을 적용했어요.`);
    }, showShopFeedback);
  });

  for (const { id, action, name, effect } of shopItems) {
    action.addEventListener('click', () => {
      if (purchasedEffects.has(effect)) {
        const active = !activeEffects.has(effect);
        runEconomyAction({ action: 'toggle-effect', effect, active }, () => {
          showShopFeedback('success', `${name} ${active ? '적용' : '해제'} 완료`);
        }, showShopFeedback);
        return;
      }
      runEconomyAction({ action: 'purchase', item: id }, () => {
        showShopFeedback('success', `${name} 구매 완료`);
      }, showShopFeedback);
    });
  }

  function positionOnScene(clientX, clientY) {
    const bounds = scene.getBoundingClientRect();
    return {
      x: (clientX - bounds.left) / bounds.width,
      y: (clientY - bounds.top) / bounds.height,
    };
  }

  function isOnScene({ x, y }) {
    return x >= 0 && x <= 1 && y >= 0 && y <= 1;
  }

  function renderCords(dragPosition) {
    const viewWidth = 1000;
    const viewHeight = 600;
    const paths = [];

    for (const [id, cord] of placed) {
      if (!cord.start) continue;

      const isLed = cord.ornamentId === ledStrandId;
      const dragging = dragPosition && pointer?.placementId === id;
      const start = dragging && pointer.cordEnd === 'start' ? dragPosition : cord.start.position;
      const end = dragging && pointer.cordEnd === 'end' ? dragPosition : cord.position;
      const startX = start.x * viewWidth;
      const startY = start.y * viewHeight;
      const endX = end.x * viewWidth;
      const endY = end.y * viewHeight;
      const span = Math.hypot(endX - startX, endY - startY);
      const controlX = (startX + endX) / 2;
      const controlY = Math.min(viewHeight, (startY + endY) / 2 + Math.min(85, span * 0.2));
      const group = document.createElementNS(svgNamespace, 'g');
      if (isLed) group.setAttribute('class', 'led-strand');
      const line = document.createElementNS(svgNamespace, 'path');
      line.setAttribute('class', 'cord-line');
      line.setAttribute('fill', 'none');
      line.setAttribute('d', `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`);
      group.append(line);

      const bulbs = isLed ? Math.min(24, Math.max(2, Math.round(span / 29))) : Math.min(16, Math.max(1, Math.round(span / 48)));
      const bulbRadius = isLed ? 5.5 : 4;
      for (let index = 1; index <= bulbs; index += 1) {
        const t = index / (bulbs + 1);
        const startWeight = (1 - t) ** 2;
        const controlWeight = 2 * (1 - t) * t;
        const endWeight = t ** 2;
        const bulb = document.createElementNS(svgNamespace, 'circle');
        bulb.setAttribute('class', isLed ? 'cord-bulb led-bulb' : 'cord-bulb');
        bulb.setAttribute('cx', startWeight * startX + controlWeight * controlX + endWeight * endX);
        const bulbY = 5 + startWeight * startY + controlWeight * controlY + endWeight * endY;
        bulb.setAttribute('cy', Math.min(viewHeight - bulbRadius, bulbY));
        bulb.setAttribute('r', bulbRadius);
        group.append(bulb);
      }

      paths.push(group);
    }

    lightCords.replaceChildren(...paths);
  }

  function createPlacementButton(ornamentId, placementId, cordEnd, presentColor) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tree-ornament';
    button.disabled = readOnly;
    button.dataset.ornament = ornamentId;
    button.dataset.placementId = placementId;
    if (cordEnd) button.dataset.cordEnd = cordEnd;
    const name = ornamentName(ornamentId);
    const label = cordEnd ? `${name} ${cordEnd === 'start' ? '시작점' : '끝점'}` : `${name} 장식`;
    button.setAttribute('aria-label', `${label}, 방향키로 이동, Delete 키로 빼기`);
    button.append(cloneIcon(ornamentId, presentColor));
    decorations.append(button);
    return button;
  }

  function handleInsets(button, bounds) {
    const { width, height } = button.getBoundingClientRect();
    return {
      x: Math.min(0.5, width / (2 * Math.max(bounds.width, 1))),
      y: Math.min(0.5, height / (2 * Math.max(bounds.height, 1))),
    };
  }

  function setHandlePosition(handle, position, bounds) {
    const inset = handleInsets(handle.button, bounds);
    const x = Math.min(1 - inset.x, Math.max(inset.x, position.x));
    const y = Math.min(1 - inset.y, Math.max(inset.y, position.y));
    positionHandle(handle, x, y);
  }

  function positionHandle(handle, x, y) {
    handle.position = { x, y };
    handle.button.style.left = `${x * 100}%`;
    handle.button.style.top = `${y * 100}%`;
  }

  function rebaseCord(entry) {
    entry.cordHalfSpan = {
      x: (entry.position.x - entry.start.position.x) * 50 / entry.size,
      y: (entry.position.y - entry.start.position.y) * 50 / entry.size,
    };
  }

  function restoreLayout(placements, growth) {
    clearPointer();
    selection = null;
    placed.clear();
    decorations.replaceChildren();

    for (const { ornamentId, x, y, size, startX, startY, presentColor } of placements) {
      const placementId = String(nextPlacementId++);
      const isCord = ornamentId === cordId || ornamentId === ledStrandId;
      const color = presentColors[presentColor];
      const button = createPlacementButton(ornamentId, placementId, isCord ? 'end' : undefined, color);
      const entry = { button, ornamentId, size, presentColor: color };
      positionHandle(entry, x, y);
      if (isCord) {
        entry.start = { button: createPlacementButton(ornamentId, placementId, 'start') };
        positionHandle(entry.start, startX, startY);
        rebaseCord(entry);
      } else {
        button.style.setProperty('--ornament-scale', size / 100);
      }
      placed.set(placementId, entry);
    }

    selectGrowth(growth - 1);
    renderCords();
  }

  function resizeCord(entry, bounds) {
    const { x: startX, y: startY } = entry.start.position;
    const { x: endX, y: endY } = entry.position;
    const middleX = (startX + endX) / 2;
    const middleY = (startY + endY) / 2;
    const inset = handleInsets(entry.button, bounds);
    const spaceX = Math.max(0, Math.min(middleX, 1 - middleX) - inset.x);
    const spaceY = Math.max(0, Math.min(middleY, 1 - middleY) - inset.y);
    const { x: spanX, y: spanY } = entry.cordHalfSpan;
    const scale = Math.min(
      entry.size / 100,
      spanX === 0 ? Infinity : spaceX / Math.abs(spanX),
      spanY === 0 ? Infinity : spaceY / Math.abs(spanY),
    );

    setHandlePosition(entry.start, { x: middleX - spanX * scale, y: middleY - spanY * scale }, bounds);
    setHandlePosition(entry, { x: middleX + spanX * scale, y: middleY + spanY * scale }, bounds);
    renderCords();
  }

  function addOrMovePlacement(ornamentId, position, placementId, cordEnd, presentColor) {
    if (!ready || readOnly) return;
    let entry = placed.get(placementId);
    const isNew = !entry;
    const bounds = scene.getBoundingClientRect();

    if (isNew) {
      if (quantityAvailable(ornamentId) <= 0 || placed.size >= maxPlacements) return;

      placementId = String(nextPlacementId++);
      cordEnd = ornamentId === cordId || ornamentId === ledStrandId ? 'end' : undefined;
      if (ornamentId === presentId) presentColor ??= drawPresentColor();
      const button = createPlacementButton(ornamentId, placementId, cordEnd, presentColor);
      entry = { button, ornamentId, presentColor, size: 100 };
      if (cordEnd) {
        entry.start = { button: createPlacementButton(ornamentId, placementId, 'start') };
        const { x: inset } = handleInsets(button, bounds);
        const halfSpan = Math.min(0.09, 0.5 - inset);
        const center = Math.min(1 - inset - halfSpan, Math.max(inset + halfSpan, position.x));
        setHandlePosition(entry.start, { x: center - halfSpan, y: position.y }, bounds);
        position = { x: center + halfSpan, y: position.y };
      }
      placed.set(placementId, entry);
    }

    const handle = cordEnd === 'start' ? entry.start : entry;
    setHandlePosition(handle, position, bounds);
    selection = { placementId, cordEnd };
    updateInterface();
    if (entry.start) {
      // Rebase the span after an endpoint moves so the size slider can reverse a border-limited resize.
      rebaseCord(entry);
      renderCords();
    }
    const name = ornamentName(entry.ornamentId);
    announce(isNew ? `${name} 장식을 놓았어요.` : `${name} 장식을 옮겼어요.`);
    scheduleLayoutSave();
    return handle.button;
  }

  function keyboardPlacement(ornamentId) {
    const preferred = defaultPositions[ornamentId];
    const options = [preferred, ...Object.values(defaultPositions), { x: 0.24, y: 0.3 }, { x: 0.75, y: 0.3 }, { x: 0.2, y: 0.75 }, { x: 0.8, y: 0.75 }];
    const positions = Array.from(placed.values(), (entry) => entry.position);
    return options.find((option) => positions.every(({ x, y }) => Math.hypot(x - option.x, y - option.y) >= 0.1)) ?? preferred;
  }

  function selectOrnament(id) {
    selection = selection?.ornamentId === id ? null : { ornamentId: id };
    updateInterface();
    announce(selection ? `${ornamentName(id)} 장식을 놓을 위치를 선택하세요.` : '장식 선택을 취소했어요.');
  }

  function selectPlacement(placementId, cordEnd) {
    const { ornamentId } = placed.get(placementId);
    selection = { placementId, cordEnd };
    updateInterface();
    announce(`${ornamentName(ornamentId)} 장식을 선택했어요.`);
  }

  function removePlacement(placementId) {
    if (!ready || readOnly) return;
    const entry = placed.get(placementId);
    if (!entry) return;

    clearPointer();
    selection = null;
    placed.delete(placementId);
    entry.button.remove();
    if (entry.start) entry.start.button.remove();
    updateInterface();
    if (entry.start) renderCords();
    ornaments.get(entry.ornamentId).focus({ preventScroll: true });
    announce(`${ornamentName(entry.ornamentId)} 장식 한 개를 장식함으로 돌려놓았어요.`);
    scheduleLayoutSave();
  }

  function updateGrowthChoices() {
    const index = growthThresholds.findLastIndex((threshold) => threshold <= solved);
    const next = growthThresholds[index + 1];
    growthNext.textContent = !ready || readOnly ? '' : (Number.isFinite(next) ? `다음 단계까지 ${next - solved}개` : '모든 단계 해금');

    for (const button of growthChoices) {
      const choiceIndex = Number(button.dataset.growthChoice) - 1;
      button.disabled = readOnly || !ready || choiceIndex > index;
      button.setAttribute('aria-pressed', String(choiceIndex === growthIndex));
      if (ready && choiceIndex > 0) button.querySelector('.growth-choice-threshold').textContent = `문제 ${growthThresholds[choiceIndex]}개`;
    }
  }

  function selectGrowth(index) {
    const name = growthStages[index];
    if (!name || index === growthIndex) return false;

    growthIndex = index;
    const level = String(index + 1);
    scene.dataset.growth = level;
    growthName.textContent = name;
    const source = treeArt.getAttribute(`data-growth-${level}`);
    if (treeArt.getAttribute('src') !== source) treeArt.src = source;
    treeArt.alt = `${name} 단계의 크리스마스 트리`;
    updateGrowthChoices();
    return true;
  }

  growthPicker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-growth-choice]');
    if (!button || button.disabled) return;

    const index = Number(button.dataset.growthChoice) - 1;
    if (selectGrowth(index)) {
      announce(`${growthStages[index]} 단계로 바꿨어요.`);
      scheduleLayoutSave();
    }
  });

  function renderGifts() {
    const slots = readOnly ? 0 : Math.min(pendingGifts, giftPackages.length);
    const occupied = new Set();
    for (const parcel of Array.from(giftRow.children)) {
      const slot = Number(parcel.dataset.gift);
      if (parcel.classList.contains('gift-box')) {
        if (slot > slots) {
          parcel.remove();
          continue;
        }
        parcel.disabled = economyBusy;
      }
      occupied.add(slot);
    }
    for (let slot = 1; slot <= slots; slot += 1) {
      if (!occupied.has(slot) && slot !== deliverySlot) showGift(slot);
    }
    openNextGift.hidden = readOnly || pendingGifts === 0;
    openNextGift.disabled = economyBusy || !giftRow.querySelector('.gift-box');
    openNextGift.textContent = pendingGifts > 1 ? `선물 열기 · ${pendingGifts}개` : '선물 열기';
  }

  function showGift(number, justDelivered = false) {
    const box = document.createElement('button');
    box.type = 'button';
    box.className = 'gift-box';
    box.disabled = economyBusy;
    box.dataset.gift = number;
    box.title = `선물 상자 ${number} 열기`;
    box.setAttribute('aria-label', box.title);
    box.toggleAttribute('data-just-delivered', justDelivered);
    box.append(giftPackages[number - 1].cloneNode());
    giftRow.append(box);
  }

  function revealGift(box, reward) {
    const id = reward?.ornamentId;
    const reveal = document.createElement('div');
    reveal.className = 'gift-reveal';
    reveal.dataset.gift = box.dataset.gift;
    reveal.setAttribute('aria-hidden', 'true');

    const parcel = box.querySelector('.gift-package');
    if (id) {
      reveal.append(parcel, cloneIcon(id));
      showTeamFeedback('success', `${ornamentName(id)} 장식을 획득했어요.`);
    } else {
      const bonus = document.createElement('span');
      bonus.className = 'gift-points';
      bonus.textContent = `+${pointFormat.format(reward.points)}pt`;
      reveal.append(parcel, bonus);
      showTeamFeedback('success', `선물 보너스 ${pointFormat.format(reward.points)}pt를 받았어요.`);
    }

    box.replaceWith(reveal);
    window.setTimeout(() => {
      reveal.remove();
      renderGifts();
    }, reducedMotion.matches ? 240 : 750);
  }

  async function openGift(box, keyboard) {
    let receivedOrnament;
    const opened = await runEconomyAction({ action: 'open-gift' }, (reward) => {
      receivedOrnament = reward?.ornamentId;
      revealGift(box, reward);
    }, showTeamFeedback);
    if (opened && keyboard) {
      const nextControl = openNextGift.disabled || openNextGift.hidden ? refreshButton : openNextGift;
      (ornaments.get(receivedOrnament) ?? nextControl).focus({ preventScroll: true });
    }
  }

  giftRow.addEventListener('click', (event) => {
    const box = event.target.closest('.gift-box');
    if (box) openGift(box, event.detail === 0);
  });

  openNextGift.addEventListener('click', (event) => {
    const box = giftRow.querySelector('.gift-box');
    if (box) openGift(box, event.detail === 0);
  });

  function animateSleigh(phase) {
    santa.dataset.phase = phase;
    return Promise.allSettled(santa.getAnimations().map((animation) => animation.finished));
  }

  async function deliverGift(slot) {
    if (!santa.hidden) return;
    deliverySlot = slot;
    santa.dataset.gift = slot;
    santaParcel.setAttribute('src', giftPackages[slot - 1].getAttribute('src'));
    santa.hidden = false;
    try {
      await animateSleigh('arriving');
      santa.dataset.phase = 'delivering';
      deliverySlot = 0;
      if (slot <= pendingGifts && !giftRow.querySelector(`[data-gift="${slot}"]`)) showGift(slot, true);
      renderGifts();
      await new Promise((resolve) => window.setTimeout(resolve, reducedMotion.matches ? 220 : 360));
      await animateSleigh('departing');
    } finally {
      deliverySlot = 0;
      santa.hidden = true;
      delete santa.dataset.phase;
      renderGifts();
    }
  }

  tray.addEventListener('click', (event) => {
    if (!ready || readOnly) return;
    const button = event.target.closest('button[data-ornament]');
    const id = button?.dataset.ornament;
    if (quantityAvailable(id) === 0) return;

    if (event.detail === 0) {
      const stageButton = addOrMovePlacement(id, keyboardPlacement(id));
      stageButton?.focus();
      return;
    }

    selectOrnament(id);
  });

  scene.addEventListener('click', (event) => {
    if (!ready || readOnly) return;
    if (event.target.closest('.gift-box, .gift-reveal')) return;

    const position = positionOnScene(event.clientX, event.clientY);
    const button = event.target.closest('.tree-ornament');

    if (selection?.ornamentId && event.detail !== 0 && isOnScene(position)) {
      addOrMovePlacement(selection.ornamentId, position);
    } else if (button) {
      selectPlacement(button.dataset.placementId, button.dataset.cordEnd);
    } else if (selection?.placementId && event.detail !== 0 && isOnScene(position)) {
      addOrMovePlacement(null, position, selection.placementId, selection.cordEnd);
    }
  });

  for (const area of [tray, decorations]) {
    area.addEventListener('pointerdown', (event) => {
      if (!ready || readOnly) return;
      const source = event.target.closest('button[data-ornament]');
      const id = source?.dataset.ornament;
      const placementId = source?.dataset.placementId;
      const cordEnd = source?.dataset.cordEnd;
      if (pointer || !event.isPrimary || event.button !== 0) return;
      if (!placementId && quantityAvailable(id) === 0) return;

      pointer = { id, placementId, cordEnd, source, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, preview: null };
    });
    area.addEventListener('dragstart', (event) => event.preventDefault());
  }

  function clearPointer() {
    if (!pointer) return;

    const restoreCords = pointer.preview && pointer.cordEnd;
    if (pointer.preview) {
      pointer.preview.remove();
      delete pointer.source.dataset.dragging;
      delete scene.dataset.dropTarget;
      document.body.removeAttribute('data-dragging-ornament');
    }

    pointer = null;
    updateInterface();
    if (restoreCords) renderCords();
  }

  window.addEventListener('pointermove', (event) => {
    if (pointer?.pointerId !== event.pointerId) return;

    if (!pointer.preview) {
      const distance = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
      if (distance < 6) return;

      const preview = document.createElement('div');
      preview.className = 'drag-preview';
      preview.dataset.ornament = pointer.id;
      if (pointer.cordEnd) preview.dataset.cordEnd = pointer.cordEnd;
      const entry = placed.get(pointer.placementId);
      if (entry && !entry.start) preview.style.setProperty('--ornament-scale', entry.size / 100);
      if (pointer.id === presentId) pointer.presentColor = entry?.presentColor ?? drawPresentColor();
      preview.setAttribute('aria-hidden', 'true');
      preview.append(cloneIcon(pointer.id, pointer.presentColor));
      document.body.append(preview);

      pointer.preview = preview;
      pointer.source.dataset.dragging = 'true';
      document.body.setAttribute('data-dragging-ornament', '');
      selection = null;
      updateInterface();
    }

    pointer.preview.style.left = `${event.clientX}px`;
    pointer.preview.style.top = `${event.clientY}px`;
    const position = positionOnScene(event.clientX, event.clientY);
    const onScene = isOnScene(position);
    scene.toggleAttribute('data-drop-target', onScene);
    if (pointer.cordEnd) {
      renderCords(onScene ? position : undefined);
    }
  });

  window.addEventListener('pointerup', (event) => {
    if (pointer?.pointerId !== event.pointerId) return;

    if (pointer.preview) {
      suppressPointerClick = true;
      const position = positionOnScene(event.clientX, event.clientY);
      const { id, placementId, cordEnd, presentColor } = pointer;

      if (isOnScene(position)) addOrMovePlacement(id, position, placementId, cordEnd, presentColor);
      else announce('트리 화면 안에 장식을 놓아 주세요.');
    }

    clearPointer();
  });

  window.addEventListener('pointercancel', (event) => {
    if (pointer?.pointerId === event.pointerId) clearPointer();
  });
  window.addEventListener('blur', clearPointer);

  document.addEventListener('pointerdown', () => {
    suppressPointerClick = false;
  }, true);

  document.addEventListener('click', (event) => {
    if (!suppressPointerClick || event.detail === 0) return;
    suppressPointerClick = false;
    if (event.target.closest('.gift-box') || (!scene.contains(event.target) && !tray.contains(event.target))) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  decorations.addEventListener('keydown', (event) => {
    if (!ready || readOnly) return;
    const button = event.target.closest('.tree-ornament');
    if (!button) return;

    const { placementId, cordEnd } = button.dataset;
    if (event.key === 'Delete') {
      event.preventDefault();
      removePlacement(placementId);
      return;
    }

    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!Array.isArray(direction)) return;

    event.preventDefault();
    const entry = placed.get(placementId);
    const { position } = cordEnd === 'start' ? entry.start : entry;
    const step = event.shiftKey ? 0.05 : 0.02;
    const nextPosition = { x: position.x + direction[0] * step, y: position.y + direction[1] * step };

    addOrMovePlacement(null, nextPosition, placementId, cordEnd);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || (!selection && !pointer)) return;

    if (document.activeElement === sizeInput) {
      const entry = placed.get(selection?.placementId);
      const handle = selection?.cordEnd === 'start' ? entry?.start : entry;
      handle?.button.focus({ preventScroll: true });
    }
    selection = null;
    clearPointer();
    updateInterface();
    announce('장식 선택을 취소했어요.');
  });

  resetLayout.addEventListener('click', () => {
    if (!ready || readOnly) return;
    const first = placed.get(selection?.placementId) ?? placed.values().next().value;
    selection = null;
    clearPointer();
    placed.clear();
    decorations.replaceChildren();
    updateInterface();
    renderCords();
    ornaments.get(first?.ornamentId)?.focus({ preventScroll: true });
    announce('배치한 장식을 모두 장식함으로 돌려놓았어요.');
    scheduleLayoutSave();
  });

  removeDecoration.addEventListener('click', () => removePlacement(selection?.placementId));

  sizeInput.addEventListener('input', () => {
    if (!ready || readOnly) return;
    const entry = placed.get(selection?.placementId);
    if (!entry) return;

    entry.size = sizeInput.valueAsNumber;
    const bounds = scene.getBoundingClientRect();
    if (entry.start) {
      resizeCord(entry, bounds);
    } else {
      entry.button.style.setProperty('--ornament-scale', entry.size / 100);
      setHandlePosition(entry, entry.position, bounds);
    }
    updateSizeControl(entry);
    scheduleLayoutSave();
  });

  refreshButton.addEventListener('click', () => refreshTeam(true));
  document.addEventListener('visibilitychange', () => {
    if (!readOnly && !document.hidden) refreshTeam();
  });
  window.addEventListener('beforeunload', (event) => {
    if (!layoutDirty && !savingLayout) return;
    event.preventDefault();
    event.returnValue = '';
  });
  window.setInterval(() => {
    if (readOnly || document.hidden) return;
    if (layoutDirty && !saveTimer && !pendingRequests) scheduleLayoutSave(0);
    else refreshTeam();
  }, 8000);

  updateInterface();
  updateShop();
  selectGrowth(0);
  refreshTeam();
})();
