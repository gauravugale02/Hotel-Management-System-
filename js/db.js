// Firestore CRUD helpers for Hotel Shauryawada

function sortByCreatedAt(items) {
  return items.sort((a, b) => {
    const aT = a.createdAt?.seconds || a.createdAt?.toMillis?.() / 1000 || 0;
    const bT = b.createdAt?.seconds || b.createdAt?.toMillis?.() / 1000 || 0;
    return bT - aT;
  });
}

function getFirestoreErrorMessage(err) {
  const code = err?.code || '';
  const messages = {
    'permission-denied': 'Permission denied. Sign in as admin and update Firestore security rules.',
    'unauthenticated': 'Not signed in. Please log in again.',
    'unavailable': 'Firestore unavailable. Check your internet connection.',
    'failed-precondition': 'Firestore index required. Check the browser console for a setup link.',
    'not-found': 'Document not found.',
  };
  return messages[code] || err?.message || 'Operation failed';
}

// ── Menu Items ──

async function getMenuItems() {
  const snapshot = await db.collection('menuItems').get();
  return sortByCreatedAt(
    snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(item => item.available !== false)
  );
}

async function getAllMenuItems() {
  const snapshot = await db.collection('menuItems').get();
  return sortByCreatedAt(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}

async function addMenuItem(data) {
  return db.collection('menuItems').add({
    ...data,
    available: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function updateMenuItem(id, data) {
  return db.collection('menuItems').doc(id).update(data);
}

async function deleteMenuItem(id) {
  return db.collection('menuItems').doc(id).delete();
}

function listenToMenuItems(callback, onError) {
  return db.collection('menuItems').onSnapshot(
    snapshot => {
      const items = sortByCreatedAt(
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      );
      callback(items);
    },
    err => {
      console.error('Menu listener error:', err);
      if (onError) onError(err);
    }
  );
}

// ── Tables ──

async function getTables() {
  const snapshot = await db.collection('tables').get();
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.tableNumber || 0) - (b.tableNumber || 0));
}

async function addTable(data) {
  const qrUrl = typeof getTableQrUrl === 'function'
    ? getTableQrUrl(data.tableNumber)
    : `${window.location.origin}/menu.html?table=${data.tableNumber}`;
  return db.collection('tables').add({
    ...data,
    status: 'available',
    qrUrl,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function updateTable(id, data) {
  return db.collection('tables').doc(id).update(data);
}

async function deleteTable(id) {
  return db.collection('tables').doc(id).delete();
}

function listenToTables(callback, onError) {
  return db.collection('tables').onSnapshot(
    snapshot => {
      const tables = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (a.tableNumber || 0) - (b.tableNumber || 0));
      callback(tables);
    },
    err => {
      console.error('Tables listener error:', err);
      if (onError) onError(err);
    }
  );
}

// ── Orders ──

async function addOrder(orderData) {
  const docRef = await db.collection('orders').add({
    ...orderData,
    status: 'pending',
    paymentStatus: 'unpaid',
    orderedAt: firebase.firestore.FieldValue.serverTimestamp(),
    acceptedAt: null,
    completedAt: null
  });
  return docRef.id;
}

async function getOrder(orderId) {
  const doc = await db.collection('orders').doc(orderId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function updateOrderStatus(orderId, status) {
  const updates = { status };
  if (status === 'accepted') {
    updates.acceptedAt = firebase.firestore.FieldValue.serverTimestamp();
  }
  if (status === 'completed') {
    updates.completedAt = firebase.firestore.FieldValue.serverTimestamp();
  }
  return db.collection('orders').doc(orderId).update(updates);
}

async function updateOrderPayment(orderId, paymentStatus) {
  return db.collection('orders').doc(orderId).update({ paymentStatus });
}

function listenToOrder(orderId, callback) {
  return db.collection('orders').doc(orderId)
    .onSnapshot(doc => {
      if (doc.exists) {
        callback({ id: doc.id, ...doc.data() });
      }
    });
}

function listenToActiveOrders(callback) {
  return db.collection('orders')
    .where('status', 'in', ['pending', 'accepted', 'preparing', 'ready'])
    .onSnapshot(snapshot => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      orders.sort((a, b) => {
        const aTime = a.orderedAt?.seconds || 0;
        const bTime = b.orderedAt?.seconds || 0;
        return aTime - bTime;
      });
      callback(orders);
    });
}

function listenToAllOrders(callback, onError) {
  return db.collection('orders').onSnapshot(
    snapshot => {
      const orders = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const aT = a.orderedAt?.seconds || 0;
          const bT = b.orderedAt?.seconds || 0;
          return bT - aT;
        })
        .slice(0, 100);
      callback(orders);
    },
    err => {
      console.error('Orders listener error:', err);
      if (onError) onError(err);
    }
  );
}

async function getOrdersToday() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const snapshot = await db.collection('orders')
    .where('orderedAt', '>=', firebase.firestore.Timestamp.fromDate(startOfDay))
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ── Transactions ──

async function addTransaction(data) {
  return db.collection('transactions').add({
    ...data,
    paidAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function getTransactions(startDate, endDate) {
  let query = db.collection('transactions').orderBy('paidAt', 'desc');
  if (startDate) {
    query = query.where('paidAt', '>=', firebase.firestore.Timestamp.fromDate(startDate));
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    query = query.where('paidAt', '<=', firebase.firestore.Timestamp.fromDate(end));
  }
  const snapshot = await query.limit(200).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function listenToTransactions(callback) {
  return db.collection('transactions')
    .orderBy('paidAt', 'desc')
    .limit(100)
    .onSnapshot(snapshot => {
      const txns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(txns);
    });
}

// ── Dashboard Stats ──

async function getDashboardStats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const ts = firebase.firestore.Timestamp.fromDate(startOfDay);

  const [ordersSnap, tablesSnap, txnsSnap] = await Promise.all([
    db.collection('orders').where('orderedAt', '>=', ts).get(),
    db.collection('tables').get(),
    db.collection('transactions').where('paidAt', '>=', ts).get()
  ]);

  const orders = ordersSnap.docs.map(d => d.data());
  const tables = tablesSnap.docs.map(d => d.data());
  const txns = txnsSnap.docs.map(d => d.data());

  const revenue = txns.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
  const pending = orders.filter(o => o.status === 'pending').length;
  const occupied = tables.filter(t => t.status === 'occupied').length;

  return {
    ordersToday: orders.length,
    revenue,
    pendingOrders: pending,
    tablesOccupied: occupied,
    totalTables: tables.length
  };
}

// ── Utilities ──

function formatCurrency(amount) {
  return '₹' + (amount || 0).toLocaleString('en-IN');
}

function formatTime(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeElapsed(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
