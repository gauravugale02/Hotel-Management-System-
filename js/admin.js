// Admin Dashboard — full SPA logic

let allOrders = [];
let menuUnsubscribe = null;
let ordersUnsubscribe = null;

document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(user => {
    if (user) {
      showAdmin(user);
    } else {
      showLogin();
    }
  });

  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  setupNavigation();
  setupMenuForm();
  setupTables();
  setupQR();
  setupTransactions();
  setupOrdersFilter();
});

// ── Auth ──

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminApp').style.display = 'none';
  if (menuUnsubscribe) { menuUnsubscribe(); menuUnsubscribe = null; }
  if (ordersUnsubscribe) { ordersUnsubscribe(); ordersUnsubscribe = null; }
}

function showAdmin(user) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminApp').style.display = 'flex';
  document.getElementById('adminEmail').textContent = user.email;
  loadDashboard();
  startMenuListener();
  startOrdersListener();
  loadTables();
  loadTransactions();
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');

  try {
    await auth.signInWithEmailAndPassword(email, password);
    errorEl.style.display = 'none';
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
}

async function handleLogout() {
  await auth.signOut();
}

// ── Navigation ──

function setupNavigation() {
  document.querySelectorAll('.admin-nav button[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      document.querySelectorAll('.admin-nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      document.getElementById('section-' + section).classList.add('active');

      if (section === 'dashboard') loadDashboard();
      if (section === 'tables') loadTables();
      if (section === 'transactions') loadTransactions();
    });
  });
}

// ── Dashboard ──

async function loadDashboard() {
  try {
    const stats = await getDashboardStats();
    document.getElementById('statOrders').textContent = stats.ordersToday;
    document.getElementById('statRevenue').textContent = formatCurrency(stats.revenue);
    document.getElementById('statPending').textContent = stats.pendingOrders;
    document.getElementById('statTables').textContent = `${stats.tablesOccupied} / ${stats.totalTables}`;
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

// ── Menu Management ──

function setupMenuForm() {
  document.getElementById('saveMenuBtn').addEventListener('click', saveMenuItem);
  document.getElementById('cancelMenuBtn').addEventListener('click', resetMenuForm);
}

function startMenuListener() {
  if (menuUnsubscribe) menuUnsubscribe();
  menuUnsubscribe = listenToMenuItems(renderMenuTable, err => {
    showToast(getFirestoreErrorMessage(err), 'error');
  });
}

function requireAuth() {
  if (!auth.currentUser) {
    showToast('Session expired. Please sign in again.', 'error');
    return false;
  }
  return true;
}

function renderMenuTable(items) {
  const tbody = document.getElementById('menuTableBody');
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No menu items yet</td></tr>';
    return;
  }
  tbody.innerHTML = items.map(item => `
    <tr>
      <td><strong>${item.name}</strong></td>
      <td><span class="category-tag ${item.category}">${item.category}</span></td>
      <td>${formatCurrency(item.price)}</td>
      <td>${item.available !== false ? '✅' : '❌'}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editMenuItem('${item.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="removeMenuItem('${item.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function saveMenuItem() {
  if (!requireAuth()) return;

  const name = document.getElementById('menuName').value.trim();
  const price = parseFloat(document.getElementById('menuPrice').value);
  const description = document.getElementById('menuDescription').value.trim();
  const category = document.getElementById('menuCategory').value;
  let image = document.getElementById('menuImage').value.trim();
  const editId = document.getElementById('menuEditId').value;
  const btn = document.getElementById('saveMenuBtn');
  const fileInput = document.getElementById('menuImageFile');
  const uploadStatus = document.getElementById('uploadStatus');
  const menuError = document.getElementById('menuError');

  if (menuError) {
    menuError.style.display = 'none';
    menuError.textContent = '';
  }

  if (!name || !price || price <= 0 || Number.isNaN(price)) {
    showToast('Enter a valid name and price', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    // If a new image file is selected, upload it first
    if (fileInput && fileInput.files.length > 0) {
      let file = fileInput.files[0];
      
      uploadStatus.style.display = 'block';
      uploadStatus.textContent = 'Compressing image...';
      console.log('Original file size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

      try {
        // Compress the image client-side to keep uploads super fast
        const compressedBlob = await compressImage(file, 800, 800, 0.7);
        console.log('Compressed file size:', (compressedBlob.size / 1024 / 1024).toFixed(2), 'MB');
        file = compressedBlob;
      } catch (compressionErr) {
        console.warn('Compression failed, uploading original:', compressionErr);
      }

      const storageRef = storage.ref(`menu_items/${Date.now()}_menu_image.jpg`);
      uploadStatus.textContent = 'Uploading image... 0%';

      try {
        const uploadTask = storageRef.put(file, { contentType: 'image/jpeg' });

        // Wrap in a promise to wait for completion
        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed', 
            (snapshot) => {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              uploadStatus.textContent = `Uploading image... ${progress}%`;
            }, 
            (error) => {
              reject(error);
            }, 
            async () => {
              try {
                image = await uploadTask.snapshot.ref.getDownloadURL();
                uploadStatus.textContent = 'Image uploaded successfully!';
                resolve();
              } catch (err) {
                reject(err);
              }
            }
          );
        });
      } catch (uploadErr) {
        console.warn('Firebase Storage upload failed/blocked by CORS. Falling back to direct Base64 storage...', uploadErr);
        uploadStatus.textContent = 'Saving image locally...';
        
        // Fallback: Convert compressed blob directly to Base64
        image = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
        });
        uploadStatus.textContent = 'Image prepared!';
      }
    }

    const data = { name, price, description, category };
    if (image) data.image = image;

    if (editId) {
      await updateMenuItem(editId, data);
      showToast('Menu item updated', 'success');
    } else {
      await addMenuItem(data);
      showToast('Menu item added', 'success');
    }
    resetMenuForm();
  } catch (err) {
    console.error('Save menu item error:', err);
    if (menuError) {
      menuError.style.display = 'block';
      menuError.textContent = err.message || getFirestoreErrorMessage(err);
    }
    showToast(err.message || getFirestoreErrorMessage(err), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Item';
  }
}

async function editMenuItem(id) {
  const items = await getAllMenuItems();
  const item = items.find(i => i.id === id);
  if (!item) return;

  document.getElementById('menuEditId').value = id;
  document.getElementById('menuName').value = item.name;
  document.getElementById('menuPrice').value = item.price;
  document.getElementById('menuDescription').value = item.description || '';
  document.getElementById('menuCategory').value = item.category;
  document.getElementById('menuImage').value = item.image || '';
  document.getElementById('menuFormTitle').textContent = 'Edit Menu Item';
  document.getElementById('cancelMenuBtn').style.display = 'inline-flex';
  document.getElementById('menuForm').scrollIntoView({ behavior: 'smooth' });
}

async function removeMenuItem(id) {
  if (!requireAuth() || !confirm('Delete this menu item?')) return;
  try {
    await deleteMenuItem(id);
    showToast('Menu item deleted', 'success');
  } catch (err) {
    console.error(err);
    showToast(getFirestoreErrorMessage(err), 'error');
  }
}

function resetMenuForm() {
  document.getElementById('menuEditId').value = '';
  document.getElementById('menuName').value = '';
  document.getElementById('menuPrice').value = '';
  document.getElementById('menuDescription').value = '';
  document.getElementById('menuCategory').value = 'veg';
  document.getElementById('menuImage').value = '';
  
  const fileInput = document.getElementById('menuImageFile');
  if (fileInput) fileInput.value = '';
  
  const uploadStatus = document.getElementById('uploadStatus');
  if (uploadStatus) {
    uploadStatus.textContent = '';
    uploadStatus.style.display = 'none';
  }

  const menuError = document.getElementById('menuError');
  if (menuError) {
    menuError.textContent = '';
    menuError.style.display = 'none';
  }

  document.getElementById('menuFormTitle').textContent = 'Add Menu Item';
  document.getElementById('cancelMenuBtn').style.display = 'none';
}

// ── Orders ──

function startOrdersListener() {
  if (ordersUnsubscribe) ordersUnsubscribe();
  ordersUnsubscribe = listenToAllOrders(orders => {
    allOrders = orders;
    renderOrdersTable();
    loadDashboard();
  }, err => {
    console.error('Orders listener error:', err);
  });
}

function setupOrdersFilter() {
  document.getElementById('orderStatusFilter').addEventListener('change', renderOrdersTable);
}

function renderOrdersTable() {
  const filter = document.getElementById('orderStatusFilter').value;
  const orders = filter === 'all' ? allOrders : allOrders.filter(o => o.status === filter);
  const tbody = document.getElementById('ordersTableBody');

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">No orders found</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(order => {
    const itemsSummary = order.items.map(i => `${i.qty}× ${i.name}`).join(', ');
  const actions = getOrderActions(order);
    return `
      <tr>
        <td><strong>Table ${order.tableNumber}</strong></td>
        <td style="max-width:200px;font-size:0.85rem;">${itemsSummary}</td>
        <td>${formatCurrency(order.total)}</td>
        <td><span class="status-badge ${order.status}">${order.status}</span></td>
        <td><span class="status-badge ${order.paymentStatus}">${order.paymentStatus}</span></td>
        <td>${formatTime(order.orderedAt)}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');
}

function getOrderActions(order) {
  let html = '';
  if (order.status !== 'completed') {
    html += `<button class="btn btn-sm btn-success" onclick="completeOrder('${order.id}')">Complete</button> `;
  }
  if (order.paymentStatus === 'unpaid' && order.status === 'completed') {
    html += `<button class="btn btn-sm btn-accent" onclick="markPaid('${order.id}', 'cash')">Mark Paid</button>`;
  }
  return html || '—';
}

async function completeOrder(orderId) {
  if (!requireAuth()) return;
  try {
    await updateOrderStatus(orderId, 'completed');
    showToast('Order completed', 'success');
  } catch (err) {
    console.error(err);
    showToast(getFirestoreErrorMessage(err), 'error');
  }
}

async function markPaid(orderId, method) {
  if (!requireAuth()) return;
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  try {
    await updateOrderPayment(orderId, 'paid');
    await addTransaction({
      orderId,
      tableNumber: order.tableNumber,
      items: order.items,
      totalAmount: order.total,
      paymentMethod: method,
      processedBy: auth.currentUser?.email || 'admin'
    });
    showToast('Payment recorded', 'success');
  } catch (err) {
    console.error(err);
    showToast(getFirestoreErrorMessage(err), 'error');
  }
}

// ── Tables ──

function setupTables() {
  document.getElementById('addTableBtn').addEventListener('click', addNewTable);
}

async function loadTables() {
  try {
    const tables = await getTables();
    renderTablesTable(tables);
    populateQRSelect(tables);
  } catch (err) {
    console.error(err);
  }
}

function renderTablesTable(tables) {
  const tbody = document.getElementById('tablesTableBody');
  if (tables.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No tables yet</td></tr>';
    return;
  }
  tbody.innerHTML = tables.map(t => `
    <tr>
      <td>${t.tableNumber}</td>
      <td>${t.name || 'Table ' + t.tableNumber}</td>
      <td>${t.capacity}</td>
      <td><span class="status-badge ${t.status === 'occupied' ? 'pending' : 'ready'}">${t.status}</span></td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="removeTable('${t.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function addNewTable() {
  if (!requireAuth()) return;

  const tableNumber = parseInt(document.getElementById('tableNumber').value);
  const capacity = parseInt(document.getElementById('tableCapacity').value) || 4;

  if (!tableNumber || tableNumber <= 0) {
    showToast('Enter a valid table number', 'error');
    return;
  }

  try {
    await addTable({
      tableNumber,
      name: 'Table ' + tableNumber,
      capacity
    });
    showToast('Table added', 'success');
    document.getElementById('tableNumber').value = '';
    loadTables();
  } catch (err) {
    console.error(err);
    showToast(getFirestoreErrorMessage(err), 'error');
  }
}

async function removeTable(id) {
  if (!requireAuth() || !confirm('Delete this table?')) return;
  try {
    await deleteTable(id);
    showToast('Table deleted', 'success');
    loadTables();
  } catch (err) {
    console.error(err);
    showToast(getFirestoreErrorMessage(err), 'error');
  }
}

// ── QR Codes ──

let qrInstance = null;

function setupQR() {
  document.getElementById('qrTableSelect').addEventListener('change', generateQR);
}

function populateQRSelect(tables) {
  const select = document.getElementById('qrTableSelect');
  const current = select.value;
  select.innerHTML = '<option value="">— Select a table —</option>' +
    tables.map(t => `<option value="${t.tableNumber}" data-url="${t.qrUrl || ''}">Table ${t.tableNumber}</option>`).join('');
  if (current) select.value = current;
}

function generateQR() {
  const select = document.getElementById('qrTableSelect');
  const tableNumber = select.value;
  const preview = document.getElementById('qrPreview');

  if (!tableNumber) {
    preview.innerHTML = '<p style="color:var(--text-muted);">Select a table to generate QR code</p>';
    return;
  }

  const url = getTableQrUrl(tableNumber);

  preview.innerHTML =
    '<div id="qrCode"></div>' +
    '<p style="margin:0.75rem 0 0.25rem;font-size:0.85rem;word-break:break-all;"><strong>Scan URL:</strong><br>' + url + '</p>' +
    '<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.75rem;">Phones must use your LAN IP, not localhost. Set <code>APP_BASE_URL</code> in <code>js/firebase-config.js</code>.</p>' +
    '<button class="btn btn-primary btn-sm" id="downloadQrBtn">Download PNG</button>';

  if (qrInstance) {
    document.getElementById('qrCode').innerHTML = '';
  }

  qrInstance = new QRCode(document.getElementById('qrCode'), {
    text: url,
    width: 200,
    height: 200,
    colorDark: '#7B1A2B',
    colorLight: '#FAF4E8',
    correctLevel: QRCode.CorrectLevel.H
  });

  document.getElementById('downloadQrBtn').addEventListener('click', () => {
    const canvas = document.querySelector('#qrCode canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `table-${tableNumber}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

// ── Transactions ──

function setupTransactions() {
  document.getElementById('filterTxnBtn').addEventListener('click', loadTransactions);
}

async function loadTransactions() {
  const start = document.getElementById('txnStartDate').value;
  const end = document.getElementById('txnEndDate').value;
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;

  try {
    const txns = await getTransactions(startDate, endDate);
    renderTransactions(txns);
  } catch (err) {
    console.error(err);
    showToast(getFirestoreErrorMessage(err), 'error');
  }
}

function renderTransactions(txns) {
  const tbody = document.getElementById('txnTableBody');
  if (txns.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No transactions found</td></tr>';
    return;
  }
  tbody.innerHTML = txns.map(t => {
    const itemsSummary = (t.items || []).map(i => `${i.qty}× ${i.name}`).join(', ');
    return `
      <tr>
        <td>${formatDate(t.paidAt)} ${formatTime(t.paidAt)}</td>
        <td>Table ${t.tableNumber}</td>
        <td style="max-width:200px;font-size:0.85rem;">${itemsSummary}</td>
        <td><strong>${formatCurrency(t.totalAmount)}</strong></td>
        <td>${t.paymentMethod}</td>
        <td>${t.processedBy || '—'}</td>
      </tr>
    `;
  }).join('');
}

window.editMenuItem = editMenuItem;
window.removeMenuItem = removeMenuItem;
window.completeOrder = completeOrder;
window.markPaid = markPaid;
window.removeTable = removeTable;

function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas compression returned empty blob.'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
