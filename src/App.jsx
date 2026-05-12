import { useState } from "react";
import { jsPDF } from "jspdf";

// ─── MASTER DEFAULTS ──────────────────────────────────────────────────────────
// Internal rate engine — not exposed to client
const INTERNAL_RATE = {
  hoursPerDay: 18,
  pricePerDay: 2000,   // updated day rate
  highEndBuffer: 0.2,
};

// ─── TIER CONFIG ──────────────────────────────────────────────────────────────
const TIERS = {
  signature: {
    id: "signature",
    label: "Signature",
    sublabel: "Full Home",
    scope: "Whole-home system",
    badge: "#A32D2D",
    badgeBg: "#FCEBEB",
    minRooms: 5,        // 5+ rooms → Signature
    sqftRateLow: 4.50,
    sqftRateHigh: 6.50,
    projectLow: 9000,
    projectHigh: 26000,
  },
  select: {
    id: "select",
    label: "Select",
    sublabel: "Partial Home",
    scope: "3–6 targeted spaces",
    badge: "#5F5E5A",
    badgeBg: "#F1EFE8",
    minRooms: 3,        // 3–4 rooms → Select
    sqftRateLow: 3.25,
    sqftRateHigh: 4.00,
    projectLow: 4500,
    projectHigh: 10000,
  },
  refresh: {
    id: "refresh",
    label: "Refresh",
    sublabel: "Single Zone",
    scope: "1–2 spaces",
    badge: "#3B6D11",
    badgeBg: "#EAF3DE",
    minRooms: 1,        // 1–2 rooms → Refresh
    sqftRateLow: 2.70,
    sqftRateHigh: 3.25,
    projectLow: 1500,
    projectHigh: 4500,
  },
};

function detectTier(roomCount) {
  if (roomCount >= TIERS.signature.minRooms) return TIERS.signature;
  if (roomCount >= TIERS.select.minRooms) return TIERS.select;
  return TIERS.refresh;
}

// Apply tier pricing floor: if hours-engine total is below tier floor, bump to floor
function applyTierFloor(calculatedLow, tier) {
  return Math.max(calculatedLow, tier.projectLow);
}

const DEFAULTS = { ...INTERNAL_RATE };

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
function generatePDF(clientInfo, masterVars, activeRooms, adjData, totals, tier) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const PW = 612, ML = 48, MR = 48, CW = PW - ML - MR;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  let y = 0;

  const sf = (a) => doc.setFillColor(...a);
  const sd = (a) => doc.setDrawColor(...a);
  const st = (a) => doc.setTextColor(...a);
  const tx = (s, x, ty, o = {}) => doc.text(s, x, ty, o);
  const chk = (n = 60) => { if (y + n > 750) { doc.addPage(); y = 48; } };

  // Parse tier badge color for PDF
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return [r,g,b];
  }
  function hexToRgbLight(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    // blend toward white
    return [Math.round(r*0.15+240), Math.round(g*0.15+240), Math.round(b*0.15+240)];
  }
  const tierColor = hexToRgb(tier.badge);
  const tierColorLight = hexToRgbLight(tier.badge);

  // Header
  sf(BRAND.cream); doc.rect(0, 0, PW, 88, "F");
  sf(BRAND.red); doc.roundedRect(ML, 20, 48, 48, 6, 6, "F");
  st(BRAND.white); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  tx("MTO", ML + 24, 49, { align: "center" });
  st(BRAND.charcoal); doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  tx("Project Proposal", ML + 62, 41);
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

  // Tier badge block
  chk(64);
  sf(tierColorLight); sd(tierColor);
  doc.setLineWidth(1.5);
  doc.roundedRect(ML, y, CW, 56, 6, 6, "FD");
  // Badge pill
  sf(tierColor);
  doc.roundedRect(ML + 14, y + 14, 64, 16, 8, 8, "F");
  st(BRAND.white); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  tx(tier.label.toUpperCase(), ML + 46, y + 25, { align: "center" });
  // Tier name + scope
  st(BRAND.charcoal); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  tx(`${tier.label} — ${tier.sublabel}`, ML + 90, y + 26);
  st(BRAND.mid); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  tx(tier.scope, ML + 90, y + 41);
  y += 72;

  // Brand statement
  chk(36);
  st(BRAND.mid); doc.setFont("helvetica", "italic"); doc.setFontSize(10);
  tx("We build the system your home runs on.", ML, y); y += 22;
  sd(BRAND.border); doc.setLineWidth(0.5); doc.line(ML, y, ML + CW, y); y += 16;

  // Spaces included
  st(BRAND.mid); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  tx("SPACES INCLUDED", ML, y); y += 12;

  let alt = false;
  for (const room of activeRooms) {
    const d = adjData[room.id] || {};
    const hours = d.hours !== undefined ? d.hours : calcRoomHours(room, d.values || {});
    if (hours === 0 && d.overrideTotal === undefined) continue;
    chk(24);
    sf(alt ? BRAND.redLight : BRAND.white); sd(BRAND.border);
    doc.rect(ML, y, CW, 22, "F");
    st(BRAND.charcoal); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    tx(room.label, ML + 10, y + 14);
    // Complexity indicator (hours bucket)
    const complexity = hours <= 9 ? "Standard" : hours <= 18 ? "Elevated" : "Complex";
    st(BRAND.mid); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    tx(complexity, ML + CW - 10, y + 14, { align: "right" });
    y += 22; alt = !alt;
  }
  y += 12;

  // Investment range (the headline — no raw hours shown)
  chk(90);
  sf(BRAND.red); doc.roundedRect(ML, y, CW, 80, 6, 6, "F");
  st(BRAND.redMuted); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  tx("PROJECT INVESTMENT", ML + 16, y + 18);
  st(BRAND.white); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  tx("Starting from", ML + 16, y + 38);
  st(BRAND.white); doc.setFont("helvetica", "bold"); doc.setFontSize(28);
  tx(fmt(totals.low), ML + 16, y + 64);
  st(BRAND.redMuted); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  tx("ESTIMATED RANGE", ML + CW * 0.52, y + 18);
  st([255, 210, 200]); doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  tx(`${fmt(totals.low)} – ${fmt(totals.high)}`, ML + CW * 0.52, y + 48);
  st(BRAND.redMuted); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  tx("Final scope confirmed at walkthrough", ML + CW * 0.52, y + 64);
  y += 96;

  // What's included note
  chk(72);
  sf(BRAND.cream); sd(BRAND.border); doc.setLineWidth(0.5);
  doc.roundedRect(ML, y, CW, 60, 4, 4, "FD");
  st(BRAND.charcoal); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  tx("What's included", ML + 12, y + 16);
  st(BRAND.mid); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  const included = doc.splitTextToSize(
    "Full project planning and walkthrough · All organizing labor · Sourcing recommendations · Installation of organizing systems · Final product placement and styling",
    CW - 24
  );
  doc.text(included, ML + 12, y + 30);
  y += 76;

  // Disclaimer
  chk(44);
  st(BRAND.mid); doc.setFont("helvetica", "italic"); doc.setFontSize(7.5);
  const disc = doc.splitTextToSize(
    "Investment does not include cost of new shelving systems, closet installations, or furniture (minimum $1,500 where applicable). Final investment confirmed after walkthrough and scope review.",
    CW
  );
  doc.text(disc, ML, y);

  // Footer
  sd(BRAND.border); doc.setLineWidth(0.5); doc.line(ML, 770, PW - MR, 770);
  st(BRAND.mid); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  tx("Minimize then Organize", ML, 784);
  tx("minimizethenorganize.com", PW - MR, 784, { align: "right" });

  const safeName = (clientInfo.name || "estimate").replace(/\s+/g, "_");
  doc.save(`MTO_Proposal_${safeName}_${date.replace(/,?\s+/g, "_")}.pdf`);
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
  const [tierOverride, setTierOverride] = useState(null); // Cabri can manually override detected tier

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

  // Tier detection + floor pricing
  const detectedTier = detectTier(activeRoomObjects.length);
  const activeTier = tierOverride ? TIERS[tierOverride] : detectedTier;
  const tierFlooredLow = applyTierFloor(totalLow, activeTier);
  const tierFlooredHigh = Math.max(totalHigh, activeTier.projectLow * (1 + masterVars.highEndBuffer));
  // Final display totals use the floored values
  const displayLow = tierFlooredLow;
  const displayHigh = Math.max(tierFlooredHigh, tierFlooredLow * (1 + masterVars.highEndBuffer));

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
                <div className="rt-value">{fmt(displayLow)}</div>
                <div className="rt-range">– {fmt(displayHigh)}</div>
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

          {/* Tier indicator + override */}
          <div style={{ background: activeTier.badgeBg, border: `1.5px solid ${activeTier.badge}`, borderRadius: 10, padding: "12px 14px", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.7px", color: activeTier.badge, marginBottom: 3 }}>
                  {detectedTier.id === activeTier.id ? "Auto-detected tier" : "Tier override active"}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#2a2a28" }}>
                  {activeTier.label} — {activeTier.sublabel}
                </div>
                <div style={{ fontSize: 12, color: "#888780", marginTop: 2 }}>
                  Floor: {fmt(activeTier.projectLow)} · Range: {fmt(activeTier.projectLow)}–{fmt(activeTier.projectHigh)}
                </div>
              </div>
              <select
                style={{ fontSize: 12, padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", color: "#2a2a28", cursor: "pointer" }}
                value={tierOverride || detectedTier.id}
                onChange={(e) => setTierOverride(e.target.value === detectedTier.id && !tierOverride ? null : e.target.value)}
              >
                {Object.values(TIERS).map(t => (
                  <option key={t.id} value={t.id}>{t.label} — {t.sublabel}</option>
                ))}
              </select>
            </div>
          </div>

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
            <div className="gt-row"><span>Total hours (internal)</span><span>{totalHours} hrs</span></div>
            <div className="gt-row"><span>Project low</span><span className="gt-low">{fmt(displayLow)}</span></div>
            <div className="gt-row">
              <span>Project high <em>(+{Math.round(masterVars.highEndBuffer * 100)}%)</em></span>
              <span className="gt-high">{fmt(displayHigh)}</span>
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

          {/* Tier badge */}
          <div style={{ background: activeTier.badgeBg, border: `1.5px solid ${activeTier.badge}`, borderRadius: 10, padding: "12px 16px", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ background: activeTier.badge, color: "#fff", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
              {activeTier.label}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#2a2a28" }}>{activeTier.sublabel} — {activeTier.scope}</div>
              <div style={{ fontSize: 11, color: "#888780", marginTop: 1 }}>Project investment range: {fmt(displayLow)} – {fmt(displayHigh)}</div>
            </div>
          </div>

          <div className="summary-table">
            {activeRoomObjects.map((room) => {
              const adj = adjustments[room.id] || {};
              const calcHrs = calcRoomHours(room, roomValues[room.id] || {});
              if (calcHrs === 0) return null;
              const wasEdited = adj.hours !== undefined || adj.overrideTotal !== undefined;
              return (
                <div key={room.id} className="summary-room">
                  <div className="sr-name">
                    {room.icon} {room.label}
                    {wasEdited && <span className="edited-badge">adjusted</span>}
                  </div>
                  <div className="sr-details">
                    <span style={{ fontSize: 11, color: "#888780" }}>included</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grand-total">
            <div className="gt-row"><span>Project investment</span><span className="gt-low">{fmt(displayLow)}</span></div>
            <div className="gt-row">
              <span>Estimated range</span>
              <span className="gt-high">{fmt(displayLow)} – {fmt(displayHigh)}</span>
            </div>
          </div>
          <div className="fine-print">
            Final investment confirmed after walkthrough. Does not include cost of new shelving systems, closet installations, or furniture.
          </div>
          <div className="summary-actions">
            <button className="btn-ghost" onClick={() => setStep("adjust")}>← Adjust</button>
            <button className="btn-primary" onClick={() =>
              generatePDF(clientInfo, masterVars, activeRoomObjects, buildAdjForPDF(), { low: displayLow, high: displayHigh }, activeTier)
            }>Download proposal ↓</button>
          </div>
          <button className="btn-reset" onClick={() => {
            setStep("client");
            setClientInfo({ name: "", address: "", notes: "" });
            setActiveRooms([]); setRoomValues({});
            setAdjustments({}); setMasterVars({ ...DEFAULTS });
            setTierOverride(null);
          }}>Start new estimate</button>
        </div>
      )}
    </div>
  );
}
