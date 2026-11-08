(() => {
  const CONFIG = window.CATALOG_CONFIG || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const priceLabel = value => Number(value) > 0 ? money(value) : 'Sob consulta';
  function loadCart() {
    try { return window.NicWillInventory?.parseCart(localStorage.getItem('nilo3d-cart')) || {}; }
    catch (error) { return {}; }
  }
  const state = { products: [], categories: [], category: 'Todos', query: '', detailId: null, imageIndex: 0, cart: loadCart() };
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const imagesFor = product => [...new Set((product.previewImages?.length ? product.previewImages : product.images?.length ? product.images : [product.image || 'assets/print-vase.svg']).filter(Boolean))];
  const colorsFor = product => [...new Set((Array.isArray(product.colors) ? product.colors : String(product.colors || '').split(',')).map(color => String(color).trim()).filter(Boolean))];
  const availabilityFor = product => product.availability || { status: 'check' };
  const availabilityText = product => window.NicWillInventory?.describe(availabilityFor(product)) || 'Consulte a disponibilidade pelo WhatsApp';

  function notify(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  function visibleProducts() {
    let items = state.products.filter(product => product.active !== false);
    if (state.category !== 'Todos') items = items.filter(product => product.category === state.category);
    const query = state.query.trim().toLocaleLowerCase('pt-BR');
    if (query) items = items.filter(product => [product.name, product.description, product.category, product.material, product.dimensions, product.careInstructions, ...colorsFor(product), ...(product.tags || [])].join(' ').toLocaleLowerCase('pt-BR').includes(query));
    const sort = $('#sort-select').value;
    if (sort === 'price-asc') items.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') items.sort((a, b) => b.price - a.price);
    if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return items;
  }

  function renderCategories() {
    const active = state.products.filter(item => item.active !== false && item.category);
    const ordered = window.NicWillInventory?.orderedActiveCategories(state.categories, state.products) || [...new Set(active.map(item => item.category))];
    const canonical = new Map(ordered.map(category => [window.NicWillInventory?.categoryKey(category) || category.toLocaleLowerCase('pt-BR'), category]));
    state.products = state.products.map(product => {
      const category = canonical.get(window.NicWillInventory?.categoryKey(product.category) || String(product.category || '').toLocaleLowerCase('pt-BR'));
      return category && category !== product.category ? { ...product, category } : product;
    });
    const categories = ['Todos', ...ordered];
    $('#category-list').innerHTML = categories.map(category => `<button class="category-chip${state.category === category ? ' is-active' : ''}" data-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`).join('');
  }

  function renderProducts() {
    const products = visibleProducts();
    $('#results-count').textContent = `${products.length} ${products.length === 1 ? 'resultado no catálogo' : 'resultados no catálogo'}`;
    $('#empty-state').hidden = products.length > 0;
    $('#product-grid').innerHTML = products.map(product => {
      const cover = imagesFor(product)[0];
      const availability = availabilityFor(product);
      return `<article class="product-card"><div class="product-photo"><button class="product-view" data-details="${escapeHTML(product.id)}" aria-label="Ver fotos e detalhes de ${escapeHTML(product.name)}"><img src="${escapeHTML(cover)}" alt="${escapeHTML(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='assets/print-vase.svg'"><span class="product-badge">${escapeHTML(product.badge || product.category)}</span><span class="photo-hint">VER DETALHES ↗</span></button>${imagesFor(product).length > 1 ? `<span class="photo-count">▧ ${imagesFor(product).length} FOTOS</span>` : ''}<button class="quick-add" data-add="${escapeHTML(product.id)}" aria-label="Adicionar ${escapeHTML(product.name)} à sacola">+</button></div><div class="product-details"><span class="product-category">${escapeHTML(product.category)}</span><div class="product-title-row"><h3><button class="product-detail-link" data-details="${escapeHTML(product.id)}">${escapeHTML(product.name)}</button></h3><span class="product-price">${priceLabel(product.price)}</span></div><p class="product-description">${escapeHTML(product.description || '')}</p><p class="product-availability" data-availability="${escapeHTML(availability.status || 'check')}">${escapeHTML(availabilityText(product))}</p></div></article>`;
    }).join('');
    products.forEach((product, index) => {
      const colors = colorsFor(product);
      const facts = [product.material && `Material: ${product.material}`, product.dimensions && `Dimensões: ${product.dimensions}`, colors.length ? `${colors.length} cores` : ''].filter(Boolean);
      if (!facts.length) return;
      const summary = document.createElement('p');
      summary.className = 'product-specs'; summary.textContent = facts.join(' · ');
      $('#product-grid').children[index].querySelector('.product-details').append(summary);
    });
  }

  function renderProductDetail() {
    const product = state.products.find(item => item.id === state.detailId);
    if (!product) return;
    const images = imagesFor(product);
    state.imageIndex = (state.imageIndex + images.length) % images.length;
    $('#detail-image').src = images[state.imageIndex];
    $('#detail-image').alt = `${product.name} — foto ${state.imageIndex + 1}`;
    $('#detail-thumbnails').innerHTML = images.map((image, index) => `<button class="detail-thumbnail${index === state.imageIndex ? ' is-active' : ''}" data-image-index="${index}" aria-label="Ver foto ${index + 1}"><img src="${escapeHTML(image)}" alt="" onerror="this.onerror=null;this.src='assets/print-vase.svg'"></button>`).join('');
    $('#detail-category').textContent = product.category;
    $('#detail-name').textContent = product.name;
    $('#detail-price').textContent = priceLabel(product.price);
    $('#detail-availability').textContent = availabilityText(product);
    $('#detail-availability').dataset.availability = availabilityFor(product).status || 'check';
    $('#detail-description').textContent = product.description || '';
    const colors = colorsFor(product);
    const facts = [
      ...(product.material ? [['Material', product.material]] : []),
      ...(product.dimensions ? [['Dimensões', product.dimensions]] : []),
      ...(colors.length ? [['Cores disponíveis', colors.join(', ')]] : [])
    ];
    $('#detail-specs').innerHTML = facts.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('');
    $('#detail-specs').hidden = facts.length === 0;
    $('#detail-care').textContent = product.careInstructions || '';
    $('#detail-care').hidden = !product.careInstructions;
    $('#detail-add').dataset.detailAdd = product.id;
    const videoUrl = window.NicWillInventory?.youtubeEmbedUrl(product.videoUrl) || '';
    const videoContainer = $('#detail-video-container');
    const videoFrame = $('#detail-video-frame');
    videoContainer.hidden = !videoUrl;
    videoFrame.title = `Vídeo de ${product.name}`;
    if (videoUrl) videoFrame.src = videoUrl;
    else videoFrame.removeAttribute('src');
    $('#gallery-prev').hidden = images.length < 2;
    $('#gallery-next').hidden = images.length < 2;
  }

  function openProductDetail(id) {
    state.detailId = id;
    state.imageIndex = 0;
    renderProductDetail();
    $('#product-dialog').showModal();
  }

  function moveGallery(direction) {
    const product = state.products.find(item => item.id === state.detailId);
    if (!product) return;
    state.imageIndex += direction;
    renderProductDetail();
  }

  function cartItems() {
    return Object.entries(state.cart).map(([id, quantity]) => ({ product: state.products.find(item => item.id === id), quantity })).filter(item => item.product && item.product.active !== false && item.quantity > 0);
  }

  function saveCart() {
    try { localStorage.setItem('nilo3d-cart', JSON.stringify(state.cart)); }
    catch (error) { notify('A sacola fica disponível até fechar esta aba.'); }
    renderCart();
  }

  function pulseCartCount() {
    const badge = $('#cart-count');
    badge.classList.remove('is-pulsing');
    void badge.offsetWidth;
    badge.classList.add('is-pulsing');
    setTimeout(() => badge.classList.remove('is-pulsing'), 500);
  }

  function renderCart() {
    const items = cartItems();
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const totalLabel = `${money(total)}${items.some(item => !Number(item.product.price)) ? ' + sob consulta' : ''}`;
    $('#cart-count').textContent = count;
    $('#drawer-count').textContent = `(${count})`;
    $('#cart-lines').innerHTML = items.map(({ product, quantity }) => `<article class="cart-line"><img src="${escapeHTML(imagesFor(product)[0])}" alt="" onerror="this.onerror=null;this.src='assets/print-vase.svg'"><div><h3>${escapeHTML(product.name)}</h3><span class="cart-line-price">${priceLabel(product.price)}</span><p class="product-availability" data-availability="${escapeHTML(availabilityFor(product).status || 'check')}">${escapeHTML(availabilityText(product))}</p><div class="cart-line-actions"><div class="qty-control"><button data-qty="${escapeHTML(product.id)}" data-delta="-1" aria-label="Diminuir">−</button><span>${quantity}</span><button data-qty="${escapeHTML(product.id)}" data-delta="1" aria-label="Aumentar">+</button></div><button class="remove-line" data-remove="${escapeHTML(product.id)}">Remover</button></div></div><strong class="cart-line-price">${priceLabel(Number(product.price) * quantity)}</strong></article>`).join('');
    $('#checkout-lines').innerHTML = items.map(({ product, quantity }) => `<div class="checkout-line"><img src="${escapeHTML(imagesFor(product)[0])}" alt="" onerror="this.onerror=null;this.src='assets/print-vase.svg'"><span>${quantity} × ${escapeHTML(product.name)}</span><strong>${priceLabel(Number(product.price) * quantity)}</strong></div>`).join('');
    $('#cart-empty').hidden = count > 0;
    $('#drawer-footer').hidden = count === 0;
    $('#cart-total').textContent = totalLabel;
    $('#checkout-total').textContent = totalLabel;
    $('#checkout-items-count').textContent = `${count} ${count === 1 ? 'produto' : 'produtos'}`;
  }

  function setDrawer(open) {
    $('#cart-overlay').hidden = !open;
    $('#cart-drawer').classList.toggle('is-open', open);
    $('#cart-drawer').setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('drawer-open', open);
  }

  function setNavigation(open) {
    $('#main-nav').classList.toggle('is-open', open);
    $('#nav-toggle').setAttribute('aria-expanded', String(open));
    $('#nav-toggle').setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  }

  function sendOrder(event) {
    event.preventDefault();
    if (!CONFIG.whatsapp) return notify('Configure o WhatsApp em docs/js/config.js antes de receber pedidos.');
    const form = new FormData(event.currentTarget);
    const items = cartItems();
    if (!items.length) return notify('Adicione pelo menos uma peça à sacola antes de enviar o pedido.');
    const phoneDigits = String(form.get('phone') || '').replace(/\D/g, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 15) return notify('Confira o número do seu WhatsApp (8 a 15 dígitos).');
    const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const totalLabel = `${money(total)}${items.some(item => !Number(item.product.price)) ? ' + itens sob consulta' : ''}`;
    const message = [CONFIG.greeting || 'Olá! Vim pelo catálogo.', '', '*Quero fazer um pedido:*', ...items.map(({ product, quantity }) => `• ${quantity}x ${product.name} — ${priceLabel(Number(product.price) * quantity)} — ${availabilityText(product)}`), '', `*Subtotal estimado: ${totalLabel}*`, '', `*Nome:* ${form.get('name')}`, `*WhatsApp:* ${form.get('phone')}`, `*Cidade/região:* ${form.get('city') || 'Não informada'}`, `*Observações:* ${form.get('notes') || 'Nenhuma'}`, '', 'Pode confirmar a disponibilidade, o prazo de produção e a entrega para mim?'].join('\n');
    window.open(`https://wa.me/${String(CONFIG.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    $('#checkout-dialog').close();
    setDrawer(false);
    notify('Pedido preparado no WhatsApp. Confirme o envio por lá!');
  }

  async function init() {
    const brand = String(CONFIG.brand || 'NicWill Lab 3D').trim().split(/\s+/);
    document.querySelectorAll('.brand-name').forEach(element => {
      element.innerHTML = `${escapeHTML(brand[0] || 'NicWill')}${brand.length > 1 ? ` <b>${escapeHTML(brand.slice(1).join(' '))}</b>` : ''}`;
    });
    document.title = `${CONFIG.brand || 'NicWill Lab 3D'} — ideias em outra dimensão`;
    $('#current-year').textContent = new Date().getFullYear();
    $('#custom-whatsapp').href = `https://wa.me/${String(CONFIG.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(`${CONFIG.greeting || 'Olá!'} Tenho uma ideia para um projeto personalizado.`)}`;
    $('#custom-whatsapp').target = '_blank';
    $('#custom-whatsapp').rel = 'noopener noreferrer';
    try {
      const response = await fetch('data/products.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('Não foi possível carregar os produtos.');
      const data = await response.json();
      state.products = Array.isArray(data) ? data : data.products || [];
      try {
        const draft = JSON.parse(localStorage.getItem('nilo3d-admin-draft-v1') || 'null');
        if (Array.isArray(draft) && draft.every(product => product && product.id && product.name)) state.products = draft;
        const preview = JSON.parse(localStorage.getItem('nilo3d-availability-preview-v1') || '{}');
        if (preview && typeof preview === 'object' && !Array.isArray(preview)) {
          state.products = state.products.map(product => preview[product.id] ? { ...product, availability: preview[product.id] } : product);
        }
      } catch (error) { /* Continua usando o catálogo publicado se o rascunho local estiver inválido. */ }
      try {
        const response = await fetch('data/categories.json', { cache: 'no-cache' });
        if (response.ok) {
          const categories = await response.json();
          if (Array.isArray(categories)) state.categories = window.NicWillInventory?.normalizeCategories(categories) || categories;
        }
      } catch (error) { /* Categorias dos próprios produtos continuam como fallback. */ }
      renderCategories(); renderProducts(); renderCart();
    } catch (error) {
      $('#results-count').textContent = 'Catálogo indisponível';
      $('#empty-state').hidden = false;
      $('#empty-state h3').textContent = 'Não foi possível carregar o catálogo';
      $('#empty-state p').textContent = 'Abra o site pela publicação GitHub Pages ou use um servidor local para visualizar os produtos.';
    }
  }

  document.addEventListener('click', event => {
    const add = event.target.closest('[data-add]');
    const change = event.target.closest('[data-qty]');
    const remove = event.target.closest('[data-remove]');
    const category = event.target.closest('[data-category]');
    const details = event.target.closest('[data-details]');
    const detailAdd = event.target.closest('[data-detail-add]');
    const thumbnail = event.target.closest('[data-image-index]');
    if (add) { state.cart[add.dataset.add] = (state.cart[add.dataset.add] || 0) + 1; saveCart(); pulseCartCount(); notify('Peça adicionada à sacola'); }
    if (change) { const id = change.dataset.qty; state.cart[id] = (state.cart[id] || 0) + Number(change.dataset.delta); if (state.cart[id] <= 0) delete state.cart[id]; saveCart(); }
    if (remove) { delete state.cart[remove.dataset.remove]; saveCart(); }
    if (category) { state.category = category.dataset.category; renderCategories(); renderProducts(); }
    if (details && !add) openProductDetail(details.dataset.details);
    if (detailAdd) { const id = detailAdd.dataset.detailAdd; state.cart[id] = (state.cart[id] || 0) + 1; saveCart(); pulseCartCount(); $('#product-dialog').close(); notify('Peça adicionada à sacola'); }
    if (thumbnail) { state.imageIndex = Number(thumbnail.dataset.imageIndex); renderProductDetail(); }
  });
  $('#search-input').addEventListener('input', event => { state.query = event.target.value; renderProducts(); });
  $('#sort-select').addEventListener('change', renderProducts);
  $('#clear-filters').addEventListener('click', () => { state.category = 'Todos'; state.query = ''; $('#search-input').value = ''; renderCategories(); renderProducts(); });
  $('#open-cart').addEventListener('click', () => setDrawer(true));
  $('#close-cart').addEventListener('click', () => setDrawer(false));
  $('#cart-overlay').addEventListener('click', () => setDrawer(false));
  $('#continue-shopping').addEventListener('click', () => setDrawer(false));
  $('#nav-toggle').addEventListener('click', () => setNavigation($('#nav-toggle').getAttribute('aria-expanded') !== 'true'));
  $('#main-nav').addEventListener('click', event => { if (event.target.closest('a')) setNavigation(false); });
  document.addEventListener('click', event => { if (!event.target.closest('.site-header')) setNavigation(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 760) setNavigation(false); });
  $('#open-checkout').addEventListener('click', () => { setDrawer(false); $('#checkout-dialog').showModal(); });
  $('#close-checkout').addEventListener('click', () => $('#checkout-dialog').close());
  $('#close-product').addEventListener('click', () => $('#product-dialog').close());
  $('#product-dialog').addEventListener('close', () => $('#detail-video-frame').removeAttribute('src'));
  $('#gallery-prev').addEventListener('click', () => moveGallery(-1));
  $('#gallery-next').addEventListener('click', () => moveGallery(1));
  const detailGallery = $('.detail-image-wrap');
  let galleryTouchStart = null;
  detailGallery.addEventListener('touchstart', event => {
    const touch = event.changedTouches[0];
    galleryTouchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  detailGallery.addEventListener('touchend', event => {
    if (!galleryTouchStart) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - galleryTouchStart.x;
    const deltaY = touch.clientY - galleryTouchStart.y;
    galleryTouchStart = null;
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) moveGallery(deltaX < 0 ? 1 : -1);
  }, { passive: true });
  $('#product-dialog').addEventListener('click', event => { if (event.target === $('#product-dialog')) $('#product-dialog').close(); });
  $('#checkout-form').addEventListener('submit', sendOrder);
  $('#search-input').addEventListener('keydown', event => { if (event.key === 'Escape') { event.target.value = ''; state.query = ''; renderProducts(); } });
  document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#search-input').focus(); } if (event.key === 'Escape') { setDrawer(false); setNavigation(false); } });
  init();
})();
