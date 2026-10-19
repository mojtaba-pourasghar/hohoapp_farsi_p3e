#!/usr/bin/env bash
# Does the build file still define everything it uses?
#
# Gradle is Groovy, and Groovy is dynamic: a build file that reads a name nobody defined is a
# perfectly good file right up until it runs. Android Studio says nothing, javac says nothing,
# and the first thing that notices is a CI run eight minutes later —
#   Could not get unknown property 'vMajor'
# — which is what happened when an edit took out a block and carried the version lines with it.
#
# So: every `def` in the file is collected, and every use of one of those names must come after
# its declaration. It only knows about names the file itself defines, which is exactly the class
# of mistake an edit makes; the Gradle DSL is left alone.
set -uo pipefail
cd "$(dirname "$0")/.."

python3 - "$@" <<'PY'
import re, sys, pathlib

files = sys.argv[1:] or ["build.gradle", "app/build.gradle", "settings.gradle"]
problems = []

# everything any of these files defines, so a name shared across them is not called missing
all_declared = set()
for name in files:
    path = pathlib.Path(name)
    if not path.exists():
        continue
    body = path.read_text(encoding="utf-8")
    all_declared |= set(re.findall(r"\bdef\s+([A-Za-z_]\w*)\s*=", body))
    for group in re.findall(r"\bdef\s*\(([^)]*)\)\s*=", body):
        all_declared |= {x.strip() for x in group.split(",")}

for name in files:
    path = pathlib.Path(name)
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    # `def thing = …` and `def (a, b, c) = …`
    declared = {}
    for i, line in enumerate(lines):
        single = re.match(r"\s*def\s+([A-Za-z_]\w*)\s*=", line)
        if single:
            declared.setdefault(single.group(1), i)
        group = re.match(r"\s*def\s*\(([^)]*)\)\s*=", line)
        if group:
            for part in group.group(1).split(","):
                declared.setdefault(part.strip(), i)

    for word, where in declared.items():
        uses = [i for i, line in enumerate(lines)
                if re.search(r"(?<![\w.$])" + re.escape(word) + r"(?![\w])", line)
                and i != where]
        if not uses:
            continue
        early = [i for i in uses if i < where]
        if early:
            problems.append(f"{name}:{early[0] + 1}: «{word}» پیش از تعریفش استفاده شده")

    # and the other way round: a name used as a *value* that nothing ever defines.
    #
    # Telling `vMajor` from `compileSdk` is the whole trick. A Gradle DSL name heads a statement
    # («compileSdk 34») or hangs off a dot; a local is read as an operand — after an `=`, around
    # an arithmetic sign, inside a call. So only operands are judged, and only ones the files
    # themselves never declare.
    dsl = {
        "file", "files", "rootProject", "project", "System", "JavaVersion", "getDefaultProguardFile",
        "signingConfigs", "buildTypes", "logger", "android", "dependencies", "implementation",
        "plugins", "id", "apply", "true", "false", "null", "it", "this", "def", "new", "return",
        "repositories", "google", "mavenCentral", "gradlePluginPortal", "include", "set",
    }
    operand = re.compile(r"(?:[=(,?:+\-/*]\s*|\b(?:versionCode|versionName|signingConfig)\s+)"
                         r"([a-z][A-Za-z0-9]*)\b")
    for i, line in enumerate(lines):
        # strings first: 'androidx.appcompat:appcompat:1.7.0' is a coordinate, not a variable,
        # and ':app' is a project path. Nothing inside quotes is a name.
        code = re.sub(r"'[^']*'|\"[^\"]*\"", "''", line.split("//")[0])
        for word in operand.findall(code):
            if word in declared or word in dsl or word in all_declared:
                continue
            problems.append(f"{name}:{i + 1}: «{word}» خوانده می‌شود ولی هیچ‌جا تعریف نشده")

if problems:
    print("\n".join(problems))
    print()
    print("فایلِ بیلد چیزی را می‌خواند که تعریف نشده — بالا را ببین.")
    sys.exit(1)

print(f"gradle files define what they use ({len(files)} files)")
PY
