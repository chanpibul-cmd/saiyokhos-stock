-- ============================================================================
-- โรงพยาบาลไทรโยค (Sai Yok Hospital) - ระบบบริหารคลังและสต๊อกพัสดุ
-- Cloudflare D1 Database Schema & Initial Seed
-- ============================================================================

-- 1. ตารางผู้ใช้งานระบบ (users)
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS pays;
DROP TABLE IF EXISTS buys;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS shops;
DROP TABLE IF EXISTS users;
DROP VIEW IF EXISTS view_stock_balance;

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    fullname TEXT NOT NULL,
    department TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user', -- 'superadmin', 'admin', 'user'
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. ตารางสิทธิการใช้งานรายบุคคลและรายหน้า (permissions)
-- page_key: 'stock_balance', 'buy', 'pay', 'items', 'shops', 'reports', 'user_mgmt'
CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    page_key TEXT NOT NULL,
    can_view INTEGER NOT NULL DEFAULT 0,
    can_edit INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, page_key)
);

-- 3. ตารางข้อมูลร้านค้า / แหล่งรับเข้าพัสดุ (shops)
CREATE TABLE shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_name TEXT UNIQUE NOT NULL,
    address TEXT,
    phone TEXT,
    tax_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. ตารางข้อมูลทะเบียนรหัสพัสดุ (items)
CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code TEXT UNIQUE NOT NULL,
    item_name TEXT NOT NULL,
    unit TEXT NOT NULL,
    category TEXT NOT NULL, -- เช่น 'เวชภัณฑ์มิใช่ยา', 'วัสดุสำนักงาน', 'วัสดุงานบ้านงานครัว', 'วัสดุคอมพิวเตอร์'
    min_stock REAL NOT NULL DEFAULT 0,
    max_stock REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. ตารางบันทึกการรับเข้าพัสดุ (buys)
CREATE TABLE buys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_date DATE NOT NULL,
    doc_no TEXT NOT NULL,
    item_code TEXT NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    price_per_unit REAL NOT NULL DEFAULT 0,
    quantity REAL NOT NULL DEFAULT 0,
    total_price REAL NOT NULL DEFAULT 0,
    shop_name TEXT NOT NULL,
    remark TEXT,
    ym_period TEXT NOT NULL, -- เช่น '2024-01' สำหรับจัดกลุ่มงวดประจำเดือน
    created_by TEXT NOT NULL DEFAULT 'system',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_code) REFERENCES items(item_code) ON UPDATE CASCADE
);

-- 6. ตารางบันทึกการเบิกจ่ายพัสดุ (pays)
CREATE TABLE pays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_date DATE NOT NULL,
    doc_no TEXT NOT NULL,
    item_code TEXT NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    price_per_unit REAL NOT NULL DEFAULT 0,
    quantity REAL NOT NULL DEFAULT 0,
    total_price REAL NOT NULL DEFAULT 0,
    department TEXT NOT NULL, -- หน่วยงาน/แผนกที่เบิก เช่น 'ER', 'OPD', 'IPD', 'ทันตกรรม'
    remark TEXT,
    ym_period TEXT NOT NULL, -- เช่น '2024-01'
    created_by TEXT NOT NULL DEFAULT 'system',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_code) REFERENCES items(item_code) ON UPDATE CASCADE
);

-- ดัชนีเพิ่มความเร็วในการสืบค้น (Indexes)
CREATE INDEX idx_permissions_user_id ON permissions(user_id);
CREATE INDEX idx_items_item_code ON items(item_code);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_buys_item_code_date ON buys(item_code, doc_date);
CREATE INDEX idx_buys_doc_date ON buys(doc_date);
CREATE INDEX idx_pays_item_code_date ON pays(item_code, doc_date);
CREATE INDEX idx_pays_doc_date ON pays(doc_date);
CREATE INDEX idx_buys_ym_period ON buys(ym_period);
CREATE INDEX idx_pays_ym_period ON pays(ym_period);

-- ============================================================================
-- 7. มุมมองคำนวณยอดสต๊อกคงเหลือสุทธิและสถานะ (view_stock_balance)
-- ============================================================================
CREATE VIEW view_stock_balance AS
SELECT 
    i.id AS item_id,
    i.item_code,
    i.item_name,
    i.unit,
    i.category,
    i.min_stock,
    i.max_stock,
    i.is_active,
    COALESCE(b.total_in_qty, 0) AS total_in_qty,
    COALESCE(b.total_in_val, 0) AS total_in_val,
    COALESCE(p.total_out_qty, 0) AS total_out_qty,
    COALESCE(p.total_out_val, 0) AS total_out_val,
    -- ยอดคงเหลือสุทธิ (balance_qty = ยอดซื้อสะสม - ยอดเบิกสะสม)
    ROUND(COALESCE(b.total_in_qty, 0) - COALESCE(p.total_out_qty, 0), 2) AS balance_qty,
    -- ราคาเฉลี่ยต่อหน่วยจากการรับเข้า
    CASE 
        WHEN COALESCE(b.total_in_qty, 0) > 0 
        THEN ROUND(COALESCE(b.total_in_val, 0) / COALESCE(b.total_in_qty, 0), 2)
        ELSE 0 
    END AS avg_unit_price,
    -- มูลค่าคงเหลือสุทธิ
    ROUND(
        (COALESCE(b.total_in_qty, 0) - COALESCE(p.total_out_qty, 0)) * 
        (CASE 
            WHEN COALESCE(b.total_in_qty, 0) > 0 
            THEN (COALESCE(b.total_in_val, 0) / COALESCE(b.total_in_qty, 0))
            ELSE 0 
        END)
    , 2) AS balance_val,
    -- สถานะสินค้าคงคลัง (stock_status)
    CASE 
        WHEN (COALESCE(b.total_in_qty, 0) - COALESCE(p.total_out_qty, 0)) <= 0 THEN 'OUT_OF_STOCK'
        WHEN (COALESCE(b.total_in_qty, 0) - COALESCE(p.total_out_qty, 0)) <= i.min_stock THEN 'LOW_STOCK'
        ELSE 'NORMAL'
    END AS stock_status
FROM items i
LEFT JOIN (
    SELECT 
        item_code,
        SUM(quantity) AS total_in_qty,
        SUM(total_price) AS total_in_val
    FROM buys
    GROUP BY item_code
) b ON i.item_code = b.item_code
LEFT JOIN (
    SELECT 
        item_code,
        SUM(quantity) AS total_out_qty,
        SUM(total_price) AS total_out_val
    FROM pays
    GROUP BY item_code
) p ON i.item_code = p.item_code;

-- ============================================================================
-- 8. ข้อมูลเริ่มต้นบังคับ (Mandatory Initial Seed Data)
-- ============================================================================

-- 8.1 Superadmin: chanpibul / Password hash SHA-256 ของ "300628" (6b7f24b13669a466538a8b19c01cb3f88e3f95f0f8724ad156c501595c1a33c2)
INSERT INTO users (id, username, password_hash, fullname, department, role, is_active)
VALUES (
    1,
    'chanpibul',
    '6b7f24b13669a466538a8b19c01cb3f88e3f95f0f8724ad156c501595c1a33c2',
    'ผู้ดูแลระบบสูงสุด',
    'กลุ่มงานบริหารทั่วไป โรงพยาบาลไทรโยค',
    'superadmin',
    1
);

-- 8.2 สิทธิเริ่มต้นให้ Superadmin (user_id = 1) ครบทุก 7 หน้า (can_view = 1, can_edit = 1)
INSERT INTO permissions (user_id, page_key, can_view, can_edit) VALUES
(1, 'stock_balance', 1, 1),
(1, 'buy', 1, 1),
(1, 'pay', 1, 1),
(1, 'items', 1, 1),
(1, 'shops', 1, 1),
(1, 'reports', 1, 1),
(1, 'user_mgmt', 1, 1);

-- 8.3 ผู้ใช้งานทดสอบ: เจ้าหน้าที่พัสดุ และ เจ้าหน้าที่เบิกทั่วไป
-- password hash ของ '123456' คือ '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
INSERT INTO users (id, username, password_hash, fullname, department, role, is_active)
VALUES 
(2, 'stock_officer', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'นายสมชาย พัสดุดี', 'งานพัสดุและบำรุงรักษา', 'admin', 1),
(3, 'er_nurse', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'พว.สุดา ใจเมตตา', 'กลุ่มงานอุบัติเหตุและฉุกเฉิน (ER)', 'user', 1);

-- สิทธิของเจ้าหน้าที่พัสดุ (ดูและแก้ไขได้เกือบทุกหน้า ยกเว้นจัดการผู้ใช้)
INSERT INTO permissions (user_id, page_key, can_view, can_edit) VALUES
(2, 'stock_balance', 1, 1),
(2, 'buy', 1, 1),
(2, 'pay', 1, 1),
(2, 'items', 1, 1),
(2, 'shops', 1, 1),
(2, 'reports', 1, 1),
(2, 'user_mgmt', 0, 0);

-- สิทธิของพยาบาล ER (ดูสต๊อกและขอเบิกได้ ไม่สามารถรับเข้าหรือแก้ทะเบียน)
INSERT INTO permissions (user_id, page_key, can_view, can_edit) VALUES
(3, 'stock_balance', 1, 0),
(3, 'buy', 0, 0),
(3, 'pay', 1, 1),
(3, 'items', 1, 0),
(3, 'shops', 0, 0),
(3, 'reports', 1, 0),
(3, 'user_mgmt', 0, 0);

-- 8.4 ร้านค้าเริ่มต้น (บังคับ: "ยอดยกมา") และคู่ค้าโรงพยาบาลทั่วไป
INSERT INTO shops (id, shop_name, address, phone, tax_id) VALUES
(1, 'ยอดยกมา', 'คลังพัสดุกลาง โรงพยาบาลไทรโยค ต.ลุ่มสุ่ม อ.ไทรโยค จ.กาญจนบุรี', '034-591023', '0994000160000'),
(2, 'องค์การเภสัชกรรม (GPO)', '75/1 ถนนพระรามที่ 6 แขวงทุ่งพญาไท เขตราชเทวี กรุงเทพฯ', '02-610-2000', '0994000164927'),
(3, 'บริษัท ดีเคเอสเอช (ประเทศไทย) จำกัด', '2535 ถนนสุขุมวิท แขวงบางจาก เขตพระโขนง กรุงเทพฯ', '02-790-8000', '0105501004921'),
(4, 'บริษัท สยามเมดิคอล ซัพพลาย จำกัด', '88 หมู่ 2 ต.ท่ามะขาม อ.เมือง จ.กาญจนบุรี', '034-620-111', '0715545000123'),
(5, 'ห้างหุ้นส่วนจำกัด กาญจน์เครื่องเขียน', '124 ถนนแสงชูโต ต.บ้านใต้ อ.เมือง จ.กาญจนบุรี', '034-511-234', '0713532000456');

-- 8.5 ทะเบียนรหัสพัสดุและเวชภัณฑ์มิใช่ยา ตัวอย่างของ รพ.ไทรโยค
INSERT INTO items (id, item_code, item_name, unit, category, min_stock, max_stock, is_active) VALUES
(1, 'MED-001', 'กระบอกฉีดยา Syringe Nipro 5 ml (กล่องละ 100 ชิ้น)', 'กล่อง', 'เวชภัณฑ์มิใช่ยา', 10, 100, 1),
(2, 'MED-002', 'ถุงมือตรวจโรค Latex Gloves Size M (กล่องละ 100 ชิ้น)', 'กล่อง', 'เวชภัณฑ์มิใช่ยา', 20, 150, 1),
(3, 'MED-003', 'ผ้าก๊อซ Gauze Pad 3x3 นิ้ว (ห่อละ 100 ชิ้น)', 'ห่อ', 'เวชภัณฑ์มิใช่ยา', 15, 80, 1),
(4, 'MED-004', 'แอลกอฮอล์สำหรับล้างแผล 70% 450 ml', 'ขวด', 'เวชภัณฑ์มิใช่ยา', 10, 50, 1),
(5, 'MED-005', 'สายให้น้ำเกลือ IV Infusion Set สำหรับผู้ใหญ่', 'ชุด', 'เวชภัณฑ์มิใช่ยา', 25, 120, 1),
(6, 'MED-006', 'หน้ากากอนามัยทางการแพทย์ 3 ชั้น (กล่องละ 50 ชิ้น)', 'กล่อง', 'เวชภัณฑ์มิใช่ยา', 30, 200, 1),
(7, 'OFF-001', 'กระดาษถ่ายเอกสาร A4 80 แกรม Double A', 'รีม', 'วัสดุสำนักงาน', 20, 100, 1),
(8, 'OFF-002', 'แฟ้มเวชระเบียนผู้ป่วยนอก (OPD Folder)', 'เล่ม', 'วัสดุสำนักงาน', 50, 300, 1),
(9, 'OFF-003', 'สติกเกอร์บาร์โค้ดรหัสผู้ป่วย 3.2 x 2.5 cm (ม้วนละ 1,000 ดวง)', 'ม้วน', 'วัสดุสำนักงาน', 10, 50, 1),
(10, 'GEN-001', 'น้ำยาทำความสะอาดและฆ่าเชื้อพื้นผิว 3,800 ml', 'แกลลอน', 'วัสดุงานบ้านงานครัว', 5, 30, 1);

-- 8.6 บันทึกรับเข้ายอดยกมาเริ่มต้น (Buys: ยอดยกมา ณ 1 มกราคม 2024)
INSERT INTO buys (doc_date, doc_no, item_code, item_name, category, unit, price_per_unit, quantity, total_price, shop_name, remark, ym_period, created_by) VALUES
('2024-01-01', 'INIT-2024-001', 'MED-001', 'กระบอกฉีดยา Syringe Nipro 5 ml (กล่องละ 100 ชิ้น)', 'เวชภัณฑ์มิใช่ยา', 'กล่อง', 180.00, 50, 9000.00, 'ยอดยกมา', 'ยอดยกมาต้นปีงบประมาณ', '2024-01', 'chanpibul'),
('2024-01-01', 'INIT-2024-002', 'MED-002', 'ถุงมือตรวจโรค Latex Gloves Size M (กล่องละ 100 ชิ้น)', 'เวชภัณฑ์มิใช่ยา', 'กล่อง', 145.00, 80, 11600.00, 'ยอดยกมา', 'ยอดยกมาต้นปีงบประมาณ', '2024-01', 'chanpibul'),
('2024-01-01', 'INIT-2024-003', 'MED-003', 'ผ้าก๊อซ Gauze Pad 3x3 นิ้ว (ห่อละ 100 ชิ้น)', 'เวชภัณฑ์มิใช่ยา', 'ห่อ', 95.00, 40, 3800.00, 'ยอดยกมา', 'ยอดยกมาต้นปีงบประมาณ', '2024-01', 'chanpibul'),
('2024-01-01', 'INIT-2024-004', 'MED-004', 'แอลกอฮอล์สำหรับล้างแผล 70% 450 ml', 'เวชภัณฑ์มิใช่ยา', 'ขวด', 42.00, 30, 1260.00, 'ยอดยกมา', 'ยอดยกมาต้นปีงบประมาณ', '2024-01', 'chanpibul'),
('2024-01-01', 'INIT-2024-005', 'MED-005', 'สายให้น้ำเกลือ IV Infusion Set สำหรับผู้ใหญ่', 'เวชภัณฑ์มิใช่ยา', 'ชุด', 22.00, 60, 1320.00, 'ยอดยกมา', 'ยอดยกมาต้นปีงบประมาณ', '2024-01', 'chanpibul'),
('2024-01-01', 'INIT-2024-006', 'MED-006', 'หน้ากากอนามัยทางการแพทย์ 3 ชั้น (กล่องละ 50 ชิ้น)', 'เวชภัณฑ์มิใช่ยา', 'กล่อง', 65.00, 120, 7800.00, 'ยอดยกมา', 'ยอดยกมาต้นปีงบประมาณ', '2024-01', 'chanpibul'),
('2024-01-01', 'INIT-2024-007', 'OFF-001', 'กระดาษถ่ายเอกสาร A4 80 แกรม Double A', 'วัสดุสำนักงาน', 'รีม', 125.00, 50, 6250.00, 'ยอดยกมา', 'ยอดยกมาต้นปีงบประมาณ', '2024-01', 'chanpibul'),
('2024-01-01', 'INIT-2024-008', 'OFF-002', 'แฟ้มเวชระเบียนผู้ป่วยนอก (OPD Folder)', 'วัสดุสำนักงาน', 'เล่ม', 18.00, 150, 2700.00, 'ยอดยกมา', 'ยอดยกมาต้นปีงบประมาณ', '2024-01', 'chanpibul'),
('2024-01-01', 'INIT-2024-009', 'OFF-003', 'สติกเกอร์บาร์โค้ดรหัสผู้ป่วย 3.2 x 2.5 cm (ม้วนละ 1,000 ดวง)', 'วัสดุสำนักงาน', 'ม้วน', 150.00, 25, 3750.00, 'ยอดยกมา', 'ยอดยกมาต้นปีงบประมาณ', '2024-01', 'chanpibul'),
('2024-01-01', 'INIT-2024-010', 'GEN-001', 'น้ำยาทำความสะอาดและฆ่าเชื้อพื้นผิว 3,800 ml', 'วัสดุงานบ้านงานครัว', 'แกลลอน', 280.00, 15, 4200.00, 'ยอดยกมา', 'ยอดยกมาต้นปีงบประมาณ', '2024-01', 'chanpibul'),

-- บันทึกการรับเข้าเพิ่มเติมในรอบเดือน
('2024-01-15', 'PO-67-0012', 'MED-001', 'กระบอกฉีดยา Syringe Nipro 5 ml (กล่องละ 100 ชิ้น)', 'เวชภัณฑ์มิใช่ยา', 'กล่อง', 180.00, 30, 5400.00, 'บริษัท ดีเคเอสเอช (ประเทศไทย) จำกัด', 'สั่งซื้อเพิ่มเติมรอบกลางเดือน', '2024-01', 'stock_officer'),
('2024-01-18', 'PO-67-0015', 'MED-004', 'แอลกอฮอล์สำหรับล้างแผล 70% 450 ml', 'เวชภัณฑ์มิใช่ยา', 'ขวด', 42.00, 20, 840.00, 'องค์การเภสัชกรรม (GPO)', 'จัดซื้อทดแทนสต๊อกใกล้หมด', '2024-01', 'stock_officer');

-- 8.7 บันทึกการเบิกจ่ายตัวอย่าง (Pays: การเบิกตามแผนกต่างๆ)
INSERT INTO pays (doc_date, doc_no, item_code, item_name, category, unit, price_per_unit, quantity, total_price, department, remark, ym_period, created_by) VALUES
('2024-01-05', 'REQ-67-0001', 'MED-001', 'กระบอกฉีดยา Syringe Nipro 5 ml (กล่องละ 100 ชิ้น)', 'เวชภัณฑ์มิใช่ยา', 'กล่อง', 180.00, 10, 1800.00, 'กลุ่มงานอุบัติเหตุและฉุกเฉิน (ER)', 'เบิกใช้ประจำสัปดาห์', '2024-01', 'er_nurse'),
('2024-01-06', 'REQ-67-0002', 'MED-002', 'ถุงมือตรวจโรค Latex Gloves Size M (กล่องละ 100 ชิ้น)', 'เวชภัณฑ์มิใช่ยา', 'กล่อง', 145.00, 20, 2900.00, 'กลุ่มงานการพยาบาลผู้ป่วยนอก (OPD)', 'เบิกใช้ตรวจโรคทั่วไป', '2024-01', 'chanpibul'),
('2024-01-08', 'REQ-67-0003', 'MED-004', 'แอลกอฮอล์สำหรับล้างแผล 70% 450 ml', 'เวชภัณฑ์มิใช่ยา', 'ขวด', 42.00, 35, 1470.00, 'กลุ่มงานการพยาบาลผู้ป่วยใน (IPD)', 'เบิกใช้ทำแผลและฆ่าเชื้อ (ส่งผลให้สต๊อกใกล้หมดเพื่อทดสอบสถานะ)', '2024-01', 'chanpibul'),
('2024-01-10', 'REQ-67-0004', 'OFF-001', 'กระดาษถ่ายเอกสาร A4 80 แกรม Double A', 'วัสดุสำนักงาน', 'รีม', 125.00, 15, 1875.00, 'กลุ่มงานบริหารทั่วไป', 'เบิกพิมพ์เอกสารราชการ', '2024-01', 'stock_officer'),
('2024-01-12', 'REQ-67-0005', 'OFF-002', 'แฟ้มเวชระเบียนผู้ป่วยนอก (OPD Folder)', 'วัสดุสำนักงาน', 'เล่ม', 18.00, 50, 900.00, 'งานเวชระเบียนและสถิติ', 'เบิกทำประวัติผู้ป่วยใหม่', '2024-01', 'chanpibul'),
('2024-01-20', 'REQ-67-0006', 'MED-005', 'สายให้น้ำเกลือ IV Infusion Set สำหรับผู้ใหญ่', 'เวชภัณฑ์มิใช่ยา', 'ชุด', 22.00, 45, 990.00, 'กลุ่มงานการพยาบาลผู้ป่วยใน (IPD)', 'เบิกเข้าตึกผู้ป่วยใน', '2024-01', 'chanpibul');
