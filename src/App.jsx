import { useState, useRef } from "react";
import { jsPDF } from "jspdf";

// ─── MASTER VARIABLES ────────────────────────────────────────────────────────
const DEFAULTS = {
  hoursPerDay: 18,
  pricePerDay: 1500,
  highEndBuffer: 0.2,
};

// ─── ROOM CONFIGS ─────────────────────────────────────────────────────────────
const ROOMS = [
  {
    id: "kitchen",
    label: "Kitchen",
    icon: "🍳",
    fields: [
      {
        id: "handles",
        label: "Number of handles (cabinets + drawers)",
        type: "select",
        options: [
          { label: "Under 30 handles", hours: 12 },
          { label: "31–59 handles", hours: 18 },
          { label: "60+ handles", hours: 24 },
        ],
      },
      {
        id: "fridge",
        label: "Organize refrigerator?",
        type: "toggle",
        note: "Adds 8 handles to count — effectively +6 hrs on average",
        hours: 6,
      },
      {
        id: "moveReno",
        label: "Unpacking from move or renovation?",
        type: "toggle",
        hours: 6,
      },
      {
        id: "overflow",
        label: "Kitchen items in other areas to integrate?",
        type: "toggle",
        hours: 6,
      },
    ],
    productMultiplier: 0.5,
  },
  {
    id: "pantry",
    label: "Pantry",
    icon: "🥫",
    fields: [
      {
        id: "type",
        label: "Pantry type",
        type: "select",
        options: [
          { label: "Reach-in", hours: 6 },
          { label: "L-shaped", hours: 8 },
          { label: "U-shaped", hours: 12 },
        ],
      },
    ],
    productMultiplier: 1.0,
  },
  {
    id: "clothingCloset",
    label: "Clothing Closet",
    icon: "👗",
    fields: [
      {
        id: "size",
        label: "Closet size / type",
        type: "select",
        options: [
          { label: "Reach-in (no folding, no editing)", hours: 6 },
          { label: "Walk-in", hours: 12 },
          { label: "Has island (or big enough for one)", hours: 18 },
        ],
      },
      {
        id: "edit",
        label: "Client wants to reduce / edit items?",
        type: "toggle",
        hours: 6,
      },
      {
        id: "drawers",
        label: "Number of drawers",
        type: "select",
        options: [
          { label: "None", hours: 0 },
          { label: "Fewer than 6", hours: 3 },
          { label: "6 or more", hours: 6 },
        ],
      },
      {
        id: "hangers",
        label: "Switching out hangers to match?",
        type: "toggle",
        hours: 3,
      },
      {
        id: "newSystem",
        label: "New closet system? (design time only)",
        type: "toggle",
        hours: 2,
        note: "Design time only — does not include cost of system (min $1,500)",
      },
    ],
    productMultiplier: 0.5,
  },
  {
    id: "nonClothingCloset",
    label: "Non-Clothing Closet",
    icon: "🗄️",
    fields: [
      {
        id: "type",
        label: "Closet type",
        type: "select",
        options: [
          { label: "Linen / cleaning / medicine — small", hours: 3 },
          { label: "Linen / cleaning / medicine — large", hours: 6 },
          { label: "Craft / hobby / storage — small", hours: 6 },
          { label: "Craft / hobby / storage — large", hours: 12 },
        ],
      },
    ],
    productMultiplier: 0.5,
  },
  {
    id: "playroom",
    label: "Playroom",
    icon: "🧸",
    fields: [
      {
        id: "size",
        label: "Total size of all toy areas combined",
        type: "select",
        options: [
          { label: "Part of a room (living room, bedroom, basement)", hours: 6 },
          { label: "Size of a bedroom", hours: 12 },
          { label: "Great room / very large room (e.g. basement)", hours: 18 },
        ],
      },
    ],
    productMultiplier: 0.5,
  },
  {
    id: "garage",
    label: "Garage",
    icon: "🚗",
    fields: [
      {
        id: "parkableSlots",
        label: "Car slots you CAN park in",
        type: "number",
        hoursPerUnit: 12,
        placeholder: "0",
      },
      {
        id: "blockedSlots",
        label: "Car slots you CANNOT park in",
        type: "number",
        hoursPerUnit: 24,
        placeholder: "0",
      },
      {
        id: "builtIns",
        label: "Adding built-in cabinets or trak system? (design only)",
        type: "select",
        options: [
          { label: "No", hours: 0 },
          { label: "Yes — minimal", hours: 2 },
          { label: "Yes — extensive", hours: 4 },
        ],
        note: "Design time only — does not include cost of system (min $1,500)",
      },
    ],
    productMultiplier: 0.5,
  },
  {
    id: "storage",
    label: "Storage Space",
    icon: "📦",
    note: "Basement, attic, etc.",
    fields: [
      {
        id: "size",
        label: "Approximate size",
        type: "select",
        options: [
          { label: "Small — under 100 sq ft", hours: 12 },
          { label: "Medium — 100 to 400 sq ft", hours: 24 },
          { label: "Large — 400+ sq ft", hours: 36 },
        ],
      },
      {
        id: "shelving",
        label: "Need for new shelving or storage units?",
        type: "select",
        options: [
          { label: "No", hours: 0 },
          { label: "Yes — a little", hours: 2 },
          { label: "Yes — a lot", hours: 4 },
        ],
      },
      {
        id: "boxes",
        label: "Going through individual items in detail? (keepsakes, paperwork, holiday)",
        type: "toggle",
        hours: 12,
      },
    ],
    productMultiplier: 0.5,
  },
  {
    id: "office",
    label: "Office / Craft Room",
    icon: "💼",
    fields: [
      {
        id: "storage",
        label: "Amount of storage",
        type: "select",
        options: [
          { label: "Just a desk", hours: 6 },
          { label: "Desk with built-ins", hours: 12 },
        ],
      },
      {
        id: "extraStorage",
        label: "Additional closets, furniture, etc.?",
        type: "toggle",
        hours: 6,
      },
      {
        id: "paperwork",
        label: "Paperwork to sort / file?",
        type: "toggle",
        hours: 6,
      },
    ],
    productMultiplier: 0.5,
  },
  {
    id: "laundry",
    label: "Laundry / Mud Room",
    icon: "🧺",
    fields: [
      {
        id: "storage",
        label: "Amount of storage",
        type: "select",
        options: [
          { label: "Shelving", hours: 6 },
          { label: "Built-ins", hours: 12 },
          { label: "Cabinets on 3–4 walls", hours: 18 },
        ],
      },
    ],
    productMultiplier: 0.5,
  },
  {
    id: "bathroom",
    label: "Bathroom",
    icon: "🚿",
    fields: [
      {
        id: "sinks",
        label: "Number of sinks",
        type: "select",
        options: [
          { label: "1 sink", hours: 6 },
          { label: "2 sinks", hours: 12 },
          { label: "2+ with large vanity or additional storage", hours: 18 },
        ],
      },
      {
        id: "linen",
        label: "Linen closet included?",
        type: "toggle",
        hours: 6,
        note: "Confirm hours with Cabri",
      },
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
      const n = parseFloat(val) || 0;
      total += n * (field.hoursPerUnit || 0);
    }
  }
  return total;
}

function fmt(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// ─── PDF GENERATION ───────────────────────────────────────────────────────────
// ─── BRAND TOKENS (update these when Cabri finalizes branding) ───────────────
const BRAND = {
  sage:       [74,  92,  71],   // #4A5C47 — primary dark green
  sageMid:    [122, 140, 118],  // #7A8C76 — mid green
  sageLight:  [235, 240, 234],  // #EBF0EA — light green tint
  cream:      [250, 248, 243],  // #FAF8F3 — background
  charcoal:   [44,  44,  42],   // #2C2C2A — body text
  mid:        [107, 107, 104],  // #6B6B68 — secondary text
  accent:     [196, 120, 90],   // #C4785A — warm accent
  white:      [255, 255, 255],
  border:     [226, 221, 214],  // #E2DDD6
};

function generatePDF(clientInfo, masterVars, activeRooms, roomValues, totals) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const PW = 612; // page width
  const ML = 48;  // margin left
  const MR = 48;  // margin right
  const CW = PW - ML - MR; // content width
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const hourlyRate = masterVars.pricePerDay / masterVars.hoursPerDay;

  let y = 0;

  // ── helpers ──────────────────────────────────────────────────────────────
  function rgb(arr) { return { r: arr[0], g: arr[1], b: arr[2] }; }
  function setFill(arr) { doc.setFillColor(...arr); }
  function setDraw(arr) { doc.setDrawColor(...arr); }
  function setTextColor(arr) { doc.setTextColor(...arr); }
  function text(str, x, ty, opts = {}) { doc.text(str, x, ty, opts); }

  function addPage() {
    doc.addPage();
    y = 48;
  }

  function checkPageBreak(needed = 60) {
    if (y + needed > 750) addPage();
  }

  // ── HEADER BAND ──────────────────────────────────────────────────────────
  setFill(BRAND.sage);
  doc.rect(0, 0, PW, 88, "F");

  // Logo wordmark area
  setFill(BRAND.sageMid);
  doc.roundedRect(ML, 20, 48, 48, 4, 4, "F");
  setTextColor(BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  text("MTO", ML + 24, 49, { align: "center" });

  // Title
  setTextColor(BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  text("Project Estimate", ML + 60, 42);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255, 0.7);
  setTextColor([200, 220, 198]);
  text("Minimize then Organize", ML + 60, 58);

  // Date — right aligned
  setTextColor([200, 220, 198]);
  doc.setFontSize(9);
  text(date, PW - MR, 42, { align: "right" });

  y = 108;

  // ── CLIENT INFO BLOCK ─────────────────────────────────────────────────────
  if (clientInfo.name || clientInfo.address || clientInfo.notes) {
    setFill(BRAND.sageLight);
    setDraw(BRAND.border);
    doc.roundedRect(ML, y, CW, clientInfo.notes ? 72 : 52, 6, 6, "FD");

    setTextColor(BRAND.mid);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    text("PREPARED FOR", ML + 14, y + 14);

    setTextColor(BRAND.charcoal);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    text(clientInfo.name || "—", ML + 14, y + 28);

    if (clientInfo.address) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      setTextColor(BRAND.mid);
      text(clientInfo.address, ML + 14, y + 42);
    }

    if (clientInfo.notes) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      setTextColor(BRAND.mid);
      text(`Note: ${clientInfo.notes}`, ML + 14, y + 58);
    }

    y += clientInfo.notes ? 86 : 66;
  }

  // ── SECTION: SPACES ───────────────────────────────────────────────────────
  y += 8;
  setTextColor(BRAND.mid);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  text("SPACES & ESTIMATES", ML, y);
  y += 10;

  // Column headers
  setFill(BRAND.charcoal);
  doc.rect(ML, y, CW, 22, "F");
  setTextColor(BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  text("Space", ML + 10, y + 14);
  text("Hours", ML + CW * 0.52, y + 14, { align: "right" });
  text("Labor", ML + CW * 0.68, y + 14, { align: "right" });
  text("Products", ML + CW * 0.82, y + 14, { align: "right" });
  text("Total", ML + CW, y + 14, { align: "right" });
  y += 22;

  // Room rows
  let rowAlt = false;
  for (const room of activeRooms) {
    const values = roomValues[room.id] || {};
    const hours = calcRoomHours(room, values);
    if (hours === 0) continue;

    checkPageBreak(26);

    const labor = hours * hourlyRate;
    const product = labor * room.productMultiplier;
    const roomTotal = labor + product;

    setFill(rowAlt ? BRAND.sageLight : BRAND.white);
    setDraw(BRAND.border);
    doc.rect(ML, y, CW, 24, "F");

    setTextColor(BRAND.charcoal);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    text(room.label, ML + 10, y + 15);

    doc.setFont("helvetica", "normal");
    setTextColor(BRAND.mid);
    doc.setFontSize(8.5);
    text(`${hours} hrs`, ML + CW * 0.52, y + 15, { align: "right" });

    setTextColor(BRAND.charcoal);
    text(fmt(labor), ML + CW * 0.68, y + 15, { align: "right" });
    text(fmt(product), ML + CW * 0.82, y + 15, { align: "right" });

    doc.setFont("helvetica", "bold");
    text(fmt(roomTotal), ML + CW, y + 15, { align: "right" });

    y += 24;
    rowAlt = !rowAlt;
  }

  // ── TOTAL BAND ────────────────────────────────────────────────────────────
  checkPageBreak(90);
  y += 10;

  setFill(BRAND.sage);
  doc.roundedRect(ML, y, CW, 76, 6, 6, "F");

  // Low estimate
  setTextColor([200, 220, 198]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  text("LOW ESTIMATE", ML + 16, y + 18);
  setTextColor(BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  text(fmt(totals.low), ML + 16, y + 48);

  // High estimate
  setTextColor([200, 220, 198]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  text("HIGH ESTIMATE", ML + CW * 0.52, y + 18);
  setTextColor([168, 212, 160]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  text(fmt(totals.high), ML + CW * 0.52, y + 48);

  // Buffer note
  setTextColor([200, 220, 198]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  text(`+${Math.round(masterVars.highEndBuffer * 100)}% scope buffer`, ML + CW * 0.52, y + 62);

  y += 90;

  // ── RATE SUMMARY LINE ────────────────────────────────────────────────────
  setTextColor(BRAND.mid);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  text(
    `Based on ${masterVars.hoursPerDay} hrs/day at ${fmt(masterVars.pricePerDay)}/day (${fmt(hourlyRate)}/hr)`,
    ML, y
  );
  y += 20;

  // ── DISCLAIMER ───────────────────────────────────────────────────────────
  checkPageBreak(52);
  setFill(BRAND.cream);
  setDraw(BRAND.border);
  doc.roundedRect(ML, y, CW, 42, 4, 4, "FD");
  setTextColor(BRAND.mid);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  const disclaimer = doc.splitTextToSize(
    "This estimate does not include the cost of new shelving systems, closet installations, or furniture (minimum $1,500 where noted). Final pricing may vary based on on-site conditions.",
    CW - 24
  );
  doc.text(disclaimer, ML + 12, y + 14);
  y += 56;

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const footerY = 770;
  setDraw(BRAND.border);
  doc.setLineWidth(0.5);
  doc.line(ML, footerY, PW - MR, footerY);
  setTextColor(BRAND.mid);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  text("Minimize then Organize", ML, footerY + 14);
  text("minimizethenorganize.com", PW - MR, footerY + 14, { align: "right" });

  // ── SAVE ─────────────────────────────────────────────────────────────────
  const safeName = (clientInfo.name || "estimate").replace(/\s+/g, "_");
  const safeDate = date.replace(/,?\s+/g, "_");
  doc.save(`MTO_Estimate_${safeName}_${safeDate}.pdf`);
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function RoomField({ field, value, onChange }) {
  if (field.type === "select") {
    return (
      <div className="field">
        <label>{field.label}</label>
        {field.note && <span className="field-note">{field.note}</span>}
        <div className="select-group">
          {field.options.map((opt) => (
            <button
              key={opt.label}
              className={`select-opt ${value === opt.label ? "active" : ""}`}
              onClick={() => onChange(value === opt.label ? null : opt.label)}
            >
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
          <button
            className={`toggle-btn ${value ? "on" : ""}`}
            onClick={() => onChange(!value)}
          >
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
        {field.note && <span className="field-note">{field.note}</span>}
        <div className="number-row">
          <button className="num-btn" onClick={() => onChange(Math.max(0, (parseFloat(value) || 0) - 1))}>−</button>
          <input
            type="number"
            min="0"
            value={value || ""}
            placeholder={field.placeholder || "0"}
            onChange={(e) => onChange(e.target.value)}
          />
          <button className="num-btn" onClick={() => onChange((parseFloat(value) || 0) + 1)}>+</button>
          {field.hoursPerUnit > 0 && (
            <span className="opt-hrs">×{field.hoursPerUnit}h each</span>
          )}
        </div>
      </div>
    );
  }
  return null;
}

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
          {isActive && hours > 0 && (
            <span className="room-est">{fmt(total)}</span>
          )}
          <span className={`room-chevron ${isActive ? "open" : ""}`}>›</span>
        </div>
      </div>
      {isActive && (
        <div className="room-body">
          {room.fields.map((field) => (
            <RoomField
              key={field.id}
              field={field}
              value={values[field.id]}
              onChange={(v) => onFieldChange(field.id, v)}
            />
          ))}
          {hours > 0 && (
            <div className="room-summary">
              <div className="summary-row">
                <span>Estimated hours</span><span>{hours} hrs</span>
              </div>
              <div className="summary-row">
                <span>Labor</span><span>{fmt(labor)}</span>
              </div>
              <div className="summary-row">
                <span>Products & supplies</span>
                <span>{fmt(product)} <em>({room.productMultiplier === 1 ? "100" : "50"}% of labor)</em></span>
              </div>
              <div className="summary-row total">
                <span>Room total</span><span>{fmt(total)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState("client"); // client | rooms | summary
  const [clientInfo, setClientInfo] = useState({ name: "", address: "", notes: "" });
  const [masterVars, setMasterVars] = useState({ ...DEFAULTS });
  const [activeRooms, setActiveRooms] = useState([]);
  const [roomValues, setRoomValues] = useState({});

  const hourlyRate = masterVars.pricePerDay / masterVars.hoursPerDay;

  // totals
  let totalHours = 0;
  let totalLow = 0;
  for (const room of ROOMS) {
    if (!activeRooms.includes(room.id)) continue;
    const values = roomValues[room.id] || {};
    const hrs = calcRoomHours(room, values);
    totalHours += hrs;
    const labor = hrs * hourlyRate;
    totalLow += labor + labor * room.productMultiplier;
  }
  const totalHigh = totalLow * (1 + masterVars.highEndBuffer);

  function toggleRoom(id) {
    setActiveRooms((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  function setFieldValue(roomId, fieldId, val) {
    setRoomValues((prev) => ({
      ...prev,
      [roomId]: { ...(prev[roomId] || {}), [fieldId]: val },
    }));
  }

  const activeRoomObjects = ROOMS.filter((r) => activeRooms.includes(r.id));

  return (
    <div className="app">
      {/* Header */}
      <header>
        <div className="logo-mark">MTO</div>
        <div className="header-text">
          <div className="header-title">Project Estimate</div>
          <div className="header-sub">Minimize then Organize</div>
        </div>
        <div className="steps">
          {["client","rooms","summary"].map((s, i) => (
            <div key={s} className={`step-dot ${step === s ? "active" : ""} ${
              (step === "rooms" && i === 0) || (step === "summary") ? "done" : ""
            }`} />
          ))}
        </div>
      </header>

      {/* ── STEP 1: Client Info ── */}
      {step === "client" && (
        <div className="panel">
          <h2>Client details</h2>
          <p className="panel-sub">Fill in what you know — everything is optional except getting started.</p>

          <div className="form-group">
            <label>Client name</label>
            <input
              type="text"
              placeholder="First and last name"
              value={clientInfo.name}
              onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Property address</label>
            <input
              type="text"
              placeholder="123 Main St, Lubbock TX"
              value={clientInfo.address}
              onChange={(e) => setClientInfo({ ...clientInfo, address: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea
              placeholder="Anything to note before the estimate..."
              value={clientInfo.notes}
              onChange={(e) => setClientInfo({ ...clientInfo, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="divider-label">Rate settings</div>
          <div className="rate-row">
            <div className="form-group half">
              <label>Hours per day</label>
              <input
                type="number"
                value={masterVars.hoursPerDay}
                onChange={(e) => setMasterVars({ ...masterVars, hoursPerDay: parseFloat(e.target.value) || 18 })}
              />
            </div>
            <div className="form-group half">
              <label>Price per day ($)</label>
              <input
                type="number"
                value={masterVars.pricePerDay}
                onChange={(e) => setMasterVars({ ...masterVars, pricePerDay: parseFloat(e.target.value) || 1500 })}
              />
            </div>
          </div>
          <div className="rate-note">Hourly rate: {fmt(hourlyRate)}/hr</div>

          <button className="btn-primary" onClick={() => setStep("rooms")}>
            Start estimating →
          </button>
        </div>
      )}

      {/* ── STEP 2: Rooms ── */}
      {step === "rooms" && (
        <div className="panel">
          <div className="rooms-header">
            <div>
              <h2>Select spaces</h2>
              <p className="panel-sub">Tap a room to open it, then fill in the details.</p>
            </div>
            {totalLow > 0 && (
              <div className="running-total">
                <div className="rt-label">Running total</div>
                <div className="rt-value">{fmt(totalLow)}</div>
                <div className="rt-range">–{fmt(totalHigh)}</div>
              </div>
            )}
          </div>

          <div className="rooms-list">
            {ROOMS.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                isActive={activeRooms.includes(room.id)}
                values={roomValues[room.id] || {}}
                onToggle={() => toggleRoom(room.id)}
                onFieldChange={(fid, val) => setFieldValue(room.id, fid, val)}
                hourlyRate={hourlyRate}
              />
            ))}
          </div>

          <div className="step-nav">
            <button className="btn-ghost" onClick={() => setStep("client")}>← Back</button>
            <button
              className="btn-primary"
              disabled={activeRoomObjects.length === 0}
              onClick={() => setStep("summary")}
            >
              Review estimate →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Summary ── */}
      {step === "summary" && (
        <div className="panel">
          <h2>Estimate summary</h2>
          {clientInfo.name && <p className="panel-sub">For {clientInfo.name}{clientInfo.address ? ` · ${clientInfo.address}` : ""}</p>}

          <div className="summary-table">
            {activeRoomObjects.map((room) => {
              const values = roomValues[room.id] || {};
              const hrs = calcRoomHours(room, values);
              if (hrs === 0) return null;
              const labor = hrs * hourlyRate;
              const product = labor * room.productMultiplier;
              const total = labor + product;
              return (
                <div key={room.id} className="summary-room">
                  <div className="sr-name">{room.icon} {room.label}</div>
                  <div className="sr-details">
                    <span>{hrs} hrs</span>
                    <span className="sr-total">{fmt(total)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grand-total">
            <div className="gt-row">
              <span>Total hours</span>
              <span>{totalHours} hrs</span>
            </div>
            <div className="gt-row">
              <span>Low estimate</span>
              <span className="gt-low">{fmt(totalLow)}</span>
            </div>
            <div className="gt-row">
              <span>High estimate <em>(+{Math.round(masterVars.highEndBuffer * 100)}%)</em></span>
              <span className="gt-high">{fmt(totalHigh)}</span>
            </div>
          </div>

          <div className="fine-print">
            Estimate does not include cost of new shelving systems, closet installations, or furniture.
          </div>

          <div className="summary-actions">
            <button className="btn-ghost" onClick={() => setStep("rooms")}>← Edit rooms</button>
            <button
              className="btn-primary"
              onClick={() =>
                generatePDF(clientInfo, masterVars, activeRoomObjects, roomValues, {
                  low: totalLow,
                  high: totalHigh,
                })
              }
            >
              Download estimate ↓
            </button>
          </div>
          <button className="btn-reset" onClick={() => {
            setStep("client");
            setClientInfo({ name: "", address: "", notes: "" });
            setActiveRooms([]);
            setRoomValues({});
            setMasterVars({ ...DEFAULTS });
          }}>
            Start new estimate
          </button>
        </div>
      )}
    </div>
  );
}
