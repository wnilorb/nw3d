((root, factory) => {
  const inventory = factory();
  if (typeof module === 'object' && module.exports) module.exports = inventory;
  root.NicWillInventory = inventory;
})(globalThis, () => {
  const MOVEMENT_TYPES = new Set(['production', 'sale', 'adjustment', 'consignment_transfer', 'consignment_sale', 'consignment_return']);
  const isValidDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const newId = prefix => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  function categoryKey(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  }

  function normalizeCategories(values) {
    const categories = new Map();
    for (const value of Array.isArray(values) ? values : []) {
      const name = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      const key = categoryKey(name);
      if (key && !categories.has(key)) categories.set(key, name);
    }
    return [...categories.values()];
  }

  function orderedActiveCategories(categories, products) {
    const active = (products || []).filter(product => product && product.active !== false && product.category).map(product => product.category);
    const activeKeys = new Set(active.map(categoryKey));
    const ordered = [];
    const included = new Set();
    for (const category of Array.isArray(categories) ? categories : []) {
      const key = categoryKey(category);
      if (activeKeys.has(key) && !included.has(key)) { included.add(key); ordered.push(category); }
    }
    for (const category of active) {
      const key = categoryKey(category);
      if (!included.has(key)) { included.add(key); ordered.push(category); }
    }
    return ordered;
  }

  function parseBRLCents(value) {
    const raw = String(value ?? '').trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
    if (!raw || raw.startsWith('-')) return null;
    let normalized = raw;
    if (raw.includes(',')) {
      if ((raw.match(/,/g) || []).length !== 1) return null;
      const [whole, fraction] = raw.split(',');
      const digits = whole.replace(/\./g, '') || '0';
      if (!/^\d+$/.test(digits) || !/^\d{0,2}$/.test(fraction)) return null;
      normalized = `${digits}.${fraction.padEnd(2, '0') || '00'}`;
    } else if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
      normalized = raw.replace(/\./g, '');
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount < 0) return null;
    const cents = Math.round(amount * 100);
    return Number.isSafeInteger(cents) ? cents : null;
  }

  function formatBRLInput(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return '';
    return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function youtubeVideoId(value) {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol !== 'https:') return '';
      if (['youtu.be', 'www.youtu.be'].includes(url.hostname)) {
        const id = url.pathname.split('/').filter(Boolean)[0] || '';
        return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : '';
      }
      if (!['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) return '';
      const match = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
      return /^[A-Za-z0-9_-]{6,}$/.test(match || '') ? match : '';
    } catch (error) { return ''; }
  }

  function youtubeEmbedUrl(value) {
    const id = youtubeVideoId(value);
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0` : '';
  }

  function parseCart(value) {
    let parsed;
    try { parsed = typeof value === 'string' ? JSON.parse(value || '{}') : value; }
    catch (error) { return {}; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).map(([id, quantity]) => [String(id), Number(quantity)])
      .filter(([id, quantity]) => id && Number.isSafeInteger(quantity) && quantity > 0));
  }

  function validatePartner(value = {}) {
    if (!value || !Array.isArray(value.partners) || !Array.isArray(value.receipts)) throw new Error('O cadastro de parceiros está inválido.');
    const ids = new Set();
    const partners = value.partners.map(partner => {
      const id = String(partner?.id || '').trim();
      const name = String(partner?.name || '').trim().slice(0, 80);
      if (!id || !name || ids.has(id)) throw new Error('O cadastro contém parceiro vazio ou duplicado.');
      ids.add(id);
      return { id, name };
    });
    const receipts = value.receipts.map((receipt, index) => {
      if (!receipt || !ids.has(receipt.partnerId) || !Number.isSafeInteger(receipt.amountCents) || receipt.amountCents <= 0 || !isValidDate(receipt.date)) throw new Error('O histórico contém um repasse inválido.');
      return { id: String(receipt.id || `${receipt.date}-${index + 1}`), partnerId: receipt.partnerId, amountCents: receipt.amountCents, date: receipt.date, note: String(receipt.note || '').slice(0, 120) };
    });
    return { partners, receipts };
  }

  function consumePartnerLots(lots, quantity) {
    let remaining = quantity;
    let amountCents = 0;
    while (remaining > 0) {
      const lot = lots.find(item => item.remaining > 0);
      if (!lot) throw new Error('O parceiro não tem unidades consignadas suficientes deste produto.');
      const used = Math.min(remaining, lot.remaining);
      lot.remaining -= used;
      remaining -= used;
      amountCents += used * lot.unitWholesalePriceCents;
    }
    return amountCents;
  }

  function validateBook(value) {
    if (!value || !Number.isSafeInteger(value.initial) || value.initial < 0 || !Array.isArray(value.movements)) {
      throw new Error('O backup contém um estoque inicial ou uma lista de movimentos inválidos.');
    }
    let balance = value.initial;
    const partnerBalances = new Map();
    const partnerLots = new Map();
    const movements = [];
    for (const [index, movement] of value.movements.entries()) {
      if (!movement || !MOVEMENT_TYPES.has(movement.type) || !Number.isSafeInteger(movement.quantity) || !isValidDate(movement.date)) {
        throw new Error('O backup contém um movimento inválido.');
      }
      if (movement.type === 'adjustment' ? movement.quantity === 0 : movement.quantity <= 0) {
        throw new Error('A quantidade do movimento precisa ser válida e diferente de zero.');
      }
      let normalized = {
        id: String(movement.id || `${movement.date}-${index + 1}`), type: movement.type,
        quantity: movement.quantity, date: movement.date, note: String(movement.note || '').slice(0, 120)
      };
      if (movement.type === 'sale' && movement.unitPriceCents !== undefined) {
        if (!Number.isSafeInteger(movement.unitPriceCents) || movement.unitPriceCents < 0) throw new Error('Preço de venda inválido.');
        normalized.unitPriceCents = movement.unitPriceCents;
      }
      if (movement.type === 'sale' && ['retail', 'wholesale'].includes(movement.channel)) normalized.channel = movement.channel;
      if (movement.type === 'production') balance += movement.quantity;
      if (movement.type === 'sale') balance -= movement.quantity;
      if (movement.type === 'adjustment') balance += movement.quantity;
      if (movement.type.startsWith('consignment_')) {
        const partnerId = String(movement.partnerId || '').trim();
        const partnerName = String(movement.partnerName || '').trim().slice(0, 80);
        if (!partnerId || !partnerName) throw new Error('Informe o parceiro da movimentação consignada.');
        normalized.partnerId = partnerId;
        normalized.partnerName = partnerName;
        const partnerBalance = partnerBalances.get(partnerId) || 0;
        if (movement.type === 'consignment_transfer') {
          if (!Number.isSafeInteger(movement.unitWholesalePriceCents) || movement.unitWholesalePriceCents < 0) throw new Error('Preço de atacado inválido na transferência.');
          normalized.unitWholesalePriceCents = movement.unitWholesalePriceCents;
          balance -= movement.quantity;
          partnerBalances.set(partnerId, partnerBalance + movement.quantity);
          if (!partnerLots.has(partnerId)) partnerLots.set(partnerId, []);
          partnerLots.get(partnerId).push({ remaining: movement.quantity, unitWholesalePriceCents: movement.unitWholesalePriceCents });
        } else {
          if (partnerBalance < movement.quantity) throw new Error('A quantidade informada supera o estoque consignado com este parceiro.');
          partnerBalances.set(partnerId, partnerBalance - movement.quantity);
          const amountCents = consumePartnerLots(partnerLots.get(partnerId) || [], movement.quantity);
          if (movement.type === 'consignment_sale') {
            if (movement.amountCents !== undefined && movement.amountCents !== amountCents) throw new Error('O valor da venda consignada não confere com os lotes transferidos.');
            normalized.amountCents = amountCents;
          } else balance += movement.quantity;
        }
      }
      if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('Um movimento deixaria o saldo do estoque negativo.');
      movements.push(normalized);
    }
    return { initial: value.initial, movements };
  }

  function hasStockHistory(book) {
    if (!book) return false;
    const valid = validateBook(book);
    return valid.initial > 0 || valid.movements.length > 0;
  }

  function summarize(book) {
    const valid = validateBook(book);
    return valid.movements.reduce((summary, movement) => {
      if (movement.type === 'production') summary.produced += movement.quantity;
      if (movement.type === 'sale') { summary.sold += movement.quantity; summary.directSold += movement.quantity; }
      if (movement.type === 'consignment_sale') { summary.sold += movement.quantity; summary.consignmentSold += movement.quantity; summary.consignmentOnHand -= movement.quantity; }
      if (movement.type === 'consignment_transfer') { summary.consignmentSent += movement.quantity; summary.consignmentOnHand += movement.quantity; }
      if (movement.type === 'consignment_return') { summary.consignmentReturned += movement.quantity; summary.consignmentOnHand -= movement.quantity; }
      if (movement.type === 'adjustment') summary.adjustment += movement.quantity;
      if (movement.type === 'sale' && Number.isSafeInteger(movement.unitPriceCents)) summary.salesCents += movement.unitPriceCents * movement.quantity;
      if (movement.type === 'consignment_sale') summary.salesCents += movement.amountCents;
      summary.balance += movement.type === 'production' ? movement.quantity
        : ['sale', 'consignment_transfer'].includes(movement.type) ? -movement.quantity
          : ['adjustment', 'consignment_return'].includes(movement.type) ? movement.quantity : 0;
      return summary;
    }, { initial: valid.initial, produced: 0, sold: 0, directSold: 0, consignmentSold: 0, consignmentSent: 0, consignmentReturned: 0, consignmentOnHand: 0, adjustment: 0, salesCents: 0, balance: valid.initial });
  }

  function record(book, input) {
    const valid = validateBook(book);
    if (!input || !MOVEMENT_TYPES.has(input.type)) throw new Error('Escolha um tipo de movimentação válido.');
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) throw new Error('Informe uma quantidade inteira maior que zero.');
    const date = String(input.date || '');
    if (!isValidDate(date)) throw new Error('Informe uma data válida.');
    const movement = {
      id: newId('mov'),
      type: input.type,
      quantity: input.type === 'adjustment' && input.direction === 'decrease' ? -input.quantity : input.quantity,
      date,
      note: String(input.note || '').trim().slice(0, 120)
    };
    if (input.type === 'sale') {
      if (!Number.isSafeInteger(input.unitPriceCents) || input.unitPriceCents < 0) throw new Error('Informe um preço de venda válido.');
      movement.unitPriceCents = input.unitPriceCents;
      movement.channel = input.channel === 'wholesale' ? 'wholesale' : 'retail';
    }
    if (input.type.startsWith('consignment_')) {
      movement.partnerId = String(input.partnerId || '').trim();
      movement.partnerName = String(input.partnerName || '').trim();
      if (!movement.partnerId || !movement.partnerName) throw new Error('Informe o parceiro da movimentação consignada.');
      if (input.type === 'consignment_transfer') {
        if (!Number.isSafeInteger(input.unitWholesalePriceCents) || input.unitWholesalePriceCents < 0) throw new Error('Informe o preço de atacado por unidade.');
        movement.unitWholesalePriceCents = input.unitWholesalePriceCents;
      }
      if (input.type === 'consignment_sale') {
        const lots = [];
        for (const entry of valid.movements) {
          if (entry.partnerId !== movement.partnerId) continue;
          if (entry.type === 'consignment_transfer') lots.push({ remaining: entry.quantity, unitWholesalePriceCents: entry.unitWholesalePriceCents });
          if (entry.type === 'consignment_sale' || entry.type === 'consignment_return') consumePartnerLots(lots, entry.quantity);
        }
        movement.amountCents = consumePartnerLots(lots, input.quantity);
      }
    }
    return validateBook({ initial: valid.initial, movements: [...valid.movements, movement] });
  }

  function validatePartnerLedger(value = { partners: [], receipts: [] }) {
    return validatePartner(value);
  }

  function partnerSummary(inventoryBooks, value) {
    const ledger = validatePartner(value);
    const summaries = new Map(ledger.partners.map(partner => [partner.id, { ...partner, units: 0, products: {}, salesCents: 0, receivedCents: 0, dueCents: 0 }]));
    for (const [productId, book] of Object.entries(inventoryBooks || {})) {
      for (const movement of validateBook(book).movements) {
        if (!movement.partnerId) continue;
        if (!summaries.has(movement.partnerId)) summaries.set(movement.partnerId, { id: movement.partnerId, name: movement.partnerName, units: 0, products: {}, salesCents: 0, receivedCents: 0, dueCents: 0 });
        const summary = summaries.get(movement.partnerId);
        if (!summary.products[productId]) summary.products[productId] = 0;
        if (movement.type === 'consignment_transfer') summary.products[productId] += movement.quantity;
        if (movement.type === 'consignment_return') summary.products[productId] -= movement.quantity;
        if (movement.type === 'consignment_sale') { summary.products[productId] -= movement.quantity; summary.salesCents += movement.amountCents; }
      }
    }
    for (const receipt of ledger.receipts) summaries.get(receipt.partnerId).receivedCents += receipt.amountCents;
    for (const summary of summaries.values()) {
      summary.units = Object.values(summary.products).reduce((sum, quantity) => sum + quantity, 0);
      summary.dueCents = Math.max(0, summary.salesCents - summary.receivedCents);
    }
    return [...summaries.values()].filter(partner => partner.units || partner.salesCents || partner.receivedCents).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  function recordPartnerReceipt(value, input, outstandingCents) {
    const ledger = validatePartner(value);
    if (!ledger.partners.some(partner => partner.id === input?.partnerId)) throw new Error('Selecione um parceiro cadastrado.');
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new Error('Informe o valor recebido.');
    if (input.amountCents > outstandingCents) throw new Error('O repasse não pode ser maior que o valor pendente do parceiro.');
    if (!isValidDate(input.date)) throw new Error('Informe uma data válida.');
    return validatePartner({
      ...ledger,
      receipts: [...ledger.receipts, { id: newId('repasse'), partnerId: input.partnerId, amountCents: input.amountCents, date: input.date, note: String(input.note || '').trim().slice(0, 120) }]
    });
  }

  function availability(book, minDays = 3, maxDays = 5) {
    const leadTimeMinDays = Number.isSafeInteger(minDays) && minDays >= 1 ? minDays : 3;
    const leadTimeMaxDays = Number.isSafeInteger(maxDays) && maxDays >= leadTimeMinDays ? maxDays : Math.max(leadTimeMinDays, 5);
    const range = {
      leadTimeMinDays, leadTimeMaxDays
    };
    if (!book) return { status: 'check', ...range };
    return { status: summarize(book).balance > 0 ? 'in-stock' : 'made-to-order', ...range };
  }

  function describe(value) {
    const availability = value || { status: 'check' };
    if (availability.status === 'in-stock') return 'Pronta entrega · confirme a disponibilidade pelo WhatsApp';
    if (availability.status === 'made-to-order') {
      const min = Number.isSafeInteger(availability.leadTimeMinDays) && availability.leadTimeMinDays >= 1 ? availability.leadTimeMinDays : 3;
      const max = Number.isSafeInteger(availability.leadTimeMaxDays) && availability.leadTimeMaxDays >= min ? availability.leadTimeMaxDays : Math.max(min, 5);
      return `Sob encomenda · produção estimada em ${min} a ${max} dias úteis`;
    }
    return 'Consulte a disponibilidade pelo WhatsApp';
  }

  return { categoryKey, normalizeCategories, orderedActiveCategories, parseBRLCents, formatBRLInput, youtubeVideoId, youtubeEmbedUrl, parseCart, hasStockHistory, validateBook, summarize, record, validatePartnerLedger, partnerSummary, recordPartnerReceipt, availability, describe };
});
