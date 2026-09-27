#!/usr/bin/env python3
"""Turns project/lessons/cNN.txt (the page lessons of one درس) into data/Chapter<N>Pages.java.

Edit the text files, not the generated Java. One step is a block of short lines:

    == 12 0 محلّه‌ی ما (آغاز داستان)   a new page: printed page, section, and a note for readers
    T caption                           TEACH  (M = MCQ, P = TAP on a picture, N = NUM, D = DONE)
    > what هوهو says                    (several «>» lines are joined with a space)
    + the «یک مثال دیگر» line           (TEACH only; optional)
    ~ bg park                           one scene line each (see data/Scene.java)
    o *the right option                 MCQ options; the one starting with * is right
    @ 2 3                               P: the pictures that count as right; N: the answer
    ! feedback after a right answer     (M, P, N)

Keys are made from the page and the step's place on it: t012_01, t012_02 … and the example of a
step is its key plus «x». Blank lines and lines starting with # are ignored.

    python3 tools/make_pages.py          # every project/lessons/c*.txt
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "project/lessons")
OUT = os.path.join(ROOT, "app/src/main/java/com/hoohoofarsi/app/data")
KINDS = {"T": "teach", "M": "mcq", "P": "pick", "N": "num", "D": "done"}


def js(text):
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def fail(path, n, msg):
    sys.exit("%s:%d: %s" % (os.path.relpath(path, ROOT), n, msg))


def parse(path):
    pages, page, step = [], None, None
    for n, raw in enumerate(open(path, encoding="utf-8"), 1):
        line = raw.rstrip("\n").strip()
        if not line or line.startswith("#"):
            continue
        tag, rest = line[:2].strip(), line[2:].strip() if len(line) > 2 else ""
        if line.startswith("=="):
            m = re.match(r"==\s*(\d+)\s+(\d+)\s*(.*)$", line)
            if not m:
                fail(path, n, "page line is «== page section note»")
            page = {"page": int(m.group(1)), "section": int(m.group(2)), "note": m.group(3), "steps": []}
            pages.append(page)
            step = None
        elif tag in KINDS and (len(line) == 1 or line[1] == " "):
            if page is None:
                fail(path, n, "step before the first page")
            step = {"kind": KINDS[tag], "caption": rest, "say": [], "example": [], "scene": [],
                    "options": [], "answer": None, "why": [], "line": n}
            page["steps"].append(step)
        elif step is None:
            fail(path, n, "text outside a step")
        elif tag == ">":
            step["say"].append(rest)
        elif tag == "+":
            step["example"].append(rest)
        elif tag == "~":
            step["scene"].append(rest)
        elif tag == "o":
            step["options"].append(rest)
        elif tag == "@":
            step["answer"] = rest
        elif tag == "!":
            step["why"].append(rest)
        else:
            fail(path, n, "unknown line: " + line)
    return pages


def step_java(path, chapter_page, index, st):
    key = "t%03d_%02d" % (chapter_page, index)
    say = " ".join(st["say"])
    if not say:
        fail(path, st["line"], key + ": nothing to say")
    cap = st["caption"]
    scene = ("scene(" + ",\n                    ".join(js(s) for s in st["scene"]) + ")") if st["scene"] else "StageSpec.NONE"
    why = " ".join(st["why"])
    k = st["kind"]
    if k == "teach":
        out = "LessonStep.teach(%s,\n                %s,\n                %s,\n                %s)" % (js(key), js(say), js(cap), scene)
        if st["example"]:
            out += "\n                .withExample(%s,\n                    %s)" % (js(key + "x"), js(" ".join(st["example"])))
        return out
    if st["example"]:
        fail(path, st["line"], key + ": only a TEACH step has an example")
    if k == "done":
        return "LessonStep.done(%s,\n                %s,\n                %s)" % (js(key), js(say), js(cap))
    if not why:
        fail(path, st["line"], key + ": no «!» feedback")
    if k == "mcq":
        opts = st["options"]
        right = [i for i, o in enumerate(opts) if o.startswith("*")]
        if len(opts) < 2 or len(right) != 1:
            fail(path, st["line"], key + ": an MCQ needs options and exactly one «*»")
        opts = [o.lstrip("*").strip() for o in opts]
        return "LessonStep.mcq(%s,\n                %s,\n                %s,\n                %s,\n                Arrays.asList(%s), %d,\n                %s)" % (
            js(key), js(say), js(cap), scene, ", ".join(js(o) for o in opts), right[0], js(why))
    if k == "pick":
        if not st["answer"] or not st["scene"]:
            fail(path, st["line"], key + ": a pick needs a scene and «@ picture numbers»")
        return "LessonStep.pick(%s,\n                %s,\n                %s,\n                %s,\n                on(%s),\n                %s)" % (
            js(key), js(say), js(cap), scene, ", ".join(st["answer"].split()), js(why))
    if k == "num":
        if not st["answer"]:
            fail(path, st["line"], key + ": a num step needs «@ answer»")
        return "LessonStep.num(%s,\n                %s,\n                %s,\n                %s,\n                %s,\n                %s)" % (
            js(key), js(say), js(cap), scene, js(st["answer"]), js(why))
    raise AssertionError(k)


def build(path):
    n = int(re.search(r"c(\d+)\.txt$", path).group(1))
    title = ""
    first = open(path, encoding="utf-8").readline()
    if first.startswith("#"):
        title = first.lstrip("#").strip()
    pages = parse(path)
    body = []
    for p in pages:
        if not p["steps"] or p["steps"][-1]["kind"] != "done":
            fail(path, 0, "page %d does not end with a D step" % p["page"])
        steps = ",\n            ".join(step_java(path, p["page"], i, st) for i, st in enumerate(p["steps"], 1))
        body.append("        // ── صفحه‌ی %d — %s ──\n        BY_PAGE.put(%d, new LessonScript(%d, %d, %d, Arrays.asList(\n            %s\n        )));\n"
                    % (p["page"], p["note"], p["page"], n - 1, p["section"], p["page"], steps))
    src = """package com.hoohoofarsi.app.data;

import static com.hoohoofarsi.app.data.LessonStep.on;
import static com.hoohoofarsi.app.data.StageSpec.scene;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * %s
 * Generated from project/lessons/c%02d.txt by tools/make_pages.py — edit the text file, not this one.
 */
public final class Chapter%dPages {
    private Chapter%dPages() {}

    private static final Map<Integer, LessonScript> BY_PAGE = new LinkedHashMap<>();

    static {
%s    }

    public static LessonScript forPage(int page) {
        return BY_PAGE.get(page);
    }

    public static List<Integer> pages() {
        return new java.util.ArrayList<>(BY_PAGE.keySet());
    }
}
""" % (title, n, n, n, "\n".join(body))
    with open(os.path.join(OUT, "Chapter%dPages.java" % n), "w", encoding="utf-8") as f:
        f.write(src)
    return len(pages), sum(len(p["steps"]) for p in pages)


def main():
    for path in sorted(glob.glob(os.path.join(SRC, "c*.txt"))):
        pages, steps = build(path)
        print("%s: %d pages, %d steps" % (os.path.basename(path), pages, steps))


if __name__ == "__main__":
    main()
