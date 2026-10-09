# ============================================================================
# สคริปต์แปลงข้อมูลจาก Google Sheet สู่ Cloudflare D1 SQL (Sai Yok Hospital)
# Sheet ID: 1Ljnwa14H1C_1eGSgkXxblGFQk9KNCcFy-OvSlzHKv5o
# ============================================================================

$sheetId = "1Ljnwa14H1C_1eGSgkXxblGFQk9KNCcFy-OvSlzHKv5o"
$dataDir = "c:\webapp\stock\data_sync"
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

Write-Host "1. กำลังดาวน์โหลดข้อมูลจาก Google Sheet..."
$tabs = @{
    "items.csv" = "0"
    "shops.csv" = "907850828"
    "buys.csv"  = "840698544"
    "pays.csv"  = "567610446"
}

foreach ($file in $tabs.Keys) {
    $gid = $tabs[$file]
    $url = "https://docs.google.com/spreadsheets/d/$sheetId/export?format=csv&gid=$gid"
    $outPath = "$dataDir\$file"
    Invoke-WebRequest -Uri $url -OutFile $outPath -UseBasicParsing
}

Write-Host "2. กำลังแปลงข้อมูลและสร้างไฟล์ SQL..."

function Clean-SqlStr($str) {
    if ($null -eq $str) { return "''" }
    $s = $str.ToString().Trim().Replace("'", "''")
    return "'$s'"
}

function Clean-Num($str) {
    if ($null -eq $str) { return 0 }
    $s = $str.ToString().Replace(',', '').Trim()
    if ($s -as [double]) { return [double]$s }
    return 0
}

function Convert-DateStr($str) {
    if ($null -eq $str) { return "2025-10-01" }
    $s = $str.ToString().Trim()
    if ($s -match '^(\d+)/(\d+)/(\d+)$') {
        $day = $Matches[1].PadLeft(2, '0')
        $month = $Matches[2].PadLeft(2, '0')
        $year = $Matches[3]
        return "$year-$month-$day"
    }
    if ($s -match '^\d{4}-\d{2}-\d{2}$') { return $s }
    return "2025-10-01"
}

$sqlLines = [System.Collections.Generic.List[string]]::new()
$sqlLines.Add("-- ============================================================================")
$sqlLines.Add("-- นำเข้าข้อมูลคลังพัสดุ รพ.ไทรโยค จาก Google Sheet (Sheet ID: $sheetId)")
$sqlLines.Add("-- ============================================================================")
$sqlLines.Add("")

# 1. Shops
Write-Host "   - กำลังแปลงข้อมูลร้านค้า (Shops)..."
$shops = Import-Csv -Path "$dataDir\shops.csv" -Encoding UTF8
$shopNames = @{}

foreach ($s in $shops) {
    $name = $s."ร้านค้า".Trim()
    if ($name -and -not $shopNames.ContainsKey($name)) {
        $shopNames[$name] = $true
        $addr = Clean-SqlStr $s."ที่อยู่"
        $phone = Clean-SqlStr $s."เบอร์โทร"
        $tax = Clean-SqlStr $s."เลขผู้เสียภาษี"
        $n = Clean-SqlStr $name
        $sqlLines.Add("INSERT OR IGNORE INTO shops (shop_name, address, phone, tax_id) VALUES ($n, $addr, $phone, $tax);")
    }
}

# 2. Items
Write-Host "   - กำลังแปลงข้อมูลทะเบียนพัสดุ (Items)..."
$items = Import-Csv -Path "$dataDir\items.csv" -Encoding UTF8
$itemCodes = @{}

foreach ($it in $items) {
    $code = $it."รหัส".Trim()
    $name = $it."รายการ".Trim()
    if ($code -and $name) {
        $itemCodes[$code] = $true
        $c = Clean-SqlStr $code
        $n = Clean-SqlStr $name
        $u = Clean-SqlStr $it."หน่วยนับ"
        $cat = Clean-SqlStr $it."กลุ่มสินค้า"
        $min = Clean-Num $it."ขั้นต่ำ"
        $max = Clean-Num $it."ขั้นสูง"
        $sqlLines.Add("INSERT OR REPLACE INTO items (item_code, item_name, unit, category, min_stock, max_stock, is_active) VALUES ($c, $n, $u, $cat, $min, $max, 1);")
    }
}

# 3. Buys
Write-Host "   - กำลังแปลงข้อมูลการรับเข้า (Buys)..."
$buys = Import-Csv -Path "$dataDir\buys.csv" -Encoding UTF8
foreach ($b in $buys) {
    $code = $b."รหัสสินค้า".Trim()
    $name = $b."รายการ".Trim()
    if ($code -and $name) {
        $docDate = Convert-DateStr $b."วันที่"
        $docNo = if ($b."เลขที่เอกสาร".Trim()) { Clean-SqlStr $b."เลขที่เอกสาร" } else { Clean-SqlStr "-" }
        $c = Clean-SqlStr $code
        $n = Clean-SqlStr $name
        $cat = Clean-SqlStr $b."กลุ่มสินค้า"
        $u = Clean-SqlStr $b."หน่วยนับ"
        $price = Clean-Num $b."ราคา"
        $qty = Clean-Num $b."จำนวนที่ซื้อ"
        $total = Clean-Num $b."มูลค่ารวม"
        if ($total -le 0 -and $qty -gt 0 -and $price -gt 0) {
            $total = [Math]::Round($qty * $price, 2)
        }
        $shop = if ($b."ร้านค้า".Trim()) { Clean-SqlStr $b."ร้านค้า" } else { Clean-SqlStr "ยอดยกมา" }
        $rem = Clean-SqlStr $b."หมายเหตุ"
        $ym = if ($b."ปี-เดือน".Trim()) { Clean-SqlStr $b."ปี-เดือน" } else { Clean-SqlStr $docDate.Substring(0, 7) }

        $sqlLines.Add("INSERT INTO buys (doc_date, doc_no, item_code, item_name, category, unit, price_per_unit, quantity, total_price, shop_name, remark, ym_period, created_by) VALUES ('$docDate', $docNo, $c, $n, $cat, $u, $price, $qty, $total, $shop, $rem, $ym, 'google_sheet_sync');")
    }
}

# 4. Pays
Write-Host "   - กำลังแปลงข้อมูลการเบิกจ่าย (Pays)..."
$pays = Import-Csv -Path "$dataDir\pays.csv" -Encoding UTF8
foreach ($p in $pays) {
    $code = $p."รหัสสินค้า".Trim()
    $name = $p."รายการ".Trim()
    if ($code -and $name) {
        # คอลัมน์แรกใน CSV pays คือวันที่ (ถูกแทนที่ด้วย H1 ใน Import-Csv)
        $rawDate = $p.H1
        if (-not $rawDate) { $rawDate = $p."วันที่" }
        $docDate = Convert-DateStr $rawDate

        $docNo = if ($p."เลขที่เอกสาร".Trim()) { Clean-SqlStr $p."เลขที่เอกสาร" } else { Clean-SqlStr "-" }
        $c = Clean-SqlStr $code
        $n = Clean-SqlStr $name
        $cat = Clean-SqlStr $p."กลุ่มสินค้า"
        $u = Clean-SqlStr $p."หน่วยนับ"
        $price = Clean-Num $p."ราคา"
        $qty = Clean-Num $p."จำนวนที่จ่าย"
        $total = Clean-Num $p."มูลค่ารวม"
        if ($total -le 0 -and $qty -gt 0 -and $price -gt 0) {
            $total = [Math]::Round($qty * $price, 2)
        }
        $dept = if ($p."หน่วยงานที่เบิก".Trim()) { Clean-SqlStr $p."หน่วยงานที่เบิก" } else { Clean-SqlStr "หน่วยงานทั่วไป" }
        $rem = Clean-SqlStr $p."หมายเหตุ"
        $ym = if ($p."ปี-เดือน".Trim()) { Clean-SqlStr $p."ปี-เดือน" } else { Clean-SqlStr $docDate.Substring(0, 7) }

        $sqlLines.Add("INSERT INTO pays (doc_date, doc_no, item_code, item_name, category, unit, price_per_unit, quantity, total_price, department, remark, ym_period, created_by) VALUES ('$docDate', $docNo, $c, $n, $cat, $u, $price, $qty, $total, $dept, $rem, $ym, 'google_sheet_sync');")
    }
}

$sqlFile = "c:\webapp\stock\data_sync\seed_sheet_data.sql"
[System.IO.File]::WriteAllLines($sqlFile, $sqlLines, [System.Text.Encoding]::UTF8)

Write-Host "`n✔ สร้างไฟล์ SQL สำเร็จ: $sqlFile"
Write-Host "   - จำนวนคำสั่ง SQL ทั้งหมด: $($sqlLines.Count) บรรทัด"
Write-Host "   - ขนาดไฟล์: $([Math]::Round((Get-Item $sqlFile).Length / 1KB, 2)) KB"
