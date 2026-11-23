#!/usr/bin/env python3
"""The United States stamp list as a workbook (2026-11-22):
    python3 scripts/stamp-art/united-states/build_xlsx.py
Reads list-2026-11-22.json; writes Claude outputs/Globeskimmers-United-States-stamp-list.xlsx with
Summary · Tourist · Novelty · Local · All by region · To draw (every place without its own art, with a ✓ column)."""
import json, os
from collections import Counter
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../.."))
DATE = "2026-11-22"
rows = json.load(open(os.path.join(HERE, f"list-{DATE}.json")))
OUT = os.path.join(ROOT, "Claude outputs", "Globeskimmers-United-States-stamp-list.xlsx")

HEAD = ["No.", "Place", "Where", "State", "Region", "Kind", "Category", "Visitors (published)", "File name for the stamp", "In the database", "Art on the server", "Database row"]
TEAL = PatternFill("solid", fgColor="0E7C73"); CREAM = PatternFill("solid", fgColor="FBF6EC"); GREEN = PatternFill("solid", fgColor="E3F1E6")
WIDTHS = [6, 40, 22, 7, 20, 9, 16, 20, 40, 30, 32, 44]

def note(x):
    if x["art"] and not x["shares"]: return "yes — " + x["art"]
    if x["shares"]: return "shares " + x["shares"]
    return ""

def sheet(wb, title, data, tick=False):
    ws = wb.create_sheet(title)
    head = HEAD + (["Done ✓"] if tick else [])
    ws.append(head)
    for c in range(1, len(head) + 1):
        cell = ws.cell(row=1, column=c); cell.font = Font(bold=True, color="FFFFFF"); cell.fill = TEAL
        ws.column_dimensions[get_column_letter(c)].width = (WIDTHS + [8])[c - 1]
    for x in data:
        ws.append([x["n"], x["name"], x["where"], x["state"], x["region"], x["kind"], x["category"], x["visitors"], x["file"], x["status"], note(x), (x["dbName"] + " · " + x["dbId"]) if x["dbId"] else ""] + ([""] if tick else []))
    ws.freeze_panes = "C2"; ws.auto_filter.ref = ws.dimensions
    for r in range(2, ws.max_row + 1):
        st = ws.cell(row=r, column=10)
        st.font = Font(color={"S": "2E6B4E", "I": "B36B00", "N": "B0472F"}[st.value[0]])
    if tick:
        col = get_column_letter(len(head))
        dv = DataValidation(type="list", formula1='"✓"', allow_blank=True); ws.add_data_validation(dv); dv.add(f"{col}2:{col}{ws.max_row}")
        ws.conditional_formatting.add(f"A2:{col}{ws.max_row}", FormulaRule(formula=[f'${col}2="✓"'], fill=GREEN))
    return ws

wb = Workbook()
s = wb.active; s.title = "Summary"
c = Counter(x["kind"] for x in rows); st = Counter(x["status"] for x in rows)
art = sum(1 for x in rows if x["art"] and not x["shares"]); shared = sum(1 for x in rows if x["shares"])
lines = [
    ("The United States · places to stamp", ""), ("Built", DATE), ("Places", len(rows)),
    ("Tourist landmarks (most visited)", c["Tourist"]), ("Novelty & roadside", c["Novelty"]), ("Local favorites", c["Local"]), ("", ""),
    ("Stampable today", st.get("Stampable today", 0)), ("In the database, not yet stampable", st.get("In the database, not yet stampable", 0)), ("Not in the database yet", st.get("Not in the database yet", 0)), ("", ""),
    ("Art on the server already", art), ("Currently sharing another place's art", shared), ("To draw", len(rows) - art), ("", ""),
    ("How to read it", "Tourist = the most visited places; Visitors is a published count where one exists (NPS recreation visits 2024 · TEA/AECOM attendance 2023 · an operator's or city's own estimate), else the place is listed by fame. Novelty = roadside America, world's-largest things, oddball museums, mystery spots. Local = what locals send you to."),
    ("File names", "Exactly what the app looks for (its own slug rules). A row whose database name differs from the file gets an alias in src/lib/stampArt.js at upload time."),
    ("Per state", ""),
]
for k, v in lines: s.append([k, v])
by_state = Counter(x["stateName"] for x in rows)
for name, n in sorted(by_state.items()): s.append([name, n])
s.column_dimensions["A"].width = 44; s.column_dimensions["B"].width = 120
s["A1"].font = Font(bold=True, size=14)
for r in range(1, s.max_row + 1): s.cell(row=r, column=2).alignment = Alignment(wrap_text=True, vertical="top")

sheet(wb, "Tourist", [x for x in rows if x["kind"] == "Tourist"])
sheet(wb, "Novelty", [x for x in rows if x["kind"] == "Novelty"])
sheet(wb, "Local", [x for x in rows if x["kind"] == "Local"])
sheet(wb, "All by region", rows)
sheet(wb, "To draw", [x for x in rows if not (x["art"] and not x["shares"])], tick=True)
wb.save(OUT)
print("wrote", OUT, len(rows), "places;", "to draw", len(rows) - art)
