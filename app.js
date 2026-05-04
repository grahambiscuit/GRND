// ── STORAGE ──────────────────────────────────────────────
const K = {
  USERS: 'yge_users',
  SESS:  'yge_sess',
  inv:   e => 'yge_inv_' + e
};

const db = {
  users:    () => JSON.parse(localStorage.getItem(K.USERS) || '[]'),
  setUsers: u  => localStorage.setItem(K.USERS, JSON.stringify(u)),
  sess:     () => JSON.parse(localStorage.getItem(K.SESS) || 'null'),
  setSess:  u  => localStorage.setItem(K.SESS, JSON.stringify(u)),
  clrSess:  ()  => localStorage.removeItem(K.SESS),
  inv:      e  => JSON.parse(localStorage.getItem(K.inv(e)) || '[]'),
  setInv:   (e, d) => localStorage.setItem(K.inv(e), JSON.stringify(d)),
};

// ── STATE ─────────────────────────────────────────────────
let user = null, inv = [], editId = null, delId = null;
let sKey = 'name', sAsc = true;
let currentTab = 'inventory';
let bannerDismissed = false;

// ── AUTH PANELS ───────────────────────────────────────────
function showPanel(p) {
  document.getElementById('login-panel').style.display  = p === 'login'  ? '' : 'none';
  document.getElementById('signup-panel').style.display = p === 'signup' ? '' : 'none';
  document.querySelectorAll('.err-box').forEach(e => { e.textContent = ''; e.classList.remove('show'); });
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
}

function doLogin() {
  const email = v('li-email').trim(), pass = v('li-pass');
  if (!email || !pass) return showErr('login-err', 'Please fill in all fields.');
  const found = db.users().find(u => u.email === email && u.password === pass);
  if (!found) return showErr('login-err', 'Invalid email or password.');
  db.setSess(found);
  launch(found);
}

function doSignup() {
  const name  = v('su-name').trim();
  const shop  = v('su-shop').trim();
  const email = v('su-email').trim();
  const phone = v('su-phone').trim();
  const role  = v('su-role');
  const pass  = v('su-pass');
  const conf  = v('su-confirm');
  const tos   = document.getElementById('su-tos').checked;

  if (!name || !shop || !email || !pass) return showErr('su-err', 'All required fields must be filled.');
  if (pass.length < 6) return showErr('su-err', 'Password must be at least 6 characters.');
  if (pass !== conf)   return showErr('su-err', 'Passwords do not match.');
  if (!tos)            return showErr('su-err', 'You must agree to the Terms & Conditions.');

  const users = db.users();
  if (users.find(u => u.email === email)) return showErr('su-err', 'Email already registered.');

  const u = {
    name, shop, email, phone, role, password: pass,
    createdAt: new Date().toISOString()
  };
  users.push(u);
  db.setUsers(users);
  seedData(email);
  db.setSess(u);
  launch(u);
}

function doLogout() {
  db.clrSess();
  user = null; inv = [];
  document.getElementById('app-wrapper').style.display = 'none';
  document.getElementById('auth-wrapper').style.display = 'flex';
  showPanel('login');
}

function launch(u) {
  user = u;
  inv  = db.inv(u.email);
  document.getElementById('auth-wrapper').style.display = 'none';
  document.getElementById('app-wrapper').style.display  = 'block';
  const firstName = u.name.split(' ')[0];
  document.getElementById('hdr-name').textContent   = firstName;
  document.getElementById('hdr-shop').textContent   = u.shop;
  document.getElementById('hdr-avatar').textContent = u.name.charAt(0).toUpperCase();
  bannerDismissed = false;
  switchTab('inventory');
  render();
}

// ── SEED ─────────────────────────────────────────────────
function seedData(email) {
  db.setInv(email, [
    { id: uid(), name: 'Arabica Beans',    sku:'BN-001', category:'beans',    unit:'kg',     quantity:25, threshold:5,  price:850,  supplier:'Mountain Roasters', notes:'Premium single-origin' },
    { id: uid(), name: 'Robusta Blend',    sku:'BN-002', category:'beans',    unit:'kg',     quantity:3,  threshold:5,  price:450,  supplier:'Central Roasters',  notes:'' },
    { id: uid(), name: 'Fresh Whole Milk', sku:'DY-001', category:'dairy',    unit:'L',      quantity:0,  threshold:10, price:90,   supplier:'Farm Fresh PH',     notes:'Daily delivery' },
    { id: uid(), name: 'Oat Milk',         sku:'DY-002', category:'dairy',    unit:'L',      quantity:12, threshold:5,  price:185,  supplier:"Nature's Best",     notes:'' },
    { id: uid(), name: 'Vanilla Syrup',    sku:'SY-001', category:'syrups',   unit:'bottle', quantity:8,  threshold:3,  price:320,  supplier:'Monin PH',          notes:'750mL bottles' },
    { id: uid(), name: 'Caramel Syrup',    sku:'SY-002', category:'syrups',   unit:'bottle', quantity:2,  threshold:3,  price:320,  supplier:'Monin PH',          notes:'' },
    { id: uid(), name: 'Paper Cups 8oz',   sku:'SP-001', category:'supplies', unit:'pack',   quantity:15, threshold:5,  price:280,  supplier:'PackIt PH',         notes:'50 pcs/pack' },
    { id: uid(), name: 'Coffee Filters',   sku:'SP-002', category:'supplies', unit:'box',    quantity:4,  threshold:2,  price:150,  supplier:'BrewSupply',        notes:'' },
    { id: uid(), name: 'Espresso Tamper',  sku:'EQ-001', category:'equipment',unit:'pcs',    quantity:2,  threshold:1,  price:1200, supplier:'BaristaPro',        notes:'58mm stainless' },
  ]);
}

// ── TAB SWITCHING ─────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  document.getElementById('view-inventory').style.display = tab === 'inventory' ? '' : 'none';
  document.getElementById('view-reports').style.display   = tab === 'reports'   ? '' : 'none';
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const tabEl = document.getElementById('tab-' + tab);
  if (tabEl) tabEl.classList.add('active');
  if (tab === 'reports') renderReports();
}

// ── RENDER (INVENTORY TABLE) ──────────────────────────────
function render() {
  const s   = v('srch').toLowerCase();
  const cat = v('cat-f');
  let rows  = inv.filter(i => {
    const ms = i.name.toLowerCase().includes(s) || (i.sku||'').toLowerCase().includes(s) || (i.supplier||'').toLowerCase().includes(s);
    return ms && (!cat || i.category === cat);
  });
  rows.sort((a, b) => {
    let va = a[sKey] ?? '', vb = b[sKey] ?? '';
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    return sAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const tbody = document.getElementById('inv-tbody');
  const empty = document.getElementById('empty-st');

  if (!rows.length) {
    tbody.innerHTML = '';
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
    tbody.innerHTML = rows.map(it => {
      const st = stockSt(it);
      return `<tr>
        <td>
          <div class="item-name">${esc(it.name)}</div>
          <div class="item-sku">${esc(it.sku||'—')}</div>
        </td>
        <td><span class="badge badge-${it.category}">${cap(it.category)}</span></td>
        <td style="font-weight:500;">${it.quantity}</td>
        <td style="color:var(--muted);font-size:0.8rem;">${esc(it.unit)}</td>
        <td style="font-family:'DM Mono',monospace;font-size:0.8rem;">₱${(+it.price||0).toFixed(2)}</td>
        <td><span class="${st.cls}">${st.label}</span></td>
        <td>
          <div class="actions">
            <button class="btn-edit" onclick="openEdit('${it.id}')">Edit</button>
            <button class="btn-del"  onclick="openDel('${it.id}')">Remove</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  updateStats();
  updateAlertBanner();
  updateNotifications();
}

function stockSt(it) {
  if (it.quantity <= 0)                    return { cls:'stock-out', label:'● Out of stock' };
  if (it.quantity <= (it.threshold || 5)) return { cls:'stock-low', label:'● Low stock' };
  return { cls:'stock-ok', label:'● In stock' };
}

function updateStats() {
  const total = inv.length;
  const low   = inv.filter(i => i.quantity > 0 && i.quantity <= (i.threshold||5)).length;
  const out   = inv.filter(i => i.quantity <= 0).length;
  const val   = inv.reduce((s,i) => s + (+i.price||0)*(+i.quantity||0), 0);
  document.getElementById('st-total').textContent = total;
  document.getElementById('st-low').textContent   = low;
  document.getElementById('st-out').textContent   = out;
  document.getElementById('st-val').textContent   = '₱' + val.toLocaleString('en-PH', {minimumFractionDigits:0});
}

function sort(k) {
  sKey = k === sKey ? sKey : k;
  sAsc = k === sKey ? !sAsc : true;
  sKey = k;
  render();
}

// ── ALERT BANNER ─────────────────────────────────────────
function updateAlertBanner() {
  if (bannerDismissed) return;
  const out = inv.filter(i => i.quantity <= 0);
  const low = inv.filter(i => i.quantity > 0 && i.quantity <= (i.threshold||5));
  const banner = document.getElementById('alert-banner');
  const text   = document.getElementById('alert-text');

  if (!out.length && !low.length) {
    banner.style.display = 'none';
    return;
  }

  const parts = [];
  if (out.length) parts.push(`${out.length} item${out.length > 1 ? 's are' : ' is'} out of stock`);
  if (low.length) parts.push(`${low.length} item${low.length > 1 ? 's are' : ' is'} running low`);
  text.textContent = '⚠ Stock alert: ' + parts.join(' and ') + '. Please reorder soon.';
  banner.style.display = 'flex';
}

function dismissBanner() {
  bannerDismissed = true;
  document.getElementById('alert-banner').style.display = 'none';
}

// ── NOTIFICATIONS ─────────────────────────────────────────
function updateNotifications() {
  const out  = inv.filter(i => i.quantity <= 0);
  const low  = inv.filter(i => i.quantity > 0 && i.quantity <= (i.threshold||5));
  const all  = [
    ...out.map(i => ({ item: i, type: 'out' })),
    ...low.map(i => ({ item: i, type: 'low' }))
  ];

  const badge = document.getElementById('notif-badge');
  const total = all.length;
  if (total > 0) {
    badge.style.display = 'flex';
    badge.textContent   = total > 9 ? '9+' : total;
  } else {
    badge.style.display = 'none';
  }

  const list = document.getElementById('notif-list');
  if (!all.length) {
    list.innerHTML = '<div class="notif-empty">✅ All stock levels are good!</div>';
    return;
  }

  list.innerHTML = all.map(({ item, type }) => {
    const label  = type === 'out' ? 'Out of stock' : `Low stock — ${item.quantity} ${item.unit} left`;
    return `<div class="notif-item">
      <div class="notif-dot ${type}"></div>
      <div class="notif-item-text">
        <div class="notif-item-name">${esc(item.name)}</div>
        <div class="notif-item-detail">${label}</div>
      </div>
    </div>`;
  }).join('');
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// Close notif panel on outside click
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('notif-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const panel = document.getElementById('notif-panel');
    if (panel) panel.style.display = 'none';
  }
});

// ── REPORTS ───────────────────────────────────────────────
function renderReports() {
  const total = inv.length;
  const out   = inv.filter(i => i.quantity <= 0);
  const low   = inv.filter(i => i.quantity > 0 && i.quantity <= (i.threshold||5));
  const ok    = inv.filter(i => i.quantity > (i.threshold||5));
  const val   = inv.reduce((s,i) => s + (+i.price||0)*(+i.quantity||0), 0);

  document.getElementById('rpt-ok').textContent  = ok.length;
  document.getElementById('rpt-low').textContent = low.length;
  document.getElementById('rpt-out').textContent = out.length;
  document.getElementById('rpt-val').textContent = '₱' + val.toLocaleString('en-PH', {minimumFractionDigits:0});

  // Category bars
  const cats = ['beans','dairy','syrups','equipment','supplies','other'];
  const catCounts = {};
  cats.forEach(c => catCounts[c] = inv.filter(i => i.category === c).length);
  const maxCount = Math.max(...Object.values(catCounts), 1);
  const catColors = {
    beans: '#e8a84c', dairy: '#c8b99a', syrups: '#c39bd3',
    equipment: '#7fb3d3', supplies: '#7dcea0', other: '#9a7d5a'
  };

  document.getElementById('cat-bars').innerHTML = cats
    .filter(c => catCounts[c] > 0)
    .sort((a,b) => catCounts[b] - catCounts[a])
    .map(c => `
      <div class="cat-bar-row">
        <div class="cat-bar-label">${cap(c)}</div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${(catCounts[c]/maxCount*100).toFixed(1)}%; background:${catColors[c]};"></div>
        </div>
        <div class="cat-bar-count">${catCounts[c]}</div>
      </div>`
    ).join('') || '<p class="report-empty">No items yet.</p>';

  // Items needing attention
  const critical = [...out, ...low].sort((a,b) => a.quantity - b.quantity);
  const attEl = document.getElementById('attention-list');
  if (!critical.length) {
    attEl.innerHTML = '<p class="report-empty">✅ All items are sufficiently stocked!</p>';
  } else {
    attEl.innerHTML = critical.map(it => {
      const isOut = it.quantity <= 0;
      return `<div class="attention-item ${isOut ? 'is-out' : 'is-low'}">
        <div class="att-left">
          <div class="att-icon">${isOut ? '🚫' : '⚠️'}</div>
          <div>
            <div class="att-name">${esc(it.name)}</div>
            <div class="att-sku">${esc(it.sku||'No SKU')} · ${cap(it.category)}</div>
          </div>
        </div>
        <div class="att-right">
          <div class="att-qty ${isOut ? 'out' : 'low'}">${it.quantity} ${esc(it.unit)}</div>
          <div class="att-status">${isOut ? 'Out of stock' : `Alert at ${it.threshold||5}`}</div>
        </div>
      </div>`;
    }).join('');
  }

  // Top value items
  const topVal = [...inv]
    .map(i => ({ ...i, totalVal: (+i.price||0) * (+i.quantity||0) }))
    .filter(i => i.totalVal > 0)
    .sort((a,b) => b.totalVal - a.totalVal)
    .slice(0, 5);

  const tvEl = document.getElementById('top-value-list');
  if (!topVal.length) {
    tvEl.innerHTML = '<p class="report-empty">No items with value yet.</p>';
  } else {
    tvEl.innerHTML = topVal.map((it, idx) => `
      <div class="value-item">
        <div class="val-rank">#${idx+1}</div>
        <div>
          <div class="val-name">${esc(it.name)}</div>
          <div class="att-sku">${it.quantity} ${esc(it.unit)} × ₱${(+it.price).toFixed(2)}</div>
        </div>
        <div class="val-amount">₱${it.totalVal.toLocaleString('en-PH',{minimumFractionDigits:0})}</div>
      </div>`
    ).join('');
  }
}

// ── ITEM MODAL ────────────────────────────────────────────
function openAdd() {
  editId = null;
  document.getElementById('m-title').textContent = 'Add New Item';
  clearForm();
  document.getElementById('item-modal').classList.add('show');
}

function openEdit(id) {
  const it = inv.find(i => i.id === id);
  if (!it) return;
  editId = id;
  document.getElementById('m-title').textContent = 'Edit Item';
  set('f-name',     it.name);
  set('f-sku',      it.sku||'');
  set('f-cat',      it.category);
  set('f-unit',     it.unit);
  set('f-qty',      it.quantity);
  set('f-thresh',   it.threshold||'');
  set('f-price',    it.price||'');
  set('f-supplier', it.supplier||'');
  set('f-notes',    it.notes||'');
  document.getElementById('item-modal').classList.add('show');
}

function closeModal() {
  document.getElementById('item-modal').classList.remove('show');
  editId = null;
  clearForm();
}

function clearForm() {
  ['f-name','f-sku','f-qty','f-thresh','f-price','f-supplier','f-notes'].forEach(id => set(id));
  set('f-cat', '');
  set('f-unit', 'kg');
}

function saveItem() {
  const name = v('f-name').trim();
  const cat  = v('f-cat');
  const qty  = parseFloat(v('f-qty'));
  if (!name)               return toast('Item name is required.', 'danger');
  if (!cat)                return toast('Please select a category.', 'danger');
  if (isNaN(qty) || qty < 0) return toast('Enter a valid quantity.', 'danger');

  const item = {
    id:        editId || uid(),
    name,
    sku:       v('f-sku').trim(),
    category:  cat,
    unit:      v('f-unit'),
    quantity:  qty,
    threshold: parseFloat(v('f-thresh')) || 5,
    price:     parseFloat(v('f-price'))  || 0,
    supplier:  v('f-supplier').trim(),
    notes:     v('f-notes').trim(),
    updatedAt: new Date().toISOString(),
  };

  if (editId) {
    const idx = inv.findIndex(i => i.id === editId);
    inv[idx] = item;
    toast('Item updated!', 'success');
  } else {
    item.createdAt = item.updatedAt;
    inv.unshift(item);
    toast('Item added to inventory!', 'success');
  }

  db.setInv(user.email, inv);
  closeModal();
  bannerDismissed = false;
  render();
}

// ── DELETE ────────────────────────────────────────────────
function openDel(id) {
  delId = id;
  const it = inv.find(i => i.id === id);
  document.getElementById('del-msg').textContent = `"${it?.name}" will be permanently removed.`;
  document.getElementById('del-modal').classList.add('show');
}

function closeDelModal() {
  document.getElementById('del-modal').classList.remove('show');
  delId = null;
}

function confirmDel() {
  if (!delId) return;
  inv = inv.filter(i => i.id !== delId);
  db.setInv(user.email, inv);
  closeDelModal();
  render();
  toast('Item removed.', 'danger');
}

// ── PROFILE ───────────────────────────────────────────────
function openProfile() {
  const u = user;
  document.getElementById('prof-avatar').textContent    = u.name.charAt(0).toUpperCase();
  document.getElementById('prof-name').textContent      = u.name;
  document.getElementById('prof-role-badge').textContent = u.role || 'Staff';
  document.getElementById('prof-shop').textContent      = u.shop;
  document.getElementById('prof-email').textContent     = u.email;
  document.getElementById('prof-phone').textContent     = u.phone || '—';
  document.getElementById('prof-role').textContent      = u.role  || '—';
  document.getElementById('prof-since').textContent     = u.createdAt
    ? new Date(u.createdAt).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })
    : 'N/A';

  // Prefill edit fields
  set('pe-name',  u.name);
  set('pe-shop',  u.shop);
  set('pe-phone', u.phone || '');
  set('pe-role',  u.role  || 'Staff');

  document.getElementById('profile-modal').classList.add('show');
}

function closeProfile() {
  document.getElementById('profile-modal').classList.remove('show');
}

function saveProfile() {
  const name  = v('pe-name').trim();
  const shop  = v('pe-shop').trim();
  const phone = v('pe-phone').trim();
  const role  = v('pe-role');

  if (!name) return toast('Name cannot be empty.', 'danger');
  if (!shop) return toast('Shop name cannot be empty.', 'danger');

  // Update user object
  user.name  = name;
  user.shop  = shop;
  user.phone = phone;
  user.role  = role;

  // Persist to users list
  const users = db.users();
  const idx = users.findIndex(u => u.email === user.email);
  if (idx !== -1) users[idx] = user;
  db.setUsers(users);
  db.setSess(user);

  // Update header
  document.getElementById('hdr-name').textContent   = name.split(' ')[0];
  document.getElementById('hdr-shop').textContent   = shop;
  document.getElementById('hdr-avatar').textContent = name.charAt(0).toUpperCase();

  closeProfile();
  toast('Profile updated!', 'success');
}

// ── TERMS & CONDITIONS ────────────────────────────────────
function openTOS() {
  document.getElementById('tos-modal').classList.add('show');
}

function closeTOS() {
  document.getElementById('tos-modal').classList.remove('show');
}

function acceptTOS() {
  document.getElementById('su-tos').checked = true;
  closeTOS();
  toast('Terms accepted!', 'success');
}

// ── TOAST ─────────────────────────────────────────────────
function toast(msg, type) {
  const icon = type === 'success' ? '✓' : '✕';
  const el   = document.createElement('div');
  el.className = `toast t-${type||'success'}`;
  el.innerHTML = `<span>${icon}</span>${msg}`;
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ── HELPERS ───────────────────────────────────────────────
function uid()     { return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function v(id)     { return document.getElementById(id)?.value ?? ''; }
function set(id, val='') { const el = document.getElementById(id); if (el) el.value = val; }
function esc(s)    { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function cap(s)    { return s ? s[0].toUpperCase()+s.slice(1) : ''; }

// ── BACKDROP CLICK CLOSE ──────────────────────────────────
['item-modal','del-modal','profile-modal','tos-modal'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', function(e) {
    if (e.target !== this) return;
    if (id === 'item-modal')    closeModal();
    else if (id === 'del-modal')     closeDelModal();
    else if (id === 'profile-modal') closeProfile();
    else if (id === 'tos-modal')     closeTOS();
  });
});

// ── ENTER KEY ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const lp = document.getElementById('login-panel');
  const sp = document.getElementById('signup-panel');
  if (lp && lp.style.display !== 'none') doLogin();
  else if (sp && sp.style.display !== 'none') doSignup();
});

// ── INIT ──────────────────────────────────────────────────
(function() {
  const s = db.sess();
  if (s) launch(s);
})();
