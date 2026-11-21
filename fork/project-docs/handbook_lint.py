#!/usr/bin/env python3
"""Lint for the On-Site SEO + GEO Reference (run before every release).

Usage:  python3 handbook_lint.py <core.md> [archive.md]
Checks: section order · § references · JSON-LD blocks parse · robots.txt template group test
        (needs `pip install protego`; skipped with a note if missing) · §41 item format ·
        retired threshold wording · version consistency · archive companion.
Exit code 1 on any FAIL.
"""
import json
import os
import re
import sys

LAST_SECTION = 41
core_path = sys.argv[1]
arch_path = sys.argv[2] if len(sys.argv) > 2 else None
text = open(core_path, encoding="utf-8").read()
lines = text.split("\n")
fails, notes, oks = [], [], []


def fenced_blocks(src_lines):
    """Line-based fence parser (handles indented fences)."""
    out, cur, lang = [], None, ""
    for l in src_lines:
        s = l.strip()
        if s.startswith("```"):
            if cur is None:
                cur, lang = [], s[3:].strip()
            else:
                out.append((lang, "\n".join(cur)))
                cur = None
        elif cur is not None:
            cur.append(l)
    return out


# 1. section order
nums = [int(m.group(1)) for m in re.finditer(r"^## (\d+)\. ", text, re.M)]
if nums == list(range(1, LAST_SECTION + 1)):
    oks.append(f"sections 1–{LAST_SECTION} present, in order")
else:
    fails.append(f"section headings out of order or missing: {nums}")

# 2. § references
bad = sorted({int(n) for n in re.findall(r"§(\d+)", text) if int(n) > LAST_SECTION})
(fails if bad else oks).append(f"§ references above {LAST_SECTION}: {bad}" if bad else "all § references resolve")

# 3. JSON-LD
blocks = fenced_blocks(lines)
jb = [b for lang, b in blocks if lang == "json"]
bad_json = []
for k, b in enumerate(jb, 1):
    try:
        json.loads(b)
    except Exception as e:  # noqa: BLE001
        bad_json.append(f"json block {k}: {e}")
(fails.extend(bad_json) if bad_json else oks.append(f"{len(jb)} JSON-LD blocks parse"))

# 4. robots template group test
robots = [b for lang, b in blocks if "User-agent: Googlebot" in b and "Sitemap:" in b]
if len(robots) != 1:
    fails.append(f"robots template blocks found: {len(robots)} (expected 1)")
else:
    try:
        from protego import Protego  # type: ignore

        rp = Protego.parse(robots[0])
        named = re.findall(r"^User-agent: (\S+)$", robots[0], re.M)
        named = [n for n in named if n != "*"]
        agents = named + ["SomeUnlistedBot"]
        blocked = ["/account", "/account/", "/account?x=1", "/cart", "/cart/", "/cart?x=1", "/checkout",
                   "/checkout/step", "/search?q=a", "/api/items", "/list?sort=price", "/list?color=red&sort=price",
                   "/list?filter=a", "/list?a=1&filter=b"]
        allowed = ["/", "/products/widget", "/cartography", "/accounting", "/list?page=2", "/topics/x"]
        mism = []
        for ua in agents:
            for p in blocked:
                if rp.can_fetch("https://yoursite.com" + p, ua):
                    mism.append(f"{ua} can fetch {p}")
            for p in allowed:
                if not rp.can_fetch("https://yoursite.com" + p, ua):
                    mism.append(f"{ua} blocked from {p}")
        if mism:
            fails.append(f"robots group test: {len(mism)} mismatches, e.g. {mism[:5]}")
        else:
            oks.append(f"robots template: {len(named)} named + 1 unlisted agent × {len(blocked) + len(allowed)} paths, 0 mismatches")
        # Group B must stay commented out
        if re.search(r"^Disallow: /$", robots[0], re.M):
            fails.append("robots template: an active 'Disallow: /' group exists (Group B must be commented)")
    except ImportError:
        notes.append("robots group test skipped: pip install protego")

# 5. §41 items
m41 = re.search(r"^## 41\. .*?$(.*)", text, re.M | re.S)
items = [l for l in (m41.group(1).split("\n") if m41 else []) if l.startswith("- [ ]")]
tag_re = re.compile(r"\[(T1\+|T2\+|T3\+|T4|AUDIT|REVIEW|gate: [^\]]+)\]")
bad_items = [l[:90] for l in items if not tag_re.search(l) or "§" not in l]
dups = sorted({l[:90] for l in items if items.count(l) > 1})
if bad_items:
    fails.append(f"§41 items without tag or § reference: {bad_items}")
if dups:
    fails.append(f"§41 duplicate items: {dups}")
if not bad_items and not dups:
    oks.append(f"§41: {len(items)} items, each tagged and referenced")

# 6. retired threshold wording
retired = [p for p in (r"LCP < 2\.5", r"CLS < 0\.1", r"INP < 200", r"TTFB < 500ms\.$") if re.search(p, text, re.M)]
# the archive may quote them; the core must not state them as rules outside §38
(notes if retired else oks).append(
    f"retired threshold wording present (check it is quoted, not stated): {retired}" if retired
    else "no retired threshold wording")

# 7. version consistency
v_head = re.search(r"^Version: ([\d.]+)", text, re.M)
v_tpl = re.search(r"^handbook: ([\d.]+) \|", text, re.M)
if v_head and v_tpl and v_head.group(1) == v_tpl.group(1):
    oks.append(f"version {v_head.group(1)} in header and status template")
else:
    fails.append(f"version mismatch: header {v_head and v_head.group(1)} vs template {v_tpl and v_tpl.group(1)}")

# 8. archive companion
if arch_path:
    a = open(arch_path, encoding="utf-8").read()
    name = os.path.basename(arch_path)
    if name not in text:
        fails.append(f"core does not reference archive file {name}")
    missing = [h for h in ("## 34. ", "## 38. ", "## 40. ") if not re.search("^" + re.escape(h), a, re.M)]
    if missing:
        fails.append(f"archive lacks sections: {missing}")
    for num in ("34", "38", "40"):
        m = re.search(rf"^## {num}\. [^\n]*\n(.*?)(?=^---$)", text, re.M | re.S)
        body = [l for l in (m.group(1).split("\n") if m else []) if l.strip()]
        if len(body) > 3:
            fails.append(f"core §{num} is not a stub ({len(body)} lines)")
    if not missing:
        oks.append("archive holds §34, §38, §40; core carries stubs")
else:
    notes.append("archive not checked (pass it as the second argument)")

for o in oks:
    print("PASS ", o)
for n in notes:
    print("NOTE ", n)
for f in fails:
    print("FAIL ", f)
print(f"\n{len(oks)} pass · {len(notes)} note · {len(fails)} fail — {os.path.basename(core_path)} "
      f"({len(text.encode()):,} bytes, {len(lines):,} lines)")
sys.exit(1 if fails else 0)
