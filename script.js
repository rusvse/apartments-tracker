const SHEET_ID = "1fhPzX3iDnPlcXMPq4JnV6UhDQrkPulf7EnoINVmBn6g";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby_yVo-DDsrUzbSNcXgzoblrR7L4e2eTTYGpa-juNBEDe3MnRxHpkjetiBeiO3-xgTTQg/exec";
const SHEET_NAME = "Квартиры";
const WORKS_SHEET_NAME = "Работы";

let apartments = [];
let works = [];
let currentApartmentId = null;

const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
const worksCsvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(WORKS_SHEET_NAME)}`;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function parseDate(str) {
  if (!str) return 0;
  const parts = String(str).split('.');
  if (parts.length === 3) return new Date(parts[2], parts[1]-1, parts[0]).getTime();
  return new Date(str).getTime() || 0;
}

function statusClassName(status) {
  if (!status) return '';
  const normalized = status.trim().toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '');
  const map = { 'завершено': 'status-zaversheno', 'вработе': 'status-vrabote', 'заморожено': 'status-zamorozheno', 'неначато': 'status-nenachato', 'напроверке':'status-check', 'естьзамечания':'status-issues', 'приостановлено':'status-paused' };
  return map[normalized] || '';
}

function loadData() {
  document.getElementById('tableBody').innerHTML = '<tr><td colspan="10" class="loading">Загрузка данных...</td></tr>';
  Promise.all([
    fetch(csvUrl).then(r => r.text()),
    fetch(worksCsvUrl).then(r => r.text()).catch(() => '')
  ]).then(([apartmentsCsv, worksCsv]) => {
    apartments = Papa.parse(apartmentsCsv, { header: true, skipEmptyLines: true }).data;
    works = worksCsv ? Papa.parse(worksCsv, { header: true, skipEmptyLines: true }).data : [];
    populateFilters();
    renderTable();
    updateStats();
    renderOverview();
    renderWorksSummary();
    renderSettings();
    renderHistoryStub();
  }).catch(err => {
    document.getElementById('tableBody').innerHTML = `<tr><td colspan="10" class="loading">Ошибка загрузки данных: ${err}</td></tr>`;
  });
}

function fillSelect(id, valuesSet) {
  const sel = document.getElementById(id);
  const current = sel.value;
  sel.innerHTML = sel.options[0].outerHTML;
  Array.from(valuesSet).sort().forEach(v => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v; sel.appendChild(opt);
  });
  sel.value = current;
}

function populateFilters() {
  const objSet = new Set(), stageSet = new Set(), statusSet = new Set(), otvSet = new Set();
  apartments.forEach(a => {
    if (a.Объект) objSet.add(a.Объект);
    if (a.Стадия) stageSet.add(a.Стадия);
    if (a.Статус) statusSet.add(a.Статус);
    if (a.Ответственный) otvSet.add(a.Ответственный);
  });
  fillSelect('filterObjekt', objSet); fillSelect('filterStage', stageSet); fillSelect('filterStatus', statusSet); fillSelect('filterOtvetstv', otvSet);
}

function getFiltered() {
  const search = (document.getElementById('searchInput').value || document.getElementById('globalSearch').value).toLowerCase();
  const fObj = document.getElementById('filterObjekt').value;
  const fStage = document.getElementById('filterStage').value;
  const fStatus = document.getElementById('filterStatus').value;
  const fOtv = document.getElementById('filterOtvetstv').value;
  const sort = document.getElementById('sortSelect').value;
  let list = apartments.filter(a => {
    const hay = [a.ID, a.Номер_квартиры, a.Объект].join(' ').toLowerCase();
    if (search && !hay.includes(search)) return false;
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

function renderTable() {
  const list = getFiltered();
  const tbody = document.getElementById('tableBody');
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="10" class="loading">Нет данных по заданным фильтрам</td></tr>'; return; }
  tbody.innerHTML = list.map(a => {
    const pct = parseFloat(a.Процент) || 0;
    const statusClass = statusClassName(a.Статус);
    return `<tr data-id="${escapeHtml(a.ID)}"><td>${escapeHtml(a.ID)}</td><td>${escapeHtml(a.Объект)}</td><td>${escapeHtml(a.Номер_квартиры)}</td><td>${escapeHtml(a.Этаж)}</td><td>${escapeHtml(a.Стадия)}</td><td><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%">${pct}%</div></div></td><td>${escapeHtml(a.Что_осталось || '')}</td><td>${escapeHtml(a.Ответственный || '')}</td><td><span class="status-tag ${statusClass}">${escapeHtml(a.Статус || '')}</span></td><td>${escapeHtml(a.Дата_обновления || '')}</td></tr>`;
  }).join('');
  document.querySelectorAll('#tableBody tr').forEach(row => row.addEventListener('click', () => openModal(row.dataset.id)));
}

function updateStats() {
  const total = apartments.length;
  const done = apartments.filter(a => a.Статус === 'Завершено').length;
  const avgPct = total ? (apartments.reduce((s,a) => s + (parseFloat(a.Процент)||0), 0) / total).toFixed(1) : 0;
  document.getElementById('stats').textContent = `Всего: ${total} | Завершено: ${done} | Средний прогресс: ${avgPct}%`;
}

function renderOverview() {
  const total = apartments.length;
  const done = apartments.filter(a => a.Статус === 'Завершено').length;
  const avgPct = total ? (apartments.reduce((s,a) => s + (parseFloat(a.Процент)||0), 0) / total).toFixed(1) : '0';
  const late = apartments.filter(a => (parseFloat(a.Процент)||0) < 100 && parseDate(a.Дата_обновления) && (Date.now() - parseDate(a.Дата_обновления)) > 1000*60*60*24*7).length;
  document.getElementById('metricTotal').textContent = total;
  document.getElementById('metricAvg').textContent = `${avgPct}%`;
  document.getElementById('metricDone').textContent = done;
  document.getElementById('metricLate').textContent = late;

  const critical = apartments.filter(a => a.Статус !== 'Завершено').sort((a,b) => (parseFloat(a.Процент)||0) - (parseFloat(b.Процент)||0)).slice(0,5);
  document.getElementById('criticalApartments').innerHTML = critical.length ? critical.map(a => `<div class="list-card"><div><strong>${escapeHtml(a.ID)}</strong> — ${escapeHtml(a.Объект || '')}, кв. ${escapeHtml(a.Номер_квартиры || '')}</div><div class="muted">${escapeHtml(a.Стадия || '')} · ${parseFloat(a.Процент)||0}% · ${escapeHtml(a.Что_осталось || 'Без комментария')}</div></div>`).join('') : 'Нет критических квартир';

  const statuses = ['Не начато','В работе','На проверке','Есть замечания','Завершено','Приостановлено'];
  document.getElementById('statusSummary').innerHTML = statuses.map(s => `<div class="status-row"><span>${s}</span><strong>${apartments.filter(a => a.Статус === s).length}</strong></div>`).join('');

  const latest = [...apartments].sort((a,b) => parseDate(b.Дата_обновления) - parseDate(a.Дата_обновления)).slice(0,8);
  document.getElementById('latestUpdates').innerHTML = latest.length ? latest.map(a => `<div class="update-row"><span>${escapeHtml(a.Дата_обновления || '—')}</span><span>${escapeHtml(a.ID || '')}</span><span>${escapeHtml(a.Объект || '')}</span><span>${escapeHtml(a.Стадия || '')}</span><span>${escapeHtml(a.Статус || '')}</span></div>`).join('') : 'Нет обновлений';

  const deadlines = latest.slice(0,5);
  document.getElementById('deadlinesList').innerHTML = deadlines.length ? deadlines.map(a => `<div class="list-card"><div><strong>${escapeHtml(a.ID)}</strong> — ${escapeHtml(a.Объект || '')}</div><div class="muted">Обновлено: ${escapeHtml(a.Дата_обновления || '—')} · ${escapeHtml(a.Ответственный || '—')}</div></div>`).join('') : 'Дедлайнов не найдено';
}

function renderWorksSummary() {
  const box = document.getElementById('worksSummary');
  if (!works.length) { box.textContent = 'Лист «Работы» пока не найден или не заполнен'; return; }
  const sections = {};
  works.forEach(w => {
    const k = w.Раздел || 'Без раздела';
    const plan = parseFloat(String(w.Плановый_объем || '').replace(',', '.')) || 0;
    const fact = parseFloat(String(w.Выполненный_объем || '').replace(',', '.')) || 0;
    if (!sections[k]) sections[k] = { plan:0, fact:0, count:0 };
    sections[k].plan += plan; sections[k].fact += fact; sections[k].count += 1;
  });
  box.innerHTML = Object.entries(sections).map(([name,data]) => {
    const pct = data.plan ? Math.round((data.fact / data.plan) * 100) : 0;
    return `<div class="work-summary-card"><div class="work-summary-head"><strong>${escapeHtml(name)}</strong><span>${pct}%</span></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%"></div></div><div class="muted">Работ: ${data.count} · Выполнено: ${data.fact.toFixed(2)} / ${data.plan.toFixed(2)}</div></div>`;
  }).join('');
}

function renderSettings() {
  const objects = [...new Set(apartments.map(a => a.Объект).filter(Boolean))];
  const people = [...new Set(apartments.map(a => a.Ответственный).filter(Boolean))];
  document.getElementById('settingsObjects').innerHTML = objects.length ? objects.map(v => `<div class="setting-chip">${escapeHtml(v)}</div>`).join('') : 'Нет объектов';
  document.getElementById('settingsPeople').innerHTML = people.length ? people.map(v => `<div class="setting-chip">${escapeHtml(v)}</div>`).join('') : 'Нет ответственных';
}

function renderHistoryStub() {
  document.getElementById('historyFeed').innerHTML = `<div class="list-card"><div><strong>История статусов</strong></div><div class="muted">Сейчас доступна история комментариев внутри карточки квартиры. Полную ленту изменений статусов можно добавить следующим этапом через отдельный лист Google Таблицы.</div></div>`;
}

function getWorksForApartment(id) { return works.filter(w => w.ID_квартиры === id); }
function renderWorksBySection(id) {
  const list = getWorksForApartment(id); if (!list.length) return '';
  const sections = {};
  list.forEach(w => {
    const plan = parseFloat(String(w.Плановый_объем || '').replace(',', '.')) || 0;
    const fact = parseFloat(String(w.Выполненный_объем || '').replace(',', '.')) || 0;
    if (!sections[w.Раздел]) sections[w.Раздел] = { plan: 0, fact: 0, items: [] };
    sections[w.Раздел].plan += plan; sections[w.Раздел].fact += fact; sections[w.Раздел].items.push(w);
  });
  return '<div class="works-block">' + Object.entries(sections).map(([section, data]) => {
    const pct = data.plan ? Math.round((data.fact / data.plan) * 100) : 0;
    const itemsHtml = data.items.map(w => {
      const wPlan = parseFloat(String(w.Плановый_объем || '').replace(',', '.')) || 0;
      const wFact = parseFloat(String(w.Выполненный_объем || '').replace(',', '.')) || 0;
      return `<div class="work-item"><span class="work-name">${escapeHtml(w.Наименование_работы || '')}</span><span class="work-vol">${wFact}/${wPlan || '—'} ${escapeHtml(w.Ед_изм || '')}</span><span class="status-tag ${statusClassName(w.Статус)}">${escapeHtml(w.Статус || 'Не начато')}</span></div>`;
    }).join('');
    return `<div class="work-section"><div class="work-section-header"><span>${escapeHtml(section)}</span><span>${pct}%</span></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%"></div></div><div class="work-section-items">${itemsHtml}</div></div>`;
  }).join('') + '</div>';
}

function openModal(id) {
  currentApartmentId = id;
  const apt = apartments.find(a => a.ID === id);
  if (!apt) return;
  document.getElementById('modalTitle').textContent = `${apt.Объект} — кв. ${apt.Номер_квартиры} (${apt.ID})`;
  const fields = [
    ['Объект', apt.Объект, false], ['Номер квартиры', apt.Номер_квартиры, false], ['Этаж', apt.Этаж, false], ['Подъезд', apt.Подъезд, false], ['Площадь, м²', apt.Площадь_м2, false], ['Стадия', apt.Стадия, false], ['Процент выполнения', (apt.Процент||0) + '%', false], ['Ответственный', apt.Ответственный, false], ['Статус', apt.Статус, false], ['Дата обновления', apt.Дата_обновления, false], ['Что осталось', apt.Что_осталось, true], ['Примечание', apt.Примечание, true]
  ];
  document.getElementById('detailsContent').innerHTML = fields.map(([k,v,full]) => `<div class="detail-field${full ? ' full-width' : ''}"><span class="label">${escapeHtml(k)}</span><span class="value">${escapeHtml(v || '—')}</span></div>`).join('') + renderWorksBySection(id);
  loadComments(id);
  document.getElementById('modalOverlay').classList.remove('hidden');
  switchTab('details');
}

function closeModal() { document.getElementById('modalOverlay').classList.add('hidden'); }
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('tabDetails').classList.toggle('active', tab === 'details');
  document.getElementById('tabComments').classList.toggle('active', tab === 'comments');
}

function loadComments(id) {
  const list = document.getElementById('commentsList'); list.innerHTML = 'Загрузка комментариев...';
  fetch(`${APPS_SCRIPT_URL}?idKvartiry=${encodeURIComponent(id)}`).then(r => r.json()).then(comments => {
    if (!comments.length) { list.innerHTML = '<p style="color:#888;">Комментариев пока нет.</p>'; return; }
    list.innerHTML = comments.map(c => `<div class="comment-item"><div class="comment-meta">${escapeHtml(c.author)} — ${new Date(c.date).toLocaleString('ru-RU')}</div><div>${escapeHtml(c.comment)}</div></div>`).join('');
  }).catch(() => { list.innerHTML = '<p style="color:red;">Ошибка загрузки комментариев.</p>'; });
}

function submitComment(e) {
  e.preventDefault();
  const author = document.getElementById('commentAuthor').value.trim();
  const comment = document.getElementById('commentText').value.trim();
  const statusDiv = document.getElementById('commentStatus');
  if (!author || !comment) return;
  statusDiv.textContent = 'Отправка...';
  fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ idKvartiry: currentApartmentId, author, comment }) })
    .then(r => r.json()).then(() => { statusDiv.textContent = 'Комментарий добавлен!'; document.getElementById('commentText').value = ''; loadComments(currentApartmentId); })
    .catch(() => { statusDiv.textContent = 'Ошибка отправки. Попробуйте снова.'; });
}

function switchPage(page) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.toggle('active', s.id === `page-${page}`));
  document.querySelectorAll('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  const titles = { overview:'Обзор', apartments:'Квартиры', works:'Работы', history:'Уведомления / История', settings:'Настройки' };
  document.getElementById('pageTitle').textContent = titles[page] || 'Обзор';
}

function initEventListeners() {
  document.getElementById('globalSearch').addEventListener('input', () => { renderTable(); renderOverview(); });
  document.getElementById('searchInput').addEventListener('input', renderTable);
  document.getElementById('filterObjekt').addEventListener('change', renderTable);
  document.getElementById('filterStage').addEventListener('change', renderTable);
  document.getElementById('filterStatus').addEventListener('change', renderTable);
  document.getElementById('filterOtvetstv').addEventListener('change', renderTable);
  document.getElementById('sortSelect').addEventListener('change', renderTable);
  document.getElementById('refreshBtn').addEventListener('click', loadData);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => { if (e.target.id === 'modalOverlay') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.getElementById('modalOverlay').classList.contains('hidden')) closeModal(); });
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  document.querySelectorAll('.nav-link').forEach(btn => btn.addEventListener('click', () => switchPage(btn.dataset.page)));
  document.getElementById('commentForm').addEventListener('submit', submitComment);
}

initEventListeners();
loadData();
