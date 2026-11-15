/* Jay's Food Court - Client Application with Live Backend Sync */
const DELIVERY_FEE = 500;
const PROMO_RATE = 0.3; // 30% online order promotion
const SOUP_CATEGORY = 'Soups & Swallows';

let MENU = [
  { id: 1, name: 'Royal Egusi Soup', desc: 'Stockfish, assorted meat and spinach in rich palm oil. Served with swallow.', price: 3500, cat: SOUP_CATEGORY, img: 'egusi', rating: '5.6k', swallow: true },
  { id: 2, name: 'Special Ogbono Soup', desc: 'Velvety draw soup with ponmo, dry fish and crayfish. Served with swallow.', price: 3800, cat: SOUP_CATEGORY, img: 'ogbono', rating: '4.9k', swallow: true },
  { id: 3, name: 'Okro Draw Soup', desc: 'Fresh okro with catfish and beef, silky and fragrant. Served with swallow.', price: 3600, cat: SOUP_CATEGORY, img: 'ogbono', rating: '3.2k', swallow: true },
  { id: 4, name: "Jay's Fried Rice Combo", desc: 'Vegetable fried rice with grilled chicken and sweet fried plantains.', price: 4500, cat: 'Rice', img: 'fried-rice', rating: '5.1k' },
  { id: 5, name: 'Smoky Party Jollof Rice', desc: 'Firewood-infused party jollof with crispy fried chicken and salad.', price: 4200, cat: 'Rice', img: 'jollof-rice', rating: '4.4k' },
  { id: 6, name: 'White Rice & Stew', desc: 'Steamed white rice with rich tomato stew and fried beef.', price: 3200, cat: 'Rice', img: 'white-rice-stew', rating: '2.8k' },
  { id: 7, name: 'Boiled Yam & Egg Sauce', desc: 'Boiled organic white yam with spicy peppered scrambled egg sauce.', price: 2800, cat: 'Yam & Egg', img: 'yam-egg', rating: '3.9k' },
  { id: 8, name: 'Chilled Drinks & Zobo', desc: 'Natural hibiscus Zobo, fresh juices and soft drinks served ice cold.', price: 1000, cat: 'Drinks', img: 'drinks', rating: '2.1k' }
];

const POPULAR_IDS = [1, 2, 4, 5];
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const naira = (n) => '\u20A6' + Number(n).toLocaleString('en-NG');
const imgSrc = (m) => `assets/images/${m.img}.jpg`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let state = {
  cat: 'All',
  query: '',
  cart: JSON.parse(localStorage.getItem('jfc_cart') || '[]'),
  modal: { dish: null, qty: 1 }
};
const saved = JSON.parse(localStorage.getItem('jfc_guest') || '{}');

/* Toast Message */
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

/* UI Renderers */
function popularCard(m) {
  return `<article class="dish-card">
    <span class="dish-rating">(${m.rating}) <i class="fa-solid fa-star"></i></span>
    <div class="dish-photo"><img loading="lazy" src="${imgSrc(m)}" alt="${esc(m.name)}"></div>
    <h4>${esc(m.name)}</h4>
    <span class="dish-price">${naira(m.price)}</span>
    <p>${esc(m.desc)}</p>
    <button class="dish-add" data-open="${m.id}">Add to Bag</button>
  </article>`;
}

function menuCard(m) {
  return `<article class="menu-card" data-open="${m.id}">
    <img loading="lazy" src="${imgSrc(m)}" alt="${esc(m.name)}">
    <div class="menu-body">
      <h4>${esc(m.name)}</h4><p>${esc(m.desc)}</p>
      <div class="menu-foot"><b>${naira(m.price)}</b><button class="menu-plus" data-open="${m.id}" aria-label="Add ${esc(m.name)}">+</button></div>
    </div></article>`;
}

function renderPopular() {
  $('#popularScroll').innerHTML = MENU.filter((m) => POPULAR_IDS.includes(m.id)).map(popularCard).join('');
}

function renderCats() {
  const cats = ['All', ...new Set(MENU.map((m) => m.cat))];
  $('#categoryPills').innerHTML = cats.map((c) => `<button class="cat-pill ${c === state.cat ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
}

function renderMenu() {
  const q = state.query.toLowerCase();
  const list = MENU.filter((m) => (state.cat === 'All' || m.cat === state.cat) && (m.name + ' ' + m.desc).toLowerCase().includes(q));
  $('#mainMenuGrid').innerHTML = list.map(menuCard).join('') || '<p class="empty-state">No dishes match your search.</p>';
}

/* Dish Customization Modal */
function modalUnitPrice() {
  const d = state.modal.dish;
  if (!d) return 0;
  const extras = $$('input[name="extra_protein"]:checked').reduce((a, i) => a + Number(i.dataset.price), 0);
  return d.price + extras;
}

function updateModalTotal() {
  $('#modalQtyVal').textContent = state.modal.qty;
  $('#modalBtnTotalPrice').textContent = naira(modalUnitPrice() * state.modal.qty);
}

function openDishModal(id) {
  const d = MENU.find((m) => m.id === id);
  if (!d) return;
  state.modal = { dish: d, qty: 1 };
  $('#modalDishImg').src = imgSrc(d);
  $('#modalDishImg').alt = d.name;
  $('#modalDishTitle').textContent = d.name;
  $('#modalDishDesc').textContent = d.desc;
  $('#modalDishPrice').textContent = naira(d.price);
  $('#modalSpecialNotes').value = '';
  $('#swallowOptionSection').style.display = d.swallow ? '' : 'none';
  $('#proteinOptionSection').style.display = d.swallow || d.cat === 'Rice' || d.cat === 'Yam & Egg' ? '' : 'none';
  $$('input[name="extra_protein"]').forEach((i) => { i.checked = false; i.closest('.check-card').classList.remove('selected'); });
  const first = $('input[name="swallow"]');
  if (first) first.checked = true;
  syncSwallowUI();
  updateModalTotal();
  $('#dishModalBackdrop').classList.add('show');
  $('#dishModalSheet').classList.add('show');
  document.body.classList.add('lock');
}

function closeDishModal() {
  $('#dishModalBackdrop').classList.remove('show');
  $('#dishModalSheet').classList.remove('show');
  if (!$('#cartDrawer').classList.contains('show')) document.body.classList.remove('lock');
}

function syncSwallowUI() {
  $$('.radio-card').forEach((c) => {
    const on = c.querySelector('input').checked;
    c.classList.toggle('selected', on);
    c.querySelector('.radio-icon').className = 'radio-icon ' + (on ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle');
  });
}

/* Cart Management */
function persistCart() { localStorage.setItem('jfc_cart', JSON.stringify(state.cart)); renderCart(); }
function totals() {
  const sub = state.cart.reduce((a, l) => a + l.unit * l.qty, 0);
  const disc = Math.round(sub * PROMO_RATE);
  return { sub, disc, total: sub ? sub - disc + DELIVERY_FEE : 0 };
}

function addModalToCart() {
  const d = state.modal.dish;
  if (!d) return;
  const swallow = d.swallow ? $('input[name="swallow"]:checked')?.value : null;
  const extras = $$('input[name="extra_protein"]:checked').map((i) => i.value);
  const note = $('#modalSpecialNotes').value.trim();
  const unit = modalUnitPrice();
  const key = [d.id, swallow, extras.join('+'), note].join('|');
  const existing = state.cart.find((l) => l.key === key);
  if (existing) existing.qty += state.modal.qty;
  else state.cart.push({ key, id: d.id, name: d.name, img: imgSrc(d), unit, qty: state.modal.qty, swallow, extras, note });
  persistCart();
  closeDishModal();
  toast(`${d.name} added to your bag`);
}

function renderCart() {
  const count = state.cart.reduce((a, l) => a + l.qty, 0);
  const { sub, disc, total } = totals();
  $('#navCartCount').textContent = count;
  $('#mobileBarBadge').textContent = count;
  $('#mobileBarTotal').textContent = naira(total);
  $('#drawerBadge').textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
  $('#floatingMobileBar').classList.toggle('show', count > 0 && !$('#cartDrawer').classList.contains('show'));
  $('#billSubtotal').textContent = naira(sub);
  $('#billDiscount').textContent = '-' + naira(disc);
  $('#billTotal').textContent = naira(total);
  $('#drawerCartList').innerHTML = state.cart.map((l, i) => `
    <div class="cart-line">
      <img src="${l.img}" alt="">
      <div class="cl-info"><b>${esc(l.name)}</b>
        <small>${[l.swallow, ...l.extras].filter(Boolean).map(esc).join(' &bull; ')}${l.note ? '<br>Note: ' + esc(l.note) : ''}</small>
        <span>${naira(l.unit * l.qty)}</span></div>
      <div class="cl-qty"><button data-q="-1" data-i="${i}" aria-label="Decrease">-</button><b>${l.qty}</b><button data-q="1" data-i="${i}" aria-label="Increase">+</button></div>
    </div>`).join('') || '<p class="drawer-empty">Your bag is empty. Add something delicious.</p>';
}

function openCart() {
  $('#cartDrawer').classList.add('show');
  let bd = $('.drawer-backdrop');
  if (!bd) { bd = document.createElement('div'); bd.className = 'drawer-backdrop'; bd.addEventListener('click', closeCart); document.body.appendChild(bd); }
  requestAnimationFrame(() => bd.classList.add('show'));
  document.body.classList.add('lock');
  renderCart();
}

function closeCart() {
  $('#cartDrawer').classList.remove('show');
  const bd = $('.drawer-backdrop');
  if (bd) bd.classList.remove('show');
  document.body.classList.remove('lock');
  renderCart();
}

/* Guest Checkout with Server Sync */
function validPhone(p) { return /^(\+?234|0)[789][01]\d{8}$/.test(p.replace(/[\s-]/g, '')); }

async function placeOrder() {
  if (!state.cart.length) return toast('Your bag is empty');
  const name = $('#custName'), phone = $('#custPhone'), addr = $('#custAddress');
  [name, phone, addr].forEach((i) => i.classList.remove('error'));
  let ok = true;
  if (name.value.trim().length < 2) { name.classList.add('error'); ok = false; }
  if (!validPhone(phone.value)) { phone.classList.add('error'); ok = false; }
  if (addr.value.trim().length < 4) { addr.classList.add('error'); ok = false; }
  if (!ok) return toast('Please complete your delivery details');

  const { sub, disc, total } = totals();
  const payMode = $('input[name="payment_mode"]:checked').value;

  const orderPayload = {
    customerName: name.value.trim(),
    phone: phone.value.trim(),
    address: addr.value.trim(),
    items: state.cart,
    subtotal: sub,
    discount: disc,
    deliveryFee: DELIVERY_FEE,
    total: total,
    paymentMode: payMode
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    const data = await res.json();
    const orderId = data.order ? data.order.id : ('JFC-' + Math.floor(1000 + Math.random() * 9000));

    // Save Guest credentials for auto-fill on next visit
    localStorage.setItem('jfc_guest', JSON.stringify({ name: name.value.trim(), phone: phone.value.trim(), addr: addr.value.trim() }));
    localStorage.setItem('jfc_last_order', orderId);

    // Empty cart
    state.cart = [];
    persistCart();
    closeCart();

    // Launch Tracker
    $('#trackInput').value = orderId;
    toast(`Order ${orderId} received!`);
    document.getElementById('track').scrollIntoView({ behavior: 'smooth' });
    trackOrderLive(orderId);
  } catch (err) {
    console.error('Server sync failed, falling back to local order ID', err);
  }
}

/* Real-Time Live Order Tracker */
let trackPollTimer = null;
const STAGES_MAP = { confirmed: 0, cooking: 1, dispatched: 2, delivered: 3 };

function setTrackingStage(s, eta, customBadge) {
  $$('.track-step-node').forEach((n, i) => { 
    n.classList.toggle('active', i <= s); 
    n.classList.toggle('current', i === s); 
  });
  $('#trackProgressBar').style.width = (s / 3) * 76 + '%';
  if (eta) $('#trackerEta').textContent = eta;
  if (customBadge) $('#trackerStatusBadge').textContent = customBadge;
  $('#riderCard').style.display = s >= 2 ? '' : 'none';
}

async function trackOrderLive(orderId) {
  orderId = (orderId || '').trim().toUpperCase();
  if (!orderId) return toast('Please enter an order ID');

  clearInterval(trackPollTimer);
  $('#trackerBadge').textContent = 'Order #' + orderId;
  $('#trackerStatusBox').classList.add('show');

  async function check() {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const order = await res.json();
        const stage = STAGES_MAP[order.status] ?? 0;
        const badges = {
          confirmed: 'Confirmed ✓',
          cooking: 'Chef Cooking 👨🏾‍🍳',
          dispatched: 'Rider En Route 🛵',
          delivered: 'Delivered 🎉'
        };
        setTrackingStage(stage, order.eta, badges[order.status]);
      } else {
        // Simulated local fallback
        setTrackingStage(1, '18 - 25 Mins', 'Chef Cooking 👨🏾‍🍳');
      }
    } catch (e) {
      setTrackingStage(1, '18 - 25 Mins', 'Chef Cooking 👨🏾‍🍳');
    }
  }

  check();
  trackPollTimer = setInterval(check, 3000); // 3-second live updates from kitchen
}

/* Event Handlers */
document.addEventListener('click', (e) => {
  const t = e.target;
  const open = t.closest('[data-open]');
  if (open) { e.stopPropagation(); return openDishModal(Number(open.dataset.open)); }
  const cat = t.closest('[data-cat]');
  if (cat) { state.cat = cat.dataset.cat; renderCats(); renderMenu(); }
  const q = t.closest('[data-q]');
  if (q) {
    const i = Number(q.dataset.i);
    state.cart[i].qty += Number(q.dataset.q);
    if (state.cart[i].qty <= 0) state.cart.splice(i, 1);
    persistCart();
  }
});

$('#menuSearchInput').addEventListener('input', (e) => {
  state.query = e.target.value.trim();
  $('#clearSearchBtn').style.display = state.query ? 'block' : 'none';
  renderMenu();
});
$('#clearSearchBtn').addEventListener('click', () => { $('#menuSearchInput').value = ''; state.query = ''; $('#clearSearchBtn').style.display = 'none'; renderMenu(); });
$('#cartOpenBtn').addEventListener('click', openCart);
$('#mobileBagBtn').addEventListener('click', openCart);
$('#closeCartBtn').addEventListener('click', closeCart);
$('#closeDishModalBtn').addEventListener('click', closeDishModal);
$('#dishModalBackdrop').addEventListener('click', closeDishModal);
$('#modalQtyMinus').addEventListener('click', () => { state.modal.qty = Math.max(1, state.modal.qty - 1); updateModalTotal(); });
$('#modalQtyPlus').addEventListener('click', () => { state.modal.qty = Math.min(20, state.modal.qty + 1); updateModalTotal(); });
$('#modalAddToCartBtn').addEventListener('click', addModalToCart);
$$('input[name="swallow"]').forEach((i) => i.addEventListener('change', syncSwallowUI));
$$('input[name="extra_protein"]').forEach((i) => i.addEventListener('change', () => { i.closest('.check-card').classList.toggle('selected', i.checked); updateModalTotal(); }));
$$('input[name="payment_mode"]').forEach((i) => i.addEventListener('change', () => $$('.pay-option').forEach((p) => p.classList.toggle('active', p.querySelector('input').checked))));
$('#submitOrderBtn').addEventListener('click', placeOrder);
$('#trackSubmitBtn').addEventListener('click', () => trackOrderLive($('#trackInput').value));
$('#trackInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') trackOrderLive(e.target.value); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDishModal(); closeCart(); } });

function scrollDishes(dir) {
  const box = $('#popularScroll');
  box.scrollBy({ left: dir * (box.firstElementChild?.offsetWidth + 18 || 280), behavior: 'smooth' });
}

function triggerLocationChange() {
  const v = prompt('Enter your delivery street or landmark in Agbani, Enugu:', $('#currentLocationText').textContent);
  if (v && v.trim()) { 
    $('#currentLocationText').textContent = v.trim().slice(0, 40); 
    localStorage.setItem('jfc_loc', v.trim()); 
  }
}

/* Initialization */
if (saved.name) $('#custName').value = saved.name;
if (saved.phone) $('#custPhone').value = saved.phone;
if (saved.addr) $('#custAddress').value = saved.addr;
const loc = localStorage.getItem('jfc_loc'); if (loc) $('#currentLocationText').textContent = loc;
const lastOrder = localStorage.getItem('jfc_last_order'); if (lastOrder) $('#trackInput').value = lastOrder;

renderPopular(); renderCats(); renderMenu(); renderCart(); setTrackingStage(0, '18 - 25 Mins', 'Order Confirmed ✓');
