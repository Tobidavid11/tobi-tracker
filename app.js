// ── config ──
const SUPABASE_URL = 'https://hhwveowhqgkczpneiblo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qeDbZkl_hpNtVyw-SSkFuA_HbtKlNtP';
const TABLE = 'transactions';
const SOLAR_TARGET = 300000;
const IPHONE_TARGET = 150000;
const FAM_CAP = 15000;

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer': 'return=representation',
};

// ── state ──
let allEntries = [];
let viewMonth = new Date().getMonth();
let viewYear = new Date().getFullYear();
let histFilter = 'all';

// ── init ──
document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  updateMonthLabel();
  setupAllocListeners();
  load();
});

// ── greeting ──
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getMotivation() {
  const msgs = [
    'Keep building, keep growing.',
    'Every naira logged is a naira controlled.',
    'Solar goal getting closer. Stay consistent.',
    'Protect your peace. Protect your pocket.',
    'You did this alone. Remember that.',
    'Jetherverse is coming. Keep going.',
    'Top 0.1% designers think about money too.',
  ];
  return msgs[new Date().getDate() % msgs.length];
}

function renderHeader() {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  document.getElementById('greeting-text').textContent = getGreeting() + ',';
  document.getElementById('motivation').textContent = getMotivation();
  document.getElementById('date-day').textContent = now.getDate();
  document.getElementById('date-info').textContent = `${days[now.getDay()]} · ${months[now.getMonth()]} ${now.getFullYear()}`;
}

// ── month nav ──
function prevMonth() {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  updateMonthLabel(); render();
}

function nextMonth() {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  updateMonthLabel(); render();
}

function goToday() {
  viewMonth = new Date().getMonth();
  viewYear = new Date().getFullYear();
  updateMonthLabel(); render();
}

function updateMonthLabel() {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const isCurrentMonth = viewMonth === new Date().getMonth() && viewYear === new Date().getFullYear();
  document.getElementById('month-label').textContent =
    `${months[viewMonth]} ${viewYear}${isCurrentMonth ? ' · now' : ''}`;
}

// ── supabase ──
async function load() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?order=created_at.desc`, { headers: HEADERS });
    if (!r.ok) throw 0;
    allEntries = await r.json();
    setConn(true);
    render();
  } catch {
    setConn(false);
    document.getElementById('history').innerHTML =
      '<div class="empty-state">could not connect to supabase<br>check your connection</div>';
  }
}

async function postEntry(body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify(body),
  });
  if (!r.ok) throw 0;
}

async function deleteFromDB(id) {
  await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}`, { method: 'DELETE', headers: HEADERS });
}

// ── actions ──
async function logIncome() {
  const desc = val('inc-desc'), amt = num('inc-amt');
  if (!desc || !amt) return toast('Fill in description and amount', 'err');
  setBusy('inc-btn', true, '...');
  try {
    await postEntry({ description: desc, amount: amt, type: 'income' });
    clear('inc-desc', 'inc-amt');
    toast('Income logged ✓', 'ok');
    load();
  } catch { toast('Failed — try again', 'err'); }
  setBusy('inc-btn', false, '+ Log income');
}

async function allocate() {
  const fields = ['solar', 'iphone', 'family', 'water', 'data', 'work', 'other'];
  const vals = fields.map(f => ({ f, a: num('a-' + f) })).filter(x => x.a > 0);
  if (!vals.length) return toast('Enter at least one amount', 'err');

  const total = vals.reduce((s, x) => s + x.a, 0);
  const unalloc = getUnallocated(monthEntries());
  if (total > unalloc + 0.01) return toast(`Only ${fmt(unalloc)} unallocated`, 'err');

  setBusy('alloc-btn', true, '...');
  try {
    for (const { f, a } of vals) {
      await postEntry({ description: `Allocated to ${labelOf(f)}`, amount: a, type: 'alloc_' + f });
    }
    fields.forEach(f => clear('a-' + f));
    toast('Allocated ✓', 'ok');
    load();
  } catch { toast('Failed — try again', 'err'); }
  setBusy('alloc-btn', false, 'Allocate →');
}

async function markSpent() {
  const desc = val('sp-desc'), amt = num('sp-amt'), bucket = val('sp-bucket');
  if (!desc || !amt) return toast('Fill in description and amount', 'err');
  setBusy('sp-btn', true, '...');
  try {
    await postEntry({ description: desc, amount: amt, type: 'spent_' + bucket });
    clear('sp-desc', 'sp-amt');
    toast('Marked as spent ✓', 'ok');
    load();
  } catch { toast('Failed — try again', 'err'); }
  setBusy('sp-btn', false, 'Mark as spent');
}

async function deleteEntry(id) {
  try { await deleteFromDB(id); toast('Entry deleted', ''); load(); }
  catch { toast('Delete failed', 'err'); }
}

// ── compute ──
function monthEntries() {
  return allEntries.filter(e => {
    const d = new Date(e.created_at);
    return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
  });
}

function getUnallocated(entries) {
  let income = 0, allocated = 0;
  entries.forEach(e => {
    if (e.type === 'income') income += +e.amount;
    else if (e.type.startsWith('alloc_')) allocated += +e.amount;
  });
  return Math.max(0, income - allocated);
}

// ── render ──
function render() {
  const entries = monthEntries();

  let income = 0, allocated = 0, spent = 0;
  let solar = 0, iphone = 0, family = 0, water = 0, data = 0, work = 0;

  // use all entries for goal totals (not month-filtered)
  allEntries.forEach(e => {
    const a = +e.amount;
    if (e.type === 'alloc_solar') solar += a;
    if (e.type === 'alloc_iphone') iphone += a;
    if (e.type.startsWith('spent_solar')) solar -= a;
    if (e.type.startsWith('spent_iphone')) iphone -= a;
  });

  // month entries for everything else
  entries.forEach(e => {
    const a = +e.amount;
    if (e.type === 'income') income += a;
    if (e.type.startsWith('alloc_')) allocated += a;
    if (e.type.startsWith('spent_')) spent += a;
    if (e.type === 'alloc_family') family += a;
    if (e.type === 'alloc_water') water += a;
    if (e.type === 'alloc_data') data += a;
    if (e.type === 'alloc_work') work += a;
  });

  const unalloc = getUnallocated(entries);

  // overview
  setText('v-inc', fmt(income));
  setText('v-alloc', fmt(allocated));
  setText('v-spent', fmt(spent));

  // unallocated
  setText('v-unalloc', fmt(unalloc));
  setText('alloc-avail', fmt(unalloc));

  // solar goal
  const solarPct = Math.min(100, Math.round((solar / SOLAR_TARGET) * 100));
  setText('solar-pct', solarPct + '%');
  setStyle('solar-fill', 'width', solarPct + '%');
  setText('solar-saved', fmt(solar) + ' saved');
  setText('solar-remain', fmt(Math.max(0, SOLAR_TARGET - solar)) + ' to go');
  renderMilestone('solar-milestone', solarPct, 'var(--green)', 'rgba(31,204,138,0.1)');

  // iphone goal
  const iphonePct = Math.min(100, Math.round((iphone / IPHONE_TARGET) * 100));
  setText('iphone-pct', iphonePct + '%');
  setStyle('iphone-fill', 'width', iphonePct + '%');
  setText('iphone-saved', fmt(iphone) + ' saved');
  setText('iphone-remain', fmt(Math.max(0, IPHONE_TARGET - iphone)) + ' to go');
  renderMilestone('iphone-milestone', iphonePct, 'var(--blue)', 'rgba(74,158,255,0.1)');

  // buckets
  setText('b-family', fmt(family));
  setText('b-water', fmt(water));
  setText('b-data', fmt(data));
  setText('b-work', fmt(work));

  const famPct = Math.min(100, Math.round((family / FAM_CAP) * 100));
  setStyle('fam-bar', 'width', famPct + '%');

  const famWarn = document.getElementById('fam-warn');
  if (famPct >= 100) {
    famWarn.textContent = '⚠ Cap reached — hold the line';
    famWarn.style.display = 'block';
  } else if (famPct >= 75) {
    famWarn.textContent = `₦${fmt(FAM_CAP - family)} remaining`;
    famWarn.style.display = 'block';
  } else {
    famWarn.style.display = 'none';
  }

  // quick stats
  const biggestGig = entries.filter(e => e.type === 'income')
    .reduce((max, e) => Math.max(max, +e.amount), 0);
  const incomeEntries = entries.filter(e => e.type === 'income');
  const lastIncome = incomeEntries.length > 0
    ? daysSince(incomeEntries[0].created_at)
    : null;

  setText('stat-biggest', biggestGig > 0 ? fmt(biggestGig) : '—');
  setText('stat-gig-count', incomeEntries.length + ' gig' + (incomeEntries.length !== 1 ? 's' : ''));
  setText('stat-last', lastIncome !== null ? (lastIncome === 0 ? 'today' : lastIncome + 'd ago') : '—');

  // alloc total display
  updateAllocTotal();

  // history
  renderHistory();
}

function renderMilestone(elId, pct, color, bg) {
  const el = document.getElementById(elId);
  if (!el) return;
  let msg = '';
  if (pct === 0) msg = 'start saving to begin';
  else if (pct < 25) msg = `${pct}% — just getting started 💪`;
  else if (pct < 50) msg = `${pct}% — momentum building 🔥`;
  else if (pct < 75) msg = `${pct}% — halfway there, keep going!`;
  else if (pct < 100) msg = `${pct}% — almost there 👀`;
  else msg = '100% — goal reached! 🎉';

  el.textContent = msg;
  el.style.color = color;
  el.style.background = bg;
}

function renderHistory() {
  const entries = monthEntries();
  const hist = document.getElementById('history');

  let filtered = entries;
  if (histFilter === 'income') filtered = entries.filter(e => e.type === 'income');
  else if (histFilter === 'alloc') filtered = entries.filter(e => e.type.startsWith('alloc_'));
  else if (histFilter === 'spent') filtered = entries.filter(e => e.type.startsWith('spent_'));

  if (!filtered.length) {
    hist.innerHTML = `<div class="empty-state">
      ${entries.length === 0 ? 'no transactions this month<br>log your first income above' : 'no entries match this filter'}
    </div>`;
    return;
  }

  hist.innerHTML = filtered.map(e => {
    const isIncome = e.type === 'income';
    const isAlloc = e.type.startsWith('alloc_');
    const color = isIncome ? 'var(--green)' : isAlloc ? 'var(--amber)' : 'var(--red)';
    const sign = isIncome ? '+' : isAlloc ? '→' : '−';
    return `<div class="entry">
      <div class="e-left">
        <div class="e-name">${escHtml(e.description)}</div>
        <div class="e-meta">${humanType(e.type)}</div>
      </div>
      <div class="e-right">
        <span class="e-date">${fmtDate(e.created_at)}</span>
        <span class="e-amt" style="color:${color}">${sign}${fmt(e.amount)}</span>
        <button class="del" onclick="deleteEntry('${e.id}')" aria-label="Delete">×</button>
      </div>
    </div>`;
  }).join('');
}

// ── tabs ──
function switchTab(name, el) {
  ['income', 'allocate', 'spend'].forEach(t => {
    document.getElementById('tab-' + t).style.display = t === name ? '' : 'none';
  });
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  if (name === 'allocate') setText('alloc-avail', fmt(getUnallocated(monthEntries())));
}

function setHistFilter(f, el) {
  histFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderHistory();
}

// ── alloc live total ──
function setupAllocListeners() {
  ['solar', 'iphone', 'family', 'water', 'data', 'work', 'other'].forEach(f => {
    const el = document.getElementById('a-' + f);
    if (el) el.addEventListener('input', updateAllocTotal);
  });
}

function updateAllocTotal() {
  const total = ['solar', 'iphone', 'family', 'water', 'data', 'work', 'other']
    .reduce((s, f) => s + (num('a-' + f) || 0), 0);
  setText('alloc-total', fmt(total));
}

// ── utils ──
function val(id) { return (document.getElementById(id)?.value || '').trim(); }
function num(id) { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) || n <= 0 ? 0 : n; }
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function setStyle(id, prop, v) { const el = document.getElementById(id); if (el) el.style[prop] = v; }
function clear(...ids) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }
function setBusy(id, busy, label) { const el = document.getElementById(id); if (!el) return; el.disabled = busy; el.textContent = label; }
function fmt(n) { return '₦' + Math.round(Math.max(0, n)).toLocaleString('en-NG'); }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
function daysSince(d) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }
function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function labelOf(k) {
  return { solar: 'Solar savings', iphone: 'iPhone savings', family: 'Family', water: 'Water', data: 'Data & food', work: 'Workspace', other: 'Other' }[k] || k;
}

function humanType(t) {
  if (t === 'income') return 'Gig income';
  if (t.startsWith('alloc_')) return '→ ' + labelOf(t.replace('alloc_', ''));
  if (t.startsWith('spent_')) return '← spent · ' + labelOf(t.replace('spent_', ''));
  return t;
}

function setConn(ok) {
  document.getElementById('dot').className = 'dot' + (ok ? ' live' : '');
  document.getElementById('conn-txt').textContent = ok ? 'live · supabase' : 'offline';
}

let toastTimer;
function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
}
