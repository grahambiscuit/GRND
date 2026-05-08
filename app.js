// ── VERSION / AUTO-CLEAR ──────────────────────────────────
(function() {
  const VERSION = 'grnd_v5';
  if (!localStorage.getItem(VERSION)) {
    localStorage.clear();
    localStorage.setItem(VERSION, '1');
  }
})();

// ── STORAGE ──────────────────────────────────────────────
const K = {
  USERS: 'grnd_users',
  SESS:  'grnd_sess',
  THEME: 'grnd_theme',
  SEED:  'grnd_seeded',
  inv:   e => 'grnd_inv_' + e,
  log:   e => 'grnd_log_' + e,
};

const db = {
  users:    () => JSON.parse(localStorage.getItem(K.USERS) || '[]'),
  setUsers: u  => localStorage.setItem(K.USERS, JSON.stringify(u)),
  sess:     () => JSON.parse(localStorage.getItem(K.SESS) || 'null'),
  setSess:  u  => localStorage.setItem(K.SESS, JSON.stringify(u)),
  clrSess:  ()  => localStorage.removeItem(K.SESS),
  inv:      e  => JSON.parse(localStorage.getItem(K.inv(e)) || '[]'),
  setInv:   (e, d) => localStorage.setItem(K.inv(e), JSON.stringify(d)),
  log:      e  => JSON.parse(localStorage.getItem(K.log(e)) || '[]'),
  setLog:   (e, d) => localStorage.setItem(K.log(e), JSON.stringify(d)),
};

// ── ROLE ACCESS CONTROL ───────────────────────────────────
// Permissions per role: what tabs/actions are visible
const ROLE_ACCESS = {
  Admin:   { inventory:true,  sales:true,  reports:true,  activity:true,  admin:true,  canAdd:true,  canEdit:true,  canDelete:true,  canMove:true  },
  Owner:   { inventory:true,  sales:true,  reports:true,  activity:true,  admin:false, canAdd:true,  canEdit:true,  canDelete:true,  canMove:true  },
  Manager: { inventory:true,  sales:true,  reports:true,  activity:true,  admin:false, canAdd:true,  canEdit:true,  canDelete:false, canMove:true  },
  Barista: { inventory:true,  sales:false, reports:false, activity:true,  admin:false, canAdd:false, canEdit:false, canDelete:false, canMove:true  },
  Staff:   { inventory:true,  sales:false, reports:false, activity:false, admin:false, canAdd:false, canEdit:false, canDelete:false, canMove:false },
};

function perm(key) {
  const role = user?.role || 'Staff';
  const access = ROLE_ACCESS[role] || ROLE_ACCESS['Staff'];
  return access[key] === true;
}

// ── DEFAULT INVENTORY SEED DATA ───────────────────────────
const SEED_INVENTORY = [
  { name:'Arabica Whole Beans',    category:'beans',     unit:'kg',     quantity:25,  threshold:5,  price:480,  notes:'Ethiopian origin, medium roast' },
  { name:'Robusta Ground Coffee',  category:'beans',     unit:'kg',     quantity:18,  threshold:4,  price:320,  notes:'Local blend' },
  { name:'Liberica Specialty',     category:'beans',     unit:'kg',     quantity:8,   threshold:3,  price:650,  notes:'Premium single-origin' },
  { name:'Cold Brew Concentrate',  category:'beans',     unit:'bottle', quantity:12,  threshold:3,  price:220,  notes:'Ready-to-dilute' },
  { name:'Full Cream Milk',        category:'dairy',     unit:'L',      quantity:40,  threshold:10, price:95,   notes:'Fresh daily delivery' },
  { name:'Oat Milk',               category:'dairy',     unit:'L',      quantity:15,  threshold:5,  price:185,  notes:'Barista blend' },
  { name:'Almond Milk',            category:'dairy',     unit:'L',      quantity:8,   threshold:3,  price:210,  notes:'Unsweetened' },
  { name:'All-Purpose Cream',      category:'dairy',     unit:'mL',     quantity:6000,threshold:1000,price:0.09,notes:'For whipped cream' },
  { name:'Vanilla Syrup',          category:'syrups',    unit:'bottle', quantity:6,   threshold:2,  price:380,  notes:'Monin 700ml' },
  { name:'Caramel Syrup',          category:'syrups',    unit:'bottle', quantity:5,   threshold:2,  price:380,  notes:'Monin 700ml' },
  { name:'Hazelnut Syrup',         category:'syrups',    unit:'bottle', quantity:3,   threshold:2,  price:380,  notes:'Monin 700ml' },
  { name:'Brown Sugar Syrup',      category:'syrups',    unit:'bottle', quantity:4,   threshold:2,  price:280,  notes:'House-made' },
  { name:'Matcha Powder',          category:'other',     unit:'g',      quantity:800, threshold:150,price:2.5,  notes:'Ceremonial grade' },
  { name:'Chocolate Powder',       category:'other',     unit:'g',      quantity:1200,threshold:200,price:0.85, notes:'Dutch processed' },
  { name:'White Sugar',            category:'supplies',  unit:'kg',     quantity:20,  threshold:5,  price:60,   notes:'' },
  { name:'Paper Cups 12oz',        category:'supplies',  unit:'pcs',    quantity:500, threshold:100,price:5.5,  notes:'With lids' },
  { name:'Paper Cups 16oz',        category:'supplies',  unit:'pcs',    quantity:400, threshold:100,price:6.5,  notes:'With lids' },
  { name:'Stirrers',               category:'supplies',  unit:'pcs',    quantity:800, threshold:200,price:0.5,  notes:'Wooden' },
  { name:'Straws',                 category:'supplies',  unit:'pcs',    quantity:600, threshold:150,price:0.8,  notes:'Paper straws' },
  { name:'Espresso Machine Cleaner',category:'equipment',unit:'pack',  quantity:4,   threshold:1,  price:450,  notes:'Cafiza tablets' },
  { name:'Portafilter Gaskets',    category:'equipment', unit:'pcs',    quantity:6,   threshold:2,  price:320,  notes:'58mm La Marzocco' },
  { name:'Scale Batteries AA',     category:'equipment', unit:'pcs',    quantity:8,   threshold:4,  price:35,   notes:'' },
  { name:'Ice Cubes (5kg bag)',    category:'other',     unit:'bag',    quantity:15,  threshold:5,  price:85,   notes:'Daily restocked' },
  { name:'Whipping Cream',         category:'dairy',     unit:'mL',     quantity:3000,threshold:500,price:0.12, notes:'For drinks & desserts' },
];

function seedInventory(email) {
  const now = new Date();
  const items = SEED_INVENTORY.map((s, i) => ({
    id:        uid(),
    createdAt: new Date(now - (SEED_INVENTORY.length - i) * 3600000).toISOString(),
    updatedAt: new Date(now - (SEED_INVENTORY.length - i) * 3600000).toISOString(),
    ...s,
  }));

  // Seed some historical activity log (last 30 days)
  const logs = [];
  const types = ['add','sell','use','sell','sell','add'];
  const notes = ['Morning restock','Customer order','Bar usage','Take-out order','Dine-in order','Supplier delivery'];
  for (let d = 29; d >= 0; d--) {
    const dayBase = new Date(now);
    dayBase.setDate(dayBase.getDate() - d);
    const txnCount = 3 + Math.floor(Math.random() * 5);
    for (let t = 0; t < txnCount; t++) {
      const item = items[Math.floor(Math.random() * items.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const qty  = 1 + Math.floor(Math.random() * 5);
      const ts   = new Date(dayBase.getTime() + t * 3600000 * 2).toISOString();
      logs.push({
        id:       uid(),
        itemId:   item.id,
        itemName: item.name,
        type,
        qty,
        prevQty:  item.quantity,
        newQty:   Math.max(0, item.quantity + (type === 'add' ? qty : -qty)),
        unit:     item.unit,
        note:     notes[Math.floor(Math.random() * notes.length)],
        price:    item.price,
        ts,
      });
    }
  }

  db.setInv(email, items);
  db.setLog(email, logs.reverse());
}

// ── STATE ─────────────────────────────────────────────────
let user = null, inv = [], stockLog = [];
let editId = null, delId = null, moveItemId = null;
let sKey = 'name', sAsc = true;
let currentTab = 'inventory';
let bannerDismissed = false;

// ── THEME ─────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem(K.THEME) || 'light';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(K.THEME, theme);
  const moon = document.getElementById('icon-moon');
  const sun  = document.getElementById('icon-sun');
  if (moon) moon.style.display = theme === 'dark' ? 'none' : '';
  if (sun)  sun.style.display  = theme === 'dark' ? '' : 'none';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── AUTH ──────────────────────────────────────────────────
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
  if (!role)           return showErr('su-err', 'Please select a role.');
  if (pass.length < 6) return showErr('su-err', 'Password must be at least 6 characters.');
  if (pass !== conf)   return showErr('su-err', 'Passwords do not match.');
  if (!tos)            return showErr('su-err', 'You must agree to the Terms & Conditions.');

  const users = db.users();
  if (users.find(u => u.email === email)) return showErr('su-err', 'Email already registered.');

  const u = { name, shop, email, phone, role, password: pass, createdAt: new Date().toISOString() };
  users.push(u);
  db.setUsers(users);
  db.setSess(u);

  // Seed inventory for new users
  seedInventory(email);

  launch(u);
}

function doLogout() {
  db.clrSess();
  user = null; inv = []; stockLog = [];
  document.getElementById('app-wrapper').style.display = 'none';
  document.getElementById('auth-wrapper').style.display = 'flex';
  showPanel('login');
}

function launch(u) {
  user     = u;
  inv      = db.inv(u.email);
  stockLog = db.log(u.email);

  // Seed if somehow empty (e.g. returning user on new version)
  if (!inv.length) {
    seedInventory(u.email);
    inv      = db.inv(u.email);
    stockLog = db.log(u.email);
  }

  document.getElementById('auth-wrapper').style.display = 'none';
  document.getElementById('app-wrapper').style.display  = 'block';
  document.getElementById('hdr-name').textContent   = u.name.split(' ')[0];
  document.getElementById('hdr-shop').textContent   = u.shop;
  document.getElementById('hdr-avatar').textContent = u.name.charAt(0).toUpperCase();

  setupNavForRole();
  bannerDismissed = false;
  switchTab('inventory');
  render();
}

// ── ROLE-BASED NAV ────────────────────────────────────────
function setupNavForRole() {
  const tabs = ['inventory','sales','reports','activity','admin'];
  const tabMap = { inventory:'inventory', sales:'sales', reports:'reports', activity:'activity', admin:'admin' };
  tabs.forEach(t => {
    const btn = document.getElementById('tab-' + t);
    if (btn) btn.style.display = perm(t) ? '' : 'none';
  });
}

// ── TAB SWITCHING ─────────────────────────────────────────
function switchTab(tab) {
  // Check access
  if (!perm(tab)) {
    tab = 'inventory'; // fallback
  }
  currentTab = tab;
  ['inventory','sales','reports','activity','admin'].forEach(t => {
    const view = document.getElementById('view-' + t);
    if (view) view.style.display = t === tab ? '' : 'none';
    const btn = document.getElementById('tab-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  if (tab === 'sales')    renderSales();
  if (tab === 'reports')  renderReports();
  if (tab === 'activity') renderActivity();
  if (tab === 'admin')    renderAdmin();
}

// ── RENDER INVENTORY ──────────────────────────────────────
function render() {
  const s   = v('srch').toLowerCase();
  const cat = v('cat-f');
  let rows  = inv.filter(i => {
    const ms = i.name.toLowerCase().includes(s) || (i.category||'').toLowerCase().includes(s);
    return ms && (!cat || i.category === cat);
  });
  rows.sort((a, b) => {
    let va = a[sKey] ?? '', vb = b[sKey] ?? '';
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    return sAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const tbody = document.getElementById('inv-tbody');
  const empty = document.getElementById('empty-st');
  const addBtn = document.getElementById('btn-add-item');
  if (addBtn) addBtn.style.display = perm('canAdd') ? '' : 'none';

  if (!rows.length) {
    tbody.innerHTML = '';
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
    tbody.innerHTML = rows.map(it => {
      const st = stockSt(it);
      const actionBtns = [
        perm('canMove')   ? `<button class="btn-move" onclick="openMove('${it.id}')">+/- Stock</button>` : '',
        perm('canEdit')   ? `<button class="btn-edit" onclick="openEdit('${it.id}')">Edit</button>` : '',
        perm('canDelete') ? `<button class="btn-del"  onclick="openDel('${it.id}')">Remove</button>` : '',
      ].filter(Boolean).join('');

      return `<tr>
        <td><div class="item-name">${esc(it.name)}</div></td>
        <td><span class="badge badge-${it.category}">${cap(it.category)}</span></td>
        <td style="font-weight:700;">${it.quantity}</td>
        <td style="color:var(--text3);font-size:0.8rem;">${esc(it.unit)}</td>
        <td style="font-weight:600;">₱${(+it.price||0).toFixed(2)}</td>
        <td><div class="${st.cls}"><span class="status-dot">${st.label}</span></div></td>
        <td><div class="actions">${actionBtns || '<span style="color:var(--text3);font-size:0.75rem;">View only</span>'}</div></td>
      </tr>`;
    }).join('');
  }

  updateStats();
  updateAlertBanner();
  updateNotifications();
}

function stockSt(it) {
  if (it.quantity <= 0)                     return { cls:'stock-out', label:'Out of stock' };
  if (it.quantity <= (it.threshold || 5))  return { cls:'stock-low', label:'Low stock' };
  return { cls:'stock-ok', label:'In stock' };
}

function updateStats() {
  const low = inv.filter(i => i.quantity > 0 && i.quantity <= (i.threshold||5)).length;
  const out = inv.filter(i => i.quantity <= 0).length;
  const val = inv.reduce((s,i) => s + (+i.price||0)*(+i.quantity||0), 0);
  document.getElementById('st-total').textContent = inv.length;
  document.getElementById('st-low').textContent   = low;
  document.getElementById('st-out').textContent   = out;
  document.getElementById('st-val').textContent   = '₱' + val.toLocaleString('en-PH', {minimumFractionDigits:0});
}

function sort(k) {
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

  if (!out.length && !low.length) { banner.style.display = 'none'; return; }

  const parts = [];
  if (out.length) parts.push(`${out.length} item${out.length > 1 ? 's are' : ' is'} out of stock`);
  if (low.length) parts.push(`${low.length} item${low.length > 1 ? 's are' : ' is'} running low`);
  text.textContent = 'Stock alert: ' + parts.join(' and ') + '. Please reorder soon.';
  banner.style.display = 'flex';
}

function dismissBanner() {
  bannerDismissed = true;
  document.getElementById('alert-banner').style.display = 'none';
}

// ── NOTIFICATIONS ─────────────────────────────────────────
function updateNotifications() {
  const out = inv.filter(i => i.quantity <= 0);
  const low = inv.filter(i => i.quantity > 0 && i.quantity <= (i.threshold||5));
  const all = [
    ...out.map(i => ({ item: i, type: 'out' })),
    ...low.map(i => ({ item: i, type: 'low' }))
  ];

  const badge = document.getElementById('notif-badge');
  badge.style.display = all.length > 0 ? 'flex' : 'none';
  badge.textContent   = all.length > 9 ? '9+' : all.length;

  const list = document.getElementById('notif-list');
  if (!all.length) {
    list.innerHTML = '<div class="notif-empty">All stock levels are good!</div>';
    return;
  }

  list.innerHTML = all.map(({ item, type }) => {
    const label = type === 'out' ? 'Out of stock' : `Low — ${item.quantity} ${item.unit} left`;
    const actionBtn = perm('canMove')
      ? `<button class="notif-action-btn" onclick="event.stopPropagation();openMove('${item.id}')">+ Stock</button>`
      : '';
    return `<div class="notif-item" onclick="highlightItem('${item.id}')">
      <div class="notif-dot ${type}"></div>
      <div class="notif-item-text">
        <div class="notif-item-name">${esc(item.name)}</div>
        <div class="notif-item-detail">${label}</div>
      </div>
      ${actionBtn}
    </div>`;
  }).join('');
}

function highlightItem(id) {
  toggleNotifPanel();
  switchTab('inventory');
  setTimeout(() => {
    const rows = document.querySelectorAll('#inv-tbody tr');
    rows.forEach(r => {
      const btn = r.querySelector('[onclick*="' + id + '"]');
      if (btn) {
        r.scrollIntoView({ behavior: 'smooth', block: 'center' });
        r.classList.add('row-highlight');
        setTimeout(() => r.classList.remove('row-highlight'), 2200);
      }
    });
  }, 200);
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', function(e) {
  const wrap = document.getElementById('notif-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const panel = document.getElementById('notif-panel');
    if (panel) panel.style.display = 'none';
  }
});

// ── STOCK MOVEMENT ────────────────────────────────────────
function openMove(id) {
  if (!perm('canMove')) return toast('You do not have permission to update stock.', 'danger');
  moveItemId = id;
  const it = inv.find(i => i.id === id);
  if (!it) return;

  document.getElementById('move-item-name').textContent    = it.name;
  document.getElementById('move-current-qty').textContent  = `Current stock: ${it.quantity} ${it.unit}`;
  // Reset radio
  const radios = document.querySelectorAll('input[name="move-type"]');
  radios.forEach(r => { r.checked = r.value === 'add'; });
  set('move-qty', '');
  set('move-note', '');
  updateMovePreview(it);

  document.getElementById('move-modal').classList.add('show');
}

function getMoveType() {
  const checked = document.querySelector('input[name="move-type"]:checked');
  return checked ? checked.value : 'add';
}

function updateMovePreview(it) {
  if (!it) it = inv.find(i => i.id === moveItemId);
  if (!it) return;

  const type = getMoveType();
  const qty  = parseFloat(v('move-qty')) || 0;
  let newQty = it.quantity;

  if (type === 'add')    newQty = it.quantity + qty;
  if (type === 'sell')   newQty = it.quantity - qty;
  if (type === 'use')    newQty = it.quantity - qty;
  if (type === 'remove') newQty = it.quantity - qty;
  if (newQty < 0) newQty = 0;

  const preview = document.getElementById('move-preview');
  const cls = newQty <= 0 ? 'stock-out' : newQty <= (it.threshold||5) ? 'stock-low' : 'stock-ok';
  const dot = `<span class="${cls}"><span class="status-dot" style="font-weight:700;">${newQty} ${esc(it.unit)}</span></span>`;
  preview.innerHTML = `New quantity: ${dot}`;
}

function closeMove() {
  document.getElementById('move-modal').classList.remove('show');
  moveItemId = null;
}

function confirmMove() {
  const it = inv.find(i => i.id === moveItemId);
  if (!it) return;

  const type = getMoveType();
  const qty  = parseFloat(v('move-qty'));
  const note = v('move-note').trim();

  if (isNaN(qty) || qty <= 0) return toast('Enter a valid quantity.', 'danger');

  const prevQty = it.quantity;
  if (type === 'add')    it.quantity = prevQty + qty;
  if (type === 'sell')   it.quantity = Math.max(0, prevQty - qty);
  if (type === 'use')    it.quantity = Math.max(0, prevQty - qty);
  if (type === 'remove') it.quantity = Math.max(0, prevQty - qty);

  it.updatedAt = new Date().toISOString();

  const entry = {
    id:        uid(),
    itemId:    it.id,
    itemName:  it.name,
    type,
    qty,
    prevQty,
    newQty:    it.quantity,
    unit:      it.unit,
    price:     it.price || 0,
    note,
    ts:        new Date().toISOString(),
  };
  stockLog.unshift(entry);
  if (stockLog.length > 500) stockLog = stockLog.slice(0, 500);

  db.setInv(user.email, inv);
  db.setLog(user.email, stockLog);

  closeMove();
  bannerDismissed = false;
  render();

  const typeLabel = { add:'added to', sell:'sold from', use:'used from', remove:'removed from' }[type];
  toast(`${qty} ${it.unit} ${typeLabel} ${it.name}`, type === 'add' ? 'success' : 'info');

  if (it.quantity <= 0) {
    setTimeout(() => toast(`${it.name} is now out of stock!`, 'danger'), 400);
  } else if (it.quantity <= (it.threshold||5)) {
    setTimeout(() => toast(`${it.name} is running low (${it.quantity} ${it.unit} left)`, 'warn'), 400);
  }
}

// ── ITEM MODAL ────────────────────────────────────────────
function openAdd() {
  if (!perm('canAdd')) return toast('You do not have permission to add items.', 'danger');
  editId = null;
  document.getElementById('m-title').textContent = 'Add New Item';
  clearForm();
  document.getElementById('item-modal').classList.add('show');
}

function openEdit(id) {
  if (!perm('canEdit')) return toast('You do not have permission to edit items.', 'danger');
  const it = inv.find(i => i.id === id);
  if (!it) return;
  editId = id;
  document.getElementById('m-title').textContent = 'Edit Item';
  set('f-name',   it.name);
  set('f-cat',    it.category);
  set('f-unit',   it.unit);
  set('f-qty',    it.quantity);
  set('f-thresh', it.threshold||'');
  set('f-price',  it.price||'');
  set('f-notes',  it.notes||'');
  document.getElementById('item-modal').classList.add('show');
}

function closeModal() {
  document.getElementById('item-modal').classList.remove('show');
  editId = null;
  clearForm();
}

function clearForm() {
  ['f-name','f-qty','f-thresh','f-price','f-notes'].forEach(id => set(id));
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

  const isNew = !editId;
  const item = {
    id:        editId || uid(),
    name,
    category:  cat,
    unit:      v('f-unit'),
    quantity:  qty,
    threshold: parseFloat(v('f-thresh')) || 5,
    price:     parseFloat(v('f-price'))  || 0,
    notes:     v('f-notes').trim(),
    updatedAt: new Date().toISOString(),
  };

  if (editId) {
    const idx = inv.findIndex(i => i.id === editId);
    const prev = inv[idx];
    if (prev.quantity !== qty) {
      stockLog.unshift({
        id: uid(), itemId: item.id, itemName: item.name,
        type: 'edit', qty: Math.abs(qty - prev.quantity),
        prevQty: prev.quantity, newQty: qty, unit: item.unit,
        price: item.price, note: 'Edited via item form', ts: new Date().toISOString()
      });
    }
    inv[idx] = { ...prev, ...item };
    toast('Item updated!', 'success');
  } else {
    item.createdAt = item.updatedAt;
    inv.unshift(item);
    if (qty > 0) {
      stockLog.unshift({
        id: uid(), itemId: item.id, itemName: item.name,
        type: 'add', qty, prevQty: 0, newQty: qty, unit: item.unit,
        price: item.price, note: 'Initial stock', ts: new Date().toISOString()
      });
    }
    toast('Item added to inventory!', 'success');
  }

  db.setInv(user.email, inv);
  db.setLog(user.email, stockLog);
  closeModal();
  bannerDismissed = false;
  render();
}

// ── DELETE ────────────────────────────────────────────────
function openDel(id) {
  if (!perm('canDelete')) return toast('You do not have permission to delete items.', 'danger');
  delId = id;
  const it = inv.find(i => i.id === id);
  document.getElementById('del-msg').textContent = `"${it?.name}" will be permanently removed from inventory.`;
  document.getElementById('del-modal').classList.add('show');
}

function closeDelModal() {
  document.getElementById('del-modal').classList.remove('show');
  delId = null;
}

function confirmDel() {
  if (!delId) return;
  const it = inv.find(i => i.id === delId);
  if (it) {
    stockLog.unshift({
      id: uid(), itemId: it.id, itemName: it.name,
      type: 'remove', qty: it.quantity, prevQty: it.quantity, newQty: 0,
      unit: it.unit, price: it.price || 0, note: 'Item deleted', ts: new Date().toISOString()
    });
    db.setLog(user.email, stockLog);
  }
  inv = inv.filter(i => i.id !== delId);
  db.setInv(user.email, inv);
  closeDelModal();
  render();
  toast('Item removed.', 'danger');
}

// ── SALES REPORT ──────────────────────────────────────────
function renderSales() {
  if (!perm('sales')) return;

  const period = v('sales-period') || 'month';
  const now = new Date();
  let since;

  if (period === 'today') {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  } else if (period === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 7);
    since = d.toISOString();
  } else if (period === 'month') {
    const d = new Date(now); d.setDate(d.getDate() - 30);
    since = d.toISOString();
  } else {
    since = '2000-01-01T00:00:00.000Z';
  }

  const sales = stockLog.filter(e => e.type === 'sell' && e.ts >= since);

  // Revenue: qty * price per log entry
  const totalRev = sales.reduce((s, e) => {
    const item = inv.find(i => i.id === e.itemId);
    const price = e.price || item?.price || 0;
    return s + (price * e.qty);
  }, 0);

  const totalUnits = sales.reduce((s, e) => s + e.qty, 0);
  const avgPerSale = sales.length ? totalRev / sales.length : 0;

  document.getElementById('sl-rev').textContent   = '₱' + totalRev.toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2});
  document.getElementById('sl-units').textContent  = totalUnits;
  document.getElementById('sl-txn').textContent    = sales.length;
  document.getElementById('sl-avg').textContent    = '₱' + avgPerSale.toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2});

  // Sales by item
  const byItem = {};
  sales.forEach(e => {
    const item = inv.find(i => i.id === e.itemId);
    const price = e.price || item?.price || 0;
    const rev = price * e.qty;
    if (!byItem[e.itemName]) byItem[e.itemName] = { units: 0, rev: 0 };
    byItem[e.itemName].units += e.qty;
    byItem[e.itemName].rev   += rev;
  });

  const sortedItems = Object.entries(byItem).sort((a, b) => b[1].rev - a[1].rev);
  const maxRev = sortedItems.length ? sortedItems[0][1].rev : 1;
  const itemsEl = document.getElementById('sales-by-item');

  if (!sortedItems.length) {
    itemsEl.innerHTML = '<p class="report-empty">No sales recorded in this period.</p>';
  } else {
    itemsEl.innerHTML = sortedItems.slice(0, 10).map(([name, data]) => `
      <div class="sales-item-row">
        <div style="flex:1;min-width:0;">
          <div class="sales-item-name">${esc(name)}</div>
          <div class="sales-item-units">${data.units} units sold</div>
        </div>
        <div class="sales-bar-track" style="min-width:60px;max-width:90px;">
          <div class="sales-bar-fill" style="width:${(data.rev/maxRev*100).toFixed(1)}%;"></div>
        </div>
        <div class="sales-item-rev">₱${data.rev.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      </div>`
    ).join('');
  }

  // Recent sales
  const recentEl = document.getElementById('sales-recent');
  if (!sales.length) {
    recentEl.innerHTML = '<p class="report-empty">No sales recorded in this period.</p>';
  } else {
    recentEl.innerHTML = sales.slice(0, 12).map(e => {
      const item = inv.find(i => i.id === e.itemId);
      const price = e.price || item?.price || 0;
      const rev = price * e.qty;
      const dt = new Date(e.ts).toLocaleString('en-PH', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      return `<div class="sales-txn-row">
        <div class="txn-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div style="flex:1;min-width:0;">
          <div class="txn-item">${esc(e.itemName)}</div>
          <div class="txn-detail">${e.qty} ${esc(e.unit)} × ₱${price.toFixed(2)}${e.note ? ' · ' + esc(e.note) : ''}</div>
        </div>
        <div style="text-align:right;">
          <div class="txn-amount">₱${rev.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          <div class="txn-time">${dt}</div>
        </div>
      </div>`;
    }).join('');
  }

  // Timeline (daily breakdown)
  const dayMap = {};
  sales.forEach(e => {
    const day = e.ts.slice(0, 10);
    const item = inv.find(i => i.id === e.itemId);
    const price = e.price || item?.price || 0;
    if (!dayMap[day]) dayMap[day] = 0;
    dayMap[day] += price * e.qty;
  });

  const days = Object.keys(dayMap).sort();
  const maxDay = days.length ? Math.max(...days.map(d => dayMap[d])) : 1;
  const timelineEl = document.getElementById('sales-timeline');

  if (!days.length) {
    timelineEl.innerHTML = '<p class="report-empty">No sales data to display.</p>';
  } else {
    timelineEl.innerHTML = days.reverse().slice(0, 14).map(day => {
      const d = new Date(day + 'T00:00:00');
      const label = d.toLocaleDateString('en-PH', { month:'short', day:'numeric' });
      const val = dayMap[day];
      return `<div class="timeline-row">
        <div class="timeline-date">${label}</div>
        <div class="timeline-bar-track">
          <div class="timeline-bar-fill" style="width:${(val/maxDay*100).toFixed(1)}%;"></div>
        </div>
        <div class="timeline-val">₱${val.toLocaleString('en-PH',{minimumFractionDigits:0})}</div>
      </div>`;
    }).join('');
  }
}

// ── REPORTS ───────────────────────────────────────────────
function renderReports() {
  if (!perm('reports')) return;

  const out = inv.filter(i => i.quantity <= 0);
  const low = inv.filter(i => i.quantity > 0 && i.quantity <= (i.threshold||5));
  const ok  = inv.filter(i => i.quantity > (i.threshold||5));
  const val = inv.reduce((s,i) => s + (+i.price||0)*(+i.quantity||0), 0);

  document.getElementById('rpt-ok').textContent  = ok.length;
  document.getElementById('rpt-low').textContent = low.length;
  document.getElementById('rpt-out').textContent = out.length;
  document.getElementById('rpt-val').textContent = '₱' + val.toLocaleString('en-PH', {minimumFractionDigits:0});

  // Category bars
  const cats = ['beans','dairy','syrups','equipment','supplies','other'];
  const catCounts = {};
  cats.forEach(c => catCounts[c] = inv.filter(i => i.category === c).length);
  const maxCount = Math.max(...Object.values(catCounts), 1);

  document.getElementById('cat-bars').innerHTML = cats
    .filter(c => catCounts[c] > 0)
    .sort((a,b) => catCounts[b] - catCounts[a])
    .map(c => `
      <div class="cat-bar-row">
        <div class="cat-bar-label">${cap(c)}</div>
        <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(catCounts[c]/maxCount*100).toFixed(1)}%;"></div></div>
        <div class="cat-bar-count">${catCounts[c]}</div>
      </div>`
    ).join('') || '<p class="report-empty">No items yet.</p>';

  // Critical items
  const critical = [...out, ...low].sort((a,b) => a.quantity - b.quantity);
  const attEl = document.getElementById('attention-list');
  attEl.innerHTML = !critical.length
    ? '<p class="report-empty">All items are sufficiently stocked!</p>'
    : critical.map(it => {
        const isOut = it.quantity <= 0;
        return `<div class="attention-item ${isOut ? 'is-out' : 'is-low'}">
          <div class="att-left">
            <div class="att-icon ${isOut ? 'out-icon' : 'low-icon'}">
              ${isOut
                ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" x2="19.07" y1="4.93" y2="19.07"/></svg>`
                : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`
              }
            </div>
            <div>
              <div class="att-name">${esc(it.name)}</div>
              <div class="att-sku">${cap(it.category)} · Alert at ${it.threshold||5} ${esc(it.unit)}</div>
            </div>
          </div>
          <div class="att-right">
            <div class="att-qty ${isOut ? 'out' : 'low'}">${it.quantity} ${esc(it.unit)}</div>
            <div class="att-status">${isOut ? 'Out of stock' : 'Low stock'}</div>
          </div>
        </div>`;
      }).join('');

  // Top value
  const topVal = [...inv]
    .map(i => ({ ...i, totalVal: (+i.price||0) * (+i.quantity||0) }))
    .filter(i => i.totalVal > 0)
    .sort((a,b) => b.totalVal - a.totalVal)
    .slice(0, 5);

  document.getElementById('top-value-list').innerHTML = !topVal.length
    ? '<p class="report-empty">No items with value yet.</p>'
    : topVal.map((it, idx) => `
        <div class="value-item">
          <div class="val-rank">#${idx+1}</div>
          <div>
            <div class="val-name">${esc(it.name)}</div>
            <div class="att-sku">${it.quantity} ${esc(it.unit)} × ₱${(+it.price).toFixed(2)}</div>
          </div>
          <div class="val-amount">₱${it.totalVal.toLocaleString('en-PH',{minimumFractionDigits:0})}</div>
        </div>`
      ).join('');

  // Movement summary
  const since = new Date(Date.now() - 30*24*60*60*1000).toISOString();
  const recent = stockLog.filter(e => e.ts >= since);
  const soldQty   = recent.filter(e => e.type==='sell').reduce((s,e) => s+e.qty, 0);
  const usedQty   = recent.filter(e => e.type==='use').reduce((s,e) => s+e.qty, 0);
  const addedQty  = recent.filter(e => e.type==='add').reduce((s,e) => s+e.qty, 0);
  const moveEl = document.getElementById('rpt-movements');
  if (moveEl) {
    moveEl.innerHTML = `
      <div class="move-summary-grid">
        <div class="move-sum-card"><div class="msval">${addedQty}</div><div class="mslabel">Units Added</div></div>
        <div class="move-sum-card"><div class="msval">${soldQty}</div><div class="mslabel">Units Sold</div></div>
        <div class="move-sum-card"><div class="msval">${usedQty}</div><div class="mslabel">Units Used</div></div>
        <div class="move-sum-card"><div class="msval">${recent.length}</div><div class="mslabel">Total Movements</div></div>
      </div>`;
  }
}

// ── ACTIVITY LOG ──────────────────────────────────────────
function renderActivity() {
  if (!perm('activity')) return;
  const el = document.getElementById('activity-list');
  if (!stockLog.length) {
    el.innerHTML = `<div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      <p>No stock movements recorded yet.</p>
    </div>`;
    return;
  }

  const typeConfig = {
    add:    { svg:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>`, label:'Added',   cls:'act-add' },
    sell:   { svg:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`, label:'Sold',    cls:'act-sell' },
    use:    { svg:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`, label:'Used',    cls:'act-use' },
    remove: { svg:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`, label:'Removed', cls:'act-remove' },
    edit:   { svg:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`, label:'Edited',  cls:'act-edit' },
  };

  el.innerHTML = stockLog.slice(0, 120).map(e => {
    const cfg = typeConfig[e.type] || typeConfig.edit;
    const date = new Date(e.ts).toLocaleString('en-PH', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    const isPos = e.newQty >= e.prevQty;
    const change = isPos ? `+${e.qty}` : `-${e.qty}`;
    return `<div class="act-item">
      <div class="act-icon-wrap ${cfg.cls}">${cfg.svg}</div>
      <div class="act-body">
        <div class="act-title">
          <span class="act-label ${cfg.cls}-text">${cfg.label}</span>
          <span class="act-item-name">${esc(e.itemName)}</span>
        </div>
        <div class="act-detail">
          ${e.prevQty} → ${e.newQty} ${esc(e.unit)}
          ${e.note ? `<span class="act-note">· ${esc(e.note)}</span>` : ''}
        </div>
      </div>
      <div class="act-meta">
        <div class="act-change ${isPos ? 'pos' : 'neg'}">${change} ${esc(e.unit)}</div>
        <div class="act-time">${date}</div>
      </div>
    </div>`;
  }).join('');
}

// ── ADMIN PANEL ───────────────────────────────────────────
function renderAdmin() {
  if (!perm('admin')) return;

  // Users table
  const users = db.users();
  const tbody = document.getElementById('admin-users-tbody');
  tbody.innerHTML = users.map(u => `
    <tr>
      <td style="font-weight:600;">${esc(u.name)}</td>
      <td style="color:var(--text3);font-size:0.82rem;">${esc(u.email)}</td>
      <td>${esc(u.shop)}</td>
      <td><span class="badge badge-${u.role?.toLowerCase() === 'admin' ? 'beans' : u.role?.toLowerCase() === 'owner' ? 'supplies' : 'other'}">${esc(u.role||'—')}</span></td>
      <td style="color:var(--text3);font-size:0.82rem;">${esc(u.phone||'—')}</td>
      <td style="color:var(--text3);font-size:0.8rem;">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '—'}</td>
    </tr>`
  ).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:2rem;">No users found.</td></tr>';

  // Role access matrix
  const features = [
    { key:'inventory',  label:'View Inventory' },
    { key:'canMove',    label:'Update Stock (+/- Stock)' },
    { key:'canAdd',     label:'Add Items' },
    { key:'canEdit',    label:'Edit Items' },
    { key:'canDelete',  label:'Delete Items' },
    { key:'sales',      label:'Sales Report' },
    { key:'reports',    label:'Inventory Reports' },
    { key:'activity',   label:'Activity Log' },
    { key:'admin',      label:'Admin Panel' },
  ];
  const roles = ['Admin','Owner','Manager','Barista','Staff'];
  const checkSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
  const crossSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

  const matrixTbody = document.getElementById('role-matrix-tbody');
  matrixTbody.innerHTML = features.map(f => `
    <tr>
      <td style="font-weight:500;font-size:0.84rem;">${f.label}</td>
      ${roles.map(r => {
        const has = ROLE_ACCESS[r][f.key] === true;
        return `<td class="${has ? 'role-check' : 'role-cross'}">${has ? checkSvg : crossSvg}</td>`;
      }).join('')}
    </tr>`
  ).join('');
}

// ── PROFILE ───────────────────────────────────────────────
function openProfile() {
  const u = user;
  document.getElementById('prof-avatar').textContent     = u.name.charAt(0).toUpperCase();
  document.getElementById('prof-name').textContent       = u.name;
  document.getElementById('prof-role-badge').textContent = u.role || 'Staff';
  document.getElementById('prof-shop').textContent       = u.shop;
  document.getElementById('prof-email').textContent      = u.email;
  document.getElementById('prof-phone').textContent      = u.phone || '—';
  document.getElementById('prof-role').textContent       = u.role  || '—';
  document.getElementById('prof-since').textContent      = u.createdAt
    ? new Date(u.createdAt).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })
    : 'N/A';
  set('pe-name',  u.name);
  set('pe-shop',  u.shop);
  set('pe-phone', u.phone || '');
  set('pe-role',  u.role  || 'Staff');
  document.getElementById('profile-modal').classList.add('show');
}

function closeProfile() { document.getElementById('profile-modal').classList.remove('show'); }

function saveProfile() {
  const name = v('pe-name').trim(), shop = v('pe-shop').trim();
  const phone = v('pe-phone').trim(), role = v('pe-role');
  if (!name) return toast('Name cannot be empty.', 'danger');
  if (!shop) return toast('Shop name cannot be empty.', 'danger');
  user.name = name; user.shop = shop; user.phone = phone; user.role = role;
  const users = db.users();
  const idx = users.findIndex(u => u.email === user.email);
  if (idx !== -1) users[idx] = { ...users[idx], name, shop, phone, role };
  db.setUsers(users); db.setSess(user);
  document.getElementById('hdr-name').textContent   = name.split(' ')[0];
  document.getElementById('hdr-shop').textContent   = shop;
  document.getElementById('hdr-avatar').textContent = name.charAt(0).toUpperCase();
  setupNavForRole();
  closeProfile();
  toast('Profile updated!', 'success');
}

// ── TOS ───────────────────────────────────────────────────
function openTOS()   { document.getElementById('tos-modal').classList.add('show'); }
function closeTOS()  { document.getElementById('tos-modal').classList.remove('show'); }
function acceptTOS() { document.getElementById('su-tos').checked = true; closeTOS(); toast('Terms accepted!', 'success'); }

// ── TOAST ─────────────────────────────────────────────────
const TOAST_ICONS = {
  success: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  danger:  `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  info:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
  warn:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/></svg>`,
};

function toast(msg, type) {
  const el = document.createElement('div');
  el.className = `toast t-${type||'success'}`;
  el.innerHTML = `<div class="toast-icon">${TOAST_ICONS[type]||TOAST_ICONS.info}</div>${msg}`;
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateX(16px)'; el.style.transition='all 0.3s'; setTimeout(()=>el.remove(), 300); }, 3400);
}

// ── HELPERS ───────────────────────────────────────────────
function uid()           { return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function v(id)           { return document.getElementById(id)?.value ?? ''; }
function set(id, val='') { const el = document.getElementById(id); if (el) el.value = val; }
function esc(s)          { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function cap(s)          { return s ? s[0].toUpperCase()+s.slice(1) : ''; }

// ── BACKDROP CLOSE ────────────────────────────────────────
['item-modal','del-modal','profile-modal','tos-modal','move-modal'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', function(e) {
    if (e.target !== this) return;
    if (id === 'item-modal')     closeModal();
    else if (id === 'del-modal')     closeDelModal();
    else if (id === 'profile-modal') closeProfile();
    else if (id === 'tos-modal')     closeTOS();
    else if (id === 'move-modal')    closeMove();
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

// ── ESCAPE KEY ────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeModal(); closeDelModal(); closeProfile(); closeTOS(); closeMove();
});

// ── INIT ──────────────────────────────────────────────────
(function() {
  initTheme();
  const s = db.sess();
  if (s) launch(s);
})();
