// Kitchen Display — real-time order management

let knownOrderIds = new Set();
let audioCtx = null;

document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);
  startListening();
});

function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function startListening() {
  listenToActiveOrders(orders => {
    const newOrders = orders.filter(o => !knownOrderIds.has(o.id) && o.status === 'pending');
    if (knownOrderIds.size > 0 && newOrders.length > 0) {
      playPing();
    }
    orders.forEach(o => knownOrderIds.add(o.id));
    renderOrders(orders);
  });
}

function playPing() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.stop(audioCtx.currentTime + 0.5);
  } catch (e) { /* audio not available */ }
}

function renderOrders(orders) {
  const grid = document.getElementById('kitchenGrid');

  if (orders.length === 0) {
    grid.innerHTML = `
      <div class="kitchen-empty" style="grid-column:1/-1;">
        <div class="icon">✨</div>
        <h3>All caught up!</h3>
        <p>No active orders right now.</p>
      </div>`;
    return;
  }

  grid.innerHTML = orders.map(order => {
    const status = order.status;
    const actionBtn = getActionButton(order);

    return `
      <div class="kitchen-order status-${status}" id="order-${order.id}">
        <div class="kitchen-order-header">
          <h3>Table ${order.tableNumber}</h3>
          <span class="order-time">${timeElapsed(order.orderedAt)}</span>
        </div>
        <div class="kitchen-order-body">
          ${order.items.map(item => `
            <div class="kitchen-item">
              <span><span class="qty">${item.qty}×</span> ${item.name}</span>
              <span class="category-tag ${item.category}">${item.category}</span>
            </div>
          `).join('')}
          <div style="margin-top:0.75rem;font-weight:700;color:var(--primary);">
            Total: ${formatCurrency(order.total)}
          </div>
          ${order.specialInstructions ? `
            <div class="special-note">📝 ${order.specialInstructions}</div>
          ` : ''}
        </div>
        <div class="kitchen-order-actions">
          ${actionBtn}
        </div>
      </div>
    `;
  }).join('');
}

function getActionButton(order) {
  switch (order.status) {
    case 'pending':
      return `<button class="btn btn-warning btn-block" onclick="handleStatus('${order.id}', 'accepted')">Accept Order</button>`;
    case 'accepted':
      return `<button class="btn btn-warning btn-block" onclick="handleStatus('${order.id}', 'preparing')">Mark Preparing</button>`;
    case 'preparing':
      return `<button class="btn btn-success btn-block" onclick="handleStatus('${order.id}', 'ready')">Mark Ready</button>`;
    case 'ready':
      return `<button class="btn btn-primary btn-block" onclick="handleStatus('${order.id}', 'completed')">Complete Order</button>`;
    default:
      return '';
  }
}

async function handleStatus(orderId, status) {
  try {
    await updateOrderStatus(orderId, status);
    showToast(`Order marked as ${status}`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to update order', 'error');
  }
}
