# คู่มือข้อกำหนดและสถาปัตยกรรมระบบบริหารคลังและสต๊อกพัสดุ (PROJECT_RULES.md)
## โรงพยาบาลไทรโยค (Sai Yok Hospital) จ.กาญจนบุรี

---

## 1. ภาพรวมของระบบ (System Overview)
ระบบบริหารคลังและสต๊อกพัสดุ โรงพยาบาลไทรโยค ถูกออกแบบขึ้นเพื่อใช้บริหารจัดการคลังพัสดุกลาง, เวชภัณฑ์มิใช่ยา, วัสดุสำนักงาน, และวัสดุงานบ้านงานครัวของโรงพยาบาล โดยมีเป้าหมายหลักคือ:
1. **ความถูกต้องและโปร่งใส**: คำนวณยอดคงเหลือสุทธิและมูลค่าคงคลังแบบ Real-time ตามระเบียบพัสดุภาครัฐ
2. **ระบบป้องกันสต๊อกติดลบ 100% (Zero-Negative Stock Guarantee)**: ป้องกันไม่ให้มีการเบิกจ่ายเกินยอดที่มีอยู่จริงในคลัง
3. **การออกเอกสารราชการมาตรฐาน**: รองรับการพิมพ์ **บัตรคุมพัสดุ (Stock Card)** ขนาดกระดาษ A4 พร้อมบล็อกลงนามราชการ 3 ตำแหน่ง
4. **ความมั่นคงปลอดภัยระดับองค์กร (Zero Trust & Stateless)**: ใช้สถาปัตยกรรม Serverless ผ่าน Cloudflare Workers และจัดเก็บข้อมูลบน Cloudflare D1 (SQLite Distributed Database) ควบคุมการเข้าถึงด้วย JWT Token และตารางสิทธิการใช้งาน (Permission Matrix)

---

## 2. สถาปัตยกรรมระบบ (System Architecture)

```
+-------------------------------------------------------------------------------+
|                       FRONTEND (Hosted on GitHub Pages)                       |
|   HTML5 + Tailwind CSS + FontAwesome + Vanilla JS (Single Page Application)   |
|   โฟลเดอร์: /docs (index.html, styles.css, app.js)                            |
+-------------------------------------------------------------------------------+
                                      ▲
                                      │ REST API (JSON / CORS / Bearer JWT)
                                      ▼
+-------------------------------------------------------------------------------+
|                    BACKEND (Cloudflare Workers Serverless)                    |
|   ไฟล์: /src/index.js                                                          |
|   - Web Crypto API: SHA-256 (Password Hash) & HMAC-SHA256 (JWT Token)         |
|   - CORS Engine: อนุญาตคำขอจาก GitHub Pages และทุก Origin                      |
|   - Zero-Negative Stock Validation & Stock Card Engine                        |
+-------------------------------------------------------------------------------+
                                      ▲
                                      │ D1 SQL Driver Binding (env.DB)
                                      ▼
+-------------------------------------------------------------------------------+
|                  DATABASE (Cloudflare D1 - SQLite Serverless)                 |
|   ไฟล์: /schema.sql                                                            |
|   - Tables: users, permissions, shops, items, buys, pays                      |
|   - View: view_stock_balance                                                  |
+-------------------------------------------------------------------------------+
```

---

## 3. โครงสร้างฐานข้อมูล (Database Schema & Views)

### 3.1 ตารางผู้ใช้งานระบบ (`users`)
| คอลัมน์ | ชนิดข้อมูล | คุณสมบัติ | คำอธิบาย |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PK AUTOINCREMENT | ลำดับผู้ใช้งาน |
| `username` | TEXT | UNIQUE, NOT NULL | ชื่อผู้ใช้งานสำหรับเข้าสู่ระบบ |
| `password_hash` | TEXT | NOT NULL | แฮชรหัสผ่านด้วย SHA-256 (Hex Format) |
| `fullname` | TEXT | NOT NULL | ชื่อ-นามสกุล ของเจ้าหน้าที่ |
| `department` | TEXT | NOT NULL | แผนก/กลุ่มงานที่สังกัดใน รพ.ไทรโยค |
| `role` | TEXT | DEFAULT 'user' | บทบาท: `'superadmin'`, `'admin'`, `'user'` |
| `is_active` | INTEGER | DEFAULT 1 | สถานะการใช้งาน (1 = ใช้งานปกติ, 0 = ระงับ) |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | วันและเวลาที่สร้างบัญชี |

### 3.2 ตารางสิทธิการใช้งานรายหน้า (`permissions`)
ควบคุมสิทธิการเข้าถึงรายบุคคลแยกตามหน้างาน (Permission Matrix):
- `page_key` ที่รองรับ:
  1. `stock_balance` (ยอดคงเหลือสต๊อก)
  2. `buy` (บันทึกรับเข้าพัสดุ)
  3. `pay` (บันทึกเบิกจ่ายพัสดุ)
  4. `items` (ทะเบียนรหัสพัสดุ)
  5. `shops` (ข้อมูลร้านค้า/แหล่งรับ)
  6. `reports` (บัตรคุมพัสดุและรายงาน)
  7. `user_mgmt` (จัดการผู้ใช้และสิทธิ - เฉพาะ Superadmin)
- ฟิลด์:
  - `can_view`: 1 = มีสิทธิเปิดดูหน้านี้, 0 = ซ่อนเมนูและบล็อกการเข้าถึง
  - `can_edit`: 1 = มีสิทธิเพิ่ม/แก้ไข/บันทึกข้อมูล, 0 = อ่านได้อย่างเดียว (Read-only)

### 3.3 ตารางทะเบียนรหัสพัสดุ (`items`)
- `item_code` (TEXT UNIQUE): รหัสพัสดุ เช่น `MED-001`, `OFF-001`
- `item_name` (TEXT): ชื่อพัสดุและคุณลักษณะ
- `unit` (TEXT): หน่วยนับ (กล่อง, ขวด, รีม, ห่อ, ชุด)
- `category` (TEXT): กลุ่มพัสดุ เช่น เวชภัณฑ์มิใช่ยา, วัสดุสำนักงาน, วัสดุงานบ้านงานครัว
- `min_stock` (REAL): เกณฑ์เตือนสต๊อกขั้นต่ำ (เมื่อคงเหลือ &le; min_stock จะเตือนสถานะ LOW_STOCK)
- `max_stock` (REAL): เกณฑ์สต๊อกขั้นสูง เพื่อป้องกันการสั่งซื้อเกินความจำเป็น

### 3.4 ตารางบันทึกการรับเข้า (`buys`)
- `doc_date`: วันที่เอกสารรับเข้า (YYYY-MM-DD)
- `doc_no`: เลขที่ใบส่งของ/ใบสั่งซื้อ (PO No. / Invoice No.)
- `item_code`: รหัสพัสดุ
- `quantity`: จำนวนที่รับเข้า
- `price_per_unit`: ราคาต่อหน่วย
- `total_price`: มูลค่ารวมคำนวณอัตโนมัติ (`quantity * price_per_unit`)
- `shop_name`: ร้านค้าหรือคู่ค้าที่ส่งมอบ
- `ym_period`: งวดประจำเดือน เช่น `2024-01`
- `created_by`: ผู้ทำรายการ

### 3.5 ตารางบันทึกการเบิกจ่าย (`pays`)
- `doc_date`: วันที่เบิกจ่าย
- `doc_no`: เลขที่ใบเบิกพัสดุ
- `item_code`: รหัสพัสดุ
- `quantity`: จำนวนที่เบิก
- `price_per_unit`: ราคาเฉลี่ยต่อหน่วย ณ ขณะที่เบิก
- `total_price`: มูลค่ารวมของการเบิกจ่าย
- `department`: แผนก/ตึกผู้ป่วยที่เบิก (เช่น ER, OPD, IPD, ห้องผ่าตัด)
- `ym_period`: งวดประจำเดือน

### 3.6 มุมมองคำนวณยอดสต๊อกคงเหลือ (`view_stock_balance`)
สูตรคำนวณ:
$$\text{balance\_qty} = \sum(\text{buys.quantity}) - \sum(\text{pays.quantity})$$
$$\text{avg\_unit\_price} = \frac{\sum(\text{buys.total\_price})}{\sum(\text{buys.quantity})}$$
$$\text{balance\_val} = \text{balance\_qty} \times \text{avg\_unit\_price}$$

การระบุสถานะ (`stock_status`):
- `OUT_OF_STOCK`: เมื่อ $\text{balance\_qty} \le 0$
- `LOW_STOCK`: เมื่อ $\text{balance\_qty} \le \text{min\_stock}$
- `NORMAL`: เมื่อ $\text{balance\_qty} > \text{min\_stock}$

---

## 4. กฎทางธุรกิจและตรรกะการตัดสต๊อก (Business Rules)

### 4.1 กฎการป้องกันสต๊อกติดลบ 100% (Zero-Negative Stock Rule)
1. เมื่อมีการส่งคำขอเบิกจ่ายมาที่ `POST /api/pays`:
   - ระบบ Worker จะทำการ Query ยอดคงเหลือจริงจาก `view_stock_balance` ณ เวลานั้น
   - หาก $\text{requested\_quantity} > \text{balance\_qty}$:
     - ส่ง HTTP Status **400 Bad Request** ทันที พร้อม Payload:
       ```json
       {
         "success": false,
         "error": "INSUFFICIENT_STOCK",
         "message": "ยอดคงเหลือในคลังไม่เพียงพอ! พัสดุ \"...\" มียอดคงเหลือจริงเพียง X หน่วย ไม่สามารถเบิกติดลบได้",
         "available_qty": X,
         "requested_qty": Y
       }
       ```
2. ฝั่งหน้าบ้าน (Frontend):
   - มี **Live Real-time Validator**: ขณะที่พิมพ์จำนวนขอเบิก หากเกินยอดคงเหลือปัจจุบัน จะแสดงกล่องเตือนสีแดงเด่นชัดทันที และปิด (Disable) ปุ่มยืนยันการทำรายการ

### 4.2 ตรรกะการคำนวณบัตรคุมพัสดุ (Stock Card Running Balance Engine)
เมื่อเรียกดูบัตรคุมพัสดุของรหัสพัสดุใดๆ ในช่วงวันที่ `start_date` ถึง `end_date`:
1. **ยอดยกมา (Brought Forward)**:
   - คำนวณผลรวมรับเข้าทั้งหมดก่อน `start_date` ลบด้วย ผลรวมจ่ายออกทั้งหมดก่อน `start_date`:
     $$\text{opening\_qty} = \sum \text{buys}_{(\text{doc\_date} < \text{start\_date})} - \sum \text{pays}_{(\text{doc\_date} < \text{start\_date})}$$
2. **รายการเคลื่อนไหว (Movements)**:
   - ดึงรายการ `buys` และ `pays` ที่เกิดขึ้นในช่วง `[start_date, end_date]`
   - รวมข้อมูลและจัดเรียงตามลำดับเวลา: `doc_date ASC`, `created_at ASC`, `id ASC`
3. **การคำนวณยอดคงเหลือสะสม (Running Balance)**:
   - เริ่มต้นที่ $\text{running\_qty} = \text{opening\_qty}$
   - วนลูปทีละบรรทัด:
     - หากเป็นรายการรับเข้า: $\text{running\_qty} \mathrel{+}= \text{in\_qty}$
     - หากเป็นรายการจ่ายออก: $\text{running\_qty} \mathrel{-}= \text{out\_qty}$
     - บันทึกค่า $\text{balance\_qty}$ และ $\text{balance\_val}$ ประจำบรรทัดนั้นๆ

---

## 5. การออกรายงานและการพิมพ์บัตรคุมพัสดุ (A4 Official Printing)

เอกสารบัตรคุมพัสดุได้รับการออกแบบตามแบบฟอร์มพัสดุของกระทรวงสาธารณสุขและระเบียบกระทรวงการคลัง:
- **รูปแบบการแสดงผลบนหน้าจอ**: เป็นตาราง Responsive สวยงาม
- **รูปแบบเมื่อสั่งพิมพ์ (`@media print`)**:
  - ตัดการแสดงผลของ Navbar, Sidebar, ปุ่มกด, ตัวกรอง, Modal ทั้งหมด
  - ขยายพื้นที่เอกสารเต็มขนาดกระดาษ **A4 Portrait (ขอบ 12 มม.)**
  - ใช้เส้นขอบตารางสีเข้มคมชัดสูง
  - ป้องกันการตัดแบ่งกลางแถวตาราง (`page-break-inside: avoid`)
  - แสดง **บล็อกลงนามราชการ 3 ตำแหน่ง**:
    1. **ผู้จัดทำ**: เจ้าหน้าที่พัสดุ
    2. **ผู้ตรวจสอบ**: หัวหน้ากลุ่มงานบริหารทั่วไป
    3. **ผู้มีอำนาจอนุมัติ**: ผู้อำนวยการโรงพยาบาลไทรโยค

---

## 6. สิทธิการใช้งานและบัญชีผู้ใช้เริ่มต้น (Security & Initial Seed)

### 6.1 บัญชีผู้ดูแลระบบสูงสุด (Superadmin)
- **Username**: `chanpibul`
- **Default Password**: `300628`
- **Password Hash (SHA-256)**:
  `3d0a31206f4705574519be9b22a4c66cb1e85f50ef2562ec8724d2621743f07a`
- **Fullname**: `ผู้ดูแลระบบสูงสุด`
- **Role**: `superadmin`
- **สิทธิ**: เข้าถึงได้ทุกหน้า พร้อมสิทธิ `can_view = 1` และ `can_edit = 1` โดยอัตโนมัติ และเป็นผู้เดียวที่เข้าถึงเมนู "จัดการผู้ใช้และสิทธิ" ได้

### 6.2 บัญชีทดสอบอื่นๆ ในระบบ
- **เจ้าหน้าที่พัสดุ**: Username `stock_officer` / Password `123456` (มีสิทธิจัดการสต๊อก รับเข้า เบิกจ่าย และออกรายงาน)
- **พยาบาล ER**: Username `er_nurse` / Password `123456` (มีสิทธิเฉพาะตรวจเช็คสต๊อกและทำใบเบิกจ่ายพัสดุ)

---

## 7. คู่มือการติดตั้งและ Deploy (Deployment Guide)

### ขั้นตอนที่ 1: ติดตั้งฐานข้อมูล Cloudflare D1
1. ล็อกอินเข้าใช้งาน Cloudflare CLI:
   ```bash
   npx wrangler login
   ```
2. สร้าง D1 Database ใหม่:
   ```bash
   npx wrangler d1 create saiyok_stock_db
   ```
   (นำ `database_id` ที่ได้มาใส่ในไฟล์ `wrangler.toml`)
3. รัน Schema และ Initial Seed เข้าสู่ D1:
   - ทดสอบบน Local:
     ```bash
     npx wrangler d1 execute saiyok_stock_db --local --file=./schema.sql
     ```
   - รันขึ้น Cloudflare D1 บน Cloud จริง:
     ```bash
     npx wrangler d1 execute saiyok_stock_db --remote --file=./schema.sql
     ```

### ขั้นตอนที่ 2: Deploy Backend ไปยัง Cloudflare Workers
1. ตรวจสอบไฟล์ `src/index.js` และ `wrangler.toml`
2. สั่ง Deploy ขึ้น Cloudflare Workers:
   ```bash
   npx wrangler deploy
   ```
3. Cloudflare จะคืนค่า URL มา เช่น:
   `https://saiyok-hospital-stock.<subdomain>.workers.dev`

### ขั้นตอนที่ 3: โฮสต์ Frontend บน GitHub Pages
1. Push โปรเจกต์ขึ้น GitHub Repository
2. เข้าไปที่เมนู **Settings** > **Pages** ของ Repository
3. ที่หัวข้อ **Build and deployment**:
   - Source: `Deploy from a branch`
   - Branch: `main` (หรือ master) / Folder: `/docs`
   - คลิก **Save**
4. เปิด URL ของ GitHub Pages ที่ได้
5. คลิกที่ปุ่ม **"Cloudflare API"** (มุมขวาบน) แล้ววาง URL ของ Worker ที่ได้จากขั้นตอนที่ 2
6. กด **"ทดสอบการเชื่อมต่อ"** และ **"บันทึกการตั้งค่า"** เพื่อเริ่มใช้งานเต็มรูปแบบ

---
*เอกสารนี้จัดทำขึ้นสำหรับ โรงพยาบาลไทรโยค จ.กาญจนบุรี &bull; ลิขสิทธิ์ระบบ MIT License*
