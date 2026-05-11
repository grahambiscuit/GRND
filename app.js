// ── WAIT FOR FIREBASE ─────────────────────────────────────
function waitForFirebase(cb) {
  if (window._firebase) return cb(window._firebase);
  const t = setInterval(() => {
    if (window._firebase) { clearInterval(t); cb(window._firebase); }
  }, 50);
}

// ── ROLE ACCESS CONTROL ───────────────────────────────────
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

// ── STATE ─────────────────────────────────────────────────
let user = null, inv = [], stockLog = [];
let editId = null, delId = null, moveItemId = null;
let sKey = 'name', sAsc = true;
let currentTab = 'inventory';
let bannerDismissed = false;
let _fb = null; // Firebase references

// ── FIREBASE HELPERS ──────────────────────────────────────
function userDocRef(uid) {
  return _fb.doc(_fb.db, 'users', uid);
}
function invColRef(uid) {
  return _fb.collection(_fb.db, 'users', uid, 'inventory');
}
function logColRef(uid) {
  return _fb.collection(_fb.db, 'users', uid, 'stockLog');
}

async function fbGetUser(uid) {
  const snap = await _fb.getDoc(userDocRef(uid));
  return snap.exists() ? snap.data() : null;
}

async function fbSetUser(uid, data) {
  await _fb.setDoc(userDocRef(uid), data, { merge: true });
}

async function fbGetInv(uid) {
  const snap = await _fb.getDocs(invColRef(uid));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fbSaveInvItem(uid, item) {
  const { id, ...data } = item;
  await _fb.setDoc(_fb.doc(_fb.db, 'users', uid, 'inventory', id), data);
}

async function fbDeleteInvItem(uid, itemId) {
  const { deleteDoc } = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
  await deleteDoc(_fb.doc(_fb.db, 'users', uid, 'inventory', itemId));
}

async function fbGetLog(uid) {
  const q = _fb.query(logColRef(uid), _fb.orderBy('ts', 'desc'), _fb.limit(500));
  const snap = await _fb.getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fbAddLog(uid, entry) {
  const { id, ...data } = entry;
  await _fb.setDoc(_fb.doc(_fb.db, 'users', uid, 'stockLog', id), data);
}

async function fbGetAllUsers() {
  const snap = await _fb.getDocs(_fb.collection(_fb.db, 'users'));
  return snap.docs.map(d => d.data());
}

// ── SEED INVENTORY TO FIRESTORE ───────────────────────────
async function seedInventoryToFirestore(uid) {
  const now = new Date();
  const items = SEED_INVENTORY.map((s, i) => ({
    id: uid_gen(),
    createdAt: new Date(now - (SEED_INVENTORY.length - i) * 3600000).toISOString(),
    updatedAt: new Date(now - (SEED_INVENTORY.length - i) * 3600000).toISOString(),
    ...s,
  }));

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
        id: uid_gen(), itemId: item.id, itemName: item.name,
        type, qty, prevQty: item.quantity,
        newQty: Math.max(0, item.quantity + (type === 'add' ? qty : -qty)),
        unit: item.unit, note: notes[Math.floor(Math.random() * notes.length)],
        price: item.price, ts,
      });
    }
  }

  // Write items in batches of 500
  const batch = _fb.writeBatch(_fb.db);
  items.forEach(item => {
    const { id, ...data } = item;
    batch.set(_fb.doc(_fb.db, 'users', uid, 'inventory', id), data);
  });
  await batch.commit();

  // Write logs
  const logBatch = _fb.writeBatch(_fb.db);
  logs.forEach(entry => {
    const { id, ...data } = entry;
    logBatch.set(_fb.doc(_fb.db, 'users', uid, 'stockLog', id), data);
  });
  await logBatch.commit();

  return { items, logs: logs.reverse() };
}

// ── THEME ─────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('oxis_theme') || 'light';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('oxis_theme', theme);
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

async function doLogin() {
  const email = v('li-email').trim(), pass = v('li-pass');
  if (!email || !pass) return showErr('login-err', 'Please fill in all fields.');
  try {
    const cred = await _fb.signInWithEmailAndPassword(_fb.auth, email, pass);
    // onAuthStateChanged will handle the rest
  } catch (err) {
    const msgs = {
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/invalid-credential': 'Invalid email or password.',
    };
    showErr('login-err', msgs[err.code] || 'Sign in failed. Please try again.');
  }
}

async function doSignup() {
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

  try {
    const cred = await _fb.createUserWithEmailAndPassword(_fb.auth, email, pass);
    await _fb.updateProfile(cred.user, { displayName: name });

    const userData = {
      name, shop, email, phone, role,
      uid: cred.user.uid,
      createdAt: new Date().toISOString(),
      seeded: false,
    };

    await fbSetUser(cred.user.uid, userData);
    // onAuthStateChanged will handle launch + seeding
  } catch (err) {
    const msgs = {
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/weak-password': 'Password is too weak (min 6 characters).',
    };
    showErr('su-err', msgs[err.code] || 'Sign up failed. Please try again.');
  }
}

async function doLogout() {
  await _fb.signOut(_fb.auth);
  user = null; inv = []; stockLog = [];
  document.getElementById('app-wrapper').style.display = 'none';
  document.getElementById('auth-wrapper').style.display = 'flex';
  showPanel('login');
}

async function launch(firebaseUser) {
  try {
    showLoader(true);
    let userData = await fbGetUser(firebaseUser.uid);

    if (!userData) {
      // New user via Google or edge case — create profile
      userData = {
        name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        shop: 'My Coffee Shop',
        email: firebaseUser.email,
        phone: '',
        role: 'Owner',
        uid: firebaseUser.uid,
        createdAt: new Date().toISOString(),
        seeded: false,
      };
      await fbSetUser(firebaseUser.uid, userData);
    }

    user = userData;
    inv  = await fbGetInv(firebaseUser.uid);

    if (!inv.length && !userData.seeded) {
      toast('Setting up your inventory…', 'info');
      const seeded = await seedInventoryToFirestore(firebaseUser.uid);
      inv      = seeded.items;
      stockLog = seeded.logs;
      await fbSetUser(firebaseUser.uid, { seeded: true });
    } else {
      stockLog = await fbGetLog(firebaseUser.uid);
    }

    document.getElementById('auth-wrapper').style.display = 'none';
    document.getElementById('app-wrapper').style.display  = 'block';
    document.getElementById('hdr-name').textContent   = user.name.split(' ')[0];
    document.getElementById('hdr-shop').textContent   = user.shop;
    document.getElementById('hdr-avatar').textContent = user.name.charAt(0).toUpperCase();

    setupNavForRole();
    bannerDismissed = false;
    switchTab('inventory');
    render();
  } catch (err) {
    console.error('Launch error:', err);
    toast('Error loading data. Please refresh.', 'danger');
  } finally {
    showLoader(false);
  }
}

function showLoader(visible) {
  const el = document.getElementById('fb-loading');
  if (el) el.style.display = visible ? 'flex' : 'none';
}

// ── ROLE-BASED NAV ────────────────────────────────────────
function setupNavForRole() {
  const tabs = ['inventory','sales','reports','activity','admin'];
  tabs.forEach(t => {
    const btn = document.getElementById('tab-' + t);
    if (btn) btn.style.display = perm(t) ? '' : 'none';
  });
}

// ── TAB SWITCHING ─────────────────────────────────────────
function switchTab(tab) {
  if (!perm(tab)) tab = 'inventory';
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

  const tbody  = document.getElementById('inv-tbody');
  const empty  = document.getElementById('empty-st');
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
  if (it.quantity <= 0)                    return { cls:'stock-out', label:'Out of stock' };
  if (it.quantity <= (it.threshold || 5)) return { cls:'stock-low', label:'Low stock' };
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
  const all = [...out.map(i => ({ item: i, type: 'out' })), ...low.map(i => ({ item: i, type: 'low' }))];

  const badge = document.getElementById('notif-badge');
  badge.style.display = all.length > 0 ? 'flex' : 'none';
  badge.textContent   = all.length > 9 ? '9+' : all.length;

  const list = document.getElementById('notif-list');
  if (!all.length) { list.innerHTML = '<div class="notif-empty">All stock levels are good!</div>'; return; }

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
  document.getElementById('move-item-name').textContent   = it.name;
  document.getElementById('move-current-qty').textContent = `Current stock: ${it.quantity} ${it.unit}`;
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

async function confirmMove() {
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
    id: uid_gen(), itemId: it.id, itemName: it.name,
    type, qty, prevQty, newQty: it.quantity,
    unit: it.unit, price: it.price || 0, note,
    ts: new Date().toISOString(),
  };
  stockLog.unshift(entry);
  if (stockLog.length > 500) stockLog = stockLog.slice(0, 500);

  closeMove();
  render();

  // Persist to Firestore in background
  try {
    await fbSaveInvItem(user.uid, it);
    await fbAddLog(user.uid, entry);
  } catch (err) {
    console.error('Firestore write error:', err);
    toast('Saved locally — sync error. Check connection.', 'warn');
  }

  bannerDismissed = false;
  const typeLabel = { add:'added to', sell:'sold from', use:'used from', remove:'removed from' }[type];
  toast(`${qty} ${it.unit} ${typeLabel} ${it.name}`, type === 'add' ? 'success' : 'info');

  if (it.quantity <= 0) setTimeout(() => toast(`${it.name} is now out of stock!`, 'danger'), 400);
  else if (it.quantity <= (it.threshold||5)) setTimeout(() => toast(`${it.name} is running low (${it.quantity} ${it.unit} left)`, 'warn'), 400);
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

async function saveItem() {
  const name = v('f-name').trim();
  const cat  = v('f-cat');
  const qty  = parseFloat(v('f-qty'));
  if (!name)               return toast('Item name is required.', 'danger');
  if (!cat)                return toast('Please select a category.', 'danger');
  if (isNaN(qty) || qty < 0) return toast('Enter a valid quantity.', 'danger');

  const item = {
    id:        editId || uid_gen(),
    name, category: cat,
    unit:      v('f-unit'),
    quantity:  qty,
    threshold: parseFloat(v('f-thresh')) || 5,
    price:     parseFloat(v('f-price'))  || 0,
    notes:     v('f-notes').trim(),
    updatedAt: new Date().toISOString(),
  };

  let logEntry = null;

  if (editId) {
    const idx  = inv.findIndex(i => i.id === editId);
    const prev = inv[idx];
    if (prev.quantity !== qty) {
      logEntry = {
        id: uid_gen(), itemId: item.id, itemName: item.name,
        type: 'edit', qty: Math.abs(qty - prev.quantity),
        prevQty: prev.quantity, newQty: qty, unit: item.unit,
        price: item.price, note: 'Edited via item form', ts: new Date().toISOString()
      };
      stockLog.unshift(logEntry);
    }
    inv[idx] = { ...prev, ...item };
    toast('Item updated!', 'success');
  } else {
    item.createdAt = item.updatedAt;
    inv.unshift(item);
    if (qty > 0) {
      logEntry = {
        id: uid_gen(), itemId: item.id, itemName: item.name,
        type: 'add', qty, prevQty: 0, newQty: qty, unit: item.unit,
        price: item.price, note: 'Initial stock', ts: new Date().toISOString()
      };
      stockLog.unshift(logEntry);
    }
    toast('Item added to inventory!', 'success');
  }

  closeModal();
  bannerDismissed = false;
  render();

  // Persist
  try {
    await fbSaveInvItem(user.uid, item);
    if (logEntry) await fbAddLog(user.uid, logEntry);
  } catch (err) {
    console.error('Firestore write error:', err);
  }
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

async function confirmDel() {
  if (!delId) return;
  const it = inv.find(i => i.id === delId);
  let logEntry = null;
  if (it) {
    logEntry = {
      id: uid_gen(), itemId: it.id, itemName: it.name,
      type: 'remove', qty: it.quantity, prevQty: it.quantity, newQty: 0,
      unit: it.unit, price: it.price || 0, note: 'Item deleted', ts: new Date().toISOString()
    };
    stockLog.unshift(logEntry);
  }
  inv = inv.filter(i => i.id !== delId);
  closeDelModal();
  render();
  toast('Item removed.', 'danger');

  try {
    await fbDeleteInvItem(user.uid, delId);
    if (logEntry) await fbAddLog(user.uid, logEntry);
  } catch (err) {
    console.error('Firestore delete error:', err);
  }
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
    const d = new Date(now); d.setDate(d.getDate() - 7); since = d.toISOString();
  } else if (period === 'month') {
    const d = new Date(now); d.setDate(d.getDate() - 30); since = d.toISOString();
  } else {
    since = '2000-01-01T00:00:00.000Z';
  }

  const sales = stockLog.filter(e => e.type === 'sell' && e.ts >= since);
  const totalRev   = sales.reduce((s, e) => { const item = inv.find(i => i.id === e.itemId); return s + ((e.price || item?.price || 0) * e.qty); }, 0);
  const totalUnits = sales.reduce((s, e) => s + e.qty, 0);
  const avgPerSale = sales.length ? totalRev / sales.length : 0;

  document.getElementById('sl-rev').textContent   = '₱' + totalRev.toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2});
  document.getElementById('sl-units').textContent  = totalUnits;
  document.getElementById('sl-txn').textContent    = sales.length;
  document.getElementById('sl-avg').textContent    = '₱' + avgPerSale.toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2});

  const byItem = {};
  sales.forEach(e => {
    const item  = inv.find(i => i.id === e.itemId);
    const price = e.price || item?.price || 0;
    if (!byItem[e.itemName]) byItem[e.itemName] = { units: 0, rev: 0 };
    byItem[e.itemName].units += e.qty;
    byItem[e.itemName].rev   += price * e.qty;
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
      </div>`).join('');
  }

  const recentEl = document.getElementById('sales-recent');
  if (!sales.length) {
    recentEl.innerHTML = '<p class="report-empty">No sales recorded in this period.</p>';
  } else {
    recentEl.innerHTML = sales.slice(0, 12).map(e => {
      const item  = inv.find(i => i.id === e.itemId);
      const price = e.price || item?.price || 0;
      const rev   = price * e.qty;
      const dt    = new Date(e.ts).toLocaleString('en-PH', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      return `<div class="sales-txn-row">
        <div class="txn-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
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

  const dayMap = {};
  sales.forEach(e => {
    const day  = e.ts.slice(0, 10);
    const item = inv.find(i => i.id === e.itemId);
    const price = e.price || item?.price || 0;
    if (!dayMap[day]) dayMap[day] = 0;
    dayMap[day] += price * e.qty;
  });
  const days   = Object.keys(dayMap).sort();
  const maxDay = days.length ? Math.max(...days.map(d => dayMap[d])) : 1;
  const timelineEl = document.getElementById('sales-timeline');
  if (!days.length) {
    timelineEl.innerHTML = '<p class="report-empty">No sales data to display.</p>';
  } else {
    timelineEl.innerHTML = days.reverse().slice(0, 14).map(day => {
      const d     = new Date(day + 'T00:00:00');
      const label = d.toLocaleDateString('en-PH', { month:'short', day:'numeric' });
      const val   = dayMap[day];
      return `<div class="timeline-row">
        <div class="timeline-date">${label}</div>
        <div class="timeline-bar-track"><div class="timeline-bar-fill" style="width:${(val/maxDay*100).toFixed(1)}%;"></div></div>
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
      </div>`).join('') || '<p class="report-empty">No items yet.</p>';

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
                : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`}
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
        </div>`).join('');

  const since  = new Date(Date.now() - 30*24*60*60*1000).toISOString();
  const recent = stockLog.filter(e => e.ts >= since);
  const soldQty  = recent.filter(e => e.type==='sell').reduce((s,e) => s+e.qty, 0);
  const usedQty  = recent.filter(e => e.type==='use').reduce((s,e) => s+e.qty, 0);
  const addedQty = recent.filter(e => e.type==='add').reduce((s,e) => s+e.qty, 0);
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
    el.innerHTML = `<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg><p>No stock movements recorded yet.</p></div>`;
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
    const cfg  = typeConfig[e.type] || typeConfig.edit;
    const date = new Date(e.ts).toLocaleString('en-PH', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    const isPos = e.newQty >= e.prevQty;
    const change = isPos ? `+${e.qty}` : `-${e.qty}`;
    return `<div class="act-item">
      <div class="act-icon-wrap ${cfg.cls}">${cfg.svg}</div>
      <div class="act-body">
        <div class="act-title"><span class="act-label ${cfg.cls}-text">${cfg.label}</span><span class="act-item-name">${esc(e.itemName)}</span></div>
        <div class="act-detail">${e.prevQty} → ${e.newQty} ${esc(e.unit)}${e.note ? ` <span class="act-note">· ${esc(e.note)}</span>` : ''}</div>
      </div>
      <div class="act-meta">
        <div class="act-change ${isPos ? 'pos' : 'neg'}">${change} ${esc(e.unit)}</div>
        <div class="act-time">${date}</div>
      </div>
    </div>`;
  }).join('');
}

// ── ADMIN PANEL ───────────────────────────────────────────
async function renderAdmin() {
  if (!perm('admin')) return;
  try {
    const users = await fbGetAllUsers();
    const tbody = document.getElementById('admin-users-tbody');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td style="font-weight:600;">${esc(u.name)}</td>
        <td style="color:var(--text3);font-size:0.82rem;">${esc(u.email)}</td>
        <td>${esc(u.shop)}</td>
        <td><span class="badge badge-${u.role?.toLowerCase() === 'admin' ? 'beans' : u.role?.toLowerCase() === 'owner' ? 'supplies' : 'other'}">${esc(u.role||'—')}</span></td>
        <td style="color:var(--text3);font-size:0.82rem;">${esc(u.phone||'—')}</td>
        <td style="color:var(--text3);font-size:0.8rem;">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '—'}</td>
      </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:2rem;">No users found.</td></tr>';
  } catch (err) {
    console.error('Admin fetch error:', err);
  }

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
    </tr>`).join('');
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

async function saveProfile() {
  const name = v('pe-name').trim(), shop = v('pe-shop').trim();
  const phone = v('pe-phone').trim(), role = v('pe-role');
  if (!name) return toast('Name cannot be empty.', 'danger');
  if (!shop) return toast('Shop name cannot be empty.', 'danger');
  user.name = name; user.shop = shop; user.phone = phone; user.role = role;

  document.getElementById('hdr-name').textContent   = name.split(' ')[0];
  document.getElementById('hdr-shop').textContent   = shop;
  document.getElementById('hdr-avatar').textContent = name.charAt(0).toUpperCase();
  setupNavForRole();
  closeProfile();
  toast('Profile updated!', 'success');

  try {
    await fbSetUser(user.uid, { name, shop, phone, role });
  } catch (err) {
    console.error('Profile save error:', err);
  }
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
function uid_gen()       { return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
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
  closeModal(); closeDelModal(); closeProfile(); closeTOS(); closeMove(); closePdfPreview();
});

// ═══════════════════════════════════════════════════════════
// ── PDF / PRINT EXPORT ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

function peso(v)      { return '₱' + (+v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pesoShort(v) { return '₱' + (+v || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

function buildSalesData(period) {
  const now = new Date();
  let since;
  if (period === 'today') {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  } else if (period === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 7); since = d.toISOString();
  } else if (period === 'month') {
    const d = new Date(now); d.setDate(d.getDate() - 30); since = d.toISOString();
  } else {
    since = '2000-01-01T00:00:00.000Z';
  }
  const sales      = stockLog.filter(e => e.type === 'sell' && e.ts >= since);
  const totalRev   = sales.reduce((s, e) => { const item = inv.find(i => i.id === e.itemId); return s + ((e.price || item?.price || 0) * e.qty); }, 0);
  const totalUnits = sales.reduce((s, e) => s + e.qty, 0);
  const totalTxn   = sales.length;
  const avgPerTxn  = totalTxn ? totalRev / totalTxn : 0;
  const byItem = {};
  sales.forEach(e => {
    const item  = inv.find(i => i.id === e.itemId);
    const price = e.price || item?.price || 0;
    if (!byItem[e.itemName]) byItem[e.itemName] = { units: 0, rev: 0, txn: 0, unit: e.unit, cat: item?.category || 'other' };
    byItem[e.itemName].units += e.qty;
    byItem[e.itemName].rev   += price * e.qty;
    byItem[e.itemName].txn   += 1;
  });
  const items = Object.entries(byItem).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.rev - a.rev);
  const byCat = {};
  items.forEach(it => {
    const c = it.cat || 'other';
    if (!byCat[c]) byCat[c] = { rev: 0, units: 0 };
    byCat[c].rev   += it.rev;
    byCat[c].units += it.units;
  });
  const byDay = {};
  sales.forEach(e => {
    const day = e.ts.slice(0, 10);
    const item = inv.find(i => i.id === e.itemId);
    const price = e.price || item?.price || 0;
    if (!byDay[day]) byDay[day] = 0;
    byDay[day] += price * e.qty;
  });
  const days = Object.keys(byDay).sort();
  return { sales, totalRev, totalUnits, totalTxn, avgPerTxn, items, byCat, byDay, days, since, period };
}

function periodLabel(period) {
  const now = new Date();
  if (period === 'today')  return 'Today — ' + now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  if (period === 'week')   return 'Last 7 Days';
  if (period === 'month')  return 'Last 30 Days — ' + now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  return 'All Time';
}

function catColor(cat) {
  const m = { beans:'#c17f3a', dairy:'#1976d2', syrups:'#7b1fa2', supplies:'#2e7d32', equipment:'#e65100', other:'#546e7a' };
  return m[cat] || '#888';
}

function miniBarHTML(pct, color) {
  return `<div class="pr-mini-bar-wrap"><div class="pr-mini-bar-bg"><div class="pr-mini-bar-fill" style="width:${Math.max(2, pct)}%;background:${color || '#c17f3a'};"></div></div></div>`;
}

function sparklineSVG(data, w, h) {
  if (!data.length) return '';
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const pts = data.map((v, i) => [i / (data.length - 1) * w, h - 6 - ((v - mn) / rng * (h - 12))]);
  const line = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = `M${pts[0][0]},${h} ` + pts.map(p => `L${p[0]},${p[1]}`).join(' ') + ` L${pts[pts.length-1][0]},${h} Z`;
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="display:block;">
    <defs><linearGradient id="spkgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c17f3a" stop-opacity="0.22"/><stop offset="100%" stop-color="#c17f3a" stop-opacity="0.01"/></linearGradient></defs>
    <path d="${area}" fill="url(#spkgrad)"/>
    <path d="${line}" fill="none" stroke="#c17f3a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="3" fill="#c17f3a"/>
  </svg>`;
}

function buildPdfHTML(data) {
  const now  = new Date();
  const shop = user?.shop || 'OXIS Coffee';
  const name = user?.name || '—';
  const role = user?.role || 'Staff';
  const { totalRev, totalUnits, totalTxn, avgPerTxn, items, byCat, byDay, days, period } = data;
  const maxItemRev = items.length ? items[0].rev : 1;
  const maxDayRev  = days.length ? Math.max(...days.map(d => byDay[d])) : 1;
  const sparkData = days.map(d => byDay[d]);
  const spark = sparkData.length > 1 ? sparklineSVG(sparkData, 680, 55) : '<p style="color:#8a8078;font-size:9px;padding:10px 0;">No timeline data available for this period.</p>';
  const itemRows = items.length ? items.slice(0, 15).map((it, i) => {
    const pct = maxItemRev ? (it.rev / maxItemRev * 100) : 0;
    return `<tr>
      <td class="pr-rank">${i + 1}</td>
      <td class="${i < 3 ? 'pr-top-name' : 'pr-name'}">${esc(it.name)}</td>
      <td><span class="pr-cat-badge ${it.cat || 'other'}">${cap(it.cat || 'other')}</span></td>
      <td class="pr-units" style="text-align:right;">${it.units.toLocaleString()} ${esc(it.unit)}</td>
      <td style="text-align:right;">${miniBarHTML(pct, catColor(it.cat))}</td>
      <td class="${i === 0 ? 'pr-revenue-top' : 'pr-revenue'}" style="text-align:right;">${peso(it.rev)}</td>
      <td class="pr-pct" style="text-align:right;">${totalRev ? (it.rev / totalRev * 100).toFixed(1) : 0}%</td>
      <td class="pr-pct" style="text-align:center;">${it.txn}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="8" style="text-align:center;color:#8a8078;padding:16px 0;font-size:9px;">No sales recorded in this period.</td></tr>`;

  const totalRow = items.length ? `<tr>
    <td></td><td class="pr-total-label">TOTAL</td><td></td>
    <td style="text-align:right;font-weight:700;font-size:9px;">${totalUnits.toLocaleString()}</td>
    <td></td>
    <td class="pr-total-val" style="text-align:right;">${peso(totalRev)}</td>
    <td style="text-align:right;font-weight:700;font-size:8px;">100%</td>
    <td style="text-align:center;font-weight:700;font-size:9px;">${totalTxn}</td>
  </tr>` : '';

  const sortedCats = Object.entries(byCat).sort((a, b) => b[1].rev - a[1].rev);
  const maxCatRev  = sortedCats.length ? sortedCats[0][1].rev : 1;
  const catBarsHTML = sortedCats.length ? sortedCats.map(([cat, d]) => {
    const pct = (d.rev / maxCatRev * 100).toFixed(1);
    return `<div class="pr-cat-bar-row">
      <div class="pr-cat-bar-label">${cap(cat)}</div>
      <div class="pr-cat-bar-track"><div class="pr-cat-bar-fill" style="width:${pct}%;background:${catColor(cat)};"></div></div>
      <div class="pr-cat-bar-val">${peso(d.rev)}</div>
    </div>`;
  }).join('') : '<p style="color:#8a8078;font-size:9px;">No category data.</p>';

  const sortedDays = [...days].sort((a, b) => b.localeCompare(a));
  const half = Math.ceil(sortedDays.length / 2);
  const leftDays  = sortedDays.slice(0, half);
  const rightDays = sortedDays.slice(half);
  const bestDay   = days.length ? days.reduce((a, b) => byDay[a] > byDay[b] ? a : b) : null;
  function dayRow(d) {
    const dt = new Date(d + 'T00:00:00');
    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
    const isBest    = d === bestDay;
    const pct = maxDayRev ? (byDay[d] / maxDayRev * 100) : 0;
    const cls = isBest ? 'pr-timeline-best' : isWeekend ? 'pr-timeline-weekend' : '';
    return `<tr class="${cls}">
      <td>${dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</td>
      <td style="color:#8a8078;">${dt.toLocaleDateString('en-PH', { weekday: 'short' })}</td>
      <td style="text-align:right;font-weight:${isBest ? '700' : '400'};color:${isBest ? '#c17f3a' : 'inherit'};">${pesoShort(byDay[d])}</td>
      <td class="pr-timeline-bar"><div class="pr-timeline-bar-bg"><div class="pr-timeline-bar-fill" style="width:${Math.max(2, pct)}%;background:${isWeekend ? '#e8a84c' : '#c17f3a'};"></div></div></td>
    </tr>`;
  }
  const dailyLeft  = leftDays.length  ? leftDays.map(dayRow).join('')  : '<tr><td colspan="4" style="color:#8a8078;text-align:center;padding:10px;font-size:9px;">No data</td></tr>';
  const dailyRight = rightDays.length ? rightDays.map(dayRow).join('') : '';
  const dayTableHead = `<thead><tr><th>Date</th><th>Day</th><th style="text-align:right;">Revenue</th><th>Trend</th></tr></thead>`;

  const topItem = items.length ? items[0] : null;
  const insights = [];
  if (totalRev > 0) insights.push(`Total revenue for the <b>${periodLabel(period)}</b> reached <b>${peso(totalRev)}</b> across ${totalTxn} transactions.`);
  if (topItem) insights.push(`Top revenue item: <b>${esc(topItem.name)}</b> contributed <b>${peso(topItem.rev)}</b> (${totalRev ? (topItem.rev/totalRev*100).toFixed(1) : 0}% of total revenue) with ${topItem.units} units sold.`);
  if (bestDay) { const bd = new Date(bestDay + 'T00:00:00'); insights.push(`Best single day: <b>${bd.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</b> with <b>${pesoShort(byDay[bestDay])}</b> in revenue.`); }
  if (sortedCats.length) insights.push(`Top category: <b>${cap(sortedCats[0][0])}</b> led all categories with <b>${peso(sortedCats[0][1].rev)}</b> in revenue.`);
  if (avgPerTxn > 0) insights.push(`Average revenue per transaction was <b>${peso(avgPerTxn)}</b>, with an average of <b>${totalTxn && days.length ? (totalTxn / days.length).toFixed(1) : 0}</b> transactions per day.`);
  if (!insights.length) insights.push('No sales data recorded for this period. Use the stock movement feature to log sales.');
  const insightsHTML = insights.map((txt, i) => `<div class="pr-insight-item"><span class="pr-insight-num">${i + 1}</span><span>${txt}</span></div>`).join('');

  return `<div class="pr-wrap">
    <div class="pr-header">
      <div class="pr-brand">
        <div class="pr-logo-mark">
          <svg width="18" height="18" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="13" stroke="#c17f3a" stroke-width="2"/><path d="M9 14c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5" stroke="#c17f3a" stroke-width="1.8" stroke-linecap="round"/><circle cx="14" cy="14" r="2" fill="#c17f3a"/></svg>
        </div>
        <div><div class="pr-brand-name">OXIS</div><div class="pr-brand-sub">Coffee Inventory System</div></div>
      </div>
      <div class="pr-report-meta"><div class="pr-report-title">Sales Report</div><div class="pr-report-period">${periodLabel(period)}</div></div>
    </div>
    <div class="pr-infobar">
      <div class="pr-infobar-item"><div class="pr-infobar-label">Shop</div><div class="pr-infobar-val">${esc(shop)}</div></div>
      <div class="pr-infobar-item"><div class="pr-infobar-label">Prepared by</div><div class="pr-infobar-val">${esc(name)}</div></div>
      <div class="pr-infobar-item"><div class="pr-infobar-label">Role</div><div class="pr-infobar-val">${esc(role)}</div></div>
      <div class="pr-infobar-item"><div class="pr-infobar-label">Generated</div><div class="pr-infobar-val">${now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}, ${now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</div></div>
      <div class="pr-infobar-item"><div class="pr-infobar-label">Period</div><div class="pr-infobar-val">${cap(period)}</div></div>
    </div>
    <div class="pr-kpi-row">
      <div class="pr-kpi"><div class="pr-kpi-label">Total Revenue</div><div class="pr-kpi-val">${peso(totalRev)}</div><div class="pr-kpi-sub">from sold items</div></div>
      <div class="pr-kpi"><div class="pr-kpi-label">Units Sold</div><div class="pr-kpi-val blue">${totalUnits.toLocaleString()}</div><div class="pr-kpi-sub">total quantity</div></div>
      <div class="pr-kpi"><div class="pr-kpi-label">Transactions</div><div class="pr-kpi-val purple">${totalTxn}</div><div class="pr-kpi-sub">sale movements</div></div>
      <div class="pr-kpi"><div class="pr-kpi-label">Avg per Sale</div><div class="pr-kpi-val green">${peso(avgPerTxn)}</div><div class="pr-kpi-sub">per transaction</div></div>
    </div>
    <div class="pr-section-head"><div class="pr-section-head-dot"></div>Revenue Trend</div>
    <div class="pr-spark-wrap">
      ${spark}
      <div class="pr-spark-labels">
        <span>${days.length ? new Date(days[0]+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'}) : ''}</span>
        <span style="color:#c17f3a;font-weight:600;">Peak: ${days.length ? pesoShort(Math.max(...days.map(d=>byDay[d]))) : '₱0'}</span>
        <span>${days.length ? new Date(days[days.length-1]+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'}) : ''}</span>
      </div>
    </div>
    <div style="display:flex;gap:14px;margin-bottom:14px;align-items:flex-start;">
      <div style="flex:1.6;min-width:0;">
        <div class="pr-section-head"><div class="pr-section-head-dot"></div>Sales by Item</div>
        <table class="pr-table">
          <thead><tr><th style="width:24px;">#</th><th>Item Name</th><th>Category</th><th style="text-align:right;">Qty Sold</th><th style="width:75px;">Trend</th><th style="text-align:right;">Revenue</th><th style="text-align:right;">Share</th><th style="text-align:center;">Txn</th></tr></thead>
          <tbody>${itemRows}</tbody>
          <tfoot>${totalRow}</tfoot>
        </table>
      </div>
      <div style="flex:0.85;min-width:140px;">
        <div class="pr-section-head"><div class="pr-section-head-dot"></div>By Category</div>
        <div style="background:#fdf9f4;border:1px solid #ddd8cf;border-radius:7px;padding:12px 14px;">${catBarsHTML}</div>
      </div>
    </div>
    <div class="pr-section-head"><div class="pr-section-head-dot"></div>Daily Breakdown</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
      <table class="pr-timeline-table">${dayTableHead}<tbody>${dailyLeft}</tbody></table>
      ${rightDays.length ? `<table class="pr-timeline-table">${dayTableHead}<tbody>${dailyRight}</tbody></table>` : '<div></div>'}
    </div>
    <div class="pr-section-head"><div class="pr-section-head-dot"></div>Key Insights</div>
    <div class="pr-insights">${insightsHTML}</div>
    <div class="pr-footer">
      <div class="pr-footer-left"><div class="pr-confidential">Confidential</div><div>${esc(name)} · ${esc(role)} · ${esc(shop)}</div></div>
      <div><svg width="22" height="22" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="13" stroke="#c17f3a" stroke-width="1.5"/><path d="M9 14c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5" stroke="#c17f3a" stroke-width="1.5" stroke-linecap="round"/><circle cx="14" cy="14" r="2" fill="#c17f3a"/></svg></div>
      <div class="pr-footer-right"><div class="pr-footer-brand">OXIS</div><div>Coffee Inventory System</div><div>Generated ${now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</div></div>
    </div>
  </div>`;
}

function openPdfPreview() {
  const period = v('sales-period') || 'month';
  const data   = buildSalesData(period);
  const html   = buildPdfHTML(data);
  document.getElementById('pdf-paper-content').innerHTML = html;
  document.getElementById('print-report-root').innerHTML = html;
  document.getElementById('pdf-preview-subtitle').textContent = `${user?.shop || 'OXIS Coffee'} · ${periodLabel(period)}`;
  document.getElementById('pdf-preview-modal').classList.add('show');
}

function closePdfPreview() { document.getElementById('pdf-preview-modal').classList.remove('show'); }

function triggerPrint() {
  const period = v('sales-period') || 'month';
  const data   = buildSalesData(period);
  document.getElementById('print-report-root').innerHTML = buildPdfHTML(data);
  closePdfPreview();
  setTimeout(() => window.print(), 120);
}

document.getElementById('pdf-preview-modal').addEventListener('click', function(e) {
  if (e.target === this) closePdfPreview();
});

// ── INIT — Wait for Firebase then set up auth listener ────
initTheme();

waitForFirebase(fb => {
  _fb = fb;
  _fb.onAuthStateChanged(_fb.auth, async (firebaseUser) => {
    if (firebaseUser) {
      await launch(firebaseUser);
    } else {
      showLoader(false);
      document.getElementById('auth-wrapper').style.display = 'flex';
      document.getElementById('app-wrapper').style.display  = 'none';
    }
  });
});
