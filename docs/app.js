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
  'dashboard_buy',
  'dashboard_pay',
  'items',
  'shops',
  'reports',
  'user_mgmt'
];

const PAGE_METADATA = {
  stock_balance: { name: 'ยอดคงเหลือสต๊อก', icon: 'fa-boxes-stacked' },
  buy: { name: 'บันทึกรับเข้าพัสดุ', icon: 'fa-cart-arrow-down' },
  pay: { name: 'บันทึกเบิกจ่ายพัสดุ', icon: 'fa-hand-holding-medical' },
  dashboard_buy: { name: 'Dashboard รับเข้า', icon: 'fa-chart-line' },
  dashboard_pay: { name: 'Dashboard เบิกจ่าย', icon: 'fa-chart-pie' },
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
  items: [],
  shops: [],
  users: [],
  recentBuys: [],
  recentPays: [],

  // Pagination states
  stockPagination: {
    page: 1,
    pageSize: 25,
    filteredItems: []
  },
  itemsPagination: {
    page: 1,
    pageSize: 25,
    search: '',
    category: '',
    status: ''
  },
  shopsPagination: {
    page: 1,
    pageSize: 15,
    search: ''
  },
  buysPagination: {
    page: 1,
    pageSize: 15,
    total: 0,
    totalPages: 1,
    q: ''
  },
  paysPagination: {
    page: 1,
    pageSize: 15,
    total: 0,
    totalPages: 1,
    q: ''
  },

  // Multi-item cart states for same bill/invoice
  buyCart: [],
  payCart: [],

  // Recent bill preview cache for pulling into pay
  selectedPullBill: null
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
        dashboard_buy: { can_view: 1, can_edit: 1 },
        dashboard_pay: { can_view: 1, can_edit: 1 },
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
        dashboard_buy: { can_view: 1, can_edit: 1 },
        dashboard_pay: { can_view: 1, can_edit: 1 },
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
        dashboard_buy: { can_view: 0, can_edit: 0 },
        dashboard_pay: { can_view: 1, can_edit: 0 },
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
  const now = Date.now();
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

    const last_buy_date = buysForItem.length > 0 ? buysForItem.map(b => b.doc_date).sort().reverse()[0] : null;
    const last_pay_date = paysForItem.length > 0 ? paysForItem.map(p => p.doc_date).sort().reverse()[0] : null;
    let last_movement_date = null;
    if (last_buy_date && last_pay_date) {
      last_movement_date = last_buy_date > last_pay_date ? last_buy_date : last_pay_date;
    } else if (last_buy_date) {
      last_movement_date = last_buy_date;
    } else if (last_pay_date) {
      last_movement_date = last_pay_date;
    }
    const days_inactive = last_movement_date ? Math.max(0, Math.floor((now - new Date(last_movement_date).getTime()) / (1000 * 60 * 60 * 24))) : 999;

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
      stock_status,
      last_buy_date,
      last_pay_date,
      last_movement_date,
      days_inactive
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

    const allItems = calculateMockStockBalance();
    let items = allItems;
    if (q) {
      items = items.filter(i => i.item_code.toLowerCase().includes(q) || i.item_name.toLowerCase().includes(q));
    }
    if (cat) {
      items = items.filter(i => i.category === cat);
    }
    if (st === 'INACTIVE_45') {
      items = items.filter(i => i.days_inactive >= 45);
    } else if (st === 'INACTIVE_90') {
      items = items.filter(i => i.days_inactive >= 90);
    } else if (st === 'INACTIVE_180') {
      items = items.filter(i => i.days_inactive >= 180);
    } else if (st) {
      items = items.filter(i => i.stock_status === st);
    }

    let normal = 0, low = 0, out = 0, totalVal = 0;
    allItems.forEach(i => {
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
          total_items: allItems.length,
          normal_count: normal,
          low_stock_count: low,
          out_of_stock_count: out,
          inactive_45_count: allItems.filter(i => i.days_inactive >= 45).length,
          inactive_90_count: allItems.filter(i => i.days_inactive >= 90).length,
          inactive_180_count: allItems.filter(i => i.days_inactive >= 180).length,
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

    if (username === 'chanpibul' && password !== '300628') {
      return { ok: false, status: 401, data: { success: false, message: 'รหัสผ่านไม่ถูกต้อง' } };
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

  // Buys: Recent Bills
  if (endpoint === '/api/buys/recent-bills') {
    const billsMap = {};
    mockData.buys.forEach(b => {
      if (!billsMap[b.doc_no]) {
        billsMap[b.doc_no] = {
          doc_no: b.doc_no,
          doc_date: b.doc_date,
          shop_name: b.shop_name,
          total_price: 0,
          item_count: 0,
          items: []
        };
      }
      billsMap[b.doc_no].total_price += Number(b.total_price) || 0;
      billsMap[b.doc_no].item_count += 1;
      billsMap[b.doc_no].items.push(b);
    });
    const bills = Object.values(billsMap).sort((a, b) => b.doc_date.localeCompare(a.doc_date)).slice(0, 50);
    return { ok: true, status: 200, data: { success: true, bills } };
  }

  // Buys: By Bill
  if (endpoint.startsWith('/api/buys/by-bill/')) {
    const docNo = decodeURIComponent(endpoint.replace('/api/buys/by-bill/', '').split('?')[0]);
    const items = mockData.buys.filter(b => b.doc_no === docNo);
    if (!items.length) {
      return { ok: false, status: 404, data: { success: false, message: 'ไม่พบบิลนี้' } };
    }
    const total_price = items.reduce((s, i) => s + (Number(i.total_price) || 0), 0);
    return {
      ok: true,
      status: 200,
      data: {
        success: true,
        doc_no: docNo,
        doc_date: items[0].doc_date,
        shop_name: items[0].shop_name,
        total_price: Math.round(total_price * 100) / 100,
        items
      }
    };
  }

  // Buys (GET with search & pagination, POST with single or multi-item)
  if (endpoint.startsWith('/api/buys') && method === 'GET') {
    const urlObj = new URL('http://local' + endpoint);
    const q = (urlObj.searchParams.get('q') || '').toLowerCase().trim();
    const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
    const limit = parseInt(urlObj.searchParams.get('limit') || '15', 10);

    let list = [...mockData.buys].reverse();
    if (q) {
      list = list.filter(b => 
        (b.doc_no || '').toLowerCase().includes(q) ||
        (b.item_code || '').toLowerCase().includes(q) ||
        (b.item_name || '').toLowerCase().includes(q) ||
        (b.shop_name || '').toLowerCase().includes(q)
      );
    }
    const total = list.length;
    const total_pages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const paged = list.slice(offset, offset + limit);

    return {
      ok: true,
      status: 200,
      data: { success: true, buys: paged, total, page, total_pages }
    };
  }

  if (endpoint === '/api/buys' && method === 'POST') {
    const itemsToInsert = Array.isArray(data.items) && data.items.length > 0 
      ? data.items 
      : [data];

    itemsToInsert.forEach(it => {
      const item = mockData.items.find(i => i.item_code === it.item_code);
      const qty = Number(it.quantity);
      let total_price = Number(it.total_price);
      let price_per_unit = Number(it.price_per_unit);

      if (total_price && !price_per_unit && qty > 0) {
        price_per_unit = Math.round((total_price / qty) * 10000) / 10000;
      } else if (price_per_unit && !total_price) {
        total_price = Math.round(qty * price_per_unit * 100) / 100;
      } else if (!total_price && !price_per_unit) {
        total_price = 0;
        price_per_unit = 0;
      }

      const newBuy = {
        id: mockData.buys.length + 1,
        doc_date: data.doc_date,
        doc_no: data.doc_no,
        item_code: it.item_code,
        item_name: item ? item.item_name : it.item_name || it.item_code,
        category: item ? item.category : it.category || '',
        unit: item ? item.unit : it.unit || '',
        price_per_unit,
        quantity: qty,
        total_price,
        shop_name: data.shop_name,
        remark: it.remark || data.remark || '',
        ym_period: data.doc_date.slice(0, 7),
        created_by: state.currentUser ? state.currentUser.username : 'demo'
      };
      mockData.buys.push(newBuy);
    });

    return { ok: true, status: 201, data: { success: true, message: `บันทึกรับเข้าพัสดุสำเร็จ (${itemsToInsert.length} รายการ)` } };
  }

  // Pays (GET with search & pagination, POST with single or multi-item & stock validation)
  if (endpoint.startsWith('/api/pays') && method === 'GET') {
    const urlObj = new URL('http://local' + endpoint);
    const q = (urlObj.searchParams.get('q') || '').toLowerCase().trim();
    const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
    const limit = parseInt(urlObj.searchParams.get('limit') || '15', 10);

    let list = [...mockData.pays].reverse();
    if (q) {
      list = list.filter(p => 
        (p.doc_no || '').toLowerCase().includes(q) ||
        (p.item_code || '').toLowerCase().includes(q) ||
        (p.item_name || '').toLowerCase().includes(q) ||
        (p.department || '').toLowerCase().includes(q)
      );
    }
    const total = list.length;
    const total_pages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const paged = list.slice(offset, offset + limit);

    return {
      ok: true,
      status: 200,
      data: { success: true, pays: paged, total, page, total_pages }
    };
  }

  if (endpoint === '/api/pays' && method === 'POST') {
    const stockList = calculateMockStockBalance();
    const itemsToInsert = Array.isArray(data.items) && data.items.length > 0 
      ? data.items 
      : [data];

    // Validate all items before inserting
    for (const it of itemsToInsert) {
      const stock = stockList.find(s => s.item_code === it.item_code);
      const qty = Number(it.quantity);
      if (!stock) {
        return { ok: false, status: 404, data: { success: false, message: `ไม่พบพัสดุรหัส ${it.item_code}` } };
      }
      if (qty > stock.balance_qty) {
        return {
          ok: false,
          status: 400,
          data: {
            success: false,
            error: 'INSUFFICIENT_STOCK',
            message: `ยอดคงเหลือในคลังไม่เพียงพอสำหรับ ${stock.item_name}! คงเหลือ ${stock.balance_qty} ${stock.unit} (ขอเบิก ${qty}) ไม่อนุญาตให้เบิกติดลบ`
          }
        };
      }
    }

    itemsToInsert.forEach(it => {
      const stock = stockList.find(s => s.item_code === it.item_code);
      const qty = Number(it.quantity);
      let total_price = Number(it.total_price);
      let price_per_unit = Number(it.price_per_unit);

      if (total_price && !price_per_unit && qty > 0) {
        price_per_unit = Math.round((total_price / qty) * 10000) / 10000;
      } else if (price_per_unit && !total_price) {
        total_price = Math.round(qty * price_per_unit * 100) / 100;
      } else if (!total_price && !price_per_unit) {
        price_per_unit = stock.avg_unit_price || 0;
        total_price = Math.round(qty * price_per_unit * 100) / 100;
      }

      const newPay = {
        id: mockData.pays.length + 1,
        doc_date: data.doc_date,
        doc_no: data.doc_no,
        item_code: it.item_code,
        item_name: stock.item_name,
        category: stock.category,
        unit: stock.unit,
        price_per_unit,
        quantity: qty,
        total_price,
        department: data.department,
        remark: it.remark || data.remark || '',
        ym_period: data.doc_date.slice(0, 7),
        created_by: state.currentUser ? state.currentUser.username : 'demo'
      };
      mockData.pays.push(newPay);
    });

    return { ok: true, status: 201, data: { success: true, message: `บันทึกเบิกจ่ายพัสดุสำเร็จ (${itemsToInsert.length} รายการ)` } };
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
  if (endpoint.startsWith('/api/admin/users/') && method === 'PUT' && !endpoint.includes('toggle-status') && !endpoint.includes('permissions') && !endpoint.includes('reset-password')) {
    const id = parseInt(endpoint.split('/')[4], 10);
    const user = mockData.users.find(u => u.id === id);
    if (!user) return { ok: false, status: 404, data: { success: false, message: 'ไม่พบผู้ใช้' } };
    if (data.fullname) user.fullname = data.fullname;
    if (data.department) user.department = data.department;
    if (data.role) user.role = data.role;
    return { ok: true, status: 200, data: { success: true, message: 'อัปเดตข้อมูลผู้ใช้งานเรียบร้อย' } };
  }
  if (endpoint.startsWith('/api/admin/users/') && method === 'DELETE') {
    const id = parseInt(endpoint.split('/')[4], 10);
    if (id === 1) return { ok: false, status: 400, data: { success: false, message: 'ไม่อนุญาตให้ลบ Superadmin id=1' } };
    mockData.users = mockData.users.filter(u => u.id !== id);
    return { ok: true, status: 200, data: { success: true, message: 'ลบผู้ใช้งานเรียบร้อย' } };
  }

  // Dashboard Reports Mock
  if (endpoint.startsWith('/api/reports/dashboard-buys')) {
    const total_val = mockData.buys.reduce((s, b) => s + (Number(b.total_price) || 0), 0);
    const total_items = mockData.buys.reduce((s, b) => s + (Number(b.quantity) || 0), 0);
    const unique_docs = new Set(mockData.buys.map(b => b.doc_no)).size;
    const unique_shops = new Set(mockData.buys.map(b => b.shop_name)).size;

    return {
      ok: true,
      status: 200,
      data: {
        success: true,
        filter: { type: 'fiscal_year', start_date: '2025-10-01', end_date: '2026-09-30' },
        kpis: {
          total_value: Math.round(total_val * 100) / 100,
          total_items,
          total_docs: unique_docs,
          total_shops: unique_shops
        },
        monthly_trend: [
          { ym: '2025-10', total_val: 12000, doc_count: 5 },
          { ym: '2025-11', total_val: 18500, doc_count: 8 },
          { ym: '2025-12', total_val: 15400, doc_count: 6 },
          { ym: '2026-01', total_val: 22000, doc_count: 10 },
          { ym: '2026-02', total_val: 19800, doc_count: 7 },
          { ym: '2026-03', total_val: 25400, doc_count: 11 }
        ],
        categories: [
          { category: 'เวชภัณฑ์มิใช่ยา', count: 12, total_val: 45000 },
          { category: 'วัสดุสำนักงาน', count: 6, total_val: 12500 }
        ],
        top_shops: [
          { shop_name: 'องค์การเภสัชกรรม (GPO)', doc_count: 6, total_val: 32000 },
          { shop_name: 'บริษัท ดีเคเอสเอช (ประเทศไทย) จำกัด', doc_count: 4, total_val: 25500 }
        ],
        top_items: mockData.items.slice(0, 5).map(i => ({
          item_code: i.item_code,
          item_name: i.item_name,
          category: i.category,
          unit: i.unit,
          total_qty: 120,
          total_val: 21600
        }))
      }
    };
  }

  if (endpoint.startsWith('/api/reports/dashboard-pays')) {
    const total_val = mockData.pays.reduce((s, p) => s + (Number(p.total_price) || 0), 0);
    const total_items = mockData.pays.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
    const unique_docs = new Set(mockData.pays.map(p => p.doc_no)).size;
    const unique_depts = new Set(mockData.pays.map(p => p.department)).size;

    return {
      ok: true,
      status: 200,
      data: {
        success: true,
        filter: { type: 'fiscal_year', start_date: '2025-10-01', end_date: '2026-09-30' },
        kpis: {
          total_value: Math.round(total_val * 100) / 100,
          total_items,
          total_docs: unique_docs,
          total_departments: unique_depts
        },
        monthly_trend: [
          { ym: '2025-10', total_val: 9500, doc_count: 4 },
          { ym: '2025-11', total_val: 14200, doc_count: 7 },
          { ym: '2025-12', total_val: 11000, doc_count: 5 },
          { ym: '2026-01', total_val: 18400, doc_count: 9 },
          { ym: '2026-02', total_val: 16100, doc_count: 6 },
          { ym: '2026-03', total_val: 21000, doc_count: 10 }
        ],
        departments: [
          { department: 'กลุ่มงานอุบัติเหตุและฉุกเฉิน (ER)', doc_count: 5, total_val: 28000 },
          { department: 'กลุ่มงานการพยาบาลผู้ป่วยนอก (OPD)', doc_count: 4, total_val: 19500 }
        ],
        categories: [
          { category: 'เวชภัณฑ์มิใช่ยา', total_qty: 210, total_val: 38000 },
          { category: 'วัสดุสำนักงาน', total_qty: 65, total_val: 9500 }
        ],
        top_items: mockData.items.slice(0, 5).map(i => ({
          item_code: i.item_code,
          item_name: i.item_name,
          category: i.category,
          unit: i.unit,
          total_qty: 95,
          total_val: 17100
        }))
      }
    };
  }

  return { ok: true, status: 200, data: { success: true } };
}

function updateApiStatusBadge(isLive) {
  const dot = document.getElementById('api-status-dot');
  const text = document.getElementById('api-status-text');
  const modeSpan = document.getElementById('api-current-mode');

  if (dot && text) {
    if (isLive) {
      dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
      text.textContent = 'Worker เชื่อมต่อแล้ว';
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-amber-400';
      text.textContent = 'โหมดทดสอบ (Demo)';
    }
  }
  if (modeSpan) {
    modeSpan.textContent = isLive ? 'Cloudflare D1 Online' : 'Offline / In-Memory Demo';
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
  if (pageKey === 'dashboard_buy') initDashboardBuy();
  if (pageKey === 'dashboard_pay') initDashboardPay();
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
  state.stockPagination.filteredItems = items || [];

  // อัปเดตการ์ด KPI สรุปผล
  if (summary) {
    document.getElementById('kpi-total-items').textContent = summary.total_items.toLocaleString();
    document.getElementById('kpi-normal-count').textContent = summary.normal_count.toLocaleString();
    document.getElementById('kpi-low-count').textContent = summary.low_stock_count.toLocaleString();
    document.getElementById('kpi-out-count').textContent = summary.out_of_stock_count.toLocaleString();
    document.getElementById('stock-total-val-footer').textContent = `มูลค่ารวม: ${Number(summary.total_inventory_value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`;
  }

  // Setup Autocomplete Suggestions for Stock Search Input
  setupStockSearchAutocomplete();

  // Render Table with Pagination
  renderStockBalanceTable();
}

function renderStockBalanceTable() {
  const tbody = document.getElementById('stock-table-body');
  const items = state.stockPagination.filteredItems || [];
  const pageSize = parseInt(document.getElementById('stock-page-size')?.value || '25', 10);
  let page = state.stockPagination.page;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-400">ไม่พบรายการพัสดุตามเงื่อนไขที่เลือก</td></tr>`;
    document.getElementById('stock-pagination-info').textContent = 'แสดง 0-0 จาก 0 รายการ';
    document.getElementById('stock-page-number').textContent = '1 / 1';
    document.getElementById('stock-prev-page').disabled = true;
    document.getElementById('stock-next-page').disabled = true;
    return;
  }

  let totalPages = 1;
  let pageItems = items;
  let startIdx = 0;
  let endIdx = items.length;

  if (pageSize > 0) {
    totalPages = Math.ceil(items.length / pageSize) || 1;
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    state.stockPagination.page = page;

    startIdx = (page - 1) * pageSize;
    endIdx = Math.min(startIdx + pageSize, items.length);
    pageItems = items.slice(startIdx, endIdx);
  } else {
    state.stockPagination.page = 1;
  }

  document.getElementById('stock-pagination-info').textContent = `แสดง ${startIdx + 1}-${endIdx} จาก ${items.length.toLocaleString()} รายการ`;
  document.getElementById('stock-page-number').textContent = `${state.stockPagination.page} / ${totalPages}`;
  document.getElementById('stock-prev-page').disabled = state.stockPagination.page <= 1;
  document.getElementById('stock-next-page').disabled = state.stockPagination.page >= totalPages;

  tbody.innerHTML = pageItems.map(item => {
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

    let inactiveBadge = '';
    const daysInactive = typeof item.days_inactive === 'number' ? item.days_inactive : null;
    if (daysInactive !== null) {
      if (daysInactive >= 180) {
        inactiveBadge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 mt-1 block max-w-fit mx-auto" title="ไม่เคลื่อนไหว ${daysInactive} วัน (ล่าสุด: ${item.last_movement_date || 'ไม่มีประวัติ'})"><i class="fa-solid fa-clock-rotate-left mr-1"></i>ไม่เคลื่อนไหว 180 วัน</span>`;
      } else if (daysInactive >= 90) {
        inactiveBadge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 mt-1 block max-w-fit mx-auto" title="ไม่เคลื่อนไหว ${daysInactive} วัน (ล่าสุด: ${item.last_movement_date || 'ไม่มีประวัติ'})"><i class="fa-solid fa-clock-rotate-left mr-1"></i>ไม่เคลื่อนไหว 90 วัน</span>`;
      } else if (daysInactive >= 45) {
        inactiveBadge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-300 mt-1 block max-w-fit mx-auto" title="ไม่เคลื่อนไหว ${daysInactive} วัน (ล่าสุด: ${item.last_movement_date || 'ไม่มีประวัติ'})"><i class="fa-solid fa-clock-rotate-left mr-1"></i>ไม่เคลื่อนไหว 45 วัน</span>`;
      } else if (item.last_movement_date) {
        inactiveBadge = `<span class="text-[10px] text-slate-400 block mt-0.5" title="ความเคลื่อนไหวล่าสุด">${item.last_movement_date}</span>`;
      }
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
          ${inactiveBadge}
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

window.setStockStatusFilter = function(status) {
  const select = document.getElementById('stock-status-filter');
  if (select) select.value = status;

  document.querySelectorAll('.stock-pill-btn').forEach(btn => {
    const s = btn.getAttribute('data-status') || '';
    if (s === status) {
      btn.className = 'stock-pill-btn active px-2.5 py-1 rounded-full border border-brand-700 bg-brand-700 text-white font-medium hover:opacity-90 transition text-xs';
    } else {
      btn.className = 'stock-pill-btn px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition text-xs';
    }
  });

  state.stockPagination.page = 1;
  loadStockBalance();
};

function setupStockSearchAutocomplete() {
  const input = document.getElementById('stock-search');
  const suggestionsBox = document.getElementById('stock-search-suggestions');
  if (!input || !suggestionsBox) return;

  input.oninput = debounce(() => {
    const val = input.value.trim().toLowerCase();
    if (!val || val.length < 1) {
      suggestionsBox.classList.add('hidden');
      loadStockBalance();
      return;
    }

    const matches = (state.stockItems || []).filter(i => 
      (i.item_code || '').toLowerCase().includes(val) || 
      (i.item_name || '').toLowerCase().includes(val)
    ).slice(0, 10);

    if (matches.length === 0) {
      suggestionsBox.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs">ไม่พบรายการพัสดุที่ตรงกัน</div>';
      suggestionsBox.classList.remove('hidden');
      return;
    }

    suggestionsBox.innerHTML = matches.map(item => `
      <div class="p-2.5 hover:bg-emerald-50/70 cursor-pointer flex items-center justify-between transition border-b border-slate-100 last:border-none" onclick="selectStockAutocomplete('${item.item_code}')">
        <div>
          <span class="font-bold font-mono text-emerald-800 text-xs">${item.item_code}</span>
          <span class="text-slate-800 ml-1.5 font-medium text-xs">${item.item_name}</span>
          <span class="text-[11px] text-slate-400 block">${item.category}</span>
        </div>
        <div class="text-right">
          <span class="font-bold font-mono text-xs ${item.balance_qty <= 0 ? 'text-rose-600' : 'text-slate-800'}">${Number(item.balance_qty).toLocaleString()} ${item.unit}</span>
          <span class="text-[10px] text-slate-400 block">คงเหลือ</span>
        </div>
      </div>
    `).join('');
    suggestionsBox.classList.remove('hidden');
  }, 200);

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !suggestionsBox.contains(e.target)) {
      suggestionsBox.classList.add('hidden');
    }
  });
}

function selectStockAutocomplete(itemCode) {
  const input = document.getElementById('stock-search');
  const suggestionsBox = document.getElementById('stock-search-suggestions');
  if (input) input.value = itemCode;
  if (suggestionsBox) suggestionsBox.classList.add('hidden');
  loadStockBalance();
}

// ============================================================================
// 6. Module 2: บันทึกรับเข้าพัสดุ (Buy)
// ============================================================================

async function initBuyPage() {
  document.getElementById('buy-doc-date').value = new Date().toISOString().slice(0, 10);
  await populateShopDropdown('buy-shop-name');
  if (state.stockItems.length === 0) {
    const res = await apiRequest('/api/public/stock');
    if (res.ok && res.data.items) state.stockItems = res.data.items;
  }
  setupBuyItemAutocomplete();
  state.buyCart = [];
  renderBuyCart();
  loadRecentBuys(1);
}

function setupBuyItemAutocomplete() {
  const input = document.getElementById('buy-search-item');
  const suggestionsBox = document.getElementById('buy-item-suggestions');
  if (!input || !suggestionsBox) return;

  input.oninput = debounce(() => {
    const val = input.value.trim().toLowerCase();
    if (!val) {
      suggestionsBox.classList.add('hidden');
      return;
    }

    const matches = (state.stockItems || []).filter(i => 
      (i.item_code || '').toLowerCase().includes(val) || 
      (i.item_name || '').toLowerCase().includes(val)
    ).slice(0, 12);

    if (matches.length === 0) {
      suggestionsBox.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs">ไม่พบรหัสพัสดุ</div>';
      suggestionsBox.classList.remove('hidden');
      return;
    }

    suggestionsBox.innerHTML = matches.map(item => `
      <div class="p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between transition border-b border-slate-100 last:border-none" onclick="selectBuyItem('${item.item_code}')">
        <div>
          <span class="font-bold font-mono text-emerald-800 text-xs">${item.item_code}</span>
          <span class="text-slate-800 ml-1.5 font-medium text-xs">${item.item_name}</span>
          <span class="text-[11px] text-slate-400 block">${item.category}</span>
        </div>
        <div class="text-right">
          <span class="font-bold font-mono text-xs text-slate-700">${item.unit}</span>
          <span class="text-[10px] text-emerald-600 block">คงเหลือ ${item.balance_qty}</span>
        </div>
      </div>
    `).join('');
    suggestionsBox.classList.remove('hidden');
  }, 150);

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !suggestionsBox.contains(e.target)) {
      suggestionsBox.classList.add('hidden');
    }
  });
}

function selectBuyItem(itemCode) {
  const item = (state.stockItems || []).find(i => i.item_code === itemCode);
  if (!item) return;

  document.getElementById('buy-search-item').value = `${item.item_code} : ${item.item_name}`;
  document.getElementById('buy-item-code').value = item.item_code;
  document.getElementById('buy-item-suggestions').classList.add('hidden');

  const alertBox = document.getElementById('buy-stock-alert-box') || document.getElementById('buy-item-info');
  if (alertBox) alertBox.classList.remove('hidden');
  const previewName = document.getElementById('buy-preview-name');
  if (previewName) previewName.textContent = item.item_name;
  const stockBadge = document.getElementById('buy-current-stock-badge');
  if (stockBadge) stockBadge.textContent = `คงเหลือ ${Number(item.balance_qty || 0).toLocaleString()} ${item.unit}`;
  const catEl = document.getElementById('buy-preview-cat');
  if (catEl) catEl.textContent = item.category;
  const avgPriceEl = document.getElementById('buy-current-avg-price');
  if (avgPriceEl) avgPriceEl.textContent = Number(item.avg_unit_price || 0).toFixed(2);
  const minStockEl = document.getElementById('buy-current-min-stock');
  if (minStockEl) minStockEl.textContent = Number(item.min_stock || 0).toLocaleString();

  // If unit price field is empty, prefill average price
  if (item.avg_unit_price && !document.getElementById('buy-price').value) {
    document.getElementById('buy-price').value = item.avg_unit_price;
  }

  // Auto-focus quantity input
  document.getElementById('buy-qty').focus();
}

function clearBuyItemInputs() {
  document.getElementById('buy-search-item').value = '';
  document.getElementById('buy-item-code').value = '';
  document.getElementById('buy-qty').value = '';
  document.getElementById('buy-price').value = '';
  document.getElementById('buy-total-price').value = '';
  const alertBox = document.getElementById('buy-stock-alert-box') || document.getElementById('buy-item-info');
  if (alertBox) alertBox.classList.add('hidden');
  document.getElementById('buy-item-suggestions').classList.add('hidden');
}

function renderBuyCart() {
  const tbody = document.getElementById('buy-cart-table-body');
  const badge = document.getElementById('buy-cart-total-badge');
  const countSpan = document.getElementById('buy-cart-count');
  const submitText = document.getElementById('btn-submit-buy-text');

  countSpan.textContent = state.buyCart.length;

  if (state.buyCart.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-slate-400">ยังไม่มีรายการในบิลนี้ (กด "+ เพิ่มรายการลงในบิลนี้" หรือกดบันทึกรายการเดียวได้ทันที)</td></tr>`;
    badge.textContent = '0.00 บาท';
    if (submitText) submitText.textContent = 'บันทึกรับเข้าพัสดุ';
    return;
  }

  let grandTotal = 0;
  tbody.innerHTML = state.buyCart.map((item, idx) => {
    grandTotal += item.total_price;
    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="p-1.5 font-medium text-slate-800">
          <span class="font-mono text-emerald-700 font-bold">${item.item_code}</span>: ${item.item_name}
        </td>
        <td class="p-1.5 text-right font-mono text-slate-700">${Number(item.quantity).toLocaleString()} ${item.unit}</td>
        <td class="p-1.5 text-right font-mono font-bold text-slate-900">${Number(item.total_price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        <td class="p-1.5 text-center">
          <button type="button" onclick="removeBuyCartItem(${idx})" class="text-rose-500 hover:text-rose-700 text-xs p-1" title="ลบรายการ">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  badge.textContent = `${Number(grandTotal).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`;
  if (submitText) submitText.textContent = `บันทึกรับเข้าพัสดุทั้งบิล (${state.buyCart.length} รายการ)`;
}

function addBuyItemToCart() {
  const itemCode = document.getElementById('buy-item-code').value;
  const qty = parseFloat(document.getElementById('buy-qty').value) || 0;
  let price = parseFloat(document.getElementById('buy-price').value) || 0;
  let total = parseFloat(document.getElementById('buy-total-price').value) || 0;

  if (!itemCode) {
    showToast('กรุณาเลือกรายการพัสดุก่อนเพิ่มลงในบิล', 'warning');
    return;
  }
  if (qty <= 0) {
    showToast('กรุณาระบุจำนวนที่รับเข้าให้มากกว่า 0', 'warning');
    return;
  }
  if (total <= 0 && price <= 0) {
    showToast('กรุณาระบุราคาต่อหน่วย หรือราคารวม', 'warning');
    return;
  }

  if (total > 0 && price === 0) {
    price = Math.round((total / qty) * 10000) / 10000;
  } else if (price > 0 && total === 0) {
    total = Math.round(qty * price * 100) / 100;
  }

  const stock = (state.stockItems || []).find(i => i.item_code === itemCode);

  state.buyCart.push({
    item_code: itemCode,
    item_name: stock ? stock.item_name : itemCode,
    category: stock ? stock.category : '',
    unit: stock ? stock.unit : 'หน่วย',
    quantity: qty,
    price_per_unit: price,
    total_price: total
  });

  clearBuyItemInputs();
  renderBuyCart();
  showToast(`เพิ่มรายการ "${itemCode}" ลงในบิลแล้ว`, 'info');
}

function removeBuyCartItem(index) {
  state.buyCart.splice(index, 1);
  renderBuyCart();
}

async function loadRecentBuys(page = 1) {
  state.buysPagination.page = page;
  const pageSize = parseInt(document.getElementById('buys-page-size')?.value || '15', 10);
  const search = document.getElementById('buys-history-search')?.value.trim() || '';

  const tbody = document.getElementById('recent-buys-table-body');
  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังโหลดประวัติ...</td></tr>`;

  const query = new URLSearchParams();
  query.append('page', page);
  query.append('limit', pageSize);
  if (search) query.append('q', search);

  const res = await apiRequest(`/api/buys?${query.toString()}`);
  if (!res.ok || !res.data.buys) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">ยังไม่มีประวัติการรับเข้า</td></tr>`;
    return;
  }

  const { buys, total = 0, total_pages = 1 } = res.data;
  state.recentBuys = buys;
  state.buysPagination.total = total;
  state.buysPagination.totalPages = total_pages;

  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + buys.length, total);
  document.getElementById('buys-pagination-info').textContent = `แสดง ${total > 0 ? startIdx + 1 : 0}-${endIdx} จาก ${total.toLocaleString()} รายการ`;
  document.getElementById('buys-page-number').textContent = `${page} / ${total_pages}`;
  document.getElementById('buys-prev-page').disabled = page <= 1;
  document.getElementById('buys-next-page').disabled = page >= total_pages;

  if (buys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">ไม่พบประวัติการรับเข้า</td></tr>`;
    return;
  }

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
      <td class="py-2.5 px-3 text-slate-700">${formatExpandableCell(b.shop_name)}</td>
    </tr>
  `).join('');
}

// ============================================================================
// 7. Module 3: บันทึกเบิกจ่ายพัสดุ (Pay) - ป้องกันสต๊อกติดลบ 100%
// ============================================================================

async function initPayPage() {
  document.getElementById('pay-doc-date').value = new Date().toISOString().slice(0, 10);
  if (state.stockItems.length === 0) {
    const res = await apiRequest('/api/public/stock');
    if (res.ok && res.data.items) state.stockItems = res.data.items;
  }
  setupPayItemAutocomplete();
  state.payCart = [];
  renderPayCart();
  loadRecentPays(1);
}

function setupPayItemAutocomplete() {
  const input = document.getElementById('pay-search-item');
  const suggestionsBox = document.getElementById('pay-item-suggestions');
  if (!input || !suggestionsBox) return;

  input.oninput = debounce(() => {
    const val = input.value.trim().toLowerCase();
    if (!val) {
      suggestionsBox.classList.add('hidden');
      return;
    }

    const matches = (state.stockItems || []).filter(i => 
      (i.item_code || '').toLowerCase().includes(val) || 
      (i.item_name || '').toLowerCase().includes(val)
    ).slice(0, 12);

    if (matches.length === 0) {
      suggestionsBox.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs">ไม่พบรหัสพัสดุ</div>';
      suggestionsBox.classList.remove('hidden');
      return;
    }

    suggestionsBox.innerHTML = matches.map(item => `
      <div class="p-2.5 hover:bg-teal-50 cursor-pointer flex items-center justify-between transition border-b border-slate-100 last:border-none" onclick="selectPayItem('${item.item_code}')">
        <div>
          <span class="font-bold font-mono text-teal-800 text-xs">${item.item_code}</span>
          <span class="text-slate-800 ml-1.5 font-medium text-xs">${item.item_name}</span>
          <span class="text-[11px] text-slate-400 block">${item.category}</span>
        </div>
        <div class="text-right">
          <span class="font-bold font-mono text-xs ${item.balance_qty <= 0 ? 'text-rose-600' : 'text-teal-700'}">${item.balance_qty} ${item.unit}</span>
          <span class="text-[10px] text-slate-400 block">คงเหลือ</span>
        </div>
      </div>
    `).join('');
    suggestionsBox.classList.remove('hidden');
  }, 150);

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !suggestionsBox.contains(e.target)) {
      suggestionsBox.classList.add('hidden');
    }
  });
}

function selectPayItem(itemCode) {
  const item = (state.stockItems || []).find(i => i.item_code === itemCode);
  if (!item) return;

  document.getElementById('pay-search-item').value = `${item.item_code} : ${item.item_name}`;
  document.getElementById('pay-item-code').value = item.item_code;
  document.getElementById('pay-item-suggestions').classList.add('hidden');

  const alertBox = document.getElementById('pay-stock-alert-box');
  alertBox.classList.remove('hidden');
  document.getElementById('pay-preview-name').textContent = item.item_name;
  document.getElementById('pay-current-stock-badge').textContent = `คงเหลือ ${item.balance_qty} ${item.unit}`;
  document.getElementById('pay-current-avg-price').textContent = Number(item.avg_unit_price || 0).toFixed(2);
  document.getElementById('pay-current-min-stock').textContent = item.min_stock;

  // Set default price from average price
  if (item.avg_unit_price) {
    document.getElementById('pay-price').value = item.avg_unit_price;
  }

  validatePayQuantity();
  document.getElementById('pay-qty').focus();
}

function clearPayItemInputs() {
  document.getElementById('pay-search-item').value = '';
  document.getElementById('pay-item-code').value = '';
  document.getElementById('pay-qty').value = '';
  document.getElementById('pay-price').value = '';
  document.getElementById('pay-total-price').value = '';
  document.getElementById('pay-stock-alert-box').classList.add('hidden');
  document.getElementById('pay-item-suggestions').classList.add('hidden');
  const warn = document.getElementById('pay-insufficient-warning');
  if (warn) warn.classList.add('hidden');
}

function validatePayQuantity() {
  const itemCode = document.getElementById('pay-item-code')?.value;
  const qtyInput = document.getElementById('pay-qty');
  const qty = parseFloat(qtyInput?.value) || 0;
  const warningBox = document.getElementById('pay-insufficient-warning');
  const warningText = document.getElementById('pay-warning-text');
  const submitBtn = document.getElementById('btn-submit-pay');
  const addCartBtn = document.getElementById('btn-pay-add-item-to-cart');

  if (!itemCode) {
    if (warningBox) warningBox.classList.add('hidden');
    if (submitBtn) submitBtn.disabled = false;
    if (addCartBtn) addCartBtn.disabled = false;
    return;
  }

  const stock = (state.stockItems || []).find(s => s.item_code === itemCode);
  const currentBalance = stock ? Number(stock.balance_qty) : 0;
  const unit = stock ? stock.unit : 'หน่วย';

  // Calculate quantity already committed in cart for this item
  const committedInCart = state.payCart
    .filter(i => i.item_code === itemCode)
    .reduce((sum, i) => sum + i.quantity, 0);

  const totalRequested = qty + committedInCart;

  if (totalRequested > currentBalance) {
    if (warningBox) {
      warningBox.classList.remove('hidden');
      if (warningText) warningText.textContent = `ยอดที่ขอเบิกรวม (${totalRequested} ${unit}) เกินคงเหลือจริงในคลัง (${currentBalance} ${unit}) ระบบไม่อนุญาตให้ติดลบ`;
    }
    if (addCartBtn) addCartBtn.disabled = true;
    if (state.payCart.length === 0 && submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  } else {
    if (warningBox) warningBox.classList.add('hidden');
    if (addCartBtn) addCartBtn.disabled = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

function renderPayCart() {
  const tbody = document.getElementById('pay-cart-table-body');
  const badge = document.getElementById('pay-cart-total-badge');
  const countSpan = document.getElementById('pay-cart-count');
  const submitText = document.getElementById('btn-submit-pay-text');

  countSpan.textContent = state.payCart.length;

  if (state.payCart.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-slate-400">ยังไม่มีรายการในใบเบิกนี้ (กด "+ เพิ่มรายการลงในใบเบิกนี้" หรือดึงจากบิลรับเข้า)</td></tr>`;
    badge.textContent = '0.00 บาท';
    if (submitText) submitText.textContent = 'บันทึกเบิกจ่ายพัสดุ';
    return;
  }

  let grandTotal = 0;
  tbody.innerHTML = state.payCart.map((item, idx) => {
    grandTotal += item.total_price;
    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="p-1.5 font-medium text-slate-800">
          <span class="font-mono text-teal-700 font-bold">${item.item_code}</span>: ${item.item_name}
        </td>
        <td class="p-1.5 text-right font-mono text-slate-700">${Number(item.quantity).toLocaleString()} ${item.unit}</td>
        <td class="p-1.5 text-right font-mono font-bold text-slate-900">${Number(item.total_price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        <td class="p-1.5 text-center">
          <button type="button" onclick="removePayCartItem(${idx})" class="text-rose-500 hover:text-rose-700 text-xs p-1" title="ลบรายการ">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  badge.textContent = `${Number(grandTotal).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`;
  if (submitText) submitText.textContent = `บันทึกเบิกจ่ายพัสดุทั้งใบเบิก (${state.payCart.length} รายการ)`;
}

function addPayItemToCart() {
  const itemCode = document.getElementById('pay-item-code').value;
  const qty = parseFloat(document.getElementById('pay-qty').value) || 0;
  let price = parseFloat(document.getElementById('pay-price').value) || 0;
  let total = parseFloat(document.getElementById('pay-total-price').value) || 0;

  if (!itemCode) {
    showToast('กรุณาเลือกรายการพัสดุก่อน', 'warning');
    return;
  }
  if (qty <= 0) {
    showToast('กรุณาระบุจำนวนที่เบิกให้มากกว่า 0', 'warning');
    return;
  }

  const stock = (state.stockItems || []).find(i => i.item_code === itemCode);
  const currentBalance = stock ? Number(stock.balance_qty) : 0;
  const alreadyInCart = state.payCart.filter(i => i.item_code === itemCode).reduce((s, i) => s + i.quantity, 0);

  if (qty + alreadyInCart > currentBalance) {
    showToast(`จำนวนที่ขอเบิกรวม (${qty + alreadyInCart}) เกินยอดคงเหลือจริง (${currentBalance}) ไม่สามารถติดลบได้`, 'error');
    return;
  }

  if (total > 0 && price === 0) {
    price = Math.round((total / qty) * 10000) / 10000;
  } else if (price > 0 && total === 0) {
    total = Math.round(qty * price * 100) / 100;
  } else if (price === 0 && total === 0 && stock) {
    price = stock.avg_unit_price || 0;
    total = Math.round(qty * price * 100) / 100;
  }

  state.payCart.push({
    item_code: itemCode,
    item_name: stock ? stock.item_name : itemCode,
    category: stock ? stock.category : '',
    unit: stock ? stock.unit : 'หน่วย',
    quantity: qty,
    price_per_unit: price,
    total_price: total
  });

  clearPayItemInputs();
  renderPayCart();
  showToast(`เพิ่มรายการ "${itemCode}" ลงในใบเบิกแล้ว`, 'info');
}

function removePayCartItem(index) {
  state.payCart.splice(index, 1);
  renderPayCart();
  validatePayQuantity();
}

// Pull Recent Buy Bill Modal Logic
async function openPullBuyModal() {
  const select = document.getElementById('pull-buy-bill-select');
  const detailsBox = document.getElementById('pull-buy-bill-details');
  const confirmBtn = document.getElementById('btn-confirm-pull-buy');

  select.innerHTML = '<option value="">-- กำลังโหลดรายการบิลล่าสุด... --</option>';
  detailsBox.classList.add('hidden');
  confirmBtn.disabled = true;
  state.selectedPullBill = null;

  openModal('pull-buy-modal');

  const res = await apiRequest('/api/buys/recent-bills');
  if (!res.ok || !res.data.bills || res.data.bills.length === 0) {
    select.innerHTML = '<option value="">-- ไม่พบบิลรับเข้าล่าสุด --</option>';
    return;
  }

  const bills = res.data.bills;
  select.innerHTML = '<option value="">-- เลือกบิลรับเข้าที่ต้องการดึงยอด --</option>' + bills.map(b => `
    <option value="${b.doc_no}">
      ${b.doc_no} | วันที่: ${b.doc_date} | ร้าน: ${b.shop_name} | รวม ${Number(b.total_price).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บ. (${b.item_count} รายการ)
    </option>
  `).join('');

  select.onchange = async () => {
    const docNo = select.value;
    if (!docNo) {
      detailsBox.classList.add('hidden');
      confirmBtn.disabled = true;
      state.selectedPullBill = null;
      return;
    }

    const billRes = await apiRequest(`/api/buys/by-bill/${encodeURIComponent(docNo)}`);
    if (!billRes.ok || !billRes.data.items) {
      showToast('ไม่สามารถโหลดข้อมูลบิลนี้ได้', 'error');
      return;
    }

    const billData = billRes.data;
    state.selectedPullBill = billData;

    document.getElementById('pull-buy-info-docno').textContent = billData.doc_no;
    document.getElementById('pull-buy-info-date').textContent = billData.doc_date;
    document.getElementById('pull-buy-info-shop').textContent = billData.shop_name;
    document.getElementById('pull-buy-info-total').textContent = `${Number(billData.total_price).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`;
    document.getElementById('pull-buy-items-count').textContent = billData.items.length;

    const tbody = document.getElementById('pull-buy-items-tbody');
    tbody.innerHTML = billData.items.map(it => `
      <tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="p-2 font-medium text-slate-800"><span class="font-mono text-teal-700 font-bold">${it.item_code}</span>: ${it.item_name}</td>
        <td class="p-2 text-right font-mono">${Number(it.quantity).toLocaleString()} ${it.unit}</td>
        <td class="p-2 text-right font-mono">${Number(it.price_per_unit).toFixed(2)}</td>
        <td class="p-2 text-right font-mono font-bold text-slate-900">${Number(it.total_price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    detailsBox.classList.remove('hidden');
    confirmBtn.disabled = false;
  };
}

function confirmPullBuyBill() {
  if (!state.selectedPullBill || !state.selectedPullBill.items) return;

  const bill = state.selectedPullBill;
  let addedCount = 0;

  bill.items.forEach(it => {
    state.payCart.push({
      item_code: it.item_code,
      item_name: it.item_name,
      category: it.category || '',
      unit: it.unit || 'หน่วย',
      quantity: Number(it.quantity),
      price_per_unit: Number(it.price_per_unit),
      total_price: Number(it.total_price)
    });
    addedCount++;
  });

  // Suggest requisition doc_no if currently empty
  const docNoInput = document.getElementById('pay-doc-no');
  if (!docNoInput.value.trim()) {
    docNoInput.value = `REQ-${bill.doc_no}`;
  }

  const remarkInput = document.getElementById('pay-remark');
  if (!remarkInput.value.trim()) {
    remarkInput.value = `เบิกจ่ายตามบิลรับเข้า ${bill.doc_no} (${bill.shop_name})`;
  }

  closeModal('pull-buy-modal');
  renderPayCart();
  showToast(`ดึงรายการจากบิล ${bill.doc_no} เข้าสู่ใบเบิกแล้ว (${addedCount} รายการ)`, 'success');
}

async function loadRecentPays(page = 1) {
  state.paysPagination.page = page;
  const pageSize = parseInt(document.getElementById('pays-page-size')?.value || '15', 10);
  const search = document.getElementById('pays-history-search')?.value.trim() || '';

  const tbody = document.getElementById('recent-pays-table-body');
  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังโหลดประวัติ...</td></tr>`;

  const query = new URLSearchParams();
  query.append('page', page);
  query.append('limit', pageSize);
  if (search) query.append('q', search);

  const res = await apiRequest(`/api/pays?${query.toString()}`);
  if (!res.ok || !res.data.pays) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">ยังไม่มีประวัติการเบิกจ่าย</td></tr>`;
    return;
  }

  const { pays, total = 0, total_pages = 1 } = res.data;
  state.recentPays = pays;
  state.paysPagination.total = total;
  state.paysPagination.totalPages = total_pages;

  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pays.length, total);
  document.getElementById('pays-pagination-info').textContent = `แสดง ${total > 0 ? startIdx + 1 : 0}-${endIdx} จาก ${total.toLocaleString()} รายการ`;
  document.getElementById('pays-page-number').textContent = `${page} / ${total_pages}`;
  document.getElementById('pays-prev-page').disabled = page <= 1;
  document.getElementById('pays-next-page').disabled = page >= total_pages;

  if (pays.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">ไม่พบประวัติการเบิกจ่าย</td></tr>`;
    return;
  }

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
      <td class="py-2.5 px-3 text-slate-700 font-medium">${formatExpandableCell(p.department)}</td>
    </tr>
  `).join('');
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
  if (!res.ok) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-rose-500 font-medium">ไม่สามารถโหลดข้อมูลพัสดุได้ (${escapeHtml(res.data?.message || 'ข้อผิดพลาดเครือข่าย')})</td></tr>`;
    }
    return;
  }

  const items = res.data.items || [];
  state.items = items;

  // เติมตัวเลือกกลุ่มพัสดุในดรอปดาวน์
  const catFilter = document.getElementById('items-category-filter');
  if (catFilter) {
    const curVal = state.itemsPagination.category || '';
    const distinctCats = Array.from(new Set(items.map(i => (i.category || '').trim()).filter(Boolean))).sort();
    catFilter.innerHTML = '<option value="">-- ทุกกลุ่มพัสดุ --</option>' +
      distinctCats.map(c => `<option value="${escapeHtml(c)}" ${c === curVal ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
  }

  renderItemsTable();
}

function renderItemsTable() {
  const tbody = document.getElementById('items-table-body');
  if (!tbody) return;

  const search = (state.itemsPagination.search || '').toLowerCase().trim();
  const category = (state.itemsPagination.category || '').trim();
  const statusStr = state.itemsPagination.status !== undefined ? String(state.itemsPagination.status).trim() : '';

  // 1. กรองข้อมูล
  const filtered = (state.items || []).filter(i => {
    if (search) {
      const matchCode = (i.item_code || '').toLowerCase().includes(search);
      const matchName = (i.item_name || '').toLowerCase().includes(search);
      if (!matchCode && !matchName) return false;
    }
    if (category && (i.category || '').trim() !== category) {
      return false;
    }
    if (statusStr !== '') {
      const activeVal = i.is_active !== undefined ? Number(i.is_active) : 1;
      if (activeVal !== Number(statusStr)) return false;
    }
    return true;
  });

  // 2. อัปเดต Badge ยอดรวม
  const countBadge = document.getElementById('items-count-badge');
  if (countBadge) {
    countBadge.textContent = `พบ ${filtered.length} / ทั้งหมด ${(state.items || []).length} รายการ`;
  }

  // 3. คำนวณแบ่งหน้า
  const pageSize = Number(state.itemsPagination.pageSize) || 0;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  if (state.itemsPagination.page > totalPages) state.itemsPagination.page = totalPages;
  if (state.itemsPagination.page < 1) state.itemsPagination.page = 1;

  const start = pageSize > 0 ? (state.itemsPagination.page - 1) * pageSize : 0;
  const end = pageSize > 0 ? start + pageSize : filtered.length;
  const pageItems = pageSize > 0 ? filtered.slice(start, end) : filtered;

  // 4. อัปเดต Footer แสดงข้อมูลหน้า
  const infoEl = document.getElementById('items-pagination-info');
  if (infoEl) {
    if (filtered.length === 0) {
      infoEl.textContent = 'แสดง 0-0 จาก 0 รายการ';
    } else {
      infoEl.textContent = `แสดง ${start + 1}-${Math.min(end, filtered.length)} จาก ${filtered.length} รายการ`;
    }
  }

  const pageNumEl = document.getElementById('items-page-number');
  if (pageNumEl) {
    pageNumEl.textContent = `${state.itemsPagination.page} / ${totalPages}`;
  }

  const prevBtn = document.getElementById('items-prev-page');
  if (prevBtn) prevBtn.disabled = state.itemsPagination.page <= 1;

  const nextBtn = document.getElementById('items-next-page');
  if (nextBtn) nextBtn.disabled = state.itemsPagination.page >= totalPages;

  // 5. แสดงผลแถวตาราง
  if (pageItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8 text-slate-400">
          <i class="fa-solid fa-folder-open text-2xl text-slate-300 block mb-2"></i>
          ไม่พบข้อมูลพัสดุตามเงื่อนไขที่ค้นหา
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pageItems.map(i => {
    const isActive = i.is_active !== undefined ? Number(i.is_active) === 1 : true;
    const itemJson = JSON.stringify(i).replace(/"/g, '&quot;');
    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
        <td class="py-3 px-4 font-mono font-bold text-slate-900">${escapeHtml(i.item_code)}</td>
        <td class="py-3 px-4 font-medium text-slate-800">${escapeHtml(i.item_name)}</td>
        <td class="py-3 px-4 text-slate-600 text-xs">
          <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">${escapeHtml(i.category || '-')}</span>
        </td>
        <td class="py-3 px-4 text-center font-medium text-slate-700">${escapeHtml(i.unit || '-')}</td>
        <td class="py-3 px-4 text-right font-mono text-amber-700 font-medium">${Number(i.min_stock || 0).toLocaleString()}</td>
        <td class="py-3 px-4 text-right font-mono text-slate-600">${Number(i.max_stock || 0).toLocaleString()}</td>
        <td class="py-3 px-4 text-center">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}">
            <span class="w-1.5 h-1.5 rounded-full mr-1.5 ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
            ${isActive ? 'ใช้งานปกติ' : 'ระงับใช้งาน'}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <div class="inline-flex items-center justify-center space-x-1.5">
            <button onclick="editItemModal(${itemJson})" class="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-medium px-2 py-1 rounded transition" title="แก้ไขข้อมูลพัสดุ">
              <i class="fa-solid fa-pen-to-square mr-1"></i> แก้ไข
            </button>
            <button onclick="toggleItemStatus(${i.id}, ${isActive ? 0 : 1})" class="text-xs ${isActive ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'} border px-2 py-1 rounded font-medium transition" title="${isActive ? 'คลิกเพื่อระงับใช้งาน' : 'คลิกเพื่อเปิดใช้งาน'}">
              <i class="fa-solid ${isActive ? 'fa-ban' : 'fa-check'} mr-1"></i> ${isActive ? 'ระงับ' : 'เปิดใช้'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleItemStatus(itemId, newStatus) {
  const res = await apiRequest(`/api/items/${itemId}/toggle-status`, 'PUT');
  if (res.ok) {
    showToast(res.data.message || 'เปลี่ยนสถานะเรียบร้อยแล้ว', 'success');
    const it = (state.items || []).find(x => x.id === itemId);
    if (it) it.is_active = newStatus;
    renderItemsTable();
    loadStockBalance();
  } else {
    // Fallback: หาก endpoint toggle ยังไม่พร้อม ให้ fallback ไปยัง PUT /api/items/:id ทั่วไป
    const item = (state.items || []).find(x => x.id === itemId);
    if (item) {
      const fallbackRes = await apiRequest(`/api/items/${itemId}`, 'PUT', {
        item_name: item.item_name,
        unit: item.unit,
        category: item.category,
        min_stock: item.min_stock,
        max_stock: item.max_stock,
        is_active: newStatus
      });
      if (fallbackRes.ok) {
        showToast('เปลี่ยนสถานะเรียบร้อยแล้ว', 'success');
        item.is_active = newStatus;
        renderItemsTable();
        loadStockBalance();
        return;
      }
    }
    showToast(res.data?.message || 'ไม่สามารถเปลี่ยนสถานะได้', 'error');
  }
}

async function loadShopsMaster() {
  const res = await apiRequest('/api/shops');
  const tbody = document.getElementById('shops-table-body');
  if (!res.ok) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-rose-500 font-medium">ไม่สามารถโหลดข้อมูลร้านค้าได้ (${escapeHtml(res.data?.message || 'ข้อผิดพลาดเครือข่าย')})</td></tr>`;
    }
    return;
  }

  const shops = res.data.shops || [];
  state.shops = shops;
  renderShopsTable();
}

function renderShopsTable() {
  const tbody = document.getElementById('shops-table-body');
  if (!tbody) return;

  const search = (state.shopsPagination.search || '').toLowerCase().trim();

  // 1. กรองข้อมูลร้านค้า
  const filtered = (state.shops || []).filter(s => {
    if (!search) return true;
    const matchName = (s.shop_name || '').toLowerCase().includes(search);
    const matchAddress = (s.address || '').toLowerCase().includes(search);
    const matchPhone = (s.phone || '').includes(search);
    const matchTax = (s.tax_id || '').includes(search);
    return matchName || matchAddress || matchPhone || matchTax;
  });

  // 2. อัปเดต Badge ยอดรวม
  const countBadge = document.getElementById('shops-count-badge');
  if (countBadge) {
    countBadge.textContent = `พบ ${filtered.length} / ทั้งหมด ${(state.shops || []).length} ร้านค้า`;
  }

  // 3. แบ่งหน้า
  const pageSize = Number(state.shopsPagination.pageSize) || 0;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  if (state.shopsPagination.page > totalPages) state.shopsPagination.page = totalPages;
  if (state.shopsPagination.page < 1) state.shopsPagination.page = 1;

  const start = pageSize > 0 ? (state.shopsPagination.page - 1) * pageSize : 0;
  const end = pageSize > 0 ? start + pageSize : filtered.length;
  const pageShops = pageSize > 0 ? filtered.slice(start, end) : filtered;

  // 4. อัปเดต Footer แสดงข้อมูลหน้า
  const infoEl = document.getElementById('shops-pagination-info');
  if (infoEl) {
    if (filtered.length === 0) {
      infoEl.textContent = 'แสดง 0-0 จาก 0 ร้านค้า';
    } else {
      infoEl.textContent = `แสดง ${start + 1}-${Math.min(end, filtered.length)} จาก ${filtered.length} ร้านค้า`;
    }
  }

  const pageNumEl = document.getElementById('shops-page-number');
  if (pageNumEl) {
    pageNumEl.textContent = `${state.shopsPagination.page} / ${totalPages}`;
  }

  const prevBtn = document.getElementById('shops-prev-page');
  if (prevBtn) prevBtn.disabled = state.shopsPagination.page <= 1;

  const nextBtn = document.getElementById('shops-next-page');
  if (nextBtn) nextBtn.disabled = state.shopsPagination.page >= totalPages;

  // 5. แสดงผลแถวตาราง
  if (pageShops.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-slate-400">
          <i class="fa-solid fa-store-slash text-2xl text-slate-300 block mb-2"></i>
          ไม่พบข้อมูลร้านค้าตามเงื่อนไขที่ค้นหา
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pageShops.map((s, idx) => {
    const shopJson = JSON.stringify(s).replace(/"/g, '&quot;');
    const rowNum = start + idx + 1;
    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
        <td class="py-3 px-4 font-mono text-slate-400">${rowNum}</td>
        <td class="py-3 px-4 font-bold text-slate-800">${escapeHtml(s.shop_name)}</td>
        <td class="py-3 px-4 text-slate-600 text-xs">${escapeHtml(s.address || '-')}</td>
        <td class="py-3 px-4 font-mono text-slate-600 text-xs">${escapeHtml(s.phone || '-')}</td>
        <td class="py-3 px-4 font-mono text-slate-600 text-xs">${escapeHtml(s.tax_id || '-')}</td>
        <td class="py-3 px-4 text-center">
          <button onclick="editShopModal(${shopJson})" class="text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-medium px-2.5 py-1 rounded transition" title="แก้ไขข้อมูลร้านค้า">
            <i class="fa-solid fa-pen-to-square mr-1"></i> แก้ไข
          </button>
        </td>
      </tr>
    `;
  }).join('');
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
    const isSuper = u.role === 'superadmin' || u.id === 1;
    const activeClass = u.is_active === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
    const activeText = u.is_active === 1 ? 'ใช้งานปกติ' : 'ระงับใช้งาน';

    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="py-3 px-4 font-mono font-bold text-slate-900">${escapeHtml(u.username)}</td>
        <td class="py-3 px-4 font-medium text-slate-800">${escapeHtml(u.fullname)}</td>
        <td class="py-3 px-4 text-slate-600 text-xs">${escapeHtml(u.department)}</td>
        <td class="py-3 px-4 text-center">
          <span class="px-2 py-0.5 rounded text-xs font-mono font-bold ${isSuper ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}">
            ${escapeHtml(u.role.toUpperCase())}
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
        <td class="py-3 px-4 text-center space-x-1 whitespace-nowrap">
          ${isSuper ? `
            <div class="inline-flex items-center space-x-1">
              <button disabled class="text-xs bg-slate-100 text-slate-400 px-2 py-1 rounded border border-slate-200 font-medium cursor-not-allowed opacity-50" title="Superadmin ไม่สามารถแก้ไขได้">
                <i class="fa-solid fa-user-pen"></i> แก้ไข
              </button>
              <button disabled class="text-xs bg-slate-100 text-slate-400 px-2 py-1 rounded border border-slate-200 font-medium cursor-not-allowed opacity-50" title="Superadmin ไม่สามารถรีเซ็ตรหัสผ่านตรงนี้ได้">
                <i class="fa-solid fa-key"></i>
              </button>
              <button disabled class="text-xs bg-slate-100 text-slate-400 px-1.5 py-1 rounded border border-slate-200 font-medium cursor-not-allowed opacity-50" title="Superadmin เปิดใช้งานตลอดเวลา">
                <i class="fa-solid fa-lock"></i>
              </button>
              <button disabled class="text-xs bg-slate-100 text-slate-400 px-2 py-1 rounded border border-slate-200 font-medium cursor-not-allowed opacity-50" title="Superadmin ไม่สามารถลบได้">
                <i class="fa-solid fa-trash-can"></i> ลบ
              </button>
              <span class="inline-flex items-center text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium ml-1">
                <i class="fa-solid fa-shield-halved mr-1 text-amber-500"></i> ล็อก
              </span>
            </div>
          ` : `
            <button onclick="openEditUserModal(${u.id})" class="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 px-2 py-1 rounded border border-amber-200 font-medium transition" title="แก้ไขข้อมูล">
              <i class="fa-solid fa-user-pen"></i> แก้ไข
            </button>
            <button onclick="openResetPasswordModal(${u.id}, '${u.username}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded border border-slate-300 font-medium transition" title="รีเซ็ตรหัส">
              <i class="fa-solid fa-key"></i>
            </button>
            <button onclick="toggleUserStatus(${u.id})" class="text-xs ${u.is_active === 1 ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'} px-1.5 py-1 rounded border font-medium transition" title="ระงับ/เปิดใช้">
              ${u.is_active === 1 ? '<i class="fa-solid fa-ban"></i>' : '<i class="fa-solid fa-check"></i>'}
            </button>
            <button onclick="openDeleteUserModal(${u.id})" class="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-1 rounded border border-rose-200 font-medium transition" title="ลบผู้ใช้">
              <i class="fa-solid fa-trash-can"></i> ลบ
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

function openEditUserModal(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;
  if (user.id === 1 || user.role === 'superadmin') {
    showToast('ไม่อนุญาตให้แก้ไขข้อมูลบัญชี Superadmin', 'error');
    return;
  }

  document.getElementById('edit-user-id').value = user.id;
  document.getElementById('edit-user-username').value = user.username;
  document.getElementById('edit-user-fullname').value = user.fullname;
  document.getElementById('edit-user-role').value = user.role;
  document.getElementById('edit-user-dept').value = user.department;
  document.getElementById('edit-user-password').value = '';

  openModal('user-edit-modal');
}

function openDeleteUserModal(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;
  if (user.id === 1 || user.role === 'superadmin') {
    showToast('ไม่อนุญาตให้ลบบัญชี Superadmin', 'error');
    return;
  }

  document.getElementById('delete-user-id').value = user.id;
  document.getElementById('delete-user-name').textContent = user.fullname;
  document.getElementById('delete-user-username').textContent = user.username;
  document.getElementById('delete-user-dept').textContent = user.department;

  openModal('user-delete-modal');
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
  const user = state.users.find(u => u.id === userId);
  if (user && (user.id === 1 || user.role === 'superadmin')) {
    showToast('ไม่อนุญาตให้ระงับการใช้งานบัญชี Superadmin', 'error');
    return;
  }
  const res = await apiRequest(`/api/admin/users/${userId}/toggle-status`, 'PUT');
  if (res.ok) {
    showToast(res.data.message || 'ปรับปรุงสถานะสำเร็จ', 'success');
    loadUsersManagement();
  } else {
    showToast(res.data.message || 'เกิดข้อผิดพลาด', 'error');
  }
}

// ============================================================================
// 10.1 Module 8: แดชบอร์ดสรุปยอดรับเข้าพัสดุ (Inbound Dashboard)
// ============================================================================

function initDashboardBuy() {
  const filterType = document.getElementById('dash-buy-filter-type');
  const fyBox = document.getElementById('dash-buy-fy-box');
  const yearBox = document.getElementById('dash-buy-year-box');
  const monthBox = document.getElementById('dash-buy-month-box');
  const rangeBox = document.getElementById('dash-buy-range-box');

  function updateFilterVisibility() {
    const val = filterType.value;
    fyBox.classList.toggle('hidden', val !== 'fiscal_year');
    yearBox.classList.toggle('hidden', val !== 'year' && val !== 'month');
    monthBox.classList.toggle('hidden', val !== 'month');
    rangeBox.classList.toggle('hidden', val !== 'range');
  }

  if (filterType) filterType.onchange = updateFilterVisibility;
  updateFilterVisibility();

  // Set default dates
  const now = new Date();
  const startEl = document.getElementById('dash-buy-start-date');
  const endEl = document.getElementById('dash-buy-end-date');
  if (startEl) startEl.value = `${now.getFullYear()}-01-01`;
  if (endEl) endEl.value = now.toISOString().slice(0, 10);

  loadDashboardBuy();
}

async function loadDashboardBuy() {
  const filterType = document.getElementById('dash-buy-filter-type')?.value || 'fiscal_year';
  const fy = document.getElementById('dash-buy-fiscal-year')?.value || '2569';
  const year = document.getElementById('dash-buy-year')?.value || '2026';
  const month = document.getElementById('dash-buy-month')?.value || '01';
  const startDate = document.getElementById('dash-buy-start-date')?.value || '';
  const endDate = document.getElementById('dash-buy-end-date')?.value || '';

  const query = new URLSearchParams();
  query.append('type', filterType);
  if (filterType === 'fiscal_year') query.append('fiscal_year', fy);
  else if (filterType === 'year') query.append('year', year);
  else if (filterType === 'month') {
    query.append('year', year);
    query.append('month', month);
  } else if (filterType === 'range') {
    query.append('start_date', startDate);
    query.append('end_date', endDate);
  }

  const res = await apiRequest(`/api/reports/dashboard-buys?${query.toString()}`);
  if (!res.ok || !res.data) {
    showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล Dashboard รับเข้า', 'error');
    return;
  }

  const { filter, date_range, kpis, monthly_trend = [], categories = [], top_shops = [], top_items = [] } = res.data;

  // Period display
  const f = filter || date_range;
  if (f) {
    const pEl = document.getElementById('dash-buy-period-display');
    const s = f.start_date || f.startDate || '';
    const e = f.end_date || f.endDate || '';
    if (pEl) pEl.textContent = `${s} ถึง ${e}`;
  }

  // KPIs
  if (kpis) {
    const totalVal = kpis.total_val ?? kpis.total_value ?? 0;
    document.getElementById('dash-buy-kpi-val').textContent = `${Number(totalVal).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บ.`;
    document.getElementById('dash-buy-kpi-items').textContent = Number(kpis.total_items || 0).toLocaleString();
    document.getElementById('dash-buy-kpi-docs').textContent = Number(kpis.total_docs || 0).toLocaleString();
    document.getElementById('dash-buy-kpi-shops').textContent = Number(kpis.total_shops || 0).toLocaleString();
  }

  // Monthly Trend Chart
  renderDashboardTrendChart('dash-buy-chart-container', monthly_trend, 'emerald');

  // Categories Breakdown
  const catTbody = document.getElementById('dash-buy-categories-tbody');
  if (catTbody) {
    if (categories.length === 0) {
      catTbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">ไม่มีข้อมูล</td></tr>';
    } else {
      catTbody.innerHTML = categories.map(c => `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
          <td class="p-2 font-medium text-slate-800">${c.category}</td>
          <td class="p-2 text-right font-mono text-slate-600">${Number(c.count).toLocaleString()}</td>
          <td class="p-2 text-right font-mono font-bold text-emerald-800">${Number(c.total_val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('');
    }
  }

  // Top Shops Breakdown
  const shopTbody = document.getElementById('dash-buy-shops-tbody');
  if (shopTbody) {
    if (top_shops.length === 0) {
      shopTbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">ไม่มีข้อมูล</td></tr>';
    } else {
      shopTbody.innerHTML = top_shops.map(s => `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
          <td class="p-2 font-medium text-slate-800">${s.shop_name}</td>
          <td class="p-2 text-right font-mono text-slate-600">${Number(s.doc_count).toLocaleString()}</td>
          <td class="p-2 text-right font-mono font-bold text-slate-900">${Number(s.total_val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('');
    }
  }

  // Top 10 Items
  const itemsTbody = document.getElementById('dash-buy-topitems-tbody');
  if (itemsTbody) {
    if (top_items.length === 0) {
      itemsTbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">ไม่มีข้อมูล</td></tr>';
    } else {
      itemsTbody.innerHTML = top_items.map(i => `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
          <td class="p-2.5 font-mono font-bold text-slate-900">${i.item_code}</td>
          <td class="p-2.5 font-medium text-slate-800">${i.item_name}</td>
          <td class="p-2.5 text-slate-600">${i.category}</td>
          <td class="p-2.5 text-right font-mono font-semibold text-emerald-700">${Number(i.total_qty).toLocaleString()}</td>
          <td class="p-2.5 text-center text-slate-600">${i.unit}</td>
          <td class="p-2.5 text-right font-mono font-bold text-slate-900">${Number(i.total_val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('');
    }
  }
}

// ============================================================================
// 10.2 Module 9: แดชบอร์ดสรุปยอดเบิกจ่ายพัสดุ (Outbound Dashboard)
// ============================================================================

function initDashboardPay() {
  const filterType = document.getElementById('dash-pay-filter-type');
  const fyBox = document.getElementById('dash-pay-fy-box');
  const yearBox = document.getElementById('dash-pay-year-box');
  const monthBox = document.getElementById('dash-pay-month-box');
  const rangeBox = document.getElementById('dash-pay-range-box');

  function updateFilterVisibility() {
    const val = filterType.value;
    fyBox.classList.toggle('hidden', val !== 'fiscal_year');
    yearBox.classList.toggle('hidden', val !== 'year' && val !== 'month');
    monthBox.classList.toggle('hidden', val !== 'month');
    rangeBox.classList.toggle('hidden', val !== 'range');
  }

  if (filterType) filterType.onchange = updateFilterVisibility;
  updateFilterVisibility();

  // Set default dates
  const now = new Date();
  const startEl = document.getElementById('dash-pay-start-date');
  const endEl = document.getElementById('dash-pay-end-date');
  if (startEl) startEl.value = `${now.getFullYear()}-01-01`;
  if (endEl) endEl.value = now.toISOString().slice(0, 10);

  loadDashboardPay();
}

async function loadDashboardPay() {
  const filterType = document.getElementById('dash-pay-filter-type')?.value || 'fiscal_year';
  const fy = document.getElementById('dash-pay-fiscal-year')?.value || '2569';
  const year = document.getElementById('dash-pay-year')?.value || '2026';
  const month = document.getElementById('dash-pay-month')?.value || '01';
  const startDate = document.getElementById('dash-pay-start-date')?.value || '';
  const endDate = document.getElementById('dash-pay-end-date')?.value || '';

  const query = new URLSearchParams();
  query.append('type', filterType);
  if (filterType === 'fiscal_year') query.append('fiscal_year', fy);
  else if (filterType === 'year') query.append('year', year);
  else if (filterType === 'month') {
    query.append('year', year);
    query.append('month', month);
  } else if (filterType === 'range') {
    query.append('start_date', startDate);
    query.append('end_date', endDate);
  }

  const res = await apiRequest(`/api/reports/dashboard-pays?${query.toString()}`);
  if (!res.ok || !res.data) {
    showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล Dashboard เบิกจ่าย', 'error');
    return;
  }

  const { filter, date_range, kpis, monthly_trend = [], departments = [], categories = [], top_items = [] } = res.data;

  // Period display
  const f = filter || date_range;
  if (f) {
    const pEl = document.getElementById('dash-pay-period-display');
    const s = f.start_date || f.startDate || '';
    const e = f.end_date || f.endDate || '';
    if (pEl) pEl.textContent = `${s} ถึง ${e}`;
  }

  // KPIs
  if (kpis) {
    const totalVal = kpis.total_val ?? kpis.total_value ?? 0;
    document.getElementById('dash-pay-kpi-val').textContent = `${Number(totalVal).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บ.`;
    document.getElementById('dash-pay-kpi-items').textContent = Number(kpis.total_items || 0).toLocaleString();
    document.getElementById('dash-pay-kpi-docs').textContent = Number(kpis.total_docs || 0).toLocaleString();
    document.getElementById('dash-pay-kpi-depts').textContent = Number(kpis.total_departments || 0).toLocaleString();
  }

  // Monthly Trend Chart
  renderDashboardTrendChart('dash-pay-chart-container', monthly_trend, 'teal');

  // Departments Breakdown
  const deptTbody = document.getElementById('dash-pay-departments-tbody');
  if (deptTbody) {
    if (departments.length === 0) {
      deptTbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">ไม่มีข้อมูล</td></tr>';
    } else {
      deptTbody.innerHTML = departments.map(d => `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
          <td class="p-2 font-medium text-slate-800">${d.department}</td>
          <td class="p-2 text-right font-mono text-slate-600">${Number(d.doc_count).toLocaleString()}</td>
          <td class="p-2 text-right font-mono font-bold text-teal-800">${Number(d.total_val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('');
    }
  }

  // Categories Breakdown
  const catTbody = document.getElementById('dash-pay-categories-tbody');
  if (catTbody) {
    if (categories.length === 0) {
      catTbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">ไม่มีข้อมูล</td></tr>';
    } else {
      catTbody.innerHTML = categories.map(c => `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
          <td class="p-2 font-medium text-slate-800">${c.category}</td>
          <td class="p-2 text-right font-mono text-slate-600">${Number(c.total_qty || 0).toLocaleString()}</td>
          <td class="p-2 text-right font-mono font-bold text-slate-900">${Number(c.total_val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('');
    }
  }

  // Top 10 Items
  const itemsTbody = document.getElementById('dash-pay-topitems-tbody');
  if (itemsTbody) {
    if (top_items.length === 0) {
      itemsTbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">ไม่มีข้อมูล</td></tr>';
    } else {
      itemsTbody.innerHTML = top_items.map(i => `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
          <td class="p-2.5 font-mono font-bold text-slate-900">${i.item_code}</td>
          <td class="p-2.5 font-medium text-slate-800">${i.item_name}</td>
          <td class="p-2.5 text-slate-600">${i.category}</td>
          <td class="p-2.5 text-right font-mono font-semibold text-rose-700">-${Number(i.total_qty).toLocaleString()}</td>
          <td class="p-2.5 text-center text-slate-600">${i.unit}</td>
          <td class="p-2.5 text-right font-mono font-bold text-slate-900">${Number(i.total_val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('');
    }
  }
}

/**
 * Render dynamic monthly bar chart using pure HTML & CSS
 */
function renderDashboardTrendChart(containerId, monthlyData = [], colorTheme = 'emerald') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (monthlyData.length === 0) {
    container.innerHTML = '<div class="w-full text-center py-10 text-slate-400 text-xs">ไม่มีข้อมูลแนวโน้มรายเดือนในช่วงเวลานี้</div>';
    return;
  }

  const maxVal = Math.max(...monthlyData.map(m => Number(m.total_val) || 0), 1);
  const colorBar = colorTheme === 'teal' ? 'bg-teal-500 hover:bg-teal-600' : 'bg-emerald-500 hover:bg-emerald-600';

  container.innerHTML = monthlyData.map(item => {
    const val = Number(item.total_val) || 0;
    const heightPercent = Math.max(Math.round((val / maxVal) * 100), 4);
    const monthKey = item.month || item.ym || '';
    const shortLabel = monthKey.length >= 5 ? monthKey.slice(2) : (monthKey || '-');

    return `
      <div class="flex-1 flex flex-col items-center justify-end h-44 group relative min-w-[36px]">
        <!-- Value Tooltip -->
        <div class="opacity-0 group-hover:opacity-100 transition absolute -top-8 bg-slate-900 text-white text-[10px] py-1 px-2 rounded shadow whitespace-nowrap z-20 pointer-events-none">
          ${monthKey}: ${val.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บ. (${item.doc_count || 0} บิล)
        </div>
        <!-- Bar Value -->
        <span class="text-[9px] font-mono text-slate-500 mb-1 group-hover:font-bold truncate max-w-full">
          ${val > 0 ? (val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0)) : '0'}
        </span>
        <!-- Vertical Bar -->
        <div class="w-full max-w-[42px] ${colorBar} rounded-t-md transition-all duration-300" style="height: ${heightPercent}%;"></div>
        <!-- Month Label -->
        <span class="text-[10px] text-slate-600 mt-2 font-mono">${shortLabel}</span>
      </div>
    `;
  }).join('');
}

// ============================================================================
// 11. Modal Utilities & Dropdown Helpers
// ============================================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * ฟังก์ชันย่อ/ขยายข้อความที่ยาวเกินไปในตาราง (ร้านค้า หรือ หน่วยงานที่เบิก)
 */
function formatExpandableCell(fullText, maxLen = 22) {
  if (!fullText) return '<span class="text-slate-400">-</span>';
  const text = String(fullText).trim();
  if (text.length <= maxLen) {
    return `<span class="font-medium text-slate-700">${escapeHtml(text)}</span>`;
  }
  const shortText = text.slice(0, maxLen) + '...';
  const cellId = 'exp_' + Math.random().toString(36).substring(2, 9);
  return `
    <div class="inline-flex items-center space-x-1.5 max-w-[220px]" title="${escapeHtml(text)}">
      <span id="${cellId}_short" class="font-medium text-slate-700 truncate">${escapeHtml(shortText)}</span>
      <span id="${cellId}_full" class="hidden font-medium text-slate-700 whitespace-normal break-words">${escapeHtml(text)}</span>
      <button type="button" onclick="const s=document.getElementById('${cellId}_short');const f=document.getElementById('${cellId}_full');const isH=f.classList.contains('hidden');if(isH){f.classList.remove('hidden');s.classList.add('hidden');this.innerHTML='<i class=\\'fa-solid fa-chevron-up\\'></i>';this.title='ย่อ';}else{f.classList.add('hidden');s.classList.remove('hidden');this.innerHTML='<i class=\\'fa-solid fa-chevron-down\\'></i>';this.title='ขยาย';}" class="text-[10px] text-teal-600 hover:text-teal-800 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded shrink-0 transition" title="กดเพื่อขยาย/ย่อข้อความ">
        <i class="fa-solid fa-chevron-down"></i>
      </button>
    </div>
  `;
}

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

  function populateRememberedCredentials() {
    const saved = localStorage.getItem('saiyok_remember_cred');
    const uInput = document.getElementById('login-username');
    const pInput = document.getElementById('login-password');
    const remBox = document.getElementById('login-remember-me');
    if (saved && uInput && pInput && remBox) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.username) {
          uInput.value = parsed.username;
          pInput.value = parsed.password || '';
          remBox.checked = true;
          return;
        }
      } catch (e) {}
    }
    if (uInput && !saved) uInput.value = '';
    if (pInput && !saved) pInput.value = '';
    if (remBox) remBox.checked = false;
  }

  // 3. Login Modal & Form
  populateRememberedCredentials();

  document.getElementById('btn-open-login').addEventListener('click', () => {
    populateRememberedCredentials();
    openModal('login-modal');
  });

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const rememberCheckbox = document.getElementById('login-remember-me');

    const res = await apiRequest('/api/auth/login', 'POST', { username, password });
    if (res.ok && res.data.success) {
      state.token = res.data.token;
      state.currentUser = res.data.user;
      state.userPermissions = res.data.permissions;
      localStorage.setItem('saiyok_token', state.token);

      if (rememberCheckbox && rememberCheckbox.checked) {
        localStorage.setItem('saiyok_remember_cred', JSON.stringify({ username, password }));
      } else {
        localStorage.removeItem('saiyok_remember_cred');
      }

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
    populateRememberedCredentials();
  });

  // 5. Stock Balance Search & Filters
  document.getElementById('stock-search').addEventListener('input', debounce(loadStockBalance, 300));
  document.getElementById('stock-category-filter').addEventListener('change', () => {
    state.stockPagination.page = 1;
    loadStockBalance();
  });
  document.getElementById('stock-status-filter').addEventListener('change', () => {
    state.stockPagination.page = 1;
    loadStockBalance();
  });
  document.getElementById('btn-refresh-stock').addEventListener('click', () => {
    loadStockBalance();
    showToast('รีเฟรชข้อมูลสต๊อกเรียบร้อย', 'info');
  });

  // Stock Pagination Controls
  const stockPageSize = document.getElementById('stock-page-size');
  if (stockPageSize) {
    stockPageSize.addEventListener('change', () => {
      state.stockPagination.page = 1;
      renderStockBalanceTable();
    });
  }
  const stockPrevBtn = document.getElementById('stock-prev-page');
  if (stockPrevBtn) {
    stockPrevBtn.addEventListener('click', () => {
      if (state.stockPagination.page > 1) {
        state.stockPagination.page--;
        renderStockBalanceTable();
      }
    });
  }
  const stockNextBtn = document.getElementById('stock-next-page');
  if (stockNextBtn) {
    stockNextBtn.addEventListener('click', () => {
      state.stockPagination.page++;
      renderStockBalanceTable();
    });
  }

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

  // 6. Buy Module Form Events & Two-Way Price Calculation
  const buyQty = document.getElementById('buy-qty');
  const buyPrice = document.getElementById('buy-price');
  const buyTotalPrice = document.getElementById('buy-total-price');

  if (buyQty && buyPrice && buyTotalPrice) {
    function recalcBuyTotalFromUnit() {
      const q = parseFloat(buyQty.value) || 0;
      const p = parseFloat(buyPrice.value) || 0;
      if (q > 0 && p >= 0) {
        buyTotalPrice.value = (Math.round(q * p * 100) / 100).toFixed(2);
      }
    }
    function recalcBuyUnitFromTotal() {
      const q = parseFloat(buyQty.value) || 0;
      const t = parseFloat(buyTotalPrice.value) || 0;
      if (q > 0 && t >= 0) {
        buyPrice.value = (Math.round((t / q) * 10000) / 10000).toFixed(4);
      }
    }

    buyQty.addEventListener('input', recalcBuyTotalFromUnit);
    buyPrice.addEventListener('input', recalcBuyTotalFromUnit);
    buyTotalPrice.addEventListener('input', recalcBuyUnitFromTotal);
  }

  // Buy Cart Buttons
  const btnBuyAddToCart = document.getElementById('btn-buy-add-item-to-cart');
  if (btnBuyAddToCart) btnBuyAddToCart.addEventListener('click', addBuyItemToCart);

  const btnBuyClearItem = document.getElementById('btn-buy-clear-item');
  if (btnBuyClearItem) btnBuyClearItem.addEventListener('click', clearBuyItemInputs);

  // Buy History Search & Pagination
  const buysSearch = document.getElementById('buys-history-search');
  if (buysSearch) {
    buysSearch.addEventListener('input', debounce(() => loadRecentBuys(1), 300));
  }
  const btnReloadBuys = document.getElementById('btn-reload-buys');
  if (btnReloadBuys) btnReloadBuys.addEventListener('click', () => loadRecentBuys(state.buysPagination.page));

  const buysPageSize = document.getElementById('buys-page-size');
  if (buysPageSize) {
    buysPageSize.addEventListener('change', () => loadRecentBuys(1));
  }
  const buysPrevBtn = document.getElementById('buys-prev-page');
  if (buysPrevBtn) {
    buysPrevBtn.addEventListener('click', () => {
      if (state.buysPagination.page > 1) loadRecentBuys(state.buysPagination.page - 1);
    });
  }
  const buysNextBtn = document.getElementById('buys-next-page');
  if (buysNextBtn) {
    buysNextBtn.addEventListener('click', () => {
      if (state.buysPagination.page < state.buysPagination.totalPages) {
        loadRecentBuys(state.buysPagination.page + 1);
      }
    });
  }

  // Buy Form Submission (Batch Multi-Item Cart or Single Item)
  document.getElementById('form-buy').addEventListener('submit', async (e) => {
    e.preventDefault();

    const doc_date = document.getElementById('buy-doc-date').value;
    const doc_no = document.getElementById('buy-doc-no').value.trim();
    const shop_name = document.getElementById('buy-shop-name').value;
    const remark = document.getElementById('buy-remark').value.trim();

    if (!doc_no) {
      showToast('กรุณาระบุเลขที่เอกสาร / บิลรับเข้า', 'warning');
      return;
    }
    if (!shop_name) {
      showToast('กรุณาเลือกร้านค้า / แหล่งรับเข้า', 'warning');
      return;
    }

    let payload = null;

    if (state.buyCart.length > 0) {
      payload = {
        doc_date,
        doc_no,
        shop_name,
        remark,
        items: state.buyCart
      };
    } else {
      // Single Item check
      const item_code = document.getElementById('buy-item-code').value;
      const qty = parseFloat(document.getElementById('buy-qty').value) || 0;
      let price = parseFloat(document.getElementById('buy-price').value) || 0;
      let total = parseFloat(document.getElementById('buy-total-price').value) || 0;

      if (!item_code || qty <= 0) {
        showToast('กรุณาเลือกรายการพัสดุและระบุจำนวน หรือกดเพิ่มรายการลงในบิลก่อน', 'warning');
        return;
      }

      if (total > 0 && price === 0) {
        price = Math.round((total / qty) * 10000) / 10000;
      } else if (price > 0 && total === 0) {
        total = Math.round(qty * price * 100) / 100;
      }

      payload = {
        doc_date,
        doc_no,
        shop_name,
        remark,
        item_code,
        quantity: qty,
        price_per_unit: price,
        total_price: total
      };
    }

    const res = await apiRequest('/api/buys', 'POST', payload);
    if (res.ok && res.data.success) {
      showToast(res.data.message || 'บันทึกรับเข้าพัสดุเรียบร้อยแล้ว', 'success');
      document.getElementById('form-buy').reset();
      document.getElementById('buy-doc-date').value = new Date().toISOString().slice(0, 10);
      state.buyCart = [];
      renderBuyCart();
      clearBuyItemInputs();
      loadRecentBuys(1);
      loadStockBalance();
    } else {
      showToast(res.data.message || 'บันทึกรับเข้าล้มเหลว', 'error');
    }
  });

  // 7. Pay Module Form Events, Two-Way Math & Pull Buy Modal
  const payQty = document.getElementById('pay-qty');
  const payPrice = document.getElementById('pay-price');
  const payTotalPrice = document.getElementById('pay-total-price');

  if (payQty && payPrice && payTotalPrice) {
    function recalcPayTotalFromUnit() {
      const q = parseFloat(payQty.value) || 0;
      const p = parseFloat(payPrice.value) || 0;
      if (q > 0 && p >= 0) {
        payTotalPrice.value = (Math.round(q * p * 100) / 100).toFixed(2);
      }
      validatePayQuantity();
    }
    function recalcPayUnitFromTotal() {
      const q = parseFloat(payQty.value) || 0;
      const t = parseFloat(payTotalPrice.value) || 0;
      if (q > 0 && t >= 0) {
        payPrice.value = (Math.round((t / q) * 10000) / 10000).toFixed(4);
      }
      validatePayQuantity();
    }

    payQty.addEventListener('input', recalcPayTotalFromUnit);
    payPrice.addEventListener('input', recalcPayTotalFromUnit);
    payTotalPrice.addEventListener('input', recalcPayUnitFromTotal);
  }

  // Pay Cart Buttons
  const btnPayAddToCart = document.getElementById('btn-pay-add-item-to-cart');
  if (btnPayAddToCart) btnPayAddToCart.addEventListener('click', addPayItemToCart);

  const btnPayClearItem = document.getElementById('btn-pay-clear-item');
  if (btnPayClearItem) btnPayClearItem.addEventListener('click', clearPayItemInputs);

  // Pull Buy Bill Buttons
  const btnOpenPullBuy = document.getElementById('btn-open-pull-buy');
  if (btnOpenPullBuy) btnOpenPullBuy.addEventListener('click', openPullBuyModal);

  const btnConfirmPullBuy = document.getElementById('btn-confirm-pull-buy');
  if (btnConfirmPullBuy) btnConfirmPullBuy.addEventListener('click', confirmPullBuyBill);

  // Pay History Search & Pagination
  const paysSearch = document.getElementById('pays-history-search');
  if (paysSearch) {
    paysSearch.addEventListener('input', debounce(() => loadRecentPays(1), 300));
  }
  const btnReloadPays = document.getElementById('btn-reload-pays');
  if (btnReloadPays) btnReloadPays.addEventListener('click', () => loadRecentPays(state.paysPagination.page));

  const paysPageSize = document.getElementById('pays-page-size');
  if (paysPageSize) {
    paysPageSize.addEventListener('change', () => loadRecentPays(1));
  }
  const paysPrevBtn = document.getElementById('pays-prev-page');
  if (paysPrevBtn) {
    paysPrevBtn.addEventListener('click', () => {
      if (state.paysPagination.page > 1) loadRecentPays(state.paysPagination.page - 1);
    });
  }
  const paysNextBtn = document.getElementById('pays-next-page');
  if (paysNextBtn) {
    paysNextBtn.addEventListener('click', () => {
      if (state.paysPagination.page < state.paysPagination.totalPages) {
        loadRecentPays(state.paysPagination.page + 1);
      }
    });
  }

  // Pay Form Submission (Batch Multi-Item Cart or Single Item with Negative Check)
  document.getElementById('form-pay').addEventListener('submit', async (e) => {
    e.preventDefault();

    const doc_date = document.getElementById('pay-doc-date').value;
    const doc_no = document.getElementById('pay-doc-no').value.trim();
    const department = document.getElementById('pay-department').value.trim();
    const remark = document.getElementById('pay-remark').value.trim();

    if (!doc_no) {
      showToast('กรุณาระบุเลขที่ใบเบิก', 'warning');
      return;
    }
    if (!department) {
      showToast('กรุณาระบุแผนก / หน่วยงานที่เบิก', 'warning');
      return;
    }

    let payload = null;

    if (state.payCart.length > 0) {
      payload = {
        doc_date,
        doc_no,
        department,
        remark,
        items: state.payCart
      };
    } else {
      // Single Item check
      const item_code = document.getElementById('pay-item-code').value;
      const qty = parseFloat(document.getElementById('pay-qty').value) || 0;
      let price = parseFloat(document.getElementById('pay-price').value) || 0;
      let total = parseFloat(document.getElementById('pay-total-price').value) || 0;

      if (!item_code || qty <= 0) {
        showToast('กรุณาเลือกรายการพัสดุและระบุจำนวนที่ขอเบิก หรือกดเพิ่มรายการลงในใบเบิกก่อน', 'warning');
        return;
      }

      const stock = (state.stockItems || []).find(s => s.item_code === item_code);
      const balance = stock ? Number(stock.balance_qty) : 0;
      if (qty > balance) {
        showToast(`จำนวนที่ขอเบิก (${qty}) เกินคงเหลือจริงในคลัง (${balance}) ไม่อนุญาตให้ติดลบ`, 'error');
        return;
      }

      if (total > 0 && price === 0) {
        price = Math.round((total / qty) * 10000) / 10000;
      } else if (price > 0 && total === 0) {
        total = Math.round(qty * price * 100) / 100;
      } else if (price === 0 && total === 0 && stock) {
        price = stock.avg_unit_price || 0;
        total = Math.round(qty * price * 100) / 100;
      }

      payload = {
        doc_date,
        doc_no,
        department,
        remark,
        item_code,
        quantity: qty,
        price_per_unit: price,
        total_price: total
      };
    }

    const res = await apiRequest('/api/pays', 'POST', payload);
    if (res.ok && res.data.success) {
      showToast(res.data.message || 'บันทึกเบิกจ่ายพัสดุสำเร็จ', 'success');
      document.getElementById('form-pay').reset();
      document.getElementById('pay-doc-date').value = new Date().toISOString().slice(0, 10);
      state.payCart = [];
      renderPayCart();
      clearPayItemInputs();
      loadRecentPays(1);
      loadStockBalance();
    } else {
      showToast(res.data.message || 'บันทึกเบิกจ่ายล้มเหลว', 'error');
    }
  });

  // User Management: Edit User Form Submission
  const formUserEdit = document.getElementById('form-user-edit');
  if (formUserEdit) {
    formUserEdit.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = document.getElementById('edit-user-id').value;
      const data = {
        fullname: document.getElementById('edit-user-fullname').value.trim(),
        role: document.getElementById('edit-user-role').value,
        department: document.getElementById('edit-user-dept').value.trim()
      };
      const pw = document.getElementById('edit-user-password').value;
      if (pw) data.password = pw;

      const res = await apiRequest(`/api/admin/users/${userId}`, 'PUT', data);
      if (res.ok) {
        showToast(res.data.message || 'แก้ไขข้อมูลผู้ใช้สำเร็จ', 'success');
        closeModal('user-edit-modal');
        loadUsersManagement();
      } else {
        showToast(res.data.message || 'เกิดข้อผิดพลาดในการแก้ไข', 'error');
      }
    });
  }

  // User Management: Delete User Confirmation Action
  const btnConfirmDeleteUser = document.getElementById('btn-confirm-delete-user');
  if (btnConfirmDeleteUser) {
    btnConfirmDeleteUser.addEventListener('click', async () => {
      const userId = document.getElementById('delete-user-id').value;
      const res = await apiRequest(`/api/admin/users/${userId}`, 'DELETE');
      if (res.ok) {
        showToast(res.data.message || 'ลบผู้ใช้งานสำเร็จ', 'success');
        closeModal('user-delete-modal');
        loadUsersManagement();
      } else {
        showToast(res.data.message || 'ไม่สามารถลบผู้ใช้งานได้', 'error');
      }
    });
  }

  // Dashboards Event Listeners
  const btnDashBuyApply = document.getElementById('btn-dash-buy-apply');
  if (btnDashBuyApply) btnDashBuyApply.addEventListener('click', loadDashboardBuy);

  const btnExportDashBuyCsv = document.getElementById('btn-export-dash-buy-csv');
  if (btnExportDashBuyCsv) {
    btnExportDashBuyCsv.addEventListener('click', () => {
      const kpiVal = document.getElementById('dash-buy-kpi-val')?.textContent || '';
      const kpiItems = document.getElementById('dash-buy-kpi-items')?.textContent || '';
      const kpiDocs = document.getElementById('dash-buy-kpi-docs')?.textContent || '';
      const period = document.getElementById('dash-buy-period-display')?.textContent || '';

      let csv = '\uFEFFรายงานสรุปยอดรับเข้าพัสดุ (Inbound Dashboard)\n';
      csv += `ช่วงเวลา,"${period}"\n`;
      csv += `มูลค่ารับเข้ารวม,"${kpiVal}"\n`;
      csv += `จำนวนรายการ,"${kpiItems}"\n`;
      csv += `จำนวนบิล,"${kpiDocs}"\n\n`;

      csv += 'รหัสพัสดุ,ชื่อพัสดุ,กลุ่มพัสดุ,จำนวนรับ,หน่วยนับ,มูลค่ารวม (บาท)\n';
      document.querySelectorAll('#dash-buy-topitems-tbody tr').forEach(row => {
        const cells = Array.from(row.querySelectorAll('td')).map(td => `"${td.textContent.trim()}"`);
        if (cells.length >= 6) csv += cells.join(',') + '\n';
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Dashboard_รับเข้า_รพ_ไทรโยค_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    });
  }

  const btnDashPayApply = document.getElementById('btn-dash-pay-apply');
  if (btnDashPayApply) btnDashPayApply.addEventListener('click', loadDashboardPay);

  const btnExportDashPayCsv = document.getElementById('btn-export-dash-pay-csv');
  if (btnExportDashPayCsv) {
    btnExportDashPayCsv.addEventListener('click', () => {
      const kpiVal = document.getElementById('dash-pay-kpi-val')?.textContent || '';
      const kpiItems = document.getElementById('dash-pay-kpi-items')?.textContent || '';
      const kpiDocs = document.getElementById('dash-pay-kpi-docs')?.textContent || '';
      const period = document.getElementById('dash-pay-period-display')?.textContent || '';

      let csv = '\uFEFFรายงานสรุปยอดเบิกจ่ายพัสดุ (Outbound Dashboard)\n';
      csv += `ช่วงเวลา,"${period}"\n`;
      csv += `มูลค่าเบิกจ่ายรวม,"${kpiVal}"\n`;
      csv += `จำนวนรายการเบิก,"${kpiItems}"\n`;
      csv += `จำนวนใบเบิก,"${kpiDocs}"\n\n`;

      csv += 'รหัสพัสดุ,ชื่อพัสดุ,กลุ่มพัสดุ,จำนวนเบิก,หน่วยนับ,มูลค่ารวม (บาท)\n';
      document.querySelectorAll('#dash-pay-topitems-tbody tr').forEach(row => {
        const cells = Array.from(row.querySelectorAll('td')).map(td => `"${td.textContent.trim()}"`);
        if (cells.length >= 6) csv += cells.join(',') + '\n';
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Dashboard_เบิกจ่าย_รพ_ไทรโยค_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    });
  }

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
    const codeInput = document.getElementById('modal-item-code');
    if (codeInput) {
      codeInput.value = '';
      codeInput.readOnly = false;
    }
    const statusSelect = document.getElementById('modal-item-status');
    if (statusSelect) statusSelect.value = '1';
    openModal('item-modal');
  });

  document.getElementById('form-item-modal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('modal-item-id').value;
    const statusSelect = document.getElementById('modal-item-status');
    const data = {
      item_code: document.getElementById('modal-item-code').value.trim(),
      item_name: document.getElementById('modal-item-name').value.trim(),
      unit: document.getElementById('modal-item-unit').value.trim(),
      category: document.getElementById('modal-item-category').value.trim(),
      min_stock: parseFloat(document.getElementById('modal-item-min').value) || 0,
      max_stock: parseFloat(document.getElementById('modal-item-max').value) || 0,
      is_active: statusSelect ? (parseInt(statusSelect.value, 10) || 0) : 1
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

  // 17. Items Master Search, Filter & Pagination Listeners
  const itemsSearch = document.getElementById('items-search');
  if (itemsSearch) {
    itemsSearch.addEventListener('input', debounce((e) => {
      state.itemsPagination.search = e.target.value;
      state.itemsPagination.page = 1;
      renderItemsTable();
    }, 200));
  }

  const itemsCatFilter = document.getElementById('items-category-filter');
  if (itemsCatFilter) {
    itemsCatFilter.addEventListener('change', (e) => {
      state.itemsPagination.category = e.target.value;
      state.itemsPagination.page = 1;
      renderItemsTable();
    });
  }

  const itemsStatusFilter = document.getElementById('items-status-filter');
  if (itemsStatusFilter) {
    itemsStatusFilter.addEventListener('change', (e) => {
      state.itemsPagination.status = e.target.value;
      state.itemsPagination.page = 1;
      renderItemsTable();
    });
  }

  const itemsPageSize = document.getElementById('items-page-size');
  if (itemsPageSize) {
    itemsPageSize.addEventListener('change', (e) => {
      state.itemsPagination.pageSize = Number(e.target.value);
      state.itemsPagination.page = 1;
      renderItemsTable();
    });
  }

  const btnItemsPrev = document.getElementById('items-prev-page');
  if (btnItemsPrev) {
    btnItemsPrev.addEventListener('click', () => {
      if (state.itemsPagination.page > 1) {
        state.itemsPagination.page--;
        renderItemsTable();
      }
    });
  }

  const btnItemsNext = document.getElementById('items-next-page');
  if (btnItemsNext) {
    btnItemsNext.addEventListener('click', () => {
      state.itemsPagination.page++;
      renderItemsTable();
    });
  }

  const btnReloadItems = document.getElementById('btn-reload-items');
  if (btnReloadItems) {
    btnReloadItems.addEventListener('click', () => {
      loadItemsMaster();
      showToast('รีเฟรชข้อมูลพัสดุเรียบร้อย', 'info');
    });
  }

  // 18. Shops Master Search & Pagination Listeners
  const shopsSearch = document.getElementById('shops-search');
  if (shopsSearch) {
    shopsSearch.addEventListener('input', debounce((e) => {
      state.shopsPagination.search = e.target.value;
      state.shopsPagination.page = 1;
      renderShopsTable();
    }, 200));
  }

  const shopsPageSize = document.getElementById('shops-page-size');
  if (shopsPageSize) {
    shopsPageSize.addEventListener('change', (e) => {
      state.shopsPagination.pageSize = Number(e.target.value);
      state.shopsPagination.page = 1;
      renderShopsTable();
    });
  }

  const btnShopsPrev = document.getElementById('shops-prev-page');
  if (btnShopsPrev) {
    btnShopsPrev.addEventListener('click', () => {
      if (state.shopsPagination.page > 1) {
        state.shopsPagination.page--;
        renderShopsTable();
      }
    });
  }

  const btnShopsNext = document.getElementById('shops-next-page');
  if (btnShopsNext) {
    btnShopsNext.addEventListener('click', () => {
      state.shopsPagination.page++;
      renderShopsTable();
    });
  }

  const btnReloadShops = document.getElementById('btn-reload-shops');
  if (btnReloadShops) {
    btnReloadShops.addEventListener('click', () => {
      loadShopsMaster();
      showToast('รีเฟรชข้อมูลร้านค้าเรียบร้อย', 'info');
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
  const statusEl = document.getElementById('modal-item-status');
  if (statusEl) {
    statusEl.value = (item.is_active !== undefined ? item.is_active : 1).toString();
  }
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
