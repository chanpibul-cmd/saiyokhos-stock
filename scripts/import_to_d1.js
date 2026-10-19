const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data_sync');
const planPath = path.join(DATA_DIR, 'execution_plan.json');

if (!fs.existsSync(planPath)) {
  console.error('ไม่พบ execution_plan.json กรุณารัน scripts/prepare_all_seeds.js ก่อน');
  process.exit(1);
}

const filesToExecute = JSON.parse(fs.readFileSync(planPath, 'utf8'));

console.log('=== เริ่มต้นการนำเข้าข้อมูล Master & Transactions เข้าสู่ Cloudflare D1 ===\n');

for (let i = 0; i < filesToExecute.length; i++) {
  const fileName = filesToExecute[i];
  const filePath = path.join(DATA_DIR, fileName);
  console.log(`[${i + 1}/${filesToExecute.length}] กำลังรัน: ${fileName}...`);
  try {
    const output = execSync(`npx wrangler d1 execute saiyok_stock_db --remote --file="${filePath}"`, {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
    console.log(`✔ สำเร็จ: ${fileName}`);
  } catch (err) {
    console.error(`❌ เกิดข้อผิดพลาดขณะรัน ${fileName}:`);
    console.error(err.stdout ? err.stdout.toString() : '');
    console.error(err.stderr ? err.stderr.toString() : '');
    process.exit(1);
  }
}

console.log('\n=== ตรวจสอบผลลัพธ์ในฐานข้อมูล D1 ===');
const verifyOutput = execSync(`npx wrangler d1 execute saiyok_stock_db --remote --command="SELECT 'items' as tbl, count(*) as count FROM items UNION ALL SELECT 'shops', count(*) FROM shops UNION ALL SELECT 'buys', count(*) FROM buys UNION ALL SELECT 'pays', count(*) FROM pays UNION ALL SELECT 'item_balances', count(*) FROM item_balances;"`, {
  encoding: 'utf8',
  cwd: path.join(__dirname, '..')
});
console.log(verifyOutput);

console.log('\n🎉 นำเข้าข้อมูลและคำนวณยอดสต๊อกใหม่ใน Cloudflare D1 เสร็จสมบูรณ์แล้ว!');
