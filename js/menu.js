// Menu page — cart + order placement

const cart = {};
let menuItems = [];
let currentCategory = 'all';

document.addEventListener('DOMContentLoaded', () => {
  captureTableFromUrl();
  const tableNumber = parseTableNumber();

  if (!tableNumber) {
    window.location.href = 'index.html';
    return;
  }

  initMenu(tableNumber);
});

function initMenu(tableNumber) {
  updateTableBadge('tableBadge');
  document.getElementById('homeLink').href = getTableIndexUrl();

  loadMenu();
  setupTabs();
  setupCartUI();
}

async function loadMenu() {
  const grid = document.getElementById('menuGrid');
  try {
    menuItems = await getMenuItems();
    if (menuItems.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="icon">🍽️</div><p>No menu items yet. Ask the admin to add items.</p></div>';
      return;
    }
    renderMenu();
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<div class="empty-state"><p>Failed to load menu. Check Firebase configuration.</p></div>';
  }
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      renderMenu();
    });
  });
}

function renderMenu() {
  const grid = document.getElementById('menuGrid');
  const filtered = currentCategory === 'all'
    ? menuItems
    : menuItems.filter(item => item.category === currentCategory);

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>No items in this category.</p></div>';
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const qty = cart[item.id]?.qty || 0;
    const emoji = item.category === 'veg' ? '🥗' : '🍗';
    const imgContent = item.image
      ? `<img src="${item.image}" alt="${item.name}" onerror="this.parentElement.innerHTML='${emoji}'">`
      : emoji;

    return `
      <div class="menu-card" data-id="${item.id}">
        <div class="menu-card-img">${imgContent}</div>
        <div class="menu-card-body">
          <div class="menu-card-top">
            <h3>${item.name}</h3>
            <span class="category-tag ${item.category}">${item.category}</span>
          </div>
          <p class="description">${item.description || ''}</p>
          <div class="menu-card-footer">
            <span class="price">${formatCurrency(item.price)}</span>
            ${qty > 0 ? `
              <div class="qty-control">
                <button class="qty-btn" onclick="changeQty('${item.id}', -1)">−</button>
                <span class="qty-value">${qty}</span>
                <button class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
              </div>
            ` : `
              <button class="btn btn-primary btn-sm" onclick="changeQty('${item.id}', 1)">Add to Cart</button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function changeQty(itemId, delta) {
  const item = menuItems.find(m => m.id === itemId);
  if (!item) return;

  if (!cart[itemId]) {
    cart[itemId] = { ...item, qty: 0 };
  }
  cart[itemId].qty += delta;

  if (cart[itemId].qty <= 0) {
    delete cart[itemId];
  }

  renderMenu();
  updateCartBar();
}

function updateCartBar() {
  const items = Object.values(cart);
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  document.getElementById('cartCount').textContent = count;
  document.getElementById('cartTotal').textContent = formatCurrency(total);
  document.getElementById('cartBar').classList.toggle('visible', count > 0);
}

function setupCartUI() {
  document.getElementById('viewCartBtn').addEventListener('click', openCart);
  document.getElementById('closeCart').addEventListener('click', closeCart);
  document.getElementById('cartModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCart();
  });
  document.getElementById('placeOrderBtn').addEventListener('click', placeOrder);
}

function openCart() {
  const items = Object.values(cart);
  if (items.length === 0) return;

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  document.getElementById('cartItems').innerHTML = items.map(item => `
    <div class="cart-item">
      <div>
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${formatCurrency(item.price)} × ${item.qty}</div>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="changeQty('${item.id}', -1); openCart();">−</button>
        <span class="qty-value">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty('${item.id}', 1); openCart();">+</button>
      </div>
    </div>
  `).join('');

  document.getElementById('cartGrandTotal').textContent = formatCurrency(total);
  document.getElementById('cartModal').classList.add('open');
}

function closeCart() {
  document.getElementById('cartModal').classList.remove('open');
}

async function placeOrder() {
  const items = Object.values(cart);
  if (items.length === 0) return;

  const tableNumber = parseTableNumber();
  if (!tableNumber) return;

  const btn = document.getElementById('placeOrderBtn');
  btn.disabled = true;
  btn.textContent = 'Placing Order...';

  const orderItems = items.map(i => ({
    itemId: i.id,
    name: i.name,
    qty: i.qty,
    price: i.price,
    category: i.category
  }));
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const specialInstructions = document.getElementById('specialInstructions').value.trim();

  try {
    const orderId = await addOrder({
      tableNumber,
      tableId: 'table_' + tableNumber,
      items: orderItems,
      total,
      specialInstructions: specialInstructions || ''
    });

    sessionStorage.setItem('lastOrderId', orderId);
    Object.keys(cart).forEach(k => delete cart[k]);
    window.location.href = getTableOrderUrl();
  } catch (err) {
    console.error(err);
    showToast('Failed to place order. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Place Order';
  }
}

window.changeQty = changeQty;
window.openCart = openCart;
