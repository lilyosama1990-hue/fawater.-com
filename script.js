const itemsContainer = document.getElementById('itemsContainer');
const addItemBtn = document.getElementById('addItemBtn');
const printBtn = document.getElementById('printBtn');
const directPrintBtn = document.getElementById('directPrintBtn');
const saveAndPrintBtn = document.getElementById('saveAndPrintBtn');
const saveDataBtn = document.getElementById('saveDataBtn');
const resetBtn = document.getElementById('resetBtn');
const themeColorInput = document.getElementById('themeColor');
const logoInput = document.getElementById('logoInput');

const tabEditorBtn = document.getElementById('tabEditorBtn');
const tabPreviewBtn = document.getElementById('tabPreviewBtn');
const goPreviewBtn = document.getElementById('goPreviewBtn');
const backEditBtn = document.getElementById('backEditBtn');
const editorPanel = document.getElementById('editorPanel');
const previewPanel = document.getElementById('previewPanel');

const STORAGE_KEY = 'zatca_invoice_saved_v1';

let items = [
  { name: 'خدمة تصميم وتطوير موقع إلكتروني', qty: 1, price: 1000 },
  { name: 'إعداد واستضافة ودعم فني', qty: 1, price: 200 }
];

function setDefaultDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('invoiceDate').value = now.toISOString().slice(0, 16);
}

function generateZatcaTLV(sellerName, vatNumber, timestampISO, totalWithVat, vatAmount) {
  const encoder = new TextEncoder();

  function encodeField(tag, value) {
    const valBytes = encoder.encode(String(value));
    const result = new Uint8Array(2 + valBytes.length);
    result[0] = tag;
    result[1] = valBytes.length;
    result.set(valBytes, 2);
    return result;
  }

  const parts = [
    encodeField(1, sellerName),
    encodeField(2, vatNumber),
    encodeField(3, timestampISO),
    encodeField(4, Number(totalWithVat).toFixed(2)),
    encodeField(5, Number(vatAmount).toFixed(2))
  ];

  const totalLength = parts.reduce((sum, arr) => sum + arr.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }

  let binary = '';
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

function renderQRCode(tlvBase64) {
  const qrContainer = document.getElementById('qrcode');
  qrContainer.innerHTML = '';
  new QRCode(qrContainer, {
    text: tlvBase64,
    width: 102,
    height: 102,
    correctLevel: QRCode.CorrectLevel.M
  });
}

function renderEditorItems() {
  itemsContainer.innerHTML = '';
  items.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'item-row-card';
    div.innerHTML = `
      <div class="item-grid">
        <div class="form-group" style="margin-bottom:0">
          <label>الصنف / الخدمة</label>
          <input type="text" data-index="${index}" data-field="name" value="${item.name}" />
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>الكمية</label>
          <input type="number" min="1" step="1" data-index="${index}" data-field="qty" value="${item.qty}" />
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>السعر (قبل الضريبة)</label>
          <input type="number" min="0" step="0.01" data-index="${index}" data-field="price" value="${item.price}" />
        </div>
        <button type="button" class="btn-danger" data-remove="${index}" title="حذف">✕</button>
      </div>
    `;
    itemsContainer.appendChild(div);
  });
}

function updateInvoice() {
  const sellerName = document.getElementById('sellerName').value.trim() || 'المنشأة';
  const vatNumber = document.getElementById('vatNumber').value.trim() || '300000000000003';
  const crNumber = document.getElementById('crNumber').value.trim();
  const sellerAddress = document.getElementById('sellerAddress').value.trim();
  const invoiceNumber = document.getElementById('invoiceNumber').value.trim() || 'INV-001';
  const rawDate = document.getElementById('invoiceDate').value;
  const buyerName = document.getElementById('buyerName').value.trim() || 'عميل نقدي';
  const buyerVat = document.getElementById('buyerVat').value.trim();
  const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
  const notes = document.getElementById('invoiceNotes').value.trim() || 'شكراً لتعاملكم معنا';
  const color = themeColorInput.value || '#0f294a';

  document.documentElement.style.setProperty('--primary', color);

  document.getElementById('prevSellerName').textContent = sellerName;
  document.getElementById('prevVatNumber').textContent = vatNumber;
  document.getElementById('prevSellerAddress').textContent = sellerAddress;
  document.getElementById('prevInvoiceNumber').textContent = invoiceNumber;
  document.getElementById('prevBuyerName').textContent = buyerName;
  document.getElementById('prevTaxRate').textContent = taxRate;
  document.getElementById('prevNotes').textContent = notes;

  const crRow = document.getElementById('prevCrRow');
  if (crNumber) {
    crRow.classList.remove('hidden');
    document.getElementById('prevCrNumber').textContent = crNumber;
  } else {
    crRow.classList.add('hidden');
  }

  const buyerVatRow = document.getElementById('prevBuyerVatRow');
  if (buyerVat) {
    buyerVatRow.classList.remove('hidden');
    document.getElementById('prevBuyerVat').textContent = buyerVat;
  } else {
    buyerVatRow.classList.add('hidden');
  }

  const dateObj = rawDate ? new Date(rawDate) : new Date();
  const isoTimestamp = dateObj.toISOString();
  document.getElementById('prevInvoiceDate').textContent = dateObj.toLocaleString('ar-SA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const tbody = document.getElementById('prevItemsBody');
  tbody.innerHTML = '';

  let subtotal = 0;
  let totalVat = 0;

  items.forEach((item, idx) => {
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(item.price) || 0;
    const lineSubtotal = qty * price;
    const lineVat = lineSubtotal * (taxRate / 100);
    const lineTotal = lineSubtotal + lineVat;

    subtotal += lineSubtotal;
    totalVat += lineVat;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${item.name || '-'}</td>
      <td>${qty}</td>
      <td>${price.toFixed(2)}</td>
      <td>${lineVat.toFixed(2)}</td>
      <td><strong>${lineTotal.toFixed(2)}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  const grandTotal = subtotal + totalVat;

  document.getElementById('prevSubtotal').textContent = `${subtotal.toFixed(2)} ر.س`;
  document.getElementById('prevTaxTotal').textContent = `${totalVat.toFixed(2)} ر.س`;
  document.getElementById('prevGrandTotal').textContent = `${grandTotal.toFixed(2)} ر.س`;

  const tlvCode = generateZatcaTLV(sellerName, vatNumber, isoTimestamp, grandTotal, totalVat);
  renderQRCode(tlvCode);
}

// حفظ البيانات في المتصفح
function saveInvoiceData(showAlert = true) {
  const payload = {
    sellerName: document.getElementById('sellerName').value,
    vatNumber: document.getElementById('vatNumber').value,
    crNumber: document.getElementById('crNumber').value,
    sellerAddress: document.getElementById('sellerAddress').value,
    invoiceNumber: document.getElementById('invoiceNumber').value,
    buyerName: document.getElementById('buyerName').value,
    buyerVat: document.getElementById('buyerVat').value,
    taxRate: document.getElementById('taxRate').value,
    themeColor: document.getElementById('themeColor').value,
    invoiceNotes: document.getElementById('invoiceNotes').value,
    logoSrc: document.getElementById('prevLogo').src || '',
    hasLogo: !document.getElementById('prevLogo').classList.contains('hidden'),
    items
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  if (showAlert) {
    alert('تم حفظ بيانات الفاتورة بنجاح!');
  }
}

function loadSavedData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data.sellerName) document.getElementById('sellerName').value = data.sellerName;
    if (data.vatNumber) document.getElementById('vatNumber').value = data.vatNumber;
    if (data.crNumber !== undefined) document.getElementById('crNumber').value = data.crNumber;
    if (data.sellerAddress !== undefined) document.getElementById('sellerAddress').value = data.sellerAddress;
    if (data.invoiceNumber) document.getElementById('invoiceNumber').value = data.invoiceNumber;
    if (data.buyerName !== undefined) document.getElementById('buyerName').value = data.buyerName;
    if (data.buyerVat !== undefined) document.getElementById('buyerVat').value = data.buyerVat;
    if (data.taxRate !== undefined) document.getElementById('taxRate').value = data.taxRate;
    if (data.themeColor) document.getElementById('themeColor').value = data.themeColor;
    if (data.invoiceNotes !== undefined) document.getElementById('invoiceNotes').value = data.invoiceNotes;
    if (Array.isArray(data.items) && data.items.length > 0) items = data.items;
    if (data.hasLogo && data.logoSrc) {
      const img = document.getElementById('prevLogo');
      img.src = data.logoSrc;
      img.classList.remove('hidden');
    }
  } catch (e) {}
}

// التبديل بين الإدخال والمعاينة في الموبايل
function setMobileMode(mode) {
  if (window.innerWidth > 980) return;
  if (mode === 'preview') {
    editorPanel.classList.add('mobile-hide');
    previewPanel.classList.remove('mobile-hide');
    tabPreviewBtn.classList.add('active');
    tabEditorBtn.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    previewPanel.classList.add('mobile-hide');
    editorPanel.classList.remove('mobile-hide');
    tabEditorBtn.classList.add('active');
    tabPreviewBtn.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function handleResize() {
  if (window.innerWidth <= 980) {
    if (!tabPreviewBtn.classList.contains('active')) {
      previewPanel.classList.add('mobile-hide');
      editorPanel.classList.remove('mobile-hide');
    }
  } else {
    editorPanel.classList.remove('mobile-hide');
    previewPanel.classList.remove('mobile-hide');
  }
}

document.addEventListener('input', (e) => {
  if (e.target.matches('[data-index]')) {
    const idx = Number(e.target.dataset.index);
    const field = e.target.dataset.field;
    items[idx][field] = field === 'name' ? e.target.value : Number(e.target.value);
    updateInvoice();
  } else if (!e.target.matches('#logoInput')) {
    updateInvoice();
  }
});

itemsContainer.addEventListener('click', (e) => {
  if (e.target.matches('[data-remove]')) {
    const idx = Number(e.target.dataset.remove);
    if (items.length > 1) {
      items.splice(idx, 1);
      renderEditorItems();
      updateInvoice();
    }
  }
});

addItemBtn.addEventListener('click', () => {
  items.push({ name: 'صنف جديد', qty: 1, price: 0 });
  renderEditorItems();
  updateInvoice();
});

logoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = document.getElementById('prevLogo');
    img.src = reader.result;
    img.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

saveDataBtn.addEventListener('click', () => saveInvoiceData(true));

resetBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  items = [{ name: '', qty: 1, price: 0 }];
  document.getElementById('buyerName').value = '';
  document.getElementById('buyerVat').value = '';
  document.getElementById('invoiceNotes').value = '';
  document.getElementById('prevLogo').classList.add('hidden');
  renderEditorItems();
  updateInvoice();
});

function triggerPrint() {
  saveInvoiceData(false);
  if (window.innerWidth <= 980) {
    setMobileMode('preview');
  }
  setTimeout(() => window.print(), 150);
}

printBtn.addEventListener('click', triggerPrint);
directPrintBtn.addEventListener('click', triggerPrint);
saveAndPrintBtn.addEventListener('click', triggerPrint);

tabEditorBtn.addEventListener('click', () => setMobileMode('editor'));
tabPreviewBtn.addEventListener('click', () => setMobileMode('preview'));
goPreviewBtn.addEventListener('click', () => setMobileMode('preview'));
backEditBtn.addEventListener('click', () => setMobileMode('editor'));
window.addEventListener('resize', handleResize);

setDefaultDate();
loadSavedData();
renderEditorItems();
updateInvoice();
handleResize();
