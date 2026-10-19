const fs = require('fs');
const path = require('path');

const SHEET_ID = '1Ljnwa14H1C_1eGSgkXxblGFQk9KNCcFy-OvSlzHKv5o';
const DATA_DIR = path.join(__dirname, '..', 'data_sync');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const TABS = {
  'items.csv': '0',
  'shops.csv': '907850828',
  'buys.csv': '840698544',
  'pays.csv': '567610446'
};

async function downloadCsvs() {
  console.log('--- 1. ดาวน์โหลดข้อมูลล่าสุดจาก Google Sheet ---');
  for (const [file, gid] of Object.entries(TABS)) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    console.log(`Downloading ${file} (gid: ${gid})...`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download ${file}: ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    const filePath = path.join(DATA_DIR, file);
    fs.writeFileSync(filePath, text, 'utf8');
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0).length;
    console.log(`Saved ${file} (${lines} lines, ${(Buffer.byteLength(text) / 1024).toFixed(1)} KB)`);
  }
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  function splitLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const headers = splitLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitLine(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j] || `col_${j}`;
      obj[h] = vals[j] !== undefined ? vals[j] : '';
    }
    rows.push(obj);
  }
  return rows;
}

function cleanSqlStr(str) {
  if (str === null || str === undefined) return "''";
  const s = String(str).trim().replace(/'/g, "''");
  return `'${s}'`;
}

function cleanNum(str) {
  if (!str) return 0;
  const s = String(str).replace(/,/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function convertDate(str) {
  if (!str) return '2025-10-01';
  const s = String(str).trim();
  const m = s.match(/^(\d+)\/(\d+)\/(\d+)$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return '2025-10-01';
}

async function main() {
  await downloadCsvs();

  console.log('\n--- 2. แปลงข้อมูล CSV เป็นคำสั่ง SQL สำหรับ D1 ---');

  const items = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'items.csv'), 'utf8'));
  const shops = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'shops.csv'), 'utf8'));
  const buys = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'buys.csv'), 'utf8'));
  const pays = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'pays.csv'), 'utf8'));

  console.log(`Loaded rows: Items=${items.length}, Shops=${shops.length}, Buys=${buys.length}, Pays=${pays.length}`);

  // 1. SHOPS SQL
  const shopNames = new Set();
  const shopsSql = [];
  shopsSql.push("INSERT OR IGNORE INTO shops (shop_name, address, phone, tax_id) VALUES ('ยอดยกมา', 'คลังพัสดุกลาง รพ.ไทรโยค', '034-591023', '0994000160000');");
  shopNames.add('ยอดยกมา');

  for (const s of shops) {
    const name = (s['ร้านค้า'] || '').trim();
    if (name && !shopNames.has(name)) {
      shopNames.add(name);
      const addr = cleanSqlStr(s['ที่อยู่']);
      const phone = cleanSqlStr(s['เบอร์โทร']);
      const tax = cleanSqlStr(s['เลขผู้เสียภาษี']);
      shopsSql.push(`INSERT OR IGNORE INTO shops (shop_name, address, phone, tax_id) VALUES (${cleanSqlStr(name)}, ${addr}, ${phone}, ${tax});`);
    }
  }

  // Also make sure any shop mentioned in buys is in shops table
  for (const b of buys) {
    const shop = (b['ร้านค้า'] || '').trim();
    if (shop && !shopNames.has(shop)) {
      shopNames.add(shop);
      shopsSql.push(`INSERT OR IGNORE INTO shops (shop_name) VALUES (${cleanSqlStr(shop)});`);
    }
  }
  fs.writeFileSync(path.join(DATA_DIR, 'seed_shops.sql'), shopsSql.join('\n'), 'utf8');
  console.log(`Saved seed_shops.sql (${shopsSql.length} statements)`);

  // 2. ITEMS SQL
  const itemCodes = new Set();
  const itemsSql = [];
  for (const it of items) {
    const code = (it['รหัส'] || '').trim();
    const name = (it['รายการ'] || '').trim();
    if (code && name) {
      itemCodes.add(code);
      const c = cleanSqlStr(code);
      const n = cleanSqlStr(name);
      const u = cleanSqlStr(it['หน่วยนับ'] || 'หน่วย');
      const cat = cleanSqlStr(it['กลุ่มสินค้า'] || 'ทั่วไป');
      const min = cleanNum(it['ขั้นต่ำ']);
      const max = cleanNum(it['ขั้นสูง']);
      itemsSql.push(`INSERT INTO items (item_code, item_name, unit, category, min_stock, max_stock, is_active) VALUES (${c}, ${n}, ${u}, ${cat}, ${min}, ${max}, 1) ON CONFLICT(item_code) DO UPDATE SET item_name=excluded.item_name, unit=excluded.unit, category=excluded.category, min_stock=excluded.min_stock, max_stock=excluded.max_stock;`);
    }
  }

  // Also ensure any item in buys or pays is in items table
  for (const b of buys) {
    const code = (b['รหัสสินค้า'] || '').trim();
    const name = (b['รายการ'] || '').trim();
    if (code && !itemCodes.has(code)) {
      itemCodes.add(code);
      const c = cleanSqlStr(code);
      const n = cleanSqlStr(name || code);
      const u = cleanSqlStr(b['หน่วยนับ'] || 'หน่วย');
      const cat = cleanSqlStr(b['กลุ่มสินค้า'] || 'ทั่วไป');
      itemsSql.push(`INSERT INTO items (item_code, item_name, unit, category, min_stock, max_stock, is_active) VALUES (${c}, ${n}, ${u}, ${cat}, 0, 0, 1) ON CONFLICT(item_code) DO NOTHING;`);
    }
  }
  for (const p of pays) {
    const code = (p['รหัสสินค้า'] || '').trim();
    const name = (p['รายการ'] || '').trim();
    if (code && !itemCodes.has(code)) {
      itemCodes.add(code);
      const c = cleanSqlStr(code);
      const n = cleanSqlStr(name || code);
      const u = cleanSqlStr(p['หน่วยนับ'] || 'หน่วย');
      const cat = cleanSqlStr(p['กลุ่มสินค้า'] || 'ทั่วไป');
      itemsSql.push(`INSERT INTO items (item_code, item_name, unit, category, min_stock, max_stock, is_active) VALUES (${c}, ${n}, ${u}, ${cat}, 0, 0, 1) ON CONFLICT(item_code) DO NOTHING;`);
    }
  }

  // Split items into 500-statement batches
  const ITEM_BATCH = 500;
  let itemBatchIdx = 1;
  for (let i = 0; i < itemsSql.length; i += ITEM_BATCH) {
    const chunk = itemsSql.slice(i, i + ITEM_BATCH);
    fs.writeFileSync(path.join(DATA_DIR, `seed_items_part_${itemBatchIdx}.sql`), chunk.join('\n'), 'utf8');
    itemBatchIdx++;
  }
  console.log(`Saved ${itemBatchIdx - 1} items batch files (${itemsSql.length} items total)`);

  // 3. BUYS SQL
  const buysSql = [];
  for (const b of buys) {
    const code = (b['รหัสสินค้า'] || '').trim();
    const name = (b['รายการ'] || '').trim();
    if (code && name) {
      const docDate = convertDate(b['วันที่']);
      const docNo = b['เลขที่เอกสาร'] && b['เลขที่เอกสาร'].trim() ? cleanSqlStr(b['เลขที่เอกสาร']) : cleanSqlStr('-');
      const c = cleanSqlStr(code);
      const n = cleanSqlStr(name);
      const cat = cleanSqlStr(b['กลุ่มสินค้า'] || 'ทั่วไป');
      const u = cleanSqlStr(b['หน่วยนับ'] || 'หน่วย');
      const price = cleanNum(b['ราคา']);
      const qty = cleanNum(b['จำนวนที่ซื้อ']);
      let total = cleanNum(b['มูลค่ารวม']);
      if (total <= 0 && qty > 0 && price > 0) {
        total = Math.round(qty * price * 100) / 100;
      }
      const shop = b['ร้านค้า'] && b['ร้านค้า'].trim() ? cleanSqlStr(b['ร้านค้า']) : cleanSqlStr('ยอดยกมา');
      const rem = cleanSqlStr(b['หมายเหตุ'] || '');
      const ym = b['ปี-เดือน'] && b['ปี-เดือน'].trim() ? cleanSqlStr(b['ปี-เดือน']) : cleanSqlStr(docDate.slice(0, 7));

      buysSql.push(`INSERT INTO buys (doc_date, doc_no, item_code, item_name, category, unit, price_per_unit, quantity, total_price, shop_name, remark, ym_period, created_by) VALUES ('${docDate}', ${docNo}, ${c}, ${n}, ${cat}, ${u}, ${price}, ${qty}, ${total}, ${shop}, ${rem}, ${ym}, 'google_sheet_sync');`);
    }
  }

  const BUY_BATCH = 500;
  let buyBatchIdx = 1;
  for (let i = 0; i < buysSql.length; i += BUY_BATCH) {
    const chunk = buysSql.slice(i, i + BUY_BATCH);
    fs.writeFileSync(path.join(DATA_DIR, `seed_buys_part_${buyBatchIdx}.sql`), chunk.join('\n'), 'utf8');
    buyBatchIdx++;
  }
  console.log(`Saved ${buyBatchIdx - 1} buys batch files (${buysSql.length} buys total)`);

  // 4. PAYS SQL
  const paysSql = [];
  for (const p of pays) {
    const code = (p['รหัสสินค้า'] || '').trim();
    const name = (p['รายการ'] || '').trim();
    if (code && name) {
      const rawDate = p[''] || p['col_0'] || p['วันที่'] || Object.values(p)[0];
      const docDate = convertDate(rawDate);
      const docNo = p['เลขที่เอกสาร'] && p['เลขที่เอกสาร'].trim() ? cleanSqlStr(p['เลขที่เอกสาร']) : cleanSqlStr('-');
      const c = cleanSqlStr(code);
      const n = cleanSqlStr(name);
      const cat = cleanSqlStr(p['กลุ่มสินค้า'] || 'ทั่วไป');
      const u = cleanSqlStr(p['หน่วยนับ'] || 'หน่วย');
      const price = cleanNum(p['ราคา']);
      const qty = cleanNum(p['จำนวนที่จ่าย']);
      let total = cleanNum(p['มูลค่ารวม']);
      if (total <= 0 && qty > 0 && price > 0) {
        total = Math.round(qty * price * 100) / 100;
      }
      const dept = p['หน่วยงานที่เบิก'] && p['หน่วยงานที่เบิก'].trim() ? cleanSqlStr(p['หน่วยงานที่เบิก']) : cleanSqlStr('หน่วยงานทั่วไป');
      const rem = cleanSqlStr(p['หมายเหตุ'] || '');
      const ym = p['ปี-เดือน'] && p['ปี-เดือน'].trim() ? cleanSqlStr(p['ปี-เดือน']) : cleanSqlStr(docDate.slice(0, 7));

      paysSql.push(`INSERT INTO pays (doc_date, doc_no, item_code, item_name, category, unit, price_per_unit, quantity, total_price, department, remark, ym_period, created_by) VALUES ('${docDate}', ${docNo}, ${c}, ${n}, ${cat}, ${u}, ${price}, ${qty}, ${total}, ${dept}, ${rem}, ${ym}, 'google_sheet_sync');`);
    }
  }

  const PAY_BATCH = 500;
  let payBatchIdx = 1;
  for (let i = 0; i < paysSql.length; i += PAY_BATCH) {
    const chunk = paysSql.slice(i, i + PAY_BATCH);
    fs.writeFileSync(path.join(DATA_DIR, `seed_pays_part_${payBatchIdx}.sql`), chunk.join('\n'), 'utf8');
    payBatchIdx++;
  }
  console.log(`Saved ${payBatchIdx - 1} pays batch files (${paysSql.length} pays total)`);

  console.log('\n--- 3. เขียนลำดับการรันลง runner script ---');
  const executionPlan = [
    'seed_shops.sql',
    'seed_items_part_1.sql',
    'seed_items_part_2.sql',
    'seed_items_part_3.sql',
    'clear_buys_pays.sql',
    'seed_buys_part_1.sql',
    'seed_buys_part_2.sql',
    'seed_buys_part_3.sql',
    'seed_buys_part_4.sql',
    'seed_pays_part_1.sql',
    'seed_pays_part_2.sql',
    'seed_pays_part_3.sql',
    'seed_pays_part_4.sql',
    'seed_pays_part_5.sql',
    'recalculate_balances.sql'
  ];

  fs.writeFileSync(path.join(DATA_DIR, 'execution_plan.json'), JSON.stringify(executionPlan, null, 2), 'utf8');
  console.log('Execution plan created: 15 steps');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
