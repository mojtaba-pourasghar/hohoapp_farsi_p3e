// Writing the two index files the app reads from the host.
//
// The clips and the worksheet PDFs are uploaded by hand to
//   http://mp-apdl.ir/grade-3/farsi/audio/     and  …/karbarg/
// and in each folder sits an index.json saying what is there. The app fetches that file first
// and then knows what it may download. Nothing here uploads anything — it only prepares the
// folders so the whole thing can be dragged across in one go.

import fs from "node:fs";
import path from "node:path";

export const AUDIO_BASE = "http://mp-apdl.ir/grade-3/farsi/audio/";
export const KARBARG_BASE = "http://mp-apdl.ir/grade-3/farsi/karbarg/";

const AUDIO_EXT = [".ogg", ".mp3", ".wav"];

/**
 * index.json for the narration: every clip in the output folder, keyed the way the app asks
 * for it. Written into the folder itself, so uploading the folder uploads the index with it.
 */
export function writeAudioIndex({ outDir, baseUrl = AUDIO_BASE, speaker = "", appAssets = null }) {
  if (!fs.existsSync(outDir)) throw new Error(`پوشه‌ی خروجی نیست: ${outDir}`);

  const files = {};
  let bytes = 0;
  for (const name of fs.readdirSync(outDir).sort()) {
    const ext = path.extname(name).toLowerCase();
    if (!AUDIO_EXT.includes(ext)) continue;
    // _test-…, _diag-…, _sample-… : the studio's own listening clips, never lesson narration.
    // No lesson key starts with an underscore, so one rule covers all of them — and keeps a
    // voice sample from being uploaded to the host as though هوهو said it in a lesson.
    if (name.startsWith("_")) continue;
    const size = fs.statSync(path.join(outDir, name)).size;
    if (size < 512) continue;
    files[path.basename(name, ext)] = name;
    bytes += size;
  }

  const index = {
    baseUrl: baseUrl.endsWith("/") ? baseUrl : baseUrl + "/",
    generatedAt: new Date().toISOString(),
    voice: speaker,
    count: Object.keys(files).length,
    bytes,
    files,
  };
  const json = JSON.stringify(index, null, 2);
  fs.writeFileSync(path.join(outDir, "index.json"), json, "utf8");

  // the app carries a copy so the first launch, before any network, knows the shape of things
  if (appAssets && fs.existsSync(path.dirname(appAssets))) {
    fs.writeFileSync(appAssets, json, "utf8");
  }
  return index;
}

/**
 * A folder name for a worksheet. It becomes part of a URL the app opens, so it stays ASCII:
 * a Persian title has no safe spelling in a path, and a half-encoded one is worse than a plain
 * «karbarg-<n>». The real title lives in info.json and in the index, which is what the app shows.
 */
export function slugify(title) {
  const ascii = String(title).trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 50);
  if (ascii) return ascii;

  let hash = 0;
  for (const ch of String(title)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return "karbarg-" + hash.toString(36);
}

/**
 * Two different worksheets can share one title — «کاربرگ شماره ۱» exists once per chapter —
 * while a folder name comes from the title alone. Writing into a folder that already holds a
 * different sheet would rewrite that sheet's info.json (its chapter included), so from the
 * teacher's side it looks deleted from its own chapter. The plain name is therefore reused
 * only when the folder already holds this very sheet (same title, same chapter — the teacher
 * re-adding it); otherwise the name grows a counter until a folder of its own is found.
 */
function freeSheetSlug(dir, base, title, chapter) {
  let slug = base;
  for (let n = 2; ; n++) {
    const folder = path.join(dir, slug);
    if (!fs.existsSync(folder)) return slug;
    const infoPath = path.join(folder, "info.json");
    if (!fs.existsSync(infoPath)) { slug = `${base}-${n}`; continue; } // a broken/foreign folder: not ours
    let prev = null;
    try { prev = JSON.parse(fs.readFileSync(infoPath, "utf8")); } catch { /* unreadable: not ours */ }
    if (prev && String(prev.title).trim() === title && Number(prev.chapter) === chapter) return slug;
    slug = `${base}-${n}`;
  }
}

/**
 * One worksheet: its own folder holding the PDF and an info.json describing it. The same shape
 * is uploaded to the host, so the app can show the title and the note without opening the PDF.
 */
export function addWorksheet({ dir, title, note = "", chapter = -1, order = null, fileName, data }) {
  if (!title || !String(title).trim()) throw new Error("عنوان لازم است");
  if (!data || !data.length) throw new Error("فایل خالی است");

  const cleanTitle = String(title).trim();
  const chap = chapter === null || chapter === undefined || chapter === ""
    ? -1 : Number.isFinite(Number(chapter)) ? Number(chapter) : -1;
  // an empty order must stay null («after the numbered ones»), never become 0: Number(null)
  // and Number("") are both 0, and a 0 would sort the sheet before every numbered one
  const ord = order === null || order === undefined || order === ""
    ? null : Number.isFinite(Number(order)) ? Number(order) : null;

  const slug = freeSheetSlug(dir, slugify(cleanTitle), cleanTitle, chap);
  const folder = path.join(dir, slug);
  fs.mkdirSync(folder, { recursive: true });

  // the only case the folder already has an info.json is the same sheet being re-added:
  // its old PDF gives way to the new one, so the folder never piles up two versions
  const infoPath = path.join(folder, "info.json");
  let prev = null;
  if (fs.existsSync(infoPath)) {
    try { prev = JSON.parse(fs.readFileSync(infoPath, "utf8")); } catch { /* replaced below */ }
  }

  const safeName = path.basename(String(fileName || "worksheet.pdf")).replace(/[^\w.\-]+/g, "_");
  const pdfName = safeName.toLowerCase().endsWith(".pdf") ? safeName : safeName + ".pdf";
  if (prev && prev.file && prev.file !== pdfName) {
    const oldPdf = path.join(folder, prev.file);
    if (fs.existsSync(oldPdf)) fs.unlinkSync(oldPdf);
  }
  fs.writeFileSync(path.join(folder, pdfName), data);

  const info = {
    title: cleanTitle,
    note: String(note || "").trim(),
    chapter: chap,
    // where the teacher wants it in the list; null means «after the numbered ones»
    order: ord,
    file: pdfName,
    bytes: data.length,
    addedAt: prev && prev.addedAt ? prev.addedAt : new Date().toISOString(),
  };
  fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), "utf8");
  return { slug, ...info };
}

export function listWorksheets(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const slug of fs.readdirSync(dir).sort()) {
    const folder = path.join(dir, slug);
    const infoPath = path.join(folder, "info.json");
    if (!fs.statSync(folder).isDirectory() || !fs.existsSync(infoPath)) continue;
    try {
      out.push({ slug, ...JSON.parse(fs.readFileSync(infoPath, "utf8")) });
    } catch {
      // a folder we cannot read is simply not listed
    }
  }
  return out;
}

/**
 * Changes a sheet that has already been added — its title, its note, its chapter, its place in
 * the list, and the PDF itself.
 *
 * The folder keeps its name even when the title changes. The folder name is part of the URL that
 * every installed copy has already cached, and renaming it would turn every sheet a child has
 * downloaded into a broken link to fix a word in a title.
 */
export function editWorksheet({ dir, slug, title, note, chapter, order, free, fileName, data }) {
  const folder = path.join(dir, slug);
  const infoPath = path.join(folder, "info.json");
  if (!fs.existsSync(infoPath)) throw new Error("چنین کاربرگی نیست");

  const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
  if (typeof title === "string" && title.trim()) info.title = title.trim();
  if (typeof note === "string") info.note = note.trim();
  if (chapter !== undefined && Number.isFinite(Number(chapter))) info.chapter = Number(chapter);
  if (order !== undefined) info.order = (order === null || order === "") ? null
    : Number.isFinite(Number(order)) ? Number(order) : null;
  if (free !== undefined) info.free = free === true;

  if (data && data.length) {
    // a replacement PDF takes the old one's place, name and all, so the URL does not move
    const keep = info.file;
    const safeName = path.basename(String(fileName || keep)).replace(/[^\w.\-]+/g, "_");
    const pdfName = safeName.toLowerCase().endsWith(".pdf") ? safeName : safeName + ".pdf";
    if (pdfName !== keep && fs.existsSync(path.join(folder, keep))) {
      fs.unlinkSync(path.join(folder, keep));
    }
    fs.writeFileSync(path.join(folder, pdfName), data);
    info.file = pdfName;
    info.bytes = data.length;
    info.changedAt = new Date().toISOString();
  }

  fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), "utf8");
  return { slug, ...info };
}

export function removeWorksheet(dir, slug) {
  const folder = path.join(dir, path.basename(slug));
  if (!fs.existsSync(folder)) return false;
  fs.rmSync(folder, { recursive: true, force: true });
  return true;
}

/** index.json for the worksheets: what the app reads to build its download list. */
export function writeWorksheetIndex({ dir, baseUrl = KARBARG_BASE }) {
  fs.mkdirSync(dir, { recursive: true });
  const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";

  // written in the order the teacher asked for, so the file reads the way the app will show it
  const ordered = listWorksheets(dir).sort((a, b) => {
    const ao = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
    const bo = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
    return ao !== bo ? ao - bo : String(a.slug).localeCompare(String(b.slug));
  });

  const sheets = ordered.map((sheet, i) => ({
    title: sheet.title,
    note: sheet.note,
    chapter: sheet.chapter,
    // numbered from where they sit, so the app needs no tie-break of its own to agree
    order: i + 1,
    free: sheet.free === true,
    file: `${sheet.slug}/${sheet.file}`,
    bytes: sheet.bytes,
  }));
  const index = { baseUrl: base, generatedAt: new Date().toISOString(), count: sheets.length, sheets };
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(index, null, 2), "utf8");
  return index;
}
