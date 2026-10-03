/* =========================================================
   เว็บทีมตัวแทนประกันชีวิต — app.js
   - ไม่ต้องติดตั้งอะไร ใช้คู่กับ index.html บน GitHub Pages
   - ถ้ายังไม่ใส่ SHEET_API_URL ระบบจะใช้ "ข้อมูลตัวอย่าง" (DEMO)
   - ใส่ URL ของ Google Apps Script (ไฟล์ Code.gs) เพื่อดึงข้อมูลจริงจาก Google Sheet
   ========================================================= */

const REQUIRED_API = "2026-10-03n"; // ต้องตรงกับ CODE_VERSION ใน Code.gs
/* ความยินยอม PDPA: เปลี่ยน CONSENT_VERSION ทุกครั้งที่แก้ข้อความนโยบาย (ต้องตรงกับ Code.gs)
   ลูกค้าจะถูกขอความยินยอมใหม่เมื่อเข้าใช้ครั้งถัดไป */
const CONSENT_VERSION = "1.0";
const CONSENT_ITEMS = [
  { key: "required", required: true, title: "การใช้ข้อมูลเพื่อดูแลกรมธรรม์ (จำเป็น)",
    text: "ข้าพเจ้ารับทราบนโยบายความเป็นส่วนตัว และยินยอมให้ทีมเก็บ ใช้ และเปิดเผยข้อมูลส่วนบุคคลและข้อมูลกรมธรรม์ของข้าพเจ้า แก่ตัวแทนในทีมที่ดูแลและบริษัทประกันภัย เพื่อดูแลกรมธรรม์ ติดตามการชำระเบี้ย และให้บริการผ่านเว็บไซต์นี้" },
  { key: "photo", title: "รูปถ่ายและสำเนาเอกสาร",
    text: "ยินยอมให้เก็บรูปถ่ายและสำเนาเอกสารของข้าพเจ้า เช่น เอกสารกรมธรรม์ ใบเสร็จ เพื่อประกอบการให้บริการ" },
  { key: "health", title: "ข้อมูลสุขภาพ (ข้อมูลอ่อนไหว)",
    text: "ยินยอมให้เก็บและใช้ข้อมูลสุขภาพของข้าพเจ้า เช่น ใบรับรองแพทย์ ผลการรักษา เพื่อช่วยเตรียมเอกสารและติดตามการเคลม" },
  { key: "marketing", title: "ข่าวสารและสิทธิประโยชน์",
    text: "ยินยอมรับข่าวสาร สิทธิประโยชน์ และข้อเสนอผลิตภัณฑ์ประกันภัย ทาง LINE หรือโทรศัพท์" }
];
// เทียบเวอร์ชันความยินยอม (ชีตอาจเก็บ "1.0" เป็นตัวเลข 1)
const consentOk = (v) => { const a = String(v == null ? "" : v).trim(), b = String(CONSENT_VERSION);
  return a !== "" && (a === b || (!isNaN(a) && !isNaN(b) && Number(a) === Number(b))); };
const consentLabel = (k) => ({ required: "ดูแลกรมธรรม์", photo: "รูปถ่าย/เอกสาร", health: "ข้อมูลสุขภาพ", marketing: "ข่าวสาร" }[k] || k);

const CONFIG = {
  SHEET_API_URL: "https://script.google.com/macros/s/AKfycbwqXRavOOeke86CwMWUyUBK9q3WhgaAIXKyTL8UstXb1mTyE0m30wz3ACYMlBBMshmv/exec",            // วาง URL Web App ของ Apps Script ที่นี่ เช่น https://script.google.com/macros/s/xxxx/exec
  TEAM_NAME: "ทีมที่ปรึกษาดูแลดี",
  TEAM_SUBTITLE: "ตัวแทนประกันชีวิต FWD",
  TEAM_LINE_OA: "https://line.me/R/ti/p/@yourteam",   // LINE OA ของทีม
  TEAM_PHONE: "080-000-0000",
  // ช่องทางชำระเบี้ย: ใส่เฉพาะช่องทางทางการของบริษัท และตรวจสอบลิงก์ให้ถูกต้องก่อนเปิดใช้
  // แอป FWD Omne (แอปทางการของ FWD): ดูกรมธรรม์ ชำระเบี้ย ยื่นเคลม
  OMNE: {
    ios: "https://apps.apple.com/th/app/id1621673678",
    android: "https://play.google.com/store/apps/details?id=global.fwd.omne",
    web: "https://www.fwd.co.th/th/omne/1step-registration-support/"
  },
  // ช่องทางชำระเบี้ยทางการของ FWD (ตามเอกสารใบเสนอขายของบริษัท) ตรวจสอบให้เป็นปัจจุบันก่อนใช้
  PAYMENT_CHANNELS: [
    { name: "แอป FWD Omne", detail: "ชำระด้วยบัตรเครดิต/เดบิตได้ในไม่กี่ขั้นตอน", url: "omne" },
    { name: "LINE @fwdthailand เมนู \"ชำระเบี้ยฯ\"", detail: "สร้างบาร์โค้ดเพื่อนำไปชำระที่ธนาคารหรือจุดบริการ", url: "https://line.me/R/ti/p/@fwdthailand" },
    { name: "สาขาธนาคาร", detail: "ไทยพาณิชย์ กรุงเทพ กรุงศรีอยุธยา กสิกรไทย ออมสิน กรุงไทย ทหารไทยธนชาต ซีไอเอ็มบีไทย ใช้ใบเรียกเก็บหรือบาร์โค้ด", url: "" },
    { name: "เคาน์เตอร์เซอร์วิส 7-Eleven และโลตัส", detail: "ชำระด้วยเงินสดยอดไม่เกิน 49,000 บาท", url: "" },
    { name: "สำนักงานใหญ่ หรือบัตรเครดิต", detail: "สอบถามรายละเอียดกับตัวแทนของคุณ", url: "" }
  ],

  REMIND_DAYS: 30               // แสดงรายการเบี้ยที่ครบกำหนดภายในกี่วัน
};

/* ---------- utilities ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const baht = (n) => Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 }) + " บาท"; // รูปแบบ 1,000 บาท
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
    "รอชำระ": "b-warn", "รออนุมัติ": "b-warn", "ยกเลิก": "b-bad", "นำเสนอ": "b-info", "ยังไม่นำเสนอ": "b-mute", "รอพิจารณา": "b-warn", "รอเอกสาร": "b-warn", "รอตอบ": "b-warn", "ลูกค้ามุ่งหวัง": "b-info",
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
const POLICY_STATUS = ["นำเสนอ", "รออนุมัติ", "มีผลบังคับ", "รอชำระ", "ขาดอายุ", "ยกเลิก"];
// สถานะที่ยังไม่ใช่การขาย/ไม่มีผลแล้ว: ไม่นับในยอดเบี้ย ไม่เตือนชำระ
const NOT_ACTIVE = ["นำเสนอ", "ขาดอายุ", "ยกเลิก"];
const isActivePolicy = (p) => !NOT_ACTIVE.includes(p.status);
const CLOSED_STATUS = "มีผลบังคับ";
const PENDING = ["นำเสนอ", "รออนุมัติ"]; // ใบเสนอที่ยังไม่ปิดการขาย
// ต้องปิดการขายผ่านปุ่ม "ปิดการขาย" (บันทึกเบี้ยงวดแรกก่อน): ใบเสนอที่ยังไม่ปิด หรือกรมธรรม์ใหม่ของลูกค้ามุ่งหวัง
/* สถานะการขายของลูกค้าแต่ละราย (ใช้ในรายชื่อลูกค้าและรายงาน)
   ลูกค้ามุ่งหวัง: ยังไม่นำเสนอ > นำเสนอ > รออนุมัติ (หรือ ยกเลิก ถ้าทุกใบเสนอยกเลิก)
   ลูกค้า: มีผลบังคับ (ถ้ามีกรมธรรม์ที่มีผลบังคับอย่างน้อย 1 ฉบับ) หรือสถานะที่สำคัญที่สุดของกรมธรรม์ */
const SALE_STAGES = ["ยังไม่นำเสนอ", "นำเสนอ", "รออนุมัติ", "มีผลบังคับ", "รอชำระ", "ขาดอายุ", "ยกเลิก"];
function saleStage(c, policies) {
  const st = policies.filter(p => p.customer_id === c.id).map(p => p.status);
  if (c.type === "ลูกค้า") {
    for (const k of ["มีผลบังคับ", "รอชำระ", "รออนุมัติ", "นำเสนอ", "ขาดอายุ", "ยกเลิก"]) if (st.includes(k)) return k;
    return "มีผลบังคับ"; // ลูกค้าเดิมที่ยังไม่ได้บันทึกกรมธรรม์ในระบบ
  }
  return st.includes("รออนุมัติ") ? "รออนุมัติ" : st.includes("นำเสนอ") ? "นำเสนอ" : st.length ? "ยกเลิก" : "ยังไม่นำเสนอ";
}
const saleBadge = (c, policies) => {
  const stage = saleStage(c, policies);
  const extra = c.type === "ลูกค้า" ? policies.filter(p => p.customer_id === c.id && PENDING.includes(p.status)).length : 0;
  return statusBadge(stage) + (extra ? `<br><span class="small muted">ใบเสนอใหม่ ${extra} ชุด</span>` : "");
};
/* ลำดับใบเสนอของลูกค้าแต่ละราย (ชุดที่ 1, 2, ...) เรียงตามลำดับที่บันทึก ใช้ตรงกันทั้งหน้าลูกค้าและรายงาน */
const PROPOSAL_FAMILY = ["นำเสนอ", "รออนุมัติ", "ยกเลิก"];
const proposalsOf = (customerId, policies) => policies.filter(p => p.customer_id === customerId && PROPOSAL_FAMILY.includes(p.status));
const setNoOf = (p, policies) => { const i = proposalsOf(p.customer_id, policies).indexOf(p); return i < 0 ? 0 : i + 1; };
const needsClose = (p, isLead) => PENDING.includes(p.status) || (!p.policy_no && isLead); // ปิดการขาย: เปลี่ยนลูกค้ามุ่งหวังเป็นลูกค้าเมื่อกรมธรรม์มีผลบังคับเท่านั้น
const MAX_RIDERS = 5;
/* เลขที่ชั่วคราว: ระบบออกให้อัตโนมัติ TMP-000001, TMP-000002, ... ใช้จนกว่าจะได้เลขกรมธรรม์จริง */
const TEMP_PREFIX = "TMP-";
const isTempNo = (no) => String(no || "").toUpperCase().startsWith(TEMP_PREFIX);
const nextTempNo = (list) => TEMP_PREFIX + String(list.reduce((m, p) => { const x = String(p.policy_no || "").match(/^TMP-(\d+)$/i); return x ? Math.max(m, +x[1]) : m; }, 0) + 1).padStart(6, "0");
/* จำนวนเงิน: ช่องกรอกแสดงแบบ 1,000 แต่เก็บเป็นตัวเลข */
const money = (v) => Number(String(v ?? "").replace(/[^\d.]/g, "")) || 0;
const fmtMoney = (v) => { const n = money(v); return n ? n.toLocaleString("th-TH", { maximumFractionDigits: 2 }) : ""; };
const moneyInput = (id, v, extra = "") => `<input id="${id}" value="${fmtMoney(v)}" inputmode="decimal" data-money autocomplete="off" ${extra}>`;
/* สัญญาเพิ่มเติม (สูงสุด 5) เก็บใน Sheet เป็น rider1_name, rider1_sum, rider1_premium ... rider5_* */
const ridersOf = (p) => {
  const out = [];
  for (let i = 1; i <= MAX_RIDERS; i++) { const n = String(p["rider" + i + "_name"] || "").trim(); if (n) out.push({ name: n, sum: money(p["rider" + i + "_sum"]), premium: money(p["rider" + i + "_premium"]) }); }
  return out;
};
const ridersAnnual = (p) => ridersOf(p).reduce((s, r) => s + r.premium, 0);
const totalAnnual = (p) => annualPremium(p) + ridersAnnual(p);                      // เบี้ยประกันภัยรายปี รวมสัญญาหลัก + สัญญาเพิ่มเติม
const installmentTotal = (p) => totalAnnual(p) * (MODE_MONTHS[p.mode] || 12) / 12;  // เบี้ยต่องวด รวมทุกสัญญา
const riderPremiumText = (n) => n ? baht(n) : "ฟรี";
/* ตารางสรุปเบี้ยประกันภัยรายปี: สัญญาหลัก + สัญญาเพิ่มเติม + ยอดรวม */
const premTable = (p) => { const rs = ridersOf(p), m = MODE_MONTHS[p.mode] || 12;
  return `<div class="table-wrap prem-table"><table>
    <thead><tr><th>สัญญา</th><th class="num">ทุนประกันภัย</th><th class="num">เบี้ยประกันภัยรายปี</th></tr></thead>
    <tbody><tr><td>สัญญาหลัก: ${esc(p.plan)}</td><td class="num">${baht(p.sum_assured)}</td><td class="num">${baht(annualPremium(p))}</td></tr>
    ${rs.map(r => `<tr><td>สัญญาเพิ่มเติม: ${esc(r.name)}</td><td class="num">${r.sum ? baht(r.sum) : "-"}</td><td class="num">${r.premium ? baht(r.premium) : '<span class="badge b-ok">ฟรี</span>'}</td></tr>`).join("")}</tbody>
    <tfoot><tr><th>รวมเบี้ยประกันภัยรายปี</th><th></th><th class="num">${baht(totalAnnual(p))}</th></tr>
    ${m !== 12 ? `<tr><td class="small muted">เบี้ยต่องวด (${esc(p.mode)}) รวมทุกสัญญา</td><td></td><td class="num small">${baht(installmentTotal(p))}</td></tr>` : ""}</tfoot>
  </table></div>`; };
const CLAIM_TYPES = ["ผู้ป่วยใน", "ผู้ป่วยนอก", "อุบัติเหตุ", "โรคร้ายแรง", "เสียชีวิต", "อื่นๆ"];
const CLAIM_STATUS = ["รอเอกสาร", "รอพิจารณา", "อนุมัติ", "ไม่อนุมัติ"];
const PAY_CHANNELS = ["แอปหรือเว็บไซต์บริษัท", "หักบัญชีอัตโนมัติ", "บัตรเครดิต", "เคาน์เตอร์ธนาคาร/เซอร์วิส", "อื่นๆ"];
const annualPremium = (p) => money(p.premium) * (12 / (MODE_MONTHS[p.mode] || 12));
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
document.addEventListener("input", (e) => {
  const el = e.target; if (!el.matches || !el.matches("[data-money]")) return;
  const before = el.value, caret = el.selectionStart ?? before.length;
  const digitsBefore = before.slice(0, caret).replace(/[^\d.]/g, "").length;
  const clean = before.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
  const [i, d] = clean.split(".");
  const out = (i ? Number(i).toLocaleString("en-US") : (d !== undefined ? "0" : "")) + (d !== undefined ? "." + d.slice(0, 2) : "");
  if (out === before) return;
  el.value = out;
  let pos = 0, seen = 0; while (pos < out.length && seen < digitsBefore) { if (/[\d.]/.test(out[pos])) seen++; pos++; }
  try { el.setSelectionRange(pos, pos); } catch {}
}, true);
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
  hidden.dispatchEvent(new Event("input", { bubbles: true })); hidden.dispatchEvent(new Event("change", { bubbles: true }));
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
    { policy_no: "P-10001", customer_id: "C001", plan: "ประกันสุขภาพเหมาจ่าย", sum_assured: 5000000, premium: 28500, mode: "รายปี", start_date: "2022-05-01", next_due: isoIn(9), status: "มีผลบังคับ", payment_years: 99, coverage_end: "2084-05-01", beneficiary: "นายมานะ มีสุข (สามี)", riders: "", sold_by: "A02", note: "", coverage_term: "ถึงอายุ 99 ปี",
      rider1_name: "ค่ารักษาผู้ป่วยนอก OPD", rider1_sum: 2000, rider1_premium: 6800, rider2_name: "อุบัติเหตุ PA", rider2_sum: 500000, rider2_premium: 0 },
    { policy_no: "P-10002", customer_id: "C001", plan: "ประกันชีวิตสะสมทรัพย์ 15 ปี", sum_assured: 1000000, premium: 6200, mode: "รายเดือน", start_date: "2023-01-15", next_due: isoIn(21), status: "มีผลบังคับ" },
    { policy_no: "P-10003", customer_id: "C002", plan: "ประกันโรคร้ายแรง", sum_assured: 2000000, premium: 15400, mode: "รายปี", start_date: "2021-08-10", next_due: isoIn(-3), status: "รอชำระ" },
    { policy_no: "P-10004", customer_id: "C003", plan: "ประกันชีวิตลดหย่อนภาษี", sum_assured: 800000, premium: 32000, mode: "รายปี", start_date: "2024-02-01", next_due: isoIn(120), status: "มีผลบังคับ" },
    // ตัวอย่างใบเสนอของลูกค้ามุ่งหวัง
    { policy_no: "TMP-000001", customer_id: "C004", plan: "FWD Easy E-Saving 15/7", sum_assured: 1000000, premium: 120000, mode: "รายปี", start_date: "", next_due: "", status: "นำเสนอ",
      coverage_term: "15 ปี", payment_years: 7, beneficiary: "", sold_by: "A03", note: "", rider1_name: "สุขภาพเหมาจ่าย Precious Care", rider1_sum: 5000000, rider1_premium: 28900, rider2_name: "อุบัติเหตุ PA", rider2_sum: 500000, rider2_premium: 0 },
    { policy_no: "TMP-000002", customer_id: "C004", plan: "FWD Life Annuity 60/85", sum_assured: 2000000, premium: 8500, mode: "รายเดือน", start_date: "", next_due: "", status: "นำเสนอ",
      coverage_term: "ถึงอายุ 85 ปี", payment_years: 12, beneficiary: "", sold_by: "A03", note: "" },
    { policy_no: "TMP-000003", customer_id: "C005", plan: "FWD Smart Kids Education", sum_assured: 500000, premium: 36000, mode: "รายปี", start_date: "", next_due: "", status: "รออนุมัติ",
      coverage_term: "ถึงอายุ 25 ปี", payment_years: 10, beneficiary: "นางดวงใจ อิ่มเอม (มารดา)", sold_by: "A04", note: "", rider1_name: "ค่ารักษาผู้ป่วยใน เด็ก", rider1_sum: 1000000, rider1_premium: 12500 },
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
      // จำกัดเวลารอ: หลังบ้านไม่ตอบใน 40 วินาที ให้แจ้งผู้ใช้แทนการค้างหน้า "กำลังโหลด"
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), action === "uploadQuote" || action === "uploadAgentPhoto" ? 120000 : 40000) : null;
      let res;
      try {
        res = await fetch(CONFIG.SHEET_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action, ...payload }),
          signal: ctrl ? ctrl.signal : undefined
        });
      } catch (netErr) {
        throw new Error(netErr.name === "AbortError" ? "หลังบ้าน (Google Apps Script) ไม่ตอบสนอง ลองกดโหลดใหม่อีกครั้ง" : "เชื่อมต่อหลังบ้านไม่ได้ ตรวจสอบอินเทอร์เน็ต หรือการ Deploy ของ Apps Script");
      } finally { if (timer) clearTimeout(timer); }
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); }
      catch { throw new Error(/<html|<!DOCTYPE/i.test(raw) ? "หลังบ้านตอบกลับเป็นหน้าเว็บของ Google แทนข้อมูล: Apps Script อาจยังไม่ได้อนุญาตสิทธิ์ใหม่ หรือการ Deploy ไม่ได้ตั้งเป็น \"ทุกคน\"" : "ข้อมูลจากหลังบ้านไม่ถูกต้อง"); }
      if (data.error) throw new Error(data.error);
      return data;
    } catch (e) {
      if (/ให้ความยินยอม/.test(e.message) && State.consentAt && Date.now() - State.consentAt < 15000) {
        // เพิ่งให้ความยินยอมแต่ระบบยังยืนยันไม่ได้: ไม่พากลับหน้าเดิมซ้ำ (กันวนไม่รู้จบ)
        throw new Error("บันทึกความยินยอมแล้ว แต่ระบบยังยืนยันไม่ได้ กรุณาออกจากระบบแล้วเข้าใหม่ หรือแจ้งตัวแทนของคุณ");
      }
      if (/ให้ความยินยอม/.test(e.message) && State.session && State.session.role === "customer" && !/consent/.test(location.hash)) {
        State.session.consent_ok = false; sessionStore.set(State.session); location.hash = "#/consent";
      }
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
        return { token: "demo-" + c.id, role: "customer", user_id: c.id, name: c.name, must_change: !!c.must_change, consent_ok: consentOk(c.consent_version) };
    }
    throw new Error("เบอร์โทร/รหัสตัวแทน หรือรหัสผ่านไม่ถูกต้อง");
  },
  customerData({ token }) {
    const id = token.replace("demo-", "");
    const me = DEMO.customers.find(c => c.id === id);
    if (!me) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
    if (!consentOk(me.consent_version)) throw new Error("กรุณาให้ความยินยอมก่อนใช้งาน");
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
  giveConsent({ token, version, items }) {
    const c = DEMO.customers.find(x => x.id === token.replace("demo-", ""));
    Object.assign(c, { consent_version: version, consent_items: items.join(","), consent_at: new Date().toISOString() }); return { ok: true };
  },
  withdrawConsent({ token }) {
    const c = DEMO.customers.find(x => x.id === token.replace("demo-", "")); Object.assign(c, { consent_version: "", consent_items: "" }); return { ok: true };
  },
  logout() { return { ok: true }; },
  health() { return { api_version: REQUIRED_API, schema_missing: [] }; },
  updateCustomer({ id, patch, password_hash }) {
    const c = DEMO.customers.find(x => x.id === id); Object.assign(c, patch); if (password_hash) { c.password = "demo"; c.must_change = true; }
    return { ok: true };
  },
  addPolicy({ policy }) {
    if (!policy.policy_no) policy = { ...policy, policy_no: nextTempNo(DEMO.policies) };
    if (DEMO.policies.some(p => p.policy_no === policy.policy_no)) throw new Error("เลขกรมธรรม์ " + policy.policy_no + " มีอยู่แล้ว");
    const c = DEMO.customers.find(x => x.id === policy.customer_id);
    const pol = { ...policy, sold_by: c.agent_id }; DEMO.policies.push(pol);
    const converted = c.type !== "ลูกค้า" && pol.status === CLOSED_STATUS; if (converted) c.type = "ลูกค้า";
    return { ok: true, policy: pol, converted };
  },
  updatePolicy({ policy_no, patch, new_policy_no }) {
    const p = DEMO.policies.find(x => x.policy_no === policy_no);
    if (new_policy_no && new_policy_no !== policy_no) {
      if (DEMO.policies.some(x => x.policy_no === new_policy_no)) throw new Error("เลขกรมธรรม์ " + new_policy_no + " มีอยู่แล้ว");
      [DEMO.payments, DEMO.claims].forEach(list => list.forEach(x => { if (x.policy_no === policy_no) x.policy_no = new_policy_no; }));
      p.policy_no = new_policy_no;
    }
    Object.assign(p, patch);
    const c = DEMO.customers.find(x => x.id === p.customer_id); const converted = c && c.type !== "ลูกค้า" && p.status === CLOSED_STATUS;
    if (converted) c.type = "ลูกค้า"; return { ok: true, converted };
  },
  uploadCustomerPhoto({ token, customer_id, data }) {
    const id = customer_id || token.replace("demo-", ""); const c = DEMO.customers.find(x => x.id === id);
    if (!String(c.consent_items || "").split(",").includes("photo")) throw new Error("ลูกค้ายังไม่ได้ยินยอมให้เก็บรูปถ่าย");
    DEMO.photos = DEMO.photos || {}; DEMO.photos[id] = data; c.photo_file_id = "demo-" + id; return { ok: true, photo_file_id: c.photo_file_id };
  },
  getCustomerPhoto({ token, customer_id }) { const id = customer_id || token.replace("demo-", ""); return { data: (DEMO.photos || {})[id] }; },
  removeCustomerPhoto({ token, customer_id }) { const id = customer_id || token.replace("demo-", ""); DEMO.customers.find(x => x.id === id).photo_file_id = ""; return { ok: true }; },
  uploadAgentPhoto({ id, data }) {
    const a = DEMO.agents.find(x => x.id === id); const photo_url = "data:image/jpeg;base64," + data;
    Object.assign(a, { photo_url, photo_file_id: "demo" }); return { ok: true, photo_url, photo_file_id: "demo" };
  },
  removeAgentPhoto({ id }) { Object.assign(DEMO.agents.find(x => x.id === id), { photo_url: "", photo_file_id: "" }); return { ok: true }; },
  uploadQuote({ policy_no, name, quote_no, data }) {
    const p = DEMO.policies.find(x => x.policy_no === policy_no); DEMO.files = DEMO.files || {};
    const id = "demo-file-" + Date.now(); DEMO.files[id] = { name, data };
    const fields = { quote_file_id: id, quote_file_name: name, quote_uploaded: isoIn(0), quote_no };
    Object.assign(p, fields); return { ok: true, fields };
  },
  getQuote({ policy_no }) {
    const p = DEMO.policies.find(x => x.policy_no === policy_no); const f = (DEMO.files || {})[p && p.quote_file_id];
    if (!f) throw new Error("ไม่พบไฟล์ (โหมดตัวอย่างเก็บไฟล์ไว้ชั่วคราวเท่านั้น)"); return { name: f.name, mime: "application/pdf", data: f.data };
  },
  deleteQuote({ policy_no }) {
    const fields = { quote_file_id: "", quote_file_name: "", quote_uploaded: "", quote_no: "" };
    Object.assign(DEMO.policies.find(x => x.policy_no === policy_no), fields); return { ok: true, fields };
  },
  closeSale({ policy_no, new_policy_no, patch, payment }) {
    const p = DEMO.policies.find(x => x.policy_no === policy_no);
    if (!PENDING.includes(p.status)) throw new Error("ใบเสนอนี้ไม่อยู่ในสถานะที่ปิดการขายได้");
    if (new_policy_no !== policy_no) {
      if (DEMO.policies.some(x => x.policy_no === new_policy_no)) throw new Error("เลขกรมธรรม์ " + new_policy_no + " มีอยู่แล้ว");
      [DEMO.payments, DEMO.claims].forEach(l => l.forEach(x => { if (x.policy_no === policy_no) x.policy_no = new_policy_no; }));
    }
    Object.assign(p, patch, { policy_no: new_policy_no, status: CLOSED_STATUS, next_due: addMonths(patch.start_date, MODE_MONTHS[p.mode] || 12) });
    const pm = { id: "PM" + Date.now(), policy_no: new_policy_no, date: payment.date, amount: payment.amount, channel: payment.channel + " (เบี้ยงวดแรก)", status: "ชำระแล้ว" };
    DEMO.payments.unshift(pm);
    const c = DEMO.customers.find(x => x.id === p.customer_id); const converted = c.type !== "ลูกค้า"; c.type = "ลูกค้า";
    return { ok: true, policy: { ...p }, payment: pm, converted };
  },
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

/* ข้อมูลหน้าเว็บสาธารณะ (ทีม บทความ คำถาม): แสดงจากที่จำไว้ในเครื่องก่อนทันที แล้วโหลดใหม่เบื้องหลัง */
async function loadPublic() {
  if (State.pub) return State.pub;
  const cached = store.get("pubCache");
  const fresh = () => Api.call("public").then(d => { State.pub = d; store.set("pubCache", { at: Date.now(), d }); return d; });
  if (cached && cached.d && Date.now() - cached.at < 24 * 3600000) {
    State.pub = cached.d;
    if (Date.now() - cached.at > 60000) fresh().catch(() => {}); // เก่ากว่า 1 นาที: อัปเดตเบื้องหลัง
    return State.pub;
  }
  return fresh();
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
  "password": renderPassword,
  "consent": renderConsent
};

async function router() {
  const [path, param] = location.hash.replace(/^#\/?/, "").split("/");
  const fn = routes[path] || renderHome;
  $("#nav").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false");
  document.querySelectorAll(".nav a").forEach(a => a.toggleAttribute("aria-current", a.getAttribute("href") === "#/" + (path || "")));
  if (a11yNavMember()) {}
  const slow = setTimeout(() => { const l = app.querySelector(".loading"); if (l && !l.querySelector(".error")) l.innerHTML = "กำลังเชื่อมต่อกับระบบ…<br><span class=\"small\">ครั้งแรกหลังไม่มีการใช้งานสักพัก Google จะใช้เวลาเริ่มระบบ 5-15 วินาที</span>"; }, 4000);
  try {
    app.innerHTML = `<div class="loading">กำลังโหลด…</div>`;
    await fn(param);
  } catch (e) {
    app.innerHTML = `<div class="wrap loading"><p class="error">${esc(e.message)}</p><div class="btn-row" style="justify-content:center"><button class="btn btn-primary" type="button" onclick="location.reload()">โหลดใหม่</button><a class="btn btn-ghost" href="#/">กลับหน้าแรก</a></div></div>`;
  } finally { clearTimeout(slow); }
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
      location.hash = s.must_change ? "#/password" : s.role === "agent" ? "#/dashboard" : s.consent_ok === false ? "#/consent" : "#/portal";
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
/* =========================================================
   ความยินยอม PDPA (ลูกค้า): ขอเมื่อเข้าใช้ครั้งแรก และจัดการ/ถอนได้ทุกเมื่อ
   ========================================================= */
function privacyNoticeHtml() {
  return `<div class="pn">
    <p><b>ผู้ควบคุมข้อมูลส่วนบุคคล:</b> ${esc(CONFIG.TEAM_NAME)} (${esc(CONFIG.TEAM_SUBTITLE)}) ติดต่อ โทร ${esc(CONFIG.TEAM_PHONE)} หรือ LINE ของทีม</p>
    <p><b>ข้อมูลที่เก็บ:</b> ชื่อ-นามสกุล เบอร์โทร วันเกิด เพศ อาชีพ รายได้โดยประมาณ ข้อมูลกรมธรรม์ ประวัติการชำระเบี้ย การเคลม และข้อความที่คุณส่งผ่านเว็บไซต์ รวมถึงรูปถ่าย เอกสาร และข้อมูลสุขภาพ เฉพาะเมื่อคุณให้ความยินยอม</p>
    <p><b>วัตถุประสงค์:</b> ดูแลกรมธรรม์ แจ้งเตือนการชำระเบี้ย ช่วยเหลือเรื่องการเคลม ตอบคำถาม และส่งข่าวสาร (เฉพาะเมื่อยินยอม)</p>
    <p><b>ผู้รับข้อมูล:</b> ตัวแทนในทีมที่ดูแลคุณ ตัวแทนสำรอง หัวหน้าทีม และบริษัทประกันภัยที่ออกกรมธรรม์ ทีมไม่ขายหรือให้ข้อมูลแก่บุคคลอื่นเพื่อการตลาด</p>
    <p><b>การเก็บรักษา:</b> เก็บในระบบที่จำกัดสิทธิ์การเข้าถึง ตลอดอายุกรมธรรม์ และอีกไม่เกิน 10 ปีหลังกรมธรรม์สิ้นสุด หรือตามที่กฎหมายกำหนด</p>
    <p><b>สิทธิของคุณ:</b> ขอเข้าถึงหรือขอสำเนา ขอแก้ไข ขอลบ ขอระงับการใช้ คัดค้าน และถอนความยินยอมได้ทุกเมื่อ (ถอนได้ที่หน้า "ความยินยอมของฉัน") และร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคลได้</p>
    <p class="small muted">การถอนความยินยอมไม่กระทบการใช้ข้อมูลที่ทำไปก่อนหน้า และไม่กระทบความคุ้มครองตามกรมธรรม์กับบริษัทประกันภัย</p>
  </div>`;
}
async function renderConsent() {
  const s = State.session;
  if (!s || s.role !== "customer") { location.hash = "#/login"; return; }
  if (s.must_change) { location.hash = "#/password"; return; }
  let cur = null; // ความยินยอมปัจจุบัน (โหมดจัดการ)
  if (s.consent_ok) { try { cur = (await Api.call("customerData", { token: s.token })).me; } catch { return; } }
  const given = new Set(String(cur && cur.consent_items || "").split(",").filter(Boolean));
  const manage = !!s.consent_ok;
  app.innerHTML = `<section class="block"><div class="wrap article consent">
    <h1>${manage ? "ความยินยอมของฉัน" : "ก่อนเริ่มใช้งาน"}</h1>
    <p class="muted">${manage ? `ให้ความยินยอมล่าสุดเมื่อ ${cur && cur.consent_at ? thDateLong(String(cur.consent_at).slice(0, 10)) : "-"} ปรับเปลี่ยนหรือถอนได้ทุกเมื่อ` : `สวัสดี${/^คุณ/.test(s.name || "") ? "" : "คุณ"}${esc(s.name || "")} เพื่อคุ้มครองข้อมูลส่วนบุคคลของคุณตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA) โปรดอ่านและให้ความยินยอมก่อนเข้าดูข้อมูลกรมธรรม์`}</p>
    <details class="panel" ${manage ? "" : "open"}><summary>นโยบายความเป็นส่วนตัว (ฉบับที่ ${CONSENT_VERSION})</summary>${privacyNoticeHtml()}</details>
    <div class="panel consent-items">
      ${CONSENT_ITEMS.map(it => `<label class="consent-item ${it.required ? "is-req" : ""}">
        <input type="checkbox" data-consent="${it.key}" ${!manage || given.has(it.key) ? (it.required && !manage ? "" : given.has(it.key) ? "checked" : "") : ""}>
        <span><b>${esc(it.title)}</b>${it.required ? ' <span class="badge b-warn">จำเป็น</span>' : ' <span class="badge b-mute">เลือกได้</span>'}<br><span class="small">${esc(it.text)}</span></span></label>`).join("")}
    </div>
    <p class="error" id="cnErr" role="alert"></p>
    <div class="btn-row">
      <button class="btn btn-primary" id="cnSave" type="button">${manage ? "บันทึกการเปลี่ยนแปลง" : "ยินยอมและเข้าใช้งาน"}</button>
      ${manage ? `<a class="btn btn-ghost" href="#/portal">กลับ</a><button class="btn btn-ghost quote-del" id="cnWithdraw" type="button">ถอนความยินยอมทั้งหมด</button>`
        : `<button class="btn btn-ghost" id="cnDecline" type="button">ไม่ยินยอม</button><button class="btn btn-ghost" id="cnLogout" type="button">ออกจากระบบ</button>`}
    </div>
    <p class="small muted" style="margin-top:16px">ข้อความนี้เป็นแบบร่างของทีม ควรให้ฝ่ายกฎหมายหรือฝ่ายกำกับดูแลของบริษัทตรวจสอบก่อนใช้งานจริง</p>
  </div></section>`;
  const items = () => [...app.querySelectorAll("[data-consent]")].filter(x => x.checked).map(x => x.dataset.consent);
  $("#cnSave").onclick = async () => {
    const sel = items();
    if (!sel.includes("required")) { $("#cnErr").textContent = manage ? 'ถ้าต้องการถอนความยินยอมข้อที่จำเป็น ให้กด "ถอนความยินยอมทั้งหมด"' : "ต้องให้ความยินยอมข้อแรก (จำเป็น) จึงจะเข้าดูข้อมูลกรมธรรม์ได้"; return; }
    const btn = $("#cnSave"); btn.disabled = true; btn.textContent = "กำลังบันทึก…";
    try {
      await Api.call("giveConsent", { token: s.token, version: CONSENT_VERSION, items: sel });
      s.consent_ok = true; sessionStore.set(s); State.consentAt = Date.now(); toast(manage ? "บันทึกความยินยอมแล้ว" : "ขอบคุณที่ให้ความยินยอม", 3000); location.hash = "#/portal";
    } catch (e) { btn.disabled = false; btn.textContent = manage ? "บันทึกการเปลี่ยนแปลง" : "ยินยอมและเข้าใช้งาน"; $("#cnErr").textContent = e.message; }
  };
  const decline = async (withdraw) => {
    if (!confirm(withdraw ? "ถอนความยินยอมทั้งหมด? คุณจะเข้าดูข้อมูลกรมธรรม์ผ่านเว็บไม่ได้ จนกว่าจะให้ความยินยอมใหม่ (ความคุ้มครองตามกรมธรรม์ไม่เปลี่ยนแปลง)" : "ไม่ยินยอม? คุณจะยังเข้าดูข้อมูลผ่านเว็บไม่ได้ ติดต่อตัวแทนของคุณได้ตามปกติ")) return;
    if (withdraw) { try { await Api.call("withdrawConsent", { token: s.token }); } catch (e) { toast(e.message, 4000); return; } }
    logout(withdraw ? "ถอนความยินยอมแล้ว หากต้องการใช้งานอีกครั้ง เข้าสู่ระบบแล้วให้ความยินยอมใหม่ได้ทุกเมื่อ" : "คุณยังไม่ได้ให้ความยินยอม จึงยังเข้าดูข้อมูลผ่านเว็บไม่ได้ ติดต่อตัวแทนของคุณได้ทาง LINE หรือโทรศัพท์");
  };
  if ($("#cnDecline")) $("#cnDecline").onclick = () => decline(false);
  if ($("#cnLogout")) $("#cnLogout").onclick = () => logout();
  if ($("#cnWithdraw")) $("#cnWithdraw").onclick = () => decline(true);
}

function requireRole(role) {
  if (!State.session || State.session.role !== role) { location.hash = "#/login"; return false; }
  if (State.session.must_change) { location.hash = "#/password"; return false; }
  if (role === "customer" && State.session.consent_ok === false) { location.hash = "#/consent"; return false; }
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
      location.hash = agent ? "#/dashboard" : s.consent_ok === false ? "#/consent" : "#/portal";
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
  const upcoming = [...d.policies].filter(p => p.next_due && isActivePolicy(p) && p.status !== "รออนุมัติ").sort((a, b) => new Date(a.next_due) - new Date(b.next_due))[0];
  let tab = "overview";

  const view = () => {
    const tabs = [["overview", "ภาพรวม"], ["policies", "กรมธรรม์"], ["pay", "การชำระเบี้ย"], ["claims", "การเคลม"], ["contact", "สอบถาม/แจ้งปัญหา"]];
    app.innerHTML = `<div class="wrap">
      <div class="app-head"><div><h1 style="margin:0;font-size:1.8rem">สวัสดี ${esc(d.me.name)}</h1><span class="muted small">ข้อมูลอัปเดตจากทีมตัวแทน ยึดเอกสารของบริษัทเป็นหลัก</span></div>
      <div class="btn-row"><a class="btn btn-ghost btn-sm" href="#/password">เปลี่ยนรหัสผ่าน</a><button class="btn btn-ghost btn-sm" id="logout">ออกจากระบบ</button></div></div>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join("")}</div>
      <div id="tabBody" style="padding-bottom:48px">${portalTab(tab, d, upcoming)}</div></div>`;
    bindCustomerPhoto(d.me, "", view);
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
    const cItems = String(d.me.consent_items || "").split(",").filter(Boolean);
    const consentPanel = `<div class="panel consent-mini"><div><h3 style="margin:0 0 4px">ความยินยอมของฉัน (PDPA)</h3>
      <p class="small muted" style="margin:0">ให้ความยินยอม: ${cItems.map(k => esc(consentLabel(k))).join(", ") || "-"}${d.me.consent_at ? " เมื่อ " + thDate(String(d.me.consent_at).slice(0, 10)) : ""}</p></div>
      <a class="btn btn-ghost btn-sm" href="#/consent">จัดการความยินยอม</a></div>`;
    const days = upcoming ? daysUntil(upcoming.next_due) : null;
    const openClaims = d.claims.filter(c => !["อนุมัติ", "ไม่อนุมัติ"].includes(c.status));
    return `
      ${upcoming ? `<div class="panel due-hero">
        <div><h3>${days < 0 ? "เลยกำหนดชำระเบี้ยแล้ว" : "งวดชำระถัดไป"}</h3>
          <p style="margin:0">${esc(upcoming.plan)} (${esc(upcoming.policy_no)})<br><b>${baht(installmentTotal(upcoming))}</b> ครบกำหนด ${thDate(upcoming.next_due)}</p>
          <button class="btn btn-primary btn-sm" style="margin-top:12px" data-goto="pay">ดูช่องทางชำระ</button></div>
        <div class="days">${Math.abs(days)}<small>${days < 0 ? "วันที่เลยมา" : "วันก่อนครบกำหนด"}</small></div></div>` : ""}
      <div class="kpis">
        <div class="kpi"><b>${d.policies.length}</b>กรมธรรม์</div>
        <div class="kpi"><b>${baht(d.policies.reduce((s, p) => s + Number(p.sum_assured || 0), 0)).replace(" บาท", "")}</b>ทุนประกันรวม (บาท)</div>
        <div class="kpi ${openClaims.length ? "alert" : ""}"><b>${openClaims.length}</b>เคลมที่กำลังดำเนินการ</div>
      </div>
      ${omneCard(false)}
      <div class="panel"><h3>ข้อมูลของฉัน</h3>${customerPhotoBlock(d.me, true, "")}</div>
      ${agentBlock}
      ${consentPanel}`;
  }
  if (tab === "policies") {
    return `${omneCard(true)}<div class="panel"><h3>กรมธรรม์ของคุณ</h3><div class="table-wrap"><table>
      <thead><tr><th>เลขกรมธรรม์</th><th>แบบประกัน</th><th class="num">ทุนประกัน</th><th class="num">เบี้ยต่องวด (รวมทุกสัญญา)</th><th>งวด</th><th>เริ่มคุ้มครอง</th><th>สถานะ</th></tr></thead>
      <tbody>${d.policies.map(p => `<tr><td>${esc(p.policy_no)}</td><td>${esc(p.plan)}${p.riders ? `<br><span class="small muted">สัญญาเพิ่มเติม: ${esc(p.riders)}</span>` : ""}${p.beneficiary ? `<br><span class="small muted">ผู้รับผลประโยชน์: ${esc(p.beneficiary)}</span>` : ""}${p.coverage_end ? `<br><span class="small muted">คุ้มครองถึง ${thDate(p.coverage_end)}</span>` : ""}</td><td class="num">${baht(p.sum_assured)}</td><td class="num">${baht(installmentTotal(p))}</td><td>${esc(p.mode)}</td><td>${thDate(p.start_date)}</td><td>${statusBadge(p.status)}</td></tr>`).join("") || `<tr><td colspan="7">ยังไม่มีกรมธรรม์ในระบบ</td></tr>`}</tbody>
    </table></div>
      ${d.policies.map(p => `<h4 class="sub-h">${esc(p.plan)} (${esc(p.policy_no)})</h4>${premTable(p)}`).join("")}
      <p class="small muted" style="margin-top:12px">ต้องการสำเนากรมธรรม์ ส่งคำขอในแท็บ "สอบถาม/แจ้งปัญหา" ตัวแทนจะส่งให้ทาง LINE</p></div>`;
  }
  if (tab === "pay") {
    return `<div class="two-col"><div class="panel"><h3>กำหนดชำระ</h3><div class="table-wrap"><table>
        <thead><tr><th>กรมธรรม์</th><th class="num">เบี้ย</th><th>ครบกำหนด</th><th></th></tr></thead>
        <tbody>${d.policies.map(p => { const n = daysUntil(p.next_due); return `<tr><td>${esc(p.policy_no)}<br><span class="small muted">${esc(p.plan)}</span></td><td class="num">${baht(installmentTotal(p))}</td><td>${thDate(p.next_due)}</td><td>${statusBadge(n < 0 ? "เลยกำหนด" : n <= 30 ? "รอชำระ" : "มีผลบังคับ")}</td></tr>`; }).join("")}</tbody></table></div></div>
      <div class="panel"><h3>ช่องทางชำระเบี้ย</h3>
        <div class="notice" style="margin-bottom:14px">ชำระผ่านช่องทางทางการของบริษัทเท่านั้น ทีมงานไม่รับเงินเข้าบัญชีส่วนตัว</div>
        <ul class="pay-list">${CONFIG.PAYMENT_CHANNELS.map(c => `<li><b>${c.url ? `<a href="${esc(c.url === "omne" ? omneUrl() : c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>` : esc(c.name)}</b><br><span class="small muted">${esc(c.detail)}</span></li>`).join("")}</ul></div></div>
      <div class="panel"><h3>ประวัติการชำระ</h3><div class="table-wrap"><table>
        <thead><tr><th>วันที่</th><th>กรมธรรม์</th><th class="num">จำนวน</th><th>ช่องทาง</th><th>สถานะ</th></tr></thead>
        <tbody>${d.payments.map(p => `<tr><td>${thDate(p.date)}</td><td>${esc(p.policy_no)}</td><td class="num">${baht(p.amount)}</td><td>${esc(p.channel)}</td><td>${statusBadge(p.status)}</td></tr>`).join("") || `<tr><td colspan="5">ยังไม่มีประวัติการชำระ</td></tr>`}</tbody></table></div></div>`;
  }
  if (tab === "claims") {
    return `${omneCard(true)}<div class="panel"><h3>สถานะการเคลม</h3><div class="table-wrap"><table>
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
  let tab = "today", filter = "ทั้งหมด", q = "", editId = null, saleF = "";
  let agentFilter = { text: "", role: "", onlyInc: false };
  let pendingPhoto = null; // รูปตัวแทนที่เลือกไว้แต่ยังไม่บันทึก (data URL) // จำคำค้นหาไว้ระหว่างแก้ไขข้อมูล
  // หน้ารายละเอียดลูกค้า: custId = ลูกค้าที่เปิดอยู่, form = ฟอร์มที่เปิดอยู่ ("policy" | "pay" | "claim"), formKey = เลขกรมธรรม์ที่แก้/ชำระ
  let custId = null, form = null, formKey = null;
  let rpt = { stage: "", agent: "", q: "" }; // ตัวกรองรายงานใบเสนอ
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
    const due = d.policies.filter(p => p.next_due && isActivePolicy(p) && p.status !== "รออนุมัติ" && daysUntil(p.next_due) <= CONFIG.REMIND_DAYS).sort((a, b) => new Date(a.next_due) - new Date(b.next_due));
    const pending = d.tickets.filter(t => t.status === "รอตอบ");
    const leads = d.customers.filter(c => c.type === "ลูกค้ามุ่งหวัง");
    const tabs = [["today", "งานวันนี้"], ["customers", "ลูกค้า"], ["report", "รายงานใบเสนอ"], ["claims", "เคลม"], ...(d.leader ? [["team", "ภาพรวมทีม"], ["manage", "จัดการทีม"]] : [])];

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
            const msg = `เรียน${c.name} กรมธรรม์ ${p.policy_no} (${p.plan}) ครบกำหนดชำระเบี้ย ${baht(installmentTotal(p))} วันที่ ${thDate(p.next_due)} ชำระผ่านช่องทางทางการของบริษัทได้เลยครับ/ค่ะ ดูรายละเอียดได้ที่หน้าสมาชิก`;
            return `<tr><td>${esc(c.name)}</td><td>${esc(p.policy_no)}</td><td class="num">${baht(installmentTotal(p))}</td><td>${thDate(p.next_due)} ${statusBadge(n < 0 ? "เลยกำหนด" : `อีก ${n} วัน`)}</td>
            <td><a class="btn btn-line btn-sm" href="${lineShare(msg)}" target="_blank" rel="noopener">ส่งเตือนทาง LINE</a></td></tr>`; }).join("") || `<tr><td colspan="5">ไม่มีเบี้ยครบกำหนดในช่วงนี้</td></tr>`}</tbody></table></div></div>
        <div class="panel"><h3>เรื่องที่ลูกค้าส่งมา</h3>
          ${d.tickets.map(t => { const c = custById[t.customer_id] || {}; const owner = (agentById[t.agent_id] || {}).name || "";
            const backupNote = t.agent_id === d.me.id ? "" : ` <span class="badge b-info">${d.leader ? "ลูกค้าของ" : "ดูแลแทน"} ${esc(owner)}</span>`;
            return `<div class="agent-mini">${avatar(c, "sm")}<div style="flex:1"><b>${esc(c.name)}</b> <span class="small muted">${thDate(t.created)}, ${esc(t.topic)}</span>${backupNote}<br>${esc(t.message)}</div>
            ${t.status === "รอตอบ" ? `<button class="btn btn-ghost btn-sm" data-done="${esc(t.id)}">ตอบแล้ว</button>` : statusBadge(t.status)}</div>`; }).join("") || `<p class="muted">ไม่มีเรื่องค้าง</p>`}
        </div>`;

      if (tab === "customers" && custId && custById[custId]) return customerDetail(d, custById[custId]);
      if (tab === "customers") {
        const list = d.customers.filter(c => (filter === "ทั้งหมด" || c.type === filter) && (!saleF || saleStage(c, full.policies) === saleF) && (!q || (c.name + c.phone + (c.occupation || "")).includes(q)));
        const stagesHere = SALE_STAGES.filter(k => d.customers.some(c => saleStage(c, full.policies) === k && (filter === "ทั้งหมด" || c.type === filter)));
        return `<div class="panel">
          <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:14px">
            <div class="seg" role="group" aria-label="กรองลูกค้า">${["ทั้งหมด", "ลูกค้า", "ลูกค้ามุ่งหวัง"].map(f => `<button type="button" data-filter="${f}" aria-pressed="${filter === f}">${f}</button>`).join("")}</div>
            <input id="search" placeholder="ค้นหาชื่อ เบอร์โทร หรืออาชีพ" value="${esc(q)}" style="max-width:260px">
            <select id="saleFilter" aria-label="กรองตามสถานะการขาย" style="width:auto"><option value="">สถานะการขายทั้งหมด</option>${stagesHere.map(k => `<option ${k === saleF ? "selected" : ""}>${k}</option>`).join("")}</select>
            <span class="small muted">${list.length} ราย</span>
          </div>
          <div class="table-wrap"><table><thead><tr><th>ชื่อ</th><th>ประเภท</th><th>สถานะการขาย</th><th class="num">อายุ</th><th>อาชีพ</th><th>เบอร์โทร</th><th>ตัวแทนหลัก</th><th class="num">ใบเสนอ/กรมธรรม์</th><th></th></tr></thead>
          <tbody>${list.map(c => { const age = ageFrom(c.birthday); const n = full.policies.filter(p => p.customer_id === c.id).length;
            return `<tr><td><b>${esc(c.name)}</b>${c.note ? `<br><span class="small muted">${esc(c.note)}</span>` : ""}</td><td>${statusBadge(c.type)}</td><td>${saleBadge(c, full.policies)}</td><td class="num">${age ?? "-"}</td><td>${esc(c.occupation || "-")}</td>
            <td><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></td><td>${esc((agentById[c.agent_id] || {}).name)}</td><td class="num">${n || "-"}</td>
            <td><button class="btn btn-ghost btn-sm" data-cust="${esc(c.id)}">เปิดข้อมูล</button></td></tr>`; }).join("") || `<tr><td colspan="9">ไม่พบลูกค้าตามเงื่อนไข</td></tr>`}</tbody></table></div></div>
          <div class="panel"><h3>เพิ่มลูกค้ามุ่งหวัง</h3>${profileFields({}, "l")}
            <button class="btn btn-primary" id="addLead" type="button" style="margin-top:14px">เพิ่มลูกค้ามุ่งหวัง</button><p class="error" id="lErr" role="alert"></p></div>`;
      }
      if (tab === "claims") return `<div class="panel"><h3>เคลมของลูกค้า</h3><div class="table-wrap"><table>
        <thead><tr><th>วันที่</th><th>ลูกค้า</th><th>กรมธรรม์</th><th>ประเภท</th><th class="num">จำนวน</th><th>สถานะ</th><th>หมายเหตุ</th></tr></thead>
        <tbody>${d.claims.map(c => { const p = d.policies.find(x => x.policy_no === c.policy_no) || {}; return `<tr><td>${thDate(c.date)}</td><td>${esc((custById[p.customer_id] || {}).name)}</td><td>${esc(c.policy_no)}</td><td>${esc(c.type)}</td><td class="num">${baht(c.amount)}</td><td>${statusBadge(c.status)}</td><td>${esc(c.note)}</td></tr>`; }).join("") || `<tr><td colspan="7">ยังไม่มีรายการเคลม</td></tr>`}</tbody></table></div></div>`;

      if (tab === "manage") return manageTab(d);
      if (tab === "report") return reportTab(d);

      // team overview (leader only)
      const rows = publicAgents(d.agents).map(a => {
        const cs = d.customers.filter(c => c.agent_id === a.id);
        const ps = d.policies.filter(p => cs.some(c => c.id === p.customer_id) && isActivePolicy(p));
        return { a, clients: cs.filter(c => c.type === "ลูกค้า").length, leads: cs.filter(c => c.type === "ลูกค้ามุ่งหวัง").length,
          premium: ps.reduce((s, p) => s + totalAnnual(p), 0),
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
          <div class="photo-edit">
            <span id="gPhotoPrev">${avatar(pendingPhoto ? { photo_url: pendingPhoto, name: e.name } : e, "lg")}</span>
            <div>
              <div class="btn-row">
                <label class="btn btn-ghost btn-sm">${e.photo_url || pendingPhoto ? "เปลี่ยนรูป" : "เลือกรูปโปรไฟล์"}<input type="file" accept="image/*" id="gPhoto" class="sr-only"></label>
                ${pendingPhoto ? `<button class="btn btn-ghost btn-sm" id="gPhotoUndo" type="button">ยกเลิกรูปใหม่</button>` : e.photo_url && editId ? `<button class="btn btn-ghost btn-sm quote-del" id="gPhotoDel" type="button">ลบรูป</button>` : ""}
              </div>
              <p class="small muted" style="margin:6px 0 0">${pendingPhoto ? "<b>รูปใหม่ยังไม่ถูกบันทึก</b> กดปุ่มบันทึกด้านล่าง" : "ใช้รูปหน้าตรง ระบบตัดเป็นสี่เหลี่ยมจัตุรัสและย่อขนาดให้อัตโนมัติ"}</p>
            </div>
          </div>
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
        <label>รายได้ต่อเดือนโดยประมาณ (บาท)${moneyInput(px + "Income", inc, `data-annual-out="${px}Annual"`)}</label>
        <label>รายได้ต่อปีโดยประมาณ<output id="${px}Annual" class="calc">${inc ? baht(inc * 12) : "คำนวณจากรายได้ต่อเดือน"}</output></label>
        <label class="pf-wide">บันทึก<input id="${px}Note" value="${esc(c.note || "")}" placeholder="เช่น สนใจประกันสุขภาพ นัดคุยวันเสาร์"></label>
      </div>`;
    }
    function readProfile(px) {
      const v = (id) => ($("#" + px + id) || {}).value || "";
      return { name: v("Name").trim(), phone: v("Phone").replace(/\D/g, ""), birthday: v("Birth"), gender: v("Gender"),
        occupation: v("Occ").trim(), monthly_income: money(v("Income")), note: v("Note").trim() };
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
      const active = pols.filter(isActivePolicy);
      const isLead = c.type !== "ลูกค้า";
      const editing = form === "policy" ? (formKey ? pols.find(p => p.policy_no === formKey) || {} : {}) : null;

      const policyForm = (p) => { const rs = ridersOf(p);
        if (!rs.length && p.riders) rs.push({ name: p.riders, sum: 0, premium: 0 }); // ข้อมูลเก่าที่เป็นข้อความ
        const shown = Math.max(1, rs.length);
        const riderRow = (i) => { const r = rs[i - 1] || {}; return `<div class="rider-row ${i > shown ? "hidden" : ""}" data-rider="${i}">
            <span class="rider-no">${i}</span>
            <label>ชื่อแบบประกัน<input id="r${i}Name" value="${esc(r.name || "")}" placeholder="เช่น ค่ารักษาผู้ป่วยนอก"></label>
            <label>ทุนประกันภัย (บาท)${moneyInput("r" + i + "Sum", r.sum)}</label>
            <label>เบี้ยประกันภัยรายปี (บาท)${moneyInput("r" + i + "Prem", r.premium, 'placeholder="0 = ฟรี"')}</label>
            <button class="rider-del" type="button" data-rider-del="${i}" aria-label="ลบสัญญาเพิ่มเติมที่ ${i}">ลบ</button></div>`; };
        return `<div class="panel" id="policyForm" style="border-color:var(--teal)"><h3>${p.policy_no ? "แก้ไขกรมธรรม์ " + esc(p.policy_no) : "บันทึกกรมธรรม์ใหม่"}</h3>
        <h4 class="sub-h">สัญญาหลัก</h4>
        <div class="pf-grid">
          <label>เลขกรมธรรม์<input id="pNo" value="${esc(p.policy_no || "")}" placeholder="เว้นว่าง ระบบออกเลขชั่วคราว TMP-xxxxxx ให้" autocapitalize="characters">
            <span class="small muted" id="pNoHint">${!p.policy_no ? "เว้นว่างได้ ระบบออกเลขชั่วคราวให้อัตโนมัติ" : isTempNo(p.policy_no) ? "เลขชั่วคราว: เมื่อมีผลบังคับ ให้เปลี่ยนเป็นเลขกรมธรรม์จริง" : "แก้เลขได้ ระบบอัปเดตประวัติชำระและเคลมให้ด้วย"}</span></label>
          <label>แบบประกัน<input id="pPlan" value="${esc(p.plan || "")}" placeholder="เช่น ประกันสุขภาพเหมาจ่าย"></label>
          <label>ทุนประกันภัย (บาท)${moneyInput("pSum", p.sum_assured)}</label>
          <label>เบี้ยต่องวด สัญญาหลัก (บาท)${moneyInput("pPrem", p.premium)}</label>
          <label>งวดการชำระ<select id="pMode">${options(MODES, p.mode || "รายปี")}</select></label>
          <label>สถานะ<select id="pStatus">${options(POLICY_STATUS.filter(x => x !== CLOSED_STATUS || !needsClose(p, isLead)), p.status || (isLead ? "นำเสนอ" : "รออนุมัติ"))}</select>
            ${needsClose(p, isLead) ? `<span class="small muted">เปลี่ยนเป็นมีผลบังคับ ใช้ปุ่ม "ปิดการขาย" ที่การ์ดใบเสนอ</span>` : ""}</label>
          <label>วันเริ่มคุ้มครอง${thaiDate("pStart", p.start_date, { back: 40, ahead: 1 })}</label>
          <label>ครบกำหนดชำระงวดถัดไป${thaiDate("pDue", p.next_due, { back: 5, ahead: 3 })}</label>
          <label>ระยะเวลาคุ้มครอง<input id="pTerm" value="${esc(p.coverage_term || "")}" placeholder="เช่น ถึงอายุ 90 ปี, 20 ปี"></label>
          <label>ระยะเวลาชำระเบี้ย (ปี)<input id="pYears" type="number" min="0" value="${esc(p.payment_years || "")}"></label>
          <label>คุ้มครองถึงวันที่ (ถ้ามี)${thaiDate("pEnd", p.coverage_end, { back: 0, ahead: 100 })}</label>
          <label>ผู้รับผลประโยชน์<input id="pBen" value="${esc(p.beneficiary || "")}" placeholder="ชื่อ และความสัมพันธ์"></label>
        </div>

        <h4 class="sub-h">สัญญาเพิ่มเติม <span class="small muted">(ไม่เกิน ${MAX_RIDERS} สัญญา, เบี้ย 0 = ฟรี)</span></h4>
        <div id="riders">${Array.from({ length: MAX_RIDERS }, (_, k) => riderRow(k + 1)).join("")}</div>
        <button class="btn btn-ghost btn-sm" id="addRider" type="button" ${shown >= MAX_RIDERS ? "disabled" : ""}>เพิ่มสัญญาเพิ่มเติม</button>

        <div class="prem-sum" id="premSum" aria-live="polite"></div>

        <label class="pf-wide" style="margin-top:14px">หมายเหตุ (ลูกค้าไม่เห็น)<input id="pNote" value="${esc(p.note || "")}"></label>
        ${isLead ? `<div class="notice" style="margin-top:14px">ลูกค้ามุ่งหวังมีใบเสนอได้หลายชุด ระหว่าง <b>นำเสนอ</b> และ <b>รออนุมัติ</b> ยังเป็นลูกค้ามุ่งหวัง เมื่อเปลี่ยนเป็น <b>มีผลบังคับ</b> ระบบจะเปลี่ยน ${esc(c.name)} เป็นลูกค้าให้อัตโนมัติ</div>` : ""}
        <div class="notice hidden" id="pFill" style="margin-top:14px"></div>
        <p class="error" id="pErr" role="alert"></p>
        <div class="btn-row"><button class="btn btn-primary" id="pSave" type="button">${p.policy_no ? "บันทึกการแก้ไข" : "บันทึกกรมธรรม์"}</button><button class="btn btn-ghost" data-close-form type="button">ยกเลิก</button></div></div>`; };

      const payForm = (p) => `<div class="pay-box"><h4>บันทึกการชำระเบี้ย</h4>
        <div class="pf-grid">
          <label>วันที่ชำระ${thaiDate("payDate", isoIn(0), { back: 2 })}</label>
          <label>จำนวนเงิน (บาท)${moneyInput("payAmt", Math.round(installmentTotal(p) * 100) / 100)}</label>
          <label class="pf-wide">ช่องทาง<select id="payCh">${options(PAY_CHANNELS, "แอปหรือเว็บไซต์บริษัท")}</select></label>
        </div>
        <p class="small muted">งวดถัดไปจะเลื่อนเป็น <b>${thDate(addMonths(p.next_due || isoIn(0), MODE_MONTHS[p.mode] || 12))}</b> ให้อัตโนมัติ</p>
        <div class="btn-row"><button class="btn btn-primary btn-sm" id="paySave" data-no="${esc(p.policy_no)}" type="button">บันทึกการชำระ</button><button class="btn btn-ghost btn-sm" data-close-form type="button">ยกเลิก</button></div></div>`;

      const field = (label, val) => val ? `<div><span class="small muted">${label}</span><br>${val}</div>` : "";
      const closeForm = (p) => { const due1 = installmentTotal(p), m = MODE_MONTHS[p.mode] || 12;
        const fld = (label, html, empty) => `<label class="${empty ? "is-empty" : ""}"><span>${label}${empty ? ' <span class="badge b-warn">ยังว่าง</span>' : ""}</span>${html}</label>`;
        return `<div class="close-box" id="closeForm">
          <h4>ปิดการขาย: กรมธรรม์มีผลบังคับ</h4>
          <ol class="close-steps">
          <li><b>บันทึกข้อมูลที่ยังว่าง</b>
            <div class="pf-grid">
              ${fld("เลขกรมธรรม์จริง (จำเป็น)", `<input id="csNo" value="${isTempNo(p.policy_no) ? "" : esc(p.policy_no)}" placeholder="แทนเลขชั่วคราว ${esc(p.policy_no)}" autocapitalize="characters">`, !p.policy_no || isTempNo(p.policy_no))}
              ${fld("วันเริ่มคุ้มครอง (จำเป็น)", thaiDate("csStart", p.start_date, { back: 2, ahead: 1 }), !p.start_date)}
              ${fld("ระยะเวลาคุ้มครอง", `<input id="csTerm" value="${esc(p.coverage_term || "")}" placeholder="เช่น ถึงอายุ 90 ปี">`, !p.coverage_term)}
              ${fld("ระยะเวลาชำระเบี้ย (ปี)", `<input id="csYears" type="number" min="0" value="${esc(p.payment_years || "")}">`, !p.payment_years)}
              ${fld("คุ้มครองถึงวันที่ (ถ้ามี)", thaiDate("csEnd", p.coverage_end, { back: 0, ahead: 100 }), false)}
              ${fld("ผู้รับผลประโยชน์", `<input id="csBen" value="${esc(p.beneficiary || "")}" placeholder="ชื่อ และความสัมพันธ์">`, !p.beneficiary)}
            </div></li>
          <li><b>บันทึกการชำระเบี้ยงวดแรก</b>
            <p class="small" style="margin:4px 0 10px">เบี้ยประกันภัยงวดแรก (รวมสัญญาเพิ่มเติม${m !== 12 ? ", ชำระ" + esc(p.mode) : ""}) <b class="close-amt">${baht(due1)}</b>${m !== 12 ? ` <span class="muted">จากเบี้ยประกันภัยรายปีรวม ${baht(totalAnnual(p))}</span>` : ""}</p>
            <div class="pf-grid">
              <label>วันที่ชำระ${thaiDate("csPayDate", isoIn(0), { back: 1 })}</label>
              <label>จำนวนเงินที่ได้รับ (บาท)${moneyInput("csAmt", Math.round(due1 * 100) / 100)}</label>
              <label class="pf-wide">ช่องทาง<select id="csCh">${options(PAY_CHANNELS, "แอปหรือเว็บไซต์บริษัท")}</select></label>
            </div>
            <p class="small warn-text hidden" id="csAmtWarn"></p>
            <p class="small muted" id="csNext"></p></li>
          <li><b>ยืนยัน</b>
            <label class="close-confirm"><input type="checkbox" id="csOk"> ยืนยันว่ากรมธรรม์อนุมัติและมีผลบังคับแล้ว และได้รับชำระเบี้ยงวดแรก <b id="csOkAmt">${baht(due1)}</b> เรียบร้อย</label></li>
          </ol>
          <p class="error" id="csErr" role="alert"></p>
          <div class="btn-row"><button class="btn btn-primary" id="csSave" type="button" disabled data-no="${esc(p.policy_no)}">บันทึกปิดการขาย</button><button class="btn btn-ghost" data-close-form type="button">ยกเลิก</button></div>
        </div>`; };

      const policyCard = (p) => { const n = p.next_due ? daysUntil(p.next_due) : null; const rs = ridersOf(p);
        return `<div class="pol-card ${p.status === "นำเสนอ" ? "is-proposal" : ""}">
        <div class="pol-head"><div>${setNoOf(p, full.policies) && proposalsOf(c.id, full.policies).length > 1 ? `<span class="set-no">ใบเสนอชุดที่ ${setNoOf(p, full.policies)}</span>` : ""}<b>${esc(p.plan)}</b><br><span class="small muted">เลขที่ ${esc(p.policy_no)}</span></div>${statusBadge(p.status)}</div>
        <div class="pol-grid">
          ${field("ทุนประกันภัย", baht(p.sum_assured))}
          ${field("เบี้ยต่องวด สัญญาหลัก", baht(p.premium) + " " + esc(p.mode || ""))}
          ${field("เริ่มคุ้มครอง", p.start_date ? thDate(p.start_date) : "")}
          ${field("งวดถัดไป", p.next_due && isActivePolicy(p) ? thDate(p.next_due) + (n != null && n <= 30 ? " " + statusBadge(n < 0 ? "เลยกำหนด" : "อีก " + n + " วัน") : "") : "")}
          ${field("ระยะเวลาคุ้มครอง", esc(p.coverage_term))}
          ${field("ชำระเบี้ย", p.payment_years ? esc(p.payment_years) + " ปี" : "")}
          ${field("คุ้มครองถึง", p.coverage_end ? thDate(p.coverage_end) : "")}
          ${field("ผู้รับผลประโยชน์", esc(p.beneficiary))}
          ${!rs.length && p.riders ? field("สัญญาเพิ่มเติม", esc(p.riders)) : ""}
          ${field("ผู้ขาย", esc((agentById[p.sold_by] || {}).name || ""))}
          ${field("หมายเหตุ", esc(p.note))}
        </div>
        ${premTable(p)}
        ${quoteBox(p)}
        ${form === "close" && formKey === p.policy_no ? closeForm(p) : form === "pay" && formKey === p.policy_no ? payForm(p) : `<div class="btn-row" style="margin-top:12px">
          ${["นำเสนอ", "รออนุมัติ", "ยกเลิก", "ขาดอายุ"].includes(p.status) ? "" : `<button class="btn btn-primary btn-sm" data-pay="${esc(p.policy_no)}">บันทึกการชำระ</button>`}
          ${PENDING.includes(p.status) ? `<button class="btn btn-primary btn-sm" data-close-sale="${esc(p.policy_no)}">ปิดการขาย (กรมธรรม์มีผลบังคับ)</button>` : ""}
          <button class="btn btn-ghost btn-sm" data-edit-pol="${esc(p.policy_no)}">${PENDING.includes(p.status) ? "แก้ไขใบเสนอ" : "แก้ไขกรมธรรม์"}</button></div>`}
      </div>`; };

      return `
      <button class="btn btn-ghost btn-sm" id="backList" type="button" style="margin-bottom:16px">กลับไปรายชื่อลูกค้า</button>
      ${isLead ? "" : `<div class="panel" style="margin-bottom:14px">${customerPhotoBlock(c, true, c.id)}</div>`}
      <div class="cust-head"><div><h2 style="margin:0">${esc(c.name)}</h2>
        <span class="muted small">${[ageFrom(c.birthday) != null ? "อายุ " + ageFrom(c.birthday) + " ปี" : "", c.gender, c.occupation, "ดูแลโดย " + ((agentById[c.agent_id] || {}).name || "-")].filter(Boolean).join(", ")}</span>
        ${isLead ? "" : `<br><span class="small">PDPA: ${c.consent_version ? `<span class="badge b-ok">ให้ความยินยอมแล้ว</span> ${String(c.consent_items || "").split(",").filter(Boolean).map(consentLabel).map(esc).join(", ")}${c.consent_at ? " (" + thDate(String(c.consent_at).slice(0, 10)) + ")" : ""}${!consentOk(c.consent_version) ? " ฉบับเก่า รอให้ความยินยอมใหม่" : ""}` : '<span class="badge b-warn">ยังไม่ได้ให้ความยินยอม</span> ลูกค้าจะถูกขอเมื่อเข้าใช้เว็บครั้งแรก'}${String(c.consent_items || "").includes("marketing") ? "" : (c.consent_version ? ', <b>ไม่รับข่าวสาร</b>' : "")}</span>`}</div>
        <div class="rp-lead-side">${statusBadge(c.type)}<span class="small muted">สถานะการขาย</span>${saleBadge(c, full.policies)}</div></div>

      ${isLead ? `<div class="panel close-sale"><div><h3 style="margin:0 0 4px">นำเสนอแบบประกัน</h3><p class="muted" style="margin:0">บันทึกใบเสนอได้หลายชุด ระบบออกเลขชั่วคราวให้ เมื่อกรมธรรม์มีผลบังคับ กด "แก้ไข / ปิดการขาย" ที่ใบเสนอนั้น เปลี่ยนสถานะเป็นมีผลบังคับ แล้วใส่เลขกรมธรรม์จริง</p></div>
        <div class="btn-row">${pols.length ? `<button class="btn btn-ghost" data-open-report="${esc(c.name)}" type="button">ดูรายงานใบเสนอ</button>` : ""}
        ${form === "policy" ? "" : `<button class="btn btn-primary" data-new-pol type="button">เพิ่มใบเสนอ</button>`}</div></div>` : ""}

      <div class="kpis">
        <div class="kpi"><b>${active.length}</b>กรมธรรม์ที่มีผล</div>
        <div class="kpi"><b>${baht(active.reduce((s, p) => s + Number(p.sum_assured || 0), 0)).replace(" บาท", "")}</b>ทุนประกันรวม (บาท)</div>
        <div class="kpi"><b>${baht(active.reduce((s, p) => s + totalAnnual(p), 0)).replace(" บาท", "")}</b>เบี้ยประกันภัยรายปีรวม (บาท)</div>
        <div class="kpi"><b>${money(c.monthly_income) ? Math.round(active.reduce((s, p) => s + totalAnnual(p), 0) / (money(c.monthly_income) * 12) * 100) + "%" : "-"}</b>เบี้ยเทียบรายได้ต่อปี</div>
      </div>

      ${form === "policy" ? policyForm(editing) : ""}

      <div class="panel"><div class="pol-head"><h3 style="margin:0">${isLead ? "ใบเสนอ" : "ประวัติการซื้อประกัน"} (${pols.length} ฉบับ)</h3>
        ${form !== "policy" ? `<button class="btn btn-ghost btn-sm" data-new-pol type="button">${isLead ? "เพิ่มใบเสนอ" : "เพิ่มกรมธรรม์"}</button>` : ""}</div>
        ${pols.length ? [...proposalsOf(c.id, full.policies), ...pols.filter(x => !PROPOSAL_FAMILY.includes(x.status)).sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))].map(policyCard).join("") : `<p class="muted" style="margin-top:12px">ยังไม่มีกรมธรรม์</p>`}
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
              <label>จำนวนเงิน (บาท)${moneyInput("clAmt", "")}</label>
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
      app.querySelectorAll("[data-annual-out]").forEach(i => i.oninput = () => { const v = money(i.value); $("#" + i.dataset.annualOut).textContent = v ? baht(v * 12) : "คำนวณจากรายได้ต่อเดือน"; });
      const prem = $("#pPrem"), mode = $("#pMode");
      if (prem) {
        // สรุปเบี้ยประกันภัยรายปี อัปเดตทันทีที่พิมพ์
        const upd = () => {
          const draft = { plan: $("#pPlan").value || "สัญญาหลัก", sum_assured: money($("#pSum").value), premium: money(prem.value), mode: mode.value };
          let k = 0;
          for (let i = 1; i <= MAX_RIDERS; i++) { const n = $("#r" + i + "Name").value.trim(); if (n) { k++; draft["rider" + k + "_name"] = n; draft["rider" + k + "_sum"] = money($("#r" + i + "Sum").value); draft["rider" + k + "_premium"] = money($("#r" + i + "Prem").value); } }
          $("#premSum").innerHTML = premTable(draft);
        };
        $("#policyForm").addEventListener("input", upd); mode.onchange = upd; upd();
        // เมื่อเลือกสถานะ มีผลบังคับ: เตือนให้ใส่เลขกรมธรรม์จริง และบอกช่องที่ยังว่าง (ไม่บังคับ ยกเว้นเลขกรมธรรม์)
        const checkFill = () => {
          const box = $("#pFill"); app.querySelectorAll("#policyForm .need").forEach(x => x.classList.remove("need"));
          if ($("#pStatus").value !== "มีผลบังคับ") { box.classList.add("hidden"); return; }
          const empty = [];
          const no = $("#pNo").value.trim();
          if (!no || isTempNo(no)) { empty.push("<b>เลขกรมธรรม์จริง (จำเป็น)</b>"); $("#pNo").classList.add("need"); }
          [["pStart", "วันเริ่มคุ้มครอง"], ["pDue", "ครบกำหนดชำระงวดถัดไป"], ["pTerm", "ระยะเวลาคุ้มครอง"], ["pYears", "ระยะเวลาชำระเบี้ย"], ["pBen", "ผู้รับผลประโยชน์"]].forEach(([id, label]) => {
            const el = $("#" + id); if (el && !el.value.trim()) { empty.push(label); (el.closest("[data-thd]") || el).classList.add("need"); }
          });
          box.innerHTML = empty.length ? "ปิดการขายได้แล้ว กรอกข้อมูลที่ยังว่างให้ครบ: " + empty.join(", ") : "ข้อมูลครบแล้ว";
          box.classList.remove("hidden");
        };
        $("#pStatus").addEventListener("change", checkFill); $("#policyForm").addEventListener("input", checkFill); $("#policyForm").addEventListener("change", checkFill); checkFill();
        const visible = () => [...app.querySelectorAll("[data-rider]")].filter(r => !r.classList.contains("hidden")).length;
        $("#addRider").onclick = () => {
          const next = app.querySelector("[data-rider].hidden"); if (next) { next.classList.remove("hidden"); next.querySelector("input").focus(); }
          $("#addRider").disabled = visible() >= MAX_RIDERS;
        };
        app.querySelectorAll("[data-rider-del]").forEach(b => b.onclick = () => {
          const row = b.closest("[data-rider]"); row.querySelectorAll("input").forEach(i => i.value = "");
          if (visible() > 1) row.classList.add("hidden");
          $("#addRider").disabled = visible() >= MAX_RIDERS; upd();
        });
      }
      const start = $("#pStart"), due = $("#pDue");
      if (start && due) start.onchange = () => { if (!due.value && start.value) thaiDateSet("pDue", addMonths(start.value, MODE_MONTHS[mode.value] || 12)); };
    }

    function bindCustomer() {
      const c = custById[custId]; if (!c) return;
      bindCustomerPhoto(c, c.id, view);
      const tok = State.session.token;
      const busy = (btn, on, label) => { btn.disabled = on; if (label) btn.textContent = label; };
      $("#backList") && ($("#backList").onclick = () => { custId = null; form = null; view(); });
      app.querySelectorAll("[data-new-pol]").forEach(b => b.onclick = () => { form = "policy"; formKey = null; view(); $("#policyForm")?.scrollIntoView({ behavior: "smooth" }); });
      app.querySelectorAll("[data-edit-pol]").forEach(b => b.onclick = () => { form = "policy"; formKey = b.dataset.editPol; view(); $("#policyForm")?.scrollIntoView({ behavior: "smooth" }); });
      app.querySelectorAll("[data-pay]").forEach(b => b.onclick = () => { form = "pay"; formKey = b.dataset.pay; view(); });
      app.querySelectorAll("[data-close-sale]").forEach(b => b.onclick = () => { form = "close"; formKey = b.dataset.closeSale; view(); $("#closeForm")?.scrollIntoView({ behavior: "smooth", block: "center" }); });
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
        const pol = { policy_no: v("#pNo"), customer_id: c.id, plan: v("#pPlan"), sum_assured: money(v("#pSum")), premium: money(v("#pPrem")),
          mode: $("#pMode").value, start_date: v("#pStart"), next_due: v("#pDue"), status: $("#pStatus").value, payment_years: v("#pYears") ? Number(v("#pYears")) : "",
          coverage_end: v("#pEnd"), coverage_term: v("#pTerm"), beneficiary: v("#pBen"), riders: "", note: v("#pNote") };
        const err = (m) => ($("#pErr").textContent = m);
        // เก็บสัญญาเพิ่มเติมที่มีชื่อ เรียงต่อกันเป็น rider1..rider5
        const riders = [];
        for (let i = 1; i <= MAX_RIDERS; i++) { const n = v("#r" + i + "Name"); if (n) riders.push({ name: n, sum: money(v("#r" + i + "Sum")), premium: money(v("#r" + i + "Prem")) }); }
        for (let i = 1; i <= MAX_RIDERS; i++) { const r = riders[i - 1] || {}; pol["rider" + i + "_name"] = r.name || ""; pol["rider" + i + "_sum"] = r.name ? r.sum : ""; pol["rider" + i + "_premium"] = r.name ? r.premium : ""; }
        pol.policy_no = pol.policy_no.toUpperCase();
        if (!pol.plan) return err("กรอกชื่อแบบประกัน");
        if (!pol.premium) return err("กรอกเบี้ยต่องวดของสัญญาหลัก");
        if (pol.status === "มีผลบังคับ" && (!pol.policy_no || isTempNo(pol.policy_no))) { $("#pNo").focus(); return err("สถานะมีผลบังคับ: กรอกเลขกรมธรรม์จริงแทนเลขชั่วคราว"); }
        if (!formKey && pol.policy_no && full.policies.some(x => x.policy_no === pol.policy_no)) return err("เลขกรมธรรม์ " + pol.policy_no + " มีอยู่แล้ว");
        if (!pol.next_due && pol.start_date && pol.status !== "นำเสนอ") pol.next_due = addMonths(pol.start_date, MODE_MONTHS[pol.mode] || 12);
        busy(ps, true, "กำลังบันทึก…");
        try {
          if (formKey) {
            const { policy_no, customer_id, ...patch } = pol;
            const newNo = policy_no && policy_no !== formKey ? policy_no : undefined;
            const target = full.policies.find(p => p.policy_no === formKey);
            const r = await Api.call("updatePolicy", { token: tok, policy_no: formKey, patch, new_policy_no: newNo });
            if (newNo) { // เปลี่ยนเลขที่: อัปเดตประวัติชำระและเคลมที่อ้างเลขเดิมด้วย
              [full.payments, full.claims].forEach(list => list.forEach(x => { if (x.policy_no === formKey) x.policy_no = newNo; }));
              target.policy_no = newNo;
            }
            Object.assign(target, patch);
            if (r.converted || (c.type !== "ลูกค้า" && patch.status === CLOSED_STATUS)) { c.type = "ลูกค้า"; toast("ยินดีด้วย! ปิดการขายได้แล้ว " + c.name + " เป็นลูกค้าแล้ว", 6000); }
            else toast("บันทึกการแก้ไขแล้ว");
          } else {
            const r = await Api.call("addPolicy", { token: tok, policy: pol });
            full.policies.push(r.policy || { ...pol, policy_no: pol.policy_no || nextTempNo(full.policies), sold_by: c.agent_id });
            if (r.converted || (c.type !== "ลูกค้า" && pol.status === CLOSED_STATUS)) { c.type = "ลูกค้า"; toast("ยินดีด้วย! " + c.name + " เป็นลูกค้าแล้ว ตั้งรหัสผ่านให้ลูกค้าได้ที่ข้อมูลส่วนตัวด้านล่าง", 6000); }
            else toast((pol.status === "นำเสนอ" ? "บันทึกใบเสนอแล้ว" : "บันทึกกรมธรรม์แล้ว") + (r.policy && isTempNo(r.policy.policy_no) ? " เลขชั่วคราว " + r.policy.policy_no : ""), 4000);
          }
          form = null; formKey = null; view();
        } catch (e2) { busy(ps, false, formKey ? "บันทึกการแก้ไข" : "บันทึกกรมธรรม์"); err(e2.message); }
      };

      const csBtn = $("#csSave"); if (csBtn) {
        const p0 = full.policies.find(x => x.policy_no === csBtn.dataset.no); const due1 = installmentTotal(p0), months = MODE_MONTHS[p0.mode] || 12;
        const live = () => { // งวดถัดไป และเตือนเมื่อยอดไม่ตรงงวดแรก
          const st = $("#csStart").value, amt = money($("#csAmt").value);
          $("#csNext").innerHTML = st ? "งวดถัดไปจะเป็น <b>" + thDate(addMonths(st, months)) + "</b> ให้อัตโนมัติ" : "เลือกวันเริ่มคุ้มครอง ระบบจะคำนวณงวดถัดไปให้";
          const w = $("#csAmtWarn"); const diff = Math.abs(amt - due1) > 0.5;
          w.textContent = diff ? "ยอดที่ได้รับ " + baht(amt) + " ไม่ตรงกับเบี้ยงวดแรก " + baht(due1) + " ตรวจสอบก่อนยืนยัน" : ""; w.classList.toggle("hidden", !diff);
          $("#csOkAmt").textContent = baht(amt);
          csBtn.disabled = !$("#csOk").checked;
        };
        const liveSoon = () => setTimeout(live, 0); $("#closeForm").addEventListener("input", liveSoon); $("#closeForm").addEventListener("change", liveSoon); live();
        csBtn.onclick = async () => {
          const err = (m) => ($("#csErr").textContent = m);
          const no = $("#csNo").value.trim().toUpperCase(), start = $("#csStart").value;
          const pay = { date: $("#csPayDate").value, amount: money($("#csAmt").value), channel: $("#csCh").value };
          if (!no || isTempNo(no)) { $("#csNo").focus(); return err("กรอกเลขกรมธรรม์จริงที่บริษัทออกให้"); }
          if (no !== p0.policy_no && full.policies.some(x => x.policy_no === no)) return err("เลขกรมธรรม์ " + no + " มีอยู่แล้ว");
          if (!start) return err("เลือกวันเริ่มคุ้มครอง");
          if (!pay.date || !pay.amount) return err("บันทึกวันที่และจำนวนเบี้ยงวดแรกที่ได้รับ");
          if (!$("#csOk").checked) return err("ติ๊กยืนยันการได้รับชำระเบี้ยงวดแรกก่อน");
          const patch = { start_date: start, coverage_term: $("#csTerm").value.trim(), payment_years: $("#csYears").value ? Number($("#csYears").value) : "",
            coverage_end: $("#csEnd").value, beneficiary: $("#csBen").value.trim() };
          busy(csBtn, true, "กำลังบันทึก…");
          try {
            const oldNo = p0.policy_no;
            const r = await Api.call("closeSale", { token: tok, policy_no: oldNo, new_policy_no: no, patch, payment: pay });
            if (no !== oldNo) [full.payments, full.claims].forEach(list => list.forEach(x => { if (x.policy_no === oldNo) x.policy_no = no; }));
            Object.assign(p0, patch, { policy_no: no, status: CLOSED_STATUS, next_due: (r.policy && r.policy.next_due) || addMonths(start, months) });
            full.payments.unshift(r.payment || { policy_no: no, ...pay, status: "ชำระแล้ว" });
            const wasLead = c.type !== "ลูกค้า"; c.type = "ลูกค้า";
            toast("ปิดการขายเรียบร้อย กรมธรรม์ " + no + " มีผลบังคับ" + (wasLead ? " " + c.name + " เป็นลูกค้าแล้ว ตั้งรหัสผ่านให้ลูกค้าได้ที่ข้อมูลส่วนตัว" : ""), 7000);
            form = null; formKey = null; view();
          } catch (e2) { busy(csBtn, false, "บันทึกปิดการขาย"); err(e2.message); }
        };
      }

      const pay = $("#paySave"); if (pay) pay.onclick = async () => {
        const no = pay.dataset.no, amount = money($("#payAmt").value), date = $("#payDate").value, channel = $("#payCh").value;
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
        const claim = { policy_no: $("#clPol").value, type: $("#clType").value, date: $("#clDate").value, amount: money($("#clAmt").value), note: $("#clNote").value.trim(), status: "รอเอกสาร" };
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

    /* ===================== รายงานใบเสนอ (ลูกค้ามุ่งหวัง) ===================== */
    function reportTab(d) {
      const STAGES = [
        { key: "ยังไม่นำเสนอ", note: "ยังไม่มีใบเสนอ" },
        { key: "นำเสนอ", note: "ส่งใบเสนอแล้ว" },
        { key: "รออนุมัติ", note: "ยื่นใบคำขอแล้ว" },
        { key: "ยกเลิก", note: "ไม่ปิดการขาย" }
      ];
      const leads = d.customers.filter(c => c.type !== "ลูกค้า");
      const polsOf = (c) => full.policies.filter(p => p.customer_id === c.id);
      const stageOf = (c) => saleStage(c, full.policies);
      const liveSets = (c) => polsOf(c).filter(p => ["นำเสนอ", "รออนุมัติ"].includes(p.status));
      // เบี้ยคาดการณ์: นับชุดที่เบี้ยสูงสุดของแต่ละราย (ลูกค้าจะเลือกเพียงชุดเดียว จึงไม่รวมทุกชุด)
      const bestOf = (c) => liveSets(c).reduce((m, p) => Math.max(m, totalAnnual(p)), 0);
      const by = Object.fromEntries(STAGES.map(s => [s.key, leads.filter(c => stageOf(c) === s.key)]));
      const forecast = leads.reduce((s, c) => s + bestOf(c), 0);
      const setCount = leads.reduce((n, c) => n + liveSets(c).length, 0);
      const scope = full.leader ? "ทั้งทีม" : "ลูกค้าของ " + full.me.name;
      const order = { "รออนุมัติ": 0, "นำเสนอ": 1, "ยังไม่นำเสนอ": 2, "ยกเลิก": 3 };
      const sorted = [...leads].sort((a, b) => order[stageOf(a)] - order[stageOf(b)] || bestOf(b) - bestOf(a));
      const dash = (v) => v ? esc(v) : '<span class="muted">-</span>';

      const ps_count = (c) => polsOf(c).length;
      // ข้อมูลลูกค้า (หัวการ์ด) ใช้ซ้ำทุกหน้าตอนพิมพ์
      const leadHead = (c, cont) => { const st = stageOf(c), inc = money(c.monthly_income) * 12, age = ageFrom(c.birthday);
        return `<header class="rp-lead-head">
            <div><h3>${esc(c.name)}${cont ? ' <span class="rp-cont-tag">(ต่อ)</span>' : ""}</h3>
              <p class="small muted">${[age != null ? "อายุ " + age + " ปี" : "", c.gender, c.occupation, inc ? "รายได้ต่อปี " + baht(inc) : "", c.phone].filter(Boolean).map(esc).join("<span class=\"rp-dot\"></span>")}</p></div>
            <div class="rp-lead-side">${statusBadge(st)}<span class="small muted rp-agent">ตัวแทน ${esc((agentById[c.agent_id] || {}).name || "-")}</span></div>
          </header>`; };
      // พิมพ์ 2 ชุดต่อหน้า A4: ชุดที่ 3, 5, ... ขึ้นหน้าใหม่ พร้อมข้อมูลลูกค้าซ้ำที่หัวหน้า
      const setTable = (p, i, c, pos = i) => { const rs = ridersOf(p), m = MODE_MONTHS[p.mode] || 12, brk = pos > 0 && pos % 2 === 0;
        return `<div class="rp-set ${p.status === "ยกเลิก" ? "is-off" : ""} ${brk ? "pg-break" : ""}">
          ${brk ? `<div class="print-only rp-cont">${leadHead(c, true)}</div>` : ""}
          <div class="rp-set-head"><div><span class="rp-set-no">${ps_count(c) > 1 ? "ใบเสนอชุดที่ " + (i + 1) + " จาก " + ps_count(c) : "ใบเสนอ"}</span> <span class="small muted">เลขที่ ${esc(p.policy_no)}${p.start_date ? ", เริ่มคุ้มครอง " + thDate(p.start_date) : ""}</span>
            ${p.quote_file_id ? `<br><span class="small rp-quote">แนบใบเสนอขาย FWD${p.quote_no ? " เลขที่ " + esc(p.quote_no) : ""}</span> <button class="btn btn-ghost btn-sm no-print rp-quote-btn" type="button" data-quote-open="${esc(p.policy_no)}">เปิดไฟล์</button>` : ""}</div>${p.status !== stageOf(c) ? statusBadge(p.status) : ""}</div>
          <div class="table-wrap"><table class="rp-table">
            <thead><tr><th>สัญญา</th><th>ชื่อแบบประกันภัย</th><th class="num">ทุนประกันภัย</th><th class="num">เบี้ยประกันภัยรายปี</th><th>ระยะเวลาคุ้มครอง</th><th>ระยะเวลาส่งเบี้ย</th></tr></thead>
            <tbody>
              <tr class="rp-main"><td><span class="rp-tag">หลัก</span></td><td><b>${esc(p.plan)}</b></td><td class="num">${baht(p.sum_assured)}</td><td class="num">${baht(annualPremium(p))}</td>
                <td>${dash(p.coverage_term || (p.coverage_end ? "ถึง " + thDate(p.coverage_end) : ""))}</td><td>${p.payment_years ? esc(p.payment_years) + " ปี" : dash("")}</td></tr>
              ${rs.map(r => `<tr><td><span class="rp-tag rp-tag-r">เพิ่มเติม</span></td><td>${esc(r.name)}</td><td class="num">${r.sum ? baht(r.sum) : dash("")}</td>
                <td class="num">${r.premium ? baht(r.premium) : '<span class="badge b-ok">ฟรี</span>'}</td><td class="muted">ตามสัญญาหลัก</td><td class="muted">ตามสัญญาหลัก</td></tr>`).join("")}
            </tbody>
            <tfoot><tr><th colspan="3">รวมเบี้ยประกันภัยรายปีทั้งชุด</th><th class="num rp-total">${baht(totalAnnual(p))}</th>
              <th colspan="2" class="small">${m !== 12 ? "ชำระ" + esc(p.mode) + " งวดละ " + baht(installmentTotal(p)) : "ชำระรายปี"}</th></tr>
              ${(() => { const inc = money(c.monthly_income) * 12; if (!inc) return "";
                const pct = totalAnnual(p) / inc * 100;
                return `<tr class="rp-pct"><td colspan="3">เบี้ยประกันภัยรายปีเทียบกับรายได้ต่อปี (${baht(inc)})</td>
                  <td class="num"><b>${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%</b></td><td colspan="2"><span class="rp-bar"><i style="width:${Math.min(100, pct).toFixed(1)}%"></i></span></td></tr>`; })()}</tfoot>
          </table></div></div>`; };

      const leadBlock = (c) => { const st = stageOf(c), ps = polsOf(c), inc = money(c.monthly_income) * 12, best = bestOf(c), age = ageFrom(c.birthday);
        const q = [c.name, c.phone, c.occupation, (agentById[c.agent_id] || {}).name, ...ps.map(p => p.plan + " " + p.policy_no)].join(" ").toLowerCase();
        return `<section class="rp-lead" data-rp data-stage="${esc(st)}" data-agent="${esc(c.agent_id)}" data-q="${esc(q)}">
          ${leadHead(c, false)}
          ${ps.length ? ps.map((p, i) => setTable(p, (setNoOf(p, full.policies) || i + 1) - 1, c, i)).join("") : `<p class="muted rp-empty">ยังไม่มีใบเสนอ${c.note ? " บันทึก: " + esc(c.note) : ""}</p>`}
          ${ps.length && !inc ? `<p class="small muted rp-lead-foot">ยังไม่มีข้อมูลรายได้ของลูกค้า จึงยังเทียบเบี้ยกับรายได้ไม่ได้ (เพิ่มได้ที่ข้อมูลส่วนตัว)</p>` : ""}
        </section>`; };

      return `<div class="rp">
        <div class="rp-top">
          <div><h2 style="margin:0">รายงานใบเสนอ ลูกค้ามุ่งหวัง</h2>
            <p class="small muted" style="margin:4px 0 0">${esc(scope)}, ข้อมูล ณ วันที่ ${thDateLong(isoIn(0))}</p></div>
          <button class="btn btn-ghost btn-sm no-print" id="rpPrint" type="button">พิมพ์ / บันทึก PDF</button>
        </div>

        <ol class="rp-funnel">
          ${STAGES.map(s => `<li class="${s.key === "ยกเลิก" ? "is-off" : ""}"><button type="button" class="rp-stage" data-stage-btn="${s.key}" aria-pressed="${rpt.stage === s.key}">
            <b>${by[s.key].length}</b><span>${s.key}</span><small>${s.note}</small></button></li>`).join("")}
        </ol>

        <div class="rp-kpis">
          <div><span class="small muted">ลูกค้ามุ่งหวังทั้งหมด</span><b>${leads.length} ราย</b></div>
          <div><span class="small muted">ใบเสนอที่ยังเปิดอยู่</span><b>${setCount} ชุด</b></div>
          <div class="rp-kpi-main"><span class="small">เบี้ยประกันภัยรายปีคาดการณ์</span><b>${baht(forecast)}</b><small>นับชุดที่เบี้ยสูงสุดของแต่ละราย</small></div>
        </div>

        <div class="rp-filter no-print">
          <input id="rpQ" type="search" placeholder="ค้นหาชื่อลูกค้า แบบประกัน หรือเลขที่" value="${esc(rpt.q)}" aria-label="ค้นหาในรายงาน">
          ${full.leader ? `<select id="rpAgent" aria-label="กรองตามตัวแทน"><option value="">ตัวแทนทุกคน</option>${publicAgents(full.agents).map(a => `<option value="${esc(a.id)}" ${rpt.agent === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>` : ""}
          <button class="btn btn-ghost btn-sm" id="rpClear" type="button">ล้างตัวกรอง</button>
          <span class="small muted" id="rpCount" aria-live="polite"></span>
        </div>

        <div id="rpList">${sorted.map(leadBlock).join("") || `<p class="muted">ยังไม่มีลูกค้ามุ่งหวัง</p>`}</div>
        <p class="muted hidden" id="rpEmpty">ไม่พบรายการตามตัวกรอง</p>
        <p class="small muted rp-note">ใบเสนอนี้จัดทำโดยตัวแทนเพื่อประกอบการพิจารณา เงื่อนไขความคุ้มครองและเบี้ยประกันภัยที่ถูกต้องให้ยึดตามเอกสารของบริษัทประกันภัย</p>
      </div>`;
    }
    function bindReport() {
      if (!$("#rpList")) return;
      const apply = () => {
        const words = rpt.q.toLowerCase().trim().split(/\s+/).filter(Boolean); let n = 0;
        app.querySelectorAll("[data-rp]").forEach(el => {
          const ok = (!rpt.stage || el.dataset.stage === rpt.stage) && (!rpt.agent || el.dataset.agent === rpt.agent) && words.every(w => el.dataset.q.includes(w));
          el.classList.toggle("hidden", !ok); if (ok) n++;
        });
        app.querySelectorAll("[data-stage-btn]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.stageBtn === rpt.stage)));
        $("#rpCount").textContent = "แสดง " + n + " ราย" + (rpt.stage ? " สถานะ " + rpt.stage : "");
        $("#rpEmpty").classList.toggle("hidden", n > 0);
      };
      app.querySelectorAll("[data-stage-btn]").forEach(b => b.onclick = () => { rpt.stage = rpt.stage === b.dataset.stageBtn ? "" : b.dataset.stageBtn; apply(); });
      $("#rpQ").oninput = (e) => { rpt.q = e.target.value; apply(); };
      if ($("#rpAgent")) $("#rpAgent").onchange = (e) => { rpt.agent = e.target.value; apply(); };
      $("#rpClear").onclick = () => { rpt = { stage: "", agent: "", q: "" }; $("#rpQ").value = ""; if ($("#rpAgent")) $("#rpAgent").value = ""; apply(); };
      $("#rpPrint").onclick = () => window.print();
      apply();
    }

    $("#logout").onclick = logout;
    bindCalc(); bindCustomer(); bindReport(); bindQuotes(full.policies, view);
    app.querySelectorAll("[data-open-report]").forEach(b => b.onclick = () => { rpt = { stage: "", agent: "", q: b.dataset.openReport }; tab = "report"; custId = null; form = null; view(); window.scrollTo({ top: 0 }); });
    app.querySelectorAll("[data-cust]").forEach(b => b.onclick = () => { custId = b.dataset.cust; form = null; formKey = null; view(); window.scrollTo({ top: 0 }); });
    app.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { mode = b.dataset.mode; store.set("dashMode", mode); view(); });
    app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; custId = null; form = null; view(); });
    app.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => { filter = b.dataset.filter; saleF = ""; view(); });
    const sf = $("#saleFilter"); if (sf) sf.onchange = () => { saleF = sf.value; view(); };
    const s = $("#search"); if (s) s.oninput = (e) => { q = e.target.value.trim(); clearTimeout(s._t); s._t = setTimeout(() => { view(); const n = $("#search"); n.focus(); n.setSelectionRange(q.length, q.length); }, 250); };
    app.querySelectorAll("[data-done]").forEach(b => b.onclick = async () => {
      await Api.call("updateTicket", { token: State.session.token, id: b.dataset.done, status: "ตอบแล้ว" });
      const t = d.tickets.find(x => x.id === b.dataset.done); if (t) t.status = "ตอบแล้ว";
      toast("บันทึกว่าตอบแล้ว"); view();
    });

    app.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { editId = b.dataset.edit; pendingPhoto = null; view(); $("#agentForm")?.scrollIntoView({ behavior: "smooth", block: "start" }); $("#gName")?.focus({ preventScroll: true }); });
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
    const gc = $("#gCancel"); if (gc) gc.onclick = () => { editId = null; pendingPhoto = null; view(); };
    // รูปตัวแทน: เลือก > ดูตัวอย่าง > บันทึกพร้อมข้อมูล
    const keepForm = () => { // เก็บค่าที่พิมพ์ไว้ก่อนวาดฟอร์มใหม่
      const ids = ["gId", "gName", "gRole", "gLic", "gYears", "gPhone", "gLine", "gEmail", "gBackup", "gSpec", "gBio"];
      const vals = Object.fromEntries(ids.map(i => [i, $("#" + i) ? $("#" + i).value : ""])); const duty = $("#gDuty") && $("#gDuty").checked;
      view(); ids.forEach(i => { if ($("#" + i)) $("#" + i).value = vals[i]; }); if ($("#gDuty")) $("#gDuty").checked = duty;
    };
    const gp = $("#gPhoto"); if (gp) gp.onchange = async () => {
      const f = gp.files[0]; if (!f) return;
      if (f.size > 15 * 1024 * 1024) return toast("ไฟล์รูปใหญ่เกิน 15 MB", 4000);
      try { pendingPhoto = await squarePhoto(f); keepForm(); } catch (e2) { toast(e2.message, 4000); }
    };
    const gu = $("#gPhotoUndo"); if (gu) gu.onclick = () => { pendingPhoto = null; keepForm(); };
    const gd = $("#gPhotoDel"); if (gd) gd.onclick = async () => {
      if (!confirm("ลบรูปโปรไฟล์ของตัวแทนคนนี้?")) return;
      try { await Api.call("removeAgentPhoto", { token: State.session.token, id: editId });
        Object.assign(agentById[editId], { photo_url: "", photo_file_id: "" }); State.pub = null; store.del("pubCache"); toast("ลบรูปแล้ว"); keepForm();
      } catch (e2) { toast(e2.message, 4000); }
    };
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
        if (pendingPhoto) {
          gs.textContent = "กำลังอัปโหลดรูป…";
          try {
            const r = await Api.call("uploadAgentPhoto", { token: State.session.token, id: editId || agent.id, data: pendingPhoto.split(",")[1] });
            Object.assign(agentById[editId || agent.id], { photo_url: r.photo_url, photo_file_id: r.photo_file_id });
          } catch (e3) { toast("บันทึกข้อมูลแล้ว แต่อัปโหลดรูปไม่สำเร็จ: " + e3.message, 7000); }
        }
        pendingPhoto = null;
        State.pub = null; store.del("pubCache"); // ให้หน้าเว็บสาธารณะโหลดรายชื่อทีมใหม่
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
    let ver = "", miss = null, ms = 0;
    try { const t0 = performance.now(); const h = await Api.call("health"); ms = performance.now() - t0; ver = h.api_version || ""; miss = h.schema_missing; } catch {}
    if (ms) add(ms < 4000, "หลังบ้านตอบสนองใน " + (ms / 1000).toFixed(1) + " วินาที", "ช้ากว่าปกติ ลองใหม่อีกครั้ง ครั้งแรกหลังไม่ได้ใช้งานนาน Google จะใช้เวลาเริ่มระบบ 2-5 วินาที");
    add(ver >= REQUIRED_API, "หลังบ้าน (Code.gs) เป็นเวอร์ชันล่าสุด" + (ver ? " (" + ver + ")" : ""),
      "วาง Code.gs ล่าสุดใน Apps Script แล้วกด จัดการการทำให้ใช้งานได้ > ไอคอนดินสอ > เวอร์ชันใหม่ > ทำให้ใช้งานได้");
    if (Array.isArray(miss)) add(!miss.length, "Google Sheet มีคอลัมน์ครบ",
      "ยังขาด: " + miss.slice(0, 8).join(", ") + (miss.length > 8 ? " และอีก " + (miss.length - 8) + " คอลัมน์" : "") + " ให้กด ทีมงาน > อัปเดตโครงสร้างชีต ใน Google Sheet");
  }
  $("#diag").innerHTML = checks.join("");
}

/* =========================================================
   ไฟล์ใบเสนอขายจากระบบ FWD (PDF) แนบกับใบเสนอ/กรมธรรม์
   ไฟล์เก็บในโฟลเดอร์ Google Drive แบบส่วนตัว เปิดได้ผ่านเว็บหลังตรวจสิทธิ์เท่านั้น
   ========================================================= */
const QUOTE_MAX_MB = 10;
const fileToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = () => rej(new Error("อ่านไฟล์ไม่ได้")); r.readAsDataURL(file);
});
function quoteBox(p) {
  const no = esc(p.policy_no);
  return `<div class="quote-box" data-quote-box="${no}">
    ${p.quote_file_id ? `<div class="quote-has">
        <div><span class="quote-ico" aria-hidden="true">PDF</span>
          <b>ใบเสนอขายจาก FWD</b>${p.quote_no ? ` เลขที่ ${esc(p.quote_no)}` : ""}<br>
          <span class="small muted">${esc(p.quote_file_name || "ไฟล์ PDF")}${p.quote_uploaded ? ", แนบเมื่อ " + thDate(p.quote_uploaded) : ""}</span></div>
        <div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-quote-open="${no}">เปิดดู</button>
          <button class="btn btn-ghost btn-sm" type="button" data-quote-pick="${no}">เปลี่ยนไฟล์</button>
          <button class="btn btn-ghost btn-sm quote-del" type="button" data-quote-del="${no}">ลบ</button></div>
      </div>` : `<div class="quote-empty"><span class="small muted">ยังไม่ได้แนบไฟล์ใบเสนอขายจากระบบ FWD</span>
        <button class="btn btn-ghost btn-sm" type="button" data-quote-pick="${no}">แนบไฟล์ PDF</button></div>`}
    <div class="quote-form hidden" data-quote-form="${no}">
      <label>เลขที่ใบเสนอขาย FWD (ถ้ามี)<input data-quote-no value="${esc(p.quote_no || "")}" placeholder="เช่น A256910010001488" autocapitalize="characters"></label>
      <label>ไฟล์ PDF (ไม่เกิน ${QUOTE_MAX_MB} MB)<input type="file" accept="application/pdf,.pdf" data-quote-file></label>
      <div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-quote-up="${no}">อัปโหลด</button>
        <button class="btn btn-ghost btn-sm" type="button" data-quote-cancel="${no}">ยกเลิก</button></div>
      <p class="small muted" style="margin:0">ไฟล์มีข้อมูลส่วนตัวของลูกค้า ระบบเก็บไว้ในโฟลเดอร์ส่วนตัวของทีม ไม่มีลิงก์สาธารณะ</p>
    </div>
  </div>`;
}
async function openQuote(no) {
  const w = window.open("", "_blank"); // เปิดหน้าต่างก่อน กันเบราว์เซอร์บล็อกป๊อปอัป
  if (w) w.document.write('<p style="font-family:sans-serif;padding:20px">กำลังเปิดไฟล์ใบเสนอขาย…</p>');
  try {
    const r = await Api.call("getQuote", { token: State.session.token, policy_no: no });
    const bytes = Uint8Array.from(atob(r.data), ch => ch.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: r.mime || "application/pdf" }));
    if (w) w.location.href = url;
    else { const a = document.createElement("a"); a.href = url; a.download = r.name || no + ".pdf"; document.body.appendChild(a); a.click(); a.remove(); }
    setTimeout(() => URL.revokeObjectURL(url), 300000);
  } catch (e) { if (w) w.close(); toast(e.message, 4000); }
}
function bindQuotes(policies, rerender) {
  app.querySelectorAll("[data-quote-open]").forEach(b => b.onclick = () => openQuote(b.dataset.quoteOpen));
  app.querySelectorAll("[data-quote-pick]").forEach(b => b.onclick = () => {
    const f = app.querySelector(`[data-quote-form="${CSS.escape(b.dataset.quotePick)}"]`); f.classList.remove("hidden"); f.querySelector("[data-quote-file]").focus();
  });
  app.querySelectorAll("[data-quote-cancel]").forEach(b => b.onclick = () => app.querySelector(`[data-quote-form="${CSS.escape(b.dataset.quoteCancel)}"]`).classList.add("hidden"));
  app.querySelectorAll("[data-quote-up]").forEach(b => b.onclick = async () => {
    const no = b.dataset.quoteUp, box = app.querySelector(`[data-quote-form="${CSS.escape(no)}"]`);
    const file = box.querySelector("[data-quote-file]").files[0], quote_no = box.querySelector("[data-quote-no]").value.trim().toUpperCase();
    if (!file) return toast("เลือกไฟล์ PDF ก่อน");
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return toast("รองรับเฉพาะไฟล์ PDF", 4000);
    if (file.size > QUOTE_MAX_MB * 1024 * 1024) return toast("ไฟล์ใหญ่เกิน " + QUOTE_MAX_MB + " MB", 4000);
    b.disabled = true; b.textContent = "กำลังอัปโหลด…";
    try {
      const r = await Api.call("uploadQuote", { token: State.session.token, policy_no: no, name: file.name, mime: "application/pdf", quote_no, data: await fileToBase64(file) });
      const p = policies.find(x => x.policy_no === no); if (p) Object.assign(p, r.fields);
      toast("แนบไฟล์ใบเสนอขายแล้ว"); rerender();
    } catch (e) { b.disabled = false; b.textContent = "อัปโหลด"; toast(e.message, 5000); }
  });
  app.querySelectorAll("[data-quote-del]").forEach(b => b.onclick = async () => {
    if (!confirm("ลบไฟล์ใบเสนอขายนี้? (ไฟล์จะถูกย้ายไปถังขยะใน Google Drive)")) return;
    try {
      const r = await Api.call("deleteQuote", { token: State.session.token, policy_no: b.dataset.quoteDel });
      const p = policies.find(x => x.policy_no === b.dataset.quoteDel); if (p) Object.assign(p, r.fields);
      toast("ลบไฟล์แล้ว"); rerender();
    } catch (e) { toast(e.message, 4000); }
  });
}

/* รูปตัวแทน: ตัดเป็นสี่เหลี่ยมจัตุรัส (เผื่อหน้าอยู่ค่อนบน) และย่อเป็น 400x400 JPEG ก่อนอัปโหลด */
async function squarePhoto(file, size = 400) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("เปิดรูปนี้ไม่ได้ ลองใช้ไฟล์ JPG หรือ PNG")); i.src = url; });
    const w = img.naturalWidth, h = img.naturalHeight, side = Math.min(w, h);
    const sx = (w - side) / 2, sy = h > w ? (h - side) * 0.25 : 0; // รูปแนวตั้ง: ตัดค่อนบนให้เห็นหน้า
    const cv = document.createElement("canvas"); cv.width = cv.height = size;
    const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, size, size);
    cx.imageSmoothingQuality = "high"; cx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return cv.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}

/* ถ้ามีข้อผิดพลาดที่ไม่คาดคิด ไม่ให้หน้าเว็บค้างที่ "กำลังโหลด" */
window.addEventListener("error", (ev) => {
  const l = app && app.querySelector(".loading"); if (!l) return;
  l.innerHTML = `<p class="error">เกิดข้อผิดพลาดในหน้าเว็บ: ${esc(ev.message || "")}</p><button class="btn btn-primary" type="button" onclick="location.reload()">โหลดใหม่</button>`;
});

/* ลิงก์แอป FWD Omne: เลือกร้านแอปตามเครื่องที่ใช้ (คอมพิวเตอร์ไปหน้าข้อมูลของ FWD) */
const omneUrl = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? CONFIG.OMNE.ios
  : /android/i.test(navigator.userAgent) ? CONFIG.OMNE.android : CONFIG.OMNE.web;
function omneCard(compact) {
  return `<div class="panel omne ${compact ? "omne-compact" : ""}">
    <div class="omne-head"><span class="omne-ico" aria-hidden="true">Omne</span>
      <div><h3 style="margin:0">ดูรายละเอียดกรมธรรม์ ชำระเบี้ย และยื่นเคลม ด้วยตัวเองผ่านแอป FWD Omne</h3>
      <p class="small muted" style="margin:4px 0 0">แอปทางการของ FWD ข้อมูลกรมธรรม์ล่าสุดจากบริษัทโดยตรง ใช้ได้ตลอด 24 ชั่วโมง</p></div></div>
    ${compact ? "" : `<ol class="omne-steps">
      <li><b>ดาวน์โหลดแอป</b> "FWD Omne" จาก App Store หรือ Google Play (กดปุ่มด้านล่าง)</li>
      <li><b>สมัครบริการออนไลน์ลูกค้า FWD</b> ด้วยหมายเลขบัตรประชาชนของผู้เอาประกัน</li>
      <li><b>เข้าสู่ระบบ</b> แล้วดูกรมธรรม์ทั้งหมด ชำระเบี้ย หรือยื่นเคลมได้ทันที</li>
    </ol>
    <ul class="omne-feat"><li>ดูกรมธรรม์และความคุ้มครองทั้งหมดในหน้าเดียว</li><li>ชำระเบี้ยออนไลน์ด้วยบัตร</li><li>ยื่นเคลมและติดตามสถานะ</li></ul>`}
    <div class="btn-row">
      <a class="btn btn-primary" href="${esc(omneUrl())}" target="_blank" rel="noopener">เปิด / ดาวน์โหลด FWD Omne</a>
      ${compact ? "" : `<a class="btn btn-ghost btn-sm" href="${esc(CONFIG.OMNE.ios)}" target="_blank" rel="noopener">App Store</a>
      <a class="btn btn-ghost btn-sm" href="${esc(CONFIG.OMNE.android)}" target="_blank" rel="noopener">Google Play</a>`}
    </div>
    ${compact ? "" : `<p class="small muted" style="margin:10px 0 0">ข้อมูลในเว็บของทีมเป็นข้อมูลที่ตัวแทนบันทึกไว้เพื่อดูแลคุณ ข้อมูลที่เป็นทางการให้ยึดตามแอป FWD Omne และเอกสารของบริษัท ติดปัญหาการสมัครหรือใช้งาน ทักตัวแทนของคุณได้เลย</p>`}
  </div>`;
}
/* รูปถ่ายลูกค้า (เก็บแบบส่วนตัว โหลดผ่านหลังบ้านหลังตรวจสิทธิ์) */
const custPhotoCache = {};
async function loadCustomerPhoto(el, customerId) {
  const key = customerId || "me";
  try {
    if (!custPhotoCache[key]) { const r = await Api.call("getCustomerPhoto", { token: State.session.token, customer_id: customerId }); custPhotoCache[key] = "data:image/jpeg;base64," + r.data; }
    el.innerHTML = `<img src="${custPhotoCache[key]}" alt="">`;
  } catch {}
}
function customerPhotoBlock(c, canUpload, customerId) {
  const allowed = String(c.consent_items || "").split(",").includes("photo");
  return `<div class="cphoto" data-cphoto="${esc(customerId || "")}">
    <span class="ava lg" data-cphoto-img>${esc(initials(c.name))}</span>
    <div>${!allowed ? `<p class="small muted" style="margin:0">${customerId ? "ลูกค้ายังไม่ได้ยินยอมให้เก็บรูปถ่าย" : 'ต้องการเพิ่มรูปโปรไฟล์ ให้ความยินยอมเรื่อง "รูปถ่ายและสำเนาเอกสาร" ได้ที่ <a href="#/consent">จัดการความยินยอม</a>'}</p>`
      : canUpload ? `<div class="btn-row"><label class="btn btn-ghost btn-sm">${c.photo_file_id ? "เปลี่ยนรูป" : "เพิ่มรูปถ่าย"}<input type="file" accept="image/*" class="sr-only" data-cphoto-file></label>
        ${c.photo_file_id ? `<button class="btn btn-ghost btn-sm quote-del" type="button" data-cphoto-del>ลบรูป</button>` : ""}</div>
        <p class="small muted" style="margin:6px 0 0">รูปเก็บแบบส่วนตัว เห็นเฉพาะ${customerId ? "ลูกค้าและตัวแทนที่ดูแล" : "คุณและตัวแทนที่ดูแล"}</p>` : ""}</div>
  </div>`;
}
function bindCustomerPhoto(c, customerId, rerender) {
  const box = app.querySelector("[data-cphoto]"); if (!box) return;
  if (c.photo_file_id) loadCustomerPhoto(box.querySelector("[data-cphoto-img]"), customerId);
  const f = box.querySelector("[data-cphoto-file]");
  if (f) f.onchange = async () => {
    const file = f.files[0]; if (!file) return;
    if (file.size > 15 * 1024 * 1024) return toast("ไฟล์รูปใหญ่เกิน 15 MB", 4000);
    toast("กำลังอัปโหลดรูป…", 8000);
    try {
      const data = (await squarePhoto(file)).split(",")[1];
      const r = await Api.call("uploadCustomerPhoto", { token: State.session.token, customer_id: customerId, data });
      c.photo_file_id = r.photo_file_id; custPhotoCache[customerId || "me"] = "data:image/jpeg;base64," + data;
      toast("บันทึกรูปแล้ว"); rerender();
    } catch (e) { toast(e.message, 5000); }
  };
  const d = box.querySelector("[data-cphoto-del]");
  if (d) d.onclick = async () => {
    if (!confirm("ลบรูปถ่ายนี้?")) return;
    try { await Api.call("removeCustomerPhoto", { token: State.session.token, customer_id: customerId });
      c.photo_file_id = ""; delete custPhotoCache[customerId || "me"]; toast("ลบรูปแล้ว"); rerender(); } catch (e) { toast(e.message, 4000); }
  };
}

/* ---------- boot ---------- */
$("#brandName").firstChild.textContent = CONFIG.TEAM_NAME;
$("#menuBtn").onclick = () => { const n = $("#nav"); const open = n.classList.toggle("open"); $("#menuBtn").setAttribute("aria-expanded", String(open)); };
window.addEventListener("hashchange", router);
router();
