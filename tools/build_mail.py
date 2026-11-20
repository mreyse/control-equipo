#!/usr/bin/env python3
"""Genera mail/Code.gs (Google Apps Script) copiando de index.html las funciones
que calculan horarios, guardias y el correo semanal. Así la vista previa de la
página y el correo enviado usan exactamente el mismo código.
Uso: python3 tools/build_mail.py   (desde la raíz del repositorio)"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root/'index.html').read_text(encoding='utf-8')
js = re.findall(r'<script>(.*?)</script>', html, re.S)[-1]
lines = js.split('\n')

NAMES = ['DAYS','MONTHS','HX','GUARD_PHONES_DEFAULT','MEAL_H','NEW_HOURS','blank','toArr','hydrate',
 'pd','fd','nice','dow','eachDay','_holCache','nthMonday','officialHolidays','holidaysOfYear','holidayOn',
 'businessDays','overlaps','inRange','member','mName','esc','isHX','usedDays','offOn','SHIFT_COLORS','COVER',
 'mondayOf','weekIdx','mod','rotCache','onBreak','lineup','positionOf','memberAtPos','roleShift','isOnsite','shiftOf',
 'workHours','shiftHours','hoursBetween','guardPhone','fmtPhone','nextMonday','memberDay','fmtNoticeText','noticeWhen','noticeHTML','activeNotices','buildWeeklyEmail']

def balanced(text):
    depth = 0
    for ch in text:
        if ch in '({[': depth += 1
        elif ch in ')}]': depth -= 1
    return depth

def extract(name):
    pat = re.compile(r'^\s*(?:function\s+%s\s*\(|(?:const|let)\s+%s\s*=)' % (re.escape(name), re.escape(name)))
    for i, l in enumerate(lines):
        if pat.match(l):
            out = [l]; d = balanced(l); j = i
            while d > 0:
                j += 1; out.append(lines[j]); d += balanced(lines[j])
            return '\n'.join(out)
    raise SystemExit('No se encontró: ' + name)

engine = '\n'.join(extract(n) for n in NAMES)
header = (root/'tools'/'Code.header.gs').read_text(encoding='utf-8')
(root/'mail'/'Code.gs').write_text(header.replace('/*__ENGINE__*/', engine), encoding='utf-8')
print('mail/Code.gs generado con', len(NAMES), 'definiciones')
