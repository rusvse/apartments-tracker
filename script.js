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
  const search = document.getElementById('sea
