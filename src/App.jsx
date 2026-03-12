import { useState, useEffect, useRef } from "react";

async function callClaude(messages, systemPrompt = "") {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: systemPrompt,
      messages,
      max_tokens: 1000,
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || "No response";
}

// ── Verified research data ────────────────────────────────────────────────────
// BMI: CDC NHANES 2015-16 (measured). Body Fat: Li et al. 2006 Am J Clin Nutr, NHANES DXA.
// Muscle %: Janssen et al. 2000 J Appl Physiol MRI study n=468.
// ACE body fat categories: American Council on Exercise.
const POPULATION_NORMS = {
  bmi: [
    { age: [18, 29], p10: 19.9, p25: 22.1, p50: 25.8, p75: 30.3, p90: 35.1 },
    { age: [30, 39], p10: 21.2, p25: 23.8, p50: 27.6, p75: 32.4, p90: 37.2 },
    { age: [40, 49], p10: 21.9, p25: 24.5, p50: 28.4, p75: 33.6, p90: 38.5 },
    { age: [50, 65], p10: 22.3, p25: 25.0, p50: 28.8, p75: 34.0, p90: 39.0 },
  ],
  bodyFat: {
    male: [
      { age: [18, 29], p10: 11, p25: 16, p50: 23, p75: 29, p90: 34 },
      { age: [30, 39], p10: 14, p25: 19, p50: 25, p75: 31, p90: 36 },
      { age: [40, 49], p10: 16, p25: 21, p50: 27, p75: 33, p90: 37 },
      { age: [50, 65], p10: 17, p25: 23, p50: 29, p75: 35, p90: 39 },
    ],
    female: [
      { age: [18, 29], p10: 21, p25: 27, p50: 34, p75: 40, p90: 45 },
      { age: [30, 39], p10: 23, p25: 29, p50: 37, p75: 43, p90: 47 },
      { age: [40, 49], p10: 25, p25: 32, p50: 39, p75: 45, p90: 49 },
      { age: [50, 65], p10: 26, p25: 34, p50: 41, p75: 47, p90: 51 },
    ],
  },
  muscle: {
    male: [
      { age: [18, 29], p10: 33, p25: 37, p50: 40, p75: 44, p90: 48 },
      { age: [30, 39], p10: 31, p25: 35, p50: 39, p75: 43, p90: 47 },
      { age: [40, 49], p10: 29, p25: 33, p50: 37, p75: 42, p90: 46 },
      { age: [50, 65], p10: 27, p25: 31, p50: 35, p75: 40, p90: 44 },
    ],
    female: [
      { age: [18, 29], p10: 26, p25: 29, p50: 32, p75: 36, p90: 39 },
      { age: [30, 39], p10: 24, p25: 27, p50: 31, p75: 35, p90: 38 },
      { age: [40, 49], p10: 22, p25: 26, p50: 29, p75: 33, p90: 37 },
      { age: [50, 65], p10: 20, p25: 24, p50: 27, p75: 31, p90: 35 },
    ],
  },
};

const ACE_CATEGORIES = {
  male:   [{ label: "Essential Fat", max: 5, color: "#FF6B6B" }, { label: "Athletic", max: 13, color: "#7EBDE8" }, { label: "Fitness", max: 17, color: "#7EE8A2" }, { label: "Average", max: 24, color: "#F5C842" }, { label: "Obese", max: Infinity, color: "#FF6B6B" }],
  female: [{ label: "Essential Fat", max: 13, color: "#FF6B6B" }, { label: "Athletic", max: 20, color: "#7EBDE8" }, { label: "Fitness", max: 24, color: "#7EE8A2" }, { label: "Average", max: 31, color: "#F5C842" }, { label: "Obese", max: Infinity, color: "#FF6B6B" }],
};

function getBand(arr, age) { return arr.find(b => age >= b.age[0] && age <= b.age[1]) || arr[arr.length - 1]; }
function getPopScore(value, band, lowerIsBetter) {
  const { p10, p25, p50, p75, p90 } = band;
  const raw = value <= p10 ? 10 : value <= p25 ? 25 : value <= p50 ? 50 : value <= p75 ? 75 : value <= p90 ? 90 : 95;
  return lowerIsBetter ? 100 - raw : raw;
}
function getAceCat(bf, gender) {
  return (ACE_CATEGORIES[gender] || ACE_CATEGORIES.male).find(c => bf <= c.max) || ACE_CATEGORIES.male[ACE_CATEGORIES.male.length - 1];
}

// ── Persistent storage via localStorage ──────────────────────────────────────
async function storageGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    console.warn("[storage] Failed to read", key, e);
    return fallback;
  }
}
async function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("[storage] Failed to write", key, e);
  }
}


// ── Input sanitization & validation ──────────────────────────────────────────
const MAX_NAME_LEN    = 50;
const MAX_NOTE_LEN    = 300;
const MAX_PROFILES    = 10;
const MAX_LOGS        = 1000;
const MAX_MEALS       = 500;
const MAX_CHAT_HIST   = 20;   // pairs sent to API

function sanitizeText(str, maxLen) {
  if (typeof str !== "string") return "";
  return str.replace(/[<>]/g, "").trim().slice(0, maxLen);
}

function sanitizeNum(val, min, max) {
  const n = parseFloat(val);
  if (isNaN(n) || n < min || n > max) return null;
  return parseFloat(n.toFixed(2));
}

function validateAge(val) {
  const n = parseInt(val);
  return (!isNaN(n) && n >= 10 && n <= 120) ? n : null;
}

function Sparkline({ data, color = "#7EE8A2", width = 120, height = 40 }) {
  const clean = (data || []).filter(v => v != null);
  if (clean.length < 2) return null;
  const min = Math.min(...clean), max = Math.max(...clean), range = max - min || 1;
  const pts = clean.map((v, i) => `${(i / (clean.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  const last = pts.split(" ").pop().split(",");
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  );
}

function Ring({ pct, color, size = 80, label, value }) {
  const r = (size - 10) / 2, circ = 2 * Math.PI * r, dash = (Math.min(pct || 0, 100) / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }} />
        <text x={size/2} y={size/2+5} textAnchor="middle" fill={color} fontSize="12" fontWeight="700" fontFamily="'DM Mono',monospace">{value}</text>
      </svg>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>{label}</span>
    </div>
  );
}

function PopBar({ label, score, sublabel }) {
  const color = score >= 75 ? "#7EE8A2" : score >= 50 ? "#F5C842" : "#FF6B6B";
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
        <div>
          <span style={{ color: "rgba(255,255,255,0.7)" }}>{label}</span>
          {sublabel && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginLeft: 6 }}>{sublabel}</span>}
        </div>
        <span style={{ color, fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>Better than {score}%</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, background: `linear-gradient(90deg,${color}66,${color})`, borderRadius: 3, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

// ── Delta badge ───────────────────────────────────────────────────────────────
function Delta({ current, target, unit = "", lowerIsBetter = true }) {
  if (current == null || !target) return null;
  const diff = parseFloat((current - parseFloat(target)).toFixed(1));
  if (diff === 0) return <span style={{ color: "#7EE8A2", fontSize: 11, fontWeight: 700 }}>✓ At goal</span>;
  const onTrack = lowerIsBetter ? diff < 0 : diff > 0;
  const arrow = diff > 0 ? "↑" : "↓";
  const color = onTrack ? "#7EE8A2" : "#FF6B6B";
  const label = lowerIsBetter ? (diff > 0 ? `${Math.abs(diff)}${unit} above goal` : `${Math.abs(diff)}${unit} below goal`) : (diff > 0 ? `${Math.abs(diff)}${unit} above goal` : `${Math.abs(diff)}${unit} below goal`);
  return <span style={{ color, fontSize: 11, fontWeight: 600 }}>{arrow} {label}</span>;
}

// ── Inline editable field ─────────────────────────────────────────────────────
function EditField({ label, value, onChange, type = "number", hint, unit, inputStyle = {} }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{label}</span>
        {unit && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{unit}</span>}
      </div>
      {hint && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginBottom: 6, lineHeight: 1.5 }}>{hint}</div>}
      <input
        type={type}
        step={type === "number" ? "0.1" : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(126,232,162,0.25)", borderRadius: 10, padding: "10px 14px", color: "#E8EAF0", fontSize: 14, outline: "none", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box", ...inputStyle }}
      />
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function HealthTracker() {
  const [users, setUsers]         = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [tab, setTab]             = useState("dashboard");
  const [showNewUser, setShowNewUser] = useState(false);
  const [mealChat, setMealChat]   = useState([]);
  const [mealInput, setMealInput] = useState("");
  const [mealLoading, setMealLoading] = useState(false);
  const [logForm, setLogForm]     = useState({ weight: "", bodyFat: "", muscle: "", notes: "" });
  const [aiAdvice, setAiAdvice]   = useState("");
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [newUser, setNewUser]     = useState({ name: "", age: "", gender: "male", height: "", targetWeight: "", targetBodyFat: "", targetMuscle: "", activityLevel: "moderate" });
  const [acctForm, setAcctForm]   = useState(null);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [acctSaved, setAcctSaved] = useState(false);  // brief "saved" flash
  const chatEndRef = useRef();

  // Load persisted data on first mount
  useEffect(() => {
    (async () => {
      const savedUsers = await storageGet("ht_users", []);
      const savedActive = await storageGet("ht_activeUser", null);
      if (savedUsers.length) setUsers(savedUsers);
      if (savedActive) setActiveUser(savedActive);
      setStorageLoaded(true);
    })();
  }, []);

  // Persist whenever users or activeUser changes (skip until initial load done)
  useEffect(() => { if (storageLoaded) storageSet("ht_users", users); }, [users, storageLoaded]);
  useEffect(() => { if (storageLoaded) storageSet("ht_activeUser", activeUser); }, [activeUser, storageLoaded]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mealChat]);

  // Initialise account form whenever user navigates to account tab
  useEffect(() => {
    if (tab === "account" && user) {
      setAcctForm({
        name:          user.name        || "",
        age:           user.age         || "",
        height:        user.height      || "",
        gender:        user.gender      || "male",
        activityLevel: user.activityLevel || "moderate",
        // current weight convenience field — saved as a new log entry on submit if changed
        currentWeight: latest?.weight   != null ? String(latest.weight) : "",
        targetWeight:  user.targetWeight  || "",
        targetBodyFat: user.targetBodyFat || "",
        targetMuscle:  user.targetMuscle  || "",
      });
      setAcctSaved(false);
    }
  }, [tab]);   // eslint-disable-line react-hooks/exhaustive-deps

  const user   = users.find(u => u.id === activeUser);
  const logs   = user?.logs || [];
  const latest = logs[logs.length - 1];
  const bmi    = latest && user ? parseFloat((latest.weight / ((user.height / 100) ** 2)).toFixed(1)) : null;

  const scores = (user && latest && bmi) ? (() => {
    const age = parseInt(user.age), sex = user.gender;
    return {
      bmi:     { score: getPopScore(bmi, getBand(POPULATION_NORMS.bmi, age), true), band: getBand(POPULATION_NORMS.bmi, age) },
      bodyFat: latest.bodyFat != null ? { score: getPopScore(latest.bodyFat, getBand(POPULATION_NORMS.bodyFat[sex], age), true), band: getBand(POPULATION_NORMS.bodyFat[sex], age) } : null,
      muscle:  latest.muscle  != null ? { score: getPopScore(latest.muscle,  getBand(POPULATION_NORMS.muscle[sex],  age), false), band: getBand(POPULATION_NORMS.muscle[sex], age)  } : null,
    };
  })() : null;

  function createUser() {
    if (users.length >= MAX_PROFILES) { alert(`Maximum ${MAX_PROFILES} profiles allowed.`); return; }
    const name   = sanitizeText(newUser.name, MAX_NAME_LEN);
    const age    = validateAge(newUser.age);
    const height = sanitizeNum(newUser.height, 50, 300);
    const gender = ["male","female"].includes(newUser.gender) ? newUser.gender : "male";
    const actLvl = ["sedentary","light","moderate","active","very_active"].includes(newUser.activityLevel) ? newUser.activityLevel : "moderate";
    if (!name || !age || !height) return;
    const u = {
      name, age: String(age), height: String(height), gender, activityLevel: actLvl,
      targetWeight:  sanitizeNum(newUser.targetWeight, 20, 500) || "",
      targetBodyFat: sanitizeNum(newUser.targetBodyFat, 1, 70) || "",
      targetMuscle:  sanitizeNum(newUser.targetMuscle, 1, 80) || "",
      id: Date.now().toString(), logs: [], meals: [],
    };
    setUsers(p => [...p, u]);
    setActiveUser(u.id);
    setShowNewUser(false);
    setNewUser({ name: "", age: "", gender: "male", height: "", targetWeight: "", targetBodyFat: "", targetMuscle: "", activityLevel: "moderate" });
  }

  function logEntry() {
    const weight = sanitizeNum(logForm.weight, 20, 500);
    if (!weight) return;
    const bodyFat = sanitizeNum(logForm.bodyFat, 1, 70);
    const muscle  = sanitizeNum(logForm.muscle, 1, 80);
    const notes   = sanitizeText(logForm.notes, MAX_NOTE_LEN);
    const entry   = { date: new Date().toISOString().split("T")[0], weight, bodyFat, muscle, notes };
    setUsers(p => p.map(u => {
      if (u.id !== activeUser) return u;
      if ((u.logs || []).length >= MAX_LOGS) { alert("Log limit reached (1000 entries). Consider exporting your data."); return u; }
      return { ...u, logs: [...(u.logs || []), entry] };
    }));
    setLogForm({ weight: "", bodyFat: "", muscle: "", notes: "" });
    setTab("dashboard");
  }

  // Save account form — preserves all existing log data, only updates profile fields + targets.
  // If user typed a new currentWeight that differs from latest log, append a new log entry.
  function saveAccount() {
    if (!acctForm) return;
    const name    = sanitizeText(acctForm.name, MAX_NAME_LEN);
    const age     = validateAge(acctForm.age);
    const height  = sanitizeNum(acctForm.height, 50, 300);
    const gender  = ["male","female"].includes(acctForm.gender) ? acctForm.gender : "male";
    const actLvl  = ["sedentary","light","moderate","active","very_active"].includes(acctForm.activityLevel) ? acctForm.activityLevel : "moderate";
    if (!name || !age || !height) return;
    setUsers(p => p.map(u => {
      if (u.id !== activeUser) return u;
      const updatedProfile = {
        ...u,
        name,
        age:           String(age),
        height:        String(height),
        gender,
        activityLevel: actLvl,
        targetWeight:  sanitizeNum(acctForm.targetWeight, 20, 500) || "",
        targetBodyFat: sanitizeNum(acctForm.targetBodyFat, 1, 70) || "",
        targetMuscle:  sanitizeNum(acctForm.targetMuscle, 1, 80) || "",
      };
      const newWt = sanitizeNum(acctForm.currentWeight, 20, 500);
      if (newWt && newWt !== latest?.weight) {
        if ((u.logs || []).length >= MAX_LOGS) return updatedProfile; // skip if capped
        const entry = { date: new Date().toISOString().split("T")[0], weight: newWt, bodyFat: latest?.bodyFat ?? null, muscle: latest?.muscle ?? null, notes: "Updated via Account" };
        updatedProfile.logs = [...(u.logs || []), entry];
      }
      return updatedProfile;
    }));
    setAcctSaved(true);
    setTimeout(() => setAcctSaved(false), 2500);
  }

  async function sendMeal() {
    if (!mealInput.trim()) return;
    const msg = mealInput;
    setMealChat(p => [...p, { from: "user", text: msg }]);
    setMealInput("");
    setMealLoading(true);
    try {
      // Cap history sent to API — only last MAX_CHAT_HIST messages to bound token spend and data exposure
      const history = mealChat.slice(-MAX_CHAT_HIST).map(m => ({ role: m.from === "user" ? "user" : "assistant", content: m.text }));
      const wt = latest?.weight || 70;
      const tdee = { sedentary: 1700, light: 2000, moderate: 2300, active: 2600, very_active: 2900 }[user?.activityLevel] || 2200;
      const sys = `You are a registered dietitian. Estimate nutrients using USDA FoodData Central data. Provide: Calories, Protein (g), Carbs (g), Fat (g), Fiber (g) as a compact table. Then give 2-3 specific food suggestions based on gaps vs daily targets: ~${tdee} kcal, ~${Math.round(wt * 1.6)}g protein, 25-38g fiber. User: ${user?.gender}, age ${user?.age}, ${user?.activityLevel} activity. Be concise.`;
      const reply = await callClaude([...history, { role: "user", content: msg }], sys);
      setMealChat(p => [...p, { from: "ai", text: reply }]);
      const safeMealDesc = sanitizeText(msg, 1000);
      setUsers(p => p.map(u => {
        if (u.id !== activeUser) return u;
        const meals = u.meals || [];
        if (meals.length >= MAX_MEALS) return u; // silently cap
        return { ...u, meals: [...meals, { date: new Date().toISOString().split("T")[0], description: safeMealDesc, analysis: reply }] };
      }));
    } catch { setMealChat(p => [...p, { from: "ai", text: "Error. Please try again." }]); }
    setMealLoading(false);
  }

  async function getAdvice() {
    if (!user || !latest) return;
    setAdviceLoading(true);
    try {
      const aceCat = latest.bodyFat != null ? getAceCat(latest.bodyFat, user.gender).label : "unknown";
      const sys = "You are a certified personal trainer with ACSM credentials. Give evidence-based, actionable advice. Reference specific clinical thresholds. Max 4 sentences.";
      const p = `User: ${user.name}, age ${user.age}, ${user.height}cm, ${user.gender}, ${user.activityLevel} activity. Weight: ${latest.weight}kg, BMI: ${bmi}, Body Fat: ${latest.bodyFat}% (ACE: ${aceCat}), Skeletal Muscle: ${latest.muscle}%. Targets: weight ${user.targetWeight||"not set"}kg, BF ${user.targetBodyFat||"not set"}%, muscle ${user.targetMuscle||"not set"}%.`;
      setAiAdvice(await callClaude([{ role: "user", content: p }], sys));
    } catch { setAiAdvice("Could not load advice."); }
    setAdviceLoading(false);
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const S = {
    app:       { minHeight: "100vh", background: "#090C10", color: "#E8EAF0", fontFamily: "'DM Sans',sans-serif", display: "flex", flexDirection: "column" },
    header:    { background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
    logo:      { fontFamily: "'DM Mono',monospace", fontSize: 14, letterSpacing: 3, color: "#7EE8A2", fontWeight: 700 },
    nav:       { display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto", flexShrink: 0 },
    navBtn:    (a) => ({ padding: "12px 16px", background: "none", border: "none", color: a ? "#7EE8A2" : "rgba(255,255,255,0.4)", borderBottom: a ? "2px solid #7EE8A2" : "2px solid transparent", cursor: "pointer", fontSize: 11, letterSpacing: 1, fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap", display: "flex", gap: 5, alignItems: "center" }),
    content:   { flex: 1, overflowY: "auto", padding: "20px 16px", maxWidth: 540, margin: "0 auto", width: "100%" },
    card:      { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px" },
    cardTitle: { fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.35)", marginBottom: 16, textTransform: "uppercase" },
    bigNum:    { fontFamily: "'DM Mono',monospace", fontSize: 40, fontWeight: 700, color: "#7EE8A2", lineHeight: 1 },
    label:     { fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 },
    input:     { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: "#E8EAF0", fontSize: 14, outline: "none", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box" },
    select:    { width: "100%", background: "#131820", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: "#E8EAF0", fontSize: 14, outline: "none", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box" },
    btn:       { background: "#7EE8A2", color: "#090C10", border: "none", borderRadius: 10, padding: "11px 24px", fontWeight: 700, cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans',sans-serif", width: "100%" },
    btnSec:    { background: "rgba(255,255,255,0.06)", color: "#E8EAF0", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans',sans-serif" },
    grid2:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    grid3:     { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
    tag:       (c) => ({ background: `${c}18`, border: `1px solid ${c}40`, borderRadius: 6, padding: "2px 8px", fontSize: 11, color: c, display: "inline-block" }),
    row:       { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" },
    rowLabel:  { fontSize: 13, color: "rgba(255,255,255,0.55)" },
    rowValue:  { fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" },
  };

  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: "◈" },
    { id: "log",       label: "Log",       icon: "+" },
    { id: "compare",   label: "Compare",   icon: "⊹" },
    { id: "meals",     label: "Meals AI",  icon: "◉" },
    { id: "watch",     label: "Watch",     icon: "⌚" },
    { id: "account",   label: "Account",   icon: "◐" },
  ];

  // ── Loading gate — wait for storage to hydrate before rendering ─────────────
  if (!storageLoaded) return (
    <div style={{ minHeight: "100vh", background: "#090C10", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#7EE8A2", animation: `pulse 1s ${i*0.2}s infinite` }} />)}
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>LOADING</div>
      <style>{CSS}</style>
    </div>
  );

  // ── Landing page ──────────────────────────────────────────────────────────
  if (!user && !showNewUser) return (
    <div style={S.app}>
      <div style={S.header}><span style={S.logo}>SOMA HEALTH</span></div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
        <div style={{ fontSize: 48 }}>◈</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, color: "#7EE8A2", letterSpacing: 2 }}>SOMA HEALTH</div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", maxWidth: 300, lineHeight: 1.7 }}>Evidence-based body composition tracking with AI insights. Benchmarks from CDC NHANES & ACE.</div>
        {users.length > 0 && (
          <div style={{ width: "100%", maxWidth: 340 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>EXISTING PROFILES</div>
            {users.map(u => (
              <div key={u.id} onClick={() => setActiveUser(u.id)} style={{ ...S.card, marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Age {u.age} · {u.height}cm · {u.logs.length} entries</div>
                </div>
                <span style={{ color: "#7EE8A2" }}>→</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => setShowNewUser(true)} style={{ ...S.btn, maxWidth: 340 }}>Create New Profile</button>
      </div>
      <style>{CSS}</style>
    </div>
  );

  // ── New user form ─────────────────────────────────────────────────────────
  if (showNewUser) return (
    <div style={S.app}>
      <div style={S.header}><span style={S.logo}>NEW PROFILE</span><button onClick={() => setShowNewUser(false)} style={S.btnSec}>Cancel</button></div>
      <div style={{ ...S.content }}>
        <div style={S.card}>
          {[["Name","name","text","Your name"],["Age","age","number","Years"],["Height (cm)","height","number","e.g. 170"],["Target Weight (kg)","targetWeight","number","Optional"],["Target Body Fat %","targetBodyFat","number","Optional"],["Target Muscle %","targetMuscle","number","Optional"]].map(([label,field,type,ph]) => (
            <div key={field} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{label}</div>
              <input type={type} placeholder={ph} value={newUser[field]} onChange={e => setNewUser(p => ({ ...p, [field]: e.target.value }))} style={S.input} />
            </div>
          ))}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Biological Sex</div>
            <select value={newUser.gender} onChange={e => setNewUser(p => ({ ...p, gender: e.target.value }))} style={S.select}><option value="male">Male</option><option value="female">Female</option></select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Activity Level</div>
            <select value={newUser.activityLevel} onChange={e => setNewUser(p => ({ ...p, activityLevel: e.target.value }))} style={S.select}>
              <option value="sedentary">Sedentary (desk job, no exercise)</option>
              <option value="light">Light (1-3 days/week)</option>
              <option value="moderate">Moderate (3-5 days/week)</option>
              <option value="active">Active (6-7 days/week)</option>
              <option value="very_active">Very Active (athlete / physical job)</option>
            </select>
          </div>
          <button onClick={createUser} style={S.btn}>Create Profile →</button>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );

  // ── Main shell ────────────────────────────────────────────────────────────
  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.logo}>SOMA HEALTH</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ background: "rgba(126,232,162,0.1)", border: "1px solid rgba(126,232,162,0.2)", borderRadius: 20, padding: "4px 12px", fontSize: 12, cursor: "pointer", color: "#7EE8A2", display: "flex", alignItems: "center", gap: 6 }} onClick={() => setActiveUser(null)}>
            ◎ {user?.name}
          </div>
          <button onClick={() => setShowNewUser(true)} style={{ ...S.btnSec, padding: "4px 10px", fontSize: 11 }}>+ User</button>
        </div>
      </div>

      {/* Nav */}
      <nav style={S.nav}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={S.navBtn(tab === t.id)}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>

      <div style={S.content}>

        {/* ══════════════ DASHBOARD ══════════════ */}
        {tab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Hero */}
            <div style={S.card}>
              <div style={S.cardTitle}>Current Status</div>
              {latest ? (
                <>
                  <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div>
                      <div style={S.bigNum}>{latest.weight}<span style={{ fontSize: 18 }}>kg</span></div>
                      <div style={S.label}>{latest.date}</div>
                    </div>
                    {bmi && (
                      <div>
                        <div style={{ ...S.bigNum, fontSize: 34, color: bmi < 18.5 ? "#F5C842" : bmi < 25 ? "#7EE8A2" : bmi < 30 ? "#F5C842" : "#FF6B6B" }}>{bmi}</div>
                        <div style={S.label}>BMI · {bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese"}</div>
                      </div>
                    )}
                  </div>
                  <div style={S.grid3}>
                    <Ring pct={latest.bodyFat != null ? Math.min(100, (latest.bodyFat / 40) * 100) : 0} color="#7EBDE8" size={72} label="Body Fat" value={latest.bodyFat != null ? `${latest.bodyFat}%` : "—"} />
                    <Ring pct={latest.muscle != null ? Math.min(100, (latest.muscle / 50) * 100) : 0} color="#7EE8A2" size={72} label="Muscle" value={latest.muscle != null ? `${latest.muscle}%` : "—"} />
                    <Ring pct={user.targetWeight ? Math.min(100, 100 - Math.abs(latest.weight - parseFloat(user.targetWeight)) / Math.max(latest.weight, parseFloat(user.targetWeight)) * 100) : 0} color="#F5C842" size={72} label="To Goal" value={user.targetWeight ? `${Math.abs(latest.weight - parseFloat(user.targetWeight)).toFixed(1)}kg` : "—"} />
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>No entries yet</div>
                  <button onClick={() => setTab("log")} style={{ ...S.btn, width: "auto", padding: "10px 24px" }}>Log First Entry</button>
                </div>
              )}
            </div>

            {/* ACE category */}
            {latest?.bodyFat != null && (
              <div style={{ ...S.card, padding: "14px 20px" }}>
                <div style={{ fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>ACE BODY FAT CATEGORY</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(ACE_CATEGORIES[user.gender] || ACE_CATEGORIES.male).map(cat => {
                    const active = cat.label === getAceCat(latest.bodyFat, user.gender).label;
                    return <span key={cat.label} style={{ background: active ? `${cat.color}22` : "rgba(255,255,255,0.04)", border: `1px solid ${active ? cat.color : "rgba(255,255,255,0.08)"}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, color: active ? cat.color : "rgba(255,255,255,0.3)", fontWeight: active ? 700 : 400 }}>{cat.label}</span>;
                  })}
                </div>
              </div>
            )}

            {/* Target progress */}
            {latest && (user.targetWeight || user.targetBodyFat || user.targetMuscle) && (
              <div style={S.card}>
                <div style={S.cardTitle}>Progress Toward Targets</div>
                {[
                  user.targetWeight  && ["Weight",    latest.weight,   user.targetWeight,  "kg",  true,  "#7EE8A2"],
                  user.targetBodyFat && ["Body Fat",  latest.bodyFat,  user.targetBodyFat, "%",   true,  "#7EBDE8"],
                  user.targetMuscle  && ["Muscle %",  latest.muscle,   user.targetMuscle,  "%",   false, "#F5C842"],
                ].filter(Boolean).map(([label, current, target, unit, lowerBetter, color]) => current != null && (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Delta current={current} target={target} unit={unit} lowerIsBetter={lowerBetter} />
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{current}{unit} → <span style={{ color }}>{target}{unit}</span></span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, 100 - Math.abs(current - parseFloat(target)) / Math.max(current, parseFloat(target)) * 100)}%`, background: `linear-gradient(90deg,${color}66,${color})`, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sparklines */}
            {logs.length >= 2 && (
              <div style={S.card}>
                <div style={S.cardTitle}>30-Day Trend</div>
                <div style={S.grid2}>
                  {[["Weight (kg)", logs.slice(-30).map(l => l.weight), "#7EE8A2"], ["Body Fat %", logs.slice(-30).map(l => l.bodyFat), "#7EBDE8"]].map(([label, data, color]) => (
                    <div key={label}><div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>{label}</div><Sparkline data={data} color={color} width={130} height={45} /></div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Coach */}
            {latest && (
              <div style={S.card}>
                <div style={S.cardTitle}>AI Coach</div>
                {aiAdvice ? (
                  <>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.75 }}>{aiAdvice}</div>
                    <button onClick={() => { setAiAdvice(""); getAdvice(); }} style={{ ...S.btnSec, marginTop: 12, width: "100%", fontSize: 12 }}>Refresh</button>
                  </>
                ) : (
                  <button onClick={getAdvice} disabled={adviceLoading} style={{ ...S.btn, background: "rgba(126,232,162,0.1)", color: "#7EE8A2", border: "1px solid rgba(126,232,162,0.25)" }}>
                    {adviceLoading ? "Analyzing…" : "✦ Get Personalized Advice"}
                  </button>
                )}
              </div>
            )}

            {/* Recent log */}
            {logs.length > 0 && (
              <div style={S.card}>
                <div style={S.cardTitle}>Recent Entries</div>
                {logs.slice(-5).reverse().map((log, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{log.date}</span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span style={S.tag("#7EE8A2")}>{log.weight}kg</span>
                      {log.bodyFat != null && <span style={S.tag("#7EBDE8")}>{log.bodyFat}% BF</span>}
                      {log.muscle  != null && <span style={S.tag("#F5C842")}>{log.muscle}% muscle</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ LOG ══════════════ */}
        {tab === "log" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={S.card}>
              <div style={S.cardTitle}>Log Body Data</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 16 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
              {[["Weight (kg) *","weight","Required",20,500],["Body Fat % (optional)","bodyFat","From bioimpedance or DEXA scan",1,70],["Skeletal Muscle % (optional)","muscle","From smart scale or DEXA scan",1,80]].map(([label,field,ph,mn,mx]) => (
                <div key={field} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{label}</div>
                  <input type="number" step="0.1" min={mn} max={mx} placeholder={ph} value={logForm[field]} onChange={e => setLogForm(p => ({ ...p, [field]: e.target.value }))} style={S.input} />
                </div>
              ))}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Notes</div>
                <input placeholder="How are you feeling?" value={logForm.notes} onChange={e => setLogForm(p => ({ ...p, notes: e.target.value }))} style={S.input} />
              </div>
              <button onClick={logEntry} style={S.btn}>Save Entry</button>
            </div>
            {logForm.weight && user?.height && (() => {
              const b = parseFloat((parseFloat(logForm.weight) / ((user.height / 100) ** 2)).toFixed(1));
              const [cat, col] = b < 18.5 ? ["Underweight","#F5C842"] : b < 25 ? ["Normal Weight","#7EE8A2"] : b < 30 ? ["Overweight","#F5C842"] : ["Obese","#FF6B6B"];
              return (
                <div style={{ ...S.card, textAlign: "center" }}>
                  <div style={S.cardTitle}>BMI Preview</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 36, color: col }}>{b}</div>
                  <div style={{ color: col, fontSize: 13, marginTop: 4 }}>{cat}</div>
                  <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 4 }}>WHO BMI Classification</div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ══════════════ COMPARE ══════════════ */}
        {tab === "compare" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={S.card}>
              <div style={S.cardTitle}>Population Comparison</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 4, lineHeight: 1.6 }}>
                Your metrics vs US adults of the same age & sex. "Better than X%" = healthier than X% of the US population.
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginBottom: 16 }}>
                Sources: CDC NHANES 2015-16 (BMI) · Li et al. 2006 NHANES DXA (body fat) · Janssen et al. 2000 MRI study (muscle)
              </div>
              {latest && scores ? (
                <>
                  <PopBar label="BMI" score={scores.bmi.score} sublabel="lower is healthier" />
                  {scores.bodyFat && <PopBar label="Body Fat %" score={scores.bodyFat.score} sublabel="lower is healthier" />}
                  {scores.muscle  && <PopBar label="Skeletal Muscle %" score={scores.muscle.score} sublabel="higher is healthier" />}
                  <div style={{ marginTop: 20, background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>POPULATION REFERENCE — YOUR AGE GROUP</div>
                    {[
                      ["BMI", bmi, scores.bmi.band, "", "WHO normal: 18.5-24.9. US median 28.2 (overweight)."],
                      scores.bodyFat && ["Body Fat %", latest.bodyFat, scores.bodyFat.band, "%", `US population skews high. ACE healthy: ${user.gender === "male" ? "men <25%" : "women <32%"}.`],
                      scores.muscle  && ["Skeletal Muscle %", latest.muscle,  scores.muscle.band,  "%", "Avg: men ~38-40%, women ~31-32% (Janssen et al. 2000)."],
                    ].filter(Boolean).map(([label, value, band, unit, note]) => value != null && (
                      <div key={label} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                          <span style={{ color: "rgba(255,255,255,0.6)" }}>{label}</span>
                          <span style={{ fontFamily: "'DM Mono',monospace", color: "#7EE8A2" }}>You: {value}{unit}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4, flexWrap: "wrap" }}>
                          <span>P10: {band.p10}{unit}</span>·<span>P25: {band.p25}{unit}</span>·<span>Median: {band.p50}{unit}</span>·<span>P75: {band.p75}{unit}</span>
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>{note}</div>
                      </div>
                    ))}
                  </div>
                  {latest.bodyFat != null && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>ACE CLINICAL CATEGORIES — {user.gender === "male" ? "MEN" : "WOMEN"}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(ACE_CATEGORIES[user.gender] || ACE_CATEGORIES.male).map(cat => {
                          const active = cat.label === getAceCat(latest.bodyFat, user.gender).label;
                          return <div key={cat.label} style={{ background: active ? `${cat.color}20` : "rgba(255,255,255,0.03)", border: `1px solid ${active ? cat.color : "rgba(255,255,255,0.07)"}`, borderRadius: 8, padding: "6px 10px" }}><div style={{ fontSize: 10, color: active ? cat.color : "rgba(255,255,255,0.25)", fontWeight: active ? 700 : 400 }}>{cat.label}</div></div>;
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "30px 0", color: "rgba(255,255,255,0.3)" }}>Log at least one entry to see your comparison</div>
              )}
            </div>
            {users.length > 1 && (
              <div style={S.card}>
                <div style={S.cardTitle}>All Profiles</div>
                {users.map(u => { const l = u.logs[u.logs.length-1]; const b = l ? (l.weight/((u.height/100)**2)).toFixed(1) : null; return (
                  <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div><div style={{ fontWeight: 600, marginBottom: 2 }}>{u.name} {u.id === activeUser && <span style={S.tag("#7EE8A2")}>active</span>}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Age {u.age} · {u.gender} · {u.height}cm</div></div>
                    <div style={{ textAlign: "right" }}>{l && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14 }}>{l.weight}kg</div>}{b && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>BMI {b}</div>}</div>
                  </div>
                ); })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ MEALS AI ══════════════ */}
        {tab === "meals" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "calc(100vh - 180px)" }}>
            <div style={{ ...S.card, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={S.cardTitle}>Meal & Nutrition AI</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>Describe your meals. AI estimates nutrients via USDA data and advises based on your targets.</div>
              <div style={{ flex: 1, overflowY: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {mealChat.length === 0 && <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, textAlign: "center", marginTop: 30, padding: "0 20px" }}>Try: "Breakfast was Greek yogurt with granola. Lunch was chicken rice bowl. Dinner was salmon with vegetables."</div>}
                {mealChat.map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.from === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "90%", padding: "10px 14px", borderRadius: msg.from === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px", background: msg.from === "user" ? "rgba(126,232,162,0.1)" : "rgba(255,255,255,0.04)", border: msg.from === "user" ? "1px solid rgba(126,232,162,0.2)" : "1px solid rgba(255,255,255,0.07)", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg.text}</div>
                  </div>
                ))}
                {mealLoading && <div style={{ display: "flex", gap: 4, padding: 12 }}>{[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#7EE8A2", animation: `pulse 1s ${i*0.2}s infinite` }} />)}</div>}
                <div ref={chatEndRef} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={mealInput} onChange={e => setMealInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMeal()} placeholder="Describe your meals today…" style={{ ...S.input, flex: 1 }} />
                <button onClick={sendMeal} disabled={mealLoading} style={{ ...S.btn, width: "auto", padding: "10px 16px" }}>→</button>
              </div>
            </div>
            {user?.meals?.length > 0 && (
              <div style={S.card}>
                <div style={S.cardTitle}>Past Entries</div>
                {user.meals.slice(-3).reverse().map((m, i) => (
                  <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{m.date}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{m.description.slice(0,90)}{m.description.length>90?"…":""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ APPLE WATCH ══════════════ */}
        {tab === "watch" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...S.card, textAlign: "center", padding: "44px 24px" }}>
              <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 30 }}>⌚</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, color: "rgba(255,255,255,0.6)", marginBottom: 8, letterSpacing: 1 }}>No Device Connected</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1.7, maxWidth: 280, margin: "0 auto 28px" }}>Connect your Apple Watch or import from the Health app to sync steps, heart rate, HRV, sleep, VO₂ Max, and active calories.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 280, margin: "0 auto" }}>
                <button style={{ ...S.btn, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.09)", cursor: "not-allowed" }}>⌚ Connect Apple Watch</button>
                <button style={{ ...S.btn, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.06)", cursor: "not-allowed", fontSize: 13 }}>📱 Import from Health App (.xml)</button>
              </div>
            </div>
            <div style={S.card}>
              <div style={S.cardTitle}>Metrics Available Once Connected</div>
              <div style={S.grid2}>
                {[["Steps","Daily vs 8k-10k target","👟"],["Heart Rate","Resting & zone tracking","❤️"],["HRV","Autonomic nervous system","〜"],["Sleep","Duration & quality stages","🌙"],["VO₂ Max","Cardiorespiratory fitness","💨"],["Active Cal","Move ring & burn","🔥"]].map(([title,desc,icon]) => (
                  <div key={title} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "14px 12px", opacity: 0.45 }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ ACCOUNT ══════════════ */}
        {tab === "account" && acctForm && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Profile header */}
            <div style={{ ...S.card, display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(126,232,162,0.12)", border: "1px solid rgba(126,232,162,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, fontWeight: 700, color: "#7EE8A2" }}>
                {acctForm.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{acctForm.name || "—"}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {logs.length} log {logs.length === 1 ? "entry" : "entries"} · joined {user.id ? new Date(parseInt(user.id)).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
                </div>
              </div>
              {acctSaved && (
                <div style={{ background: "rgba(126,232,162,0.15)", border: "1px solid rgba(126,232,162,0.3)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#7EE8A2", display: "flex", alignItems: "center", gap: 4 }}>
                  ✓ Saved
                </div>
              )}
            </div>

            {/* ── Current Body Metrics ── */}
            <div style={S.card}>
              <div style={S.cardTitle}>Current Body Metrics</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 14, lineHeight: 1.5 }}>
                Updating current weight adds a new log entry today. Your existing history is never modified.
              </div>

              <EditField
                label="Current Weight (kg)"
                value={acctForm.currentWeight}
                onChange={v => setAcctForm(p => ({ ...p, currentWeight: v }))}
                hint={latest ? `Last logged: ${latest.weight} kg on ${latest.date}` : "No entries yet"}
                unit="kg"
              />

              {/* Read-only derived values */}
              {acctForm.currentWeight && user.height && (() => {
                const w = parseFloat(acctForm.currentWeight);
                const b = isNaN(w) ? null : parseFloat((w / ((parseFloat(user.height) / 100) ** 2)).toFixed(1));
                if (!b) return null;
                const col = b < 18.5 ? "#F5C842" : b < 25 ? "#7EE8A2" : b < 30 ? "#F5C842" : "#FF6B6B";
                return (
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Calculated BMI</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", color: col, fontWeight: 700 }}>{b} <span style={{ fontSize: 11, color: col, fontWeight: 400 }}>({b < 18.5 ? "Underweight" : b < 25 ? "Normal" : b < 30 ? "Overweight" : "Obese"})</span></span>
                  </div>
                );
              })()}

              <EditField
                label="Age"
                value={acctForm.age}
                onChange={v => setAcctForm(p => ({ ...p, age: v }))}
                hint="Used to calculate population percentile benchmarks"
                unit="years"
              />
            </div>

            {/* ── Goals & Targets ── */}
            <div style={S.card}>
              <div style={S.cardTitle}>Goals & Targets</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 14, lineHeight: 1.5 }}>
                Changing targets updates Dashboard progress bars instantly. All historical log data is preserved.
              </div>

              {/* Target Weight */}
              <EditField
                label="Target Weight"
                value={acctForm.targetWeight}
                onChange={v => setAcctForm(p => ({ ...p, targetWeight: v }))}
                hint={latest ? `${Math.abs(latest.weight - parseFloat(acctForm.targetWeight || 0)).toFixed(1)} kg ${latest.weight > parseFloat(acctForm.targetWeight || latest.weight) ? "to lose" : "to gain"} from current` : undefined}
                unit="kg"
              />

              {/* Target Body Fat */}
              <EditField
                label="Target Body Fat %"
                value={acctForm.targetBodyFat}
                onChange={v => setAcctForm(p => ({ ...p, targetBodyFat: v }))}
                hint={`ACE ${user.gender === "male" ? "men: Athletic <13%, Fitness <17%, Average <25%" : "women: Athletic <20%, Fitness <24%, Average <32%"}`}
                unit="%"
              />

              {/* Target Muscle */}
              <EditField
                label="Target Skeletal Muscle %"
                value={acctForm.targetMuscle}
                onChange={v => setAcctForm(p => ({ ...p, targetMuscle: v }))}
                hint={`Population avg: ${user.gender === "male" ? "men ~38-40%" : "women ~31-32%"} (Janssen et al. 2000)`}
                unit="%"
              />
            </div>

            {/* ── Profile Details ── */}
            <div style={S.card}>
              <div style={S.cardTitle}>Profile Details</div>

              <EditField label="Name" value={acctForm.name} onChange={v => setAcctForm(p => ({ ...p, name: v }))} type="text" />

              <EditField label="Height" value={acctForm.height} onChange={v => setAcctForm(p => ({ ...p, height: v }))} unit="cm" />

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Biological Sex</div>
                <select value={acctForm.gender} onChange={e => setAcctForm(p => ({ ...p, gender: e.target.value }))} style={S.select}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Activity Level</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginBottom: 6 }}>Affects calorie & protein targets in Meals AI</div>
                <select value={acctForm.activityLevel} onChange={e => setAcctForm(p => ({ ...p, activityLevel: e.target.value }))} style={S.select}>
                  <option value="sedentary">Sedentary (desk job, no exercise)</option>
                  <option value="light">Light (1-3 days/week)</option>
                  <option value="moderate">Moderate (3-5 days/week)</option>
                  <option value="active">Active (6-7 days/week)</option>
                  <option value="very_active">Very Active (athlete / physical job)</option>
                </select>
              </div>
            </div>

            {/* Save button */}
            <button onClick={saveAccount} style={S.btn}>Save All Changes</button>

            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", lineHeight: 1.6 }}>
              Your {logs.length} existing log {logs.length === 1 ? "entry" : "entries"} will not be affected.{" "}
              {acctForm.currentWeight && latest?.weight && parseFloat(acctForm.currentWeight) !== latest.weight ? "A new weight entry will be added for today." : ""}
            </div>

            {/* Danger zone */}
            <div style={{ ...S.card, borderColor: "rgba(255,107,107,0.15)" }}>
              <div style={S.cardTitle}>Danger Zone</div>
              <button
                onClick={() => { if (window.confirm(`Delete all data for ${user.name}? This cannot be undone.`)) { setUsers(p => p.filter(u => u.id !== activeUser)); setActiveUser(null); }}}
                style={{ ...S.btn, background: "rgba(255,107,107,0.1)", color: "#FF6B6B", border: "1px solid rgba(255,107,107,0.25)" }}>
                Delete This Profile
              </button>
            </div>

          </div>
        )}

      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  input::placeholder { color: rgba(255,255,255,0.2); }
  select option { background: #131820; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
  @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
`;
