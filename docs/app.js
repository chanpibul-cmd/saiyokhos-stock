/**
 * โรงพยาบาลไทรโยค (Sai Yok Hospital) - ระบบบริหารคลังและสต๊อกพัสดุ
 * Frontend Single Page Application (SPA) Controller
 */

// ============================================================================
// 1. App Configuration & State Management
// ============================================================================

const ALL_PAGES = [
  'stock_balance',
  'buy',
  'pay',
  'items',
  'shops',
  'reports',
  'user_mgmt'
];

const PAGE_METADATA = {
  stock_balance: { name: 'ยอดคงเหลือสต๊อก', icon: 'fa-boxes-stacked' },
  buy: { name: 'บันทึกรับเข้าพัสดุ', icon: 'fa-cart-arrow-down' },
  pay: { name: 'บันทึกเบิกจ่ายพัสดุ', icon: 'fa-hand-holding-medical' },
  items: { name: 'ทะเบียนรหัสพัสดุ', icon: 'fa-barcode' },
  shops: { name: 'ข้อมูลร้านค้า / แหล่งรับ', icon: 'fa-store' },
  reports: { name: 'บัตรคุมพัสดุ & รายงาน', icon: 'fa-file-invoice' },
  user_mgmt: { name: 'จัดการผู้ใช้และสิทธิ', icon: 'fa-users-gear' }
};

const state = {
  currentUser: null,
  userPermissions: {},
  token: localStorage.getItem('saiyok_token') || null,
  apiBaseUrl: localStorage.getItem('saiyok_api_url') || 'https://saiyok-hospital-stock.chanpibulwork.workers.dev',
  activePage: 'stock_balance',
  isOnlineWorker: false,
  stockItems: [],
  categories: [],
  shops: [],
  users: [],
  recentBuys: [],
  recentPays: [],
};

// ============================================================================
// 2. Built-in Realistic Mock Database (Fallback for Local / Offline Demo)
// ============================================================================

const mockData = {
  users: [
    {
      id: 1,
      username: 'chanpibul',
      fullname: 'ผู้ดูแลระบบสูงสุด',
      department: 'กลุ่มงานบริหารทั่วไป โรงพยาบาลไทรโยค',
      role: 'superadmin',
      is_active: 1,
      permissions: {
        stock_balance: { can_view: 1, can_edit: 1 },
        buy: { can_view: 1, can_edit: 1 },
        pay: { can_view: 1, can_edit: 1 },
        items: { can_view: 1, can_edit: 1 },
        shops: { can_view: 1, can_edit: 1 },
        reports: { can_view: 1, can_edit: 1 },
        user_mgmt: { can_view: 1, can_edit: 1 }
      }
    },
    {
      id: 2,
      username: 'stock_officer',
      fullname: 'นายสมชาย พัสดุดี',
      department: 'งานพัสดุและบำรุงรักษา',
      role: 'admin',
      is_active: 1,
      permissions: {
        stock_balance: { can_view: 1, can_edit: 1 },
        buy: { can_view: 1, can_edit: 1 },
        pay: { can_view: 1, can_edit: 1 },
        items: { can_view: 1, can_edit: 1 },
        shops: { can_view: 1, can_edit: 1 },
        reports: { can_view: 1, can_edit: 1 },
        user_mgmt: { can_view: 0, can_edit: 0 }
      }
    },
    {
      id: 3,
      username: 'er_nurse',
      fullname: 'พว.สุดา ใจเมตตา',
      department: 'กลุ่มงานอุบัติเหตุและฉุกเฉิน (ER)',
      role: 'user',
      is_active: 1,
      permissions: {
        stock_balance: { can_view: 1, can_edit: 0 },
        buy: { can_view: 0, can_edit: 0 },
        pay: { can_view: 1, can_edit: 1 },
        items: { can_view: 1, can_edit: 0 },
        shops: { can_view: 0, can_edit: 0 },
        reports: { can_view: 1, can_edit: 0 },
        user_mgmt: { can_view: 0, can_edit: 0 }
      }
    }
  ],
  items: [
    { id: 1, item_code: 'MED-001', item_name: 'กระบอกฉีดยา Syringe Nipro 5 ml (กล่องละ 100 ชิ้น)', unit: 'กล่อง', category: 'เวชภัณฑ์มิใช่ยา', min_stock: 10, max_stock: 100, is_active: 1 },
    { id: 2, item_code: 'MED-002', item_name: 'ถุงมือตรวจโรค Latex Gloves Size M (กล่องละ 100 ชิ้น)', unit: 'กล่อง', category: 'เวชภัณฑ์มิใช่ยา', min_stock: 20, max_stock: 150, is_active: 1 },
    { id: 3, item_code: 'MED-003', item_name: 'ผ้าก๊อซ Gauze Pad 3x3 นิ้ว (ห่อละ 100 ชิ้น)', unit: 'ห่อ', category: 'เวชภัณฑ์มิใช่ยา', min_stock: 15, max_stock: 80, is_active: 1 },
    { id: 4, item_code: 'MED-004', item_name: 'แอลกอฮอล์สำหรับล้างแผล 70% 450 ml', unit: 'ขวด', category: 'เวชภัณฑ์มิใช่ยา', min_stock: 10, max_stock: 50, is_active: 1 },
    { id: 5, item_code: 'MED-005', item_name: 'สายให้น้ำเกลือ IV Infusion Set สำหรับผู้ใหญ่', unit: 'ชุด', category: 'เวชภัณฑ์มิใช่ยา', min_stock: 25, max_stock: 120, is_active: 1 },
    { id: 6, item_code: 'MED-006', item_name: 'หน้ากากอนามัยทางการแพทย์ 3 ชั้น (กล่องละ 50 ชิ้น)', unit: 'กล่อง', category: 'เวชภัณฑ์มิใช่ยา', min_stock: 30, max_stock: 200, is_active: 1 },
    { id: 7, item_code: 'OFF-001', item_name: 'กระดาษถ่ายเอกสาร A4 80 แกรม Double A', unit: 'รีม', category: 'วัสดุสำนักงาน', min_stock: 20, max_stock: 100, is_active: 1 },
    { id: 8, item_code: 'OFF-002', item_name: 'แฟ้มเวชระเบียนผู้ป่วยนอก (OPD Folder)', unit: 'เล่ม', category: 'วัสดุสำนักงาน', min_stock: 50, max_stock: 300, is_active: 1 },
    { id: 9, item_code: 'OFF-003', item_name: 'สติกเกอร์บาร์โค้ดรหัสผู้ป่วย 3.2 x 2.5 cm (ม้วนละ 1,000 ดวง)', unit: 'ม้วน', category: 'วัสดุสำนักงาน', min_stock: 10, max_stock: 50, is_active: 1 },
    { id: 10, item_code: 'GEN-001', item_name: 'น้ำยาทำความสะอาดและฆ่าเชื้อพื้นผิว 3,800 ml', unit: 'แกลลอน', category: 'วัสดุงานบ้านงานครัว', min_stock: 5, max_stock: 30, is_active: 1 }
  ],
  shops: [
    { id: 1, shop_name: 'ยอดยกมา', address: 'คลังพัสดุกลาง รพ.ไทรโยค', phone: '034-591023', tax_id: '0994000160000' },
    { id: 2, shop_name: 'องค์การเภสัชกรรม (GPO)', address: 'ถ.พระรามที่ 6 กทม.', phone: '02-610-2000', tax_id: '0994000164927' },
    { id: 3, shop_name: 'บริษัท ดีเคเอสเอช (ประเทศไทย) จำกัด', address: 'สุขุมวิท กทม.', phone: '02-790-8000', tax_id: '0105501004921' },
    { id: 4, shop_name: 'บริษัท สยามเมดิคอล ซัพพลาย จำกัด', address: 'อ.เมือง จ.กาญจนบุรี', phone: '034-620-111', tax_id: '0715545000123' },
    { id: 5, shop_name: 'ห้างหุ้นส่วนจำกัด กาญจน์เครื่องเขียน', address: 'อ.เมือง จ.กาญจนบุรี', phone: '034-511-234', tax_id: '0713532000456' }
  ],
  buys: [
    { id: 1, doc_date: '2024-01-01', doc_no: 'INIT-2024-001', item_code: 'MED-001', item_name: 'กระบอกฉีดยา Syringe Nipro 5 ml (กล่องละ 100 ชิ้น)', category: 'เวชภัณฑ์มิใช่ยา', unit: 'กล่อง', price_per_unit: 180, quantity: 50, total_price: 9000, shop_name: 'ยอดยกมา', remark: 'ยอดยกมาต้นปีงบประมาณ', ym_period: '2024-01', created_by: 'chanpibul' },
    { id: 2, doc_date: '2024-01-01', doc_no: 'INIT-2024-002', item_code: 'MED-002', item_name: 'ถุงมือตรวจโรค Latex Gloves Size M (กล่องละ 100 ชิ้น)', category: 'เวชภัณฑ์มิใช่ยา', unit: 'กล่อง', price_per_unit: 145, quantity: 80, total_price: 11600, shop_name: 'ยอดยกมา', remark: 'ยอดยกมาต้นปีงบประมาณ', ym_period: '2024-01', created_by: 'chanpibul' },
    { id: 3, doc_date: '2024-01-01', doc_no: 'INIT-2024-003', item_code: 'MED-003', item_name: 'ผ้าก๊อซ Gauze Pad 3x3 นิ้ว (ห่อละ 100 ชิ้น)', category: 'เวชภัณฑ์มิใช่ยา', unit: 'ห่อ', price_per_unit: 95, quantity: 40, total_price: 3800, shop_name: 'ยอดยกมา', remark: 'ยอดยกมาต้นปีงบประมาณ', ym_period: '2024-01', created_by: 'chanpibul' },
    { id: 4, doc_date: '2024-01-01', doc_no: 'INIT-2024-004', item_code: 'MED-004', item_name: 'แอลกอฮอล์สำหรับล้างแผล 70% 450 ml', category: 'เวชภัณฑ์มิใช่ยา', unit: 'ขวด', price_per_unit: 42, quantity: 30, total_price: 1260, shop_name: 'ยอดยกมา', remark: 'ยอดยกมาต้นปีงบประมาณ', ym_period: '2024-01', created_by: 'chanpibul' },
    { id: 5, doc_date: '2024-01-01', doc_no: 'INIT-2024-005', item_code: 'MED-005', item_name: 'สายให้น้ำเกลือ IV Infusion Set สำหรับผู้ใหญ่', category: 'เวชภัณฑ์มิใช่ยา', unit: 'ชุด', price_per_unit: 22, quantity: 60, total_price: 1320, shop_name: 'ยอดยกมา', remark: 'ยอดยกมาต้นปีงบประมาณ', ym_period: '2024-01', created_by: 'chanpibul' },
    { id: 6, doc_date: '2024-01-01', doc_no: 'INIT-2024-006', item_code: 'MED-006', item_name: 'หน้ากากอนามัยทางการแพทย์ 3 ชั้น (กล่องละ 50 ชิ้น)', category: 'เวชภัณฑ์มิใช่ยา', unit: 'กล่อง', price_per_unit: 65, quantity: 120, total_price: 7800, shop_name: 'ยอดยกมา', remark: 'ยอดยกมาต้นปีงบประมาณ', ym_period: '2024-01', created_by: 'chanpibul' },
    { id: 7, doc_date: '2024-01-01', doc_no: 'INIT-2024-007', item_code: 'OFF-001', item_name: 'กระดาษถ่ายเอกสาร A4 80 แกรม Double A', category: 'วัสดุสำนักงาน', unit: 'รีม', price_per_unit: 125, quantity: 50, total_price: 6250, shop_name: 'ยอดยกมา', remark: 'ยอดยกมาต้นปีงบประมาณ', ym_period: '2024-01', created_by: 'chanpibul' },
    { id: 8, doc_date: '2024-01-01', doc_no: 'INIT-2024-008', item_code: 'OFF-002', item_name: 'แฟ้มเวชระเบียนผู้ป่วยนอก (OPD Folder)', category: 'วัสดุสำนักงาน', unit: 'เล่ม', price_per_unit: 18, quantity: 150, total_price: 2700, shop_name: 'ยอดยกมา', remark: 'ยอดยกมาต้นปีงบประมาณ', ym_period: '2024-01', created_by: 'chanpibul' },
    { id: 9, doc_date: '2024-01-15', doc_no: 'PO-67-0012', item_code: 'MED-001', item_name: 'กระบอกฉีดยา Syringe Nipro 5 ml (กล่องละ 100 ชิ้น)', category: 'เวชภัณฑ์มิใช่ยา', unit: 'กล่อง', price_per_unit: 180, quantity: 30, total_price: 5400, shop_name: 'บริษัท ดีเคเอสเอช (ประเทศไทย) จำกัด', remark: 'สั่งซื้อเพิ่มเติมรอบกลางเดือน', ym_period: '2024-01', created_by: 'stock_officer' },
    { id: 10, doc_date: '2024-01-18', doc_no: 'PO-67-0015', item_code: 'MED-004', item_name: 'แอลกอฮอล์สำหรับล้างแผล 70% 450 ml', category: 'เวชภัณฑ์มิใช่ยา', unit: 'ขวด', price_per_unit: 42, quantity: 20, total_price: 840, shop_name: 'องค์การเภสัชกรรม (GPO)', remark: 'จัดซื้อทดแทนสต๊อกใกล้หมด', ym_period: '2024-01', created_by: 'stock_officer' }
  ],
  pays: [
    { id: 1, doc_date: '2024-01-05', doc_no: 'REQ-67-0001', item_code: 'MED-001', item_name: 'กระบอกฉีดยา Syringe Nipro 5 ml (กล่องละ 100 ชิ้น)', category: 'เวชภัณฑ์มิใช่ยา', unit: 'กล่อง', price_per_unit: 180, quantity: 10, total_price: 1800, department: 'กลุ่มงานอุบัติเหตุและฉุกเฉิน (ER)', remark: 'เบิกใช้ประจำสัปดาห์', ym_period: '2024-01', created_by: 'er_nurse' },
    { id: 2, doc_date: '2024-01-06', doc_no: 'REQ-67-0002', item_code: 'MED-002', item_name: 'ถุงมือตรวจโรค Latex Gloves Size M (กล่องละ 100 ชิ้น)', category: 'เวชภัณฑ์มิใช่ยา', unit: 'กล่อง', price_per_unit: 145, quantity: 20, total_price: 2900, department: 'กลุ่มงานการพยาบาลผู้ป่วยนอก (OPD)', remark: 'เบิกใช้ตรวจโรคทั่วไป', ym_period: '2024-01', created_by: 'chanpibul' },
    { id: 3, doc_date: '2024-01-08', doc_no: 'REQ-67-0003', item_code: 'MED-004', item_name: 'แอลกอฮอล์สำหรับล้างแผล 70% 450 ml', category: 'เวชภัณฑ์มิใช่ยา', unit: 'ขวด', price_per_unit: 42, quantity: 35, total_price: 1470, department: 'กลุ่มงานการพยาบาลผู้ป่วยใน (IPD)', remark: 'เบิกใช้ทำแผลและฆ่าเชื้อ', ym_period: '2024-01', created_by: 'chanpibul' },
    { id: 4, doc_date: '2024-01-10', doc_no: 'REQ-67-0004', item_code: 'OFF-001', item_name: 'กระดาษถ่ายเอกสาร A4 80 แกรม Double A', category: 'วัสดุสำนักงาน', unit: 'รีม', price_per_unit: 125, quantity: 15, total_price: 1875, department: 'กลุ่มงานบริหารทั่วไป', remark: 'เบิกพิมพ์เอกสารราชการ', ym_period: '2024-01', created_by: 'stock_officer' },
    { id: 5, doc_date: '2024-01-12', doc_no: 'REQ-67-0005', item_code: 'OFF-002', item_name: 'แฟ้มเวชระเบียนผู้ป่วยนอก (OPD Folder)', category: 'วัสดุสำนักงาน', unit: 'เล่ม', price_per_unit: 18, quantity: 50, total_price: 900, department: 'งานเวชระเบียนและสถิติ', remark: 'เบิกทำประวัติผู้ป่วยใหม่', ym_period: '2024-01', created_by: 'chanpibul' },
    { id: 6, doc_date: '2024-01-20', doc_no: 'REQ-67-0006', item_code: 'MED-005', item_name: 'สายให้น้ำเกลือ IV Infusion Set สำหรับผู้ใหญ่', category: 'เวชภัณฑ์มิใช่ยา', unit: 'ชุด', price_per_unit: 22, quantity: 45, total_price: 990, department: 'กลุ่มงานการพยาบาลผู้ป่วยใน (IPD)', remark: 'เบิกเข้าตึกผู้ป่วยใน', ym_period: '2024-01', created_by: 'chanpibul' }
  ]
};

/**
 * คำนวณ view_stock_balance จำลองสำหรับกรณี Offline / Mock
 */
function calculateMockStockBalance() {
  return mockData.items.map(item => {
    const buysForItem = mockData.buys.filter(b => b.item_code === item.item_code);
    const paysForItem = mockData.pays.filter(p => p.item_code === item.item_code);

    const total_in_qty = buysForItem.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
    const total_in_val = buysForItem.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);

    const total_out_qty = paysForItem.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
    const total_out_val = paysForItem.reduce((sum, p) => sum + (Number(p.total_price) || 0), 0);

    const balance_qty = Math.round((total_in_qty - total_out_qty) * 100) / 100;
    const avg_unit_price = total_in_qty > 0 ? Math.round((total_in_val / total_in_qty) * 100) / 100 : 0;
    const balance_val = Math.round(balance_qty * avg_unit_price * 100) / 100;

    let stock_status = 'NORMAL';
    if (balance_qty <= 0) {
      stock_status = 'OUT_OF_STOCK';
    } else if (balance_qty <= item.min_stock) {
      stock_status = 'LOW_STOCK';
    }

    return {
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.item_name,
      unit: item.unit,
      category: item.category,
      min_stock: item.min_stock,
      max_stock: item.max_stock,
      is_active: item.is_active,
      total_in_qty,
      total_in_val,
      total_out_qty,
      total_out_val,
      balance_qty,
      avg_unit_price,
      balance_val,
      stock_status
    };
  });
}

// ============================================================================
// 3. API Communication Layer
// ============================================================================

/**
 * ยิงคำขอไปยัง Cloudflare Workers Backend พร้อมระบบตรวจจับสถานะ
 */
async function apiRequest(endpoint, method = 'GET', data = null) {
  let url = endpoint;
  if (state.apiBaseUrl) {
    const base = state.apiBaseUrl.replace(/\/+$/, '');
    url = `${base}${endpoint}`;
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const options = { method, headers };
  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  try {
    const res = await fetch(url, options);
    const json = await res.json();
    state.isOnlineWorker = true;
    updateApiStatusBadge(true);
    return { ok: res.ok, status: res.status, data: json };
  } catch (err) {
    // เซิร์ฟเวอร์ไม่ตอบสนอง / ออฟไลน์ หรือยังไม่ได้ต่อ Worker จริง
    state.isOnlineWorker = false;
    updateApiStatusBadge(false);
    return handleMockApiFallback(endpoint, method, data);
  }
}

/**
 * Fallback Mock Handler ให้ระบบยังคงทำงานได้อย่างสมบูรณ์แบบ
 */
function handleMockApiFallback(endpoint, method, data) {
  console.log(`[Offline/Demo Mode] Handled locally: ${method} ${endpoint}`);

  // Public Categories
  if (endpoint === '/api/public/categories') {
    const cats = [...new Set(mockData.items.map(i => i.category))];
    return { ok: true, status: 200, data: { success: true, categories: cats } };
  }

  // Public Stock
  if (endpoint.startsWith('/api/public/stock')) {
    const urlObj = new URL('http://local' + endpoint);
    const q = (urlObj.searchParams.get('q') || '').toLowerCase();
    const cat = urlObj.searchParams.get('category') || '';
    const st = urlObj.searchParams.get('status') || '';

    let items = calculateMockStockBalance();
    if (q) {
      items = items.filter(i => i.item_code.toLowerCase().includes(q) || i.item_name.toLowerCase().includes(q));
    }
    if (cat) {
      items = items.filter(i => i.category === cat);
    }
    if (st) {
      items = items.filter(i => i.stock_status === st);
    }

    let normal = 0, low = 0, out = 0, totalVal = 0;
    items.forEach(i => {
      if (i.stock_status === 'NORMAL') normal++;
      else if (i.stock_status === 'LOW_STOCK') low++;
      else if (i.stock_status === 'OUT_OF_STOCK') out++;
      totalVal += i.balance_val;
    });

    return {
      ok: true,
      status: 200,
      data: {
        success: true,
        summary: {
          total_items: items.length,
          normal_count: normal,
          low_stock_count: low,
          out_of_stock_count: out,
          total_inventory_value: Math.round(totalVal * 100) / 100
        },
        items
      }
    };
  }

  // Auth: Login
  if (endpoint === '/api/auth/login' && method === 'POST') {
    const username = (data.username || '').trim().toLowerCase();
    const password = (data.password || '').trim();

    const user = mockData.users.find(u => u.username.toLowerCase() === username);
    if (!user) {
      return { ok: false, status: 401, data: { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' } };
    }

    // Default password checks for mock demo: '300628' or '123456'
    if (username === 'chanpibul' && password !== '300628') {
      return { ok: false, status: 401, data: { success: false, message: 'รหัสผ่านไม่ถูกต้อง (รหัสเริ่มต้นของ chanpibul คือ 300628)' } };
    }

    const mockToken = `mock_jwt_token_${user.id}_${Date.now()}`;
    return {
      ok: true,
      status: 200,
      data: {
        success: true,
        token: mockToken,
        user: { id: user.id, username: user.username, fullname: user.fullname, department: user.department, role: user.role },
        permissions: user.permissions
      }
    };
  }

  // Auth: Me
  if (endpoint === '/api/auth/me') {
    if (!state.currentUser) {
      return { ok: false, status: 401, data: { success: false, message: 'กรุณาเข้าสู่ระบบ' } };
    }
    return {
      ok: true,
      status: 200,
      data: {
        success: true,
        user: state.currentUser,
        permissions: state.userPermissions
      }
    };
  }

  // Master: Items
  if (endpoint === '/api/items' && method === 'GET') {
    return { ok: true, status: 200, data: { success: true, items: mockData.items } };
  }
  if (endpoint === '/api/items' && method === 'POST') {
    const newItem = { id: mockData.items.length + 1, ...data, is_active: 1 };
    mockData.items.push(newItem);
    return { ok: true, status: 201, data: { success: true, message: 'บันทึกรหัสพัสดุเรียบร้อย' } };
  }

  // Master: Shops
  if (endpoint === '/api/shops' && method === 'GET') {
    return { ok: true, status: 200, data: { success: true, shops: mockData.shops } };
  }
  if (endpoint === '/api/shops' && method === 'POST') {
    const newShop = { id: mockData.shops.length + 1, ...data };
    mockData.shops.push(newShop);
    return { ok: true, status: 201, data: { success: true, message: 'บันทึกร้านค้าเรียบร้อย' } };
  }

  // Buys
  if (endpoint === '/api/buys' && method === 'GET') {
    return { ok: true, status: 200, data: { success: true, buys: [...mockData.buys].reverse() } };
  }
  if (endpoint === '/api/buys' && method === 'POST') {
    const item = mockData.items.find(i => i.item_code === data.item_code);
    const newBuy = {
      id: mockData.buys.length + 1,
      doc_date: data.doc_date,
      doc_no: data.doc_no,
      item_code: data.item_code,
      item_name: item ? item.item_name : data.item_code,
      category: item ? item.category : '',
      unit: item ? item.unit : '',
      price_per_unit: Number(data.price_per_unit),
      quantity: Number(data.quantity),
      total_price: Math.round(Number(data.quantity) * Number(data.price_per_unit) * 100) / 100,
      shop_name: data.shop_name,
      remark: data.remark || '',
      ym_period: data.doc_date.slice(0, 7),
      created_by: state.currentUser ? state.currentUser.username : 'demo'
    };
    mockData.buys.push(newBuy);
    return { ok: true, status: 201, data: { success: true, message: 'บันทึกรับเข้าพัสดุเรียบร้อยแล้ว' } };
  }

  // Pays (With Zero Negative Stock Check)
  if (endpoint === '/api/pays' && method === 'GET') {
    return { ok: true, status: 200, data: { success: true, pays: [...mockData.pays].reverse() } };
  }
  if (endpoint === '/api/pays' && method === 'POST') {
    const stockList = calculateMockStockBalance();
    const stock = stockList.find(s => s.item_code === data.item_code);
    const qty = Number(data.quantity);

    if (!stock) {
      return { ok: false, status: 404, data: { success: false, message: 'ไม่พบรหัสพัสดุ' } };
    }

    if (qty > stock.balance_qty) {
      return {
        ok: false,
        status: 400,
        data: {
          success: false,
          error: 'INSUFFICIENT_STOCK',
          message: `ยอดคงเหลือในคลังไม่เพียงพอ! คงเหลือจริงเพียง ${stock.balance_qty} ${stock.unit} ไม่อนุญาตให้เบิกติดลบ`,
          available_qty: stock.balance_qty
        }
      };
    }

    const newPay = {
      id: mockData.pays.length + 1,
      doc_date: data.doc_date,
      doc_no: data.doc_no,
      item_code: data.item_code,
      item_name: stock.item_name,
      category: stock.category,
      unit: stock.unit,
      price_per_unit: Number(data.price_per_unit) || stock.avg_unit_price,
      quantity: qty,
      total_price: Math.round(qty * (Number(data.price_per_unit) || stock.avg_unit_price) * 100) / 100,
      department: data.department,
      remark: data.remark || '',
      ym_period: data.doc_date.slice(0, 7),
      created_by: state.currentUser ? state.currentUser.username : 'demo'
    };
    mockData.pays.push(newPay);
    return { ok: true, status: 201, data: { success: true, message: 'บันทึกเบิกจ่ายพัสดุเรียบร้อยแล้ว' } };
  }

  // Stock Card Report
  if (endpoint.startsWith('/api/reports/stock-card/')) {
    const parts = endpoint.split('?')[0].split('/');
    const item_code = decodeURIComponent(parts[4]);
    const urlObj = new URL('http://local' + endpoint);
    const start_date = urlObj.searchParams.get('start_date') || '2024-01-01';
    const end_date = urlObj.searchParams.get('end_date') || new Date().toISOString().slice(0, 10);

    const item = mockData.items.find(i => i.item_code === item_code);
    if (!item) {
      return { ok: false, status: 404, data: { success: false, message: 'ไม่พบพัสดุ' } };
    }

    // Opening balance before start_date
    const buysBefore = mockData.buys.filter(b => b.item_code === item_code && b.doc_date < start_date);
    const paysBefore = mockData.pays.filter(p => p.item_code === item_code && p.doc_date < start_date);

    const inQtyBf = buysBefore.reduce((s, b) => s + b.quantity, 0);
    const inValBf = buysBefore.reduce((s, b) => s + b.total_price, 0);
    const outQtyBf = paysBefore.reduce((s, p) => s + p.quantity, 0);
    const outValBf = paysBefore.reduce((s, p) => s + p.total_price, 0);

    const opening_qty = inQtyBf - outQtyBf;
    const opening_val = inValBf - outValBf;

    // In Range movements
    const buysInRange = mockData.buys
      .filter(b => b.item_code === item_code && b.doc_date >= start_date && b.doc_date <= end_date)
      .map(b => ({
        type: 'BUY',
        doc_date: b.doc_date,
        doc_no: b.doc_no,
        party: b.shop_name,
        in_qty: b.quantity,
        in_price: b.price_per_unit,
        in_val: b.total_price,
        out_qty: 0,
        out_price: 0,
        out_val: 0,
        remark: b.remark,
        id: b.id
      }));

    const paysInRange = mockData.pays
      .filter(p => p.item_code === item_code && p.doc_date >= start_date && p.doc_date <= end_date)
      .map(p => ({
        type: 'PAY',
        doc_date: p.doc_date,
        doc_no: p.doc_no,
        party: p.department,
        in_qty: 0,
        in_price: 0,
        in_val: 0,
        out_qty: p.quantity,
        out_price: p.price_per_unit,
        out_val: p.total_price,
        remark: p.remark,
        id: p.id
      }));

    const rawTx = [...buysInRange, ...paysInRange].sort((a, b) => a.doc_date.localeCompare(b.doc_date) || a.id - b.id);

    let running_qty = opening_qty;
    let running_val = opening_val;
    let totalInQty = 0, totalInVal = 0, totalOutQty = 0, totalOutVal = 0;

    const transactions = rawTx.map(tx => {
      totalInQty += tx.in_qty;
      totalInVal += tx.in_val;
      totalOutQty += tx.out_qty;
      totalOutVal += tx.out_val;
      running_qty += (tx.in_qty - tx.out_qty);
      running_val += (tx.in_val - tx.out_val);
      return {
        ...tx,
        balance_qty: Math.round(running_qty * 100) / 100,
        balance_val: Math.round(running_val * 100) / 100
      };
    });

    return {
      ok: true,
      status: 200,
      data: {
        success: true,
        item,
        period: { start_date, end_date },
        opening_balance: { qty: opening_qty, val: opening_val },
        transactions,
        period_summary: {
          total_in_qty: Math.round(totalInQty * 100) / 100,
          total_in_val: Math.round(totalInVal * 100) / 100,
          total_out_qty: Math.round(totalOutQty * 100) / 100,
          total_out_val: Math.round(totalOutVal * 100) / 100
        },
        closing_balance: {
          qty: Math.round(running_qty * 100) / 100,
          val: Math.round(running_val * 100) / 100
        }
      }
    };
  }

  // Admin Users
  if (endpoint === '/api/admin/users' && method === 'GET') {
    return { ok: true, status: 200, data: { success: true, users: mockData.users, available_page_keys: ALL_PAGES } };
  }
  if (endpoint === '/api/admin/users' && method === 'POST') {
    const newUser = {
      id: mockData.users.length + 1,
      username: data.username,
      fullname: data.fullname,
      department: data.department,
      role: data.role,
      is_active: 1,
      permissions: data.permissions || {}
    };
    mockData.users.push(newUser);
    return { ok: true, status: 201, data: { success: true, message: 'สร้างผู้ใช้สำเร็จ' } };
  }

  return { ok: true, status: 200, data: { success: true } };
}

function updateApiStatusBadge(isLive) {
  const dot = document.getElementById('api-status-dot');
  const text = document.getElementById('api-status-text');
  const modeSpan = document.getElementById('api-current-mode');

  if (isLive) {
    dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    text.textContent = 'Worker เชื่อมต่อแล้ว';
    if (modeSpan) modeSpan.textContent = 'Cloudflare D1 Online';
  } else {
    dot.className = 'w-2 h-2 rounded-full bg-amber-400';
    text.textContent = 'โหมดทดสอบ (Demo)';
    if (modeSpan) modeSpan.textContent = 'Offline / In-Memory Demo';
  }
}

// ============================================================================
// 4. UI Rendering, Dynamic Sidebar & Navigation Guard
// ============================================================================

/**
 * อัปเดต Sidebar และแถบแสดงผลตามสิทธิของผู้ใช้
 */
function updateAuthUI() {
  const guestNav = document.getElementById('nav-guest-section');
  const userNav = document.getElementById('nav-user-section');
  const sidebarUserCard = document.getElementById('sidebar-user-card');
  const sidebarGuestCard = document.getElementById('sidebar-guest-card');

  if (!state.currentUser) {
    // ------------------------------------------------------------------------
    // กรณีผู้ใช้ยังไม่ได้ล็อกอิน (Guest / Public Mode)
    // ------------------------------------------------------------------------
    guestNav.classList.remove('hidden');
    userNav.classList.add('hidden');
    sidebarUserCard.classList.add('hidden');
    sidebarGuestCard.classList.remove('hidden');

    // ซ่อนเมนูทั้งหมด ยกเว้นหน้าตรวจเช็คสต๊อก
    document.querySelectorAll('#sidebar-nav .nav-link').forEach(link => {
      const page = link.getAttribute('data-page');
      if (page === 'stock_balance') {
        link.classList.remove('hidden');
      } else {
        link.classList.add('hidden');
      }
    });

    // หากเปิดอยู่ในหน้าที่ต้องล็อกอิน ให้เด้งกลับหน้าตรวจสต๊อก
    if (state.activePage !== 'stock_balance') {
      navigateToPage('stock_balance');
    }
  } else {
    // ------------------------------------------------------------------------
    // กรณีล็อกอินแล้ว: ดึง Permissions มาเปิด/ปิดเมนูตามสิทธิที่ได้รับจริง
    // ------------------------------------------------------------------------
    guestNav.classList.add('hidden');
    userNav.classList.remove('hidden');
    sidebarUserCard.classList.remove('hidden');
    sidebarGuestCard.classList.add('hidden');

    document.getElementById('nav-user-fullname').textContent = state.currentUser.fullname;
    document.getElementById('nav-user-role').textContent = state.currentUser.role === 'superadmin' ? 'ผู้ดูแลระบบสูงสุด' : state.currentUser.role;
    document.getElementById('sidebar-fullname').textContent = state.currentUser.fullname;
    document.getElementById('sidebar-dept').textContent = state.currentUser.department;
    document.getElementById('sidebar-role-badge').textContent = state.currentUser.role.toUpperCase();

    // ตรวจสอบสิทธิของแต่ละหน้า
    document.querySelectorAll('#sidebar-nav .nav-link').forEach(link => {
      const page = link.getAttribute('data-page');
      if (page === 'stock_balance') {
        link.classList.remove('hidden');
      } else if (page === 'user_mgmt') {
        // เฉพาะ Superadmin เท่านั้นที่จะเห็นเมนูนี้
        if (state.currentUser.role === 'superadmin') {
          link.classList.remove('hidden');
        } else {
          link.classList.add('hidden');
        }
      } else {
        // เมนูทั่วไป ตรวจสอบ can_view
        const perm = state.userPermissions[page];
        if (state.currentUser.role === 'superadmin' || (perm && perm.can_view === 1)) {
          link.classList.remove('hidden');
        } else {
          link.classList.add('hidden');
        }
      }
    });
  }
}

/**
 * นำทางไปยังหน้า (Navigation Guard)
 */
function navigateToPage(pageKey) {
  // ตรวจสอบสิทธิการเข้าถึงหน้านี้
  if (pageKey !== 'stock_balance') {
    if (!state.currentUser) {
      showToast('กรุณาเข้าสู่ระบบก่อนเข้าใช้งานหน้านี้', 'warning');
      openModal('login-modal');
      return;
    }

    if (pageKey === 'user_mgmt' && state.currentUser.role !== 'superadmin') {
      showToast('เฉพาะผู้ดูแลระบบสูงสุด (Superadmin) เท่านั้น', 'error');
      return;
    }

    const perm = state.userPermissions[pageKey];
    if (state.currentUser.role !== 'superadmin' && (!perm || perm.can_view !== 1)) {
      showToast('ท่านไม่มีสิทธิเข้าถึงหน้านี้ (กรุณาติดต่อผู้ดูแลระบบ)', 'error');
      return;
    }
  }

  state.activePage = pageKey;
  window.location.hash = pageKey;

  // ปรับการแสดงผลหน้าเพจ
  document.querySelectorAll('.page-view').forEach(view => view.classList.add('hidden'));
  const targetView = document.getElementById(`page-${pageKey}`);
  if (targetView) targetView.classList.remove('hidden');

  // ปรับสถานะ Active Link ใน Sidebar
  document.querySelectorAll('#sidebar-nav .nav-link').forEach(link => {
    const isTarget = link.getAttribute('data-page') === pageKey;
    if (isTarget) {
      link.classList.add('bg-brand-700', 'text-white');
      link.classList.remove('text-slate-300', 'text-amber-300');
    } else {
      link.classList.remove('bg-brand-700', 'text-white');
      if (link.getAttribute('data-page') === 'user_mgmt') {
        link.classList.add('text-amber-300');
      } else {
        link.classList.add('text-slate-300');
      }
    }
  });

  // โหลดข้อมูลเฉพาะของหน้านั้นๆ
  if (pageKey === 'stock_balance') loadStockBalance();
  if (pageKey === 'buy') initBuyPage();
  if (pageKey === 'pay') initPayPage();
  if (pageKey === 'reports') initReportsPage();
  if (pageKey === 'items') loadItemsMaster();
  if (pageKey === 'shops') loadShopsMaster();
  if (pageKey === 'user_mgmt') loadUsersManagement();
}

// ============================================================================
// 5. Module 1: หน้าตรวจเช็คสต๊อกพัสดุ (Stock Balance)
// ============================================================================

async function loadStockBalance() {
  const search = document.getElementById('stock-search').value.trim();
  const category = document.getElementById('stock-category-filter').value;
  const status = document.getElementById('stock-status-filter').value;

  const tbody = document.getElementById('stock-table-body');
  tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> กำลังโหลดข้อมูล...</td></tr>`;

  // เรียก API
  const query = new URLSearchParams();
  if (search) query.append('q', search);
  if (category) query.append('category', category);
  if (status) query.append('status', status);

  const res = await apiRequest(`/api/public/stock?${query.toString()}`);
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-rose-500">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
    return;
  }

  const { items, summary } = res.data;
  state.stockItems = items || [];

  // อัปเดตการ์ด KPI สรุปผล
  if (summary) {
    document.getElementById('kpi-total-items').textContent = summary.total_items.toLocaleString();
    document.getElementById('kpi-normal-count').textContent = summary.normal_count.toLocaleString();
    document.getElementById('kpi-low-count').textContent = summary.low_stock_count.toLocaleString();
    document.getElementById('kpi-out-count').textContent = summary.out_of_stock_count.toLocaleString();
    document.getElementById('stock-total-val-footer').textContent = `มูลค่ารวมทั้งสิ้น: ${Number(summary.total_inventory_value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`;
  }

  // อัปเดตตารางรายการ
  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-400">ไม่พบรายการพัสดุตามเงื่อนไขที่เลือก</td></tr>`;
    document.getElementById('stock-table-footer').firstElementChild.textContent = 'แสดงทั้งหมด 0 รายการ';
    return;
  }

  document.getElementById('stock-table-footer').firstElementChild.textContent = `แสดงทั้งหมด ${items.length} รายการ`;

  tbody.innerHTML = items.map(item => {
    let badgeClass = 'badge-normal';
    let statusText = 'ปกติ';
    let statusIcon = 'fa-check';

    if (item.stock_status === 'LOW_STOCK') {
      badgeClass = 'badge-low';
      statusText = 'ใกล้หมด';
      statusIcon = 'fa-triangle-exclamation';
    } else if (item.stock_status === 'OUT_OF_STOCK') {
      badgeClass = 'badge-out';
      statusText = 'หมดสต๊อก';
      statusIcon = 'fa-circle-xmark';
    }

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="py-3 px-4 font-mono font-semibold text-slate-900">${item.item_code}</td>
        <td class="py-3 px-4">
          <div class="font-medium text-slate-800">${item.item_name}</div>
        </td>
        <td class="py-3 px-4 text-slate-600">${item.category}</td>
        <td class="py-3 px-4 text-center text-slate-600 font-medium">${item.unit}</td>
        <td class="py-3 px-4 text-right text-emerald-700 font-mono">+${Number(item.total_in_qty).toLocaleString()}</td>
        <td class="py-3 px-4 text-right text-rose-700 font-mono">-${Number(item.total_out_qty).toLocaleString()}</td>
        <td class="py-3 px-4 text-right font-bold font-mono text-base ${item.balance_qty <= 0 ? 'text-rose-600' : 'text-slate-900'}">
          ${Number(item.balance_qty).toLocaleString()}
        </td>
        <td class="py-3 px-4 text-right font-mono text-slate-500">${Number(item.min_stock).toLocaleString()}</td>
        <td class="py-3 px-4 text-center">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass}">
            <i class="fa-solid ${statusIcon} mr-1 text-[10px]"></i> ${statusText}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <button onclick="viewStockCardDirect('${item.item_code}')" class="text-brand-700 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 p-1.5 rounded-md text-xs font-medium transition" title="เปิดบัตรคุมพัสดุ">
            <i class="fa-solid fa-file-invoice mr-1"></i> สต๊อกการ์ด
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================================================
// 6. Module 2: บันทึกรับเข้าพัสดุ (Buy)
// ============================================================================

async function initBuyPage() {
  document.getElementById('buy-doc-date').value = new Date().toISOString().slice(0, 10);
  await populateItemDropdown('buy-item-code');
  await populateShopDropdown('buy-shop-name');
  loadRecentBuys();
}

async function loadRecentBuys() {
  const res = await apiRequest('/api/buys?limit=15');
  const tbody = document.getElementById('recent-buys-table-body');
  if (!res.ok || !res.data.buys) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">ยังไม่มีประวัติการรับเข้า</td></tr>`;
    return;
  }

  const buys = res.data.buys;
  state.recentBuys = buys;

  tbody.innerHTML = buys.map(b => `
    <tr class="hover:bg-slate-50 border-b border-slate-100">
      <td class="py-2.5 px-3 font-mono">${b.doc_date}</td>
      <td class="py-2.5 px-3 font-mono font-medium text-slate-800">${b.doc_no}</td>
      <td class="py-2.5 px-3">
        <span class="font-bold text-slate-800">${b.item_code}</span>: ${b.item_name}
      </td>
      <td class="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">+${Number(b.quantity).toLocaleString()} ${b.unit}</td>
      <td class="py-2.5 px-3 text-right font-mono text-slate-600">${Number(b.price_per_unit).toFixed(2)}</td>
      <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-900">${Number(b.total_price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      <td class="py-2.5 px-3 text-slate-600 truncate max-w-xs">${b.shop_name}</td>
    </tr>
  `).join('');
}

// ============================================================================
// 7. Module 3: บันทึกเบิกจ่ายพัสดุ (Pay) - ป้องกันสต๊อกติดลบ 100%
// ============================================================================

async function initPayPage() {
  document.getElementById('pay-doc-date').value = new Date().toISOString().slice(0, 10);
  await populateItemDropdown('pay-item-code');
  loadRecentPays();
}

async function loadRecentPays() {
  const res = await apiRequest('/api/pays?limit=15');
  const tbody = document.getElementById('recent-pays-table-body');
  if (!res.ok || !res.data.pays) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">ยังไม่มีประวัติการเบิกจ่าย</td></tr>`;
    return;
  }

  const pays = res.data.pays;
  state.recentPays = pays;

  tbody.innerHTML = pays.map(p => `
    <tr class="hover:bg-slate-50 border-b border-slate-100">
      <td class="py-2.5 px-3 font-mono">${p.doc_date}</td>
      <td class="py-2.5 px-3 font-mono font-medium text-slate-800">${p.doc_no}</td>
      <td class="py-2.5 px-3">
        <span class="font-bold text-slate-800">${p.item_code}</span>: ${p.item_name}
      </td>
      <td class="py-2.5 px-3 text-right font-mono font-semibold text-rose-700">-${Number(p.quantity).toLocaleString()} ${p.unit}</td>
      <td class="py-2.5 px-3 text-right font-mono text-slate-600">${Number(p.price_per_unit).toFixed(2)}</td>
      <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-900">${Number(p.total_price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      <td class="py-2.5 px-3 text-slate-700 font-medium truncate max-w-xs">${p.department}</td>
    </tr>
  `).join('');
}

/**
 * Real-time Stock Negative Prevention Validation บนหน้าจอ Pay
 */
function validatePayQuantity() {
  const itemCode = document.getElementById('pay-item-code').value;
  const qtyInput = document.getElementById('pay-qty');
  const qty = parseFloat(qtyInput.value) || 0;
  const warningBox = document.getElementById('pay-insufficient-warning');
  const warningText = document.getElementById('pay-warning-text');
  const submitBtn = document.getElementById('btn-submit-pay');

  if (!itemCode) {
    warningBox.classList.add('hidden');
    submitBtn.disabled = false;
    return;
  }

  const stock = state.stockItems.find(s => s.item_code === itemCode);
  const currentBalance = stock ? Number(stock.balance_qty) : 0;
  const unit = stock ? stock.unit : 'หน่วย';

  if (qty > currentBalance) {
    // แจ้งเตือนสีแดงทันที และปิดปุ่มกดส่ง
    warningBox.classList.remove('hidden');
    warningText.textContent = `จำนวนที่ขอเบิก (${qty} ${unit}) เกินยอดคงเหลือจริงในคลัง (คงเหลือเพียง ${currentBalance} ${unit}) ไม่สามารถบันทึกติดลบได้`;
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
  } else {
    warningBox.classList.add('hidden');
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}

// ============================================================================
// 8. Module 4: บัตรคุมพัสดุและการพิมพ์ (Stock Card & Official Print)
// ============================================================================

async function initReportsPage() {
  await populateItemDropdown('report-item-code');

  const now = new Date();
  const currentYear = now.getFullYear();
  document.getElementById('report-start-date').value = `${currentYear}-01-01`;
  document.getElementById('report-end-date').value = now.toISOString().slice(0, 10);
}

function viewStockCardDirect(itemCode) {
  navigateToPage('reports');
  const select = document.getElementById('report-item-code');
  select.value = itemCode;
  fetchStockCardReport();
}

async function fetchStockCardReport() {
  const itemCode = document.getElementById('report-item-code').value;
  const startDate = document.getElementById('report-start-date').value;
  const endDate = document.getElementById('report-end-date').value;

  if (!itemCode) {
    showToast('กรุณาเลือกรหัสพัสดุก่อนค้นหา', 'warning');
    return;
  }

  const tbody = document.getElementById('stock-card-table-body');
  const tfoot = document.getElementById('stock-card-table-foot');
  tbody.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> กำลังคำนวณบัตรคุมพัสดุ...</td></tr>`;

  const res = await apiRequest(`/api/reports/stock-card/${encodeURIComponent(itemCode)}?start_date=${startDate}&end_date=${endDate}`);
  if (!res.ok || !res.data.success) {
    tbody.innerHTML = `<tr><td colspan="12" class="text-center py-6 text-rose-500">เกิดข้อผิดพลาดในการโหลดบัตรคุมพัสดุ</td></tr>`;
    return;
  }

  const report = res.data;
  const item = report.item;

  // กรอกข้อมูลหัวกระดาษบัตรคุมพัสดุ
  document.getElementById('sc-item-name').textContent = item.item_name;
  document.getElementById('sc-item-code').textContent = item.item_code;
  document.getElementById('sc-category').textContent = item.category;
  document.getElementById('sc-unit').textContent = item.unit;
  document.getElementById('sc-min').textContent = `${Number(item.min_stock).toLocaleString()} ${item.unit}`;
  document.getElementById('sc-max').textContent = `${Number(item.max_stock).toLocaleString()} ${item.unit}`;
  document.getElementById('sc-period').textContent = `${report.period.start_date} ถึง ${report.period.end_date}`;

  // บรรทัดแรก: ยอดยกมา (Brought Forward)
  let rowsHtml = `
    <tr class="bg-amber-50/50 font-bold border-b border-slate-300">
      <td class="p-2 border border-slate-300 text-center font-mono">${report.period.start_date}</td>
      <td class="p-2 border border-slate-300 text-center font-mono">-</td>
      <td class="p-2 border border-slate-300 text-slate-900 font-bold">ยอดยกมา (Brought Forward)</td>
      <td class="p-1 border border-slate-300 text-right">-</td>
      <td class="p-1 border border-slate-300 text-right">-</td>
      <td class="p-1 border border-slate-300 text-right">-</td>
      <td class="p-1 border border-slate-300 text-right">-</td>
      <td class="p-1 border border-slate-300 text-right">-</td>
      <td class="p-1 border border-slate-300 text-right">-</td>
      <td class="p-1 border border-slate-300 text-right font-bold text-slate-900 font-mono">${Number(report.opening_balance.qty).toLocaleString()}</td>
      <td class="p-1 border border-slate-300 text-right font-bold text-slate-900 font-mono">${Number(report.opening_balance.val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      <td class="p-2 border border-slate-300 text-slate-500 text-center">-</td>
    </tr>
  `;

  // แถวรายการเคลื่อนไหวรับเข้า - เบิกจ่าย พร้อม Running Balance ทีละบรรทัด
  report.transactions.forEach(tx => {
    const isBuy = tx.type === 'BUY';
    rowsHtml += `
      <tr class="hover:bg-slate-50 border-b border-slate-200">
        <td class="p-2 border border-slate-300 text-center font-mono">${tx.doc_date}</td>
        <td class="p-2 border border-slate-300 text-center font-mono font-medium">${tx.doc_no}</td>
        <td class="p-2 border border-slate-300">${tx.party || '-'}</td>
        
        <!-- รับเข้า -->
        <td class="p-1 border border-slate-300 text-right font-mono ${isBuy ? 'text-emerald-800 font-bold' : 'text-slate-400'}">
          ${isBuy ? Number(tx.in_qty).toLocaleString() : '-'}
        </td>
        <td class="p-1 border border-slate-300 text-right font-mono ${isBuy ? 'text-slate-700' : 'text-slate-400'}">
          ${isBuy ? Number(tx.in_price).toFixed(2) : '-'}
        </td>
        <td class="p-1 border border-slate-300 text-right font-mono ${isBuy ? 'text-slate-900 font-bold' : 'text-slate-400'}">
          ${isBuy ? Number(tx.in_val).toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}
        </td>

        <!-- จ่ายออก -->
        <td class="p-1 border border-slate-300 text-right font-mono ${!isBuy ? 'text-rose-800 font-bold' : 'text-slate-400'}">
          ${!isBuy ? Number(tx.out_qty).toLocaleString() : '-'}
        </td>
        <td class="p-1 border border-slate-300 text-right font-mono ${!isBuy ? 'text-slate-700' : 'text-slate-400'}">
          ${!isBuy ? Number(tx.out_price).toFixed(2) : '-'}
        </td>
        <td class="p-1 border border-slate-300 text-right font-mono ${!isBuy ? 'text-slate-900 font-bold' : 'text-slate-400'}">
          ${!isBuy ? Number(tx.out_val).toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}
        </td>

        <!-- ยอดคงเหลือสะสมสุทธิ (Running Balance) -->
        <td class="p-1 border border-slate-300 text-right font-mono font-bold text-slate-900">
          ${Number(tx.balance_qty).toLocaleString()}
        </td>
        <td class="p-1 border border-slate-300 text-right font-mono font-bold text-slate-900">
          ${Number(tx.balance_val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
        </td>
        <td class="p-2 border border-slate-300 text-slate-500 text-xs">${tx.remark || ''}</td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml;

  // แถวสรุปท้ายตาราง (Summary Footer)
  tfoot.innerHTML = `
    <tr class="bg-slate-100 font-bold border-t-2 border-slate-400">
      <td colspan="3" class="p-2 border border-slate-300 text-right">รวมยอดการเคลื่อนไหวในงวด:</td>
      <td class="p-1 border border-slate-300 text-right font-mono text-emerald-800">${Number(report.period_summary.total_in_qty).toLocaleString()}</td>
      <td class="p-1 border border-slate-300 text-right">-</td>
      <td class="p-1 border border-slate-300 text-right font-mono text-emerald-800">${Number(report.period_summary.total_in_val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      <td class="p-1 border border-slate-300 text-right font-mono text-rose-800">${Number(report.period_summary.total_out_qty).toLocaleString()}</td>
      <td class="p-1 border border-slate-300 text-right">-</td>
      <td class="p-1 border border-slate-300 text-right font-mono text-rose-800">${Number(report.period_summary.total_out_val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      <td class="p-1 border border-slate-300 text-right font-mono text-slate-900 text-base">${Number(report.closing_balance.qty).toLocaleString()}</td>
      <td class="p-1 border border-slate-300 text-right font-mono text-slate-900 text-base">${Number(report.closing_balance.val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      <td class="p-2 border border-slate-300 text-center">ยอดยกไป</td>
    </tr>
  `;
}

// ============================================================================
// 9. Module 5 & 6: ทะเบียนรหัสพัสดุ และ ข้อมูลร้านค้า
// ============================================================================

async function loadItemsMaster() {
  const res = await apiRequest('/api/items');
  const tbody = document.getElementById('items-table-body');
  if (!res.ok) return;

  const items = res.data.items || [];
  tbody.innerHTML = items.map(i => `
    <tr class="hover:bg-slate-50 border-b border-slate-100">
      <td class="py-3 px-4 font-mono font-bold text-slate-900">${i.item_code}</td>
      <td class="py-3 px-4 font-medium text-slate-800">${i.item_name}</td>
      <td class="py-3 px-4 text-slate-600">${i.category}</td>
      <td class="py-3 px-4 text-center font-medium">${i.unit}</td>
      <td class="py-3 px-4 text-right font-mono text-amber-700">${Number(i.min_stock).toLocaleString()}</td>
      <td class="py-3 px-4 text-right font-mono text-slate-600">${Number(i.max_stock).toLocaleString()}</td>
      <td class="py-3 px-4 text-center">
        <span class="px-2 py-0.5 rounded text-xs ${i.is_active === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
          ${i.is_active === 1 ? 'ใช้งาน' : 'ระงับ'}
        </span>
      </td>
      <td class="py-3 px-4 text-center">
        <button onclick="editItemModal(${JSON.stringify(i).replace(/"/g, '&quot;')})" class="text-indigo-600 hover:text-indigo-800 text-xs font-medium">
          <i class="fa-solid fa-pen-to-square mr-1"></i> แก้ไข
        </button>
      </td>
    </tr>
  `).join('');
}

async function loadShopsMaster() {
  const res = await apiRequest('/api/shops');
  const tbody = document.getElementById('shops-table-body');
  if (!res.ok) return;

  const shops = res.data.shops || [];
  state.shops = shops;

  tbody.innerHTML = shops.map((s, idx) => `
    <tr class="hover:bg-slate-50 border-b border-slate-100">
      <td class="py-3 px-4 font-mono text-slate-400">${idx + 1}</td>
      <td class="py-3 px-4 font-bold text-slate-800">${s.shop_name}</td>
      <td class="py-3 px-4 text-slate-600">${s.address || '-'}</td>
      <td class="py-3 px-4 font-mono text-slate-600">${s.phone || '-'}</td>
      <td class="py-3 px-4 font-mono text-slate-600">${s.tax_id || '-'}</td>
      <td class="py-3 px-4 text-center">
        <button onclick="editShopModal(${JSON.stringify(s).replace(/"/g, '&quot;')})" class="text-amber-600 hover:text-amber-800 text-xs font-medium">
          <i class="fa-solid fa-pen-to-square mr-1"></i> แก้ไข
        </button>
      </td>
    </tr>
  `).join('');
}

// ============================================================================
// 10. Module 7: จัดการผู้ใช้และสิทธิ (User & Permissions Management)
// ============================================================================

async function loadUsersManagement() {
  const res = await apiRequest('/api/admin/users');
  const tbody = document.getElementById('users-table-body');
  if (!res.ok) return;

  const users = res.data.users || [];
  state.users = users;

  tbody.innerHTML = users.map(u => {
    const isSuper = u.role === 'superadmin';
    const activeClass = u.is_active === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
    const activeText = u.is_active === 1 ? 'ใช้งานปกติ' : 'ระงับใช้งาน';

    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="py-3 px-4 font-mono font-bold text-slate-900">${u.username}</td>
        <td class="py-3 px-4 font-medium text-slate-800">${u.fullname}</td>
        <td class="py-3 px-4 text-slate-600 text-xs">${u.department}</td>
        <td class="py-3 px-4 text-center">
          <span class="px-2 py-0.5 rounded text-xs font-mono font-bold ${isSuper ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}">
            ${u.role.toUpperCase()}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <span class="px-2 py-0.5 rounded-full text-xs font-medium ${activeClass}">
            ${activeText}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <button onclick="openEditPermissionModal(${u.id})" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-2 py-1 rounded border border-slate-300 font-medium transition">
            <i class="fa-solid fa-sliders mr-1 text-slate-500"></i> สิทธิ (${Object.keys(u.permissions || {}).length} หน้า)
          </button>
        </td>
        <td class="py-3 px-4 text-center space-x-2">
          ${u.id !== 1 ? `
            <button onclick="toggleUserStatus(${u.id})" class="text-xs ${u.is_active === 1 ? 'text-rose-600 hover:text-rose-800' : 'text-emerald-600 hover:text-emerald-800'} font-medium">
              ${u.is_active === 1 ? '<i class="fa-solid fa-ban"></i> ระงับ' : '<i class="fa-solid fa-check"></i> เปิดใช้'}
            </button>
          ` : '<span class="text-xs text-slate-400">บัญชีหลัก</span>'}
          <button onclick="openResetPasswordModal(${u.id}, '${u.username}')" class="text-xs text-slate-600 hover:text-slate-900 font-medium">
            <i class="fa-solid fa-key"></i> รีเซ็ตรหัส
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openEditPermissionModal(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('perm-edit-user-id').value = user.id;
  document.getElementById('perm-modal-user-info').textContent = `ผู้ใช้: ${user.fullname} (${user.username}) - บทบาท: ${user.role}`;

  const tbody = document.getElementById('matrix-edit-body');
  tbody.innerHTML = ALL_PAGES.map(pageKey => {
    const meta = PAGE_METADATA[pageKey] || { name: pageKey };
    const perm = user.permissions[pageKey] || { can_view: 0, can_edit: 0 };
    const isSuper = user.role === 'superadmin';

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-2.5 font-medium text-slate-800 flex items-center space-x-2">
          <i class="fa-solid ${meta.icon} text-slate-400 w-4 text-center"></i>
          <span>${meta.name}</span>
          <span class="text-[10px] text-slate-400 font-mono">(${pageKey})</span>
        </td>
        <td class="p-2.5 text-center">
          <input type="checkbox" name="view_${pageKey}" ${perm.can_view || isSuper ? 'checked' : ''} ${isSuper ? 'disabled' : ''} class="w-4 h-4 text-brand-600 rounded">
        </td>
        <td class="p-2.5 text-center">
          <input type="checkbox" name="edit_${pageKey}" ${perm.can_edit || isSuper ? 'checked' : ''} ${isSuper ? 'disabled' : ''} class="w-4 h-4 text-brand-600 rounded">
        </td>
      </tr>
    `;
  }).join('');

  openModal('permission-edit-modal');
}

function openResetPasswordModal(userId, username) {
  document.getElementById('reset-pw-user-id').value = userId;
  document.getElementById('reset-pw-username').textContent = username;
  document.getElementById('reset-pw-new').value = '';
  openModal('reset-password-modal');
}

async function toggleUserStatus(userId) {
  const res = await apiRequest(`/api/admin/users/${userId}/toggle-status`, 'PUT');
  if (res.ok) {
    showToast(res.data.message || 'ปรับปรุงสถานะสำเร็จ', 'success');
    loadUsersManagement();
  } else {
    showToast(res.data.message || 'เกิดข้อผิดพลาด', 'error');
  }
}

// ============================================================================
// 11. Modal Utilities & Dropdown Helpers
// ============================================================================

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('hidden');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');

  const bgClasses = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    warning: 'bg-amber-600 text-white',
    info: 'bg-slate-800 text-white'
  };

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  toast.className = `${bgClasses[type] || bgClasses.info} px-4 py-3 rounded-lg shadow-xl text-sm font-medium flex items-center space-x-2 animate-fade-in pointer-events-auto max-w-sm`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> <span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

async function populateItemDropdown(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  if (state.stockItems.length === 0) {
    const res = await apiRequest('/api/public/stock');
    if (res.ok && res.data.items) {
      state.stockItems = res.data.items;
    }
  }

  const currentValue = select.value;
  select.innerHTML = '<option value="">-- เลือกรหัสพัสดุ --</option>' + state.stockItems.map(item => `
    <option value="${item.item_code}" data-name="${item.item_name}" data-unit="${item.unit}" data-cat="${item.category}" data-price="${item.avg_unit_price || 0}" data-balance="${item.balance_qty}">
      ${item.item_code} : ${item.item_name} (คงเหลือ: ${item.balance_qty} ${item.unit})
    </option>
  `).join('');

  if (currentValue) select.value = currentValue;
}

async function populateShopDropdown(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  if (state.shops.length === 0) {
    const res = await apiRequest('/api/shops');
    if (res.ok && res.data.shops) {
      state.shops = res.data.shops;
    }
  }

  select.innerHTML = '<option value="">-- เลือกร้านค้า / แหล่งรับ --</option>' + state.shops.map(s => `
    <option value="${s.shop_name}">${s.shop_name}</option>
  `).join('');
}

function initCategoryFilter() {
  const select = document.getElementById('stock-category-filter');
  apiRequest('/api/public/categories').then(res => {
    if (res.ok && res.data.categories) {
      select.innerHTML = '<option value="">-- ทุกกลุ่มพัสดุ --</option>' + res.data.categories.map(c => `
        <option value="${c}">${c}</option>
      `).join('');
    }
  });
}

function initPermissionMatrixCreateForm() {
  const tbody = document.getElementById('matrix-create-body');
  if (!tbody) return;

  tbody.innerHTML = ALL_PAGES.map(pageKey => {
    const meta = PAGE_METADATA[pageKey] || { name: pageKey };
    return `
      <tr class="hover:bg-slate-50">
        <td class="p-2.5 font-medium text-slate-800 flex items-center space-x-2">
          <i class="fa-solid ${meta.icon} text-slate-400 w-4 text-center"></i>
          <span>${meta.name}</span>
          <span class="text-[10px] text-slate-400 font-mono">(${pageKey})</span>
        </td>
        <td class="p-2.5 text-center">
          <input type="checkbox" name="view_${pageKey}" class="w-4 h-4 text-brand-600 rounded">
        </td>
        <td class="p-2.5 text-center">
          <input type="checkbox" name="edit_${pageKey}" class="w-4 h-4 text-brand-600 rounded">
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================================================
// 12. Event Listeners & Bootstrapping
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initial State & Auto Login from saved Token
  initCategoryFilter();
  initPermissionMatrixCreateForm();

  if (state.token) {
    const res = await apiRequest('/api/auth/me');
    if (res.ok && res.data.success) {
      state.currentUser = res.data.user;
      state.userPermissions = res.data.permissions;
    } else {
      localStorage.removeItem('saiyok_token');
      state.token = null;
    }
  }

  updateAuthUI();
  navigateToPage(window.location.hash.replace('#', '') || 'stock_balance');

  // 2. Navigation Link Events
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      navigateToPage(page);
    });
  });

  // 3. Login Modal & Form
  document.getElementById('btn-open-login').addEventListener('click', () => {
    openModal('login-modal');
  });

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    const res = await apiRequest('/api/auth/login', 'POST', { username, password });
    if (res.ok && res.data.success) {
      state.token = res.data.token;
      state.currentUser = res.data.user;
      state.userPermissions = res.data.permissions;
      localStorage.setItem('saiyok_token', state.token);

      closeModal('login-modal');
      showToast(`ยินดีต้อนรับ ${state.currentUser.fullname}`, 'success');
      updateAuthUI();
      loadStockBalance();
    } else {
      showToast(res.data.message || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
    }
  });

  // 4. Logout Action
  document.getElementById('btn-logout').addEventListener('click', () => {
    state.currentUser = null;
    state.userPermissions = {};
    state.token = null;
    localStorage.removeItem('saiyok_token');
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
    updateAuthUI();
  });

  // 5. Stock Balance Search & Filters
  document.getElementById('stock-search').addEventListener('input', debounce(loadStockBalance, 300));
  document.getElementById('stock-category-filter').addEventListener('change', loadStockBalance);
  document.getElementById('stock-status-filter').addEventListener('change', loadStockBalance);
  document.getElementById('btn-refresh-stock').addEventListener('click', () => {
    loadStockBalance();
    showToast('รีเฟรชข้อมูลสต๊อกเรียบร้อย', 'info');
  });

  // Export CSV
  document.getElementById('btn-export-stock-csv').addEventListener('click', () => {
    if (!state.stockItems.length) return;
    let csv = '\uFEFFรหัสพัสดุ,ชื่อพัสดุ,กลุ่มพัสดุ,หน่วยนับ,รับสะสม,จ่ายสะสม,คงเหลือสุทธิ,เกณฑ์ต่ำสุด,เกณฑ์สูงสุด,สถานะ\n';
    state.stockItems.forEach(i => {
      csv += `"${i.item_code}","${i.item_name}","${i.category}","${i.unit}",${i.total_in_qty},${i.total_out_qty},${i.balance_qty},${i.min_stock},${i.max_stock},"${i.stock_status}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `สต๊อกพัสดุ_รพ_ไทรโยค_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  });

  // 6. Buy Module Form Events
  document.getElementById('buy-item-code').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    const infoBox = document.getElementById('buy-item-info');
    if (opt && opt.value) {
      infoBox.classList.remove('hidden');
      document.getElementById('buy-preview-name').textContent = opt.getAttribute('data-name');
      document.getElementById('buy-preview-cat').textContent = opt.getAttribute('data-cat');
      document.getElementById('buy-preview-unit').textContent = opt.getAttribute('data-unit');
    } else {
      infoBox.classList.add('hidden');
    }
  });

  function calculateBuyTotal() {
    const qty = parseFloat(document.getElementById('buy-qty').value) || 0;
    const price = parseFloat(document.getElementById('buy-price').value) || 0;
    const total = qty * price;
    document.getElementById('buy-total-display').textContent = `${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`;
  }
  document.getElementById('buy-qty').addEventListener('input', calculateBuyTotal);
  document.getElementById('buy-price').addEventListener('input', calculateBuyTotal);

  document.getElementById('form-buy').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      doc_date: document.getElementById('buy-doc-date').value,
      doc_no: document.getElementById('buy-doc-no').value,
      item_code: document.getElementById('buy-item-code').value,
      quantity: document.getElementById('buy-qty').value,
      price_per_unit: document.getElementById('buy-price').value,
      shop_name: document.getElementById('buy-shop-name').value,
      remark: document.getElementById('buy-remark').value
    };

    const res = await apiRequest('/api/buys', 'POST', data);
    if (res.ok && res.data.success) {
      showToast(res.data.message || 'บันทึกรับเข้าพัสดุเรียบร้อยแล้ว', 'success');
      document.getElementById('form-buy').reset();
      document.getElementById('buy-doc-date').value = new Date().toISOString().slice(0, 10);
      document.getElementById('buy-total-display').textContent = '0.00 บาท';
      document.getElementById('buy-item-info').classList.add('hidden');
      loadRecentBuys();
    } else {
      showToast(res.data.message || 'บันทึกรับเข้าล้มเหลว', 'error');
    }
  });

  // 7. Pay Module Form Events & Real-time Validation
  document.getElementById('pay-item-code').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    const alertBox = document.getElementById('pay-stock-alert-box');
    if (opt && opt.value) {
      alertBox.classList.remove('hidden');
      const balance = Number(opt.getAttribute('data-balance') || 0);
      const unit = opt.getAttribute('data-unit') || '';
      const price = Number(opt.getAttribute('data-price') || 0);

      document.getElementById('pay-current-stock-badge').textContent = `${balance.toLocaleString()} ${unit}`;
      document.getElementById('pay-current-avg-price').textContent = price.toFixed(2);
      validatePayQuantity();
    } else {
      alertBox.classList.add('hidden');
    }
  });

  document.getElementById('pay-qty').addEventListener('input', validatePayQuantity);

  document.getElementById('form-pay').addEventListener('submit', async (e) => {
    e.preventDefault();
    const itemCode = document.getElementById('pay-item-code').value;
    const qty = parseFloat(document.getElementById('pay-qty').value) || 0;

    const data = {
      doc_date: document.getElementById('pay-doc-date').value,
      doc_no: document.getElementById('pay-doc-no').value,
      item_code: itemCode,
      quantity: qty,
      department: document.getElementById('pay-department').value,
      remark: document.getElementById('pay-remark').value
    };

    const res = await apiRequest('/api/pays', 'POST', data);
    if (res.ok && res.data.success) {
      showToast(res.data.message || 'บันทึกเบิกจ่ายพัสดุสำเร็จ', 'success');
      document.getElementById('form-pay').reset();
      document.getElementById('pay-doc-date').value = new Date().toISOString().slice(0, 10);
      document.getElementById('pay-stock-alert-box').classList.add('hidden');
      loadRecentPays();
      // อัปเดตแคชยอดคงเหลือ
      await loadStockBalance();
    } else {
      showToast(res.data.message || 'บันทึกเบิกจ่ายล้มเหลว', 'error');
    }
  });

  // 8. Stock Card & Print Controls
  document.getElementById('btn-fetch-stock-card').addEventListener('click', fetchStockCardReport);
  document.getElementById('btn-print-stock-card').addEventListener('click', () => {
    window.print();
  });

  document.querySelectorAll('.btn-preset-date').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      const now = new Date();
      const currentYear = now.getFullYear();
      let start = `${currentYear}-01-01`;
      let end = now.toISOString().slice(0, 10);

      if (preset === 'month') {
        const month = String(now.getMonth() + 1).padStart(2, '0');
        start = `${currentYear}-${month}-01`;
      } else if (preset === 'quarter') {
        const qMonth = Math.floor(now.getMonth() / 3) * 3 + 1;
        start = `${currentYear}-${String(qMonth).padStart(2, '0')}-01`;
      } else if (preset === 'year') {
        // ปีงบประมาณไทย เริ่ม 1 ต.ค.
        if (now.getMonth() >= 9) {
          start = `${currentYear}-10-01`;
        } else {
          start = `${currentYear - 1}-10-01`;
        }
      }

      document.getElementById('report-start-date').value = start;
      document.getElementById('report-end-date').value = end;
      if (document.getElementById('report-item-code').value) {
        fetchStockCardReport();
      }
    });
  });

  // 9. API Settings Modal
  document.getElementById('btn-open-api-settings').addEventListener('click', () => {
    document.getElementById('input-api-url').value = state.apiBaseUrl;
    openModal('api-settings-modal');
  });

  document.getElementById('btn-test-api-conn').addEventListener('click', async () => {
    const testUrl = document.getElementById('input-api-url').value.trim();
    const resultSpan = document.getElementById('api-test-result');
    resultSpan.textContent = 'กำลังทดสอบ...';
    try {
      const res = await fetch(`${testUrl.replace(/\/+$/, '')}/api/public/info`);
      const data = await res.json();
      if (data.status === 'online') {
        resultSpan.textContent = 'เชื่อมต่อสำเร็จ (Online)';
        resultSpan.className = 'font-bold text-emerald-600';
      } else {
        resultSpan.textContent = 'เชื่อมต่อได้ แต่ส่งค่าผิดรูปแบบ';
        resultSpan.className = 'font-bold text-amber-600';
      }
    } catch (e) {
      resultSpan.textContent = 'เชื่อมต่อไม่ได้ (ตรวจสอบ URL หรือ CORS)';
      resultSpan.className = 'font-bold text-rose-600';
    }
  });

  document.getElementById('btn-save-api-url').addEventListener('click', () => {
    const newUrl = document.getElementById('input-api-url').value.trim();
    state.apiBaseUrl = newUrl;
    localStorage.setItem('saiyok_api_url', newUrl);
    closeModal('api-settings-modal');
    showToast('บันทึกการตั้งค่า API แล้ว', 'success');
    loadStockBalance();
  });

  // 10. Close Modal Buttons
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-backdrop').classList.add('hidden');
    });
  });

  // 11. Modal Forms: Items Master
  document.getElementById('btn-open-create-item').addEventListener('click', () => {
    document.getElementById('item-modal-title').textContent = 'เพิ่มพัสดุใหม่';
    document.getElementById('modal-item-id').value = '';
    document.getElementById('form-item-modal').reset();
    openModal('item-modal');
  });

  document.getElementById('form-item-modal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('modal-item-id').value;
    const data = {
      item_code: document.getElementById('modal-item-code').value.trim(),
      item_name: document.getElementById('modal-item-name').value.trim(),
      unit: document.getElementById('modal-item-unit').value.trim(),
      category: document.getElementById('modal-item-category').value.trim(),
      min_stock: parseFloat(document.getElementById('modal-item-min').value) || 0,
      max_stock: parseFloat(document.getElementById('modal-item-max').value) || 0
    };

    const endpoint = id ? `/api/items/${id}` : '/api/items';
    const method = id ? 'PUT' : 'POST';
    const res = await apiRequest(endpoint, method, data);

    if (res.ok) {
      showToast(res.data.message || 'บันทึกสำเร็จ', 'success');
      closeModal('item-modal');
      loadItemsMaster();
      loadStockBalance();
    } else {
      showToast(res.data.message || 'เกิดข้อผิดพลาด', 'error');
    }
  });

  // 12. Modal Forms: Shops Master
  document.getElementById('btn-open-create-shop').addEventListener('click', () => {
    document.getElementById('shop-modal-title').textContent = 'เพิ่มร้านค้า / แหล่งรับ';
    document.getElementById('modal-shop-id').value = '';
    document.getElementById('form-shop-modal').reset();
    openModal('shop-modal');
  });

  document.getElementById('form-shop-modal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('modal-shop-id').value;
    const data = {
      shop_name: document.getElementById('modal-shop-name').value.trim(),
      address: document.getElementById('modal-shop-address').value.trim(),
      phone: document.getElementById('modal-shop-phone').value.trim(),
      tax_id: document.getElementById('modal-shop-tax').value.trim()
    };

    const endpoint = id ? `/api/shops/${id}` : '/api/shops';
    const method = id ? 'PUT' : 'POST';
    const res = await apiRequest(endpoint, method, data);

    if (res.ok) {
      showToast(res.data.message || 'บันทึกสำเร็จ', 'success');
      closeModal('shop-modal');
      loadShopsMaster();
    } else {
      showToast(res.data.message || 'เกิดข้อผิดพลาด', 'error');
    }
  });

  // 13. Superadmin: Create User Modal
  document.getElementById('btn-open-create-user').addEventListener('click', () => {
    document.getElementById('form-user-create').reset();
    initPermissionMatrixCreateForm();
    openModal('user-create-modal');
  });

  document.getElementById('form-user-create').addEventListener('submit', async (e) => {
    e.preventDefault();
    const permissions = {};
    ALL_PAGES.forEach(pageKey => {
      const viewCheck = document.querySelector(`#matrix-create-body input[name="view_${pageKey}"]`);
      const editCheck = document.querySelector(`#matrix-create-body input[name="edit_${pageKey}"]`);
      permissions[pageKey] = {
        can_view: viewCheck && viewCheck.checked ? 1 : 0,
        can_edit: editCheck && editCheck.checked ? 1 : 0
      };
    });

    const data = {
      username: document.getElementById('new-user-username').value.trim(),
      password: document.getElementById('new-user-password').value,
      fullname: document.getElementById('new-user-fullname').value.trim(),
      department: document.getElementById('new-user-dept').value.trim(),
      role: document.getElementById('new-user-role').value,
      permissions
    };

    const res = await apiRequest('/api/admin/users', 'POST', data);
    if (res.ok) {
      showToast(res.data.message || 'สร้างผู้ใช้สำเร็จ', 'success');
      closeModal('user-create-modal');
      loadUsersManagement();
    } else {
      showToast(res.data.message || 'เกิดข้อผิดพลาด', 'error');
    }
  });

  // 14. Superadmin: Edit Permissions Form
  document.getElementById('form-permission-edit').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('perm-edit-user-id').value;
    const permissions = {};

    ALL_PAGES.forEach(pageKey => {
      const viewCheck = document.querySelector(`#matrix-edit-body input[name="view_${pageKey}"]`);
      const editCheck = document.querySelector(`#matrix-edit-body input[name="edit_${pageKey}"]`);
      permissions[pageKey] = {
        can_view: viewCheck && viewCheck.checked ? 1 : 0,
        can_edit: editCheck && editCheck.checked ? 1 : 0
      };
    });

    const res = await apiRequest(`/api/admin/users/${userId}/permissions`, 'PUT', { permissions });
    if (res.ok) {
      showToast(res.data.message || 'บันทึกสิทธิเรียบร้อย', 'success');
      closeModal('permission-edit-modal');
      loadUsersManagement();
    } else {
      showToast(res.data.message || 'เกิดข้อผิดพลาด', 'error');
    }
  });

  // 15. Superadmin: Reset Password Form
  document.getElementById('form-reset-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('reset-pw-user-id').value;
    const newPassword = document.getElementById('reset-pw-new').value;

    const res = await apiRequest(`/api/admin/users/${userId}/reset-password`, 'PUT', { new_password: newPassword });
    if (res.ok) {
      showToast(res.data.message || 'รีเซ็ตรหัสผ่านสำเร็จ', 'success');
      closeModal('reset-password-modal');
    } else {
      showToast(res.data.message || 'เกิดข้อผิดพลาด', 'error');
    }
  });

  // 16. Superadmin: Google Sheet Sync Modal & Trigger
  const btnOpenSync = document.getElementById('btn-open-sync-sheet');
  if (btnOpenSync) {
    btnOpenSync.addEventListener('click', () => {
      document.getElementById('sync-sheet-status-box').classList.add('hidden');
      openModal('sync-sheet-modal');
    });
  }

  const btnDoSync = document.getElementById('btn-do-sync-sheet');
  if (btnDoSync) {
    btnDoSync.addEventListener('click', async () => {
      let rawInput = document.getElementById('sync-sheet-input-id').value.trim();
      let sheetId = rawInput;
      const match = rawInput.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) sheetId = match[1];

      const statusBox = document.getElementById('sync-sheet-status-box');
      const syncBtnText = document.getElementById('btn-sync-sheet-text');
      const syncIcon = document.getElementById('btn-sync-icon');

      statusBox.className = 'p-3 rounded-lg text-xs bg-amber-50 text-amber-800 border border-amber-200 block';
      statusBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังดึงข้อมูลและซิงค์จาก Google Sheet เข้าสู่ D1 กรุณารอสักครู่...';
      btnDoSync.disabled = true;
      if (syncIcon) syncIcon.classList.add('fa-spin');

      const res = await apiRequest('/api/admin/sync-google-sheet', 'POST', { sheet_id: sheetId });
      btnDoSync.disabled = false;
      if (syncIcon) syncIcon.classList.remove('fa-spin');

      if (res.ok && res.data.success) {
        statusBox.className = 'p-3 rounded-lg text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 block';
        statusBox.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-600 mr-1"></i> ${res.data.message || 'ซิงค์ข้อมูลสำเร็จ!'}`;
        showToast('ซิงค์ข้อมูลจาก Google Sheet เรียบร้อยแล้ว', 'success');
        loadStockBalance();
      } else {
        statusBox.className = 'p-3 rounded-lg text-xs bg-rose-50 text-rose-800 border border-rose-200 block';
        statusBox.innerHTML = `<i class="fa-solid fa-circle-exclamation text-rose-600 mr-1"></i> ${res.data.message || 'เกิดข้อผิดพลาดในการซิงค์'}`;
        showToast(res.data.message || 'ซิงค์ข้อมูลล้มเหลว', 'error');
      }
    });
  }
});

// ============================================================================
// 13. Helper Functions
// ============================================================================

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function editItemModal(item) {
  document.getElementById('item-modal-title').textContent = 'แก้ไขข้อมูลพัสดุ';
  document.getElementById('modal-item-id').value = item.id;
  document.getElementById('modal-item-code').value = item.item_code;
  document.getElementById('modal-item-code').readOnly = true;
  document.getElementById('modal-item-name').value = item.item_name;
  document.getElementById('modal-item-unit').value = item.unit;
  document.getElementById('modal-item-category').value = item.category;
  document.getElementById('modal-item-min').value = item.min_stock;
  document.getElementById('modal-item-max').value = item.max_stock;
  openModal('item-modal');
}

function editShopModal(shop) {
  document.getElementById('shop-modal-title').textContent = 'แก้ไขข้อมูลร้านค้า';
  document.getElementById('modal-shop-id').value = shop.id;
  document.getElementById('modal-shop-name').value = shop.shop_name;
  document.getElementById('modal-shop-address').value = shop.address || '';
  document.getElementById('modal-shop-phone').value = shop.phone || '';
  document.getElementById('modal-shop-tax').value = shop.tax_id || '';
  openModal('shop-modal');
}
