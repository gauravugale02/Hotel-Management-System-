// Shared table number handling — URL is the source of truth

function getAppBaseUrl() {
  if (typeof APP_BASE_URL === 'string' && APP_BASE_URL.trim()) {
    return APP_BASE_URL.trim().replace(/\/$/, '');
  }
  const path = window.location.pathname.replace(/[^/]*$/, '');
  return window.location.origin + path.replace(/\/$/, '');
}

function getTableFromUrl() {
  // 1. Inline bootstrap (set in <head> before scripts load)
  if (window.__TABLE_NUMBER__ && /^\d+$/.test(String(window.__TABLE_NUMBER__))) {
    return String(window.__TABLE_NUMBER__);
  }

  // 2. Hash: #table=3 or #t3 (best for mobile QR — never hits server, no 404)
  const hash = window.location.hash.replace(/^#/, '');
  if (/^t(\d+)$/i.test(hash)) return hash.match(/^t(\d+)$/i)[1];
  const hashMatch = window.location.hash.match(/table=(\d+)/i);
  if (hashMatch) return hashMatch[1];

  // 3. Query param: ?table=3 or ?n=3
  try {
    const params = new URLSearchParams(window.location.search);
    const table = params.get('table') || params.get('n');
    if (table && /^\d+$/.test(String(table).trim())) {
      return String(table).trim();
    }
  } catch (e) { /* ignore */ }

  // 4. Full href regex fallback
  const href = window.location.href;
  const queryMatch = href.match(/[?&]table=(\d+)/i);
  if (queryMatch) return queryMatch[1];

  // 5. Path: /table/3/ or /table/3.html
  const pathMatch = window.location.pathname.match(/\/table\/(\d+)(?:\.html)?\/?$/i);
  if (pathMatch) return pathMatch[1];

  return null;
}

function getTableNumber() {
  const fromUrl = getTableFromUrl();
  if (fromUrl) {
    try { sessionStorage.setItem('tableNumber', fromUrl); } catch (e) { /* private mode */ }
    return fromUrl;
  }
  try {
    const stored = sessionStorage.getItem('tableNumber');
    if (stored && /^\d+$/.test(stored)) return stored;
  } catch (e) { /* ignore */ }
  return null;
}

function setTableNumber(table) {
  if (table && /^\d+$/.test(String(table))) {
    try { sessionStorage.setItem('tableNumber', String(table)); } catch (e) { /* ignore */ }
    window.__TABLE_NUMBER__ = String(table);
  }
}

function getTableMenuUrl(table) {
  const t = table || getTableNumber();
  return t ? `menu.html?table=${t}#table=${t}` : 'index.html';
}

function getTableIndexUrl(table) {
  const t = table || getTableNumber();
  return t ? `index.html?table=${t}` : 'index.html';
}

function getTableOrderUrl(table) {
  const t = table || getTableNumber();
  return t ? `order-confirmed.html?table=${t}` : 'order-confirmed.html';
}

function getTableQrUrl(tableNumber) {
  // menu.html is a real file — always loads. Hash + query both carry table number.
  return `${getAppBaseUrl()}/menu.html?table=${tableNumber}#table=${tableNumber}`;
}

function updateTableBadge(elementId) {
  const el = document.getElementById(elementId || 'tableBadge');
  if (!el) return null;
  const table = getTableNumber();
  if (table) {
    el.textContent = 'Table ' + table;
    el.style.display = '';
  } else {
    el.textContent = 'No table';
    el.style.display = 'none';
  }
  return table;
}

function goToMenuWithTable(table) {
  setTableNumber(table);
  window.location.href = `menu.html?table=${table}#table=${table}`;
}

function parseTableNumber() {
  const table = getTableNumber();
  return table ? parseInt(table, 10) : null;
}

function captureTableFromUrl() {
  const fromUrl = getTableFromUrl();
  if (fromUrl) {
    setTableNumber(fromUrl);
    window.__TABLE_NUMBER__ = fromUrl;
  }
  return fromUrl;
}
