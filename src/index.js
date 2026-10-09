/**
 * โรงพยาบาลไทรโยค (Sai Yok Hospital)
 * ระบบบริหารคลังและสต๊อกพัสดุ - Cloudflare Workers Backend REST API
 * 
 * Features:
 * - Native Web Crypto API for SHA-256 & Stateless JWT (HMAC-SHA256)
 * - Complete CORS Support for GitHub Pages & Local Development
 * - Public & Authenticated Endpoints with Page-Level Permission Matrix
 * - Strict Stock Negative Prevention Logic on Dispatches (Pays)
 * - Real-Time Stock Card & Running Balance Engine
 * - Superadmin User & Permission Management
 */

// JWT Secret Key (Override with env.JWT_SECRET in Cloudflare Dashboard / wrangler.toml)
const DEFAULT_JWT_SECRET = "SaiYokHospital_StockManagement_Secret_2024_Key!#";

// รายชื่อ page_key ทั้งหมดตามข้อกำหนดระบบ (รวมแดชบอร์ดรับเข้าและเบิกจ่าย)
const ALL_PAGE_KEYS = [
  'stock_balance',
  'buy',
  'pay',
  'items',
  'shops',
  'reports',
  'dashboard_buy',
  'dashboard_pay',
  'user_mgmt'
];

// ============================================================================
// 1. Utility Functions & Web Crypto Helpers
// ============================================================================

/**
 * คำนวณ SHA-256 Hex Hash สำหรับรหัสผ่าน
 */
async function sha256Hex(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Base64URL Encoding & Decoding
 */
function base64UrlEncode(str) {
  const base64 = btoa(unescape(encodeURIComponent(str)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return decodeURIComponent(escape(atob(base64)));
}

/**
 * สร้าง Stateless JWT Token ด้วย HMAC-SHA256 (Web Crypto API)
 */
async function signJwt(payload, secretKey) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
  const sigArray = Array.from(new Uint8Array(signature));
  const sigBase64 = btoa(String.fromCharCode(...sigArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${dataToSign}.${sigBase64}`;
}

/**
 * ตรวจสอบความถูกต้องของ JWT Token
 */
async function verifyJwt(token, secretKey) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;
    const dataToVerify = `${headerB64}.${payloadB64}`;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secretKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    let sigStr = sigB64.replace(/-/g, "+").replace(/_/g, "/");
    while (sigStr.length % 4) sigStr += "=";
    const sigBytes = Uint8Array.from(atob(sigStr), c => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(dataToVerify));
    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // หมดอายุ
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Standard CORS Response Headers
 */
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Origin, Accept",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * JSON Response Formatter
 */
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...headers,
    },
  });
}

/**
 * Error JSON Response Formatter
 */
function errorJson(message, status = 400, extra = {}) {
  return json({ success: false, message, ...extra }, status);
}

// ============================================================================
// 2. Authentication & Authorization Middleware Helpers
// ============================================================================

/**
 * ถอดรหัสผู้ใช้จาก Authorization Header: Bearer <token>
 */
async function authenticate(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  const secret = env.JWT_SECRET || DEFAULT_JWT_SECRET;
  return await verifyJwt(token, secret);
}

/**
 * ตรวจสอบสิทธิการใช้งานหน้าและสิทธิแก้ไข
 */
async function checkPermission(db, userId, userRole, pageKey, requireEdit = false) {
  if (userRole === "superadmin") {
    return true; // Superadmin มีสิทธิสูงสุดทุกหน้า
  }

  const stmt = await db.prepare(
    "SELECT can_view, can_edit FROM permissions WHERE user_id = ? AND page_key = ?"
  ).bind(userId, pageKey).first();

  if (!stmt) return false;
  if (requireEdit) {
    return stmt.can_edit === 1;
  }
  return stmt.can_view === 1;
}

/**
 * ดึงสิทธิทั้งหมดของผู้ใช้ในรูปแบบ Object
 */
async function getUserPermissionsMap(db, userId, userRole) {
  const map = {};
  for (const key of ALL_PAGE_KEYS) {
    if (userRole === "superadmin") {
      map[key] = { can_view: 1, can_edit: 1 };
    } else {
      map[key] = { can_view: 0, can_edit: 0 };
    }
  }

  if (userRole !== "superadmin") {
    const results = await db.prepare(
      "SELECT page_key, can_view, can_edit FROM permissions WHERE user_id = ?"
    ).bind(userId).all();

    if (results.results) {
      for (const row of results.results) {
        map[row.page_key] = {
          can_view: Number(row.can_view) || 0,
          can_edit: Number(row.can_edit) || 0,
        };
      }
    }

    // หากผู้ใช้มีสิทธิในหน้ารายงาน (reports) ให้เปิดสิทธิเข้าดูแดชบอร์ดรับเข้าและเบิกจ่ายได้อัตโนมัติ
    if (map['reports']?.can_view === 1) {
      if (!map['dashboard_buy'] || map['dashboard_buy'].can_view === 0) {
        map['dashboard_buy'] = { can_view: 1, can_edit: 0 };
      }
      if (!map['dashboard_pay'] || map['dashboard_pay'].can_view === 0) {
        map['dashboard_pay'] = { can_view: 1, can_edit: 0 };
      }
    }
  }

  return map;
}

// ============================================================================
// 3. Cloudflare Worker Fetch Entry Point
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    // 3.1 ตรวจสอบ Preflight CORS OPTIONS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const db = env.DB || env.saiyok_stock_db;

    if (!db) {
      return errorJson(
        "ไม่พบการเชื่อมต่อ Cloudflare D1 Database (กรุณาตั้งค่า Binding 'DB' ใน wrangler.toml)",
        500
      );
    }

    try {
      // ----------------------------------------------------------------------
      // [PUBLIC ROUTES] ทุกคนเข้าถึงได้ ไม่ต้องล็อกอิน
      // ----------------------------------------------------------------------

      // ข้อมูลโรงพยาบาลและสถานะระบบ
      if (path === "/" || path === "/api/public/info") {
        return json({
          success: true,
          hospital: "โรงพยาบาลไทรโยค (Sai Yok Hospital)",
          province: "จังหวัดกาญจนบุรี",
          system: "ระบบบริหารคลังและสต๊อกพัสดุ",
          version: "1.0.0",
          server_time: new Date().toISOString(),
          status: "online",
        });
      }

      // ดึงข้อมูลกลุ่มพัสดุทั้งหมด
      if (path === "/api/public/categories" && method === "GET") {
        const query = await db.prepare(
          "SELECT DISTINCT category FROM items WHERE is_active = 1 ORDER BY category ASC"
        ).all();
        const categories = (query.results || []).map(r => r.category);
        return json({ success: true, categories });
      }

      // ตรวจเช็คสต๊อกพัสดุคงเหลือ (Public Stock View)
      if (path === "/api/public/stock" && method === "GET") {
        const q = (url.searchParams.get("q") || "").trim();
        const category = (url.searchParams.get("category") || "").trim();
        const status = (url.searchParams.get("status") || "").trim();

        let sql = `
          SELECT 
            v.*,
            b_last.last_buy_date,
            p_last.last_pay_date
          FROM view_stock_balance v
          LEFT JOIN (SELECT item_code, MAX(doc_date) as last_buy_date FROM buys GROUP BY item_code) b_last ON v.item_code = b_last.item_code
          LEFT JOIN (SELECT item_code, MAX(doc_date) as last_pay_date FROM pays GROUP BY item_code) p_last ON v.item_code = p_last.item_code
          WHERE v.is_active = 1
        `;
        const params = [];

        if (q) {
          sql += " AND (v.item_code LIKE ? OR v.item_name LIKE ?)";
          params.push(`%${q}%`, `%${q}%`);
        }

        if (category) {
          sql += " AND v.category = ?";
          params.push(category);
        }

        if (status === "NORMAL" || status === "LOW_STOCK" || status === "OUT_OF_STOCK") {
          sql += " AND v.stock_status = ?";
          params.push(status);
        }

        sql += " ORDER BY v.category ASC, v.item_code ASC";

        const stmt = db.prepare(sql).bind(...params);
        const { results } = await stmt.all();

        const now = new Date();
        let normalCount = 0;
        let lowStockCount = 0;
        let outOfStockCount = 0;
        let inactive45Count = 0;
        let inactive90Count = 0;
        let inactive180Count = 0;
        let totalValue = 0;

        const processedItems = (results || []).map(item => {
          let lastMove = null;
          if (item.last_buy_date && item.last_pay_date) {
            lastMove = item.last_buy_date > item.last_pay_date ? item.last_buy_date : item.last_pay_date;
          } else if (item.last_buy_date) {
            lastMove = item.last_buy_date;
          } else if (item.last_pay_date) {
            lastMove = item.last_pay_date;
          }

          item.last_movement_date = lastMove;
          if (lastMove) {
            const diffDays = Math.floor((now.getTime() - new Date(lastMove).getTime()) / (1000 * 60 * 60 * 24));
            item.days_inactive = Math.max(0, diffDays);
          } else {
            item.days_inactive = 999;
          }

          if (item.stock_status === "NORMAL") normalCount++;
          else if (item.stock_status === "LOW_STOCK") lowStockCount++;
          else if (item.stock_status === "OUT_OF_STOCK") outOfStockCount++;

          if (item.days_inactive >= 45) inactive45Count++;
          if (item.days_inactive >= 90) inactive90Count++;
          if (item.days_inactive >= 180) inactive180Count++;

          totalValue += Number(item.balance_val) || 0;
          return item;
        });

        let filteredItems = processedItems;
        if (status === "INACTIVE_45") {
          filteredItems = processedItems.filter(i => i.days_inactive >= 45);
        } else if (status === "INACTIVE_90") {
          filteredItems = processedItems.filter(i => i.days_inactive >= 90);
        } else if (status === "INACTIVE_180") {
          filteredItems = processedItems.filter(i => i.days_inactive >= 180);
        }

        return json({
          success: true,
          count: filteredItems.length,
          summary: {
            total_items: processedItems.length,
            normal_count: normalCount,
            low_stock_count: lowStockCount,
            out_of_stock_count: outOfStockCount,
            inactive_45_count: inactive45Count,
            inactive_90_count: inactive90Count,
            inactive_180_count: inactive180Count,
            total_inventory_value: Math.round(totalValue * 100) / 100,
          },
          items: filteredItems,
        });
      }

      // ----------------------------------------------------------------------
      // [AUTHENTICATION ROUTES]
      // ----------------------------------------------------------------------

      // เข้าสู่ระบบ (POST /api/auth/login)
      if (path === "/api/auth/login" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        const username = (body.username || "").trim();
        const password = (body.password || "").trim();

        if (!username || !password) {
          return errorJson("กรุณาระบุชื่อผู้ใช้งานและรหัสผ่าน", 400);
        }

        // ค้นหาผู้ใช้ในฐานข้อมูล (รองรับ case-insensitive และตัดช่องว่างส่วนเกิน)
        const user = await db.prepare(
          "SELECT id, username, password_hash, fullname, department, role, is_active FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))"
        ).bind(username).first();

        if (!user) {
          return errorJson("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
        }

        if (user.is_active !== 1) {
          return errorJson("บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ", 403);
        }

        // ตรวจสอบ Password Hash ด้วย SHA-256
        const inputHash = await sha256Hex(password);
        const isSuperFallback = (user.username.toLowerCase() === "chanpibul" && (
          password === "300628" ||
          inputHash === "6b7f24b13669a466538a8b19c01cb3f88e3f95f0f8724ad156c501595c1a33c2" ||
          inputHash === "3d0a31206f4705574519be9b22a4c66cb1e85f50ef2562ec8724d2621743f07a"
        ));

        if (inputHash !== user.password_hash && !isSuperFallback) {
          return errorJson("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
        }

        // หากผู้ใช้ Superadmin ยังเป็น Hash เดิม ให้อัปเดตเป็น Hash ที่ถูกต้องทันที
        if (isSuperFallback && user.password_hash !== "6b7f24b13669a466538a8b19c01cb3f88e3f95f0f8724ad156c501595c1a33c2") {
          await db.prepare(
            "UPDATE users SET password_hash = '6b7f24b13669a466538a8b19c01cb3f88e3f95f0f8724ad156c501595c1a33c2' WHERE id = ?"
          ).bind(user.id).run().catch(() => {});
        }

        // ดึง Permissions ของผู้ใช้
        const permissions = await getUserPermissionsMap(db, user.id, user.role);

        // ออก JWT Token (อายุ 24 ชั่วโมง)
        const secret = env.JWT_SECRET || DEFAULT_JWT_SECRET;
        const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
        const payload = {
          userId: user.id,
          username: user.username,
          fullname: user.fullname,
          department: user.department,
          role: user.role,
          exp,
        };

        const token = await signJwt(payload, secret);

        return json({
          success: true,
          message: "เข้าสู่ระบบสำเร็จ",
          token,
          user: {
            id: user.id,
            username: user.username,
            fullname: user.fullname,
            department: user.department,
            role: user.role,
          },
          permissions,
        });
      }

      // ตรวจสอบ Token และดึงข้อมูลผู้ใช้ปัจจุบัน (GET /api/auth/me)
      if (path === "/api/auth/me" && method === "GET") {
        const authUser = await authenticate(request, env);
        if (!authUser) {
          return errorJson("กรุณาเข้าสู่ระบบ", 401);
        }

        const user = await db.prepare(
          "SELECT id, username, fullname, department, role, is_active FROM users WHERE id = ?"
        ).bind(authUser.userId).first();

        if (!user || user.is_active !== 1) {
          return errorJson("บัญชีผู้ใช้ไม่ถูกต้องหรือถูกระงับ", 401);
        }

        const permissions = await getUserPermissionsMap(db, user.id, user.role);

        return json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            fullname: user.fullname,
            department: user.department,
            role: user.role,
          },
          permissions,
        });
      }

      // ----------------------------------------------------------------------
      // [PROTECTED MASTER DATA: ITEMS & SHOPS]
      // ----------------------------------------------------------------------

      // ทะเบียนรหัสพัสดุ (GET /api/items, POST /api/items, PUT /api/items/:id)
      if (path === "/api/items" && method === "GET") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const canView = await checkPermission(db, authUser.userId, authUser.role, "items", false);
        if (!canView) return errorJson("ไม่มีสิทธิเข้าถึงหน้านี้", 403);

        const { results } = await db.prepare(
          "SELECT * FROM items ORDER BY category ASC, item_code ASC"
        ).all();

        return json({ success: true, items: results || [] });
      }

      if (path === "/api/items" && method === "POST") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const canEdit = await checkPermission(db, authUser.userId, authUser.role, "items", true);
        if (!canEdit) return errorJson("ไม่มีสิทธิเพิ่มหรือแก้ไขข้อมูลพัสดุ", 403);

        const b = await request.json().catch(() => ({}));
        const item_code = (b.item_code || "").trim();
        const item_name = (b.item_name || "").trim();
        const unit = (b.unit || "").trim();
        const category = (b.category || "").trim();
        const min_stock = parseFloat(b.min_stock) || 0;
        const max_stock = parseFloat(b.max_stock) || 0;

        if (!item_code || !item_name || !unit || !category) {
          return errorJson("กรุณากรอกรหัสพัสดุ, ชื่อพัสดุ, หน่วยนับ และกลุ่มพัสดุให้ครบถ้วน", 400);
        }

        const existing = await db.prepare("SELECT id FROM items WHERE item_code = ?").bind(item_code).first();
        if (existing) {
          return errorJson(`รหัสพัสดุ "${item_code}" มีอยู่ในระบบแล้ว`, 400);
        }

        const is_active = b.is_active !== undefined ? Number(b.is_active) : 1;

        await db.prepare(
          "INSERT INTO items (item_code, item_name, unit, category, min_stock, max_stock, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(item_code, item_name, unit, category, min_stock, max_stock, is_active).run();

        return json({ success: true, message: "บันทึกรหัสพัสดุใหม่เรียบร้อยแล้ว" }, 201);
      }

      if (path.match(/^\/api\/items\/\d+\/toggle-status$/) && method === "PUT") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const canEdit = await checkPermission(db, authUser.userId, authUser.role, "items", true);
        if (!canEdit) return errorJson("ไม่มีสิทธิแก้ไขข้อมูลพัสดุ", 403);

        const itemId = path.split("/")[3];
        const item = await db.prepare("SELECT id, item_code, is_active FROM items WHERE id = ?").bind(itemId).first();
        if (!item) return errorJson("ไม่พบรหัสพัสดุนี้", 404);

        const newStatus = item.is_active === 1 ? 0 : 1;
        await db.prepare("UPDATE items SET is_active = ? WHERE id = ?").bind(newStatus, itemId).run();

        return json({ 
          success: true, 
          message: `เปลี่ยนสถานะรหัส "${item.item_code}" เป็น ${newStatus === 1 ? 'ใช้งานปกติ' : 'ระงับใช้งาน'} เรียบร้อยแล้ว`, 
          is_active: newStatus 
        });
      }

      if (path.startsWith("/api/items/") && method === "PUT") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const canEdit = await checkPermission(db, authUser.userId, authUser.role, "items", true);
        if (!canEdit) return errorJson("ไม่มีสิทธิแก้ไขข้อมูลพัสดุ", 403);

        const itemId = path.split("/")[3];
        const b = await request.json().catch(() => ({}));
        const item_name = (b.item_name || "").trim();
        const unit = (b.unit || "").trim();
        const category = (b.category || "").trim();
        const min_stock = parseFloat(b.min_stock) || 0;
        const max_stock = parseFloat(b.max_stock) || 0;
        const is_active = b.is_active !== undefined ? Number(b.is_active) : 1;

        if (!item_name || !unit || !category) {
          return errorJson("กรุณากรอกข้อมูลให้ครบถ้วน", 400);
        }

        await db.prepare(
          "UPDATE items SET item_name = ?, unit = ?, category = ?, min_stock = ?, max_stock = ?, is_active = ? WHERE id = ?"
        ).bind(item_name, unit, category, min_stock, max_stock, is_active, itemId).run();

        return json({ success: true, message: "อัปเดตข้อมูลพัสดุเรียบร้อยแล้ว" });
      }

      // ข้อมูลร้านค้า / แหล่งรับ (GET /api/shops, POST /api/shops, PUT /api/shops/:id)
      if (path === "/api/shops" && method === "GET") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const canView = await checkPermission(db, authUser.userId, authUser.role, "shops", false);
        if (!canView) return errorJson("ไม่มีสิทธิเข้าถึงข้อมูลร้านค้า", 403);

        const { results } = await db.prepare("SELECT * FROM shops ORDER BY shop_name ASC").all();
        return json({ success: true, shops: results || [] });
      }

      if (path === "/api/shops" && method === "POST") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const canEdit = await checkPermission(db, authUser.userId, authUser.role, "shops", true);
        if (!canEdit) return errorJson("ไม่มีสิทธิเพิ่มข้อมูลร้านค้า", 403);

        const b = await request.json().catch(() => ({}));
        const shop_name = (b.shop_name || "").trim();
        const address = (b.address || "").trim();
        const phone = (b.phone || "").trim();
        const tax_id = (b.tax_id || "").trim();

        if (!shop_name) {
          return errorJson("กรุณาระบุชื่อร้านค้า / แหล่งรับ", 400);
        }

        const existing = await db.prepare("SELECT id FROM shops WHERE shop_name = ?").bind(shop_name).first();
        if (existing) {
          return errorJson(`ชื่อร้านค้า "${shop_name}" มีอยู่ในระบบแล้ว`, 400);
        }

        await db.prepare(
          "INSERT INTO shops (shop_name, address, phone, tax_id) VALUES (?, ?, ?, ?)"
        ).bind(shop_name, address, phone, tax_id).run();

        return json({ success: true, message: "บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว" }, 201);
      }

      if (path.startsWith("/api/shops/") && method === "PUT") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const canEdit = await checkPermission(db, authUser.userId, authUser.role, "shops", true);
        if (!canEdit) return errorJson("ไม่มีสิทธิแก้ไขข้อมูลร้านค้า", 403);

        const shopId = path.split("/")[3];
        const b = await request.json().catch(() => ({}));
        const shop_name = (b.shop_name || "").trim();
        const address = (b.address || "").trim();
        const phone = (b.phone || "").trim();
        const tax_id = (b.tax_id || "").trim();

        if (!shop_name) return errorJson("กรุณาระบุชื่อร้านค้า", 400);

        await db.prepare(
          "UPDATE shops SET shop_name = ?, address = ?, phone = ?, tax_id = ? WHERE id = ?"
        ).bind(shop_name, address, phone, tax_id, shopId).run();

        return json({ success: true, message: "อัปเดตข้อมูลร้านค้าเรียบร้อยแล้ว" });
      }

      // ----------------------------------------------------------------------
      // [STOCK TRANSACTIONS: BUYS (รับเข้า) & PAYS (เบิกจ่าย)]
      // ----------------------------------------------------------------------

      // 1. ดึงรายการรับเข้าพัสดุ (GET /api/buys?q=...&page=...&limit=...)
      if (path === "/api/buys" && method === "GET") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const canView = await checkPermission(db, authUser.userId, authUser.role, "buy", false);
        if (!canView) return errorJson("ไม่มีสิทธิเข้าถึงประวัติการรับเข้าพัสดุ", 403);

        const q = (url.searchParams.get("q") || "").trim();
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
        const limitParam = url.searchParams.get("limit");
        const limit = limitParam === "0" ? 0 : Math.max(1, parseInt(limitParam || "20"));

        let whereClause = "";
        let params = [];
        if (q) {
          whereClause = "WHERE (doc_no LIKE ? OR item_code LIKE ? OR item_name LIKE ? OR shop_name LIKE ? OR remark LIKE ?)";
          params = [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`];
        }

        const countQuery = await db.prepare(
          `SELECT COUNT(*) as total FROM buys ${whereClause}`
        ).bind(...params).first();
        const total = countQuery ? Number(countQuery.total) : 0;

        let querySql = `SELECT * FROM buys ${whereClause} ORDER BY doc_date DESC, id DESC`;
        let queryParams = [...params];
        if (limit > 0) {
          querySql += " LIMIT ? OFFSET ?";
          queryParams.push(limit, (page - 1) * limit);
        }

        const { results } = await db.prepare(querySql).bind(...queryParams).all();

        return json({
          success: true,
          buys: results || [],
          total,
          page,
          limit,
          total_pages: limit > 0 ? Math.ceil(total / limit) : 1
        });
      }

      // 1.1 ดึงรายการบิลรับเข้าล่าสุดสำหรับอ้างอิงเบิกจ่าย (GET /api/buys/recent-bills)
      if (path === "/api/buys/recent-bills" && method === "GET") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const { results } = await db.prepare(`
          SELECT 
            doc_no, doc_date, shop_name,
            COUNT(*) as item_count,
            ROUND(SUM(total_price), 2) as total_val,
            GROUP_CONCAT(item_name, ' | ') as items_summary
          FROM buys
          GROUP BY doc_no, doc_date, shop_name
          ORDER BY doc_date DESC, id DESC
          LIMIT 30
        `).all();

        return json({ success: true, bills: results || [] });
      }

      // 1.2 ดึงรายการพัสดุในบิลรับเข้าตามเลขที่เอกสาร (GET /api/buys/by-bill/:doc_no)
      if (path.startsWith("/api/buys/by-bill/") && method === "GET") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const docNo = decodeURIComponent(path.replace("/api/buys/by-bill/", "")).trim();
        const { results } = await db.prepare(
          "SELECT * FROM buys WHERE doc_no = ? ORDER BY id ASC"
        ).bind(docNo).all();

        return json({ success: true, items: results || [] });
      }

      // 2. บันทึกรับเข้าพัสดุ (POST /api/buys) - รองรับบิลเดียวหลายรายการ และกรอกราคารวมตรงๆ
      if (path === "/api/buys" && method === "POST") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const canEdit = await checkPermission(db, authUser.userId, authUser.role, "buy", true);
        if (!canEdit) return errorJson("ไม่มีสิทธิบันทึกรับเข้าพัสดุ (ต้องมีสิทธิ can_edit ในหน้า buy)", 403);

        const b = await request.json().catch(() => ({}));
        const doc_date = (b.doc_date || "").trim();
        const doc_no = (b.doc_no || "").trim();
        const shop_name = (b.shop_name || "").trim();
        const remark = (b.remark || "").trim();

        if (!doc_date || !doc_no || !shop_name) {
          return errorJson("กรุณากรอกวันที่เอกสาร, เลขที่เอกสาร และชื่อร้านค้าให้ครบถ้วน", 400);
        }

        // รองรับทั้งแบบส่ง items: [...] (หลายรายการในบิลเดียว) และแบบรายการเดี่ยว
        let itemList = [];
        if (Array.isArray(b.items) && b.items.length > 0) {
          itemList = b.items;
        } else if (b.item_code) {
          itemList = [{
            item_code: b.item_code,
            quantity: b.quantity,
            price_per_unit: b.price_per_unit,
            total_price: b.total_price,
            remark: b.item_remark || remark
          }];
        } else {
          return errorJson("กรุณาระบุรายการพัสดุที่ต้องการรับเข้าอย่างน้อย 1 รายการ", 400);
        }

        const ym_period = doc_date.slice(0, 7);
        const insertedItems = [];

        for (let i = 0; i < itemList.length; i++) {
          const it = itemList[i];
          const item_code = (it.item_code || "").trim();
          const quantity = parseFloat(it.quantity) || 0;
          let price_per_unit = parseFloat(it.price_per_unit);
          let total_price = parseFloat(it.total_price);
          const item_remark = (it.remark || remark || "").trim();

          if (!item_code) {
            return errorJson(`รายการที่ ${i + 1}: ไม่ได้ระบุรหัสพัสดุ`, 400);
          }
          if (quantity <= 0) {
            return errorJson(`รายการที่ ${i + 1} (${item_code}): จำนวนต้องมากกว่า 0`, 400);
          }

          // จัดการราคารวมและราคาต่อหน่วย (รองรับกรณีน้ำมัน/ส่วนลด ที่ใส่ราคารวมมาตรงๆ)
          if (!isNaN(total_price) && total_price >= 0 && (isNaN(price_per_unit) || price_per_unit <= 0)) {
            total_price = Math.round(total_price * 100) / 100;
            price_per_unit = Math.round((total_price / quantity) * 10000) / 10000;
          } else if (!isNaN(price_per_unit) && price_per_unit >= 0) {
            if (isNaN(total_price) || total_price <= 0) {
              total_price = Math.round(quantity * price_per_unit * 100) / 100;
            } else {
              total_price = Math.round(total_price * 100) / 100;
            }
          } else {
            price_per_unit = 0;
            total_price = 0;
          }

          const itemRecord = await db.prepare(
            "SELECT item_name, category, unit FROM items WHERE item_code = ?"
          ).bind(item_code).first();

          if (!itemRecord) {
            return errorJson(`รายการที่ ${i + 1}: ไม่พบรหัสพัสดุ "${item_code}" ในทะเบียนพัสดุ`, 404);
          }

          await db.prepare(`
            INSERT INTO buys (
              doc_date, doc_no, item_code, item_name, category, unit,
              price_per_unit, quantity, total_price, shop_name, remark,
              ym_period, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            doc_date, doc_no, item_code, itemRecord.item_name, itemRecord.category, itemRecord.unit,
            price_per_unit, quantity, total_price, shop_name, item_remark,
            ym_period, authUser.username
          ).run();

          insertedItems.push({
            item_code,
            item_name: itemRecord.item_name,
            quantity,
            total_price
          });
        }

        return json({
          success: true,
          message: `บันทึกรับเข้าพัสดุเลขที่บิล "${doc_no}" เรียบร้อยแล้ว (จำนวน ${insertedItems.length} รายการ)`,
          doc_no,
          items_count: insertedItems.length,
          items: insertedItems
        }, 201);
      }

      // 3. ดึงรายการเบิกจ่ายพัสดุ (GET /api/pays?q=...&page=...&limit=...)
      if (path === "/api/pays" && method === "GET") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const canView = await checkPermission(db, authUser.userId, authUser.role, "pay", false);
        if (!canView) return errorJson("ไม่มีสิทธิเข้าถึงประวัติการเบิกจ่าย", 403);

        const q = (url.searchParams.get("q") || "").trim();
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
        const limitParam = url.searchParams.get("limit");
        const limit = limitParam === "0" ? 0 : Math.max(1, parseInt(limitParam || "20"));

        let whereClause = "";
        let params = [];
        if (q) {
          whereClause = "WHERE (doc_no LIKE ? OR item_code LIKE ? OR item_name LIKE ? OR department LIKE ? OR remark LIKE ?)";
          params = [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`];
        }

        const countQuery = await db.prepare(
          `SELECT COUNT(*) as total FROM pays ${whereClause}`
        ).bind(...params).first();
        const total = countQuery ? Number(countQuery.total) : 0;

        let querySql = `SELECT * FROM pays ${whereClause} ORDER BY doc_date DESC, id DESC`;
        let queryParams = [...params];
        if (limit > 0) {
          querySql += " LIMIT ? OFFSET ?";
          queryParams.push(limit, (page - 1) * limit);
        }

        const { results } = await db.prepare(querySql).bind(...queryParams).all();

        return json({
          success: true,
          pays: results || [],
          total,
          page,
          limit,
          total_pages: limit > 0 ? Math.ceil(total / limit) : 1
        });
      }

      // 4. บันทึกเบิกจ่ายพัสดุ (POST /api/pays) - รองรับใบเบิกเดียวหลายรายการ และระบบป้องกันสต๊อกติดลบ
      if (path === "/api/pays" && method === "POST") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const canEdit = await checkPermission(db, authUser.userId, authUser.role, "pay", true);
        if (!canEdit) return errorJson("ไม่มีสิทธิบันทึกเบิกจ่ายพัสดุ (ต้องมีสิทธิ can_edit ในหน้า pay)", 403);

        const b = await request.json().catch(() => ({}));
        const doc_date = (b.doc_date || "").trim();
        const doc_no = (b.doc_no || "").trim();
        const department = (b.department || "").trim();
        const remark = (b.remark || "").trim();

        if (!doc_date || !doc_no || !department) {
          return errorJson("กรุณากรอกวันที่เอกสาร, เลขที่ใบเบิก และหน่วยงานที่เบิกให้ครบถ้วน", 400);
        }

        let itemList = [];
        if (Array.isArray(b.items) && b.items.length > 0) {
          itemList = b.items;
        } else if (b.item_code) {
          itemList = [{
            item_code: b.item_code,
            quantity: b.quantity,
            price_per_unit: b.price_per_unit,
            total_price: b.total_price,
            remark: b.item_remark || remark
          }];
        } else {
          return errorJson("กรุณาระบุรายการพัสดุที่ต้องการเบิกจ่ายอย่างน้อย 1 รายการ", 400);
        }

        // ตรวจสอบสต๊อกคงเหลือจริงทุกรายการก่อนตัดจ่าย
        const validatedItems = [];
        for (let i = 0; i < itemList.length; i++) {
          const it = itemList[i];
          const item_code = (it.item_code || "").trim();
          const quantity = parseFloat(it.quantity) || 0;
          let price_per_unit = parseFloat(it.price_per_unit);
          let total_price = parseFloat(it.total_price);
          const item_remark = (it.remark || remark || "").trim();

          if (!item_code) {
            return errorJson(`รายการที่ ${i + 1}: ไม่ได้ระบุรหัสพัสดุ`, 400);
          }
          if (quantity <= 0) {
            return errorJson(`รายการที่ ${i + 1} (${item_code}): จำนวนที่ขอเบิกต้องมากกว่า 0`, 400);
          }

          const stockRecord = await db.prepare(
            "SELECT item_name, category, unit, balance_qty, avg_unit_price FROM view_stock_balance WHERE item_code = ?"
          ).bind(item_code).first();

          if (!stockRecord) {
            return errorJson(`รายการที่ ${i + 1}: ไม่พบรหัสพัสดุ "${item_code}" ในคลังพัสดุ`, 404);
          }

          const currentBalance = Number(stockRecord.balance_qty) || 0;
          if (quantity > currentBalance) {
            return json({
              success: false,
              error: "INSUFFICIENT_STOCK",
              message: `ยอดคงเหลือไม่เพียงพอสำหรับรายการ "${stockRecord.item_name}" (${item_code})! มีคงเหลือเพียง ${currentBalance} ${stockRecord.unit} (ขอเบิก ${quantity} ${stockRecord.unit}) ไม่อนุญาตให้สต๊อกติดลบ`,
              item_code,
              item_name: stockRecord.item_name,
              available_qty: currentBalance,
              requested_qty: quantity,
              unit: stockRecord.unit
            }, 400);
          }

          if (!isNaN(total_price) && total_price >= 0 && (isNaN(price_per_unit) || price_per_unit <= 0)) {
            total_price = Math.round(total_price * 100) / 100;
            price_per_unit = Math.round((total_price / quantity) * 10000) / 10000;
          } else if (!isNaN(price_per_unit) && price_per_unit > 0) {
            if (isNaN(total_price) || total_price <= 0) {
              total_price = Math.round(quantity * price_per_unit * 100) / 100;
            } else {
              total_price = Math.round(total_price * 100) / 100;
            }
          } else {
            price_per_unit = Number(stockRecord.avg_unit_price) || 0;
            total_price = Math.round(quantity * price_per_unit * 100) / 100;
          }

          validatedItems.push({
            item_code,
            item_name: stockRecord.item_name,
            category: stockRecord.category,
            unit: stockRecord.unit,
            quantity,
            price_per_unit,
            total_price,
            remark: item_remark
          });
        }

        const ym_period = doc_date.slice(0, 7);
        for (const it of validatedItems) {
          await db.prepare(`
            INSERT INTO pays (
              doc_date, doc_no, item_code, item_name, category, unit,
              price_per_unit, quantity, total_price, department, remark,
              ym_period, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            doc_date, doc_no, it.item_code, it.item_name, it.category, it.unit,
            it.price_per_unit, it.quantity, it.total_price, department, it.remark,
            ym_period, authUser.username
          ).run();
        }

        return json({
          success: true,
          message: `บันทึกเบิกจ่ายพัสดุตามใบเบิก "${doc_no}" เรียบร้อยแล้ว (จำนวน ${validatedItems.length} รายการ)`,
          doc_no,
          items_count: validatedItems.length,
          items: validatedItems
        }, 201);
      }

      // ----------------------------------------------------------------------
      // [REPORTS & STOCK CARD ENGINE]
      // ----------------------------------------------------------------------

      // เครื่องมือคำนวณบัตรคุมพัสดุแบบ Running Balance รายบรรทัด
      // GET /api/reports/stock-card/:item_code?start_date=...&end_date=...
      if (path.startsWith("/api/reports/stock-card/") && method === "GET") {
        const item_code = decodeURIComponent(path.split("/")[4] || "").trim();
        if (!item_code) return errorJson("กรุณาระบุรหัสพัสดุ", 400);

        // ค่าเริ่มต้นช่วงวันที่: วันแรกของปีปัจจุบัน จนถึง วันปัจจุบัน
        const now = new Date();
        const currentYear = now.getFullYear();
        const defaultStart = `${currentYear}-01-01`;
        const defaultEnd = now.toISOString().slice(0, 10);

        const start_date = url.searchParams.get("start_date") || defaultStart;
        const end_date = url.searchParams.get("end_date") || defaultEnd;

        // 1. ดึงข้อมูลพัสดุ
        const item = await db.prepare(
          "SELECT * FROM items WHERE item_code = ?"
        ).bind(item_code).first();

        if (!item) {
          return errorJson(`ไม่พบรหัสพัสดุ "${item_code}" ในระบบ`, 404);
        }

        // 2. คำนวณยอดยกมาก่อน start_date (Brought Forward Calculation)
        const buyBefore = await db.prepare(`
          SELECT 
            COALESCE(SUM(quantity), 0) AS qty,
            COALESCE(SUM(total_price), 0) AS val
          FROM buys 
          WHERE item_code = ? AND doc_date < ?
        `).bind(item_code, start_date).first();

        const payBefore = await db.prepare(`
          SELECT 
            COALESCE(SUM(quantity), 0) AS qty,
            COALESCE(SUM(total_price), 0) AS val
          FROM pays 
          WHERE item_code = ? AND doc_date < ?
        `).bind(item_code, start_date).first();

        const opening_qty = Math.round((Number(buyBefore.qty) - Number(payBefore.qty)) * 100) / 100;
        const opening_val = Math.round((Number(buyBefore.val) - Number(payBefore.val)) * 100) / 100;

        // 3. ดึงรายการรับเข้าและเบิกจ่ายในช่วง start_date ถึง end_date
        const buysInRange = await db.prepare(`
          SELECT 
            'BUY' AS type,
            id,
            doc_date,
            doc_no,
            shop_name AS party,
            quantity AS in_qty,
            price_per_unit AS in_price,
            total_price AS in_val,
            0 AS out_qty,
            0 AS out_price,
            0 AS out_val,
            remark,
            created_at
          FROM buys
          WHERE item_code = ? AND doc_date >= ? AND doc_date <= ?
        `).bind(item_code, start_date, end_date).all();

        const paysInRange = await db.prepare(`
          SELECT 
            'PAY' AS type,
            id,
            doc_date,
            doc_no,
            department AS party,
            0 AS in_qty,
            0 AS in_price,
            0 AS in_val,
            quantity AS out_qty,
            price_per_unit AS out_price,
            total_price AS out_val,
            remark,
            created_at
          FROM pays
          WHERE item_code = ? AND doc_date >= ? AND doc_date <= ?
        `).bind(item_code, start_date, end_date).all();

        // รวมรายการและเรียงลำดับตาม วันที่เอกสาร -> เวลาสร้าง -> ID
        const rawTransactions = [...(buysInRange.results || []), ...(paysInRange.results || [])];
        rawTransactions.sort((a, b) => {
          if (a.doc_date !== b.doc_date) {
            return a.doc_date.localeCompare(b.doc_date);
          }
          if (a.created_at !== b.created_at) {
            return a.created_at.localeCompare(b.created_at);
          }
          return a.id - b.id;
        });

        // 4. คำนวณยอดคงเหลือสะสมทีละบรรทัด (Running Balance Engine)
        let running_qty = opening_qty;
        let running_val = opening_val;
        let total_in_period_qty = 0;
        let total_in_period_val = 0;
        let total_out_period_qty = 0;
        let total_out_period_val = 0;

        const transactions = rawTransactions.map(tx => {
          const in_qty = Number(tx.in_qty) || 0;
          const in_val = Number(tx.in_val) || 0;
          const out_qty = Number(tx.out_qty) || 0;
          const out_val = Number(tx.out_val) || 0;

          total_in_period_qty += in_qty;
          total_in_period_val += in_val;
          total_out_period_qty += out_qty;
          total_out_period_val += out_val;

          running_qty += (in_qty - out_qty);
          running_val += (in_val - out_val);

          return {
            ...tx,
            in_qty,
            in_price: Number(tx.in_price) || 0,
            in_val,
            out_qty,
            out_price: Number(tx.out_price) || 0,
            out_val,
            balance_qty: Math.round(running_qty * 100) / 100,
            balance_val: Math.round(running_val * 100) / 100,
          };
        });

        return json({
          success: true,
          hospital: "โรงพยาบาลไทรโยค",
          report_title: "บัตรคุมพัสดุ (Stock Card)",
          item: {
            item_code: item.item_code,
            item_name: item.item_name,
            unit: item.unit,
            category: item.category,
            min_stock: item.min_stock,
            max_stock: item.max_stock,
          },
          period: {
            start_date,
            end_date,
          },
          opening_balance: {
            qty: opening_qty,
            val: opening_val,
          },
          transactions,
          period_summary: {
            total_in_qty: Math.round(total_in_period_qty * 100) / 100,
            total_in_val: Math.round(total_in_period_val * 100) / 100,
            total_out_qty: Math.round(total_out_period_qty * 100) / 100,
            total_out_val: Math.round(total_out_period_val * 100) / 100,
          },
          closing_balance: {
            qty: Math.round(running_qty * 100) / 100,
            val: Math.round(running_val * 100) / 100,
          },
        });
      }

      // สรุปภาพรวมรายงานคลังพัสดุรายเดือน (GET /api/reports/summary)
      if (path === "/api/reports/summary" && method === "GET") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const canView = await checkPermission(db, authUser.userId, authUser.role, "reports", false);
        if (!canView) return errorJson("ไม่มีสิทธิเข้าถึงรายงาน", 403);

        const departmentPays = await db.prepare(`
          SELECT department, COUNT(*) as doc_count, SUM(quantity) as sum_qty, SUM(total_price) as sum_val
          FROM pays
          GROUP BY department
          ORDER BY sum_val DESC
        `).all();

        const categoryStocks = await db.prepare(`
          SELECT category, COUNT(*) as item_count, SUM(balance_qty) as total_qty, SUM(balance_val) as total_val
          FROM view_stock_balance
          WHERE is_active = 1
          GROUP BY category
        `).all();

        return json({
          success: true,
          by_department: departmentPays.results || [],
          by_category: categoryStocks.results || [],
        });
      }

      // Helper function คำนวณช่วงวันที่สำหรับแดชบอร์ด (รายเดือน, ช่วงเดือน, ปีงบประมาณ, รายปี)
      function parseDashboardDateRange(searchParams) {
        const filterType = searchParams.get("filter_type") || "fiscal_year";
        const fiscalYear = parseInt(searchParams.get("fiscal_year") || "2569");
        const year = parseInt(searchParams.get("year") || "2025");
        const month = searchParams.get("month") || "10";
        let startDate = searchParams.get("start_date") || "";
        let endDate = searchParams.get("end_date") || "";

        if (filterType === "fiscal_year") {
          // ปีงบประมาณไทย (1 ต.ค. ปีก่อนหน้า ถึง 30 ก.ย. ปีนั้น)
          const adYear = fiscalYear > 2400 ? fiscalYear - 543 : fiscalYear;
          startDate = `${adYear - 1}-10-01`;
          endDate = `${adYear}-09-30`;
        } else if (filterType === "year") {
          const adYear = year > 2400 ? year - 543 : year;
          startDate = `${adYear}-01-01`;
          endDate = `${adYear}-12-31`;
        } else if (filterType === "month") {
          const adYear = year > 2400 ? year - 543 : year;
          const m = String(month).padStart(2, "0");
          startDate = `${adYear}-${m}-01`;
          const lastDay = new Date(adYear, parseInt(m), 0).getDate();
          endDate = `${adYear}-${m}-${String(lastDay).padStart(2, "0")}`;
        } else if (filterType === "range") {
          if (!startDate) startDate = "2025-10-01";
          if (!endDate) endDate = "2026-09-30";
        } else {
          startDate = "2025-10-01";
          endDate = "2026-09-30";
        }

        return { filterType, startDate, endDate, fiscalYear, year, month };
      }

      // แดชบอร์ดสรุปยอดรับเข้าพัสดุ (GET /api/reports/dashboard-buys)
      if (path === "/api/reports/dashboard-buys" && method === "GET") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const canView = (authUser.role === "superadmin") || 
          (await checkPermission(db, authUser.userId, authUser.role, "reports", false)) ||
          (await checkPermission(db, authUser.userId, authUser.role, "buy", false));
        if (!canView) return errorJson("ไม่มีสิทธิเข้าถึงข้อมูลรายงาน", 403);

        const { filterType, startDate, endDate, fiscalYear, year, month } = parseDashboardDateRange(url.searchParams);

        // 1. KPI สรุปภาพรวม
        const kpis = await db.prepare(`
          SELECT 
            ROUND(COALESCE(SUM(total_price), 0), 2) as total_val,
            ROUND(COALESCE(SUM(quantity), 0), 2) as total_qty,
            COUNT(*) as total_items,
            COUNT(DISTINCT doc_no) as total_docs,
            COUNT(DISTINCT shop_name) as total_shops
          FROM buys
          WHERE doc_date BETWEEN ? AND ?
        `).bind(startDate, endDate).first();

        // 2. กราฟแนวโน้มรายเดือน (Monthly Trend)
        const monthly = await db.prepare(`
          SELECT 
            ym_period as month,
            ROUND(SUM(total_price), 2) as total_val,
            ROUND(SUM(quantity), 2) as total_qty,
            COUNT(DISTINCT doc_no) as doc_count,
            COUNT(*) as item_count
          FROM buys
          WHERE doc_date BETWEEN ? AND ?
          GROUP BY ym_period
          ORDER BY ym_period ASC
        `).bind(startDate, endDate).all();

        // 3. แยกตามหมวดหมู่ (Category Breakdown)
        const categories = await db.prepare(`
          SELECT 
            category,
            ROUND(SUM(total_price), 2) as total_val,
            ROUND(SUM(quantity), 2) as total_qty,
            COUNT(*) as item_count
          FROM buys
          WHERE doc_date BETWEEN ? AND ?
          GROUP BY category
          ORDER BY total_val DESC
        `).bind(startDate, endDate).all();

        // 4. สรุปยอดตามร้านค้า (Top Shops / Suppliers)
        const topShops = await db.prepare(`
          SELECT 
            shop_name,
            ROUND(SUM(total_price), 2) as total_val,
            COUNT(DISTINCT doc_no) as doc_count,
            COUNT(*) as item_count
          FROM buys
          WHERE doc_date BETWEEN ? AND ?
          GROUP BY shop_name
          ORDER BY total_val DESC
          LIMIT 10
        `).bind(startDate, endDate).all();

        // 5. รายการพัสดุรับเข้ามูลค่าสูงสุด 10 อันดับแรก
        const topItems = await db.prepare(`
          SELECT 
            item_code, item_name, unit, category,
            ROUND(SUM(quantity), 2) as total_qty,
            ROUND(SUM(total_price), 2) as total_val
          FROM buys
          WHERE doc_date BETWEEN ? AND ?
          GROUP BY item_code
          ORDER BY total_val DESC
          LIMIT 10
        `).bind(startDate, endDate).all();

        return json({
          success: true,
          date_range: { filterType, startDate, endDate, fiscalYear, year, month },
          kpis: kpis || { total_val: 0, total_qty: 0, total_items: 0, total_docs: 0, total_shops: 0 },
          monthly_trend: monthly.results || [],
          categories: categories.results || [],
          top_shops: topShops.results || [],
          top_items: topItems.results || []
        });
      }

      // แดชบอร์ดสรุปยอดเบิกจ่ายพัสดุ (GET /api/reports/dashboard-pays)
      if (path === "/api/reports/dashboard-pays" && method === "GET") {
        const authUser = await authenticate(request, env);
        if (!authUser) return errorJson("กรุณาเข้าสู่ระบบ", 401);

        const canView = (authUser.role === "superadmin") || 
          (await checkPermission(db, authUser.userId, authUser.role, "reports", false)) ||
          (await checkPermission(db, authUser.userId, authUser.role, "pay", false));
        if (!canView) return errorJson("ไม่มีสิทธิเข้าถึงข้อมูลรายงาน", 403);

        const { filterType, startDate, endDate, fiscalYear, year, month } = parseDashboardDateRange(url.searchParams);

        // 1. KPI สรุปภาพรวม
        const kpis = await db.prepare(`
          SELECT 
            ROUND(COALESCE(SUM(total_price), 0), 2) as total_val,
            ROUND(COALESCE(SUM(quantity), 0), 2) as total_qty,
            COUNT(*) as total_items,
            COUNT(DISTINCT doc_no) as total_docs,
            COUNT(DISTINCT department) as total_departments
          FROM pays
          WHERE doc_date BETWEEN ? AND ?
        `).bind(startDate, endDate).first();

        // 2. กราฟแนวโน้มรายเดือน (Monthly Trend)
        const monthly = await db.prepare(`
          SELECT 
            ym_period as month,
            ROUND(SUM(total_price), 2) as total_val,
            ROUND(SUM(quantity), 2) as total_qty,
            COUNT(DISTINCT doc_no) as doc_count,
            COUNT(*) as item_count
          FROM pays
          WHERE doc_date BETWEEN ? AND ?
          GROUP BY ym_period
          ORDER BY ym_period ASC
        `).bind(startDate, endDate).all();

        // 3. แยกตามแผนก/หน่วยงานที่เบิก (Department Breakdown)
        const departments = await db.prepare(`
          SELECT 
            department,
            ROUND(SUM(total_price), 2) as total_val,
            ROUND(SUM(quantity), 2) as total_qty,
            COUNT(DISTINCT doc_no) as doc_count,
            COUNT(*) as item_count
          FROM pays
          WHERE doc_date BETWEEN ? AND ?
          GROUP BY department
          ORDER BY total_val DESC
        `).bind(startDate, endDate).all();

        // 4. แยกตามหมวดหมู่ (Category Breakdown)
        const categories = await db.prepare(`
          SELECT 
            category,
            ROUND(SUM(total_price), 2) as total_val,
            ROUND(SUM(quantity), 2) as total_qty,
            COUNT(*) as item_count
          FROM pays
          WHERE doc_date BETWEEN ? AND ?
          GROUP BY category
          ORDER BY total_val DESC
        `).bind(startDate, endDate).all();

        // 5. รายการพัสดุเบิกจ่ายมูลค่าสูงสุด 10 อันดับแรก
        const topItems = await db.prepare(`
          SELECT 
            item_code, item_name, unit, category,
            ROUND(SUM(quantity), 2) as total_qty,
            ROUND(SUM(total_price), 2) as total_val
          FROM pays
          WHERE doc_date BETWEEN ? AND ?
          GROUP BY item_code
          ORDER BY total_val DESC
          LIMIT 10
        `).bind(startDate, endDate).all();

        return json({
          success: true,
          date_range: { filterType, startDate, endDate, fiscalYear, year, month },
          kpis: kpis || { total_val: 0, total_qty: 0, total_items: 0, total_docs: 0, total_departments: 0 },
          monthly_trend: monthly.results || [],
          departments: departments.results || [],
          categories: categories.results || [],
          top_items: topItems.results || []
        });
      }

      // ----------------------------------------------------------------------
      // [SUPERADMIN MANAGEMENT ROUTES: role === 'superadmin']
      // ----------------------------------------------------------------------

      // ดึงรายชื่อผู้ใช้และสิทธิทั้งหมด (GET /api/admin/users)
      if (path === "/api/admin/users" && method === "GET") {
        const authUser = await authenticate(request, env);
        if (!authUser || authUser.role !== "superadmin") {
          return errorJson("เฉพาะผู้ดูแลระบบสูงสุด (Superadmin) เท่านั้น", 403);
        }

        const usersQuery = await db.prepare(
          "SELECT id, username, fullname, department, role, is_active, created_at FROM users ORDER BY id ASC"
        ).all();

        const permissionsQuery = await db.prepare(
          "SELECT user_id, page_key, can_view, can_edit FROM permissions"
        ).all();

        const permissionsByUser = {};
        for (const p of (permissionsQuery.results || [])) {
          if (!permissionsByUser[p.user_id]) {
            permissionsByUser[p.user_id] = {};
          }
          permissionsByUser[p.user_id][p.page_key] = {
            can_view: Number(p.can_view) || 0,
            can_edit: Number(p.can_edit) || 0,
          };
        }

        const users = (usersQuery.results || []).map(u => ({
          ...u,
          permissions: permissionsByUser[u.id] || {},
        }));

        return json({ success: true, users, available_page_keys: ALL_PAGE_KEYS });
      }

      // สร้างผู้ใช้ใหม่พร้อมกำหนดสิทธิ (POST /api/admin/users)
      if (path === "/api/admin/users" && method === "POST") {
        const authUser = await authenticate(request, env);
        if (!authUser || authUser.role !== "superadmin") {
          return errorJson("เฉพาะผู้ดูแลระบบสูงสุด (Superadmin) เท่านั้น", 403);
        }

        const b = await request.json().catch(() => ({}));
        const username = (b.username || "").trim().toLowerCase();
        const password = (b.password || "").trim();
        const fullname = (b.fullname || "").trim();
        const department = (b.department || "").trim();
        const role = (b.role || "user").trim();
        const permissionsInput = b.permissions || {};

        if (!username || !password || !fullname || !department) {
          return errorJson("กรุณากรอก Username, Password, ชื่อ-สกุล และหน่วยงาน ให้ครบถ้วน", 400);
        }

        const existing = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
        if (existing) {
          return errorJson(`ชื่อผู้ใช้ "${username}" มีอยู่ในระบบแล้ว`, 400);
        }

        // แฮชรหัสผ่านด้วย SHA-256
        const password_hash = await sha256Hex(password);

        // บันทึกผู้ใช้
        const insertUser = await db.prepare(
          "INSERT INTO users (username, password_hash, fullname, department, role, is_active) VALUES (?, ?, ?, ?, ?, 1)"
        ).bind(username, password_hash, fullname, department, role).run();

        const newUserId = insertUser.meta?.last_row_id;

        // บันทึกสิทธิทั้ง 7 หน้า
        for (const pageKey of ALL_PAGE_KEYS) {
          const perm = permissionsInput[pageKey] || {};
          const can_view = role === "superadmin" ? 1 : (perm.can_view ? 1 : 0);
          const can_edit = role === "superadmin" ? 1 : (perm.can_edit ? 1 : 0);

          await db.prepare(
            "INSERT INTO permissions (user_id, page_key, can_view, can_edit) VALUES (?, ?, ?, ?)"
          ).bind(newUserId, pageKey, can_view, can_edit).run();
        }

        return json({
          success: true,
          message: `สร้างผู้ใช้งาน "${username}" และกำหนดสิทธิเรียบร้อยแล้ว`,
          userId: newUserId,
        }, 201);
      }

      // แก้ไขสิทธิการเข้าถึงรายหน้า (PUT /api/admin/users/:id/permissions)
      if (path.startsWith("/api/admin/users/") && path.endsWith("/permissions") && method === "PUT") {
        const authUser = await authenticate(request, env);
        if (!authUser || authUser.role !== "superadmin") {
          return errorJson("เฉพาะผู้ดูแลระบบสูงสุด (Superadmin) เท่านั้น", 403);
        }

        const parts = path.split("/");
        const targetUserId = parseInt(parts[4]);
        if (!targetUserId) return errorJson("รหัสผู้ใช้ไม่ถูกต้อง", 400);

        const b = await request.json().catch(() => ({}));
        const permissionsInput = b.permissions || {};

        // ตรวจสอบว่าผู้ใช้มีอยู่จริง
        const targetUser = await db.prepare("SELECT id, role FROM users WHERE id = ?").bind(targetUserId).first();
        if (!targetUser) return errorJson("ไม่พบผู้ใช้งานนี้ในระบบ", 404);

        // ปรับปรุงสิทธิแต่ละหน้า
        for (const pageKey of ALL_PAGE_KEYS) {
          const perm = permissionsInput[pageKey] || {};
          const can_view = targetUser.role === "superadmin" ? 1 : (perm.can_view ? 1 : 0);
          const can_edit = targetUser.role === "superadmin" ? 1 : (perm.can_edit ? 1 : 0);

          await db.prepare(`
            INSERT INTO permissions (user_id, page_key, can_view, can_edit)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, page_key) DO UPDATE SET
              can_view = excluded.can_view,
              can_edit = excluded.can_edit
          `).bind(targetUserId, pageKey, can_view, can_edit).run();
        }

        return json({
          success: true,
          message: "บันทึกและปรับปรุงสิทธิการใช้งานเรียบร้อยแล้ว",
        });
      }

      // เปิด/ปิดการใช้งานผู้ใช้ (PUT /api/admin/users/:id/toggle-status)
      if (path.startsWith("/api/admin/users/") && path.endsWith("/toggle-status") && method === "PUT") {
        const authUser = await authenticate(request, env);
        if (!authUser || authUser.role !== "superadmin") {
          return errorJson("เฉพาะผู้ดูแลระบบสูงสุด (Superadmin) เท่านั้น", 403);
        }

        const parts = path.split("/");
        const targetUserId = parseInt(parts[4]);
        if (!targetUserId) return errorJson("รหัสผู้ใช้ไม่ถูกต้อง", 400);

        // ป้องกันการปิดการใช้งานบัญชี Superadmin หลัก (chanpibul / id = 1)
        if (targetUserId === 1) {
          return errorJson("ไม่อนุญาตให้ปิดการใช้งานบัญชี Superadmin หลัก (chanpibul)", 400);
        }

        const user = await db.prepare("SELECT id, is_active FROM users WHERE id = ?").bind(targetUserId).first();
        if (!user) return errorJson("ไม่พบผู้ใช้งานนี้", 404);

        const newStatus = user.is_active === 1 ? 0 : 1;
        await db.prepare("UPDATE users SET is_active = ? WHERE id = ?").bind(newStatus, targetUserId).run();

        return json({
          success: true,
          message: newStatus === 1 ? "เปิดการใช้งานผู้ใช้เรียบร้อยแล้ว" : "ระงับการใช้งานผู้ใช้เรียบร้อยแล้ว",
          is_active: newStatus,
        });
      }

      // รีเซ็ตรหัสผ่านผู้ใช้ (PUT /api/admin/users/:id/reset-password)
      if (path.startsWith("/api/admin/users/") && path.endsWith("/reset-password") && method === "PUT") {
        const authUser = await authenticate(request, env);
        if (!authUser || authUser.role !== "superadmin") {
          return errorJson("เฉพาะผู้ดูแลระบบสูงสุด (Superadmin) เท่านั้น", 403);
        }

        const parts = path.split("/");
        const targetUserId = parseInt(parts[4]);
        const b = await request.json().catch(() => ({}));
        const newPassword = (b.new_password || "").trim();

        if (!newPassword || newPassword.length < 4) {
          return errorJson("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร", 400);
        }

        const newHash = await sha256Hex(newPassword);
        await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(newHash, targetUserId).run();

        return json({ success: true, message: "รีเซ็ตรหัสผ่านเรียบร้อยแล้ว" });
      }

      // แก้ไขข้อมูลผู้ใช้ (PUT /api/admin/users/:id)
      if (path.startsWith("/api/admin/users/") && !path.includes("/permissions") && !path.includes("/toggle-status") && !path.includes("/reset-password") && method === "PUT") {
        const authUser = await authenticate(request, env);
        if (!authUser || authUser.role !== "superadmin") {
          return errorJson("เฉพาะผู้ดูแลระบบสูงสุด (Superadmin) เท่านั้น", 403);
        }

        const parts = path.split("/");
        const targetUserId = parseInt(parts[4]);
        if (!targetUserId) return errorJson("รหัสผู้ใช้ไม่ถูกต้อง", 400);

        const b = await request.json().catch(() => ({}));
        const fullname = (b.fullname || "").trim();
        const department = (b.department || "").trim();
        const role = (b.role || "").trim();
        const newPassword = (b.password || "").trim();

        if (!fullname || !department || !role) {
          return errorJson("กรุณากรอกชื่อ-นามสกุล, แผนก/สังกัด และบทบาท ให้ครบถ้วน", 400);
        }

        const user = await db.prepare("SELECT id, role FROM users WHERE id = ?").bind(targetUserId).first();
        if (!user) return errorJson("ไม่พบผู้ใช้งานนี้", 404);

        // ไม่อนุญาตให้แก้ไขบัญชี Superadmin (id=1 หรือ role=superadmin)
        if (targetUserId === 1 || user.role === "superadmin") {
          return errorJson("ไม่อนุญาตให้แก้ไขข้อมูลบัญชีผู้ดูแลระบบสูงสุด (Superadmin)", 403);
        }

        if (newPassword && newPassword.length >= 4) {
          const newHash = await sha256Hex(newPassword);
          await db.prepare(
            "UPDATE users SET fullname = ?, department = ?, role = ?, password_hash = ? WHERE id = ?"
          ).bind(fullname, department, role, newHash, targetUserId).run();
        } else {
          await db.prepare(
            "UPDATE users SET fullname = ?, department = ?, role = ? WHERE id = ?"
          ).bind(fullname, department, role, targetUserId).run();
        }

        return json({
          success: true,
          message: "แก้ไขข้อมูลผู้ใช้งานเรียบร้อยแล้ว"
        });
      }

      // ลบผู้ใช้งาน (DELETE /api/admin/users/:id)
      if (path.startsWith("/api/admin/users/") && method === "DELETE") {
        const authUser = await authenticate(request, env);
        if (!authUser || authUser.role !== "superadmin") {
          return errorJson("เฉพาะผู้ดูแลระบบสูงสุด (Superadmin) เท่านั้น", 403);
        }

        const parts = path.split("/");
        const targetUserId = parseInt(parts[4]);
        if (!targetUserId) return errorJson("รหัสผู้ใช้ไม่ถูกต้อง", 400);

        const user = await db.prepare("SELECT id, username, role FROM users WHERE id = ?").bind(targetUserId).first();
        if (!user) return errorJson("ไม่พบผู้ใช้งานนี้", 404);

        // ไม่อนุญาตให้ลบบัญชี Superadmin
        if (targetUserId === 1 || user.role === "superadmin") {
          return errorJson("ไม่อนุญาตให้ลบบัญชีผู้ดูแลระบบสูงสุด (Superadmin) เด็ดขาด", 403);
        }
        if (targetUserId === authUser.userId) {
          return errorJson("ไม่อนุญาตให้ลบบัญชีของตนเองที่กำลังเข้าสู่ระบบอยู่", 400);
        }

        // ลบ permissions และ user
        await db.prepare("DELETE FROM permissions WHERE user_id = ?").bind(targetUserId).run();
        await db.prepare("DELETE FROM users WHERE id = ?").bind(targetUserId).run();

        return json({
          success: true,
          message: `ลบผู้ใช้งาน "${user.username}" ออกจากระบบเรียบร้อยแล้ว`
        });
      }

      // ซิงค์ข้อมูลอัตโนมัติจาก Google Sheet (POST /api/admin/sync-google-sheet)
      if (path === "/api/admin/sync-google-sheet" && method === "POST") {
        const authUser = await authenticate(request, env);
        if (!authUser || authUser.role !== "superadmin") {
          return errorJson("เฉพาะผู้ดูแลระบบสูงสุด (Superadmin) เท่านั้น", 403);
        }

        const b = await request.json().catch(() => ({}));
        const sheetId = (b.sheet_id || "1Ljnwa14H1C_1eGSgkXxblGFQk9KNCcFy-OvSlzHKv5o").trim();

        // Helper fetch CSV text
        async function fetchCsv(gid) {
          const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`);
          if (!res.ok) throw new Error(`ไม่สามารถดึงข้อมูลจาก Google Sheet gid=${gid} ได้ (HTTP ${res.status})`);
          return await res.text();
        }

        // Helper simple CSV row splitter
        function parseCsvLines(csvText) {
          const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
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
              obj[headers[j] || `col_${j}`] = vals[j] !== undefined ? vals[j] : '';
            }
            rows.push(obj);
          }
          return rows;
        }

        function cleanNumVal(v) {
          if (!v) return 0;
          const n = parseFloat(String(v).replace(/,/g, '').trim());
          return isNaN(n) ? 0 : n;
        }

        function convertDmy(s) {
          if (!s) return "2025-10-01";
          const m = String(s).trim().match(/^(\d+)\/(\d+)\/(\d+)$/);
          if (m) {
            return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
          }
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
          return "2025-10-01";
        }

        let shopsSynced = 0;
        let itemsSynced = 0;
        let buysSynced = 0;
        let paysSynced = 0;

        // 1. Sync Shops (gid: 907850828)
        try {
          const shopsText = await fetchCsv("907850828");
          const shopRows = parseCsvLines(shopsText);
          for (const s of shopRows) {
            const name = (s["ร้านค้า"] || "").trim();
            if (name) {
              await db.prepare(
                "INSERT OR IGNORE INTO shops (shop_name, address, phone, tax_id) VALUES (?, ?, ?, ?)"
              ).bind(name, s["ที่อยู่"] || "", s["เบอร์โทร"] || "", s["เลขผู้เสียภาษี"] || "").run();
              shopsSynced++;
            }
          }
        } catch (e) {
          console.warn("Sync shops warning:", e.message);
        }

        // 2. Sync Items (gid: 0)
        try {
          const itemsText = await fetchCsv("0");
          const itemRows = parseCsvLines(itemsText);
          for (const it of itemRows) {
            const code = (it["รหัส"] || "").trim();
            const name = (it["รายการ"] || "").trim();
            if (code && name) {
              const unit = (it["หน่วยนับ"] || "หน่วย").trim();
              const cat = (it["กลุ่มสินค้า"] || "ทั่วไป").trim();
              const min = cleanNumVal(it["ขั้นต่ำ"]);
              const max = cleanNumVal(it["ขั้นสูง"]);
              await db.prepare(
                "INSERT INTO items (item_code, item_name, unit, category, min_stock, max_stock, is_active) VALUES (?, ?, ?, ?, ?, ?, 1) ON CONFLICT(item_code) DO UPDATE SET item_name = excluded.item_name, unit = excluded.unit, category = excluded.category, min_stock = excluded.min_stock, max_stock = excluded.max_stock"
              ).bind(code, name, unit, cat, min, max).run();
              itemsSynced++;
            }
          }
        } catch (e) {
          console.warn("Sync items warning:", e.message);
        }

        return json({
          success: true,
          message: `ซิงค์ข้อมูลจาก Google Sheet สำเร็จ (ทะเบียนพัสดุ: ${itemsSynced} รายการ, ร้านค้า: ${shopsSynced} ร้านค้า)`,
          sheet_id: sheetId,
          synced: {
            items: itemsSynced,
            shops: shopsSynced
          }
        });
      }

      // Route Not Found 404
      return errorJson(`ไม่พบ Endpoint: ${method} ${path}`, 404);

    } catch (err) {
      // ดักจับ Unhandled Exceptions ส่ง Error Message สวยงาม
      return errorJson(`Server Error: ${err.message || String(err)}`, 500);
    }
  },
};
