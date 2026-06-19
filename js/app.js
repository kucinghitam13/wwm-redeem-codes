(function () {
  'use strict';

  const CSV_SOURCES = ['data/codes.csv'];
  const PAGE_SIZE = 50;
  const STORAGE_KEY = 'wwm-redeemed-codes';

  let allCodes = [];
  let currentFilter = 'all';
  let currentPage = 1;
  let searchQuery = '';

  const els = {
    body: document.getElementById('codes-body'),
    pagination: document.getElementById('pagination'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    pageInfo: document.getElementById('page-info'),
    statTotal: document.getElementById('stat-total'),
    statUnredeemed: document.getElementById('stat-unredeemed'),
    statRedeemed: document.getElementById('stat-redeemed'),
    errorBanner: document.getElementById('error-banner'),
    toast: document.getElementById('toast'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    searchInput: document.getElementById('code-search'),
  };

  function getRedeemedSet() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const data = JSON.parse(raw);
      return new Set(Array.isArray(data.redeemed) ? data.redeemed : []);
    } catch {
      return new Set();
    }
  }

  function saveRedeemedSet(set) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ redeemed: [...set] }));
  }

  function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const rows = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (i === 0 && line.toLowerCase() === 'code') continue;

      const comma = line.indexOf(',');
      const code = (comma === -1 ? line : line.slice(0, comma)).trim().toUpperCase();
      if (!code) continue;

      rows.push({ code });
    }

    return rows;
  }

  async function loadCodes() {
    let order = 0;
    const map = new Map();

    for (const src of CSV_SOURCES) {
      const res = await fetch(src);
      if (!res.ok) throw new Error('Failed to load ' + src + ' (' + res.status + ')');
      const rows = parseCSV(await res.text());

      for (const row of rows) {
        map.set(row.code, { code: row.code, order: order++ });
      }
    }

    return [...map.values()].sort((a, b) => b.order - a.order);
  }

  function getFilteredCodes(redeemedSet) {
    const query = searchQuery.trim().toLowerCase();

    return allCodes.filter((row) => {
      const isRedeemed = redeemedSet.has(row.code);
      if (currentFilter === 'redeemed' && !isRedeemed) return false;
      if (currentFilter === 'unredeemed' && isRedeemed) return false;
      if (query && !row.code.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  function updateStats(redeemedSet) {
    const redeemedCount = allCodes.filter((r) => redeemedSet.has(r.code)).length;
    els.statTotal.textContent = allCodes.length;
    els.statRedeemed.textContent = redeemedCount;
    els.statUnredeemed.textContent = allCodes.length - redeemedCount;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    els.toast.style.opacity = '1';
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      els.toast.style.opacity = '0';
      setTimeout(() => { els.toast.hidden = true; }, 200);
    }, 1500);
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      showToast('Copied ' + code);
    } catch {
      showToast('Copy failed');
    }
  }

  function toggleRedeemed(code) {
    const set = getRedeemedSet();
    if (set.has(code)) {
      set.delete(code);
    } else {
      set.add(code);
    }
    saveRedeemedSet(set);
    render();
  }

  function render() {
    const redeemedSet = getRedeemedSet();
    updateStats(redeemedSet);

    const filtered = getFilteredCodes(redeemedSet);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    els.body.innerHTML = '';

    if (pageRows.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'empty-cell';
      td.textContent = filtered.length === 0 && allCodes.length > 0
        ? (searchQuery.trim()
          ? 'No codes match your search.'
          : 'No codes match this filter.')
        : 'No codes found.';
      tr.appendChild(td);
      els.body.appendChild(tr);
    } else {
      for (const row of pageRows) {
        const isRedeemed = redeemedSet.has(row.code);
        const tr = document.createElement('tr');
        if (isRedeemed) tr.classList.add('redeemed');

        const tdCode = document.createElement('td');
        tdCode.className = 'code-cell' + (isRedeemed ? ' redeemed-code' : '');
        tdCode.textContent = row.code;
        tdCode.title = 'Click to copy';
        tdCode.addEventListener('click', () => copyCode(row.code));

        const tdStatus = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'badge ' + (isRedeemed ? 'badge-redeemed' : 'badge-available');
        badge.textContent = isRedeemed ? 'Redeemed' : 'Available';
        tdStatus.appendChild(badge);

        const tdAction = document.createElement('td');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn ' + (isRedeemed ? 'btn-unredeem' : 'btn-redeem');
        btn.textContent = isRedeemed ? 'Unredeem' : 'Mark redeemed';
        btn.addEventListener('click', () => toggleRedeemed(row.code));
        tdAction.appendChild(btn);

        tr.appendChild(tdCode);
        tr.appendChild(tdStatus);
        tr.appendChild(tdAction);
        els.body.appendChild(tr);
      }
    }

    els.pagination.hidden = filtered.length === 0;
    els.pageInfo.textContent = 'Page ' + currentPage + ' of ' + totalPages;
    els.btnPrev.disabled = currentPage <= 1;
    els.btnNext.disabled = currentPage >= totalPages;
  }

  function showError(message) {
    els.errorBanner.textContent = message;
    els.errorBanner.hidden = false;
    els.body.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.className = 'empty-cell';
    td.textContent = 'Unable to load codes.';
    tr.appendChild(td);
    els.body.appendChild(tr);
    els.pagination.hidden = true;
  }

  els.btnPrev.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  els.btnNext.addEventListener('click', () => {
    const redeemedSet = getRedeemedSet();
    const filtered = getFilteredCodes(redeemedSet);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage < totalPages) {
      currentPage++;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  els.filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      els.filterTabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      currentFilter = tab.dataset.filter;
      currentPage = 1;
      render();
    });
  });

  els.searchInput.addEventListener('input', () => {
    searchQuery = els.searchInput.value;
    currentPage = 1;
    render();
  });

  loadCodes()
    .then((codes) => {
      allCodes = codes;
      render();
    })
    .catch((err) => {
      showError(err.message);
    });
})();
