import { useState } from "react";
import { jsPDF } from "jspdf";

// ─── MASTER DEFAULTS ──────────────────────────────────────────────────────────
const DEFAULTS = {
  hoursPerDay: 18,
  pricePerDay: 1500,
  highEndBuffer: 0.2,
};

// ─── ROOM CONFIGS ─────────────────────────────────────────────────────────────
const ROOMS = [
  {
    id: "kitchen", label: "Kitchen", icon: "🍳",
    fields: [
      { id: "handles", label: "Number of handles (cabinets + drawers)", type: "select", options: [
        { label: "Under 30 handles", hours: 12 },
        { label: "31–59 handles", hours: 18 },
        { label: "60+ handles", hours: 24 },
      ]},
      { id: "fridge", label: "Organize refrigerator?", type: "toggle", hours: 6, note: "Adds equivalent of ~8 handles to count" },
      { id: "moveReno", label: "Unpacking from move or renovation?", type: "toggle", hours: 6 },
      { id: "overflow", label: "Kitchen items in other areas to integrate?", type: "toggle", hours: 6 },
    ],
    productMultiplier: 0.5,
  },
  {
    id: "pantry", label: "Pantry", icon: "🥫",
    fields: [
      { id: "type", label: "Pantry type", type: "select", options: [
        { label: "Reach-in", hours: 6 },
        { label: "L-shaped", hours: 8 },
        { label: "U-shaped", hours: 12 },
      ]},
    ],
    productMultiplier: 1.0,
  },
  {
    id: "clothingCloset", label: "Clothing Closet", icon: "👗",
    fields: [
      { id: "size", label: "Closet size / type", type: "select", options: [
        { label: "Reach-in (no folding, no editing)", hours: 6 },
        { label: "Walk-in", hours: 12 },
        { label: "Has island (or big enough for one)", hours: 18 },
      ]},
      { id: "edit", label: "Client wants to reduce / edit items?", type: "toggle", hours: 6 },
      { id: "drawers", label: "Number of drawers", type: "select", options: [
        { label: "None", hours: 0 },
        { label: "Fewer than 6", hours: 3 },
        { label: "6 or more", hours: 6 },
      ]},
      { id: "hangers", label: "Switching out hangers to match?", type: "toggle", hours: 3 },
      { id: "newSystem", label: "New closet system? (design time only)", type: "toggle", hours: 2, note: "Design only — does not include cost of system (min $1,500)" },
    ],
    productMultiplier: 0.5,
  },
  {
    id: "nonClothingCloset", label: "Non-Clothing Closet", icon: "🗄️",
    fields: [
      { id: "type", label: "Closet type", type: "select", options: [
        { label: "Linen / cleaning / medicine — small", hours: 3 },
        { label: "Linen / cleaning / medicine — large", hours: 6 },
        { label: "Craft / hobby / storage — small", hours: 6 },
        { label: "Craft / hobby / storage — large", hours: 12 },
      ]},
    ],
    productMultiplier: 0.5,
  },
  {
    id: "playroom", label: "Playroom", icon: "🧸",
    fields: [
      { id: "size", label: "Total size of all toy areas combined", type: "select", options: [
        { label: "Part of a room (living room, bedroom, etc.)", hours: 6 },
        { label: "Size of a bedroom", hours: 12 },
        { label: "Great room / very large (e.g. basement)", hours: 18 },
      ]},
    ],
    productMultiplier: 0.5,
  },
  {
    id: "garage", label: "Garage", icon: "🚗",
    fields: [
      { id: "parkableSlots", label: "Car slots you CAN park in", type: "number", hoursPerUnit: 12, placeholder: "0" },
      { id: "blockedSlots", label: "Car slots you CANNOT park in", type: "number", hoursPerUnit: 24, placeholder: "0" },
      { id: "builtIns", label: "Adding built-in cabinets or trak system? (design only)", type: "select", options: [
        { label: "No", hours: 0 },
        { label: "Yes — minimal", hours: 2 },
        { label: "Yes — extensive", hours: 4 },
      ], note: "Design only — does not include cost of system (min $1,500)" },
    ],
    productMultiplier: 0.5,
  },
  {
    id: "storage", label: "Storage Space", icon: "📦", note: "Basement, attic, etc.",
    fields: [
      { id: "size", label: "Approximate size", type: "select", options: [
        { label: "Small — under 100 sq ft", hours: 12 },
        { label: "Medium — 100 to 400 sq ft", hours: 24 },
        { label: "Large — 400+ sq ft", hours: 36 },
      ]},
      { id: "shelving", label: "Need for new shelving or storage units?", type: "select", options: [
        { label: "No", hours: 0 },
        { label: "Yes — a little", hours: 2 },
        { label: "Yes — a lot", hours: 4 },
      ]},
      { id: "boxes", label: "Going through individual items in detail? (keepsakes, paperwork, holiday)", type: "toggle", hours: 12 },
    ],
    productMultiplier: 0.5,
  },
  {
    id: "office", label: "Office / Craft Room", icon: "💼",
    fields: [
      { id: "storage", label: "Amount of storage", type: "select", options: [
        { label: "Just a desk", hours: 6 },
        { label: "Desk with built-ins", hours: 12 },
      ]},
      { id: "extraStorage", label: "Additional closets, furniture, etc.?", type: "toggle", hours: 6 },
      { id: "paperwork", label: "Paperwork to sort / file?", type: "toggle", hours: 6 },
    ],
    productMultiplier: 0.5,
  },
  {
    id: "laundry", label: "Laundry / Mud Room", icon: "🧺",
    fields: [
      { id: "storage", label: "Amount of storage", type: "select", options: [
        { label: "Shelving", hours: 6 },
        { label: "Built-ins", hours: 12 },
        { label: "Cabinets on 3–4 walls", hours: 18 },
      ]},
    ],
    productMultiplier: 0.5,
  },
  {
    id: "bathroom", label: "Bathroom", icon: "🚿",
    fields: [
      { id: "sinks", label: "Number of sinks", type: "select", options: [
        { label: "1 sink", hours: 6 },
        { label: "2 sinks", hours: 12 },
        { label: "2+ with large vanity or extra storage", hours: 18 },
      ]},
      { id: "linen", label: "Linen closet included?", type: "toggle", hours: 6 },
    ],
    productMultiplier: 0.5,
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function calcRoomHours(room, values) {
  let total = 0;
  for (const field of room.fields) {
    const val = values[field.id];
    if (field.type === "select") {
      const opt = field.options?.find((o) => o.label === val);
      if (opt) total += opt.hours;
    } else if (field.type === "toggle" && val === true) {
      total += field.hours || 0;
    } else if (field.type === "number") {
      total += (parseFloat(val) || 0) * (field.hoursPerUnit || 0);
    }
  }
  return total;
}

function fmt(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// ─── BRAND TOKENS ─────────────────────────────────────────────────────────────
const BRAND = {
  red:      [196, 32,  32],
  redLight: [251, 235, 235],
  redMuted: [220, 160, 160],
  cream:    [250, 247, 240],
  charcoal: [44,  44,  42],
  mid:      [120, 108, 98],
  border:   [230, 220, 210],
  white:    [255, 255, 255],
};

// ─── PDF GENERATION ───────────────────────────────────────────────────────────
function generatePDF(clientInfo, masterVars, activeRooms, adjData, totals) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const PW = 612, ML = 48, MR = 48, CW = PW - ML - MR;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const hourlyRate = masterVars.pricePerDay / masterVars.hoursPerDay;
  let y = 0;

  const sf = (a) => doc.setFillColor(...a);
  const sd = (a) => doc.setDrawColor(...a);
  const st = (a) => doc.setTextColor(...a);
  const tx = (s, x, ty, o = {}) => doc.text(s, x, ty, o);
  const chk = (n = 60) => { if (y + n > 750) { doc.addPage(); y = 48; } };

  // Header
  sf(BRAND.cream); doc.rect(0, 0, PW, 88, "F");
  sf(BRAND.red); doc.roundedRect(ML, 20, 48, 48, 6, 6, "F");
  st(BRAND.white); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  tx("MTO", ML + 24, 49, { align: "center" });
  st(BRAND.charcoal); doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  tx("Project Estimate", ML + 62, 41);
  st(BRAND.mid); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  tx("Minimize then Organize", ML + 62, 57);
  st(BRAND.mid); doc.setFontSize(9);
  tx(date, PW - MR, 41, { align: "right" });
  sd(BRAND.border); doc.setLineWidth(0.75); doc.line(0, 88, PW, 88);
  y = 108;

  // Client block
  if (clientInfo.name || clientInfo.address || clientInfo.notes) {
    const bh = clientInfo.notes ? 74 : 54;
    sf(BRAND.redLight); sd(BRAND.border);
    doc.roundedRect(ML, y, CW, bh, 6, 6, "FD");
    st(BRAND.mid); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    tx("PREPARED FOR", ML + 14, y + 15);
    st(BRAND.charcoal); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    tx(clientInfo.name || "—", ML + 14, y + 30);
    if (clientInfo.address) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); st(BRAND.mid);
      tx(clientInfo.address, ML + 14, y + 44);
    }
    if (clientInfo.notes) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); st(BRAND.mid);
      tx(`Note: ${clientInfo.notes}`, ML + 14, y + 60);
    }
    y += bh + 18;
  }

  // Table header
  st(BRAND.mid); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  tx("SPACES & ESTIMATES", ML, y); y += 10;
  sf(BRAND.charcoal); doc.rect(ML, y, CW, 22, "F");
  st(BRAND.white); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  tx("Space", ML + 10, y + 14);
  tx("Hours", ML + CW * 0.50, y + 14, { align: "right" });
  tx("Labor", ML + CW * 0.66, y + 14, { align: "right" });
  tx("Products", ML + CW * 0.82, y + 14, { align: "right" });
  tx("Total", ML + CW, y + 14, { align: "right" });
  y += 22;

  let alt = false;
  for (const room of activeRooms) {
    const d = adjData[room.id] || {};
    const hours = d.hours !== undefined ? d.hours : calcRoomHours(room, d.values || {});
    if (hours === 0 && d.overrideTotal === undefined) continue;
    chk(26);
    const labor = hours * hourlyRate;
    const product = labor * room.productMultiplier;
    const roomTotal = d.overrideTotal !== undefined ? d.overrideTotal : labor + product;
    sf(alt ? BRAND.redLight : BRAND.white); sd(BRAND.border);
    doc.rect(ML, y, CW, 24, "F");
    st(BRAND.charcoal); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    tx(room.label, ML + 10, y + 15);
    doc.setFont("helvetica", "normal"); st(BRAND.mid); doc.setFontSize(8.5);
    tx(`${hours} hrs`, ML + CW * 0.50, y + 15, { align: "right" });
    st(BRAND.charcoal);
    tx(fmt(labor), ML + CW * 0.66, y + 15, { align: "right" });
    tx(fmt(product), ML + CW * 0.82, y + 15, { align: "right" });
    doc.setFont("helvetica", "bold");
    tx(fmt(roomTotal), ML + CW, y + 15, { align: "right" });
    y += 24; alt = !alt;
  }

  // Totals
  chk(90); y += 12;
  sf(BRAND.red); doc.roundedRect(ML, y, CW, 76, 6, 6, "F");
  st(BRAND.redMuted); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  tx("LOW ESTIMATE", ML + 16, y + 18);
  st(BRAND.white); doc.setFont("helvetica", "bold"); doc.setFontSize(26);
  tx(fmt(totals.low), ML + 16, y + 50);
  st(BRAND.redMuted); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  tx("HIGH ESTIMATE", ML + CW * 0.52, y + 18);
  st([255, 210, 200]); doc.setFont("helvetica", "bold"); doc.setFontSize(26);
  tx(fmt(totals.high), ML + CW * 0.52, y + 50);
  st(BRAND.redMuted); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  tx(`+${Math.round(masterVars.highEndBuffer * 100)}% scope buffer`, ML + CW * 0.52, y + 64);
  y += 92;

  st(BRAND.mid); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  tx(`Based on ${masterVars.hoursPerDay} hrs/day at ${fmt(masterVars.pricePerDay)}/day (${fmt(hourlyRate)}/hr)`, ML, y);
  y += 20;

  // Disclaimer
  chk(52);
  sf(BRAND.cream); sd(BRAND.border);
  doc.roundedRect(ML, y, CW, 42, 4, 4, "FD");
  st(BRAND.mid); doc.setFont("helvetica", "italic"); doc.setFontSize(8);
  const disc = doc.splitTextToSize(
    "This estimate does not include the cost of new shelving systems, closet installations, or furniture (minimum $1,500 where noted). Final pricing may vary based on on-site conditions.",
    CW - 24
  );
  doc.text(disc, ML + 12, y + 14);

  // Footer
  sd(BRAND.border); doc.setLineWidth(0.5); doc.line(ML, 770, PW - MR, 770);
  st(BRAND.mid); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  tx("Minimize then Organize", ML, 784);
  tx("minimizethenorganize.com", PW - MR, 784, { align: "right" });

  const safeName = (clientInfo.name || "estimate").replace(/\s+/g, "_");
  doc.save(`MTO_Estimate_${safeName}_${date.replace(/,?\s+/g, "_")}.pdf`);
}

// ─── FIELD COMPONENT ──────────────────────────────────────────────────────────
function RoomField({ field, value, onChange }) {
  if (field.type === "select") {
    return (
      <div className="field">
        <label>{field.label}</label>
        {field.note && <span className="field-note">{field.note}</span>}
        <div className="select-group">
          {field.options.map((opt) => (
            <button key={opt.label}
              className={`select-opt ${value === opt.label ? "active" : ""}`}
              onClick={() => onChange(value === opt.label ? null : opt.label)}>
              {opt.label}
              {opt.hours > 0 && <span className="opt-hrs">+{opt.hours}h</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (field.type === "toggle") {
    return (
      <div className="field field-toggle">
        <div className="toggle-left">
          <label>{field.label}</label>
          {field.note && <span className="field-note">{field.note}</span>}
        </div>
        <div className="toggle-right">
          {field.hours > 0 && <span className="toggle-hrs">+{field.hours}h</span>}
          <button className={`toggle-btn ${value ? "on" : ""}`} onClick={() => onChange(!value)}>
            <span className="toggle-knob" />
          </button>
        </div>
      </div>
    );
  }
  if (field.type === "number") {
    return (
      <div className="field field-number">
        <label>{field.label}</label>
        <div className="number-row">
          <button className="num-btn" onClick={() => onChange(Math.max(0, (parseFloat(value) || 0) - 1))}>−</button>
          <input type="number" min="0" value={value || ""} placeholder="0"
            onChange={(e) => onChange(e.target.value)} />
          <button className="num-btn" onClick={() => onChange((parseFloat(value) || 0) + 1)}>+</button>
          {field.hoursPerUnit > 0 && <span className="opt-hrs">×{field.hoursPerUnit}h each</span>}
        </div>
      </div>
    );
  }
  return null;
}

// ─── ROOM CARD ────────────────────────────────────────────────────────────────
function RoomCard({ room, isActive, values, onToggle, onFieldChange, hourlyRate }) {
  const hours = calcRoomHours(room, values);
  const labor = hours * hourlyRate;
  const product = labor * room.productMultiplier;
  const total = labor + product;
  return (
    <div className={`room-card ${isActive ? "active" : ""}`}>
      <div className="room-header" onClick={onToggle}>
        <div className="room-header-left">
          <span className="room-icon">{room.icon}</span>
          <div>
            <div className="room-name">{room.label}</div>
            {room.note && <div className="room-subnote">{room.note}</div>}
          </div>
        </div>
        <div className="room-header-right">
          {isActive && hours > 0 && <span className="room-est">{fmt(total)}</span>}
          <span className={`room-chevron ${isActive ? "open" : ""}`}>›</span>
        </div>
      </div>
      {isActive && (
        <div className="room-body">
          {room.fields.map((field) => (
            <RoomField key={field.id} field={field} value={values[field.id]}
              onChange={(v) => onFieldChange(field.id, v)} />
          ))}
          {hours > 0 && (
            <div className="room-summary">
              <div className="summary-row"><span>Estimated hours</span><span>{hours} hrs</span></div>
              <div className="summary-row"><span>Labor</span><span>{fmt(labor)}</span></div>
              <div className="summary-row">
                <span>Products & supplies</span>
                <span>{fmt(product)} <em>({room.productMultiplier === 1 ? "100" : "50"}% of labor)</em></span>
              </div>
              <div className="summary-row total"><span>Room total</span><span>{fmt(total)}</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ADJUST ROW ───────────────────────────────────────────────────────────────
function AdjustRow({ room, calcHours, hourlyRate, overrideHours, overrideTotal, onHoursChange, onTotalChange }) {
  const hrs = overrideHours !== undefined ? parseFloat(overrideHours) || 0 : calcHours;
  const labor = hrs * hourlyRate;
  const calcTotal = labor + labor * room.productMultiplier;
  const hoursEdited = overrideHours !== undefined;
  const totalEdited = overrideTotal !== undefined;

  return (
    <div className="adjust-row">
      <div className="adjust-room-name">
        <span className="room-icon-sm">{room.icon}</span>
        {room.label}
      </div>
      <div className="adjust-fields">
        <div className="adjust-field">
          <label>Hours</label>
          <div className={`adj-input-wrap ${hoursEdited ? "edited" : ""}`}>
            <input type="number" min="0"
              value={overrideHours !== undefined ? overrideHours : calcHours}
              onChange={(e) => onHoursChange(e.target.value === String(calcHours) ? undefined : e.target.value)} />
            {hoursEdited && (
              <button className="reset-btn" onClick={() => onHoursChange(undefined)} title="Reset">↺</button>
            )}
          </div>
          {hoursEdited && <div className="calc-was">calculated: {calcHours}h</div>}
        </div>
        <div className="adjust-field">
          <label>Room total ($)</label>
          <div className={`adj-input-wrap ${totalEdited ? "edited" : ""}`}>
            <input type="number" min="0"
              value={overrideTotal !== undefined ? overrideTotal : Math.round(calcTotal)}
              onChange={(e) => {
                const calc = Math.round(calcTotal);
                onTotalChange(parseInt(e.target.value) === calc ? undefined : e.target.value);
              }} />
            {totalEdited && (
              <button className="reset-btn" onClick={() => onTotalChange(undefined)} title="Reset">↺</button>
            )}
          </div>
          {totalEdited && <div className="calc-was">calculated: {fmt(calcTotal)}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState("client");
  const [clientInfo, setClientInfo] = useState({ name: "", address: "", notes: "" });
  const [masterVars, setMasterVars] = useState({ ...DEFAULTS });
  const [activeRooms, setActiveRooms] = useState([]);
  const [roomValues, setRoomValues] = useState({});
  const [adjustments, setAdjustments] = useState({});

  const hourlyRate = masterVars.pricePerDay / masterVars.hoursPerDay;
  const activeRoomObjects = ROOMS.filter((r) => activeRooms.includes(r.id));

  let totalHours = 0, totalLow = 0;
  for (const room of activeRoomObjects) {
    const adj = adjustments[room.id] || {};
    const calcHrs = calcRoomHours(room, roomValues[room.id] || {});
    const hrs = adj.hours !== undefined ? parseFloat(adj.hours) || 0 : calcHrs;
    const labor = hrs * hourlyRate;
    const product = labor * room.productMultiplier;
    const roomTotal = adj.overrideTotal !== undefined
      ? parseFloat(adj.overrideTotal) || 0 : labor + product;
    totalHours += hrs;
    totalLow += roomTotal;
  }
  const totalHigh = totalLow * (1 + masterVars.highEndBuffer);

  function toggleRoom(id) {
    setActiveRooms((p) => p.includes(id) ? p.filter((r) => r !== id) : [...p, id]);
  }
  function setFieldValue(roomId, fieldId, val) {
    setRoomValues((p) => ({ ...p, [roomId]: { ...(p[roomId] || {}), [fieldId]: val } }));
  }
  function setAdj(roomId, key, val) {
    setAdjustments((p) => ({ ...p, [roomId]: { ...(p[roomId] || {}), [key]: val } }));
  }
  function buildAdjForPDF() {
    const out = {};
    for (const room of activeRoomObjects) {
      const adj = adjustments[room.id] || {};
      const calcHrs = calcRoomHours(room, roomValues[room.id] || {});
      out[room.id] = {
        values: roomValues[room.id] || {},
        hours: adj.hours !== undefined ? parseFloat(adj.hours) || 0 : calcHrs,
        overrideTotal: adj.overrideTotal !== undefined ? parseFloat(adj.overrideTotal) || 0 : undefined,
      };
    }
    return out;
  }

  const STEPS = ["client", "rooms", "adjust", "summary"];

  return (
    <div className="app">
      <header>
        <div className="logo-mark">MTO</div>
        <div className="header-text">
          <div className="header-title">Project Estimate</div>
          <div className="header-sub">Minimize then Organize</div>
        </div>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`step-dot ${step === s ? "active" : ""} ${STEPS.indexOf(step) > i ? "done" : ""}`} />
          ))}
        </div>
      </header>

      {/* STEP 1 */}
      {step === "client" && (
        <div className="panel">
          <h2>Client details</h2>
          <p className="panel-sub">Fill in what you know — all fields optional.</p>
          <div className="form-group">
            <label>Client name</label>
            <input type="text" placeholder="First and last name" value={clientInfo.name}
              onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Property address</label>
            <input type="text" placeholder="123 Main St, Lubbock TX" value={clientInfo.address}
              onChange={(e) => setClientInfo({ ...clientInfo, address: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea placeholder="Anything to note before the estimate..." value={clientInfo.notes}
              onChange={(e) => setClientInfo({ ...clientInfo, notes: e.target.value })} rows={3} />
          </div>
          <div className="divider-label">Rate settings</div>
          <div className="rate-row">
            <div className="form-group half">
              <label>Hours per day</label>
              <input type="number" value={masterVars.hoursPerDay}
                onChange={(e) => setMasterVars({ ...masterVars, hoursPerDay: parseFloat(e.target.value) || 18 })} />
            </div>
            <div className="form-group half">
              <label>Price per day ($)</label>
              <input type="number" value={masterVars.pricePerDay}
                onChange={(e) => setMasterVars({ ...masterVars, pricePerDay: parseFloat(e.target.value) || 1500 })} />
            </div>
          </div>
          <div className="rate-note">Effective hourly rate: {fmt(hourlyRate)}/hr</div>
          <button className="btn-primary" onClick={() => setStep("rooms")}>Start estimating →</button>
        </div>
      )}

      {/* STEP 2 */}
      {step === "rooms" && (
        <div className="panel">
          <div className="rooms-header">
            <div>
              <h2>Select spaces</h2>
              <p className="panel-sub">Tap a room to open it and fill in the details.</p>
            </div>
            {totalLow > 0 && (
              <div className="running-total">
                <div className="rt-label">Running total</div>
                <div className="rt-value">{fmt(totalLow)}</div>
                <div className="rt-range">– {fmt(totalHigh)}</div>
              </div>
            )}
          </div>
          <div className="rooms-list">
            {ROOMS.map((room) => (
              <RoomCard key={room.id} room={room} isActive={activeRooms.includes(room.id)}
                values={roomValues[room.id] || {}}
                onToggle={() => toggleRoom(room.id)}
                onFieldChange={(fid, val) => setFieldValue(room.id, fid, val)}
                hourlyRate={hourlyRate} />
            ))}
          </div>
          <div className="step-nav">
            <button className="btn-ghost" onClick={() => setStep("client")}>← Back</button>
            <button className="btn-primary" disabled={activeRoomObjects.length === 0}
              onClick={() => setStep("adjust")}>Review & adjust →</button>
          </div>
        </div>
      )}

      {/* STEP 3 — REVIEW & ADJUST */}
      {step === "adjust" && (
        <div className="panel">
          <h2>Review & adjust</h2>
          <p className="panel-sub">
            Override hours or totals for any special cases. Hit ↺ to reset back to the calculated value.
          </p>
          <div className="adjust-list">
            {activeRoomObjects.map((room) => {
              const calcHrs = calcRoomHours(room, roomValues[room.id] || {});
              if (calcHrs === 0) return null;
              const adj = adjustments[room.id] || {};
              return (
                <AdjustRow key={room.id} room={room} calcHours={calcHrs} hourlyRate={hourlyRate}
                  overrideHours={adj.hours} overrideTotal={adj.overrideTotal}
                  onHoursChange={(v) => setAdj(room.id, "hours", v)}
                  onTotalChange={(v) => setAdj(room.id, "overrideTotal", v)} />
              );
            })}
          </div>
          <div className="grand-total">
            <div className="gt-row"><span>Total hours</span><span>{totalHours} hrs</span></div>
            <div className="gt-row"><span>Low estimate</span><span className="gt-low">{fmt(totalLow)}</span></div>
            <div className="gt-row">
              <span>High estimate <em>(+{Math.round(masterVars.highEndBuffer * 100)}%)</em></span>
              <span className="gt-high">{fmt(totalHigh)}</span>
            </div>
          </div>
          <div className="step-nav">
            <button className="btn-ghost" onClick={() => setStep("rooms")}>← Edit rooms</button>
            <button className="btn-primary" onClick={() => setStep("summary")}>Looks good →</button>
          </div>
        </div>
      )}

      {/* STEP 4 */}
      {step === "summary" && (
        <div className="panel">
          <h2>Estimate ready</h2>
          {clientInfo.name && (
            <p className="panel-sub">For {clientInfo.name}{clientInfo.address ? ` · ${clientInfo.address}` : ""}</p>
          )}
          <div className="summary-table">
            {activeRoomObjects.map((room) => {
              const adj = adjustments[room.id] || {};
              const calcHrs = calcRoomHours(room, roomValues[room.id] || {});
              if (calcHrs === 0) return null;
              const hrs = adj.hours !== undefined ? parseFloat(adj.hours) || 0 : calcHrs;
              const labor = hrs * hourlyRate;
              const product = labor * room.productMultiplier;
              const total = adj.overrideTotal !== undefined
                ? parseFloat(adj.overrideTotal) || 0 : labor + product;
              const wasEdited = adj.hours !== undefined || adj.overrideTotal !== undefined;
              return (
                <div key={room.id} className="summary-room">
                  <div className="sr-name">
                    {room.icon} {room.label}
                    {wasEdited && <span className="edited-badge">adjusted</span>}
                  </div>
                  <div className="sr-details">
                    <span>{hrs} hrs</span>
                    <span className="sr-total">{fmt(total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grand-total">
            <div className="gt-row"><span>Total hours</span><span>{totalHours} hrs</span></div>
            <div className="gt-row"><span>Low estimate</span><span className="gt-low">{fmt(totalLow)}</span></div>
            <div className="gt-row">
              <span>High estimate <em>(+{Math.round(masterVars.highEndBuffer * 100)}%)</em></span>
              <span className="gt-high">{fmt(totalHigh)}</span>
            </div>
          </div>
          <div className="fine-print">
            Estimate does not include cost of new shelving systems, closet installations, or furniture.
          </div>
          <div className="summary-actions">
            <button className="btn-ghost" onClick={() => setStep("adjust")}>← Adjust</button>
            <button className="btn-primary" onClick={() =>
              generatePDF(clientInfo, masterVars, activeRoomObjects, buildAdjForPDF(), { low: totalLow, high: totalHigh })
            }>Download PDF ↓</button>
          </div>
          <button className="btn-reset" onClick={() => {
            setStep("client");
            setClientInfo({ name: "", address: "", notes: "" });
            setActiveRooms([]); setRoomValues({});
            setAdjustments({}); setMasterVars({ ...DEFAULTS });
          }}>Start new estimate</button>
        </div>
      )}
    </div>
  );
}
