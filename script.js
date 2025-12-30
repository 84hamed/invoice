let currentInvoice = null;
let rowCounter = 0;
let serviceRowCounter = 0;
let invoices = JSON.parse(localStorage.getItem('invoices')) || [];
let savedServices = JSON.parse(localStorage.getItem('savedServices')) || [];
let priceBackup = null; // برای undo
let prependMode = false; // حالت جدیدترین اول
const tableBody = document.querySelector('#invoiceTable tbody');
const serviceTableBody = document.querySelector('#servicesTable tbody');
const form = document.getElementById('productForm');
const serviceForm = document.getElementById('serviceForm');
const totalDiv = document.getElementById('totalAmount');
const servicesTotalDiv = document.getElementById('servicesTotal');
const table = document.getElementById('invoiceTable');
const servicesTable = document.getElementById('servicesTable');
const invoicesList = document.getElementById('invoicesList');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const undoBtn = document.getElementById('undoBtn');
const servicesSection = document.getElementById('servicesSection');
const mergeCheckbox = document.getElementById('mergeServices');
const savedServicesSelect = document.getElementById('savedServices');
const serviceSearchInput = document.getElementById('serviceSearch');
const saveServiceCheckbox = document.getElementById('saveServiceCheckbox');
const deleteServiceBtn = document.getElementById('deleteServiceBtn');
const statusMessage = document.getElementById('statusMessage');
const toggleSortBtn = document.getElementById('toggleSortBtn');

// تابع ذخیره محلی (localStorage)
function saveLocalChanges() {
    if (!currentInvoice) return;
    currentInvoice.buyer = document.getElementById('buyerName').value;
    currentInvoice.items = Array.from(tableBody.rows).map(row => ({
        name: row.cells[1].textContent,
        url: row.dataset.url,
        qty: parseFloat(row.cells[2].querySelector('.qty-input').value),
        unit: row.cells[3].textContent,
        unitPrice: parseFloat(row.cells[4].textContent.replace(/,/g, '')),
        total: parseFloat(row.cells[5].textContent.replace(/,/g, '')),
        packageLength: row.dataset.packageLength || ''
    }));
    currentInvoice.services = Array.from(serviceTableBody.rows).map(row => ({
        title: row.cells[1].textContent,
        qty: parseFloat(row.cells[2].querySelector('.service-qty-input').value),
        fee: parseFloat(row.dataset.fee),
        total: parseFloat(row.cells[4].textContent.replace(/,/g, ''))
    }));
    currentInvoice.merge = mergeCheckbox.checked;
    currentInvoice.prependMode = prependMode; // ذخیره حالت مرتب‌سازی
    currentInvoice.total = parseFloat(totalDiv.textContent.replace(/مجموع کل: | ریال/g, '').replace(/,/g, ''));
    localStorage.setItem('currentInvoice', JSON.stringify(currentInvoice));
    localStorage.setItem('invoices', JSON.stringify(invoices));
}

// تابع نمایش پیام
function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${isError ? 'error-message' : ''}`;
    statusMessage.style.display = 'block';
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 3000);
}

// بارگیری لیست خدمات ذخیره‌شده
function loadSavedServices(filter = '') {
    savedServicesSelect.innerHTML = '<option value="">انتخاب خدمت...</option>';
    const filtered = savedServices.filter(service =>
        service.title.toLowerCase().includes(filter.toLowerCase())
    );
    filtered.forEach((service, localIndex) => {
        const globalIndex = savedServices.indexOf(service);
        const option = document.createElement('option');
        option.value = globalIndex;
        option.textContent = `${service.title} - ${formatNumber(service.fee)} ریال`;
        savedServicesSelect.appendChild(option);
    });
    deleteServiceBtn.style.display = savedServicesSelect.value !== '' ? 'inline-block' : 'none';
}

// فیلتر خدمات بر اساس جستجو
function filterSavedServices() {
    const searchTerm = serviceSearchInput.value;
    loadSavedServices(searchTerm);
}

// بارگیری خدمت ذخیره‌شده به فرم
function loadSavedService() {
    const index = savedServicesSelect.value;
    deleteServiceBtn.style.display = index !== '' ? 'inline-block' : 'none';
    if (index === '') return;
    const service = savedServices[index];
    document.getElementById('serviceTitle').value = service.title;
    document.getElementById('serviceFee').value = service.fee;
    document.getElementById('serviceQty').value = 1;
}

// حذف خدمت انتخاب‌شده
function deleteSelectedService() {
    const index = savedServicesSelect.value;
    if (index === '' || !confirm('آیا مطمئن هستید که می‌خواهید این خدمت را حذف کنید؟')) return;
    savedServices.splice(index, 1);
    localStorage.setItem('savedServices', JSON.stringify(savedServices));
    loadSavedServices(serviceSearchInput.value);
    showStatus('خدمت با موفقیت حذف شد.');
}

// افزودن خدمت ذخیره‌شده
function addSavedService() {
    const index = savedServicesSelect.value;
    if (index === '') return;
    const service = savedServices[index];
    addServiceRow(service.title, service.fee, 1);
    serviceForm.reset();
    document.getElementById('serviceQty').disabled = true;
    loadSavedServices(serviceSearchInput.value);
}

// ذخیره خدمت فعلی (فقط اگر چک‌باکس تیک خورده)
function saveCurrentService() {
    const title = document.getElementById('serviceTitle').value.trim();
    const fee = parseFloat(document.getElementById('serviceFee').value);
    if (!title || fee <= 0) {
        alert('عنوان و اجرت معتبر وارد کنید.');
        return;
    }
    if (savedServices.some(s => s.title === title && s.fee === fee)) {
        alert('این خدمت قبلاً ذخیره شده است.');
        return;
    }
    savedServices.push({ title, fee });
    localStorage.setItem('savedServices', JSON.stringify(savedServices));
    loadSavedServices();
    showStatus(`خدمت "${title}" ذخیره شد.`);
}

// فعال کردن فیلد تعداد خدمات
function enableServiceQty() {
    const qtyInput = document.getElementById('serviceQty');
    qtyInput.disabled = false;
    qtyInput.focus();
}

// نمایش/مخفی بخش خدمات
function toggleServices() {
    servicesSection.style.display = servicesSection.style.display === 'none' ? 'block' : 'none';
}

// ادغام خدمات
function toggleMerge() {
    updateTotal();
    saveLocalChanges();
}

// تابع فرمت اعداد با کاما
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// تابع استخراج نام و قیمت از URL (با پروکسی)
async function extractProductInfo(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        let name = doc.querySelector('h1')?.textContent.trim() ||
                   doc.querySelector('title')?.textContent.replace(/ - .*$/, '') ||
                   'نام نامشخص';

        const fullText = doc.body ? doc.body.innerText : html;
        const priceMatch = fullText.match(/(\d{1,3}(?:,\d{3})*)\s*ریال/);
        let price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;

        return { name, price };
    } catch (error) {
        console.error('خطا در استخراج:', error);
        return { name: 'خطا در استخراج', price: 0 };
    }
}

// تابع محاسبه قیمت بر اساس واحد (برای متر)
function calculatePriceForUnit(basePrice, requestedQty, packageLength) {
    if (!packageLength || packageLength === 0) return basePrice * requestedQty;
    return (basePrice / packageLength) * requestedQty;
}

// تابع پشتیبان‌گیری از قیمت‌ها
function backupPrices() {
    priceBackup = {
        items: Array.from(tableBody.rows).map(row => ({
            name: row.cells[1].textContent,
            unitPrice: row.cells[4].textContent,
            total: row.cells[5].textContent
        })),
        total: totalDiv.textContent
    };
    undoBtn.style.display = 'inline-block';
}

// تابع بازگشت به قبل
function undoUpdate() {
    if (!priceBackup) return;
    tableBody.innerHTML = '';
    rowCounter = 0;
    priceBackup.items.forEach((item, index) => {
        rowCounter++;
        const row = tableBody.insertRow();
        row.dataset.url = currentInvoice.items[index].url || '';
        row.dataset.unitType = currentInvoice.items[index].unit === 'متر' ? 'متر' : 'عدد';
        row.dataset.packageLength = currentInvoice.items[index].packageLength || '';
        const qty = currentInvoice.items[index].qty;
        row.innerHTML = `
            <td>${rowCounter}</td>
            <td>${item.name}</td>
            <td><input type="number" value="${qty}" min="0.01" step="0.01" class="qty-input" style="width:60px;"></td>
            <td>${currentInvoice.items[index].unit}</td>
            <td ondblclick="editPriceDirect(this, ${rowCounter})">${item.unitPrice}</td>
            <td>${item.total}</td>
            <td>
                <button class="edit-btn" onclick="editRow(${rowCounter})">ویرایش</button>
                <button class="refresh-price-btn" onclick="refreshSinglePrice(${rowCounter})">به‌روزرسانی قیمت</button>
                <button class="delete-btn" onclick="deleteRow(${rowCounter})">حذف</button>
            </td>
        `;
    });
    totalDiv.textContent = priceBackup.total;
    priceBackup = null;
    undoBtn.style.display = 'none';
    saveLocalChanges();
    showStatus('به حالت قبل بازگشت.');
}

// تابع به‌روزرسانی قیمت تک ردیف
async function refreshSinglePrice(rowNum) {
    const row = tableBody.rows[rowNum - 1];
    const url = row.dataset.url;
    if (!url) {
        showStatus('URL موجود نیست.', true);
        return;
    }
    const qtyInput = row.cells[2].querySelector('.qty-input');
    const newQty = parseFloat(qtyInput.value) || 1;
    const unitType = row.dataset.unitType;
    const packageLength = parseFloat(row.dataset.packageLength) || 0;

    const info = await extractProductInfo(url);
    const price = info.price || 0;
    const total = unitType === 'متر' ? calculatePriceForUnit(price, newQty, packageLength) : price * newQty;
    row.cells[1].textContent = info.name;
    row.cells[4].textContent = formatNumber(price);
    row.cells[5].textContent = formatNumber(total);
    updateTotal();
    saveLocalChanges();
    showStatus(`قیمت "${info.name}" به‌روزرسانی شد.`);
}

// تابع دابل کلیک برای ویرایش قیمت واحد
function editPriceDirect(cell, rowNum) {
    const row = tableBody.rows[rowNum - 1];
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.value = parseFloat(cell.textContent.replace(/,/g, '')) || 0;
    priceInput.classList.add('editing-input');
    cell.innerHTML = '';
    cell.appendChild(priceInput);
    priceInput.focus();

    priceInput.onkeydown = (ev) => {
        if (ev.key === 'Enter') {
            const newPrice = parseFloat(priceInput.value) || 0;
            const qtyInput = row.cells[2].querySelector('.qty-input');
            const newQty = parseFloat(qtyInput.value) || 1;
            const unitType = row.dataset.unitType;
            const packageLength = parseFloat(row.dataset.packageLength) || 0;
            const total = unitType === 'متر' ? calculatePriceForUnit(newPrice, newQty, packageLength) : newPrice * newQty;
            cell.textContent = formatNumber(newPrice);
            row.cells[5].textContent = formatNumber(total);
            updateTotal();
            saveLocalChanges();
        }
    };
}

// تابع شروع ویرایش ردیف کالا
function editRow(rowNum) {
    const row = tableBody.rows[rowNum - 1];
    // تبدیل سلول‌ها به input
    const nameCell = row.cells[1];
    const qtyCell = row.cells[2];
    const priceCell = row.cells[4];

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = nameCell.textContent;
    nameInput.classList.add('editing-input');
    nameCell.innerHTML = '';
    nameCell.appendChild(nameInput);
    nameInput.focus();

    const qtyInput = qtyCell.querySelector('.qty-input') || document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '0.01';
    qtyInput.step = '0.01';
    qtyInput.classList.add('editing-input');

    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.value = parseFloat(priceCell.textContent.replace(/,/g, ''));
    priceInput.classList.add('editing-input');

    // Event listeners برای Enter
    let currentInput = nameInput;
    const inputs = [nameInput, qtyInput, priceInput];

    function handleEnter(e) {
        if (e.key === 'Enter') {
            const currentIndex = inputs.indexOf(e.target);
            if (currentIndex < inputs.length - 1) {
                inputs[currentIndex + 1].focus();
            } else {
                // ذخیره نهایی
                saveRowEdit(row, nameInput.value, parseFloat(qtyInput.value), parseFloat(priceInput.value));
                row.cells[1].innerHTML = nameInput.value;
                row.cells[2].innerHTML = `<input type="number" value="${qtyInput.value}" min="0.01" step="0.01" class="qty-input" style="width:60px;">`;
                row.cells[4].innerHTML = formatNumber(priceInput.value);
                updateRowTotal(row, qtyInput.value, priceInput.value);
                updateTotal();
                saveLocalChanges();
            }
        }
    }

    nameInput.onkeydown = handleEnter;
    qtyInput.onkeydown = handleEnter;
    priceInput.onkeydown = handleEnter;
}

// تابع ذخیره ویرایش ردیف کالا
function saveRowEdit(row, newName, newQty, newPrice) {
    row.dataset.name = newName;
    // بروزرسانی URL اگر لازم، اما برای سادگی، فقط محلی
}

// بروزرسانی جمع ردیف کالا
function updateRowTotal(row, qty, price) {
    const unitType = row.dataset.unitType;
    const packageLength = parseFloat(row.dataset.packageLength) || 0;
    const total = unitType === 'متر' ? calculatePriceForUnit(price, qty, packageLength) : price * qty;
    row.cells[5].textContent = formatNumber(total);
}

// تابع بروزرسانی شماره ردیف‌ها
function updateRowNumbers() {
    for (let i = 0; i < tableBody.rows.length; i++) {
        tableBody.rows[i].cells[0].textContent = i + 1;
    }
    rowCounter = tableBody.rows.length;
}

// تابع toggle مرتب‌سازی با کلید
function togglePrependMode() {
    prependMode = !prependMode;
    toggleSortBtn.textContent = prependMode ? 'حالت عادی' : 'جدیدترین اول'; // تغییر متن کلید برای نشان دادن وضعیت
    // اختیاری: reverse rows برای نمایش جدیدترین اول
    if (tableBody.rows.length > 0) {
        const rows = Array.from(tableBody.rows);
        tableBody.innerHTML = '';
        rows.reverse().forEach((row, index) => {
            const newRow = tableBody.insertRow(-1);
            newRow.innerHTML = row.innerHTML;
            newRow.dataset.url = row.dataset.url;
            newRow.dataset.unitType = row.dataset.unitType;
            newRow.dataset.packageLength = row.dataset.packageLength;
        });
        updateRowNumbersAndOnclicks();
    }
    showStatus(prependMode ? 'حالت جدیدترین اول فعال شد.' : 'حالت عادی فعال شد.');
}

// تابع اضافه کردن ردیف کالا (اجازه 0 قیمت)
async function addRow(url, quantity, unitType, packageLength) {
    const info = await extractProductInfo(url);

    const unitPrice = info.price || 0;
    const total = unitType === 'متر' ? calculatePriceForUnit(unitPrice, quantity, packageLength) : unitPrice * quantity;

    // insert در ابتدای یا انتهای tbody
    const insertIndex = prependMode ? 0 : -1;
    const row = tableBody.insertRow(insertIndex);
    row.dataset.url = url;
    row.dataset.unitType = unitType;
    row.dataset.packageLength = packageLength || '';

    // rowCounter همیشه ++، اما شماره‌ها را بروز می‌کنیم
    rowCounter++;

    row.innerHTML = `
        <td>1</td> <!-- موقت، بعد بروز می‌شود -->
        <td>${info.name}</td>
        <td><input type="number" value="${quantity}" min="0.01" step="0.01" class="qty-input" style="width:60px;"></td>
        <td>${unitType}</td>
        <td ondblclick="editPriceDirect(this, 1)">${formatNumber(unitPrice)}</td>
        <td>${formatNumber(total)}</td>
        <td>
            <button class="edit-btn" onclick="editRow(1)">ویرایش</button>
            <button class="refresh-price-btn" onclick="refreshSinglePrice(1)">به‌روزرسانی قیمت</button>
            <button class="delete-btn" onclick="deleteRow(1)">حذف</button>
        </td>
    `;

    // بروزرسانی شماره ردیف‌ها و onclick ها
    updateRowNumbersAndOnclicks();

    updateTotal();
    if (unitPrice > 0) {
        showStatus(`کالای "${info.name}" با موفقیت اضافه شد.`);
    } else {
        showStatus(`خطا در اضافه شدن کالای "${info.name}" (قیمت در دسترس نیست).`, true);
    }
    saveLocalChanges();
}

// تابع بروزرسانی onclick ها بعد از renumber
function updateRowNumbersAndOnclicks() {
    for (let i = 0; i < tableBody.rows.length; i++) {
        const row = tableBody.rows[i];
        const rowNum = i + 1;
        row.cells[0].textContent = rowNum;

        // بروزرسانی onclick ها
        const editBtn = row.cells[6].querySelector('.edit-btn');
        const refreshBtn = row.cells[6].querySelector('.refresh-price-btn');
        const deleteBtn = row.cells[6].querySelector('.delete-btn');
        const priceCell = row.cells[4];

        if (editBtn) editBtn.onclick = () => editRow(rowNum);
        if (refreshBtn) refreshBtn.onclick = () => refreshSinglePrice(rowNum);
        if (deleteBtn) deleteBtn.onclick = () => deleteRow(rowNum);
        if (priceCell) priceCell.ondblclick = () => editPriceDirect(priceCell, rowNum);
    }
    rowCounter = tableBody.rows.length;
}

// تابع شروع ویرایش ردیف خدمت
function editServiceRow(rowNum) {
    const row = serviceTableBody.rows[rowNum - 1];
    // تبدیل سلول‌ها به input
    const titleCell = row.cells[1];
    const qtyCell = row.cells[2];
    const feeCell = row.cells[3];

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = titleCell.textContent;
    titleInput.classList.add('editing-input');
    titleCell.innerHTML = '';
    titleCell.appendChild(titleInput);
    titleInput.focus();

    const qtyInput = qtyCell.querySelector('.service-qty-input') || document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '0.01';
    qtyInput.step = '0.01';
    qtyInput.classList.add('editing-input');

    const feeInput = document.createElement('input');
    feeInput.type = 'number';
    feeInput.value = parseFloat(feeCell.textContent.replace(/,/g, ''));
    feeInput.classList.add('editing-input');

    // Event listeners برای Enter
    let currentInput = titleInput;
    const inputs = [titleInput, qtyInput, feeInput];

    function handleEnter(e) {
        if (e.key === 'Enter') {
            const currentIndex = inputs.indexOf(e.target);
            if (currentIndex < inputs.length - 1) {
                inputs[currentIndex + 1].focus();
            } else {
                // ذخیره نهایی
                const newTitle = titleInput.value;
                const newQty = parseFloat(qtyInput.value);
                const newFee = parseFloat(feeInput.value);
                const total = newFee * newQty;
                row.cells[1].textContent = newTitle;
                row.cells[2].innerHTML = `<input type="number" value="${newQty}" min="0.01" step="0.01" class="service-qty-input" style="width:60px;">`;
                row.cells[3].textContent = formatNumber(newFee);
                row.cells[4].textContent = formatNumber(total);
                row.dataset.fee = newFee;
                updateServicesTotal();
                updateTotal();
                saveLocalChanges();
            }
        }
    }

    titleInput.onkeydown = handleEnter;
    qtyInput.onkeydown = handleEnter;
    feeInput.onkeydown = handleEnter;
}

// تابع ویرایش مستقیم اجرت خدمت با دابل کلیک
function editFeeDirect(cell, rowNum) {
    const row = serviceTableBody.rows[rowNum - 1];
    const feeInput = document.createElement('input');
    feeInput.type = 'number';
    feeInput.value = parseFloat(cell.textContent.replace(/,/g, '')) || 0;
    feeInput.classList.add('editing-input');
    cell.innerHTML = '';
    cell.appendChild(feeInput);
    feeInput.focus();

    feeInput.onkeydown = (ev) => {
        if (ev.key === 'Enter') {
            const newFee = parseFloat(feeInput.value) || 0;
            const qtyInput = row.cells[2].querySelector('.service-qty-input');
            const newQty = parseFloat(qtyInput.value) || 1;
            const total = newFee * newQty;
            cell.textContent = formatNumber(newFee);
            row.cells[4].textContent = formatNumber(total);
            row.dataset.fee = newFee;
            updateServicesTotal();
            updateTotal();
            saveLocalChanges();
        }
    };
}

// تابع اضافه کردن ردیف خدمت
function addServiceRow(title, fee, qty) {
    const total = fee * qty;
    serviceRowCounter++;

    const row = serviceTableBody.insertRow();
    row.dataset.fee = fee;
    row.innerHTML = `
        <td>${serviceRowCounter}</td>
        <td>${title}</td>
        <td><input type="number" value="${qty}" min="0.01" step="0.01" class="service-qty-input" style="width:60px;"></td>
        <td ondblclick="editFeeDirect(this, ${serviceRowCounter})">${formatNumber(fee)}</td>
        <td>${formatNumber(total)}</td>
        <td>
            <button class="edit-btn" onclick="editServiceRow(${serviceRowCounter})">ویرایش</button>
            <button class="delete-btn" onclick="deleteServiceRow(${serviceRowCounter})">حذف</button>
        </td>
    `;
    updateServicesTotal();
    updateTotal();
    showStatus(`خدمت "${title}" با موفقیت اضافه شد.`);
    saveLocalChanges();
}

// تابع حذف ردیف خدمت
function deleteServiceRow(rowNum) {
    if (confirm('آیا مطمئن هستید؟')) {
        const row = serviceTableBody.rows[rowNum - 1];
        const title = row.cells[1].textContent;
        serviceTableBody.deleteRow(rowNum - 1);
        for (let i = 0; i < serviceTableBody.rows.length; i++) {
            serviceTableBody.rows[i].cells[0].textContent = i + 1;
        }
        serviceRowCounter = serviceTableBody.rows.length;
        updateServicesTotal();
        updateTotal();
        saveLocalChanges();
        showStatus(`خدمت "${title}" با موفقیت حذف شد.`);
    }
}

// تابع محاسبه مجموع خدمات
function updateServicesTotal() {
    let grandTotal = 0;
    for (let row of serviceTableBody.rows) {
        const totalText = row.cells[4].textContent.replace(/,/g, '');
        grandTotal += parseFloat(totalText) || 0;
    }
    servicesTotalDiv.textContent = `مجموع خدمات: ${formatNumber(grandTotal)} ریال`;
    if (grandTotal > 0) servicesTable.style.display = 'table';
}
// تابع به‌روزرسانی همه قیمت‌ها (برای تمام کالاها)
async function updateAllPrices() {
    if (tableBody.rows.length === 0) {
        alert('هیچ کالایی در فاکتور وجود ندارد.');
        return;
    }
    if (!confirm('آیا می‌خواهید قیمت همه کالاها را به‌روزرسانی کنید؟ این کار ممکن است زمان ببرد.')) return;

    backupPrices();
    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'شروع به‌روزرسانی...';

    const rows = Array.from(tableBody.rows);
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const url = row.dataset.url;
        const qtyInput = row.cells[2].querySelector('.qty-input');
        const newQty = parseFloat(qtyInput.value) || 1;
        const unitType = row.dataset.unitType;
        const packageLength = parseFloat(row.dataset.packageLength) || 0;

        if (!url) continue;

        try {
            const info = await extractProductInfo(url);
            const price = info.price || 0;
            const total = unitType === 'متر'
                ? calculatePriceForUnit(price, newQty, packageLength)
                : price * newQty;

            row.cells[1].textContent = info.name;
            row.cells[4].textContent = formatNumber(price);
            row.cells[5].textContent = formatNumber(total);
        } catch (error) {
            console.error(`خطا در ردیف ${i + 1}:`, error);
        }

        // نمایش پیشرفت
        const percent = Math.round(((i + 1) / rows.length) * 100);
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `به‌روزرسانی ${percent}%`;
    }

    updateTotal();
    saveLocalChanges();
    progressText.textContent = 'به‌روزرسانی کامل شد ✅';
    setTimeout(() => {
        progressContainer.style.display = 'none';
    }, 1500);
    showStatus('تمام قیمت‌ها با موفقیت به‌روزرسانی شدند.');
}


// تابع حذف ردیف کالا
function deleteRow(rowNum) {
    if (confirm('آیا مطمئن هستید؟')) {
        const row = tableBody.rows[rowNum - 1];
        const name = row.cells[1].textContent;
        tableBody.deleteRow(rowNum - 1);
        updateRowNumbersAndOnclicks(); // استفاده از تابع جدید
        updateTotal();
        saveLocalChanges();
        showStatus(`کالای "${name}" با موفقیت حذف شد.`);
    }
}

// تابع محاسبه مجموع کل (کالا + خدمات اگر ادغام)
function updateTotal() {
    let grandTotal = 0;
    for (let row of tableBody.rows) {
        const totalText = row.cells[5].textContent.replace(/,/g, '');
        grandTotal += parseFloat(totalText) || 0;
    }
    if (mergeCheckbox.checked) {
        for (let row of serviceTableBody.rows) {
            const totalText = row.cells[4].textContent.replace(/,/g, '');
            grandTotal += parseFloat(totalText) || 0;
        }
    }
    totalDiv.textContent = `مجموع کل: ${formatNumber(grandTotal)} ریال`;
    if (grandTotal > 0) table.style.display = 'table';
}

// تابع نمایش/مخفی واحد کالا
function toggleUnitSection() {
    const unitType = document.getElementById('unitType').value;
    document.getElementById('unitSection').classList.toggle('active', unitType === 'متر');
}

// فعال کردن فیلد تعداد کالا
function enableQuantity() {
    const qtyInput = document.getElementById('quantityInput');
    qtyInput.disabled = false;
    qtyInput.focus();
}

// هندل فرم کالا
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('urlInput').value;
    let quantity = parseFloat(document.getElementById('quantityInput').value);
    if (document.getElementById('quantityInput').disabled) {
        quantity = 1;
    }
    const unitType = document.getElementById('unitType').value;
    const packageLength = unitType === 'متر' ? parseFloat(document.getElementById('packageLength').value) || 0 : 0;
    if (!url || quantity <= 0) {
        showStatus('لینک و تعداد معتبر وارد کنید.', true);
        return;
    }
    await addRow(url, quantity, unitType, packageLength);
    form.reset();
    document.getElementById('quantityInput').disabled = true;
    toggleUnitSection();
});

// به‌روز با تغییر تعداد کالا
tableBody.addEventListener('input', (e) => {
    if (e.target.classList.contains('qty-input')) {
        const row = e.target.closest('tr');
        const priceText = row.cells[4].textContent.replace(/,/g, '');
        const price = parseFloat(priceText) || 0;
        const newQty = parseFloat(e.target.value) || 0;
        const unitType = row.dataset.unitType;
        const packageLength = parseFloat(row.dataset.packageLength) || 0;
        const total = unitType === 'متر' ? calculatePriceForUnit(price, newQty, packageLength) : price * newQty;
        row.cells[5].textContent = formatNumber(total);
        updateTotal();
        saveLocalChanges();
    }
});

// هندل فرم خدمات
serviceForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('serviceTitle').value.trim();
    const fee = parseFloat(document.getElementById('serviceFee').value);
    let qty = parseFloat(document.getElementById('serviceQty').value);
    if (document.getElementById('serviceQty').disabled) {
        qty = 1;
    }
    if (!title || fee <= 0 || qty <= 0) {
        showStatus('عنوان، اجرت و تعداد معتبر وارد کنید.', true);
        return;
    }
    addServiceRow(title, fee, qty);
    if (saveServiceCheckbox.checked) {
        saveCurrentService();
    }
    serviceForm.reset();
    document.getElementById('serviceQty').disabled = true;
    saveServiceCheckbox.checked = false;
    loadSavedServices(serviceSearchInput.value);
});

// به‌روز با تغییر تعداد خدمات
serviceTableBody.addEventListener('input', (e) => {
    if (e.target.classList.contains('service-qty-input')) {
        const row = e.target.closest('tr');
        const feeText = row.cells[3].textContent.replace(/,/g, '');
        const fee = parseFloat(feeText) || 0;
        const newQty = parseFloat(e.target.value) || 0;
        const total = fee * newQty;
        row.cells[4].textContent = formatNumber(total);
        updateServicesTotal();
        updateTotal();
        saveLocalChanges();
    }
});

// تابع دانلود فاکتور فعلی (بدون push به لیست)
function exportCurrentInvoice() {
    if (!currentInvoice) {
        showStatus('ابتدا فاکتور جدیدی بسازید.', true);
        return;
    }
    saveLocalChanges(); // اطمینان از به‌روز بودن
    const blob = new Blob([JSON.stringify(currentInvoice, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${currentInvoice.number}.json`;
    a.click();
    showStatus(`فاکتور "${currentInvoice.number}" دانلود شد.`);
}

// فاکتور جدید
function newInvoice() {
    currentInvoice = {
        id: Date.now(),
        number: `INV-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        buyer: '',
        items: [],
        services: [],
        total: 0,
        prependMode: false
    };
    rowCounter = 0;
    serviceRowCounter = 0;
    tableBody.innerHTML = '';
    serviceTableBody.innerHTML = '';
    table.style.display = 'none';
    servicesTable.style.display = 'none';
    document.getElementById('invoiceNumber').value = currentInvoice.number;
    document.getElementById('invoiceDate').value = currentInvoice.date;
    document.getElementById('buyerName').value = '';
    prependMode = false;
    toggleSortBtn.textContent = 'جدیدترین اول'; // تنظیم متن اولیه کلید
    updateTotal();
    updateServicesTotal();
    loadInvoicesList();
    form.reset();
    serviceForm.reset();
    document.getElementById('quantityInput').disabled = true;
    document.getElementById('serviceQty').disabled = true;
    priceBackup = null;
    undoBtn.style.display = 'none';
    mergeCheckbox.checked = false;
    saveServiceCheckbox.checked = false;
    deleteServiceBtn.style.display = 'none';
    saveLocalChanges();
}

function saveCurrentInvoice() {
    const invoiceNumber = document.getElementById('invoiceNumber').value.trim();

    if (!invoiceNumber) {
        showStatusMessage("هیچ فاکتور فعالی برای ذخیره وجود ندارد.", true);
        return;
    }

    const buyerName = document.getElementById('buyerName').value;
    const invoiceDate = document.getElementById('invoiceDate').value;

    // داده‌های کالا
    const table = document.getElementById('invoiceTable').getElementsByTagName('tbody')[0];
    const products = [];
    for (let row of table.rows) {
        products.push({
            name: row.cells[1].innerText,
            quantity: row.cells[2].innerText,
            unit: row.cells[3].innerText,
            price: row.cells[4].innerText,
            total: row.cells[5].innerText
        });
    }

    // داده‌های خدمات
    const serviceTable = document.getElementById('servicesTable').getElementsByTagName('tbody')[0];
    const services = [];
    for (let row of serviceTable.rows) {
        services.push({
            title: row.cells[1].innerText,
            qty: row.cells[2].innerText,
            fee: row.cells[3].innerText,
            total: row.cells[4].innerText
        });
    }

    const invoiceData = {
        invoiceNumber,
        buyerName,
        invoiceDate,
        products,
        services,
        totalAmount: document.getElementById('totalAmount').innerText,
        servicesTotal: document.getElementById('servicesTotal').innerText,
        lastSaved: new Date().toLocaleString('fa-IR')
    };

    // ذخیره در Local Storage با همان نام شماره فاکتور
    localStorage.setItem(`invoice_${invoiceNumber}`, JSON.stringify(invoiceData));
    showStatusMessage(`✅ فاکتور "${invoiceNumber}" با موفقیت ذخیره شد.`, false);
}

function showStatusMessage(message, isError = false) {
    const status = document.getElementById('statusMessage');
    status.textContent = message;
    status.className = 'status-message show ' + (isError ? 'error-message' : '');
    setTimeout(() => {
        status.classList.remove('show');
    }, 4000);
}

// بارگیری فاکتور
function loadInvoice(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            currentInvoice = JSON.parse(e.target.result);
            loadInvoiceData();
            loadInvoicesList();
            showStatus(`فاکتور "${currentInvoice.number}" بارگیری شد.`);
        } catch (err) {
            showStatus('خطا در بارگیری فایل.', true);
        }
    };
    reader.readAsText(file);
}

// بارگیری داده فاکتور
function loadInvoiceData() {
    rowCounter = 0;
    serviceRowCounter = 0;
    tableBody.innerHTML = '';
    serviceTableBody.innerHTML = '';
    document.getElementById('invoiceNumber').value = currentInvoice.number;
    document.getElementById('buyerName').value = currentInvoice.buyer || '';
    document.getElementById('invoiceDate').value = currentInvoice.date;
    mergeCheckbox.checked = currentInvoice.merge || false;
    prependMode = currentInvoice.prependMode || false;
    toggleSortBtn.textContent = prependMode ? 'حالت عادی' : 'جدیدترین اول'; // تنظیم متن بر اساس ذخیره
    currentInvoice.items.forEach(item => {
        rowCounter++;
        const row = tableBody.insertRow();
        row.dataset.url = item.url || '';
        row.dataset.unitType = item.unit === 'متر' ? 'متر' : 'عدد';
        row.dataset.packageLength = item.packageLength || '';
        const total = item.unitPrice * item.qty;
        row.innerHTML = `
            <td>${rowCounter}</td>
            <td>${item.name}</td>
            <td><input type="number" value="${item.qty}" min="0.01" step="0.01" class="qty-input" style="width:60px;"></td>
            <td>${item.unit}</td>
            <td ondblclick="editPriceDirect(this, ${rowCounter})">${formatNumber(item.unitPrice)}</td>
            <td>${formatNumber(total)}</td>
            <td>
                <button class="edit-btn" onclick="editRow(${rowCounter})">ویرایش</button>
                <button class="refresh-price-btn" onclick="refreshSinglePrice(${rowCounter})">به‌روزرسانی قیمت</button>
                <button class="delete-btn" onclick="deleteRow(${rowCounter})">حذف</button>
            </td>
        `;
    });
    updateRowNumbersAndOnclicks(); // برای onclick ها
    currentInvoice.services.forEach(service => {
        serviceRowCounter++;
        const row = serviceTableBody.insertRow();
        row.dataset.fee = service.fee;
        const total = service.fee * service.qty;
        row.innerHTML = `
            <td>${serviceRowCounter}</td>
            <td>${service.title}</td>
            <td><input type="number" value="${service.qty}" min="0.01" step="0.01" class="service-qty-input" style="width:60px;"></td>
            <td ondblclick="editFeeDirect(this, ${serviceRowCounter})">${formatNumber(service.fee)}</td>
            <td>${formatNumber(total)}</td>
            <td>
                <button class="edit-btn" onclick="editServiceRow(${serviceRowCounter})">ویرایش</button>
                <button class="delete-btn" onclick="deleteServiceRow(${serviceRowCounter})">حذف</button>
            </td>
        `;
    });
    updateTotal();
    updateServicesTotal();
    form.reset();
    serviceForm.reset();
    document.getElementById('quantityInput').disabled = true;
    document.getElementById('serviceQty').disabled = true;
    priceBackup = null;
    undoBtn.style.display = 'none';
    saveServiceCheckbox.checked = false;
    deleteServiceBtn.style.display = 'none';
    loadSavedServices();
    saveLocalChanges();
}

// چاپ فاکتور
function printInvoice() {
    if (!currentInvoice) return alert('فاکتوری برای چاپ وجود ندارد.');
    let content = `
        <html dir="rtl"><head><title>فاکتور ${currentInvoice.number}</title>
        <style>table {width:100%; border-collapse:collapse;} th,td {border:1px solid #000; padding:8px; text-align:center;}</style></head>
        <body><h1>فاکتور شماره: ${currentInvoice.number}</h1>
        <p>خریدار: ${currentInvoice.buyer}</p><p>تاریخ: ${currentInvoice.date}</p>
    `;
    // جدول کالا
    content += `<h2>کالاها</h2><table><thead><tr><th>ردیف</th><th>نام</th><th>تعداد</th><th>واحد</th><th>مبلغ واحد</th><th>جمع</th></tr></thead><tbody>`;
    Array.from(tableBody.rows).forEach(row => {
        content += `<tr><td>${row.cells[0].textContent}</td><td>${row.cells[1].textContent}</td><td>${row.cells[2].textContent}</td><td>${row.cells[3].textContent}</td><td>${row.cells[4].textContent}</td><td>${row.cells[5].textContent}</td></tr>`;
    });
    content += `</tbody></table>`;
    // جدول خدمات
    if (serviceTableBody.rows.length > 0) {
        content += `<h2>خدمات</h2><table><thead><tr><th>ردیف</th><th>عنوان</th><th>تعداد</th><th>اجرت</th><th>جمع</th></tr></thead><tbody>`;
        Array.from(serviceTableBody.rows).forEach(row => {
            content += `<tr><td>${row.cells[0].textContent}</td><td>${row.cells[1].textContent}</td><td>${row.cells[2].textContent}</td><td>${row.cells[3].textContent}</td><td>${row.cells[4].textContent}</td></tr>`;
        });
        content += `</tbody></table>`;
    }
    content += `<p>مجموع کل: ${totalDiv.textContent}</p></body></html>`;
    const win = window.open('', '_blank');
    win.document.write(content);
    win.document.close();
    win.print();
}

// لیست فاکتورها
function loadInvoicesList() {
    invoicesList.innerHTML = '';
    invoices.forEach(inv => {
        const li = document.createElement('li');
        li.textContent = `${inv.number} - ${inv.buyer || 'نامشخص'} (${inv.date})`;
        li.onclick = () => {
            alert('برای بارگیری کامل، فایل JSON را از دانلودهای قبلی انتخاب کنید.');
        };
        invoicesList.appendChild(li);
    });
}

// بارگیری اولیه
loadSavedServices();
loadInvoicesList();
const savedCurrent = localStorage.getItem('currentInvoice');
if (savedCurrent) {
    currentInvoice = JSON.parse(savedCurrent);
    loadInvoiceData();
} else {
    newInvoice();
}

// تابع چسباندن از کلیپ‌بورد
async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('urlInput').value = text;
        showStatus('آدرس از کلیپ‌بورد چسبانده شد.');
    } catch (err) {
        console.error('خطا در خواندن کلیپ‌بورد', err);
        showStatus('خطا در خواندن کلیپ‌بورد.', true);
    }
}
// === دکمه ذخیره فاکتور ===

// فرض می‌کنیم نام فاکتور جاری در متغیر currentInvoiceName نگهداری می‌شود
let currentInvoiceName = "فاکتور_فعلی"; // اگر از قبل مقداردهی نشده بود، مقدار پیش‌فرض

document.getElementById("save-invoice").addEventListener("click", function () {
  // بررسی اینکه آیا فاکتور باز است یا خیر
  const items = document.querySelectorAll("#item-list tr");
  if (items.length === 0) {
    showError("هیچ آیتمی برای ذخیره وجود ندارد!");
    return;
  }

  // جمع‌آوری داده‌ها
  let invoiceData = {
    name: currentInvoiceName,
    date: new Date().toLocaleString(),
    items: [],
  };

  items.forEach(row => {
    const cells = row.querySelectorAll("td");
    invoiceData.items.push({
      name: cells[0]?.innerText || "",
      price: cells[1]?.innerText || "",
      link: cells[2]?.innerText || "",
      quantity: cells[3]?.innerText || "",
    });
  });

  // ذخیره در LocalStorage
  localStorage.setItem(`invoice_${currentInvoiceName}`, JSON.stringify(invoiceData));

  // نمایش انیمیشن موفقیت
  showSuccessAnimation("فاکتور با موفقیت ذخیره شد ✅");
});

// === انیمیشن موفقیت ===
function showSuccessAnimation(message) {
  const popup = document.createElement("div");
  popup.className = "success-popup";
  popup.innerHTML = `
    <div class="success-checkmark">
      <div class="check-icon">
        <span class="icon-line line-tip"></span>
        <span class="icon-line line-long"></span>
        <div class="icon-circle"></div>
        <div class="icon-fix"></div>
      </div>
      <p>${message}</p>
    </div>
  `;
  document.body.appendChild(popup);

  setTimeout(() => popup.remove(), 2500); // حذف پس از ۲.۵ ثانیه
}

// === انیمیشن خطا ===
function showError(message) {
  const popup = document.createElement("div");
  popup.className = "error-popup";
  popup.innerHTML = `<p>⚠️ ${message}</p>`;
  document.body.appendChild(popup);

  setTimeout(() => popup.remove(), 2500);
}
// تابع به‌روزرسانی همه قیمت‌ها (فقط کالا)
async function updateAllPrices() {
    if (tableBody.rows.length === 0) {
        alert('هیچ کالایی در فاکتور وجود ندارد.');
        return;
    }
    if (!confirm('آیا می‌خواهید قیمت همه کالاها را به‌روزرسانی کنید؟ این کار ممکن است زمان ببرد.')) return;

    backupPrices(); // پشتیبان‌گیری برای undo
    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = '0%';

    let totalRows = tableBody.rows.length;
    let updatedCount = 0;

    for (let i = 0; i < totalRows; i++) {
        const row = tableBody.rows[i];
        const url = row.dataset.url;
        if (!url) continue;

        try {
            const qtyInput = row.cells[2].querySelector('.qty-input');
            const newQty = parseFloat(qtyInput.value) || 1;
            const unitType = row.dataset.unitType;
            const packageLength = parseFloat(row.dataset.packageLength) || 0;

            const info = await extractProductInfo(url);
            const price = info.price || 0;
            const total = unitType === 'متر'
                ? calculatePriceForUnit(price, newQty, packageLength)
                : price * newQty;

            row.cells[1].textContent = info.name;
            row.cells[4].textContent = formatNumber(price);
            row.cells[5].textContent = formatNumber(total);

            updatedCount++;
            const progress = Math.round((updatedCount / totalRows) * 100);
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `${progress}%`;

        } catch (err) {
            console.error(`خطا در به‌روزرسانی ردیف ${i + 1}:`, err);
        }
    }

    progressFill.style.width = '100%';
    progressText.textContent = '100%';
    updateTotal();
    saveLocalChanges();
    showStatus('تمام قیمت‌ها با موفقیت به‌روزرسانی شدند.');
    setTimeout(() => {
        progressContainer.style.display = 'none';
    }, 1500);
}
const filePath = path.join(__dirname, 'invoices', currentInvoiceName);

if (fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify(currentInvoiceData, null, 2), 'utf-8');
  console.log(`✅ فاکتور ${currentInvoiceName} با موفقیت اوررایت شد`);
} else {
  console.log("⚠ فایل فاکتور موجود نیست!");
}
function printInvoiceFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || !Array.isArray(data.items)) {
        alert("ساختار فایل JSON نامعتبر است.");
        return;
      }

      // پاک‌سازی جدول فعلی
      const tbody = document.querySelector("#invoiceTable tbody");
      tbody.innerHTML = "";

      // پر کردن جدول با داده‌های فایل
      data.items.forEach((item, index) => {
        const row = document.createElement("tr");

        // استخراج مقدار تعداد یا طول
        const qty = item.qty ?? "-";
        const unit = item.unit ?? "-";
        const unitPrice = item.unitPrice ?? "-";
        const total = item.total ?? "-";

        // اگر واحد متر بود و packageLength وجود داشت، نمایش ترکیبی
        let qtyDisplay = qty;
        if (unit === "متر" && item.packageLength) {
          qtyDisplay = `${qty} متر (بسته ${item.packageLength})`;
        }

        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${item.name || "-"}</td>
          <td>${qtyDisplay}</td>
          <td>${unit}</td>
          <td>${Number(unitPrice).toLocaleString()}</td>
          <td>${Number(total).toLocaleString()}</td>
          <td></td>
        `;

        tbody.appendChild(row);
      });

      // نمایش جدول و مجموع
      document.getElementById("invoiceTable").style.display = "table";
      document.getElementById("totalAmount").textContent = `مجموع کل: ${Number(data.total || 0).toLocaleString()} ریال`;

      // چاپ
      setTimeout(() => window.print(), 500);

    } catch (err) {
      alert("خطا در خواندن فایل JSON.");
      console.error(err);
    }
  };

  reader.readAsText(file);
}
function exportToRealExcel() {
  const table = document.getElementById("invoiceTable");
  if (!table || table.rows.length === 0) {
    alert("هیچ داده‌ای برای ذخیره وجود ندارد.");
    return;
  }

  const wb = XLSX.utils.book_new();
  const ws_data = [];

  // استخراج داده‌ها از جدول به صورت آرایه
  const rows = table.querySelectorAll("tr");
  rows.forEach(row => {
    const cells = Array.from(row.querySelectorAll("th, td")).map(cell => cell.textContent.trim());
    ws_data.push(cells.reverse()); // برعکس کردن ترتیب ستون‌ها
  });

  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // تنظیم راست‌چینی سلول‌ها
  Object.keys(ws).forEach(key => {
    if (key.startsWith('!')) return;
    ws[key].s = {
      alignment: { horizontal: "right" },
      font: { name: "Tahoma" }
    };
  });

  XLSX.utils.book_append_sheet(wb, ws, "فاکتور");
  XLSX.writeFile(wb, "invoice.xlsx");
}


function exportToWord() {
  const table = document.getElementById("invoiceTable");
  if (!table || table.rows.length === 0) {
    alert("هیچ داده‌ای برای ذخیره وجود ندارد.");
    return;
  }

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <style>
        body { direction: rtl; text-align: right; font-family: Tahoma; }
        table { border-collapse: collapse; width: 100%; direction: rtl; text-align: right; }
        th, td { border: 1px solid #ccc; padding: 6px; }
        h2 { text-align: right; }
      </style>
    </head>
    <body dir="rtl">
      <h2>فاکتور ${document.getElementById("invoiceNumber").value || ""}</h2>
      <table>${table.innerHTML}</table>
    </body>
    </html>
  `;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "invoice.doc";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


function setPrintFontSize(size) {
  document.body.style.setProperty("--print-font-size", size);
}
function enableNoteEdit() {
  const note = document.getElementById("editableNote");
  const input = document.getElementById("noteInput");
  const btn = document.getElementById("saveNoteBtn");

  input.value = note.textContent.trim();
  note.style.display = "none";
  input.style.display = "block";
  btn.style.display = "inline-block";
}

function saveNote() {
  const note = document.getElementById("editableNote");
  const input = document.getElementById("noteInput");
  const btn = document.getElementById("saveNoteBtn");

  note.textContent = input.value.trim() || "بدون توضیحات";
  note.style.display = "block";
  input.style.display = "none";
  btn.style.display = "none";
}
function updateFinalTotal() {
  const baseTotal = parseInt(document.getElementById("totalAmount").textContent.replace(/[^\d]/g, "")) || 0;
  const debt = parseInt(document.getElementById("previousDebt").value) || 0;
  const credit = parseInt(document.getElementById("creditAmount").value) || 0;
  const final = baseTotal + debt - credit;

  document.getElementById("finalPayable").textContent = `جمع مبلغ قابل پرداخت: ${final.toLocaleString()} ریال`;
}
///////////////////////////////////////////////

