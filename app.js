/* =========================================================
   เว็บทีมตัวแทนประกันชีวิต — app.js
   - ไม่ต้องติดตั้งอะไร ใช้คู่กับ index.html บน GitHub Pages
   - ถ้ายังไม่ใส่ SHEET_API_URL ระบบจะใช้ "ข้อมูลตัวอย่าง" (DEMO)
   - ใส่ URL ของ Google Apps Script (ไฟล์ Code.gs) เพื่อดึงข้อมูลจริงจาก Google Sheet
   ========================================================= */

const REQUIRED_API = "2026-10-03c"; // ต้องตรงกับ CODE_VERSION ใน Code.gs
const CONFIG = {
  SHEET_API_URL: "https://script.google.com/macros/s/AKfycbwqXRavOOeke86CwMWUyUBK9q3WhgaAIXKyTL8UstXb1mTyE0m30wz3ACYMlBBMshmv/exec",            // วาง URL Web App ของ Apps Script ที่นี่ เช่น https://script.google.com/macros/s/xxxx/exec
  TEAM_NAME: "ทีมที่ปรึกษาดูแลดี",
  TEAM_SUBTITLE: "ตัวแทนประกันชีวิต FWD",
  TEAM_LINE_OA: "https://line.me/R/ti/p/@yourteam",   // LINE OA ของทีม
  TEAM_PHONE: "080-000-0000",
  // ช่องทางชำระเบี้ย: ใส่เฉพาะช่องทางทางการของบริษัท และตรวจสอบลิงก์ให้ถูกต้องก่อนเปิดใช้
  PAYMENT_CHANNELS: [
    { name: "แอปหรือเว็บไซต์ทางการของบริษัทประกัน", detail: "ชำระด้วยบัตรเครดิต/เดบิต หรือ QR", url: "#" },
    { name: "หักบัญชีธนาคารหรือบัตรเครดิตอัตโนมัติ", detail: "แจ้งตัวแทนเพื่อขอแบบฟอร์มสมัคร", url: "" },
    { name: "เคาน์เตอร์ธนาคารหรือเคาน์เตอร์เซอร์วิส", detail: "ใช้ใบแจ้งชำระเบี้ยที่มีบาร์โค้ด", url: "" }
  ],
  REMIND_DAYS: 30               // แสดงรายการเบี้ยที่ครบกำหนดภายในกี่วัน
};

/* ---------- utilities ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const baht = (n) => Number(n || 0).toLocaleString("th-TH") + " บาท";
/* มาตรฐานการแสดงวันที่ของทั้งเว็บ: เดือนภาษาไทย ปี พ.ศ.
   ข้อมูลใน Google Sheet เก็บเป็น ค.ศ. (yyyy-mm-dd) แล้วแปลงตอนแสดงผลเท่านั้น
   หน้าเว็บหรือรายงานใหม่ ให้ใช้ thDate (แบบย่อ: 11 ต.ค. 2569) หรือ thDateLong (แบบเต็ม: 11 ตุลาคม 2569) เสมอ */
const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MONTHS_LONG = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const parseDate = (d) => { // อ่าน yyyy-mm-dd เป็นวันที่ท้องถิ่น ไม่ให้เลื่อนวันตามเขตเวลา
  const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
};
const thDateFmt = (d, months) => { if (!d) return "-"; const x = parseDate(d); if (isNaN(x)) return "-"; return `${x.getDate()} ${months[x.getMonth()]} ${x.getFullYear() + 543}`; };
const thDate = (d) => thDateFmt(d, TH_MONTHS_SHORT);
const thDateLong = (d) => thDateFmt(d, TH_MONTHS_LONG);
const thMonthYear = (d) => { const x = parseDate(d); return isNaN(x) ? "-" : `${TH_MONTHS_LONG[x.getMonth()]} ${x.getFullYear() + 543}`; };
const daysUntil = (d) => Math.round((parseDate(d).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
const isoIn = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const initials = (name) => (String(name || "?").replace(/^(คุณ|นาย|นาง|นางสาว)\s*/, "").trim()[0] || "?");
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
/* การล็อกอินเก็บใน sessionStorage: ปิดแท็บ/ปิดเบราว์เซอร์/ปิดแอป แล้วเปิดใหม่ = ต้องเข้าสู่ระบบใหม่เสมอ
   (รีเฟรชหน้าเดิมยังอยู่ในระบบ) */
const sessionStore = {
  get() { try { return JSON.parse(sessionStorage.getItem("session")); } catch { return null; } },
  set(v) { try { sessionStorage.setItem("session", JSON.stringify(v)); } catch {} },
  del() { try { sessionStorage.removeItem("session"); sessionStorage.removeItem("lastActive"); } catch {} }
};
try { localStorage.removeItem("session"); } catch {} // ล้างการล็อกอินแบบเก่าที่เคยจำไว้ถาวรในเครื่อง
function toast(msg, ms = 2600) {
  document.querySelectorAll(".toast").forEach(x => x.remove()); // แสดงทีละข้อความ
  const t = document.createElement("div");
  t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
function avatar(p, size = "") {
  const src = p && p.photo_url;
  return `<span class="ava ${size}">${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : esc(initials(p && p.name))}</span>`;
}
function statusBadge(s) {
  const map = {
    "มีผลบังคับ": "b-ok", "พร้อมดูแล": "b-ok", "ผ่าน": "b-ok", "ชำระแล้ว": "b-ok", "อนุมัติ": "b-ok", "ตอบแล้ว": "b-ok", "ปิดเรื่อง": "b-ok",
    "รอชำระ": "b-warn", "รออนุมัติ": "b-warn", "ยกเลิก": "b-bad", "รอพิจารณา": "b-warn", "รอเอกสาร": "b-warn", "รอตอบ": "b-warn", "ลูกค้ามุ่งหวัง": "b-info",
    "ขาดอายุ": "b-bad", "ไม่อนุมัติ": "b-bad", "เลยกำหนด": "b-bad"
  };
  return `<span class="badge ${map[s] || "b-info"}">${esc(s)}</span>`;
}
async function sha256(text) {
  if (!window.crypto || !crypto.subtle) return text; // เบราว์เซอร์เก่า (GitHub Pages เป็น https จึงใช้ได้)
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
/* ตำแหน่ง: หัวหน้าทีม และ Admin (ผู้ดูแลเว็บ) จัดการทีมได้เหมือนกัน
   Admin ไม่แสดงบนหน้าเว็บสาธารณะ และไม่มีมุมมอง "งานขายของฉัน" */
const ROLES = ["ตัวแทน", "ตัวแทนอาวุโส", "หัวหน้าทีม", "Admin"];
const isManager = (role) => role === "หัวหน้าทีม" || role === "Admin";
const isAdmin = (role) => role === "Admin";
const roleLabel = (role) => isAdmin(role) ? "Admin (ผู้ดูแลเว็บ)" : (role || "");
const publicAgents = (list) => (list || []).filter(a => !isAdmin(a.role));
/* ข้อมูลลูกค้าและกรมธรรม์ */
const GENDERS = ["ชาย", "หญิง", "ไม่ระบุ"];
const MODES = ["รายเดือน", "ราย 3 เดือน", "ราย 6 เดือน", "รายปี"];
const MODE_MONTHS = { "รายเดือน": 1, "ราย 3 เดือน": 3, "ราย 6 เดือน": 6, "รายปี": 12 };
const POLICY_STATUS = ["รออนุมัติ", "มีผลบังคับ", "รอชำระ", "ขาดอายุ", "ยกเลิก"];
const CLAIM_TYPES = ["ผู้ป่วยใน", "ผู้ป่วยนอก", "อุบัติเหตุ", "โรคร้ายแรง", "เสียชีวิต", "อื่นๆ"];
const CLAIM_STATUS = ["รอเอกสาร", "รอพิจารณา", "อนุมัติ", "ไม่อนุมัติ"];
const PAY_CHANNELS = ["แอปหรือเว็บไซต์บริษัท", "หักบัญชีอัตโนมัติ", "บัตรเครดิต", "เคาน์เตอร์ธนาคาร/เซอร์วิส", "อื่นๆ"];
const annualPremium = (p) => Number(p.premium || 0) * (12 / (MODE_MONTHS[p.mode] || 12));
const ageFrom = (b) => {
  if (!b) return null; const d = new Date(b); if (isNaN(d)) return null;
  const n = new Date(); let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
};
const addMonths = (iso, m) => { // บวกเดือนแบบไม่ล้นวันสิ้นเดือน เช่น 31 ม.ค. + 1 เดือน = 28/29 ก.พ.
  let [y, mo, d] = String(iso).slice(0, 10).split("-").map(Number); if (!y) return "";
  mo += m; y += Math.floor((mo - 1) / 12); mo = ((mo - 1) % 12 + 12) % 12 + 1;
  d = Math.min(d, new Date(Date.UTC(y, mo, 0)).getUTCDate());
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
const options = (list, cur, blank) => (blank ? `<option value="">${blank}</option>` : "") + list.map(v => `<option ${v === cur ? "selected" : ""}>${esc(v)}</option>`).join("");
/* ช่องเลือกวันที่แบบไทย: วัน / เดือน / ปี พ.ศ.
   แสดงเป็น พ.ศ. แต่เก็บค่าเป็น ค.ศ. (yyyy-mm-dd) ในช่องซ่อน id เดิม โค้ดส่วนอื่นจึงอ่านค่าได้เหมือนเดิม */
const TH_MONTHS = TH_MONTHS_LONG;
function thaiDate(id, iso, { back = 100, ahead = 0, extra = "" } = {}) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  const nowBE = new Date().getFullYear() + 543;
  const years = []; for (let v = nowBE + ahead; v >= nowBE - back; v--) years.push(v);
  if (y && !years.includes(y + 543)) years.push(y + 543);
  const opt = (v, label, cur) => `<option value="${v}" ${v === cur ? "selected" : ""}>${label}</option>`;
  return `<span class="thd" data-thd="${id}">
    <select data-p="d" aria-label="วันที่"><option value="">วัน</option>${Array.from({ length: 31 }, (_, i) => opt(i + 1, i + 1, d)).join("")}</select>
    <select data-p="m" aria-label="เดือน"><option value="">เดือน</option>${TH_MONTHS.map((n, i) => opt(i + 1, n, m)).join("")}</select>
    <select data-p="y" aria-label="ปี พ.ศ."><option value="">ปี พ.ศ.</option>${years.map(v => opt(v, v, y ? y + 543 : 0)).join("")}</select>
    <input type="hidden" id="${id}" value="${esc(iso || "")}" ${extra}>
  </span>`;
}
function thaiDateSet(id, iso) { // ตั้งค่าจากโค้ด (เช่น เติมวันครบกำหนดอัตโนมัติ)
  const box = document.querySelector(`[data-thd="${id}"]`); if (!box) return;
  const [y, m, d] = String(iso || "").split("-").map(Number);
  const yrSel = box.querySelector('[data-p="y"]');
  if (y && !yrSel.querySelector(`option[value="${y + 543}"]`)) yrSel.insertAdjacentHTML("beforeend", `<option value="${y + 543}">${y + 543}</option>`);
  box.querySelector('[data-p="d"]').value = d || ""; box.querySelector('[data-p="m"]').value = m || ""; yrSel.value = y ? y + 543 : "";
  box.querySelector("input").value = iso || "";
}
document.addEventListener("change", (e) => {
  const box = e.target.closest && e.target.closest("[data-thd]"); if (!box || e.target.tagName !== "SELECT") return;
  const get = (p) => Number(box.querySelector(`[data-p="${p}"]`).value || 0);
  let d = get("d"); const m = get("m"), yBE = get("y");
  const hidden = box.querySelector("input");
  if (d && m && yBE) {
    const y = yBE - 543, last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d > last) { d = last; box.querySelector('[data-p="d"]').value = d; } // เช่น 31 ก.พ. ปรับเป็น 28/29
    hidden.value = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  } else hidden.value = "";
  hidden.dispatchEvent(new Event("input")); hidden.dispatchEvent(new Event("change"));
});
const lineShare = (text) => "https://line.me/R/msg/text/?" + encodeURIComponent(text);

/* =========================================================
   DEMO DATA — โครงสร้างเดียวกับแต่ละชีตใน Google Sheet
   ========================================================= */
const DEMO = {
  agents: [
    { id: "A01", name: "สมศักดิ์ ใจดี", role: "หัวหน้าทีม", license_no: "6201xxxxxx", years: 12, phone: "081-111-1111", line_url: "https://line.me/R/ti/p/~somsak", photo_url: "", backup_id: "A02", on_duty: true,
      bio: "ดูแลลูกค้ามากว่า 12 ปี เน้นวางแผนคุ้มครองครอบครัวและวางแผนเกษียณ ทุกเคสที่เคลมผมติดตามเองจนจบ",
      specialties: ["วางแผนครอบครัว", "เกษียณ", "ประกันสุขภาพ"], password: "agent123" },
    { id: "A02", name: "วรรณา รักษ์ลูกค้า", role: "ตัวแทนอาวุโส", license_no: "6302xxxxxx", years: 8, phone: "082-222-2222", line_url: "https://line.me/R/ti/p/~wanna", photo_url: "", backup_id: "A03", on_duty: true,
      bio: "ถนัดเรื่องประกันสุขภาพและการเคลมค่ารักษา ช่วยเตรียมเอกสารให้ครบตั้งแต่ครั้งแรก", specialties: ["เคลมสุขภาพ", "ประกันโรคร้ายแรง"], password: "agent123" },
    { id: "A03", name: "ธนพล มั่นคง", role: "ตัวแทน", license_no: "6503xxxxxx", years: 4, phone: "083-333-3333", line_url: "https://line.me/R/ti/p/~thanapon", photo_url: "", backup_id: "A02", on_duty: false,
      bio: "ดูแลกลุ่มคนทำงานรุ่นใหม่ วางแผนลดหย่อนภาษีและออมเงินระยะยาว", specialties: ["ลดหย่อนภาษี", "ออมทรัพย์"], password: "agent123" },
    { id: "A04", name: "พิมพ์ชนก แสงทอง", role: "ตัวแทน", license_no: "6604xxxxxx", years: 3, phone: "084-444-4444", line_url: "https://line.me/R/ti/p/~pim", photo_url: "", backup_id: "A01", on_duty: true,
      bio: "ดูแลครอบครัวที่มีลูกเล็ก ประกันสุขภาพเด็กและทุนการศึกษา", specialties: ["ประกันเด็ก", "ทุนการศึกษา"], password: "agent123" },
    { id: "ADMIN", name: "ผู้ดูแลเว็บ", role: "Admin", license_no: "", years: 0, phone: "", line_url: "", photo_url: "", backup_id: "", on_duty: false,
      bio: "", specialties: [], password: "agent123" }
  ],
  customers: [
    { id: "C001", name: "คุณมานี มีสุข", phone: "0890000001", type: "ลูกค้า", agent_id: "A02", line_group_url: "https://line.me/R/ti/g/xxxx", birthday: "1985-03-12", gender: "หญิง", occupation: "พนักงานบริษัท", monthly_income: 45000, photo_url: "", note: "ชอบให้ติดต่อทาง LINE", password: "1234" },
    { id: "C002", name: "คุณปิติ รุ่งเรือง", phone: "0890000002", type: "ลูกค้า", agent_id: "A02", line_group_url: "", birthday: "1979-11-02", photo_url: "", note: "", password: "1234" },
    { id: "C003", name: "คุณชูใจ สดใส", phone: "0890000003", type: "ลูกค้า", agent_id: "A03", line_group_url: "", birthday: "1992-07-21", photo_url: "", note: "สนใจเพิ่มประกันสุขภาพ", password: "1234" },
    { id: "C004", name: "คุณวีระ กล้าหาญ", phone: "0890000004", type: "ลูกค้ามุ่งหวัง", agent_id: "A03", line_group_url: "", birthday: "1978-06-05", gender: "ชาย", occupation: "เจ้าของกิจการ", monthly_income: 80000, photo_url: "", note: "นัดคุยแผนเกษียณสัปดาห์หน้า", password: "" },
    { id: "C005", name: "คุณดวงใจ อิ่มเอม", phone: "0890000005", type: "ลูกค้ามุ่งหวัง", agent_id: "A04", line_group_url: "", birthday: "", photo_url: "", note: "มีลูก 2 คน สนใจประกันเด็ก", password: "" },
    { id: "C006", name: "คุณสมชาย ทองดี", phone: "0890000006", type: "ลูกค้า", agent_id: "A01", line_group_url: "", birthday: "1970-01-30", photo_url: "", note: "", password: "1234" }
  ],
  policies: [
    { policy_no: "P-10001", customer_id: "C001", plan: "ประกันสุขภาพเหมาจ่าย", sum_assured: 5000000, premium: 28500, mode: "รายปี", start_date: "2022-05-01", next_due: isoIn(9), status: "มีผลบังคับ", payment_years: 99, coverage_end: "2084-05-01", beneficiary: "นายมานะ มีสุข (สามี)", riders: "ค่ารักษาผู้ป่วยนอก", sold_by: "A02", note: "" },
    { policy_no: "P-10002", customer_id: "C001", plan: "ประกันชีวิตสะสมทรัพย์ 15 ปี", sum_assured: 1000000, premium: 6200, mode: "รายเดือน", start_date: "2023-01-15", next_due: isoIn(21), status: "มีผลบังคับ" },
    { policy_no: "P-10003", customer_id: "C002", plan: "ประกันโรคร้ายแรง", sum_assured: 2000000, premium: 15400, mode: "รายปี", start_date: "2021-08-10", next_due: isoIn(-3), status: "รอชำระ" },
    { policy_no: "P-10004", customer_id: "C003", plan: "ประกันชีวิตลดหย่อนภาษี", sum_assured: 800000, premium: 32000, mode: "รายปี", start_date: "2024-02-01", next_due: isoIn(120), status: "มีผลบังคับ" },
    { policy_no: "P-10005", customer_id: "C006", plan: "ประกันบำนาญ", sum_assured: 1500000, premium: 60000, mode: "รายปี", start_date: "2019-06-20", next_due: isoIn(14), status: "มีผลบังคับ" }
  ],
  payments: [
    { id: "PM1", policy_no: "P-10001", date: "2025-10-05", amount: 28500, channel: "บัตรเครดิต", status: "ชำระแล้ว" },
    { id: "PM2", policy_no: "P-10002", date: isoIn(-9), amount: 6200, channel: "หักบัญชีอัตโนมัติ", status: "ชำระแล้ว" },
    { id: "PM3", policy_no: "P-10002", date: isoIn(-39), amount: 6200, channel: "หักบัญชีอัตโนมัติ", status: "ชำระแล้ว" }
  ],
  claims: [
    { id: "CL1", policy_no: "P-10001", date: isoIn(-40), type: "ผู้ป่วยใน", amount: 42300, status: "อนุมัติ", note: "โอนเข้าบัญชีแล้ว" },
    { id: "CL2", policy_no: "P-10001", date: isoIn(-4), type: "ผู้ป่วยนอก", amount: 3200, status: "รอเอกสาร", note: "ขอใบรับรองแพทย์ฉบับจริง" }
  ],
  tickets: [
    { id: "T1", customer_id: "C001", agent_id: "A02", created: isoIn(-1), topic: "เคลม", message: "ส่งใบรับรองแพทย์ทางไหนได้บ้างคะ", status: "รอตอบ" },
    { id: "T2", customer_id: "C003", agent_id: "A03", created: isoIn(-6), topic: "ข้อมูลกรมธรรม์", message: "ขอหนังสือรับรองการชำระเบี้ยเพื่อลดหย่อนภาษี", status: "ตอบแล้ว" }
  ],
  posts: [
    { id: "b1", date: isoIn(-5), category: "ภาษี", title: "ใช้เบี้ยประกันลดหย่อนภาษีได้เท่าไหร่ เช็กก่อนสิ้นปี",
      summary: "สรุปเงื่อนไขการใช้เบี้ยประกันชีวิต ประกันสุขภาพ และประกันบำนาญลดหย่อนภาษี พร้อมเอกสารที่ต้องเตรียม",
      body: "ทุกปีช่วงไตรมาสสุดท้าย ลูกค้าหลายท่านถามว่าเบี้ยประกันที่จ่ายไปใช้ลดหย่อนได้เท่าไหร่\n\nเงื่อนไขและวงเงินอาจเปลี่ยนตามประกาศของกรมสรรพากรแต่ละปี ทีมงานจะอัปเดตตัวเลขล่าสุดในบทความนี้ และส่งหนังสือรับรองการชำระเบี้ยให้ลูกค้าทุกท่านทาง LINE ก่อนยื่นภาษี\n\nถ้าต้องการหนังสือรับรองเร็วกว่ากำหนด แจ้งผ่านเมนู \"สอบถาม/แจ้งปัญหา\" ในหน้าสมาชิกได้เลย" },
    { id: "b2", date: isoIn(-18), category: "การเคลม", title: "เตรียมเอกสารเคลมค่ารักษาอย่างไรให้ได้เงินเร็ว",
      summary: "รายการเอกสารที่มักขาดบ่อย และวิธีส่งให้ตัวแทนตรวจก่อนยื่นบริษัท",
      body: "เอกสารที่ขาดบ่อยที่สุดคือใบเสร็จฉบับจริงและใบรับรองแพทย์ที่ระบุการวินิจฉัย\n\nก่อนยื่นเคลม ถ่ายรูปเอกสารทั้งหมดส่งให้ตัวแทนตรวจก่อน ทีมงานจะเช็กให้ครบในครั้งเดียว ลดเวลารอพิจารณา\n\nติดตามสถานะเคลมของคุณได้ในหน้าสมาชิก เมนู \"การเคลม\"" },
    { id: "b3", date: isoIn(-30), category: "ข่าวทีม", title: "เปิดช่องทางดูแลลูกค้านอกเวลาทำการ",
      summary: "ตัวแทนสำรองของทีมผลัดกันรับเรื่องเร่งด่วนทุกวัน รวมวันหยุด",
      body: "เพื่อไม่ให้ลูกค้ารอนาน ลูกค้าทุกท่านจะมีตัวแทนหลักและตัวแทนสำรอง ถ้าตัวแทนหลักไม่สะดวก ตัวแทนสำรองจะรับเรื่องแทนทันที\n\nดูรายชื่อตัวแทนสำรองของคุณได้ที่หน้าสมาชิก" }
  ],
  faq: [
    { q: "ลืมกำหนดชำระเบี้ย กรมธรรม์จะขาดทันทีไหม", a: "โดยทั่วไปกรมธรรม์มีระยะผ่อนผันหลังวันครบกำหนด รายละเอียดขึ้นกับแบบประกันของคุณ ทีมงานจะแจ้งเตือนล่วงหน้าทาง LINE และคุณดูวันครบกำหนดได้ในหน้าสมาชิก" },
    { q: "ชำระเบี้ยผ่านช่องทางไหนได้บ้าง", a: "ชำระผ่านช่องทางทางการของบริษัทประกันเท่านั้น เช่น แอปของบริษัท หักบัญชีอัตโนมัติ หรือเคาน์เตอร์ที่ระบุในใบแจ้งชำระ ทีมงานไม่รับเงินโอนเข้าบัญชีส่วนตัว" },
    { q: "ถ้าตัวแทนของฉันไม่ว่าง จะติดต่อใคร", a: "ลูกค้าทุกท่านมีตัวแทนสำรองที่รู้ข้อมูลของคุณ ดูชื่อและช่องทางติดต่อได้ในหน้าสมาชิก หรือทัก LINE ของทีม" },
    { q: "ดูสถานะการเคลมได้ที่ไหน", a: "เข้าสู่ระบบสมาชิกแล้วเลือกเมนูการเคลม จะเห็นวันที่ยื่น ยอดเงิน และสถานะล่าสุด ถ้าบริษัทขอเอกสารเพิ่ม จะแสดงไว้ในช่องหมายเหตุ" },
    { q: "ข้อมูลส่วนตัวของฉันปลอดภัยไหม", a: "ข้อมูลของคุณเห็นได้เฉพาะคุณและตัวแทนที่ดูแลเท่านั้น และใช้เพื่อการดูแลกรมธรรม์ของคุณตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล" }
  ]
};

/* =========================================================
   API LAYER — ใช้ Google Sheet ผ่าน Apps Script หรือ DEMO
   ========================================================= */
const Api = {
  live: () => !!CONFIG.SHEET_API_URL,

  async call(action, payload = {}) {
    try {
      if (!this.live()) return await DemoApi[action](payload);
      // ใช้ text/plain เพื่อหลีกเลี่ยง CORS preflight ของ Apps Script
      const res = await fetch(CONFIG.SHEET_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, ...payload })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch (e) {
      if (/ตั้งรหัสผ่านใหม่ก่อนใช้งาน/.test(e.message) && State.session) {
        State.session.must_change = true; sessionStore.set(State.session); location.hash = "#/password";
      }
      // เซสชันใช้ไม่ได้แล้ว: ล้างการล็อกอินเดิม แล้วพาไปหน้าเข้าสู่ระบบ
      if (/เซสชัน|ไม่มีสิทธิ์/.test(e.message) && State.session) {
        State.session = null; sessionStore.del(); State.loginNotice = e.message;
        a11yNavMember(); location.hash = "#/login";
      }
      throw e;
    }
  }
};

const DemoApi = {
  public() {
    return { agents: DEMO.agents.map(({ password, ...a }) => a), posts: DEMO.posts, faq: DEMO.faq };
  },
  async login({ role, username, password_hash }) {
    await new Promise(r => setTimeout(r, 300));
    if (role === "agent") {
      for (const a of DEMO.agents) if (a.id.toLowerCase() === username.toLowerCase() && password_hash === await sha256(a.password))
        return { token: "demo-" + a.id, role: "agent", user_id: a.id, name: a.name };
    } else {
      for (const c of DEMO.customers) if (c.phone === username.replace(/\D/g, "") && c.password && password_hash === await sha256(c.password))
        return { token: "demo-" + c.id, role: "customer", user_id: c.id, name: c.name, must_change: !!c.must_change };
    }
    throw new Error("เบอร์โทร/รหัสตัวแทน หรือรหัสผ่านไม่ถูกต้อง");
  },
  customerData({ token }) {
    const id = token.replace("demo-", "");
    const me = DEMO.customers.find(c => c.id === id);
    if (!me) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
    const policies = DEMO.policies.filter(p => p.customer_id === id);
    const nos = policies.map(p => p.policy_no);
    const agent = DEMO.agents.find(a => a.id === me.agent_id);
    const backup = DEMO.agents.find(a => a.id === (agent && agent.backup_id));
    const strip = (a) => a && (({ password, ...x }) => x)(a);
    const { password, ...safeMe } = me;
    return {
      me: safeMe, policies,
      payments: DEMO.payments.filter(p => nos.includes(p.policy_no)),
      claims: DEMO.claims.filter(c => nos.includes(c.policy_no)),
      tickets: DEMO.tickets.filter(t => t.customer_id === id),
      agent: strip(agent), backup: strip(backup)
    };
  },
  agentData({ token }) {
    const id = token.replace("demo-", "");
    const me = DEMO.agents.find(a => a.id === id);
    if (!me) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
    const leader = isManager(me.role);
    const myAgentIds = leader ? DEMO.agents.map(a => a.id) : [id];
    // ตัวแทนเห็นลูกค้าของตัวเอง + ลูกค้าที่ตัวเองเป็นตัวแทนสำรอง
    const backupFor = DEMO.agents.filter(a => a.backup_id === id).map(a => a.id);
    const visible = new Set([...myAgentIds, ...backupFor]);
    const customers = DEMO.customers.filter(c => visible.has(c.agent_id)).map(({ password, ...c }) => c);
    const cids = customers.map(c => c.id);
    const policies = DEMO.policies.filter(p => cids.includes(p.customer_id));
    return {
      me: (({ password, ...x }) => x)(me), leader, customers, policies,
      tickets: DEMO.tickets.filter(t => cids.includes(t.customer_id)),
      claims: DEMO.claims.filter(c => policies.some(p => p.policy_no === c.policy_no)),
      payments: DEMO.payments.filter(x => policies.some(p => p.policy_no === x.policy_no)),
      agents: DEMO.agents.map(({ password, ...a }) => ({ ...a, has_password: !!password }))
    };
  },
  createTicket({ token, topic, message }) {
    const id = token.replace("demo-", "");
    const me = DEMO.customers.find(c => c.id === id);
    const t = { id: "T" + Date.now(), customer_id: id, agent_id: me.agent_id, created: isoIn(0), topic, message, status: "รอตอบ" };
    DEMO.tickets.unshift(t);
    return { ok: true, ticket: t };
  },
  updateTicket({ id, status }) {
    const t = DEMO.tickets.find(x => x.id === id); if (t) t.status = status; return { ok: true };
  },
  addLead({ token, lead }) {
    const agent_id = token.replace("demo-", "");
    const c = { ...lead, id: "C" + Date.now(), type: "ลูกค้ามุ่งหวัง", agent_id, line_group_url: "", photo_url: "", password: "" };
    DEMO.customers.push(c); const { password, ...out } = c; return { ok: true, customer: out };
  },
  changePassword({ token, current_hash, new_hash }) { return { ok: true }; },
  logout() { return { ok: true }; },
  updateCustomer({ id, patch, password_hash }) {
    const c = DEMO.customers.find(x => x.id === id); Object.assign(c, patch); if (password_hash) { c.password = "demo"; c.must_change = true; }
    return { ok: true };
  },
  addPolicy({ policy }) {
    if (DEMO.policies.some(p => p.policy_no === policy.policy_no)) throw new Error("เลขกรมธรรม์ " + policy.policy_no + " มีอยู่แล้ว");
    const c = DEMO.customers.find(x => x.id === policy.customer_id);
    const pol = { ...policy, sold_by: c.agent_id }; DEMO.policies.push(pol);
    const converted = c.type !== "ลูกค้า"; c.type = "ลูกค้า";
    return { ok: true, policy: pol, converted };
  },
  updatePolicy({ policy_no, patch }) { Object.assign(DEMO.policies.find(p => p.policy_no === policy_no), patch); return { ok: true }; },
  recordPayment({ policy_no, date, amount, channel }) {
    const p = DEMO.policies.find(x => x.policy_no === policy_no);
    const payment = { id: "PM" + Date.now(), policy_no, date, amount, channel, status: "ชำระแล้ว" }; DEMO.payments.unshift(payment);
    p.next_due = addMonths(p.next_due || date, MODE_MONTHS[p.mode] || 12); if (p.status === "รอชำระ") p.status = "มีผลบังคับ";
    return { ok: true, payment, next_due: p.next_due, status: p.status };
  },
  addClaim({ claim }) { const c = { ...claim, id: "CL" + Date.now(), status: claim.status || "รอเอกสาร" }; DEMO.claims.unshift(c); return { ok: true, claim: c }; },
  updateClaim({ id, patch }) { Object.assign(DEMO.claims.find(c => c.id === id), patch); return { ok: true }; },
  addAgent({ token, agent, password_hash }) {
    const me = DEMO.agents.find(a => a.id === token.replace("demo-", ""));
    if (!me || !isManager(me.role)) throw new Error("เฉพาะหัวหน้าทีมหรือ Admin เท่านั้นที่เพิ่มตัวแทนได้");
    if (DEMO.agents.some(a => a.id.toLowerCase() === agent.id.toLowerCase())) throw new Error("รหัสตัวแทน " + agent.id + " มีอยู่แล้ว ใช้รหัสอื่น");
    DEMO.agents.push({ ...agent, photo_url: "", password: "demo" });
    return { ok: true, agent: { ...agent, photo_url: "" } };
  },
  updateAgent({ token, id, patch }) {
    const me = DEMO.agents.find(a => a.id === token.replace("demo-", ""));
    if (!me || !isManager(me.role)) throw new Error("เฉพาะหัวหน้าทีมหรือ Admin เท่านั้นที่แก้ข้อมูลตัวแทนได้");
    const a = DEMO.agents.find(x => x.id === id); if (a) Object.assign(a, patch);
    return { ok: true };
  }
};

/* =========================================================
   STATE + ROUTER
   ========================================================= */
const State = { pub: null, session: sessionStore.get(), loginNotice: "" };
// ล็อกอินที่ค้างมาจากโหมดตัวอย่าง ใช้กับ Google Sheet จริงไม่ได้ ล้างทิ้งอัตโนมัติ
if (CONFIG.SHEET_API_URL && State.session && String(State.session.token).startsWith("demo-")) {
  State.session = null; sessionStore.del();
}
const app = $("#app");

async function loadPublic() {
  if (State.pub) return State.pub;
  State.pub = await Api.call("public");
  return State.pub;
}

const routes = {
  "": renderHome,
  "team": renderTeam,
  "agent": renderAgent,
  "blog": renderBlog,
  "faq": renderFaq,
  "login": renderLogin,
  "portal": renderPortal,
  "dashboard": renderDashboard,
  "install": renderInstall,
  "password": renderPassword
};

async function router() {
  const [path, param] = location.hash.replace(/^#\/?/, "").split("/");
  const fn = routes[path] || renderHome;
  $("#nav").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false");
  document.querySelectorAll(".nav a").forEach(a => a.toggleAttribute("aria-current", a.getAttribute("href") === "#/" + (path || "")));
  if (a11yNavMember()) {}
  try {
    app.innerHTML = `<div class="loading">กำลังโหลด…</div>`;
    await fn(param);
  } catch (e) {
    app.innerHTML = `<div class="wrap loading"><p class="error">${esc(e.message)}</p><a class="btn btn-ghost" href="#/">กลับหน้าแรก</a></div>`;
  }
  window.scrollTo(0, 0);
}
function a11yNavMember() {
  const s = State.session, link = $("#navMember");
  if (!s) { link.textContent = "เข้าสู่ระบบสมาชิก"; link.href = "#/login"; }
  else if (s.role === "agent") { link.textContent = "แดชบอร์ดของฉัน"; link.href = "#/dashboard"; }
  else { link.textContent = "กรมธรรม์ของฉัน"; link.href = "#/portal"; }
  return true;
}

/* =========================================================
   PUBLIC PAGES
   ========================================================= */
async function renderHome() {
  const { posts, faq } = await loadPublic();
  const agents = publicAgents(State.pub.agents);
  const onDuty = agents.filter(a => a.on_duty);
  const leader = agents.find(a => a.role === "หัวหน้าทีม");
  const totalYears = agents.reduce((s, a) => s + Number(a.years || 0), 0);
  document.title = CONFIG.TEAM_NAME + " | " + CONFIG.TEAM_SUBTITLE;

  app.innerHTML = `
  <section class="hero">
    <div class="wrap hero-grid">
      <div>
        <h1>ทีมที่ดูแลคุณ ตั้งแต่วันวางแผนจนถึงวันเคลม</h1>
        <p class="lead">${esc(CONFIG.TEAM_NAME)} ตัวแทนประกันชีวิต FWD ${agents.length} คน ประสบการณ์รวม ${totalYears} ปี ลูกค้าทุกท่านมีตัวแทนหลักและตัวแทนสำรอง จึงมีคนตอบเสมอเมื่อคุณต้องการ</p>
        <div class="btn-row">
          <a class="btn btn-primary" href="${esc(CONFIG.TEAM_LINE_OA)}" target="_blank" rel="noopener">ปรึกษาทาง LINE</a>
          <a class="btn btn-ghost" href="#/login">ดูกรมธรรม์ของฉัน</a>
        </div>
      </div>
      <aside class="roster" aria-label="ตัวแทนที่พร้อมดูแลวันนี้">
        <div class="roster-head"><h3>พร้อมดูแลวันนี้</h3><span class="live">${onDuty.length} คนออนไลน์</span></div>
        ${onDuty.map(a => `
          <div class="roster-row">
            ${avatar(a, "sm")}
            <div><b>${esc(a.name)}</b><br><span class="small muted">${esc((a.specialties || []).slice(0, 2).join(", "))}</span></div>
            <a class="btn btn-line btn-sm" href="${esc(a.line_url)}" target="_blank" rel="noopener" aria-label="ทัก LINE ${esc(a.name)}">LINE</a>
          </div>`).join("")}
        <p class="roster-note">ถ้าตัวแทนของคุณไม่ว่าง ตัวแทนสำรองจะรับเรื่องแทนภายในวันเดียวกัน</p>
      </aside>
    </div>
  </section>

  <section class="block">
    <div class="wrap">
      <div class="section-head"><h2>เราดูแลคุณอย่างไร</h2><p class="muted">ทุกขั้นตอนมีคนรับผิดชอบชัดเจน และคุณตรวจสอบข้อมูลเองได้ตลอดผ่านหน้าสมาชิก</p></div>
      <ol class="steps">
        <li><h3>วางแผนตามชีวิตจริง</h3><p class="muted">คุยเรื่องรายได้ ภาระ และเป้าหมาย ก่อนเสนอแบบประกันที่เหมาะ</p></li>
        <li><h3>สมัครและส่งมอบกรมธรรม์</h3><p class="muted">อธิบายเงื่อนไขสำคัญจนเข้าใจ เก็บสำเนาไว้ให้ดูในหน้าสมาชิก</p></li>
        <li><h3>เตือนชำระเบี้ยล่วงหน้า</h3><p class="muted">แจ้งทาง LINE ก่อนครบกำหนด พร้อมช่องทางชำระทางการของบริษัท</p></li>
        <li><h3>อยู่ข้างคุณวันเคลม</h3><p class="muted">ตรวจเอกสารให้ครบก่อนยื่น และติดตามสถานะจนได้รับเงิน</p></li>
      </ol>
    </div>
  </section>

  <section class="block" style="background:var(--surface);border-block:1px solid var(--line)">
    <div class="wrap">
      <div class="section-head"><h2>ทีมของเรา</h2><p class="muted">ตัวแทนทุกคนมีใบอนุญาตเป็นตัวแทนประกันชีวิต ตรวจสอบเลขใบอนุญาตได้ที่หน้าโปรไฟล์</p></div>
      ${teamGrid(agents, leader)}
    </div>
  </section>

  <section class="block">
    <div class="wrap two-col">
      <div>
        <h2>ข่าวและบทความล่าสุด</h2>
        ${posts.slice(0, 2).map(postCard).join("")}
        <a href="#/blog">ดูบทความทั้งหมด</a>
      </div>
      <div>
        <h2>คำถามที่พบบ่อย</h2>
        ${faq.slice(0, 3).map(faqItem).join("")}
        <p style="margin-top:12px"><a href="#/faq">ดูคำถามทั้งหมด</a></p>
      </div>
    </div>
  </section>
  ${contactBand()}`;
}

function teamGrid(agents, leader) {
  const others = agents.filter(a => a !== leader);
  return `<div class="team-grid">
    ${leader ? `<a class="agent-card leader" href="#/agent/${esc(leader.id)}">
      ${avatar(leader, "lg")}
      <div><span class="role">${esc(leader.role)}</span><h3>${esc(leader.name)}</h3><p class="muted">${esc(leader.bio)}</p>
      <div class="tags">${(leader.specialties || []).map(s => `<span class="tag">${esc(s)}</span>`).join("")}</div></div></a>` : ""}
    ${others.map(a => `<a class="agent-card" href="#/agent/${esc(a.id)}">
      ${avatar(a, "md")}
      <div><span class="role">${esc(a.role)}</span><h3 style="margin:0">${esc(a.name)}</h3><span class="small muted">ประสบการณ์ ${esc(a.years)} ปี</span></div>
      <div class="tags">${(a.specialties || []).map(s => `<span class="tag">${esc(s)}</span>`).join("")}</div></a>`).join("")}
  </div>`;
}
const postCard = (p) => `<a class="post" href="#/blog/${esc(p.id)}" style="margin-bottom:14px">
  <span class="cat">${esc(p.category)}</span><h3>${esc(p.title)}</h3><p class="muted small" style="margin:0">${esc(p.summary)}</p></a>`;
const faqItem = (f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`;
const contactBand = () => `<section class="contact-band"><div class="wrap">
  <h2>มีคำถามเรื่องประกัน คุยกับเราได้</h2><p>ทัก LINE ของทีม หรือโทร ${esc(CONFIG.TEAM_PHONE)} ตัวแทนที่ว่างจะตอบคุณ</p>
  <div class="btn-row"><a class="btn btn-line" href="${esc(CONFIG.TEAM_LINE_OA)}" target="_blank" rel="noopener">เพิ่มเพื่อน LINE ทีม</a>
  <a class="btn btn-ghost" href="tel:${esc(CONFIG.TEAM_PHONE.replace(/\D/g, ""))}">โทรหาทีม</a></div></div></section>`;

async function renderTeam() {
  const agents = publicAgents((await loadPublic()).agents);
  app.innerHTML = `<section class="block"><div class="wrap">
    <div class="section-head"><h1>ทีมของเรา</h1><p class="muted">เลือกตัวแทนที่ถนัดเรื่องที่คุณสนใจ หรือทัก LINE ทีมให้เราจับคู่ให้</p></div>
    ${teamGrid(agents, agents.find(a => a.role === "หัวหน้าทีม"))}</div></section>${contactBand()}`;
}

async function renderAgent(id) {
  const agents = publicAgents((await loadPublic()).agents);
  const a = agents.find(x => x.id === id);
  if (!a) throw new Error("ไม่พบตัวแทนที่ค้นหา");
  const backup = agents.find(x => x.id === a.backup_id);
  document.title = a.name + " | " + CONFIG.TEAM_NAME;
  app.innerHTML = `<div class="wrap">
    <div class="profile-top">${avatar(a, "lg")}
      <div><span class="role" style="color:var(--orange-dark);font-weight:600">${esc(a.role)}</span><h1 style="margin:0">${esc(a.name)}</h1>
      <p class="muted">${esc(CONFIG.TEAM_SUBTITLE)}</p>
      <div class="btn-row"><a class="btn btn-line" href="${esc(a.line_url)}" target="_blank" rel="noopener">ทัก LINE</a>
      <a class="btn btn-ghost" href="tel:${esc(String(a.phone).replace(/\D/g, ""))}">โทร ${esc(a.phone)}</a></div></div>
    </div>
    <div class="facts">
      <div><b>${esc(a.years)} ปี</b><span class="small muted">ประสบการณ์ดูแลลูกค้า</span></div>
      <div><b>${esc(a.license_no)}</b><span class="small muted">เลขใบอนุญาตตัวแทน</span></div>
      ${backup ? `<div><b>${esc(backup.name)}</b><span class="small muted">ตัวแทนสำรองที่รับเรื่องแทน</span></div>` : ""}
    </div>
    <div class="article" style="padding-bottom:56px"><h2>เกี่ยวกับ${esc(a.name.split(" ")[0])}</h2><p>${esc(a.bio)}</p>
      <h3>เรื่องที่ถนัด</h3><div class="tags">${(a.specialties || []).map(s => `<span class="tag">${esc(s)}</span>`).join("")}</div>
      <p class="small muted" style="margin-top:24px">ตรวจสอบสถานะใบอนุญาตตัวแทนได้ที่เว็บไซต์ของสำนักงาน คปภ.</p></div>
  </div>`;
}

async function renderBlog(id) {
  const { posts } = await loadPublic();
  if (id) {
    const p = posts.find(x => x.id === id);
    if (!p) throw new Error("ไม่พบบทความ");
    app.innerHTML = `<section class="block"><div class="wrap article">
      <a href="#/blog">กลับไปหน้าบทความ</a>
      <p class="small muted" style="margin-top:20px">${esc(p.category)}, ${thDate(p.date)}</p>
      <h1>${esc(p.title)}</h1>${String(p.body).split(/\n\n+/).map(t => `<p>${esc(t)}</p>`).join("")}</div></section>${contactBand()}`;
    return;
  }
  app.innerHTML = `<section class="block"><div class="wrap">
    <div class="section-head"><h1>ข่าวและบทความ</h1><p class="muted">เรื่องที่ลูกค้าควรรู้ ทั้งสิทธิประโยชน์ การเคลม และการลดหย่อนภาษี</p></div>
    <div class="post-list">${posts.map(postCard).join("")}</div></div></section>`;
}

async function renderFaq() {
  const { faq } = await loadPublic();
  app.innerHTML = `<section class="block"><div class="wrap article">
    <h1>คำถามที่พบบ่อย</h1>${faq.map(faqItem).join("")}
    <p style="margin-top:28px" class="muted">ไม่พบคำตอบที่ต้องการ? เข้าสู่ระบบแล้วส่งคำถามถึงตัวแทนของคุณ หรือทัก LINE ทีมได้เลย</p></div></section>${contactBand()}`;
}

/* =========================================================
   LOGIN
   ========================================================= */
function renderLogin() {
  if (State.session) { location.hash = State.session.must_change ? "#/password" : State.session.role === "agent" ? "#/dashboard" : "#/portal"; return; }
  // จำว่าใช้แท็บไหนล่าสุด ตัวแทนเปิดมาจะอยู่แท็บตัวแทนเลย
  let role = store.get("loginRole") === "agent" ? "agent" : "customer";
  app.innerHTML = `<section class="block"><div class="wrap">
    <h1>เข้าสู่ระบบสมาชิก</h1>
    ${State.loginNotice ? `<div class="notice" style="margin-bottom:16px">${esc(State.loginNotice)}</div>` : ""}
    <div class="seg" role="group" aria-label="ประเภทสมาชิก" style="margin:12px 0 24px">
      <button type="button" data-role="customer">ลูกค้า</button>
      <button type="button" data-role="agent">ตัวแทน</button>
    </div>
    <div class="form" id="loginForm"></div>
    ${Api.live() ? "" : `<div class="notice" style="max-width:440px;margin-top:16px">โหมดตัวอย่าง: ลูกค้าใช้เบอร์ 0890000001 รหัส 1234, ตัวแทนใช้รหัส A02 (A01 = หัวหน้าทีม, ADMIN = ผู้ดูแลเว็บ) รหัสผ่าน agent123</div>`}
  </div></section>`;

  // สร้างช่องกรอกใหม่ทุกครั้งที่สลับแท็บ แยกชื่อช่องของลูกค้ากับตัวแทน
  // เบราว์เซอร์จะจำข้อมูลแยกกัน และไม่เอารหัสตัวแทนมาใส่ช่องเบอร์โทรลูกค้า
  const draw = () => {
    store.set("loginRole", role);
    app.querySelectorAll(".seg button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.role === role)));
    const agent = role === "agent";
    $("#loginForm").innerHTML = `
      <label>${agent ? "รหัสตัวแทน" : "เบอร์โทรศัพท์"}
        <input id="username" name="${agent ? "agent_id" : "customer_phone"}" ${agent ? 'autocapitalize="characters"' : 'inputmode="tel"'} autocomplete="off" readonly
          placeholder="${agent ? "รหัสตัวแทน FWD เช่น 185382" : "เช่น 0812345678"}" spellcheck="false"></label>
      <label>รหัสผ่าน<input id="password" type="password" name="${agent ? "agent_password" : "customer_password"}" autocomplete="off" readonly></label>
      <p class="error" id="loginErr" role="alert"></p>
      <button class="btn btn-primary" id="loginBtn" type="button">เข้าสู่ระบบ</button>
      <p class="small muted">${agent ? "ลืมรหัสผ่าน? ติดต่อหัวหน้าทีมหรือ Admin เพื่อตั้งรหัสใหม่" : "ยังไม่มีรหัสผ่าน? ขอรหัสจากตัวแทนของคุณทาง LINE"}</p>`;
    // ไม่ให้เบราว์เซอร์เติมรหัสที่จำไว้ให้อัตโนมัติ: เปิดหน้ามาช่องว่างเสมอ
    // (ช่องเป็น readonly ตอนโหลด เบราว์เซอร์จึงไม่เติม แล้วปลดล็อกทันทีเมื่อผู้ใช้แตะช่อง)
    ["#username", "#password"].forEach(sel => { const el = $(sel); el.value = "";
      const unlock = () => el.removeAttribute("readonly"); el.addEventListener("focus", unlock); el.addEventListener("pointerdown", unlock); });
    setTimeout(() => { const u = $("#username"), pw = $("#password"); if (u && pw && !u.matches(":focus") && !pw.matches(":focus")) { u.value = ""; pw.value = ""; } }, 600);
    $("#loginBtn").onclick = submit;
    $("#password").onkeydown = (e) => {
      if (e.getModifierState && e.getModifierState("CapsLock")) $("#loginErr").textContent = "Caps Lock เปิดอยู่ ตัวพิมพ์ใหญ่/เล็กมีผลกับรหัสผ่าน";
      if (e.key === "Enter") submit();
    };
    $("#username").onkeydown = (e) => { if (e.key === "Enter") $("#password").focus(); };
  };
  app.querySelectorAll(".seg button").forEach(b => b.onclick = () => { if (role !== b.dataset.role) { role = b.dataset.role; draw(); $("#username").focus(); } });

  const submit = async () => {
    let username = $("#username").value.trim();
    const pw = $("#password").value;
    $("#loginErr").textContent = "";
    if (!username || !pw) { $("#loginErr").textContent = "กรอกข้อมูลให้ครบทั้งสองช่อง"; return; }
    if (/[\u0E00-\u0E7F]/.test(pw + username)) { $("#loginErr").textContent = "มีตัวอักษรภาษาไทยในช่องที่กรอก แป้นพิมพ์อาจเป็นภาษาไทยอยู่ ให้สลับเป็นภาษาอังกฤษแล้วพิมพ์ใหม่"; return; }
    let useRole = role;
    if (role === "customer") {
      const digits = username.replace(/\D/g, "");
      // พิมพ์รหัสตัวแทนในแท็บลูกค้า (มีตัวอักษร หรือไม่ใช่เบอร์โทร เช่น 185382): ส่งเป็นตัวแทนให้อัตโนมัติ
      if (/[a-z]/i.test(username) || !/^0\d{8,9}$/.test(digits)) {
        if (/[a-z]/i.test(username) || (digits.length >= 4 && digits.length <= 8 && !/^0/.test(digits))) useRole = "agent";
        else { $("#loginErr").textContent = "เบอร์โทรต้องเป็นตัวเลข 10 หลัก ขึ้นต้นด้วย 0"; return; }
      } else username = digits;
    }
    $("#loginBtn").disabled = true; $("#loginBtn").textContent = "กำลังตรวจสอบ…";
    try {
      const s = await Api.call("login", { role: useRole, username, password_hash: await sha256(pw) });
      s.username_hint = useRole === "customer" ? username : String(username).toUpperCase();
      State.session = s; sessionStore.set(s); touchActive(); store.set("loginRole", useRole); State.loginNotice = "";
      location.hash = s.must_change ? "#/password" : s.role === "agent" ? "#/dashboard" : "#/portal";
    } catch (e) {
      $("#loginErr").textContent = e.message;
      $("#loginBtn").disabled = false; $("#loginBtn").textContent = "เข้าสู่ระบบ";
    }
  };
  draw();
}

function logout(notice) {
  const tok = State.session && State.session.token;
  State.session = null; sessionStore.del();
  if (tok && Api.live()) Api.call("logout", { token: tok }).catch(() => {}); // ยกเลิกเซสชันที่ฝั่ง Google Sheet ด้วย
  if (typeof notice === "string") { State.loginNotice = notice; location.hash = "#/login"; }
  else location.hash = "#/";
  a11yNavMember();
}

/* ออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งานนาน (รวมกรณีพับแอปไว้แล้วกลับมาเปิด) */
const IDLE_MINUTES = 30;
const touchActive = () => { if (State.session) try { sessionStorage.setItem("lastActive", String(Date.now())); } catch {} };
const checkIdle = () => {
  if (!State.session) return;
  let last = 0; try { last = Number(sessionStorage.getItem("lastActive") || 0); } catch {}
  if (last && Date.now() - last > IDLE_MINUTES * 60000) logout("ออกจากระบบอัตโนมัติ เนื่องจากไม่มีการใช้งานเกิน " + IDLE_MINUTES + " นาที");
};
["pointerdown", "keydown", "scroll", "touchstart"].forEach(ev => window.addEventListener(ev, () => { checkIdle(); touchActive(); }, { passive: true }));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkIdle(); });
setInterval(checkIdle, 60000);
function requireRole(role) {
  if (!State.session || State.session.role !== role) { location.hash = "#/login"; return false; }
  if (State.session.must_change) { location.hash = "#/password"; return false; }
  return true;
}

/* =========================================================
   เปลี่ยนรหัสผ่านของตัวเอง (บังคับเมื่อเข้าครั้งแรก หรือหลังมีคนตั้งรหัสให้)
   ========================================================= */
function renderPassword() {
  const s = State.session;
  if (!s) { location.hash = "#/login"; return; }
  const agent = s.role === "agent", min = agent ? 8 : 6;
  const forced = !!s.must_change;
  app.innerHTML = `<section class="block"><div class="wrap">
    <h1>${forced ? "ตั้งรหัสผ่านใหม่ก่อนใช้งาน" : "เปลี่ยนรหัสผ่าน"}</h1>
    ${forced ? `<p class="muted" style="max-width:52ch">รหัสผ่านที่ได้รับจาก${agent ? "หัวหน้าทีม" : "ตัวแทน"}เป็นรหัสชั่วคราว ตั้งรหัสใหม่ที่จำได้ง่ายและมีเพียงคุณที่รู้</p>` : ""}
    <div class="form">
      <label>${forced ? "รหัสผ่านชั่วคราวที่ได้รับ" : "รหัสผ่านปัจจุบัน"}<input id="pwCur" type="password" autocomplete="current-password"></label>
      <label>รหัสผ่านใหม่ (อย่างน้อย ${min} ตัว)<input id="pwNew" type="password" autocomplete="new-password"></label>
      <label>พิมพ์รหัสผ่านใหม่อีกครั้ง<input id="pwNew2" type="password" autocomplete="new-password"></label>
      ${agent ? `<div class="notice">ห้ามใช้รหัสผ่านเดียวกับที่ใช้เข้าระบบของบริษัท FWD</div>` : `<p class="small muted">ไม่ควรใช้วันเกิด เบอร์โทร หรือตัวเลขเรียงกัน เช่น 123456</p>`}
      <p class="error" id="pwErr" role="alert"></p>
      <button class="btn btn-primary" id="pwSave" type="button">บันทึกรหัสผ่านใหม่</button>
      ${forced ? `<button class="btn btn-ghost" id="pwLogout" type="button">ออกจากระบบ</button>` : `<a href="#/${agent ? "dashboard" : "portal"}">ยกเลิก</a>`}
    </div></div></section>`;
  const err = (m) => { $("#pwErr").textContent = m; };
  if ($("#pwLogout")) $("#pwLogout").onclick = logout;
  $("#pwSave").onclick = async () => {
    const cur = $("#pwCur").value, nw = $("#pwNew").value, nw2 = $("#pwNew2").value;
    if (!cur) return err("กรอกรหัสผ่าน" + (forced ? "ชั่วคราว" : "ปัจจุบัน"));
    if (/[\u0E00-\u0E7F]/.test(cur + nw)) return err("มีตัวอักษรภาษาไทยในรหัสผ่าน ให้สลับแป้นพิมพ์เป็นภาษาอังกฤษแล้วพิมพ์ใหม่");
    if (nw.length < min) return err("รหัสผ่านใหม่ต้องยาวอย่างน้อย " + min + " ตัว");
    if (agent && !(/[a-z]/i.test(nw) && /\d/.test(nw))) return err("รหัสผ่านตัวแทนต้องมีทั้งตัวอักษรและตัวเลข");
    if (/^(\d)\1+$/.test(nw) || "0123456789012345678909876543210".includes(nw)) return err("รหัสผ่านเดาง่ายเกินไป ลองตั้งใหม่");
    if (s.username_hint && nw.includes(s.username_hint)) return err("รหัสผ่านต้องไม่มีเบอร์โทรหรือรหัสตัวแทนอยู่ข้างใน");
    if (nw !== nw2) return err("รหัสผ่านใหม่สองช่องไม่ตรงกัน");
    if (nw === cur) return err("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม");
    const btn = $("#pwSave"); btn.disabled = true; btn.textContent = "กำลังบันทึก…";
    try {
      await Api.call("changePassword", { token: s.token, current_hash: await sha256(cur), new_hash: await sha256(nw) });
      s.must_change = false; sessionStore.set(s);
      toast("เปลี่ยนรหัสผ่านแล้ว ใช้รหัสใหม่ในการเข้าครั้งถัดไป", 4000);
      location.hash = agent ? "#/dashboard" : "#/portal";
    } catch (e) { btn.disabled = false; btn.textContent = "บันทึกรหัสผ่านใหม่"; err(e.message); }
  };
}

/* =========================================================
   CUSTOMER PORTAL
   ========================================================= */
async function renderPortal() {
  if (!requireRole("customer")) return;
  const d = await Api.call("customerData", { token: State.session.token });
  if (!d || !d.me) { logout("ไม่พบข้อมูลบัญชีของคุณ กรุณาเข้าสู่ระบบใหม่"); return; }
  const upcoming = [...d.policies].filter(p => p.next_due).sort((a, b) => new Date(a.next_due) - new Date(b.next_due))[0];
  let tab = "overview";

  const view = () => {
    const tabs = [["overview", "ภาพรวม"], ["policies", "กรมธรรม์"], ["pay", "การชำระเบี้ย"], ["claims", "การเคลม"], ["contact", "สอบถาม/แจ้งปัญหา"]];
    app.innerHTML = `<div class="wrap">
      <div class="app-head"><div><h1 style="margin:0;font-size:1.8rem">สวัสดี ${esc(d.me.name)}</h1><span class="muted small">ข้อมูลอัปเดตจากทีมตัวแทน ยึดเอกสารของบริษัทเป็นหลัก</span></div>
      <div class="btn-row"><a class="btn btn-ghost btn-sm" href="#/password">เปลี่ยนรหัสผ่าน</a><button class="btn btn-ghost btn-sm" id="logout">ออกจากระบบ</button></div></div>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join("")}</div>
      <div id="tabBody" style="padding-bottom:48px">${portalTab(tab, d, upcoming)}</div></div>`;
    $("#logout").onclick = logout;
    app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; view(); });
    app.querySelectorAll("[data-goto]").forEach(b => b.onclick = () => { tab = b.dataset.goto; view(); });
    const send = $("#sendTicket");
    if (send) send.onclick = async () => {
      const topic = $("#tTopic").value, message = $("#tMsg").value.trim();
      if (!message) { toast("พิมพ์รายละเอียดก่อนส่ง"); return; }
      send.disabled = true;
      const r = await Api.call("createTicket", { token: State.session.token, topic, message });
      d.tickets.unshift(r.ticket || { created: isoIn(0), topic, message, status: "รอตอบ" });
      toast("ส่งเรื่องถึงตัวแทนแล้ว"); view();
    };
  };
  view();
}

function portalTab(tab, d, upcoming) {
  const agentBlock = `<div class="panel"><h3>ตัวแทนที่ดูแลคุณ</h3>
    ${[["ตัวแทนหลัก", d.agent], ["ตัวแทนสำรอง (ตอบแทนเมื่อตัวแทนหลักไม่ว่าง)", d.backup]].filter(x => x[1]).map(([label, a]) => `
      <div class="agent-mini">${avatar(a)}<div style="flex:1"><span class="small muted">${label}</span><br><b>${esc(a.name)}</b> <span class="small muted">${esc(a.phone)}</span></div>
      <a class="btn btn-line btn-sm" href="${esc(a.line_url)}" target="_blank" rel="noopener">LINE</a></div>`).join("")}
    ${d.me.line_group_url ? `<a class="btn btn-ghost btn-sm" style="margin-top:8px" href="${esc(d.me.line_group_url)}" target="_blank" rel="noopener">เข้ากลุ่ม LINE ของคุณ</a>` : ""}
  </div>`;

  if (tab === "overview") {
    const days = upcoming ? daysUntil(upcoming.next_due) : null;
    const openClaims = d.claims.filter(c => !["อนุมัติ", "ไม่อนุมัติ"].includes(c.status));
    return `
      ${upcoming ? `<div class="panel due-hero">
        <div><h3>${days < 0 ? "เลยกำหนดชำระเบี้ยแล้ว" : "งวดชำระถัดไป"}</h3>
          <p style="margin:0">${esc(upcoming.plan)} (${esc(upcoming.policy_no)})<br><b>${baht(upcoming.premium)}</b> ครบกำหนด ${thDate(upcoming.next_due)}</p>
          <button class="btn btn-primary btn-sm" style="margin-top:12px" data-goto="pay">ดูช่องทางชำระ</button></div>
        <div class="days">${Math.abs(days)}<small>${days < 0 ? "วันที่เลยมา" : "วันก่อนครบกำหนด"}</small></div></div>` : ""}
      <div class="kpis">
        <div class="kpi"><b>${d.policies.length}</b>กรมธรรม์</div>
        <div class="kpi"><b>${baht(d.policies.reduce((s, p) => s + Number(p.sum_assured || 0), 0)).replace(" บาท", "")}</b>ทุนประกันรวม (บาท)</div>
        <div class="kpi ${openClaims.length ? "alert" : ""}"><b>${openClaims.length}</b>เคลมที่กำลังดำเนินการ</div>
      </div>
      ${agentBlock}`;
  }
  if (tab === "policies") {
    return `<div class="panel"><h3>กรมธรรม์ของคุณ</h3><div class="table-wrap"><table>
      <thead><tr><th>เลขกรมธรรม์</th><th>แบบประกัน</th><th class="num">ทุนประกัน</th><th class="num">เบี้ย</th><th>งวด</th><th>เริ่มคุ้มครอง</th><th>สถานะ</th></tr></thead>
      <tbody>${d.policies.map(p => `<tr><td>${esc(p.policy_no)}</td><td>${esc(p.plan)}${p.riders ? `<br><span class="small muted">สัญญาเพิ่มเติม: ${esc(p.riders)}</span>` : ""}${p.beneficiary ? `<br><span class="small muted">ผู้รับผลประโยชน์: ${esc(p.beneficiary)}</span>` : ""}${p.coverage_end ? `<br><span class="small muted">คุ้มครองถึง ${thDate(p.coverage_end)}</span>` : ""}</td><td class="num">${baht(p.sum_assured)}</td><td class="num">${baht(p.premium)}</td><td>${esc(p.mode)}</td><td>${thDate(p.start_date)}</td><td>${statusBadge(p.status)}</td></tr>`).join("") || `<tr><td colspan="7">ยังไม่มีกรมธรรม์ในระบบ</td></tr>`}</tbody>
    </table></div><p class="small muted" style="margin-top:12px">ต้องการสำเนากรมธรรม์ ส่งคำขอในแท็บ "สอบถาม/แจ้งปัญหา" ตัวแทนจะส่งให้ทาง LINE</p></div>`;
  }
  if (tab === "pay") {
    return `<div class="two-col"><div class="panel"><h3>กำหนดชำระ</h3><div class="table-wrap"><table>
        <thead><tr><th>กรมธรรม์</th><th class="num">เบี้ย</th><th>ครบกำหนด</th><th></th></tr></thead>
        <tbody>${d.policies.map(p => { const n = daysUntil(p.next_due); return `<tr><td>${esc(p.policy_no)}<br><span class="small muted">${esc(p.plan)}</span></td><td class="num">${baht(p.premium)}</td><td>${thDate(p.next_due)}</td><td>${statusBadge(n < 0 ? "เลยกำหนด" : n <= 30 ? "รอชำระ" : "มีผลบังคับ")}</td></tr>`; }).join("")}</tbody></table></div></div>
      <div class="panel"><h3>ช่องทางชำระเบี้ย</h3>
        <div class="notice" style="margin-bottom:14px">ชำระผ่านช่องทางทางการของบริษัทเท่านั้น ทีมงานไม่รับเงินเข้าบัญชีส่วนตัว</div>
        <ul class="pay-list">${CONFIG.PAYMENT_CHANNELS.map(c => `<li><b>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>` : esc(c.name)}</b><br><span class="small muted">${esc(c.detail)}</span></li>`).join("")}</ul></div></div>
      <div class="panel"><h3>ประวัติการชำระ</h3><div class="table-wrap"><table>
        <thead><tr><th>วันที่</th><th>กรมธรรม์</th><th class="num">จำนวน</th><th>ช่องทาง</th><th>สถานะ</th></tr></thead>
        <tbody>${d.payments.map(p => `<tr><td>${thDate(p.date)}</td><td>${esc(p.policy_no)}</td><td class="num">${baht(p.amount)}</td><td>${esc(p.channel)}</td><td>${statusBadge(p.status)}</td></tr>`).join("") || `<tr><td colspan="5">ยังไม่มีประวัติการชำระ</td></tr>`}</tbody></table></div></div>`;
  }
  if (tab === "claims") {
    return `<div class="panel"><h3>สถานะการเคลม</h3><div class="table-wrap"><table>
      <thead><tr><th>วันที่ยื่น</th><th>กรมธรรม์</th><th>ประเภท</th><th class="num">จำนวนเงิน</th><th>สถานะ</th><th>หมายเหตุ</th></tr></thead>
      <tbody>${d.claims.map(c => `<tr><td>${thDate(c.date)}</td><td>${esc(c.policy_no)}</td><td>${esc(c.type)}</td><td class="num">${baht(c.amount)}</td><td>${statusBadge(c.status)}</td><td>${esc(c.note)}</td></tr>`).join("") || `<tr><td colspan="6">ยังไม่มีรายการเคลม ถ้าต้องการยื่นเคลม แจ้งตัวแทนในแท็บ "สอบถาม/แจ้งปัญหา"</td></tr>`}</tbody>
    </table></div></div>`;
  }
  // contact
  return `<div class="two-col"><div class="panel"><h3>ส่งเรื่องถึงตัวแทน</h3>
      <div class="form"><label>เรื่อง<select id="tTopic"><option>สอบถามความคุ้มครอง</option><option>เคลม</option><option>การชำระเบี้ย</option><option>ขอเอกสาร/หนังสือรับรอง</option><option>เปลี่ยนแปลงข้อมูล</option><option>อื่นๆ</option></select></label>
      <label>รายละเอียด<textarea id="tMsg" rows="4" placeholder="เช่น ขอหนังสือรับรองการชำระเบี้ยปีนี้"></textarea></label>
      <button class="btn btn-primary" id="sendTicket" type="button">ส่งเรื่อง</button></div>
      <h3 style="margin-top:28px">เรื่องที่เคยส่ง</h3>
      ${d.tickets.map(t => `<div class="agent-mini" style="display:block"><span class="small muted">${thDate(t.created)}, ${esc(t.topic)}</span> ${statusBadge(t.status)}<br>${esc(t.message)}</div>`).join("") || `<p class="muted">ยังไม่มีเรื่องที่ส่ง</p>`}
    </div>${agentBlock}</div>`;
}

/* =========================================================
   AGENT DASHBOARD
   ========================================================= */
async function renderDashboard() {
  if (!requireRole("agent")) return;
  const full = await Api.call("agentData", { token: State.session.token });
  if (!full || !full.me) { logout("ไม่พบข้อมูลบัญชีของคุณ กรุณาเข้าสู่ระบบใหม่"); return; }
  let tab = "today", filter = "ทั้งหมด", q = "", editId = null;
  let agentFilter = { text: "", role: "", onlyInc: false }; // จำคำค้นหาไว้ระหว่างแก้ไขข้อมูล
  // หน้ารายละเอียดลูกค้า: custId = ลูกค้าที่เปิดอยู่, form = ฟอร์มที่เปิดอยู่ ("policy" | "pay" | "claim"), formKey = เลขกรมธรรม์ที่แก้/ชำระ
  let custId = null, form = null, formKey = null;
  if (!full.payments) full.payments = [];
  // หัวหน้าทีมสลับได้ 2 มุมมอง: "team" = เห็นทั้งทีม, "mine" = ทำงานขายเองเหมือนลูกทีมคนหนึ่ง
  const meAdmin = isAdmin(full.me.role);
  let mode = meAdmin ? "team" : full.leader ? (store.get("dashMode") || "team") : "mine";
  const custById = Object.fromEntries(full.customers.map(c => [c.id, c]));
  const agentById = Object.fromEntries(full.agents.map(a => [a.id, a]));

  // กรองข้อมูลเหลือเฉพาะลูกค้าของตัวเอง + ลูกค้าที่ตัวเองเป็นตัวแทนสำรอง
  const scope = () => {
    if (!full.leader || mode === "team") return full;
    const ids = new Set([full.me.id, ...full.agents.filter(a => a.backup_id === full.me.id).map(a => a.id)]);
    const customers = full.customers.filter(c => ids.has(c.agent_id));
    const cids = new Set(customers.map(c => c.id));
    const policies = full.policies.filter(p => cids.has(p.customer_id));
    const nos = new Set(policies.map(p => p.policy_no));
    return { ...full, leader: false, customers, policies,
      tickets: full.tickets.filter(t => cids.has(t.customer_id)),
      claims: full.claims.filter(c => nos.has(c.policy_no)) };
  };

  const view = () => {
    const d = scope();
    if ((tab === "team" || tab === "manage") && !d.leader) tab = "today";
    const due = d.policies.filter(p => daysUntil(p.next_due) <= CONFIG.REMIND_DAYS).sort((a, b) => new Date(a.next_due) - new Date(b.next_due));
    const pending = d.tickets.filter(t => t.status === "รอตอบ");
    const leads = d.customers.filter(c => c.type === "ลูกค้ามุ่งหวัง");
    const tabs = [["today", "งานวันนี้"], ["customers", "ลูกค้า"], ["claims", "เคลม"], ...(d.leader ? [["team", "ภาพรวมทีม"], ["manage", "จัดการทีม"]] : [])];

    app.innerHTML = `<div class="wrap">
      <div class="app-head"><div><h1 style="margin:0;font-size:1.8rem">${esc(d.me.name)}</h1><span class="muted small">${esc(roleLabel(d.me.role))}${full.leader ? (mode === "team" ? ", กำลังดูข้อมูลทั้งทีม" : ", กำลังดูเฉพาะลูกค้าของคุณ") : ""}</span></div>
      <div class="btn-row" style="align-items:center">
        ${full.leader && !meAdmin ? `<div class="seg" role="group" aria-label="เลือกมุมมอง">
          <button type="button" data-mode="team" aria-pressed="${mode === "team"}">มุมมองหัวหน้าทีม</button>
          <button type="button" data-mode="mine" aria-pressed="${mode === "mine"}">งานขายของฉัน</button></div>` : ""}
        <a class="btn btn-ghost btn-sm" href="#/password">เปลี่ยนรหัสผ่าน</a>
        <button class="btn btn-ghost btn-sm" id="logout">ออกจากระบบ</button></div></div>
      <div class="kpis">
        <div class="kpi"><b>${d.customers.filter(c => c.type === "ลูกค้า").length}</b>ลูกค้าที่ดูแล</div>
        <div class="kpi"><b>${leads.length}</b>ลูกค้ามุ่งหวัง</div>
        <div class="kpi ${due.length ? "alert" : ""}"><b>${due.length}</b>เบี้ยครบกำหนดใน ${CONFIG.REMIND_DAYS} วัน</div>
        <div class="kpi ${pending.length ? "alert" : ""}"><b>${pending.length}</b>เรื่องที่รอตอบ</div>
      </div>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join("")}</div>
      <div style="padding-bottom:48px">${dashTab()}</div></div>`;

    function dashTab() {
      if (tab === "today") return `
        <div class="panel"><h3>เตือนชำระเบี้ย</h3><div class="table-wrap"><table>
          <thead><tr><th>ลูกค้า</th><th>กรมธรรม์</th><th class="num">เบี้ย</th><th>ครบกำหนด</th><th></th></tr></thead>
          <tbody>${due.map(p => { const c = custById[p.customer_id] || {}; const n = daysUntil(p.next_due);
            const msg = `เรียน${c.name} กรมธรรม์ ${p.policy_no} (${p.plan}) ครบกำหนดชำระเบี้ย ${baht(p.premium)} วันที่ ${thDate(p.next_due)} ชำระผ่านช่องทางทางการของบริษัทได้เลยครับ/ค่ะ ดูรายละเอียดได้ที่หน้าสมาชิก`;
            return `<tr><td>${esc(c.name)}</td><td>${esc(p.policy_no)}</td><td class="num">${baht(p.premium)}</td><td>${thDate(p.next_due)} ${statusBadge(n < 0 ? "เลยกำหนด" : `อีก ${n} วัน`)}</td>
            <td><a class="btn btn-line btn-sm" href="${lineShare(msg)}" target="_blank" rel="noopener">ส่งเตือนทาง LINE</a></td></tr>`; }).join("") || `<tr><td colspan="5">ไม่มีเบี้ยครบกำหนดในช่วงนี้</td></tr>`}</tbody></table></div></div>
        <div class="panel"><h3>เรื่องที่ลูกค้าส่งมา</h3>
          ${d.tickets.map(t => { const c = custById[t.customer_id] || {}; const owner = (agentById[t.agent_id] || {}).name || "";
            const backupNote = t.agent_id === d.me.id ? "" : ` <span class="badge b-info">${d.leader ? "ลูกค้าของ" : "ดูแลแทน"} ${esc(owner)}</span>`;
            return `<div class="agent-mini">${avatar(c, "sm")}<div style="flex:1"><b>${esc(c.name)}</b> <span class="small muted">${thDate(t.created)}, ${esc(t.topic)}</span>${backupNote}<br>${esc(t.message)}</div>
            ${t.status === "รอตอบ" ? `<button class="btn btn-ghost btn-sm" data-done="${esc(t.id)}">ตอบแล้ว</button>` : statusBadge(t.status)}</div>`; }).join("") || `<p class="muted">ไม่มีเรื่องค้าง</p>`}
        </div>`;

      if (tab === "customers" && custId && custById[custId]) return customerDetail(d, custById[custId]);
      if (tab === "customers") {
        const list = d.customers.filter(c => (filter === "ทั้งหมด" || c.type === filter) && (!q || (c.name + c.phone + (c.occupation || "")).includes(q)));
        return `<div class="panel">
          <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:14px">
            <div class="seg" role="group" aria-label="กรองลูกค้า">${["ทั้งหมด", "ลูกค้า", "ลูกค้ามุ่งหวัง"].map(f => `<button type="button" data-filter="${f}" aria-pressed="${filter === f}">${f}</button>`).join("")}</div>
            <input id="search" placeholder="ค้นหาชื่อ เบอร์โทร หรืออาชีพ" value="${esc(q)}" style="max-width:260px">
          </div>
          <div class="table-wrap"><table><thead><tr><th>ชื่อ</th><th>ประเภท</th><th class="num">อายุ</th><th>อาชีพ</th><th>เบอร์โทร</th><th>ตัวแทนหลัก</th><th class="num">กรมธรรม์</th><th></th></tr></thead>
          <tbody>${list.map(c => { const age = ageFrom(c.birthday); const n = full.policies.filter(p => p.customer_id === c.id).length;
            return `<tr><td><b>${esc(c.name)}</b>${c.note ? `<br><span class="small muted">${esc(c.note)}</span>` : ""}</td><td>${statusBadge(c.type)}</td><td class="num">${age ?? "-"}</td><td>${esc(c.occupation || "-")}</td>
            <td><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></td><td>${esc((agentById[c.agent_id] || {}).name)}</td><td class="num">${n || "-"}</td>
            <td><button class="btn btn-ghost btn-sm" data-cust="${esc(c.id)}">เปิดข้อมูล</button></td></tr>`; }).join("") || `<tr><td colspan="8">ไม่พบลูกค้าตามเงื่อนไข</td></tr>`}</tbody></table></div></div>
          <div class="panel"><h3>เพิ่มลูกค้ามุ่งหวัง</h3>${profileFields({}, "l")}
            <button class="btn btn-primary" id="addLead" type="button" style="margin-top:14px">เพิ่มลูกค้ามุ่งหวัง</button><p class="error" id="lErr" role="alert"></p></div>`;
      }
      if (tab === "claims") return `<div class="panel"><h3>เคลมของลูกค้า</h3><div class="table-wrap"><table>
        <thead><tr><th>วันที่</th><th>ลูกค้า</th><th>กรมธรรม์</th><th>ประเภท</th><th class="num">จำนวน</th><th>สถานะ</th><th>หมายเหตุ</th></tr></thead>
        <tbody>${d.claims.map(c => { const p = d.policies.find(x => x.policy_no === c.policy_no) || {}; return `<tr><td>${thDate(c.date)}</td><td>${esc((custById[p.customer_id] || {}).name)}</td><td>${esc(c.policy_no)}</td><td>${esc(c.type)}</td><td class="num">${baht(c.amount)}</td><td>${statusBadge(c.status)}</td><td>${esc(c.note)}</td></tr>`; }).join("") || `<tr><td colspan="7">ยังไม่มีรายการเคลม</td></tr>`}</tbody></table></div></div>`;

      if (tab === "manage") return manageTab(d);

      // team overview (leader only)
      const rows = publicAgents(d.agents).map(a => {
        const cs = d.customers.filter(c => c.agent_id === a.id);
        const ps = d.policies.filter(p => cs.some(c => c.id === p.customer_id) && !["ยกเลิก", "ขาดอายุ"].includes(p.status));
        return { a, clients: cs.filter(c => c.type === "ลูกค้า").length, leads: cs.filter(c => c.type === "ลูกค้ามุ่งหวัง").length,
          premium: ps.reduce((s, p) => s + annualPremium(p), 0),
          open: d.tickets.filter(t => t.agent_id === a.id && t.status === "รอตอบ").length };
      });
      return `<div class="panel"><h3>ผลงานรายตัวแทน</h3><div class="table-wrap"><table>
        <thead><tr><th>ตัวแทน</th><th class="num">ลูกค้า</th><th class="num">มุ่งหวัง</th><th class="num">เบี้ยรายปีรวม</th><th class="num">เรื่องรอตอบ</th><th>ตัวแทนสำรอง</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${esc(r.a.name)}</td><td class="num">${r.clients}</td><td class="num">${r.leads}</td><td class="num">${baht(r.premium)}</td><td class="num">${r.open ? statusBadge(r.open + " เรื่อง") : "0"}</td><td>${esc((agentById[r.a.backup_id] || {}).name || "-")}</td></tr>`).join("")}</tbody></table></div></div>`;
    }


    function manageTab(d) {
      const e = editId ? (agentById[editId] || {}) : {};
      const editingSelf = editId === full.me.id;
      const opt = (v, cur) => `<option value="${v}" ${v === cur ? "selected" : ""}>${roleLabel(v)}</option>`;
      const missing = (a) => isAdmin(a.role) ? (a.has_password === false ? ["รหัสผ่าน"] : []) : [
        !a.license_no && "เลขใบอนุญาต", !a.phone && "เบอร์โทร", !a.line_url && "LINE",
        !a.photo_url && "รูปโปรไฟล์", !a.bio && "แนะนำตัว", a.has_password === false && "รหัสผ่าน"].filter(Boolean);
      const searchText = (a) => [a.id, a.name, a.role, roleLabel(a.role), a.phone, String(a.phone || "").replace(/\D/g, ""), a.license_no, a.email, (a.specialties || []).join(" "), (agentById[a.backup_id] || {}).name].join(" ").toLowerCase();
      const sorted = [...d.agents].sort((x, y) => ROLES.indexOf(y.role) - ROLES.indexOf(x.role) || String(x.id).localeCompare(String(y.id)));
      const incomplete = sorted.filter(a => missing(a).length).length;

      return `<div class="two-col" style="align-items:start">
        <div class="panel" id="agentForm"><h3>${editId ? "แก้ไขข้อมูล " + esc(e.name) : "เพิ่มตัวแทนใหม่"}</h3>
          <div class="form" style="max-width:none">
            <label>รหัสตัวแทน FWD (ใช้ล็อกอิน เปลี่ยนภายหลังไม่ได้)<input id="gId" value="${esc(e.id || "")}" ${editId ? "readonly style=\"background:var(--bg)\"" : ""} placeholder="เช่น 185382" autocapitalize="characters"></label>
            <label>ชื่อ-นามสกุล<input id="gName" value="${esc(e.name || "")}"></label>
            <label>ตำแหน่ง<select id="gRole" ${editingSelf ? "disabled" : ""}>${ROLES.map(r => opt(r, e.role || "ตัวแทน")).join("")}</select>
              <span class="small muted">${editingSelf ? "เปลี่ยนตำแหน่งของตัวเองไม่ได้" : "หัวหน้าทีมและ Admin จัดการทีมได้ทุกอย่าง Admin จะไม่แสดงบนหน้าเว็บ"}</span></label>
            <label>เลขที่ใบอนุญาตตัวแทน (คปภ.)<input id="gLic" value="${esc(e.license_no || "")}" inputmode="numeric"></label>
            <label>ประสบการณ์ (ปี)<input id="gYears" type="number" min="0" value="${esc(e.years ?? "")}"></label>
            <label>เบอร์โทร<input id="gPhone" value="${esc(e.phone || "")}" inputmode="tel"></label>
            <label>ลิงก์ LINE<input id="gLine" value="${esc(e.line_url || "")}" placeholder="https://line.me/ti/p/~lineid"></label>
            <label>อีเมลรับแจ้งเตือน (ไม่แสดงบนเว็บ)<input id="gEmail" type="email" value="${esc(e.email || "")}"></label>
            <label>ตัวแทนสำรอง<select id="gBackup"><option value="">ไม่ระบุ</option>${publicAgents(d.agents).filter(a => a.id !== editId).map(a => `<option value="${esc(a.id)}" ${a.id === e.backup_id ? "selected" : ""}>${esc(a.name)} (${esc(a.id)})</option>`).join("")}</select></label>
            <label>ความถนัด (คั่นด้วยจุลภาค)<input id="gSpec" value="${esc((e.specialties || []).join(", "))}" placeholder="เช่น เคลมสุขภาพ, ลดหย่อนภาษี"></label>
            <label>แนะนำตัว<textarea id="gBio" rows="3">${esc(e.bio || "")}</textarea></label>
            <label style="display:flex;align-items:center;gap:10px;font-weight:400"><input id="gDuty" type="checkbox" style="width:auto" ${editId ? (e.on_duty ? "checked" : "") : "checked"}> แสดงในกล่อง "พร้อมดูแลวันนี้"</label>
            <label>${editId ? "ตั้งรหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)" : "รหัสผ่านเริ่มต้น"}<input id="gPw" type="password" autocomplete="new-password"></label>
            <label>พิมพ์รหัสผ่านอีกครั้ง<input id="gPw2" type="password" autocomplete="new-password"></label>
            <p class="error" id="gErr" role="alert"></p>
            <div class="btn-row"><button class="btn btn-primary" id="gSave" type="button">${editId ? "บันทึกการแก้ไข" : "เพิ่มตัวแทน"}</button>
            ${editId ? `<button class="btn btn-ghost" id="gCancel" type="button">ยกเลิก</button>` : ""}</div>
          </div></div>

        <div class="panel"><h3>ตัวแทนในทีม (${d.agents.length} คน)</h3>
          <div class="form" style="max-width:none;gap:10px;margin-bottom:6px">
            <input id="aSearch" type="search" placeholder="ค้นหาชื่อ รหัส เบอร์โทร เลขใบอนุญาต หรือความถนัด" aria-label="ค้นหาตัวแทน">
            <div class="btn-row" style="gap:8px">
              <select id="aRole" aria-label="กรองตามตำแหน่ง" style="width:auto;flex:1"><option value="">ทุกตำแหน่ง</option>${ROLES.map(r => `<option value="${r}">${roleLabel(r)}</option>`).join("")}</select>
              <label style="display:flex;align-items:center;gap:8px;font-weight:400;font-size:.92rem"><input id="aIncomplete" type="checkbox" style="width:auto"> เฉพาะข้อมูลไม่ครบ (${incomplete})</label>
            </div>
            <span class="small muted" id="aCount" aria-live="polite">แสดง ${sorted.length} คน</span>
          </div>
          <div id="aList">${sorted.map(a => { const miss = missing(a); return `<div class="agent-mini" data-agent data-role="${esc(a.role)}" data-incomplete="${miss.length ? 1 : 0}" data-q="${esc(searchText(a))}">
            ${avatar(a, "sm")}<div style="flex:1;min-width:0"><b>${esc(a.name)}</b> <span class="small muted">${esc(a.id)}, ${esc(roleLabel(a.role))}</span><br>
            <span class="small muted">${a.phone ? "โทร " + esc(a.phone) : ""}${a.license_no ? (a.phone ? ", " : "") + "ใบอนุญาต " + esc(a.license_no) : ""}</span>
            <div class="tags" style="margin-top:4px">${isAdmin(a.role) ? "" : (a.on_duty ? statusBadge("พร้อมดูแล") : `<span class="badge b-info">ไม่แสดงในกล่องพร้อมดูแล</span>`)}
            ${miss.length ? `<span class="badge b-warn">ยังไม่มี: ${esc(miss.join(", "))}</span>` : ""}</div></div>
            <button class="btn btn-ghost btn-sm" data-edit="${esc(a.id)}">แก้ไข</button></div>`; }).join("")}</div>
          <p class="muted hidden" id="aEmpty">ไม่พบตัวแทนที่ตรงกับคำค้นหา</p>
        </div></div>`;
    }

    /* ฟิลด์ข้อมูลลูกค้า ใช้ร่วมกันทั้งฟอร์มเพิ่มลูกค้ามุ่งหวัง (prefix "l") และฟอร์มแก้ไข (prefix "c") */
    function profileFields(c, px) {
      const age = ageFrom(c.birthday), inc = Number(c.monthly_income || 0);
      return `<div class="pf-grid">
        <label>ชื่อ-นามสกุล<input id="${px}Name" value="${esc(c.name || "")}"></label>
        <label>เบอร์โทร<input id="${px}Phone" value="${esc(c.phone || "")}" inputmode="tel"></label>
        <label>วันเกิด${thaiDate(px + "Birth", c.birthday, { back: 100, extra: `data-age-out="${px}Age"` })}</label>
        <label>อายุ<output id="${px}Age" class="calc">${age != null ? age + " ปี" : "คำนวณจากวันเกิด"}</output></label>
        <label>เพศ<select id="${px}Gender">${options(GENDERS, c.gender, "เลือก")}</select></label>
        <label>อาชีพ<input id="${px}Occ" value="${esc(c.occupation || "")}" placeholder="เช่น พนักงานบริษัท, ค้าขาย"></label>
        <label>รายได้ต่อเดือนโดยประมาณ (บาท)<input id="${px}Income" type="number" min="0" step="1000" value="${inc || ""}" inputmode="numeric" data-annual-out="${px}Annual"></label>
        <label>รายได้ต่อปีโดยประมาณ<output id="${px}Annual" class="calc">${inc ? baht(inc * 12) : "คำนวณจากรายได้ต่อเดือน"}</output></label>
        <label class="pf-wide">บันทึก<input id="${px}Note" value="${esc(c.note || "")}" placeholder="เช่น สนใจประกันสุขภาพ นัดคุยวันเสาร์"></label>
      </div>`;
    }
    function readProfile(px) {
      const v = (id) => ($("#" + px + id) || {}).value || "";
      return { name: v("Name").trim(), phone: v("Phone").replace(/\D/g, ""), birthday: v("Birth"), gender: v("Gender"),
        occupation: v("Occ").trim(), monthly_income: Number(v("Income") || 0), note: v("Note").trim() };
    }
    function profileError(c) {
      if (!c.name) return "กรอกชื่อลูกค้า";
      if (!/^0\d{8,9}$/.test(c.phone)) return "เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0";
      return "";
    }

    function customerDetail(d, c) {
      const pols = full.policies.filter(p => p.customer_id === c.id);
      const nos = pols.map(p => p.policy_no);
      const pays = full.payments.filter(x => nos.includes(x.policy_no)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const cls = full.claims.filter(x => nos.includes(x.policy_no)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const active = pols.filter(p => !["ยกเลิก", "ขาดอายุ"].includes(p.status));
      const isLead = c.type !== "ลูกค้า";
      const editing = form === "policy" ? (formKey ? pols.find(p => p.policy_no === formKey) || {} : {}) : null;

      const policyForm = (p) => `<div class="panel" id="policyForm" style="border-color:var(--teal)"><h3>${p.policy_no ? "แก้ไขกรมธรรม์ " + esc(p.policy_no) : "บันทึกกรมธรรม์ใหม่"}</h3>
        <div class="pf-grid">
          <label>เลขกรมธรรม์<input id="pNo" value="${esc(p.policy_no || "")}" ${p.policy_no ? "readonly" : ""} placeholder="ถ้ายังไม่ออก ใส่เลขใบคำขอไปก่อน"></label>
          <label>แบบประกัน<input id="pPlan" value="${esc(p.plan || "")}" placeholder="เช่น ประกันสุขภาพเหมาจ่าย"></label>
          <label>ทุนประกัน (บาท)<input id="pSum" type="number" min="0" value="${esc(p.sum_assured || "")}" inputmode="numeric"></label>
          <label>เบี้ยต่องวด (บาท)<input id="pPrem" type="number" min="0" value="${esc(p.premium || "")}" inputmode="numeric"></label>
          <label>งวดการชำระ<select id="pMode">${options(MODES, p.mode || "รายปี")}</select></label>
          <label>เบี้ยต่อปี<output id="pAnnual" class="calc">${p.premium ? baht(annualPremium(p)) : "-"}</output></label>
          <label>วันเริ่มคุ้มครอง${thaiDate("pStart", p.start_date, { back: 40, ahead: 1 })}</label>
          <label>ครบกำหนดชำระงวดถัดไป${thaiDate("pDue", p.next_due, { back: 5, ahead: 3 })}</label>
          <label>สถานะ<select id="pStatus">${options(POLICY_STATUS, p.status || "รออนุมัติ")}</select></label>
          <label>ระยะเวลาชำระเบี้ย (ปี)<input id="pYears" type="number" min="0" value="${esc(p.payment_years || "")}"></label>
          <label>คุ้มครองถึงวันที่${thaiDate("pEnd", p.coverage_end, { back: 0, ahead: 100 })}</label>
          <label>ผู้รับผลประโยชน์<input id="pBen" value="${esc(p.beneficiary || "")}" placeholder="ชื่อ และความสัมพันธ์"></label>
          <label class="pf-wide">สัญญาเพิ่มเติม<input id="pRiders" value="${esc(p.riders || "")}" placeholder="เช่น ค่ารักษาผู้ป่วยนอก, อุบัติเหตุ"></label>
          <label class="pf-wide">หมายเหตุ (ลูกค้าไม่เห็น)<input id="pNote" value="${esc(p.note || "")}"></label>
        </div>
        ${!p.policy_no && isLead ? `<div class="notice" style="margin-top:14px">เมื่อบันทึกกรมธรรม์ฉบับแรก ระบบจะเปลี่ยน ${esc(c.name)} จากลูกค้ามุ่งหวังเป็นลูกค้าให้อัตโนมัติ</div>` : ""}
        <p class="error" id="pErr" role="alert"></p>
        <div class="btn-row"><button class="btn btn-primary" id="pSave" type="button">${p.policy_no ? "บันทึกการแก้ไข" : "บันทึกกรมธรรม์"}</button><button class="btn btn-ghost" data-close-form type="button">ยกเลิก</button></div></div>`;

      const payForm = (p) => `<div class="pay-box"><h4>บันทึกการชำระเบี้ย</h4>
        <div class="pf-grid">
          <label>วันที่ชำระ${thaiDate("payDate", isoIn(0), { back: 2 })}</label>
          <label>จำนวนเงิน (บาท)<input id="payAmt" type="number" min="0" value="${esc(p.premium || "")}"></label>
          <label class="pf-wide">ช่องทาง<select id="payCh">${options(PAY_CHANNELS, "แอปหรือเว็บไซต์บริษัท")}</select></label>
        </div>
        <p class="small muted">งวดถัดไปจะเลื่อนเป็น <b>${thDate(addMonths(p.next_due || isoIn(0), MODE_MONTHS[p.mode] || 12))}</b> ให้อัตโนมัติ</p>
        <div class="btn-row"><button class="btn btn-primary btn-sm" id="paySave" data-no="${esc(p.policy_no)}" type="button">บันทึกการชำระ</button><button class="btn btn-ghost btn-sm" data-close-form type="button">ยกเลิก</button></div></div>`;

      const field = (label, val) => val ? `<div><span class="small muted">${label}</span><br>${val}</div>` : "";
      const policyCard = (p) => { const n = p.next_due ? daysUntil(p.next_due) : null;
        return `<div class="pol-card">
        <div class="pol-head"><div><b>${esc(p.plan)}</b><br><span class="small muted">เลขที่ ${esc(p.policy_no)}</span></div>${statusBadge(p.status)}</div>
        <div class="pol-grid">
          ${field("ทุนประกัน", baht(p.sum_assured))}
          ${field("เบี้ย", baht(p.premium) + " " + esc(p.mode || ""))}
          ${field("เบี้ยต่อปี", baht(annualPremium(p)))}
          ${field("เริ่มคุ้มครอง", p.start_date ? thDate(p.start_date) : "")}
          ${field("งวดถัดไป", p.next_due ? thDate(p.next_due) + (n != null && n <= 30 && p.status !== "ยกเลิก" ? " " + statusBadge(n < 0 ? "เลยกำหนด" : "อีก " + n + " วัน") : "") : "")}
          ${field("ชำระเบี้ย", p.payment_years ? esc(p.payment_years) + " ปี" : "")}
          ${field("คุ้มครองถึง", p.coverage_end ? thDate(p.coverage_end) : "")}
          ${field("ผู้รับผลประโยชน์", esc(p.beneficiary))}
          ${field("สัญญาเพิ่มเติม", esc(p.riders))}
          ${field("ผู้ขาย", esc((agentById[p.sold_by] || {}).name || ""))}
          ${field("หมายเหตุ", esc(p.note))}
        </div>
        ${form === "pay" && formKey === p.policy_no ? payForm(p) : `<div class="btn-row" style="margin-top:12px">
          ${["รออนุมัติ", "ยกเลิก", "ขาดอายุ"].includes(p.status) ? "" : `<button class="btn btn-primary btn-sm" data-pay="${esc(p.policy_no)}">บันทึกการชำระ</button>`}
          <button class="btn btn-ghost btn-sm" data-edit-pol="${esc(p.policy_no)}">แก้ไขกรมธรรม์</button></div>`}
      </div>`; };

      return `
      <button class="btn btn-ghost btn-sm" id="backList" type="button" style="margin-bottom:16px">กลับไปรายชื่อลูกค้า</button>
      <div class="cust-head"><div><h2 style="margin:0">${esc(c.name)}</h2>
        <span class="muted small">${[ageFrom(c.birthday) != null ? "อายุ " + ageFrom(c.birthday) + " ปี" : "", c.gender, c.occupation, "ดูแลโดย " + ((agentById[c.agent_id] || {}).name || "-")].filter(Boolean).join(", ")}</span></div>
        ${statusBadge(c.type)}</div>

      ${isLead ? `<div class="panel close-sale"><div><h3 style="margin:0 0 4px">ปิดการขายได้แล้ว?</h3><p class="muted" style="margin:0">บันทึกกรมธรรม์ฉบับแรก แล้วระบบจะเปลี่ยนเป็นลูกค้าให้อัตโนมัติ</p></div>
        ${form === "policy" ? "" : `<button class="btn btn-primary" data-new-pol type="button">บันทึกการขาย</button>`}</div>` : ""}

      <div class="kpis">
        <div class="kpi"><b>${active.length}</b>กรมธรรม์ที่มีผล</div>
        <div class="kpi"><b>${baht(active.reduce((s, p) => s + Number(p.sum_assured || 0), 0)).replace(" บาท", "")}</b>ทุนประกันรวม (บาท)</div>
        <div class="kpi"><b>${baht(active.reduce((s, p) => s + annualPremium(p), 0)).replace(" บาท", "")}</b>เบี้ยรวมต่อปี (บาท)</div>
        <div class="kpi"><b>${c.monthly_income ? Math.round(active.reduce((s, p) => s + annualPremium(p), 0) / (c.monthly_income * 12) * 100) + "%" : "-"}</b>เบี้ยเทียบรายได้ต่อปี</div>
      </div>

      ${form === "policy" ? policyForm(editing) : ""}

      <div class="panel"><div class="pol-head"><h3 style="margin:0">ประวัติการซื้อประกัน (${pols.length} ฉบับ)</h3>
        ${!isLead && form !== "policy" ? `<button class="btn btn-ghost btn-sm" data-new-pol type="button">เพิ่มกรมธรรม์</button>` : ""}</div>
        ${pols.length ? [...pols].sort((a, b) => String(b.start_date).localeCompare(String(a.start_date))).map(policyCard).join("") : `<p class="muted" style="margin-top:12px">ยังไม่มีกรมธรรม์</p>`}
      </div>

      <div class="two-col" style="align-items:start">
        <div class="panel"><h3>ข้อมูลส่วนตัว</h3>${profileFields(c, "c")}
          ${full.leader ? `<label style="margin-top:14px">ตัวแทนหลัก<select id="cAgent">${publicAgents(full.agents).map(a => `<option value="${esc(a.id)}" ${a.id === c.agent_id ? "selected" : ""}>${esc(a.name)} (${esc(a.id)})</option>`).join("")}</select></label>` : ""}
          <label style="margin-top:14px">ลิงก์กลุ่ม LINE ของลูกค้า<input id="cLine" value="${esc(c.line_group_url || "")}" placeholder="https://line.me/R/ti/g/..."></label>
          ${isLead ? "" : `<label style="margin-top:14px">ตั้งรหัสชั่วคราวให้ลูกค้าเข้าดูกรมธรรม์ (ลูกค้าจะเปลี่ยนเองเมื่อเข้าครั้งแรก เว้นว่างถ้าไม่เปลี่ยน)<input id="cPw" type="password" autocomplete="new-password" placeholder="อย่างน้อย 6 ตัว"></label>`}
          <p class="error" id="cErr" role="alert"></p>
          <button class="btn btn-primary" id="cSave" type="button">บันทึกข้อมูลลูกค้า</button>
        </div>
        <div>
          <div class="panel"><h3>ประวัติการชำระเบี้ย</h3><div class="table-wrap"><table>
            <thead><tr><th>วันที่</th><th>กรมธรรม์</th><th class="num">จำนวน</th><th>ช่องทาง</th></tr></thead>
            <tbody>${pays.map(x => `<tr><td>${thDate(x.date)}</td><td>${esc(x.policy_no)}</td><td class="num">${baht(x.amount)}</td><td>${esc(x.channel)}</td></tr>`).join("") || `<tr><td colspan="4">ยังไม่มีประวัติการชำระ</td></tr>`}</tbody></table></div></div>
          <div class="panel"><div class="pol-head"><h3 style="margin:0">การเคลม</h3>${pols.length && form !== "claim" ? `<button class="btn btn-ghost btn-sm" data-new-claim type="button">บันทึกการเคลม</button>` : ""}</div>
            ${form === "claim" ? `<div class="pay-box"><div class="pf-grid">
              <label>กรมธรรม์<select id="clPol">${pols.map(p => `<option value="${esc(p.policy_no)}">${esc(p.policy_no)} ${esc(p.plan)}</option>`).join("")}</select></label>
              <label>ประเภท<select id="clType">${options(CLAIM_TYPES, "ผู้ป่วยใน")}</select></label>
              <label>วันที่ยื่น${thaiDate("clDate", isoIn(0), { back: 3 })}</label>
              <label>จำนวนเงิน (บาท)<input id="clAmt" type="number" min="0"></label>
              <label class="pf-wide">หมายเหตุ (ลูกค้าเห็น)<input id="clNote" placeholder="เช่น รอใบรับรองแพทย์ฉบับจริง"></label></div>
              <div class="btn-row" style="margin-top:12px"><button class="btn btn-primary btn-sm" id="clSave" type="button">บันทึกการเคลม</button><button class="btn btn-ghost btn-sm" data-close-form type="button">ยกเลิก</button></div></div>` : ""}
            <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>วันที่</th><th>ประเภท</th><th class="num">จำนวน</th><th>สถานะ</th></tr></thead>
            <tbody>${cls.map(x => `<tr><td>${thDate(x.date)}<br><span class="small muted">${esc(x.policy_no)}</span></td><td>${esc(x.type)}${x.note ? `<br><span class="small muted">${esc(x.note)}</span>` : ""}</td><td class="num">${baht(x.amount)}</td>
              <td><select data-claim="${esc(x.id)}" aria-label="สถานะเคลม" style="padding:6px 8px;font-size:.9rem">${options(CLAIM_STATUS, x.status)}</select></td></tr>`).join("") || `<tr><td colspan="4">ยังไม่มีการเคลม</td></tr>`}</tbody></table></div>
          </div>
        </div>
      </div>`;
    }

    function bindCalc() { // คำนวณอายุและรายได้ต่อปีทันทีที่พิมพ์
      app.querySelectorAll("[data-age-out]").forEach(i => i.oninput = () => { const a = ageFrom(i.value); $("#" + i.dataset.ageOut).textContent = a != null ? a + " ปี" : "คำนวณจากวันเกิด"; });
      app.querySelectorAll("[data-annual-out]").forEach(i => i.oninput = () => { const v = Number(i.value || 0); $("#" + i.dataset.annualOut).textContent = v ? baht(v * 12) : "คำนวณจากรายได้ต่อเดือน"; });
      const prem = $("#pPrem"), mode = $("#pMode");
      if (prem) { const upd = () => { $("#pAnnual").textContent = prem.value ? baht(annualPremium({ premium: prem.value, mode: mode.value })) : "-"; }; prem.oninput = upd; mode.onchange = upd; }
      const start = $("#pStart"), due = $("#pDue");
      if (start && due) start.onchange = () => { if (!due.value && start.value) thaiDateSet("pDue", addMonths(start.value, MODE_MONTHS[mode.value] || 12)); };
    }

    function bindCustomer() {
      const c = custById[custId]; if (!c) return;
      const tok = State.session.token;
      const busy = (btn, on, label) => { btn.disabled = on; if (label) btn.textContent = label; };
      $("#backList") && ($("#backList").onclick = () => { custId = null; form = null; view(); });
      app.querySelectorAll("[data-new-pol]").forEach(b => b.onclick = () => { form = "policy"; formKey = null; view(); $("#policyForm")?.scrollIntoView({ behavior: "smooth" }); });
      app.querySelectorAll("[data-edit-pol]").forEach(b => b.onclick = () => { form = "policy"; formKey = b.dataset.editPol; view(); $("#policyForm")?.scrollIntoView({ behavior: "smooth" }); });
      app.querySelectorAll("[data-pay]").forEach(b => b.onclick = () => { form = "pay"; formKey = b.dataset.pay; view(); });
      app.querySelectorAll("[data-new-claim]").forEach(b => b.onclick = () => { form = "claim"; view(); });
      app.querySelectorAll("[data-close-form]").forEach(b => b.onclick = () => { form = null; formKey = null; view(); });

      const cs = $("#cSave"); if (cs) cs.onclick = async () => {
        const patch = { ...readProfile("c"), line_group_url: $("#cLine").value.trim() };
        if ($("#cAgent")) patch.agent_id = $("#cAgent").value;
        const e = profileError(patch); if (e) return ($("#cErr").textContent = e);
        if (patch.line_group_url && !/^https:\/\//.test(patch.line_group_url)) return ($("#cErr").textContent = "ลิงก์ LINE ต้องขึ้นต้นด้วย https://");
        const pw = $("#cPw") ? $("#cPw").value : "";
        if (pw && pw.length < 6) return ($("#cErr").textContent = "รหัสผ่านต้องยาวอย่างน้อย 6 ตัว");
        busy(cs, true, "กำลังบันทึก…");
        try {
          await Api.call("updateCustomer", { token: tok, id: c.id, patch, password_hash: pw ? await sha256(pw) : undefined });
          Object.assign(c, patch); toast(pw ? "บันทึกแล้ว แจ้งรหัสชั่วคราวให้ลูกค้าทาง LINE ส่วนตัว ลูกค้าจะต้องตั้งรหัสใหม่เมื่อเข้าครั้งแรก" : "บันทึกข้อมูลลูกค้าแล้ว", pw ? 6000 : 2600); view();
        } catch (e2) { busy(cs, false, "บันทึกข้อมูลลูกค้า"); $("#cErr").textContent = e2.message; }
      };

      const ps = $("#pSave"); if (ps) ps.onclick = async () => {
        const v = (id) => $(id).value.trim();
        const pol = { policy_no: v("#pNo"), customer_id: c.id, plan: v("#pPlan"), sum_assured: Number(v("#pSum") || 0), premium: Number(v("#pPrem") || 0),
          mode: $("#pMode").value, start_date: v("#pStart"), next_due: v("#pDue"), status: $("#pStatus").value, payment_years: v("#pYears") ? Number(v("#pYears")) : "",
          coverage_end: v("#pEnd"), beneficiary: v("#pBen"), riders: v("#pRiders"), note: v("#pNote") };
        const err = (m) => ($("#pErr").textContent = m);
        if (!pol.policy_no) return err("กรอกเลขกรมธรรม์ หรือเลขใบคำขอ");
        if (!pol.plan) return err("กรอกชื่อแบบประกัน");
        if (!pol.premium) return err("กรอกเบี้ยต่องวด");
        if (!pol.start_date) return err("เลือกวันเริ่มคุ้มครอง (ถ้ายังไม่อนุมัติ ใส่วันที่ยื่นใบคำขอ)");
        if (!pol.next_due) pol.next_due = addMonths(pol.start_date, MODE_MONTHS[pol.mode] || 12);
        busy(ps, true, "กำลังบันทึก…");
        try {
          if (formKey) {
            const { policy_no, customer_id, ...patch } = pol;
            await Api.call("updatePolicy", { token: tok, policy_no: formKey, patch });
            Object.assign(full.policies.find(p => p.policy_no === formKey), patch); toast("บันทึกการแก้ไขแล้ว");
          } else {
            const r = await Api.call("addPolicy", { token: tok, policy: pol });
            full.policies.push(r.policy || { ...pol, sold_by: c.agent_id });
            if (r.converted || c.type !== "ลูกค้า") { c.type = "ลูกค้า"; toast("ยินดีด้วย! " + c.name + " เป็นลูกค้าแล้ว ตั้งรหัสผ่านให้ลูกค้าได้ที่ข้อมูลส่วนตัวด้านล่าง", 6000); }
            else toast("บันทึกกรมธรรม์แล้ว");
          }
          form = null; formKey = null; view();
        } catch (e2) { busy(ps, false, formKey ? "บันทึกการแก้ไข" : "บันทึกกรมธรรม์"); err(e2.message); }
      };

      const pay = $("#paySave"); if (pay) pay.onclick = async () => {
        const no = pay.dataset.no, amount = Number($("#payAmt").value || 0), date = $("#payDate").value, channel = $("#payCh").value;
        if (!amount || !date) return toast("กรอกวันที่และจำนวนเงิน");
        busy(pay, true, "กำลังบันทึก…");
        try {
          const r = await Api.call("recordPayment", { token: tok, policy_no: no, date, amount, channel });
          full.payments.unshift(r.payment || { policy_no: no, date, amount, channel, status: "ชำระแล้ว" });
          const p = full.policies.find(x => x.policy_no === no); if (r.next_due) p.next_due = r.next_due; if (r.status) p.status = r.status;
          toast("บันทึกการชำระแล้ว งวดถัดไป " + thDate(p.next_due), 4000); form = null; formKey = null; view();
        } catch (e2) { busy(pay, false, "บันทึกการชำระ"); toast(e2.message, 4000); }
      };

      const cl = $("#clSave"); if (cl) cl.onclick = async () => {
        const claim = { policy_no: $("#clPol").value, type: $("#clType").value, date: $("#clDate").value, amount: Number($("#clAmt").value || 0), note: $("#clNote").value.trim(), status: "รอเอกสาร" };
        if (!claim.date) return toast("เลือกวันที่ยื่นเคลม");
        busy(cl, true, "กำลังบันทึก…");
        try { const r = await Api.call("addClaim", { token: tok, claim }); full.claims.unshift(r.claim || claim); toast("บันทึกการเคลมแล้ว"); form = null; view(); }
        catch (e2) { busy(cl, false, "บันทึกการเคลม"); toast(e2.message, 4000); }
      };
      app.querySelectorAll("[data-claim]").forEach(sel => sel.onchange = async () => {
        try { await Api.call("updateClaim", { token: tok, id: sel.dataset.claim, patch: { status: sel.value } });
          const x = full.claims.find(k => k.id === sel.dataset.claim); if (x) x.status = sel.value; toast("อัปเดตสถานะเคลมเป็น " + sel.value); }
        catch (e2) { toast(e2.message, 4000); view(); }
      });
    }

    $("#logout").onclick = logout;
    bindCalc(); bindCustomer();
    app.querySelectorAll("[data-cust]").forEach(b => b.onclick = () => { custId = b.dataset.cust; form = null; formKey = null; view(); window.scrollTo({ top: 0 }); });
    app.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { mode = b.dataset.mode; store.set("dashMode", mode); view(); });
    app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; custId = null; form = null; view(); });
    app.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => { filter = b.dataset.filter; view(); });
    const s = $("#search"); if (s) s.oninput = (e) => { q = e.target.value.trim(); clearTimeout(s._t); s._t = setTimeout(() => { view(); const n = $("#search"); n.focus(); n.setSelectionRange(q.length, q.length); }, 250); };
    app.querySelectorAll("[data-done]").forEach(b => b.onclick = async () => {
      await Api.call("updateTicket", { token: State.session.token, id: b.dataset.done, status: "ตอบแล้ว" });
      const t = d.tickets.find(x => x.id === b.dataset.done); if (t) t.status = "ตอบแล้ว";
      toast("บันทึกว่าตอบแล้ว"); view();
    });

    app.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { editId = b.dataset.edit; view(); $("#agentForm")?.scrollIntoView({ behavior: "smooth", block: "start" }); $("#gName")?.focus({ preventScroll: true }); });
    const aS = $("#aSearch");
    if (aS) {
      const applyFilter = () => {
        // ค้นหาเบอร์โทรได้ทั้งแบบมีขีดและไม่มีขีด เช่น 083-333 หรือ 083333
        const words = aS.value.toLowerCase().trim().split(/\s+/).filter(Boolean).map(w => /^[\d-]+$/.test(w) ? w.replace(/-/g, "") : w);
        const role = $("#aRole").value, onlyInc = $("#aIncomplete").checked;
        let n = 0;
        app.querySelectorAll("[data-agent]").forEach(el => {
          const ok = words.every(w => el.dataset.q.includes(w)) && (!role || el.dataset.role === role) && (!onlyInc || el.dataset.incomplete === "1");
          el.classList.toggle("hidden", !ok); if (ok) n++;
        });
        $("#aCount").textContent = "แสดง " + n + " คน";
        $("#aEmpty").classList.toggle("hidden", n > 0);
        agentFilter = { text: aS.value, role, onlyInc };
      };
      aS.value = agentFilter.text; $("#aRole").value = agentFilter.role; $("#aIncomplete").checked = agentFilter.onlyInc;
      aS.oninput = applyFilter; $("#aRole").onchange = applyFilter; $("#aIncomplete").onchange = applyFilter;
      applyFilter();
    }
    const gc = $("#gCancel"); if (gc) gc.onclick = () => { editId = null; view(); };
    const gs = $("#gSave"); if (gs) gs.onclick = async () => {
      const err = (m) => { $("#gErr").textContent = m; };
      const val = (id) => $(id).value.trim();
      const agent = {
        id: val("#gId").toUpperCase(), name: val("#gName"), role: $("#gRole").value, license_no: val("#gLic"),
        years: Number(val("#gYears") || 0), phone: val("#gPhone").replace(/\D/g, ""), line_url: val("#gLine"), email: val("#gEmail"),
        backup_id: $("#gBackup").value, specialties: val("#gSpec").split(",").map(x => x.trim()).filter(Boolean),
        bio: val("#gBio"), on_duty: $("#gDuty").checked
      };
      const pw = $("#gPw").value, pw2 = $("#gPw2").value;
      if (!/^[A-Z0-9_-]{2,20}$/.test(agent.id)) return err("รหัสตัวแทนใช้ได้เฉพาะตัวอักษรภาษาอังกฤษและตัวเลข 2-20 ตัว เช่น 185382");
      if (!agent.name) return err("กรอกชื่อ-นามสกุล");
      if (agent.line_url && !/^https:\/\//.test(agent.line_url)) return err("ลิงก์ LINE ต้องขึ้นต้นด้วย https://");
      if (!editId && !pw) return err("ตั้งรหัสผ่านเริ่มต้นให้ตัวแทนใหม่");
      if (pw && pw.length < 6) return err("รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร");
      if (/[\u0E00-\u0E7F]/.test(pw)) return err("มีตัวอักษรภาษาไทยในรหัสผ่าน ให้สลับแป้นพิมพ์เป็นภาษาอังกฤษแล้วพิมพ์ใหม่");
      if (pw !== pw2) return err("รหัสผ่านสองช่องไม่ตรงกัน");
      if (editId === full.me.id) agent.role = full.me.role; // เปลี่ยนตำแหน่งของตัวเองไม่ได้
      gs.disabled = true; gs.textContent = "กำลังบันทึก…";
      try {
        const password_hash = pw ? await sha256(pw) : undefined;
        if (editId) {
          const { id, ...patch } = agent;
          await Api.call("updateAgent", { token: State.session.token, id: editId, patch, password_hash });
          Object.assign(agentById[editId], patch, pw ? { has_password: true } : {});
          toast("บันทึกข้อมูล " + agent.name + " แล้ว");
        } else {
          await Api.call("addAgent", { token: State.session.token, agent, password_hash });
          const added = { ...agent, has_password: true }; full.agents.push(added); agentById[agent.id] = added;
          toast("เพิ่ม " + agent.name + " แล้ว แจ้งรหัส " + agent.id + " และรหัสผ่านให้ตัวแทนทาง LINE ส่วนตัว", 6000);
        }
        State.pub = null; // ให้หน้าเว็บสาธารณะโหลดรายชื่อทีมใหม่
        editId = null; view();
      } catch (e2) { gs.disabled = false; gs.textContent = editId ? "บันทึกการแก้ไข" : "เพิ่มตัวแทน"; err(e2.message); }
    };
    const add = $("#addLead"); if (add) add.onclick = async () => {
      const lead = readProfile("l"); const e = profileError(lead);
      if (e) { $("#lErr").textContent = e; return; }
      add.disabled = true; add.textContent = "กำลังบันทึก…";
      try {
        const r = await Api.call("addLead", { token: State.session.token, lead });
        const c = r.customer || { ...lead, id: "new" + Date.now(), type: "ลูกค้ามุ่งหวัง", agent_id: full.me.id };
        full.customers.push(c); custById[c.id] = c;
        toast("เพิ่ม " + c.name + " เป็นลูกค้ามุ่งหวังแล้ว"); view();
      } catch (e2) { add.disabled = false; add.textContent = "เพิ่มลูกค้ามุ่งหวัง"; $("#lErr").textContent = e2.message; }
    };
  };
  view();
}


/* =========================================================
   PWA — ติดตั้งเป็นแอปบนมือถือ
   ========================================================= */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
const PWA = {
  deferred: null,
  standalone: () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true,
  inApp: () => { const u = navigator.userAgent; return /Line\//i.test(u) ? "LINE" : /FBAN|FBAV|FB_IAB/i.test(u) ? "Facebook" : /Instagram/i.test(u) ? "Instagram" : ""; },
  isAndroid: () => /android/i.test(navigator.userAgent),
  isIOS: () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
  dismissed: () => { const t = store.get("installDismissed"); return t && Date.now() - t < 14 * 86400000; },
  show(html, onInstall, label = "ติดตั้ง") {
    if (this.standalone() || this.dismissed() || $(".install-bar")) return;
    const bar = document.createElement("div");
    bar.className = "install-bar"; bar.setAttribute("role", "dialog"); bar.setAttribute("aria-label", "ติดตั้งแอป");
    bar.innerHTML = `<img src="icon-192.png" alt=""><p>${html}</p>
      ${onInstall ? `<button class="btn btn-primary btn-sm" id="pwaInstall">${label}</button>` : ""}
      <button class="x" id="pwaClose" aria-label="ปิด">×</button>`;
    document.body.appendChild(bar);
    $("#pwaClose").onclick = () => { store.set("installDismissed", Date.now()); bar.remove(); };
    if (onInstall) $("#pwaInstall").onclick = onInstall;
  }
};
// Android / Chrome / Edge: ใช้ปุ่มติดตั้งของระบบ
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); PWA.deferred = e;
  PWA.show("<b>ติดตั้งแอปไว้ที่หน้าจอ</b><br>เปิดดูกรมธรรม์และติดต่อตัวแทนได้ในแตะเดียว", async () => {
    PWA.deferred.prompt();
    await PWA.deferred.userChoice; PWA.deferred = null; $(".install-bar")?.remove();
  });
});
window.addEventListener("appinstalled", () => { $(".install-bar")?.remove(); toast("ติดตั้งแอปแล้ว"); });
// iPhone / iPad: Safari ไม่มีปุ่มติดตั้งอัตโนมัติ จึงแสดงวิธีทำ
// เปิดลิงก์จาก LINE/Facebook จะเปิดในเบราว์เซอร์ของแอปนั้น ซึ่งติดตั้งแอปไม่ได้
if (PWA.inApp() && !PWA.standalone()) {
  setTimeout(() => PWA.show(`<b>เปิดใน ${PWA.isIOS() ? "Safari" : "Chrome"} เพื่อติดตั้งแอป</b><br>เบราว์เซอร์ใน ${PWA.inApp()} ติดตั้งแอปไม่ได้`,
    PWA.inApp() === "LINE" ? () => { const u = new URL(location.href); u.searchParams.set("openExternalBrowser", "1"); location.href = u.toString(); } : null, "เปิด"), 1500);
} else if (PWA.isIOS() && !PWA.standalone()) {
  setTimeout(() => PWA.show("<b>ติดตั้งแอปบน iPhone/iPad</b><br>แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรขึ้น) แล้วเลือก \"เพิ่มไปยังหน้าจอโฮม\""), 2500);
}


/* =========================================================
   หน้า "ติดตั้งแอป" + ตรวจสอบอัตโนมัติว่าทำไมติดตั้งไม่ได้
   ========================================================= */
async function renderInstall() {
  const ios = PWA.isIOS(), android = PWA.isAndroid(), inApp = PWA.inApp();
  app.innerHTML = `<section class="block"><div class="wrap article">
    <h1>ติดตั้งแอปบนมือถือ</h1>
    ${PWA.standalone() ? `<div class="notice">คุณกำลังใช้งานในแอปที่ติดตั้งแล้ว</div>` : ""}
    ${inApp ? `<div class="notice" style="margin-bottom:20px"><b>ตอนนี้เปิดอยู่ในเบราว์เซอร์ของ ${inApp}</b> ซึ่งติดตั้งแอปไม่ได้ ${inApp === "LINE" ? `<br><button class="btn btn-primary btn-sm" id="openExt" style="margin-top:10px">เปิดใน ${ios ? "Safari" : "Chrome"}</button>` : `ให้กดเมนู (จุดสามจุด) แล้วเลือก "เปิดในเบราว์เซอร์"`}</div>` : ""}
    ${PWA.deferred ? `<button class="btn btn-primary" id="doInstall" style="margin-bottom:24px">ติดตั้งแอปตอนนี้</button>` : ""}

    <div class="panel" ${ios ? 'style="border-color:var(--teal)"' : ""}><h3>iPhone / iPad</h3><ol>
      <li>เปิดเว็บนี้ด้วย <b>Safari</b> (ถ้าเปิดจาก LINE ให้กดเปิดใน Safari ก่อน)</li>
      <li>แตะปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ด้านล่างหรือด้านบนของจอ</li>
      <li>เลื่อนลงแล้วเลือก <b>เพิ่มไปยังหน้าจอโฮม</b> (Add to Home Screen)</li>
      <li>แตะ <b>เพิ่ม</b> มุมขวาบน ไอคอนจะขึ้นที่หน้าจอโฮม</li></ol></div>

    <div class="panel" ${android ? 'style="border-color:var(--teal)"' : ""}><h3>Android</h3><ol>
      <li>เปิดเว็บนี้ด้วย <b>Chrome</b></li>
      <li>แตะเมนู <b>จุดสามจุด</b> มุมขวาบน</li>
      <li>เลือก <b>ติดตั้งแอป</b> หรือ <b>เพิ่มลงในหน้าจอหลัก</b></li>
      <li>แตะ <b>ติดตั้ง</b> ไอคอนจะขึ้นที่หน้าจอหลักและในรายการแอป</li></ol></div>

    <div class="panel"><h3>ตรวจสอบระบบ</h3><p class="small muted">ถ้าติดตั้งไม่ได้ ส่งภาพหน้าจอส่วนนี้ให้ผู้ดูแลเว็บ</p>
      <ul id="diag" style="list-style:none;padding:0;margin:0"><li class="muted">กำลังตรวจสอบ…</li></ul></div>
  </div></section>`;

  const ext = $("#openExt"); if (ext) ext.onclick = () => { const u = new URL(location.href); u.searchParams.set("openExternalBrowser", "1"); location.href = u.toString(); };
  const di = $("#doInstall"); if (di) di.onclick = async () => { PWA.deferred.prompt(); await PWA.deferred.userChoice; PWA.deferred = null; di.remove(); };

  const checks = [];
  const add = (ok, label, fix) => checks.push(`<li style="padding:8px 0;border-bottom:1px dashed var(--line)">${ok ? statusBadge("ผ่าน") : `<span class="badge b-bad">ไม่ผ่าน</span>`} ${label}${!ok && fix ? `<br><span class="small muted">${fix}</span>` : ""}</li>`);
  const fileOk = async (url, type) => { try { const r = await fetch(url, { cache: "no-store" }); return r.ok && (!type || (r.headers.get("content-type") || "").includes(type)); } catch { return false; } };

  add(location.protocol === "https:", "เปิดผ่าน https", "ต้องเปิดผ่านลิงก์ GitHub Pages ที่ขึ้นต้นด้วย https://");
  add(!inApp, "เปิดในเบราว์เซอร์หลัก (ไม่ใช่ใน LINE/Facebook)", "กดปุ่มเปิดใน Chrome/Safari ด้านบน");
  let manifest = null;
  try { const r = await fetch("manifest.json", { cache: "no-store" }); if (r.ok) manifest = await r.json(); } catch {}
  add(!!manifest, "พบไฟล์ manifest.json", "อัปไฟล์ manifest.json ไว้ที่เดียวกับ index.html");
  for (const f of ["icon-192.png", "icon-512.png", "apple-touch-icon.png"]) {
    add(await fileOk(f, "image"), "พบไอคอน " + f, "อัปไฟล์ไอคอนนี้ไว้ที่เดียวกับ index.html (ชื่อไฟล์ตัวเล็กทั้งหมด)");
  }
  add(await fileOk("sw.js", "javascript"), "พบไฟล์ sw.js", "อัปไฟล์ sw.js ไว้ที่เดียวกับ index.html");
  let swOk = false;
  try { swOk = !!(navigator.serviceWorker && await navigator.serviceWorker.getRegistration()); } catch {}
  add(swOk, "Service Worker ทำงาน", "รีเฟรชหน้านี้ 1 ครั้งแล้วตรวจใหม่ ถ้ายังไม่ผ่านให้เช็กว่ามีไฟล์ sw.js");
  if (Api.live()) {
    let ver = ""; try { State.pub = null; ver = (await loadPublic()).api_version || ""; } catch {}
    add(ver >= REQUIRED_API, "หลังบ้าน (Code.gs) เป็นเวอร์ชันล่าสุด" + (ver ? " (" + ver + ")" : ""),
      "วาง Code.gs ล่าสุดใน Apps Script แล้วกด จัดการการทำให้ใช้งานได้ > ไอคอนดินสอ > เวอร์ชันใหม่ > ทำให้ใช้งานได้");
  }
  $("#diag").innerHTML = checks.join("");
}

/* ---------- boot ---------- */
$("#brandName").firstChild.textContent = CONFIG.TEAM_NAME;
$("#menuBtn").onclick = () => { const n = $("#nav"); const open = n.classList.toggle("open"); $("#menuBtn").setAttribute("aria-expanded", String(open)); };
window.addEventListener("hashchange", router);
router();
