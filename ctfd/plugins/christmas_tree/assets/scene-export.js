(() => {
  const scene = document.querySelector('.tree-scene');
  const button = document.querySelector('#download-scene');
  const status = document.querySelector('#scene-export-status');
  if (!scene || !button || !status) return;

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const editingControls = '#stage-status, [data-cord-end]';
  const visualProperties = [
    'display', 'position', 'inset', 'z-index', 'width', 'height', 'box-sizing',
    'margin', 'padding', 'overflow', 'isolation', 'visibility', 'opacity',
    'align-items', 'justify-items', 'align-content', 'justify-content',
    'grid-template', 'border', 'border-top', 'border-right', 'border-bottom',
    'border-left', 'border-radius', 'box-shadow', 'background', 'clip-path',
    'transform', 'transform-origin', 'filter', 'object-fit', 'object-position',
    'font-family', 'font-size', 'font-weight', 'line-height', 'white-space',
    'text-align', 'text-shadow', 'color', 'fill', 'stroke', 'stroke-width',
    'vector-effect',
  ];

  function copyStyle(source, target) {
    for (const property of visualProperties) {
      target.style.setProperty(property, source.getPropertyValue(property));
    }
  }

  function clonePseudo(element, selector) {
    const style = getComputedStyle(element, selector);
    if (style.content === 'none' || style.content === 'normal' || style.display === 'none') return null;

    const pseudo = document.createElement('span');
    copyStyle(style, pseudo);
    pseudo.textContent = style.content.slice(1, -1);
    return pseudo;
  }

  async function imageDataUrl(source) {
    if (source.startsWith('data:')) return source;

    const response = await fetch(source);
    if (!response.ok) throw new Error('Scene image could not be loaded');
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function snapshot(element, images, pendingImages) {
    const style = getComputedStyle(element);
    if (style.display === 'none' || element.matches(editingControls)) return null;

    const clone = element.cloneNode(false);
    copyStyle(style, clone);

    if (element.matches('.tree-ornament')) {
      clone.style.background = 'none';
      clone.style.boxShadow = 'none';
      clone.style.zIndex = 'auto';
    } else if (element.id === 'tree-decorations') {
      clone.style.boxShadow = 'none';
    }

    if (element instanceof HTMLImageElement) {
      const source = element.src;
      if (!images.has(source)) images.set(source, imageDataUrl(source));
      clone.removeAttribute('srcset');
      pendingImages.push(images.get(source).then((url) => { clone.src = url; }));
      return clone;
    }

    if (element instanceof HTMLElement) {
      const before = clonePseudo(element, '::before');
      if (before) clone.append(before);
    }

    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) clone.append(node.cloneNode());
      if (node.nodeType === Node.ELEMENT_NODE) {
        const child = snapshot(node, images, pendingImages);
        if (child) clone.append(child);
      }
    }

    if (element instanceof HTMLElement) {
      const after = clonePseudo(element, '::after');
      if (after) clone.append(after);
    }

    return clone;
  }

  async function scenePng() {
    const { width, height } = scene.getBoundingClientRect();
    if (!width || !height) throw new Error('Scene has no drawable area');

    // Freeze layout and animation styles before waiting for the image assets.
    const pendingImages = [];
    const clone = snapshot(scene, new Map(), pendingImages);
    await Promise.all(pendingImages);

    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * 2);
    canvas.height = Math.ceil(height * 2);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');

    const svg = document.createElementNS(svgNamespace, 'svg');
    svg.setAttribute('width', canvas.width);
    svg.setAttribute('height', canvas.height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    const foreignObject = document.createElementNS(svgNamespace, 'foreignObject');
    foreignObject.setAttribute('width', width);
    foreignObject.setAttribute('height', height);
    foreignObject.append(clone);
    svg.append(foreignObject);

    const sceneImage = new Image();
    sceneImage.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    await sceneImage.decode();
    context.drawImage(sceneImage, 0, 0);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('PNG could not be created'));
      }, 'image/png');
    });
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.classList.add('visually-hidden');
    status.textContent = '이미지를 만드는 중이에요.';

    try {
      const url = URL.createObjectURL(await scenePng());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'christmas-tree.png';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'PNG 저장을 시작했어요.';
    } catch (error) {
      console.error('Christmas tree export failed.', error);
      const modularFile = location.protocol === 'file:' && !scene.querySelector('#tree-art').src.startsWith('data:');
      status.classList.remove('visually-hidden');
      status.textContent = modularFile
        ? 'PNG를 저장하려면 CTFd 서버의 트리 꾸미기 페이지를 열어 주세요.'
        : 'PNG를 저장하지 못했어요. 다시 시도해 주세요.';
    } finally {
      button.disabled = false;
    }
  });
})();
