// Reading res/raw/audio_manifest.txt — the one source of what هوهو says.
//
// Every line is «key | the words on screen | the words as they are said». The third column is
// what gets recorded: numbers and symbols already written out, every word given its vowels.

import fs from "node:fs";
import path from "node:path";

const GROUPS = [
  { id: "pages", test: (k) => /^[pt]\d{3}_/.test(k), label: "کتاب، صفحه به صفحه" },
  { id: "sections", test: (k) => k.startsWith("ch"), label: "خلاصه‌ی بخش‌ها" },
  { id: "numbers", test: (k) => k.startsWith("n_") || k === "va", label: "واژه‌های عددی" },
  { id: "phrases", test: (k) => k.startsWith("q_"), label: "تکه‌های سؤال" },
];

function groupOf(key) {
  return (GROUPS.find((g) => g.test(key)) || { id: "other" }).id;
}

/** درس number from a key, for the «درس» filter: ch3_s1_04 → 3, t045_02 → by page. */
function chapterOf(key) {
  const section = key.match(/^ch(\d+)_/);
  if (section) return Number(section[1]);
  const page = key.match(/^[pt](\d{3})_/);
  if (!page) return null;
  const n = Number(page[1]);
  // the pages of each درس, as data/Book.java has them (ستایش on page 10 belongs to درس ۱)
  const bounds = [[10, 19, 1], [20, 28, 2], [29, 35, 3], [36, 44, 4], [45, 49, 5], [50, 55, 6],
                  [56, 64, 7], [65, 71, 8], [72, 78, 9], [79, 85, 10], [86, 92, 11], [93, 97, 12],
                  [98, 101, 13], [102, 108, 14], [109, 113, 15], [114, 119, 16], [120, 128, 17]];
  return bounds.find(([from, to]) => n >= from && n <= to)?.[2] ?? null;
}

export function readManifest(manifestPath) {
  const text = fs.readFileSync(manifestPath, "utf8");
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("|")) continue;
    const cols = line.split("|").map((c) => c.trim());
    const [key, written] = cols;
    const spoken = cols[2] && cols[2].length ? cols[2] : written;
    if (!key || !written) continue;
    lines.push({ key, written, spoken, group: groupOf(key), chapter: chapterOf(key) });
  }
  return lines;
}

/** Which keys already have a file in the output directory, whatever the extension. */
export function existingKeys(outDir) {
  const done = new Map();
  if (!outDir || !fs.existsSync(outDir)) return done;
  for (const name of fs.readdirSync(outDir)) {
    const ext = path.extname(name).toLowerCase();
    if (![".ogg", ".mp3", ".wav"].includes(ext)) continue;
    const full = path.join(outDir, name);
    let size = 0;
    try {
      size = fs.statSync(full).size;
    } catch {
      continue;
    }
    // a near-empty file is the wreck of a failed attempt, not a recording
    if (size < 512) continue;
    done.set(path.basename(name, ext), { name, size });
  }
  return done;
}

export const GROUP_LABELS = Object.fromEntries(GROUPS.map((g) => [g.id, g.label]));
