const SHEET_ID = "1fhPzX3iDnPlcXMPq4JnV6UhDQrkPulf7EnoINVmBn6g";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby_yVo-DDsrUzbSNcXgzoblrR7L4e2eTTYGpa-juNBEDe3MnRxHpkjetiBeiO3-xgTTQg/exec";
const SHEET_NAME = "Квартиры";

let apartments = [];
let currentApartmentId = null;

const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

function loadData() {
  document.getElementById('tableBody').innerHTML = '<tr><td colspan="10" class="loading">Загрузка данных...</td></tr>';
  fetch(csvUrl)
    .then(res => res.text())
    .then(csvText => {
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      apartments = parsed.data;
      populateFilters();
      renderTable();
      updateStats();
      document.getElementById('lastLoad').textContent = new Date().toLocaleString('ru-RU');
    })
    .catch(err => {
      document.getElementById('tableBody').innerHTML =
        `<tr><td colspan="10" class="loading">Ошибка загрузки данных: ${err}</td></tr>`;
    });
}

function populateFilters() {
  const objSet = new Set(), stageSet = new Set(), statusSet = new Set(), otvSet = new Set();
  apartments.forEach(a => {
    if (a.Объект) objSet.add(a.Объект);
    if (a.Стадия) stageSet.add(a.Стадия);
    if (a.Статус) statusSet.add(a.Статус);
    if (a.Ответственный) otvSet.add(a.Ответственный);
  });
  fillSelect('filterObjekt', objSet);
  fillSelect('filterStage', stageSet);
  fillSelect('filterStatus', statusSet);
  fillSelect('filterOtvetstv', otvSet);
}

function fillSelect(id, valuesSet) {
  const sel = document.getElementById(id);
  const current = sel.value;
  sel.innerHTML = sel.options[0].outerHTML;
  Array.from(valuesSet).sort().forEach(v => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    sel.appendChild(opt);
  });
  sel.value = current;
}

function getFiltered() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const fObj = document.getElementById('filterObjekt').value;
  const fStage = document.getElementById('filterStage').value;
  const fStatus = document.getElementById('filterStatus').value;
  const fOtv = document.getElementById('filterOtvetstv').value;
  const sort = document.getElementById('sortSelect').value;

  let list = apartments.filter(a => {
    if (search && !(String(a.ID||'').toLowerCase().includes(search) || String(a.Номер_квартиры||'').toLowerCase().includes(search))) return false;
    if (fObj && a.Объект !== fObj) return false;
    if (fStage && a.Стадия !== fStage) return false;
    if (fStatus && a.Статус !== fStatus) return false;
    if (fOtv && a.Ответственный !== fOtv) return false;
    return true;
  });

  if (sort === 'percent_asc') list.sort((a,b) => (parseFloat(a.Процент)||0) - (parseFloat(b.Процент)||0));
  if (sort === 'percent_desc') list.sort((a,b) => (parseFloat(b.Процент)||0) - (parseFloat(a.Процент)||0));
  if (sort === 'date_asc') list.sort((a,b) => parseDate(a.Дата_обновления) - parseDate(b.Дата_обновления));
  if (sort === 'date_desc') list.sort((a,b) => parseDate(b.Дата_обновления) - parseDate(a.Дата_обновления));
  if (sort === 'id_asc') list.sort((a,b) => String(a.ID).localeCompare(String(b.ID)));

  return list;
}

function parseDate(str) {
  if (!str) return 0;
  const parts = str.split('.');
  if (parts.length === 3) return new Date(parts[2], parts[1]-1, parts[0]).getTime();
  return new Date(str).getTime() || 0;
}

function statusClassName(status) {
  if (!status) return '';
  const normalized = status.trim().toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/g, '');
  const map = {
    'завершено': 'status-zaversheno',
    'вработе': 'status-vrabote',
    'заморожено': 'status-zamorozheno',
    'неначато': 'status-nenachato'
  };
  return map[normalized] || '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function renderTable() {
  const list = getFiltered();
  const tbody = document.getElementById('tableBody');
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Нет данных по заданным фильтрам</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(a => {
    const pct = parseFloat(a.Процент) || 0;
    const statusClass = statusClassName(a.Статус);
    const remainingFull = escapeHtml(a.Что_осталось || '');
    return `<tr data-id="${a.ID}">
      <td data-label="ID">${a.ID || ''}</td>
      <td data-label="Объект">${a.Объект || ''}</td>
      <td data-label="№ кв.">${a.Номер_квартиры || ''}</td>
      <td data-label="Этаж">${a.Этаж || ''}</td>
      <td data-label="Стадия">${a.Стадия || ''}</td>
      <td data-label="Прогресс">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${pct}%">${pct}%</div>
        </div>
      </td>
      <td data-label="Что осталось" title="${remainingFull}">${a.Что_осталось || ''}</td>
      <td data-label="Ответственный">${a.Ответственный || ''}</td>
      <td data-label="Статус"><span class="status-tag ${statusClass}">${a.Статус || ''}</span></td>
      <td data-label="Обновлено">${a.Дата_обновления || ''}</td>
    </tr>`;
  }).join('');

  document.querySelectorAll('#tableBody tr').forEach(row => {
    row.addEventListener('click', () => openModal(row.dataset.id));
  });
}

function updateStats() {
  const total = apartments.length;
  const done = apartments.filter(a => a.Статус === 'Завершено').length;
  const inProgress = apartments.filter(a => a.Статус === 'В работе').length;
  const avgPct = total ? (apartments.reduce((s,a) => s + (parseFloat(a.Процент)||0), 0) / total).toFixed(1) : 0;
  document.getElementById('stats').textContent =
    `Всего квартир: ${total} | Завершено: ${done} | В работе: ${inProgress} | Средний прогресс: ${avgPct}%`;
}

function openModal(id) {
  currentApartmentId = id;
  const apt = apartments.find(a => a.ID === id);
  if (!apt) return;

  document.getElementById('modalTitle').textContent = `${apt.Объект} — кв. ${apt.Номер_квартиры} (${apt.ID})`;

  const fields = [
    ['Объект', apt.Объект, false], ['Номер квартиры', apt.Номер_квартиры, false],
    ['Этаж', apt.Этаж, false], ['Подъезд', apt.Подъезд, false],
    ['Площадь, м²', apt.Площадь_м2, false], ['Стадия', apt.Стадия, false],
    ['Процент выполнения', (apt.Процент||0) + '%', false], ['Ответственный', apt.Ответственный, false],
    ['Статус', apt.Статус, false], ['Дата обновления', apt.Дата_обновления, false],
    ['Что осталось', apt.Что_осталось, true], ['Примечание', apt.Примечание, true]
  ];
  document.getElementById('detailsContent').innerHTML = fields.map(([k,v,full]) =>
    `<div class="detail-field${full ? ' full-width' : ''}"><span class="label">${k}</span><span class="value">${v || '—'}</span></div>`).join('');

  loadComments(id);
  document.getElementById('modalOverlay').classList.remove('hidden');
  switchTab('details');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('tabDetails').classList.toggle('active', tab === 'details');
  document.getElementById('tabComments').classList.toggle('active', tab === 'comments');
}

function loadComments(id) {
  const list = document.getElementById('commentsList');
  list.innerHTML = 'Загрузка комментариев...';
  fetch(`${APPS_SCRIPT_URL}?idKvartiry=${encodeURIComponent(id)}`)
    .then(res => res.json())
    .then(comments => {
      if (!comments.length) {
        list.innerHTML = '<p style="color:#888;">Комментариев пока нет.</p>';
        return;
      }
      list.innerHTML = comments.map(c => `
        <div class="comment-item">
          <div class="comment-meta">${c.author} — ${new Date(c.date).toLocaleString('ru-RU')}</div>
          <div>${c.comment}</div>
        </div>`).join('');
    })
    .catch(() => { list.innerHTML = '<p style="color:red;">Ошибка загрузки комментариев.</p>'; });
}

function submitComment(e) {
  e.preventDefault();
  const author = document.getElementById('commentAuthor').value.trim();
  const comment = document.getElementById('commentText').value.trim();
  const statusDiv = document.getElementById('commentStatus');
  if (!author || !comment) return;

  statusDiv.textContent = 'Отправка...';
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ idKvartiry: currentApartmentId, author, comment })
  })
    .then(res => res.json())
    .then(() => {
      statusDiv.textContent = 'Комментарий добавлен!';
      document.getElementById('commentText').value = '';
      loadComments(currentApartmentId);
    })
    .catch(() => { statusDiv.textContent = 'Ошибка отправки. Попробуйте снова.'; });
}

function initEventListeners() {
  document.getElementById('searchInput').addEventListener('input', renderTable);
  document.getElementById('filterObjekt').addEventListener('change', renderTable);
  document.getElementById('filterStage').addEventListener('change', renderTable);
  document.getElementById('filterStatus').addEventListener('change', renderTable);
  document.getElementById('filterOtvetstv').addEventListener('change', renderTable);
  document.getElementById('sortSelect').addEventListener('change', renderTable);
  document.getElementById('refreshBtn').addEventListener('click', loadData);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('modalOverlay').classList.contains('hidden')) {
      closeModal();
    }
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.getElementById('commentForm').addEventListener('submit', submitComment);
}

initEventListeners();
loadData();
