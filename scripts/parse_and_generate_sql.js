/**
 * สคริปต์ดึงข้อมูลจาก Google Sheet และแปลงเป็น SQL สำหรับ Cloudflare D1
 * Google Sheet ID: 1Ljnwa14H1C_1eGSgkXxblGFQk9KNCcFy-OvSlzHKv5o
 */

const fs = require('fs');
const path = require('path');

const SHEET_ID = '1Ljnwa14H1C_1eGSgkXxblGFQk9KNCcFy-OvSlzHKv5o';
const DATA_DIR = path.join(__dirname, '..', 'data_sync');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ฟังก์ชันแปลง CSV text เป็น Array of Objects
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
  console.log('1. กำลังอ่านและแปลงข้อมูลจาก CSV files...');

  const itemsCsv = fs.readFileSync(path.join(DATA_DIR, 'items.csv'), 'utf8');
  const shopsCsv = fs.readFileSync(path.join(DATA_DIR, 'shops.csv'), 'utf8');
  const buysCsv = fs.readFileSync(path.join(DATA_DIR, 'buys.csv'), 'utf8');
  const paysCsv = fs.readFileSync(path.join(DATA_DIR, 'pays.csv'), 'utf8');

  const items = parseCSV(itemsCsv);
  const shops = parseCSV(shopsCsv);
  const buys = parseCSV(buysCsv);
  const pays = parseCSV(paysCsv);

  console.log(`   - Items: ${items.length} แถว`);
  console.log(`   - Shops: ${shops.length} แถว`);
  console.log(`   - Buys:  ${buys.length} แถว`);
  console.log(`   - Pays:  ${pays.length} แถว`);

  const sqlStatements = [];

  // 1. SHOPS
  console.log('2. สร้างคำสั่ง SQL สำหรับตาราง shops...');
  const shopNames = new Set();
  shopNames.add('ยอดยกมา');

  sqlStatements.push("INSERT OR IGNORE INTO shops (shop_name, address, phone, tax_id) VALUES ('ยอดยกมา', 'คลังพัสดุกลาง รพ.ไทรโยค', '034-591023', '0994000160000');");

  for (const s of shops) {
    const name = (s['ร้านค้า'] || '').trim();
    if (name && !shopNames.has(name)) {
      shopNames.add(name);
      const addr = cleanSqlStr(s['ที่อยู่']);
      const phone = cleanSqlStr(s['เบอร์โทร']);
      const tax = cleanSqlStr(s['เลขผู้เสียภาษี']);
      sqlStatements.push(`INSERT OR IGNORE INTO shops (shop_name, address, phone, tax_id) VALUES (${cleanSqlStr(name)}, ${addr}, ${phone}, ${tax});`);
    }
  }

  // 2. ITEMS
  console.log('3. สร้างคำสั่ง SQL สำหรับตาราง items...');
  const itemCodes = new Set();

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
      sqlStatements.push(`INSERT OR REPLACE INTO items (item_code, item_name, unit, category, min_stock, max_stock, is_active) VALUES (${c}, ${n}, ${u}, ${cat}, ${min}, ${max}, 1);`);
    }
  }

  // 3. BUYS
  console.log('4. สร้างคำสั่ง SQL สำหรับตาราง buys...');
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

      sqlStatements.push(`INSERT INTO buys (doc_date, doc_no, item_code, item_name, category, unit, price_per_unit, quantity, total_price, shop_name, remark, ym_period, created_by) VALUES ('${docDate}', ${docNo}, ${c}, ${n}, ${cat}, ${u}, ${price}, ${qty}, ${total}, ${shop}, ${rem}, ${ym}, 'google_sheet_sync');`);
    }
  }

  // 4. PAYS
  console.log('5. สร้างคำสั่ง SQL สำหรับตาราง pays...');
  for (const p of pays) {
    const code = (p['รหัสสินค้า'] || '').trim();
    const name = (p['รายการ'] || '').trim();
    if (code && name) {
      // คอลัมน์แรกคือวันที่ (อาจเป็น col_0 หรือ วันที่ หรือ H1)
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

      sqlStatements.push(`INSERT INTO pays (doc_date, doc_no, item_code, item_name, category, unit, price_per_unit, quantity, total_price, department, remark, ym_period, created_by) VALUES ('${docDate}', ${docNo}, ${c}, ${n}, ${cat}, ${u}, ${price}, ${qty}, ${total}, ${dept}, ${rem}, ${ym}, 'google_sheet_sync');`);
    }
  }

  // บันทึกรวมเป็นไฟล์ SQL
  const fullSqlPath = path.join(DATA_DIR, 'seed_google_sheet.sql');
  fs.writeFileSync(fullSqlPath, sqlStatements.join('\n'), 'utf8');

  console.log(`\n✔ บันทึกคำสั่ง SQL ทั้งหมดเรียบร้อยแล้ว: ${fullSqlPath}`);
  console.log(`   - จำนวนคำสั่ง SQL ทั้งหมด: ${sqlStatements.length} รายการ`);

  // แบ่งออกเป็น Batch ละ 1,000 คำสั่ง เพื่อให้ D1 execute ได้รวดเร็วและไม่ติดขนาดไฟล์
  const BATCH_SIZE = 1000;
  let batchIndex = 1;
  for (let i = 0; i < sqlStatements.length; i += BATCH_SIZE) {
    const chunk = sqlStatements.slice(i, i + BATCH_SIZE);
    const batchPath = path.join(DATA_DIR, `seed_part_${batchIndex}.sql`);
    fs.writeFileSync(batchPath, chunk.join('\n'), 'utf8');
    console.log(`   - สร้างไฟล์ ${path.basename(batchPath)} (${chunk.length} คำสั่ง)`);
    batchIndex++;
  }

  console.log('\nเสร็จสิ้นขั้นตอนการเตรียมข้อมูล!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
