/* =========================================================
   เว็บทีมตัวแทนประกันชีวิต — app.js
   - ไม่ต้องติดตั้งอะไร ใช้คู่กับ index.html บน GitHub Pages
   - ถ้ายังไม่ใส่ SHEET_API_URL ระบบจะใช้ "ข้อมูลตัวอย่าง" (DEMO)
   - ใส่ URL ของ Google Apps Script (ไฟล์ Code.gs) เพื่อดึงข้อมูลจริงจาก Google Sheet
   ========================================================= */

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
const thDate = (d) => d ? new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-";
const daysUntil = (d) => Math.ceil((new Date(d).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
const isoIn = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const initials = (name) => (String(name || "?").replace(/^(คุณ|นาย|นาง|นางสาว)\s*/, "").trim()[0] || "?");
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
function avatar(p, size = "") {
  const src = p && p.photo_url;
  return `<span class="ava ${size}">${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : esc(initials(p && p.name))}</span>`;
}
function statusBadge(s) {
  const map = {
    "มีผลบังคับ": "b-ok", "ชำระแล้ว": "b-ok", "อนุมัติ": "b-ok", "ตอบแล้ว": "b-ok", "ปิดเรื่อง": "b-ok",
    "รอชำระ": "b-warn", "รอพิจารณา": "b-warn", "รอเอกสาร": "b-warn", "รอตอบ": "b-warn", "ลูกค้ามุ่งหวัง": "b-info",
    "ขาดอายุ": "b-bad", "ไม่อนุมัติ": "b-bad", "เลยกำหนด": "b-bad"
  };
  return `<span class="badge ${map[s] || "b-info"}">${esc(s)}</span>`;
}
async function sha256(text) {
  if (!window.crypto || !crypto.subtle) return text; // เบราว์เซอร์เก่า (GitHub Pages เป็น https จึงใช้ได้)
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
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
      bio: "ดูแลครอบครัวที่มีลูกเล็ก ประกันสุขภาพเด็กและทุนการศึกษา", specialties: ["ประกันเด็ก", "ทุนการศึกษา"], password: "agent123" }
  ],
  customers: [
    { id: "C001", name: "คุณมานี มีสุข", phone: "0890000001", type: "ลูกค้า", agent_id: "A02", line_group_url: "https://line.me/R/ti/g/xxxx", birthday: "1985-03-12", photo_url: "", note: "ชอบให้ติดต่อทาง LINE", password: "1234" },
    { id: "C002", name: "คุณปิติ รุ่งเรือง", phone: "0890000002", type: "ลูกค้า", agent_id: "A02", line_group_url: "", birthday: "1979-11-02", photo_url: "", note: "", password: "1234" },
    { id: "C003", name: "คุณชูใจ สดใส", phone: "0890000003", type: "ลูกค้า", agent_id: "A03", line_group_url: "", birthday: "1992-07-21", photo_url: "", note: "สนใจเพิ่มประกันสุขภาพ", password: "1234" },
    { id: "C004", name: "คุณวีระ กล้าหาญ", phone: "0890000004", type: "ลูกค้ามุ่งหวัง", agent_id: "A03", line_group_url: "", birthday: "", photo_url: "", note: "นัดคุยแผนเกษียณสัปดาห์หน้า", password: "" },
    { id: "C005", name: "คุณดวงใจ อิ่มเอม", phone: "0890000005", type: "ลูกค้ามุ่งหวัง", agent_id: "A04", line_group_url: "", birthday: "", photo_url: "", note: "มีลูก 2 คน สนใจประกันเด็ก", password: "" },
    { id: "C006", name: "คุณสมชาย ทองดี", phone: "0890000006", type: "ลูกค้า", agent_id: "A01", line_group_url: "", birthday: "1970-01-30", photo_url: "", note: "", password: "1234" }
  ],
  policies: [
    { policy_no: "P-10001", customer_id: "C001", plan: "ประกันสุขภาพเหมาจ่าย", sum_assured: 5000000, premium: 28500, mode: "รายปี", start_date: "2022-05-01", next_due: isoIn(9), status: "มีผลบังคับ" },
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
      // เซสชันใช้ไม่ได้แล้ว: ล้างการล็อกอินเดิม แล้วพาไปหน้าเข้าสู่ระบบ
      if (/เซสชัน|ไม่มีสิทธิ์/.test(e.message) && State.session) {
        State.session = null; store.del("session"); State.loginNotice = e.message;
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
        return { token: "demo-" + c.id, role: "customer", user_id: c.id, name: c.name };
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
    const leader = me.role === "หัวหน้าทีม";
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
      agents: DEMO.agents.map(({ password, ...a }) => a)
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
  addLead({ token, name, phone, note }) {
    const agent_id = token.replace("demo-", "");
    const c = { id: "C" + Date.now(), name, phone, type: "ลูกค้ามุ่งหวัง", agent_id, note, line_group_url: "", birthday: "", photo_url: "", password: "" };
    DEMO.customers.push(c); return { ok: true };
  }
};

/* =========================================================
   STATE + ROUTER
   ========================================================= */
const State = { pub: null, session: store.get("session"), loginNotice: "" };
// ล็อกอินที่ค้างมาจากโหมดตัวอย่าง ใช้กับ Google Sheet จริงไม่ได้ ล้างทิ้งอัตโนมัติ
if (CONFIG.SHEET_API_URL && State.session && String(State.session.token).startsWith("demo-")) {
  State.session = null; store.del("session");
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
  "dashboard": renderDashboard
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
  const { agents, posts, faq } = await loadPublic();
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
  const { agents } = await loadPublic();
  app.innerHTML = `<section class="block"><div class="wrap">
    <div class="section-head"><h1>ทีมของเรา</h1><p class="muted">เลือกตัวแทนที่ถนัดเรื่องที่คุณสนใจ หรือทัก LINE ทีมให้เราจับคู่ให้</p></div>
    ${teamGrid(agents, agents.find(a => a.role === "หัวหน้าทีม"))}</div></section>${contactBand()}`;
}

async function renderAgent(id) {
  const { agents } = await loadPublic();
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
  if (State.session) { location.hash = State.session.role === "agent" ? "#/dashboard" : "#/portal"; return; }
  let role = "customer";
  app.innerHTML = `<section class="block"><div class="wrap">
    <h1>เข้าสู่ระบบสมาชิก</h1>
    ${State.loginNotice ? `<div class="notice" style="margin-bottom:16px">${esc(State.loginNotice)}</div>` : ""}
    <div class="seg" role="group" aria-label="ประเภทสมาชิก" style="margin:12px 0 24px">
      <button type="button" data-role="customer" aria-pressed="true">ลูกค้า</button>
      <button type="button" data-role="agent" aria-pressed="false">ตัวแทน</button>
    </div>
    <div class="form" id="loginForm">
      <label><span id="userLabel">เบอร์โทรศัพท์</span><input id="username" inputmode="tel" autocomplete="username"></label>
      <label>รหัสผ่าน<input id="password" type="password" autocomplete="current-password"></label>
      <p class="error" id="loginErr" role="alert"></p>
      <button class="btn btn-primary" id="loginBtn" type="button">เข้าสู่ระบบ</button>
      <p class="small muted">ยังไม่มีรหัสผ่าน? ขอรหัสจากตัวแทนของคุณทาง LINE</p>
      ${Api.live() ? "" : `<div class="notice">โหมดตัวอย่าง: ลูกค้าใช้เบอร์ 0890000001 รหัส 1234, ตัวแทนใช้รหัส A02 (หรือ A01 สำหรับหัวหน้าทีม) รหัสผ่าน agent123</div>`}
    </div></div></section>`;

  app.querySelectorAll(".seg button").forEach(b => b.onclick = () => {
    role = b.dataset.role;
    app.querySelectorAll(".seg button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    $("#userLabel").textContent = role === "agent" ? "รหัสตัวแทน" : "เบอร์โทรศัพท์";
    $("#username").inputMode = role === "agent" ? "text" : "tel";
  });
  const submit = async () => {
    const username = $("#username").value.trim(), pw = $("#password").value;
    $("#loginErr").textContent = "";
    if (!username || !pw) { $("#loginErr").textContent = "กรอกข้อมูลให้ครบทั้งสองช่อง"; return; }
    $("#loginBtn").disabled = true; $("#loginBtn").textContent = "กำลังตรวจสอบ…";
    try {
      const s = await Api.call("login", { role, username, password_hash: await sha256(pw) });
      State.session = s; store.set("session", s); State.loginNotice = "";
      location.hash = s.role === "agent" ? "#/dashboard" : "#/portal";
    } catch (e) {
      $("#loginErr").textContent = e.message;
      $("#loginBtn").disabled = false; $("#loginBtn").textContent = "เข้าสู่ระบบ";
    }
  };
  $("#loginBtn").onclick = submit;
  $("#password").onkeydown = (e) => { if (e.key === "Enter") submit(); };
}
function logout() { State.session = null; store.del("session"); location.hash = "#/"; }
function requireRole(role) {
  if (!State.session || State.session.role !== role) { location.hash = "#/login"; return false; }
  return true;
}

/* =========================================================
   CUSTOMER PORTAL
   ========================================================= */
async function renderPortal() {
  if (!requireRole("customer")) return;
  const d = await Api.call("customerData", { token: State.session.token });
  const upcoming = [...d.policies].filter(p => p.next_due).sort((a, b) => new Date(a.next_due) - new Date(b.next_due))[0];
  let tab = "overview";

  const view = () => {
    const tabs = [["overview", "ภาพรวม"], ["policies", "กรมธรรม์"], ["pay", "การชำระเบี้ย"], ["claims", "การเคลม"], ["contact", "สอบถาม/แจ้งปัญหา"]];
    app.innerHTML = `<div class="wrap">
      <div class="app-head"><div><h1 style="margin:0;font-size:1.8rem">สวัสดี ${esc(d.me.name)}</h1><span class="muted small">ข้อมูลอัปเดตจากทีมตัวแทน ยึดเอกสารของบริษัทเป็นหลัก</span></div>
      <button class="btn btn-ghost btn-sm" id="logout">ออกจากระบบ</button></div>
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
      <tbody>${d.policies.map(p => `<tr><td>${esc(p.policy_no)}</td><td>${esc(p.plan)}</td><td class="num">${baht(p.sum_assured)}</td><td class="num">${baht(p.premium)}</td><td>${esc(p.mode)}</td><td>${thDate(p.start_date)}</td><td>${statusBadge(p.status)}</td></tr>`).join("") || `<tr><td colspan="7">ยังไม่มีกรมธรรม์ในระบบ</td></tr>`}</tbody>
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
  let tab = "today", filter = "ทั้งหมด", q = "";
  // หัวหน้าทีมสลับได้ 2 มุมมอง: "team" = เห็นทั้งทีม, "mine" = ทำงานขายเองเหมือนลูกทีมคนหนึ่ง
  let mode = full.leader ? (store.get("dashMode") || "team") : "mine";
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
    if (tab === "team" && !d.leader) tab = "today";
    const due = d.policies.filter(p => daysUntil(p.next_due) <= CONFIG.REMIND_DAYS).sort((a, b) => new Date(a.next_due) - new Date(b.next_due));
    const pending = d.tickets.filter(t => t.status === "รอตอบ");
    const leads = d.customers.filter(c => c.type === "ลูกค้ามุ่งหวัง");
    const tabs = [["today", "งานวันนี้"], ["customers", "ลูกค้า"], ["claims", "เคลม"], ...(d.leader ? [["team", "ภาพรวมทีม"]] : [])];

    app.innerHTML = `<div class="wrap">
      <div class="app-head"><div><h1 style="margin:0;font-size:1.8rem">${esc(d.me.name)}</h1><span class="muted small">${esc(d.me.role)}${full.leader ? (mode === "team" ? ", กำลังดูข้อมูลทั้งทีม" : ", กำลังดูเฉพาะลูกค้าของคุณ") : ""}</span></div>
      <div class="btn-row" style="align-items:center">
        ${full.leader ? `<div class="seg" role="group" aria-label="เลือกมุมมอง">
          <button type="button" data-mode="team" aria-pressed="${mode === "team"}">มุมมองหัวหน้าทีม</button>
          <button type="button" data-mode="mine" aria-pressed="${mode === "mine"}">งานขายของฉัน</button></div>` : ""}
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

      if (tab === "customers") {
        const list = d.customers.filter(c => (filter === "ทั้งหมด" || c.type === filter) && (!q || (c.name + c.phone).includes(q)));
        return `<div class="panel">
          <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:14px">
            <div class="seg" role="group" aria-label="กรองลูกค้า">${["ทั้งหมด", "ลูกค้า", "ลูกค้ามุ่งหวัง"].map(f => `<button type="button" data-filter="${f}" aria-pressed="${filter === f}">${f}</button>`).join("")}</div>
            <input id="search" placeholder="ค้นหาชื่อหรือเบอร์โทร" value="${esc(q)}" style="max-width:260px">
          </div>
          <div class="table-wrap"><table><thead><tr><th>ชื่อ</th><th>ประเภท</th><th>เบอร์โทร</th><th>ตัวแทนหลัก</th><th>กรมธรรม์</th><th>บันทึก</th></tr></thead>
          <tbody>${list.map(c => `<tr><td>${esc(c.name)}</td><td>${statusBadge(c.type)}</td><td><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></td><td>${esc((agentById[c.agent_id] || {}).name)}</td>
            <td>${d.policies.filter(p => p.customer_id === c.id).map(p => esc(p.policy_no)).join("<br>") || "-"}</td><td class="small">${esc(c.note)}</td></tr>`).join("") || `<tr><td colspan="6">ไม่พบลูกค้าตามเงื่อนไข</td></tr>`}</tbody></table></div></div>
          <div class="panel"><h3>เพิ่มลูกค้ามุ่งหวัง</h3><div class="form">
            <label>ชื่อ<input id="lName"></label><label>เบอร์โทร<input id="lPhone" inputmode="tel"></label><label>บันทึก<input id="lNote" placeholder="เช่น สนใจประกันสุขภาพ นัดคุยวันเสาร์"></label>
            <button class="btn btn-primary" id="addLead" type="button">เพิ่มลูกค้ามุ่งหวัง</button></div></div>`;
      }
      if (tab === "claims") return `<div class="panel"><h3>เคลมของลูกค้า</h3><div class="table-wrap"><table>
        <thead><tr><th>วันที่</th><th>ลูกค้า</th><th>กรมธรรม์</th><th>ประเภท</th><th class="num">จำนวน</th><th>สถานะ</th><th>หมายเหตุ</th></tr></thead>
        <tbody>${d.claims.map(c => { const p = d.policies.find(x => x.policy_no === c.policy_no) || {}; return `<tr><td>${thDate(c.date)}</td><td>${esc((custById[p.customer_id] || {}).name)}</td><td>${esc(c.policy_no)}</td><td>${esc(c.type)}</td><td class="num">${baht(c.amount)}</td><td>${statusBadge(c.status)}</td><td>${esc(c.note)}</td></tr>`; }).join("") || `<tr><td colspan="7">ยังไม่มีรายการเคลม</td></tr>`}</tbody></table></div></div>`;

      // team overview (leader only)
      const rows = d.agents.map(a => {
        const cs = d.customers.filter(c => c.agent_id === a.id);
        const ps = d.policies.filter(p => cs.some(c => c.id === p.customer_id));
        return { a, clients: cs.filter(c => c.type === "ลูกค้า").length, leads: cs.filter(c => c.type === "ลูกค้ามุ่งหวัง").length,
          premium: ps.reduce((s, p) => s + Number(p.premium || 0) * (p.mode === "รายเดือน" ? 12 : 1), 0),
          open: d.tickets.filter(t => t.agent_id === a.id && t.status === "รอตอบ").length };
      });
      return `<div class="panel"><h3>ผลงานรายตัวแทน</h3><div class="table-wrap"><table>
        <thead><tr><th>ตัวแทน</th><th class="num">ลูกค้า</th><th class="num">มุ่งหวัง</th><th class="num">เบี้ยรายปีรวม</th><th class="num">เรื่องรอตอบ</th><th>ตัวแทนสำรอง</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${esc(r.a.name)}</td><td class="num">${r.clients}</td><td class="num">${r.leads}</td><td class="num">${baht(r.premium)}</td><td class="num">${r.open ? statusBadge(r.open + " เรื่อง") : "0"}</td><td>${esc((agentById[r.a.backup_id] || {}).name || "-")}</td></tr>`).join("")}</tbody></table></div></div>`;
    }

    $("#logout").onclick = logout;
    app.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { mode = b.dataset.mode; store.set("dashMode", mode); view(); });
    app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; view(); });
    app.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => { filter = b.dataset.filter; view(); });
    const s = $("#search"); if (s) s.oninput = (e) => { q = e.target.value.trim(); clearTimeout(s._t); s._t = setTimeout(() => { view(); const n = $("#search"); n.focus(); n.setSelectionRange(q.length, q.length); }, 250); };
    app.querySelectorAll("[data-done]").forEach(b => b.onclick = async () => {
      await Api.call("updateTicket", { token: State.session.token, id: b.dataset.done, status: "ตอบแล้ว" });
      const t = d.tickets.find(x => x.id === b.dataset.done); if (t) t.status = "ตอบแล้ว";
      toast("บันทึกว่าตอบแล้ว"); view();
    });
    const add = $("#addLead"); if (add) add.onclick = async () => {
      const name = $("#lName").value.trim(), phone = $("#lPhone").value.replace(/\D/g, ""), note = $("#lNote").value.trim();
      if (!name || !phone) { toast("กรอกชื่อและเบอร์โทร"); return; }
      await Api.call("addLead", { token: State.session.token, name, phone, note });
      const lead = { id: "new" + Date.now(), name, phone, note, type: "ลูกค้ามุ่งหวัง", agent_id: full.me.id };
      full.customers.push(lead); custById[lead.id] = lead;
      toast("เพิ่มลูกค้ามุ่งหวังแล้ว"); view();
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
  isIOS: () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
  dismissed: () => { const t = store.get("installDismissed"); return t && Date.now() - t < 14 * 86400000; },
  show(html, onInstall) {
    if (this.standalone() || this.dismissed() || $(".install-bar")) return;
    const bar = document.createElement("div");
    bar.className = "install-bar"; bar.setAttribute("role", "dialog"); bar.setAttribute("aria-label", "ติดตั้งแอป");
    bar.innerHTML = `<img src="icons/icon-192.png" alt=""><p>${html}</p>
      ${onInstall ? `<button class="btn btn-primary btn-sm" id="pwaInstall">ติดตั้ง</button>` : ""}
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
if (PWA.isIOS() && !PWA.standalone()) {
  setTimeout(() => PWA.show("<b>ติดตั้งแอปบน iPhone/iPad</b><br>แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรขึ้น) แล้วเลือก \"เพิ่มไปยังหน้าจอโฮม\""), 2500);
}

/* ---------- boot ---------- */
$("#brandName").firstChild.textContent = CONFIG.TEAM_NAME;
$("#brandMark").textContent = initials(CONFIG.TEAM_NAME.replace(/^ทีม/, ""));
$("#menuBtn").onclick = () => { const n = $("#nav"); const open = n.classList.toggle("open"); $("#menuBtn").setAttribute("aria-expanded", String(open)); };
window.addEventListener("hashchange", router);
router();
