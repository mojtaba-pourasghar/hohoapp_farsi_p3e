import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  toJalali, fromJalali, daysInJalaliMonth, columnOf, spell, todayJalali,
  MONTHS, WEEKDAYS, pad2, fa as faDigits,
} from "./shamsi.js";

const fa = (n) => Number(n || 0).toLocaleString("fa-IR");
const api = async (path, options) => {
  const res = await fetch("/api" + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

const GENDERS = [
  { id: "female", label: "صدای زن" },
  { id: "male", label: "صدای مرد" },
];

/** The fourteen voices, grouped, with their Persian names. Used in both tabs. */
function VoicePicker({ voices, speakers, value, onChange }) {
  if (!voices || !voices.length) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {(speakers || []).map((sp) => <option key={sp} value={sp}>{sp}</option>)}
      </select>
    );
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {GENDERS.map((g) => (
        <optgroup key={g.id} label={g.label}>
          {voices.filter((v) => v.gender === g.id).map((v) => (
            <option key={v.name} value={v.name}>{v.label} — {v.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

const GROUPS = [
  { id: "pages", label: "کتاب، صفحه به صفحه" },
  { id: "sections", label: "خلاصه‌ی بخش‌ها" },
  { id: "numbers", label: "واژه‌های عددی" },
  { id: "phrases", label: "تکه‌های سؤال" },
];


/**
 * A Persian calendar, because every date in this panel is a Persian date.
 *
 * The browser's own <input type="datetime-local"> shows mm/dd/yyyy and a Gregorian calendar,
 * which is the wrong calendar for the person using this and for everything it describes.
 *
 * Shows the month a day at a time, Saturday first, and keeps the hour and minute beside it —
 * «۲۳ مهر ۱۴۰۵ — ساعت ۱۶:۰۰» is one thing to pick, not two.
 */
function ShamsiPicker({ value, onChange, placeholder = "انتخاب نشده" }) {
  const [open, setOpen] = useState(false);
  const start = value ? new Date(value) : new Date();
  const shown = toJalali(new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())));
  const [at, setAt] = useState({ jy: shown.jy, jm: shown.jm });

  const hours = value ? new Date(value).getHours() : 9;
  const minutes = value ? new Date(value).getMinutes() : 0;

  const days = daysInJalaliMonth(at.jy, at.jm);
  const firstDay = fromJalali(at.jy, at.jm, 1);
  const blanks = firstDay ? columnOf(firstDay) : 0;
  const chosen = value ? toJalali(new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()))) : null;
  const today = todayJalali();

  const pick = (jd, hh = hours, mi = minutes) => {
    const when = fromJalali(at.jy, at.jm, jd, hh, mi);
    if (when) onChange(when.getTime());
  };

  const move = (by) => {
    let jm = at.jm + by, jy = at.jy;
    if (jm < 1) { jm = 12; jy -= 1; }
    if (jm > 12) { jm = 1; jy += 1; }
    setAt({ jy, jm });
  };

  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="go ghost" style={{ width: "100%", textAlign: "start" }}
              onClick={() => setOpen(!open)}>
        📅 {value ? spell(value) : placeholder}
      </button>

      {open && (
        <div className="card" style={{
          position: "absolute", zIndex: 30, insetInlineStart: 0, marginTop: 6,
          width: 290, padding: 12, boxShadow: "0 10px 30px rgba(0,0,0,.18)" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <button type="button" className="tiny ghost" onClick={() => move(-1)}>‹</button>
            <b>{MONTHS[at.jm - 1]} {faDigits(at.jy)}</b>
            <button type="button" className="tiny ghost" onClick={() => move(1)}>›</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginTop: 10 }}>
            {WEEKDAYS.map(w => (
              <div key={w} style={{ textAlign: "center", fontSize: 11, color: "var(--muted)" }}>{w}</div>
            ))}
            {Array.from({ length: blanks }).map((_, i) => <div key={`b${i}`} />)}
            {Array.from({ length: days }).map((_, i) => {
              const jd = i + 1;
              const isChosen = chosen && chosen.jy === at.jy && chosen.jm === at.jm && chosen.jd === jd;
              const isToday = today.jy === at.jy && today.jm === at.jm && today.jd === jd;
              return (
                <button key={jd} type="button" onClick={() => pick(jd)} style={{
                  padding: "6px 0", fontSize: 12.5, borderRadius: 8,
                  background: isChosen ? "var(--teal)" : isToday ? "var(--orange-soft)" : "transparent",
                  color: isChosen ? "#fff" : "var(--ink)",
                  border: isToday && !isChosen ? "1px solid var(--orange)" : "1px solid transparent",
                }}>{faDigits(jd)}</button>
              );
            })}
          </div>

          <div className="row" style={{ marginTop: 12, gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>ساعت</span>
            <select value={hours} style={{ width: 70 }} onChange={(e) =>
              pick(chosen && chosen.jm === at.jm ? chosen.jd : 1, Number(e.target.value), minutes)}>
              {Array.from({ length: 24 }).map((_, h) => <option key={h} value={h}>{faDigits(pad2(h))}</option>)}
            </select>
            <span>:</span>
            <select value={minutes} style={{ width: 70 }} onChange={(e) =>
              pick(chosen && chosen.jm === at.jm ? chosen.jd : 1, hours, Number(e.target.value))}>
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m =>
                <option key={m} value={m}>{faDigits(pad2(m))}</option>)}
            </select>
          </div>

          <div className="row" style={{ marginTop: 10, gap: 6 }}>
            <button type="button" className="tiny ghost" onClick={() => {
              setAt({ jy: today.jy, jm: today.jm });
              const when = fromJalali(today.jy, today.jm, today.jd, hours, minutes);
              if (when) onChange(when.getTime());
            }}>امروز</button>
            <button type="button" className="warn tiny" onClick={() => { onChange(0); setOpen(false); }}>
              پاک کردن
            </button>
            <button type="button" className="go tiny" style={{ marginInlineStart: "auto" }}
                    onClick={() => setOpen(false)}>تأیید</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A blank notice. Kept out of the component so «cancel» and «saved» reset to the same thing. */
const emptyNotice = {
  id: "", title: "", body: "", image: "", imageName: "", imageBase64: "",
  link: "", screen: "ANYWHERE", from: 0, until: 0,
};

/** A blank exam form. Kept out of the component so «new» and «cleared» reset to the same thing. */
const emptyExam = {
  active: false, title: "", subject: "", description: "", time: "16:00",
  durationMinutes: 45, questionsJson: "[]", startsAt: 0,
};

export default function App() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(null);
  const [token, setToken] = useState("");
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState({ running: false, done: 0, failed: 0, total: 0, current: [] });
  const [log, setLog] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState({ group: "all", chapter: "all", state: "all", q: "" });
  const [showLog, setShowLog] = useState(true);
  const [published, setPublished] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [sheetTab, setSheetTab] = useState("all");
  const emptySheet = { slug: "", title: "", note: "", chapter: -1, order: "", free: false, file: null };
  const [sheetForm, setSheetForm] = useState(emptySheet);
  const [ftpPass, setFtpPass] = useState("");
  const [uploading, setUploading] = useState({ running: false, done: 0, total: 0, sent: 0, skipped: 0, failed: 0, what: "" });
  const [editing, setEditing] = useState(null);      // { key, spoken }
  const [testStamp, setTestStamp] = useState(0);
  const [tab, setTab] = useState("studio");
  const [diag, setDiag] = useState({ running: false, steps: [], outcome: null });
  const [sample, setSample] = useState({ running: false, mode: "", items: [] });
  const [probe, setProbe] = useState({
    endpoint: "short", speaker: "", speed: "", timestamps: false,
    text: "سَلام! مَن هوهو هَستَم، مُعَلِّمِ فارسیِ تو. بیا با هَم کِتابِ فارسی را بِخوانیم.",
  });
  const [notices, setNotices] = useState([]);
  const [notifForm, setNotifForm] = useState(emptyNotice);
  const [noticeKey, setNoticeKey] = useState({ hasPrivate: false, assetExists: false });
  const [appVersion, setAppVersion] = useState({ version: "", url: "", note: "" });
  const [examForm, setExamForm] = useState(emptyExam);
  const [examData, setExamData] = useState(null);
  const [examList, setExamList] = useState([]);
  const [examId, setExamId] = useState("");
  const [examDlg, setExamDlg] = useState(false);   // the add/edit dialog, null form when closed
  const [promptCopied, setPromptCopied] = useState(false);
  const logBox = useRef(null);

  /** Reloads the exam list from the server; optionally selects one of them. */
  const refreshExams = async (selectId = null) => {
    const d = await api("/exam");
    const list = Array.isArray(d.exams) ? d.exams : (d && d.title ? [{ ...d, id: d.id || "exam-1" }] : []);
    setExamList(list);
    const found = selectId ? list.find((e) => e.id === selectId) : null;
    setExamId(found ? found.id : "");
    setExamData(found || null);
    setExamForm(found ? { ...emptyExam, ...found, questionsJson: JSON.stringify(found.questions || [], null, 2) } : emptyExam);
    return list;
  };

  /** Opens the dialog: blank for a new exam, filled for editing one. */
  const openExamDlg = (ex) => {
    setExamId(ex ? ex.id : "");
    setExamForm(ex ? { ...emptyExam, ...ex, questionsJson: JSON.stringify(ex.questions || [], null, 2) } : emptyExam);
    setExamDlg(true);
  };

  const load = useCallback(async () => {
    try {
      const cfg = await api("/config");
      setConfig(cfg);
      setForm((old) => old ?? cfg);
      const snap = await api("/status");
      setStatus(snap);
      setLog(snap.log || []);
      const manifest = await api("/manifest");
      setLines(manifest.lines);
      const karbarg = await api("/karbarg");
      setSheets(karbarg.sheets || []);
      const probeState = await api("/diag");
      setDiag({ running: probeState.running, steps: probeState.steps, outcome: probeState.outcome });
      setSample(await api("/diag/sample"));
      setUploading(await api("/ftp/status"));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // the server streams every log line and every step of the job
  useEffect(() => {
    const stream = new EventSource("/api/events");
    stream.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "log") setLog((old) => [...old.slice(-400), data.entry]);
      if (data.type === "status") setStatus((old) => ({ ...old, ...data }));
      if (data.type === "upload") setUploading((old) => ({ ...old, ...data }));
      if (data.type === "diag") setDiag((old) => ({ ...old, ...data }));
      if (data.type === "sample") setSample((old) => ({ ...old, ...data }));
      // one clip finished: patch its row where it stands, so the list keeps up with the run
      if (data.type === "line") {
        setLines((old) => old.map((l) => l.key === data.key
          ? { ...l, done: data.done, file: data.file, size: data.size, stamp: data.stamp }
          : l));
      }
    };
    return () => stream.close();
  }, []);

  // when a job finishes, the files on disk have changed — reread them
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !status.running) load();
    wasRunning.current = status.running;
  }, [status.running, load]);

  useEffect(() => {
    if (showLog && logBox.current) logBox.current.scrollTop = logBox.current.scrollHeight;
  }, [log, showLog]);

  const counts = useMemo(() => {
    const done = lines.filter((l) => l.done).length;
    return { total: lines.length, done, left: lines.length - done };
  }, [lines]);

  const chapters = useMemo(
    () => [...new Set(lines.map((l) => l.chapter).filter(Boolean))].sort((a, b) => a - b),
    [lines]
  );

  const shown = useMemo(() => lines.filter((l) => {
    if (filter.group !== "all" && l.group !== filter.group) return false;
    if (filter.chapter !== "all" && String(l.chapter) !== filter.chapter) return false;
    if (filter.state === "done" && !l.done) return false;
    if (filter.state === "todo" && l.done) return false;
    if (filter.q && !(l.key.includes(filter.q) || l.written.includes(filter.q))) return false;
    return true;
  }), [lines, filter]);

  const save = async (patch) => {
    setBusy(true);
    try {
      const next = await api("/config", { method: "POST", body: JSON.stringify(patch) });
      setConfig(next);
      setForm((old) => ({ ...old, ...next }));
      setError("");
      if (patch.manifestPath || patch.outDir) load();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  /** Saves the FTP box as it stands (password included) and hands back the fresh config. */
  const saveFtp = async () => {
    const next = await api("/config", { method: "POST", body: JSON.stringify({
      ftp: { ...form.ftp, ...(ftpPass ? { password: ftpPass } : {}) },
    }) });
    setConfig(next);
    setForm((old) => ({ ...old, ...next }));
    setFtpPass("");
    return next;
  };

  /** Nothing on the FTP side runs before the box it reads from is saved. */
  const ftpDo = async (path, body = {}) => {
    setBusy(true);
    try {
      const next = await saveFtp();
      if (!next.ftp?.passwordSet) throw new Error("رمزِ FTP داده نشده");
      await api(path, { method: "POST", body: JSON.stringify(body) });
      setError("");
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  const sampleRun = async (what) => {
    try {
      await api("/diag/sample", { method: "POST", body: JSON.stringify({
        ...what,
        text: probe.text,
        endpoint: probe.endpoint,
        speaker: probe.speaker || config.speaker,
        speed: probe.speed === "" ? config.speed : probe.speed,
      }) });
      setError("");
    } catch (err) { setError(err.message); }
  };

  const generate = async (keys, limit, force = false) => {
    setBusy(true);
    try {
      await api("/generate", { method: "POST", body: JSON.stringify({ keys, limit, force }) });
      setError("");
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  /** Save a corrected line. It lands in tools/voice-overrides.json, which goes into git. */
  const saveText = async (key, spoken) => {
    setBusy(true);
    try {
      await api("/text", { method: "POST", body: JSON.stringify({ key, spoken }) });
      setEditing(null);
      await load();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  const stop = () => api("/stop", { method: "POST" }).catch((e) => setError(e.message));

  const testVoice = async () => {
    setBusy(true);
    try {
      await api("/test", { method: "POST", body: JSON.stringify({}) });
      setTestStamp(Date.now());        // makes the player reload the new file
      load();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  const removeFile = async (key) => {
    try {
      await api(`/audio/${key}`, { method: "DELETE" });
      load();
    } catch (err) { setError(err.message); }
  };

  if (!config || !form) {
    return <div className="studio"><div className="card">در حال باز شدن…</div></div>;
  }

  const todoKeys = (subset) => subset.filter((l) => !l.done).map((l) => l.key);
  const progress = status.total ? Math.round((status.done / status.total) * 100) : 0;

  return (
    <div className="studio">
      <div className="top">
        <span className="owl">🦉</span>
        <div>
          <h1>استودیوی صداگذاری هوهو</h1>
          <p>
            متن از <code>audio_manifest.txt</code> · صدای{" "}
            {(config.voices || []).find((v) => v.name === config.speaker)?.label || config.speaker}
            {" "}با سرعتِ {config.speed} · فایل‌ها در <code>{config.outDir}</code>
          </p>
        </div>
        <div className="grow" />
        <button className={tab === "studio" ? "chip sel" : "chip"} onClick={() => setTab("studio")}>
          استودیو
        </button>
        <button className={tab === "diag" ? "chip sel" : "chip"} onClick={() => setTab("diag")}>
          تستِ وب‌سرویس
        </button>
        <button className={tab === "notifications" ? "chip sel" : "chip"} onClick={() => {
          setTab("notifications");
          api("/notices").then(d => {
            setNotices(d.notices || []);
            if (d.key) setNoticeKey(d.key);
            setAppVersion(d.app || { version: "", url: "", note: "" });
          }).catch(() => {});
        }}>
          📢 اعلان‌ها
        </button>
        <button className={tab === "exam" ? "chip sel" : "chip"} onClick={() => { setTab("exam"); refreshExams().catch(() => {}); }}>
          🏆 آزمون آنلاین
        </button>
        <button className="ghost" onClick={load} disabled={busy}>تازه‌سازی</button>
        {status.running
          ? <button className="warn" onClick={stop}>ایستادن</button>
          : <button className="go" onClick={() => generate([], 0)} disabled={!config.tokenSet || !counts.left}>
              ساختِ همه‌ی باقی‌مانده‌ها ({fa(counts.left)})
            </button>}
      </div>

      {error && <div className="err">{error}</div>}
      {!config.tokenSet && <div className="err">توکنِ آواشو را پایین وارد کن تا ساخت شروع شود.</div>}

      {tab === "studio" && (<>
      <div className="stats">
        <div className="stat">
          <div className="label">کلِ جمله‌ها</div>
          <div className="value">{fa(counts.total)}</div>
          <div className="foot">طبق audio_manifest.txt</div>
        </div>
        <div className={"stat" + (counts.done ? " on" : "")}>
          <div className="label">ساخته‌شده</div>
          <div className="value">{fa(counts.done)}</div>
          <div className="bar"><i style={{ width: `${counts.total ? (counts.done / counts.total) * 100 : 0}%` }} /></div>
        </div>
        <div className="stat">
          <div className="label">باقی‌مانده</div>
          <div className="value">{fa(counts.left)}</div>
          <div className="foot">{status.running ? `در حال ساخت: ${status.current.join("، ") || "…"}` : "آماده"}</div>
        </div>
        <div className="stat">
          <div className="label">{status.running ? "پیشرفتِ این دسته" : "ناموفق در آخرین دسته"}</div>
          <div className="value">{status.running ? `${fa(status.done)}/${fa(status.total)}` : fa(status.failed)}</div>
          {status.running && <div className="bar"><i style={{ width: `${progress}%` }} /></div>}
        </div>
      </div>

      <div className="card">
        <h2>⚙️ تنظیمات <span className="hint">در voice-studio.config.json روی سیستمِ خودت ذخیره می‌شود</span></h2>
        <div className="grid">
          <div>
            <label>توکنِ آواشو (gateway-token)</label>
            <input type="password" placeholder={config.tokenHint || "توکن را بچسبان"}
                   value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <div>
            <label>مسیرِ ذخیره‌ی فایل‌های صوتی</label>
            <input type="text" value={form.outDir}
                   onChange={(e) => setForm({ ...form, outDir: e.target.value })} />
          </div>
          <div>
            <label>مسیرِ audio_manifest.txt</label>
            <input type="text" value={form.manifestPath}
                   onChange={(e) => setForm({ ...form, manifestPath: e.target.value })} />
          </div>
          <div>
            <label>گوینده <span className="hint">
              {config.speaker === form.speaker ? "همین ذخیره شده" : "در حال ذخیره…"}
            </span></label>
            <VoicePicker voices={config.voices} speakers={config.speakers} value={form.speaker}
                         onChange={(speaker) => {
                           setForm({ ...form, speaker });
                           save({ speaker });        // picked is chosen; no second button
                         }} />
          </div>
          <div>
            <label>سرعت <span className="hint">
              {Number(config.speed) === Number(form.speed)
                ? "۱ سرعتِ خودِ سرویس · ۰٫۹ آرام‌ترِ کلاسی"
                : "ذخیره نشده — «ذخیره‌ی تنظیمات» را بزن"}
            </span></label>
            <input type="number" step="0.1" min="0.5" max="2" value={form.speed}
                   onChange={(e) => setForm({ ...form, speed: e.target.value })}
                   onBlur={(e) => save({ speed: e.target.value })} />
          </div>
          <div>
            <label>سرویسِ آواشو</label>
            <select value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })}>
              <option value="short">avasho — متنِ کوتاه (درست برای جمله‌های درس)</option>
              <option value="long">avasho-large — متنِ بلند</option>
            </select>
          </div>
          <div>
            <label>چند تا هم‌زمان</label>
            <input type="number" min="1" max="8" value={form.concurrency}
                   onChange={(e) => setForm({ ...form, concurrency: e.target.value })} />
          </div>
          <div>
            <label>فاصله‌ی بینِ درخواست‌ها (میلی‌ثانیه)</label>
            <input type="number" min="0" step="100" value={form.delayMs}
                   onChange={(e) => setForm({ ...form, delayMs: e.target.value })} />
          </div>
          <div>
            <label>تلاشِ مجدد در خطا</label>
            <input type="number" min="0" max="8" value={form.retries}
                   onChange={(e) => setForm({ ...form, retries: e.target.value })} />
          </div>
          <label className="check">
            <input type="checkbox" checked={form.useVowels}
                   onChange={(e) => setForm({ ...form, useVowels: e.target.checked })} />
            متنِ اعراب‌گذاری‌شده (ستون سوم)
          </label>
          <label className="check">
            <input type="checkbox" checked={form.convertOgg}
                   onChange={(e) => setForm({ ...form, convertOgg: e.target.checked })} />
            تبدیل به ogg با ffmpeg
          </label>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="go" disabled={busy}
                  onClick={() => { save({ ...form, token: token || undefined }); setToken(""); }}>
            ذخیره‌ی تنظیمات
          </button>
          <button className="ghost" disabled={busy || !config.tokenSet} onClick={testVoice}>
            تستِ صدا با یک جمله
          </button>
          {config.tokenSet &&
            <button className="ghost" onClick={() => save({ token: "" })}>پاک کردنِ توکن</button>}
        </div>
        {testStamp > 0 && (
          <div className="row" style={{ marginTop: 12 }}>
            <span className="tag done">نمونه‌ی تست</span>
            <audio controls src={`/api/audio/_test-${config.speaker}?t=${testStamp}`} />
          </div>
        )}
        <p className="note">
          توکن و رمزِ FTP در <code>{config.configFile}</code> ذخیره می‌شوند و با رفرش یا بالا
          آمدنِ دوباره‌ی سرور از دست نمی‌روند. کادرها از روی عادت خالی نشان داده می‌شوند —
          {config.tokenSet ? " ✓ توکن ذخیره شده است" : " توکن هنوز داده نشده"}
          {config.ftp?.passwordSet ? " · ✓ رمزِ FTP ذخیره شده است" : " · رمزِ FTP داده نشده"}.
          {config.savedAt ? " آخرین ذخیره: " + new Date(config.savedAt).toLocaleTimeString("fa-IR") : ""}
        </p>
        <p className="note">
          فایل‌ها با نامِ کلید ذخیره می‌شوند (مثلاً <code>p008_01.mp3</code>) در
          <code> {config.outDir}</code>.
        </p>
      </div>

      <div className="card">
        <h2>⏱ زمان‌بندی <span className="hint">دسته‌دسته می‌سازد و خودش ادامه می‌دهد</span></h2>
        <div className="grid">
          <div>
            <label>هر چند ثانیه یک دسته</label>
            <input type="number" min="30" step="30" value={form.schedule.everySeconds}
                   onChange={(e) => setForm({ ...form, schedule: { ...form.schedule, everySeconds: Number(e.target.value) } })} />
          </div>
          <div>
            <label>اندازه‌ی هر دسته</label>
            <input type="number" min="1" value={form.schedule.batchSize}
                   onChange={(e) => setForm({ ...form, schedule: { ...form.schedule, batchSize: Number(e.target.value) } })} />
          </div>
          <label className="check">
            <input type="checkbox" checked={config.schedule.enabled}
                   onChange={(e) => save({ schedule: { ...form.schedule, enabled: e.target.checked } })} />
            {config.schedule.enabled ? "روشن است" : "خاموش"}
          </label>
        </div>
        <p className="note">
          تا این پنجره باز است و سرور بالا، هر دوره یک دسته‌ی تازه از جمله‌هایی که فایل ندارند
          ساخته می‌شود. با سهمیه‌ی محدودِ سرویس، دسته‌ی کوچک و فاصله‌ی بلند بهتر جواب می‌دهد.
        </p>
      </div>

      <div className="card">
        <h2>⚡ ساختِ دسته‌ای</h2>
        <div className="row">
          {GROUPS.map((g) => {
            const subset = lines.filter((l) => l.group === g.id);
            const left = todoKeys(subset).length;
            return (
              <button key={g.id} className="chip" disabled={busy || status.running || !left}
                      onClick={() => generate(todoKeys(subset))}>
                {g.label} ({fa(left)})
              </button>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          {chapters.map((c) => {
            const subset = lines.filter((l) => l.chapter === c);
            const left = todoKeys(subset).length;
            return (
              <button key={c} className="chip" disabled={busy || status.running || !left}
                      onClick={() => generate(todoKeys(subset))}>
                فصل {fa(c)} ({fa(left)})
              </button>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          {[10, 50, 200].map((n) => (
            <button key={n} className="ghost" disabled={busy || status.running || !counts.left}
                    onClick={() => generate([], n)}>
              فقط {fa(n)} تای بعدی
            </button>
          ))}
          <button disabled={busy || status.running || !shown.some((l) => !l.done)}
                  onClick={() => generate(todoKeys(shown))}>
            هرچه در فهرستِ پایین فیلتر شده ({fa(shown.filter((l) => !l.done).length)})
          </button>
        </div>
      </div>

      <div className="card">
        <h2>📤 انتشار روی هاست <span className="hint">فایل‌ها را خودت آپلود می‌کنی؛ اینجا فقط فهرست ساخته می‌شود</span></h2>
        <div className="grid">
          <div>
            <label>آدرسِ پوشه‌ی صداها روی هاست</label>
            <input type="text" value={form.audioBase || ""}
                   onChange={(e) => setForm({ ...form, audioBase: e.target.value })} />
          </div>
          <div>
            <label>آدرسِ پوشه‌ی کاربرگ‌ها روی هاست</label>
            <input type="text" value={form.karbargBase || ""}
                   onChange={(e) => setForm({ ...form, karbargBase: e.target.value })} />
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="go" disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              const index = await api("/publish/audio", { method: "POST" });
              setPublished(index);
              setError("");
            } catch (err) { setError(err.message); }
            setBusy(false);
          }}>
            ساختِ فهرستِ صدا (index.json)
          </button>
          <button className="ghost" disabled={busy} onClick={() => save(form)}>ذخیره‌ی آدرس‌ها</button>
        </div>
        {published && (
          <p className="note">
            ✓ {fa(published.count)} کلیپ، {fa(Math.round(published.bytes / 1048576))} مگابایت.
            <code> index.json </code> کنارِ خودِ فایل‌ها ساخته شد و یک نسخه هم در
            <code> app/src/main/assets/voice-index.json </code> گذاشته شد.
          </p>
        )}

        <h2 style={{ marginTop: 20 }}>
          🚀 آپلود با FTP
          <span className="hint">
            {config.ftp?.passwordSet ? "رمز ذخیره شده است" : "رمز هنوز داده نشده"}
          </span>
        </h2>
        <div className="grid">
          <div>
            <label>آدرسِ سرورِ FTP</label>
            <input type="text" value={form.ftp?.host || ""}
                   onChange={(e) => setForm({ ...form, ftp: { ...form.ftp, host: e.target.value } })} />
          </div>
          <div>
            <label>پورت</label>
            <input type="number" value={form.ftp?.port ?? 21}
                   onChange={(e) => setForm({ ...form, ftp: { ...form.ftp, port: Number(e.target.value) } })} />
          </div>
          <div>
            <label>نام کاربری</label>
            <input type="text" value={form.ftp?.user || ""}
                   onChange={(e) => setForm({ ...form, ftp: { ...form.ftp, user: e.target.value } })} />
          </div>
          <div>
            <label>رمز</label>
            <input type="password" value={ftpPass}
                   placeholder={config.ftp?.passwordSet ? "ذخیره شده — برای تغییر بنویس" : "رمزِ FTP"}
                   onChange={(e) => setFtpPass(e.target.value)} />
          </div>
          <div>
            <label>پوشه‌ی صداها روی سرور</label>
            <input type="text" value={form.ftp?.audioDir || ""}
                   onChange={(e) => setForm({ ...form, ftp: { ...form.ftp, audioDir: e.target.value } })} />
          </div>
          <div>
            <label>پوشه‌ی کاربرگ‌ها روی سرور</label>
            <input type="text" value={form.ftp?.karbargDir || ""}
                   onChange={(e) => setForm({ ...form, ftp: { ...form.ftp, karbargDir: e.target.value } })} />
          </div>
          <label className="check">
            <input type="checkbox" checked={Boolean(form.ftp?.secure)}
                   onChange={(e) => setForm({ ...form, ftp: { ...form.ftp, secure: e.target.checked } })} />
            FTPS (explicit) — اگر هاست می‌خواهد
          </label>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="ghost" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await saveFtp(); setError(""); } catch (err) { setError(err.message); }
            setBusy(false);
          }}>
            ذخیره‌ی تنظیماتِ FTP
          </button>
          <button className="ghost" disabled={busy}
                  onClick={() => ftpDo("/ftp/test", { which: "audio" })}>
            تستِ اتصال
          </button>
          <button className="go" disabled={busy || uploading.running}
                  onClick={() => ftpDo("/ftp/upload/audio")}>
            آپلودِ صداها (فقط تازه‌ها)
          </button>
          <button disabled={busy || uploading.running}
                  onClick={() => ftpDo("/ftp/upload/audio", { all: true })}>
            آپلودِ همه دوباره
          </button>
          <button className="chip" disabled={busy || uploading.running}
                  onClick={() => ftpDo("/ftp/upload/karbarg")}>
            آپلودِ کاربرگ‌ها
          </button>
          {uploading.running && (
            <button className="warn" onClick={() => api("/ftp/stop", { method: "POST" })}>
              توقفِ آپلود
            </button>
          )}
        </div>

        {uploading.link?.state && (
          <div style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong style={{ fontSize: 13 }}>
                وضعیتِ اتصال:{" "}
                <span className={uploading.link.error ? "state bad"
                                 : uploading.link.state === "وصل است" ? "state ok" : "state warn"}>
                  {uploading.link.state}
                </span>
                {uploading.link.note ? <span className="key"> · {uploading.link.note}</span> : null}
              </strong>
              <span className="tag">
                {config.ftp?.host}:{fa(config.ftp?.port ?? 21)}
                {config.ftp?.secure ? " · FTPS" : ""}
              </span>
            </div>
            {uploading.link.error && <div className="err" style={{ marginTop: 8 }}>
              {uploading.link.error}
            </div>}
            {uploading.link.warning && <div className="err" style={{ marginTop: 8 }}>
              ⚠ {uploading.link.warning}
            </div>}
            {uploading.link.info && (
              <p className="note">
                پوشه‌ی ورود <code>{uploading.link.info.loginDir}</code> · مقصد{" "}
                <code>{uploading.link.info.remoteDir}</code>{" "}
                {uploading.link.info.remoteExists
                  ? `— ${fa(uploading.link.info.remoteCount)} فایل آنجاست`
                  : "— هنوز ساخته نشده؛ موقعِ آپلود ساخته می‌شود"}
                {uploading.link.info.names?.length
                  ? ` (${uploading.link.info.names.join("، ")}…)` : ""}
              </p>
            )}
            {uploading.link.lines?.length > 0 && (
              <details open={!uploading.link.info}>
                <summary className="note" style={{ cursor: "pointer" }}>
                  گفت‌وگو با سرور ({fa(uploading.link.lines.length)} خط)
                </summary>
                <pre style={{ direction: "ltr", textAlign: "left", whiteSpace: "pre-wrap",
                              fontSize: 11, background: "#faf7f2", padding: 9, borderRadius: 8,
                              maxHeight: 220, overflow: "auto" }}>
                  {uploading.link.lines.join("\n")}
                </pre>
              </details>
            )}
          </div>
        )}

        {(uploading.running || uploading.done > 0) && (
          <div style={{ marginTop: 12 }}>
            <div className="bar">
              <i style={{ width: `${uploading.total ? (uploading.done / uploading.total) * 100 : 0}%` }} />
            </div>
            <p className="note">
              {uploading.running ? `در حال آپلودِ ${uploading.what}: ` : "آخرین آپلود: "}
              {fa(uploading.done)} از {fa(uploading.total)} — {fa(uploading.sent)} فرستاده،
              {" "}{fa(uploading.skipped)} از قبل بود، {fa(uploading.failed)} ناموفق
            </p>
          </div>
        )}

        <p className="note">
          «فقط تازه‌ها» فایلی را که با همان نام و همان حجم روی سرور هست رد می‌کند، پس اجرای
          دوباره فقط چیزهای جدید را می‌فرستد. <code>index.json</code> همیشه آخر از همه و از نو
          ساخته می‌شود، تا هیچ‌وقت فهرستی از فایل‌هایی که هنوز نرفته‌اند روی سرور نباشد.
        </p>
        <p className="note">
          آپلودِ کاربرگ‌ها پوشه‌ی سرور را با پوشه‌ی اینجا یکی می‌کند — کاربرگی که اینجا پاک
          کرده باشی، آنجا هم پاک می‌شود.
        </p>
      </div>

      <div className="card">
        <h2>📄 کاربرگ‌های چاپی <span className="hint">{fa(sheets.length)} کاربرگ در {config.karbargDir}</span></h2>
        <div className="grid">
          <div>
            <label>عنوانِ کاربرگ</label>
            <input type="text" value={sheetForm.title}
                   onChange={(e) => setSheetForm({ ...sheetForm, title: e.target.value })} />
          </div>
          <div>
            <label>توضیح (مثلاً «۲ صفحه، جمع و تفریق»)</label>
            <input type="text" value={sheetForm.note}
                   onChange={(e) => setSheetForm({ ...sheetForm, note: e.target.value })} />
          </div>
          <div>
            <label>فصل</label>
            <select value={sheetForm.chapter}
                    onChange={(e) => setSheetForm({ ...sheetForm, chapter: Number(e.target.value) })}>
              <option value={-1}>متفرقه (به فصلی مربوط نیست)</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n - 1}>فصل {fa(n)}</option>
              ))}
            </select>
          </div>
          <div>
            <label>ترتیب در فهرست</label>
            <input type="number" placeholder="خالی = آخر از همه" value={sheetForm.order}
                   onChange={(e) => setSheetForm({ ...sheetForm, order: e.target.value })} />
            <span className="muted" style={{ fontSize: 11 }}>
              کوچک‌تر بالاتر. اپ دقیقاً به همین ترتیب نشان می‌دهد.
            </span>
          </div>
          <div>
            <label>فایلِ PDF {sheetForm.slug ? "(خالی بگذار تا همان فایلِ قبلی بماند)" : ""}</label>
            <input type="file" accept="application/pdf"
                   onChange={(e) => setSheetForm({ ...sheetForm, file: e.target.files?.[0] || null })} />
          </div>
          <label className="check">
            <input type="checkbox" checked={sheetForm.free}
                   onChange={(e) => setSheetForm({ ...sheetForm, free: e.target.checked })} />
            رایگان (بدونِ نسخه‌ی کامل هم باز است)
          </label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="go"
                  disabled={busy || !sheetForm.title || (!sheetForm.slug && !sheetForm.file)}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      // on an edit the PDF is optional: no file means «keep the one that is there»
                      const data = sheetForm.file ? await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(sheetForm.file);
                      }) : null;
                      const body = JSON.stringify({
                        title: sheetForm.title, note: sheetForm.note,
                        chapter: sheetForm.chapter, free: sheetForm.free,
                        order: sheetForm.order === "" ? null : Number(sheetForm.order),
                        fileName: sheetForm.file ? sheetForm.file.name : undefined,
                        dataBase64: data || undefined,
                      });
                      if (sheetForm.slug) await api(`/karbarg/${sheetForm.slug}`, { method: "PUT", body });
                      else await api("/karbarg", { method: "POST", body });
                      setSheetForm(emptySheet);
                      load();
                      setError("");
                    } catch (err) { setError(err.message); }
                    setBusy(false);
                  }}>
            {sheetForm.slug ? "💾 ذخیره‌ی ویرایش" : "افزودنِ کاربرگ"}
          </button>
          {sheetForm.slug && (
            <button className="ghost" onClick={() => setSheetForm(emptySheet)}>انصراف</button>
          )}
          <button className="ghost" disabled={busy} onClick={async () => {
            try { await api("/publish/karbarg", { method: "POST" }); setError(""); }
            catch (err) { setError(err.message); }
          }}>
            ساختِ فهرستِ کاربرگ (index.json)
          </button>
        </div>

        {sheets.length > 0 && (
          <>
          <div className="row" style={{ marginTop: 12, gap: 6, flexWrap: "wrap" }}>
            <button className={sheetTab === "all" ? "chip sel" : "chip"}
                    onClick={() => setSheetTab("all")}>
              همه ({fa(sheets.length)})
            </button>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => {
              const n = sheets.filter((s) => s.chapter === c).length;
              if (!n) return null;
              return (
                <button key={c} className={sheetTab === `ch${c}` ? "chip sel" : "chip"}
                        onClick={() => setSheetTab(`ch${c}`)}>
                  فصل {fa(c + 1)} ({fa(n)})
                </button>
              );
            })}
            {sheets.some((s) => !(s.chapter >= 0)) && (
              <button className={sheetTab === "misc" ? "chip sel" : "chip"}
                      onClick={() => setSheetTab("misc")}>
                متفرقه ({fa(sheets.filter((s) => !(s.chapter >= 0)).length)})
              </button>
            )}
          </div>
          <div className="row" style={{ marginTop: 8, gap: 6, flexWrap: "wrap" }}>
            {[
              { key: "all", chapter: undefined,
                label: `آپلودِ همه‌ی کاربرگ‌ها (${fa(sheets.length)}) + index.json` },
              ...[0, 1, 2, 3, 4, 5, 6, 7].map((c) => {
                const n = sheets.filter((s) => s.chapter === c).length;
                return n ? { key: `ch${c}`, chapter: c,
                  label: `آپلودِ فصل ${fa(c + 1)} (${fa(n)}) + index.json` } : null;
              }).filter(Boolean),
              ...(sheets.some((s) => !(s.chapter >= 0))
                ? [{ key: "misc", chapter: -1,
                     label: `آپلودِ متفرقه (${fa(sheets.filter((s) => !(s.chapter >= 0)).length)}) + index.json` }]
                : []),
            ].map((b) => (
              <button key={b.key} className="tiny ghost" disabled={busy || uploading.running}
                      onClick={() => {
                        if (!confirm(`«${b.label}» انجام شود؟`)) return;
                        ftpDo("/ftp/upload/karbarg", { chapter: b.chapter });
                      }}>
                {`🚀 ${b.label}`}
              </button>
            ))}
            <button className="tiny ghost" disabled={busy || uploading.running}
                    onClick={() => {
                      if (!confirm("فقط index.json روی هاست به‌روز شود؟ (بدونِ آپلودِ PDF)")) return;
                      ftpDo("/ftp/upload/karbarg", { indexOnly: true });
                    }}>
              فقط index.json را آپلود کن
            </button>
          </div>
          <div className="files" style={{ marginTop: 12 }}>
            {sheets
              .filter((s) => sheetTab === "all" ? true
                : sheetTab === "misc" ? !(s.chapter >= 0)
                : s.chapter === Number(sheetTab.slice(2)))
              .slice()
              .sort((a, b) => {
                const ao = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
                const bo = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
                return ao !== bo ? ao - bo : String(a.title).localeCompare(String(b.title), "fa");
              })
              .map((sheet) => (
              <div className="file" key={sheet.slug}>
                <span className="key">{sheet.slug}</span>
                <span style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span
                    className="order-badge"
                    style={{
                      color: "#b45309",
                      fontWeight: "bold",
                      fontSize: "15px",
                    }}
                  >
                    {Number.isFinite(sheet.order) ? fa(sheet.order) : "—"}
                  </span>
                  <span className="say">
                    {sheet.title}
                    {sheet.note ? ` — ${sheet.note}` : ""}
                    {sheet.chapter >= 0 ? ` · فصل ${fa(sheet.chapter + 1)}` : " · متفرقه"}
                    {sheet.free ? " · رایگان" : ""}
                  </span>
                </span>
                <span className="row">
                  <span className="tag done">{fa(Math.round(sheet.bytes / 1024))}KB</span>
                  <button className="tiny ghost" onClick={() => setSheetForm({
                    slug: sheet.slug, title: sheet.title, note: sheet.note || "",
                    chapter: sheet.chapter, free: sheet.free === true,
                    order: Number.isFinite(sheet.order) ? String(sheet.order) : "",
                    file: null,
                  })}>ویرایش</button>
                  <button className="tiny ghost" onClick={async () => {
                    if (!confirm(`«${sheet.title}» پاک شود؟`)) return;
                    await api(`/karbarg/${sheet.slug}`, { method: "DELETE" });
                    load();
                  }}>پاک</button>
                  <button className="tiny go" disabled={busy || uploading.running} onClick={() => {
                    if (!confirm(`فقط «${sheet.title}» آپلود شود؟ (+ index.json)`)) return;
                    ftpDo("/ftp/upload/karbarg", { slugs: [sheet.slug] });
                  }}>آپلودِ همین</button>
                </span>
              </div>
            ))}
          </div>
          </>
        )}
        <p className="note">
          ویرایش، نامِ پوشه را عوض نمی‌کند — آن نام بخشی از آدرسی است که هر گوشی‌ای قبلاً
          کش کرده، و عوض کردنش یعنی هر کاربرگِ دانلودشده یک لینکِ شکسته شود، آن هم برای
          اصلاحِ یک کلمه در عنوان.
          <br />
          هر کاربرگ یک پوشه با نامِ خودش می‌گیرد که PDF و <code>info.json</code> در آن است.
          همین ساختار را در <code>{config.karbargBase}</code> آپلود کن؛ اپ فهرست را با
          عنوان و توضیح می‌خواند و لینکِ دانلود می‌سازد.
        </p>
      </div>

      </>)}

      {tab === "diag" && (
        <div className="card">
          <h2>🔎 تستِ وب‌سرویس <span className="hint">یک تماسِ کامل، با همه‌ی مرحله‌ها</span></h2>
          <div className="grid">
            <div>
              <label>نوعِ درخواست</label>
              <select value={probe.endpoint}
                      onChange={(e) => setProbe({ ...probe, endpoint: e.target.value })}>
                <option value="short">avasho — متنِ کوتاه</option>
                <option value="long">avasho-large — متنِ بلند</option>
              </select>
            </div>
            <div>
              <label>گوینده</label>
              <VoicePicker voices={config.voices} speakers={config.speakers}
                           value={probe.speaker || config.speaker}
                           onChange={(speaker) => setProbe({ ...probe, speaker })} />
            </div>
            <div>
              <label>سرعت</label>
              <input type="number" step="0.1" min="0.5" max="2"
                     value={probe.speed === "" ? config.speed : probe.speed}
                     onChange={(e) => setProbe({ ...probe, speed: e.target.value })} />
            </div>
            <label className="check">
              <input type="checkbox" checked={probe.timestamps}
                     onChange={(e) => setProbe({ ...probe, timestamps: e.target.checked })} />
              زمان‌بندیِ کلمه‌ها را هم بخواه
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <label>متنِ تست</label>
            <textarea rows={3} style={{ width: "100%" }} value={probe.text}
                      onChange={(e) => setProbe({ ...probe, text: e.target.value })} />
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="go" disabled={diag.running || !config.tokenSet}
                    onClick={async () => {
                      setDiag({ running: true, steps: [], outcome: null });
                      try {
                        await api("/diag", { method: "POST", body: JSON.stringify({
                          ...probe, speaker: probe.speaker || config.speaker,
                          speed: probe.speed === "" ? config.speed : probe.speed }) });
                        setError("");
                      } catch (err) { setError(err.message); setDiag({ running: false, steps: [], outcome: null }); }
                    }}>
              {diag.running ? "در حال تست…" : "شروعِ تست"}
            </button>
            {diag.running && (
              <button className="warn" onClick={() => api("/diag/stop", { method: "POST" })}>
                توقفِ تست
              </button>
            )}
            {!config.tokenSet && <span className="note">اول در تبِ استودیو توکن را بده.</span>}
          </div>

          {diag.steps.length > 0 && (
            <div className="files" style={{ marginTop: 14 }}>
              {diag.steps.map((st, i) => (
                <div key={i} style={{ padding: "10px 12px", borderBottom: "1px solid #f2ede5" }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <strong style={{ fontSize: 13 }}>
                      {st.name} — <span className={st.status >= 200 && st.status < 300 ? "" : "tag"}>
                        {st.status === 0 ? "به سرویس نرسید" : `HTTP ${st.status}`}
                      </span>
                    </strong>
                    <span className="tag">{st.ms} میلی‌ثانیه{st.bytes ? ` · ${fa(st.bytes)} بایت` : ""}</span>
                  </div>
                  <div className="key" style={{ margin: "4px 0", wordBreak: "break-all" }}>
                    {st.method} {st.url}
                  </div>
                  <pre style={{ margin: 0, direction: "ltr", textAlign: "left", whiteSpace: "pre-wrap",
                                fontSize: 11, background: "#faf7f2", padding: 9, borderRadius: 8,
                                maxHeight: 180, overflow: "auto" }}>{st.body}</pre>
                </div>
              ))}
            </div>
          )}

          {diag.outcome && (
            <div style={{ marginTop: 14 }}>
              {diag.outcome.ok ? (
                <>
                  <p className="note" style={{ color: "#1f6f66", fontWeight: 700 }}>
                    ✓ وب‌سرویس کار می‌کند — {fa(Math.round(diag.outcome.bytes / 1024))} کیلوبایت
                    {diag.outcome.ext}، در {(diag.outcome.ms / 1000).toFixed(1)} ثانیه
                    {diag.outcome.words ? ` · ${fa(diag.outcome.words)} کلمه زمان‌بندی شد` : ""}
                  </p>
                  <audio controls src={`/api/audio/_diag-${probe.speaker || config.speaker}?t=${diag.outcome.ms}`} />
                </>
              ) : (
                <div className="err">✗ {diag.outcome.error}</div>
              )}
            </div>
          )}

          <p className="note">
            سه مرحله را می‌بینی: <code>request</code>، بعد اگر لازم بود <code>track</code>، و
            آخر <code>download</code>. اگر جایی ایستاد، همان کادرِ خام می‌گوید سرویس چه گفت —
            و همان را بفرست تا درستش کنم.
          </p>
        </div>
      )}

      {tab === "diag" && (
        <div className="card">
          <h2>🎙 نمونه‌ها <span className="hint">صدا و سرعت را با گوش انتخاب کن، نه با حدس</span></h2>
          <p className="note" style={{ marginTop: 0 }}>
            همان جمله‌ی بالا با هر صدا — یا با چند سرعتِ مختلف — ساخته می‌شود و همین‌جا پخش.
            هرکدام را پسندیدی، «همین» را بزن تا گوینده و سرعتِ درس‌ها بشود. نمونه‌ها نامشان با
            <code> _ </code> شروع می‌شود، پس هیچ‌وقت در <code>index.json</code> و روی هاست
            نمی‌روند.
          </p>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <button className="go" disabled={sample.running || !config.tokenSet}
                    onClick={() => sampleRun({ mode: "voices" })}>
              نمونه‌ی همه‌ی گوینده‌ها ({fa((config.voices || []).length)})
            </button>
            <button disabled={sample.running || !config.tokenSet}
                    onClick={() => sampleRun({ mode: "voices", gender: "female" })}>
              فقط صدای زن
            </button>
            <button disabled={sample.running || !config.tokenSet}
                    onClick={() => sampleRun({ mode: "voices", gender: "male" })}>
              فقط صدای مرد
            </button>
            <button disabled={sample.running || !config.tokenSet}
                    onClick={() => sampleRun({ mode: "speeds" })}>
              نمونه‌ی سرعت‌ها (۰٫۸ تا ۱٫۱)
            </button>
            {sample.running && (
              <button className="warn" onClick={() => api("/diag/sample/stop", { method: "POST" })}>
                توقف
              </button>
            )}
          </div>

          {(sample.duplicates || []).length > 0 && (
            <div className="err" style={{ marginTop: 14 }}>
              <strong>سرویس نامِ گوینده را نگرفته است.</strong>{" "}
              {(sample.duplicates || []).map((set) => set.join("، ")).join(" · ")} —
              فایلِ این‌ها بایت‌به‌بایت یکی است، و دو صدای مختلف نمی‌توانند یک جمله را یکسان
              بخوانند. پس هرچه انتخاب کنی، سرویس همان صدای پیش‌فرضِ خودش را می‌دهد؛ ما نام را
              درست فرستاده‌ایم و زیرِ هر ردیف، در کادرِ پاسخ، دیده می‌شود. این را به
              پشتیبانیِ ایویرا بگو.
            </div>
          )}

          {sample.items.length > 0 && (
            <div className="files" style={{ marginTop: 14 }}>
              {sample.items.map((item) => {
                const voice = (config.voices || []).find((v) => v.name === item.speaker);
                const chosen = config.speaker === item.speaker
                  && Number(config.speed) === Number(item.speed);
                return (
                  <div key={item.key} className="file sample">
                    <span style={{ minWidth: 150 }}>
                      <strong>{voice ? voice.label : item.speaker}</strong>{" "}
                      <span className="tag">{voice ? voice.gender === "male" ? "مرد" : "زن" : ""}</span>{" "}
                      <span className="key">سرعت {item.speed}</span>
                    </span>
                    {item.state === "آماده" ? (
                      <>
                        <span>
                          <audio controls src={`/api/audio/${item.key}?t=${item.hash || 0}`} />
                          <div className="key" style={{ marginTop: 2 }}>
                            {fa(item.bytes)} بایت · اثرِ انگشت {item.hash}
                            {(sample.duplicates || []).some((set) =>
                              set.includes(item.speaker) || set.includes(`${item.speaker}@${item.speed}`))
                              && <span className="tag" style={{ marginInlineStart: 6 }}>تکراری</span>}
                          </div>
                        </span>
                        <button className="tiny" disabled={chosen}
                                onClick={async () => {
                                  const next = await api("/diag/sample/pick", { method: "POST",
                                    body: JSON.stringify({ speaker: item.speaker, speed: item.speed }) });
                                  setConfig(next);
                                  setForm((old) => ({ ...old, ...next }));
                                }}>
                          {chosen ? "✓ همین است" : "همین"}
                        </button>
                      </>
                    ) : (
                      <span className={item.error ? "err" : "note"} style={{ margin: 0 }}>
                        {item.error ? `${item.state} — ${item.error}` : item.state}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {sample.items.some((i) => i.reply) && (
            <details style={{ marginTop: 12 }}>
              <summary className="note" style={{ cursor: "pointer" }}>
                پاسخِ خامِ سرویس برای هر نمونه — ببین نام را تحویل گرفته یا نه
              </summary>
              <pre style={{ direction: "ltr", textAlign: "left", whiteSpace: "pre-wrap",
                            fontSize: 11, background: "#faf7f2", padding: 9, borderRadius: 8,
                            maxHeight: 260, overflow: "auto" }}>
                {sample.items.filter((i) => i.reply)
                  .map((i) => `speaker=${i.speaker} speed=${i.speed}\n${i.reply}`).join("\n\n")}
              </pre>
            </details>
          )}
        </div>
      )}

      {tab === "notifications" && (
        <div className="card">
          <h2>📢 خبرهای برنامه</h2>
          <p className="note">
            خبر همین‌جا نوشته می‌شود، با «انتشار» روی هاست می‌رود، و اپ آن را از همان‌جا
            می‌خواند — هم وقتی باز است و هم در پس‌زمینه. هیچ سرویسِ پوشی در کار نیست.
          </p>

          <div className="card" style={{ borderColor: noticeKey.hasPrivate ? "#3e9e7a" : "#c0392b" }}>
            <b>🔑 مُهرِ خبرها {noticeKey.hasPrivate ? "— ساخته شده" : "— هنوز ساخته نشده"}</b>
            <p style={{ margin: "8px 0", lineHeight: 1.9 }}>
              فایلِ خبرها روی هاستِ اشتراکی و روی http ساده می‌نشیند. هرکس آن هاست را بگیرد
              می‌تواند عوضش کند — و بدونِ امضا یعنی مستقیم روی صفحه‌ی هر کودکی که اپ را دارد
              می‌نویسد. پس همین‌جا امضا می‌شود و اپ هرچه را نتواند تأیید کند
              <b> اصلاً نشان نمی‌دهد</b>. نیمه‌ی خصوصیِ کلید فقط روی همین سیستم می‌ماند؛
              نیمه‌ی عمومی در <code>app/src/main/assets/notice-key.pub</code> نوشته می‌شود —
              آن را کامیت کن و یک بیلدِ تازه بده.
            </p>
            {!noticeKey.hasPrivate && (
              <button className="go" onClick={async () => {
                const out = await api("/notices/key", { method: "POST", body: "{}" });
                setNoticeKey(out);
                alert("کلید ساخته شد.\n\nحالا app/src/main/assets/notice-key.pub را کامیت کن "
                  + "و یک بیلدِ تازه بده — تا آن نسخه روی گوشی نرود، خبرها نمایش داده نمی‌شوند.");
              }}>🔑 ساختِ کلید امضا</button>
            )}
            {noticeKey.hasPrivate && !noticeKey.assetExists && (
              <p style={{ color: "#c0392b" }}>
                ⚠ کلید هست ولی <code>assets/notice-key.pub</code> سرِ جایش نیست — بدونِ آن اپ
                هیچ خبری را قبول نمی‌کند.
              </p>
            )}
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <b>✨ نسخه‌ی برنامه</b>
            <p className="note" style={{ marginTop: 6 }}>
              اپ خودش را با این مقایسه می‌کند و اگر عقب بود، روی صفحه‌ی نقشه یک بار در روز
              پیشنهادِ دانلود می‌دهد. <b>داخلِ همان فایلِ امضاشده می‌رود</b> — لینکِ دانلود
              خطرناک‌ترین چیزی است که می‌شود به اپ گفت، پس امضای خبرها آن را هم می‌پوشاند.
              خالی بگذار تا چیزی درباره‌ی نسخه گفته نشود.
            </p>
            <div className="grid2">
              <div>
                <label>نسخه</label>
                <input type="text" placeholder="مثلاً ۱.۳۰.۰ → 1.30.0" value={appVersion.version}
                       onChange={(e) => setAppVersion({ ...appVersion, version: e.target.value })} />
              </div>
              <div>
                <label>لینکِ دانلود</label>
                <input type="text" placeholder="https://…/hoohoo-math.apk" value={appVersion.url}
                       onChange={(e) => setAppVersion({ ...appVersion, url: e.target.value })} />
              </div>
              <div>
                <label>چه چیزی تازه شده (اختیاری)</label>
                <input type="text" value={appVersion.note}
                       onChange={(e) => setAppVersion({ ...appVersion, note: e.target.value })} />
              </div>
            </div>
            <button className="go ghost" style={{ marginTop: 10 }} onClick={async () => {
              await api("/notices/app-version", { method: "POST", body: JSON.stringify(appVersion) });
              alert("ذخیره شد. با «انتشار روی هاست» به اپ‌ها می‌رسد.");
            }}>💾 ذخیره‌ی نسخه</button>
          </div>

          <h3 style={{ marginTop: 20 }}>{notifForm.id ? "✏️ ویرایشِ خبر" : "✍️ خبرِ تازه"}</h3>
          <div className="grid2">
            <div>
              <label>عنوان</label>
              <input type="text" placeholder="مثلاً: آزمون آنلاین پنج‌شنبه" value={notifForm.title}
                     onChange={(e) => setNotifForm({ ...notifForm, title: e.target.value })} />
            </div>
            <div>
              <label>متن</label>
              <input type="text" placeholder="چند کلمه که کودک و والد بخوانند" value={notifForm.body}
                     onChange={(e) => setNotifForm({ ...notifForm, body: e.target.value })} />
            </div>
            <div>
              <label>🖼 عکس (اختیاری)</label>
              <input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return setNotifForm({ ...notifForm, imageName: "", imageBase64: "" });
                const reader = new FileReader();
                reader.onload = () => setNotifForm({
                  ...notifForm, imageName: file.name, imageBase64: String(reader.result),
                });
                reader.readAsDataURL(file);
              }} />
              <span className="muted" style={{ fontSize: 11 }}>
                {notifForm.imageName ? `انتخاب شد: ${notifForm.imageName}`
                  : notifForm.image ? `عکسِ فعلی: ${notifForm.image}` : "کنارِ خبر آپلود می‌شود"}
              </span>
            </div>
            <div>
              <label>🔗 لینک (اختیاری)</label>
              <input type="text" placeholder="https://…" value={notifForm.link}
                     onChange={(e) => setNotifForm({ ...notifForm, link: e.target.value })} />
            </div>
            <div>
              <label>📍 کجای برنامه باز شود</label>
              <select value={notifForm.screen}
                      onChange={(e) => setNotifForm({ ...notifForm, screen: e.target.value })}>
                <option value="">هیچ‌جا — فقط متن، روی صفحه‌ی نقشه</option>
                <option value="ANYWHERE">⚡ هر جای برنامه بود — همان‌جا نشانش بده</option>
                <option value="ONLINE_EXAM">آزمون آنلاین</option>
                <option value="WORKSHEET_DOWNLOAD">دانلود کاربرگ</option>
                <option value="EXAM_INDEX">آزمون‌ها</option>
                <option value="SECTIONS">تمرین بخش‌ها</option>
                <option value="PAYWALL">نسخه‌ی کامل</option>
                <option value="MAP">نقشه</option>
              </select>
              <span className="muted" style={{ fontSize: 11 }}>
                خبرِ معمولی تا وقتی کودک به صفحه‌ی نقشه برگردد صبر می‌کند — وسطِ درس مزاحمش
                نمی‌شود. «⚡ هر جای برنامه» صبر نمی‌کند؛ برای چیزی مثل «آزمون ده دقیقه‌ی دیگر
                شروع می‌شود» که به‌دردِ کسی که یک ساعت دیگر سر بلند می‌کند نمی‌خورد.
              </span>
            </div>
            <div>
              <label>📅 از کِی دیده شود (اختیاری)</label>
              <ShamsiPicker value={notifForm.from}
                            onChange={(ms) => setNotifForm({ ...notifForm, from: ms })}
                            placeholder="از همین حالا" />
            </div>
            <div>
              <label>⏳ تا کِی معتبر است (اختیاری)</label>
              <ShamsiPicker value={notifForm.until}
                            onChange={(ms) => setNotifForm({ ...notifForm, until: ms })}
                            placeholder="بدونِ انقضا" />
              <span className="muted" style={{ fontSize: 11 }}>
                بعد از این لحظه نمایش داده نمی‌شود. برای آزمون، لحظه‌ی شروعِ آزمون را بگذار:
                گوشی‌ای که دیر وصل شود اصلاً خبرِ ازدست‌رفته را نمی‌بیند.
              </span>
            </div>
          </div>

          <div className="row" style={{ marginTop: 14, gap: 12 }}>
            <button className="go" disabled={!notifForm.title} onClick={async () => {
              await api("/notices", { method: "POST", body: JSON.stringify(notifForm) });
              setNotices((await api("/notices")).notices || []);
              setNotifForm(emptyNotice);
            }}>{notifForm.id ? "💾 ذخیره‌ی ویرایش" : "➕ افزودن به فهرست"}</button>
            {notifForm.id && (
              <button className="go ghost" onClick={() => setNotifForm(emptyNotice)}>انصراف</button>
            )}
          </div>

          <div className="row" style={{ marginTop: 20, justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>📋 فهرستِ خبرها ({fa(notices.length)})</h3>
            <button className="go" disabled={!noticeKey.hasPrivate} onClick={async () => {
              const out = await api("/notices/publish", { method: "POST" });
              alert(`منتشر شد: ${out.notices} خبر، ${out.pictures} عکس.\n`
                + "اپ‌ها در اولین چکِ بعدی می‌بینندشان.");
            }}>🌐 انتشار روی هاست</button>
          </div>
          <p className="note">
            تا این دکمه زده نشود هیچ اپی چیزی نمی‌بیند — فهرستِ بالا فقط روی همین سیستم است.
          </p>

          <div style={{ marginTop: 10 }}>
            {!notices.length && <p className="muted">هنوز خبری نوشته نشده.</p>}
            {notices.map((item) => (
              <div key={item.id} className="row" style={{
                justifyContent: "space-between", alignItems: "center", gap: 10,
                padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                <div style={{ flex: 1 }}>
                  <b>{item.title}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{item.body}</div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {item.image ? "🖼 عکس · " : ""}
                    {item.link ? "🔗 لینک · " : ""}
                    {item.screen ? `📍 ${item.screen} · ` : ""}
                    {item.until ? `تا ${spell(item.until)}` : "بدونِ انقضا"}
                  </div>
                </div>
                <button className="go tiny ghost"
                        onClick={() => setNotifForm({ ...emptyNotice, ...item })}>ویرایش</button>
                <button className="warn tiny" onClick={async () => {
                  if (!confirm(`«${item.title}» پاک شود؟`)) return;
                  await api(`/notices/${item.id}`, { method: "DELETE" });
                  setNotices((await api("/notices")).notices || []);
                  // the form must not keep the deleted one's id, or the next «add» reuses it
                  if (notifForm.id === item.id) setNotifForm(emptyNotice);
                }}>حذف</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "exam" && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>🏆 آزمون‌های آنلاین <span className="hint">{fa(examList.length)} آزمون</span></h2>
            <button className="go" onClick={() => openExamDlg(null)}>➕ آزمونِ تازه</button>
          </div>
          <p className="note">
            هر آزمون یک موضوع دارد (مثلاً «کسرها» یا «ضرب»). همه‌ی آزمون‌های فعال با هم روی هاست
            می‌روند و اپ همه را در یک فهرست نشان می‌دهد — آزمونی که نمی‌خواهی دیده شود را غیرفعال کن، بعد
            در تبِ «اعلان‌ها» دکمه‌ی «🌐 انتشار روی هاست» را بزن.
          </p>

          {!examList.length && <p className="muted">هنوز آزمونی ساخته نشده — «آزمونِ تازه» را بزن.</p>}

          <div style={{ marginTop: 10 }}>
            {examList.map((ex) => (
              <div key={ex.id} className="row" style={{
                justifyContent: "space-between", alignItems: "center", gap: 10,
                padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                <div style={{ flex: 1 }}>
                  <b>{ex.active ? "✅ " : ""}{ex.title || "(بدون عنوان)"}</b>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {ex.subject ? `موضوع: ${ex.subject} · ` : ""}
                    {`${fa((ex.questions || []).length)} سؤال`}
                    {ex.shamsiDate ? ` · ${ex.shamsiDate}` : ""}
                    {ex.time ? ` ساعت ${ex.time}` : ""} ·
                    {ex.active ? " فعال" : " غیرفعال"}
                  </div>
                </div>
                <button className="tiny ghost" onClick={async () => {
                  try {
                    const res = await api("/exam", { method: "POST",
                      body: JSON.stringify({ id: ex.id, active: !ex.active }) });
                    setExamList(res.exams || []);
                  } catch (err) { setError(err.message); }
                }}>{ex.active ? "⏸ غیرفعال کن" : "▶ فعال کن"}</button>
                <button className="go tiny ghost" onClick={() => openExamDlg(ex)}>ویرایش</button>
                <button className="warn tiny" onClick={async () => {
                  if (!confirm(`«${ex.title || ex.id}» پاک شود؟`)) return;
                  const res = await api(`/exam/${ex.id}`, { method: "DELETE" });
                  setExamList(res.exams || []);
                }}>حذف</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "exam" && examDlg && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          padding: "24px 12px", overflowY: "auto" }} onClick={() => setExamDlg(false)}>
          <div className="card" style={{ width: "min(720px, 100%)", maxHeight: "90vh", overflowY: "auto" }}
               onClick={(e) => e.stopPropagation()}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>{examId ? "✏️ ویرایشِ آزمون" : "➕ آزمونِ تازه"}</h2>
            <button className="tiny ghost" onClick={() => setExamDlg(false)}>✕ بستن</button>
          </div>

          <div className="grid" style={{ marginTop: 12, marginBottom: 16 }}>
            <div>
              <label>وضعیت آزمون</label>
              <button className={examForm.active ? "go" : "warn"} onClick={() => setExamForm({ ...examForm, active: !examForm.active })}>
                {examForm.active ? "✅ فعال است — همین روی هاست می‌رود" : "⛔ غیرفعال"}
              </button>
            </div>
            <div>
              <label>عنوان آزمون</label>
              <input type="text" placeholder="مثلاً: آزمون آنلاین ریاضی سوم" value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} />
            </div>
            <div>
              <label>موضوع</label>
              <input type="text" placeholder="مثلاً: کسرها، ضرب، فصل ۴" value={examForm.subject} onChange={(e) => setExamForm({ ...examForm, subject: e.target.value })} />
            </div>
            <div>
              <label>⏱ تاریخ و لحظه‌ی برگزاری (شمسی)</label>
              <ShamsiPicker value={examForm.startsAt}
                            onChange={(ms) => setExamForm({ ...examForm, startsAt: ms })}
                            placeholder="تعیین نشده" />
              <span className="muted" style={{ fontSize: 11 }}>
                تاریخِ نمایشی، ساعت و فرم «۱۴۰۵/۰۸/۱۵» هر سه از همین یک لحظه ساخته می‌شوند؛
                اپ هم از روی همین تصمیم می‌گیرد ثبت‌نام نشان بدهد یا برگه را باز کند.
              </span>
            </div>
            <div>
              <label>مدت زمان (دقیقه)</label>
              <input type="number" value={examForm.durationMinutes} onChange={(e) => setExamForm({ ...examForm, durationMinutes: e.target.value })} />
            </div>
          </div>

          <div>
            <label>توضیحات آزمون</label>
            <textarea rows={2} style={{ width: "100%" }} value={examForm.description} onChange={(e) => setExamForm({ ...examForm, description: e.target.value })} />
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <label><strong>سوالات و گزینه‌ها (فرمت JSON)</strong></label>
              <button className="tiny ghost" onClick={() => {
                const promptText = `شما یک دستیار متخصص آموزش ریاضی سوم دبستان هستید.
من یک فایل PDF شامل سوالات و پاسخ‌های آزمون ریاضی سوم ابتدایی را به شما می‌دهم.
لطفاً تمام سوالات را بخوانید و خروجی را دقیقا به فرمت JSON زیر تولید کنید:

قواعد خروجی:
۱. تمام اعداد را به صورت فارسی بنویسید.
۲. گزینه درست را با پاسخ تشریحی مشخص کنید (index از صفر شروع می‌شود).
۳. برای سوالاتی که انیمیشن دارند یکی از انواع StageSpec.Kind زیر را تعیین کنید:
   - NUMBER_STAIRS (پله‌های عددی و الگو)
   - PLACE_VALUE (ارزش مکانی)
   - NUMBER_LINE (محور اعداد)
   - FRACTION_CIRCLE (کسر و دایره)
   - MULTIPLY_ARRAY (آرایه ضرب)
   - AREA_GRID (محیط و مساحت)
   - BAR_GRAPH (نمودار ستونی)
   - CLOCK (ساعت)
   - MONEY (سکه و اسکناس)

فرمت JSON:
[
  {
    "id": "q1",
    "title": "سوال ۱",
    "text": "متن سوال...",
    "options": ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"],
    "correctIndex": 0,
    "explanation": "توضیح پاسخ...",
    "stageSpec": { "kind": "NUMBER_STAIRS", "params": { "start": 2, "step": 2, "count": 4 } },
    "points": 10
  }
]`;
                navigator.clipboard.writeText(promptText);
                setPromptCopied(true);
                setTimeout(() => setPromptCopied(false), 3000);
              }}>{promptCopied ? "✓ پرامپت کلاد کپی شد!" : "📋 کپی پرامپت کلاد برای PDF"}</button>
            </div>

            <textarea rows={10} style={{ width: "100%", fontFamily: "monospace", fontSize: 12, marginTop: 6 }}
                      value={examForm.questionsJson}
                      onChange={(e) => setExamForm({ ...examForm, questionsJson: e.target.value })} />
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="go" onClick={async () => {
              try {
                const questions = JSON.parse(examForm.questionsJson || "[]");
                const res = await api("/exam", {
                  method: "POST",
                  body: JSON.stringify({
                    id: examId || undefined,
                    active: examForm.active,
                    title: examForm.title,
                    subject: examForm.subject,
                    description: examForm.description,
                    durationMinutes: examForm.durationMinutes,
                    questions,
                    startsAt: examForm.startsAt || 0,
                  })
                });
                setExamList(res.exams || []);
                setExamDlg(false);
                setExamId("");
                setExamData(null);
                setExamForm(emptyExam);
                // saving writes exam.json here; the host sees it only after «انتشار»
                alert("آزمون روی همین سیستم ذخیره شد.\n\n"
                  + "برای اینکه اپ‌ها ببینندش، در تبِ «اعلان‌ها» دکمه‌ی «🌐 انتشار روی هاست» را بزن.");
              } catch (err) {
                alert("خطا در ذخیره JSON سوالات: " + err.message);
              }
            }}>💾 ذخیره‌ی آزمون</button>
            <button className="ghost" onClick={() => setExamDlg(false)}>انصراف</button>
          </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="log-head">
          <h2 style={{ margin: 0 }}>لاگِ زنده</h2>
          <button className="tiny ghost" onClick={() => setShowLog(!showLog)}>
            {showLog ? "مخفی کن" : "نشان بده"}
          </button>
        </div>
        {showLog && (
          <div className="log" ref={logBox}>
            {log.length === 0 && <div className="t">— هنوز چیزی نیست —</div>}
            {log.map((entry, i) => (
              <div key={i}>
                <span className="t">[{entry.at.slice(11, 19)}]</span>{" "}
                <span className={entry.level}>{entry.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {tab === "studio" && (
        <div className="card">
          <h2>🎧 جمله‌ها و پخش <span className="hint">{fa(shown.length)} از {fa(counts.total)}</span></h2>
          <div className="grid" style={{ marginBottom: 12 }}>
            <div>
              <label>جستجو در کلید یا متن</label>
              <input type="text" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
            </div>
            <div>
              <label>گروه</label>
              <select value={filter.group} onChange={(e) => setFilter({ ...filter, group: e.target.value })}>
                <option value="all">همه</option>
                {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label>فصل</label>
              <select value={filter.chapter} onChange={(e) => setFilter({ ...filter, chapter: e.target.value })}>
                <option value="all">همه</option>
                {chapters.map((c) => <option key={c} value={String(c)}>فصل {fa(c)}</option>)}
              </select>
            </div>
            <div>
              <label>وضعیت</label>
              <select value={filter.state} onChange={(e) => setFilter({ ...filter, state: e.target.value })}>
                <option value="all">همه</option>
                <option value="done">ساخته‌شده</option>
                <option value="todo">بی‌فایل</option>
              </select>
            </div>
          </div>

          <div className="files">
            {shown.length === 0 && <div className="empty">چیزی با این فیلتر پیدا نشد.</div>}
            {shown.slice(0, 400).map((l) => (
              <div className="file" key={l.key}>
                <span className="key">{l.key}{l.edited ? " ✎" : ""}</span>
                {editing?.key === l.key ? (
                  <span style={{ gridColumn: "2 / 4" }}>
                    <textarea rows={3} value={editing.spoken} style={{ width: "100%" }}
                              onChange={(e) => setEditing({ ...editing, spoken: e.target.value })} />
                    <span className="row" style={{ marginTop: 6 }}>
                      <button className="tiny go" disabled={busy}
                              onClick={() => saveText(l.key, editing.spoken)}>ذخیره‌ی متن</button>
                      <button className="tiny go" disabled={busy || status.running}
                              onClick={() => saveText(l.key, editing.spoken).then(() => generate([l.key], 0, true))}>
                        ذخیره و بساز از نو
                      </button>
                      <button className="tiny ghost" onClick={() => setEditing(null)}>بی‌خیال</button>
                      {l.edited && (
                        <button className="tiny ghost" disabled={busy} onClick={async () => {
                          await api(`/text/${l.key}`, { method: "DELETE" });
                          setEditing(null);
                          load();
                        }}>برگردان به متنِ درس</button>
                      )}
                    </span>
                  </span>
                ) : (
                  <>
                    <span className="say" title={config.useVowels ? l.spoken : l.written}>
                      {config.useVowels ? l.spoken : l.written}
                    </span>
                    <span className="row">
                      {/* the stamp changes when the clip is remade, so «از نو» is not answered
                          out of the browser's cache with the old recording */}
                      {l.done && <audio controls preload="none"
                                        src={`/api/audio/${l.key}?v=${l.stamp || l.size}`} />}
                      {status.current.includes(l.key)
                        ? <span className="tag">در حال ساخت…</span>
                        : l.done
                          ? <span className="tag done">{Math.round(l.size / 1024)}KB</span>
                          : <span className="tag">بی‌فایل</span>}
                      <button className="tiny ghost"
                              onClick={() => setEditing({ key: l.key, spoken: l.spoken })}>متن</button>
                      <button className="tiny go" disabled={busy || status.running || !config.tokenSet}
                              onClick={() => generate([l.key], 0, l.done)}>
                        {l.done ? "از نو" : "بساز"}
                      </button>
                      {l.done && (
                        <button className="tiny ghost" onClick={() => removeFile(l.key)}>پاک</button>
                      )}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
          {shown.length > 400 && <p className="note">۴۰۰ ردیفِ اول نشان داده شد — با فیلتر محدودترش کن.</p>}
        </div>
      )}
    </div>
  );
}
