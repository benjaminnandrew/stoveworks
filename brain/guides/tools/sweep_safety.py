"""Pattern sweep: safety statements present in a guide's manual but missing from the guide.
Heuristic flags only; each flag is confirmed against the manual by a fix agent before any change."""
import json, re, sys
from pathlib import Path

ROOT = Path('/home/claude/brain')
ids = [l.strip() for l in open(sys.argv[1]) if l.strip()]
skip = set(l.strip() for l in open(sys.argv[2])) if len(sys.argv) > 2 else set()


def fold(s):
    s = s.lower().replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("″", '"')
    s = s.replace('­', '')
    return re.sub(r"\s+", " ", s)


def guide_text(c):
    parts = []
    def walk(x):
        if isinstance(x, str): parts.append(x)
        elif isinstance(x, list): [walk(y) for y in x]
        elif isinstance(x, dict): [walk(v) for k, v in x.items() if k not in ('pageref',)]
    for k in ('shell', 'home_primary', 'home_secondary', 'specs', 'steps', 'faults', 'codes', 'detail', 'index_extra'):
        walk(c.get(k))
    t = ' '.join(parts)
    t = re.sub(r'<[^>]+>', ' ', t).replace('&amp;', '&').replace('&#39;', "'")
    return fold(t)


def pages_of(unit, rx):
    out = []
    for doc in unit['docs']:
        try:
            pages = json.load(open(ROOT / doc['layout_path'], encoding='utf-8'))
        except Exception:
            continue
        for i, p in enumerate(pages):
            if re.search(rx, fold(p['t'])):
                out.append((doc['n'], p.get('p', i + 1)))
    return out


GAS = [
    ('G1 leave the building', r"leave the building", r"leave the building|get out of the building|leave the house|leave your home"),
    ('G2 immediately call', r"immediately call your gas supplier", r"(immediately|right away)[^.]{0,90}gas supplier|gas supplier[^.]{0,60}(immediately|right away)"),
    ('G3 follow their instructions', r"follow the gas supplier'?s instructions", r"follow (their|the gas supplier'?s|your gas supplier'?s|the supplier'?s) instructions"),
    ('G4 fire department', r"call the fire department", r"fire department"),
    ('G5 light any appliance', r"do not (try to )?light any appliance", r"any appliance|light anything"),
    ('G6 electric switch', r"do not touch any electric(al)? switch", r"switch"),
    ('G7 phone', r"do not use any phone", r"phone"),
    ('G8 open windows', r"smell gas.{0,400}open windows|open windows.{0,200}(light|electric|phone|gas supplier)", r"open (the |all )?windows"),
    ('G9 open flame', r"extinguish any open flame", r"open flame"),
    ('G10 still smell gas', r"still smell gas", r"still smell gas"),
    ('G11 power off for service', r"turn off all electric power to the (appliance|fireplace|heater|stove)[^.]{0,30}if service is to be performed",
        r"(power|electric)[^.]{0,90}servic|servic[^.]{0,90}(power|electric)"),
    ('G12 do not try to repair', r"do not try to repair it", r"repair"),
    ('G12b force or attempted repair', r"force or attempted repair", r"attempted repair|trying to repair|forcing it|force it[^.]{0,60}(fire|explosion)"),
    ('G13 under water', r"has been under water|was under water", r"under ?water"),
    ('G13b replace control parts', r"replace any part of the control system", r"control system"),
    ('G14 wait 5 minutes to clear gas', r"wait (five|5) \(?5?\)? ?minutes to clear out any gas", r"(5|five) minutes"),
    ('G15 three attempts', r"three attempts|3 attempts|stop all attempts", r"three (attempts|tries)|3 (attempts|tries)|stop all attempts|stop trying|after three"),
    ('G17 sidewalk between two dwellings', r"between two single family dwellings", r"single[- ]family"),
    ('G18 entire mantel caveat', r"entire mantel meets the clearances", r"entire mantel"),
    ('G19 discontinue operation', r"discontinue (operation|use)", r"discontinue|stop using|don't use|do not use|stop operating"),
    ('G20 knob does not spring back: stop and immediately call', r"(does not|doesn't) (pop up|spring back|return)[^.]{0,100}stop and immediately call", r"(pop up|spring back|return)[^.]{0,160}(immediately|right away)"),
]
WOOD = [
    ('W1 wet/green/unseasoned wood', r"wet or green wood|do not burn wet|wet unseasoned|unseasoned wood|green or wet wood", None),
    ('W2 scrap', r"never burn scrap|burn scrap", r"scrap"),
    ('W3 asphalt', r"asphalt", r"asphalt"),
    ('W4 paint thinners', r"thinner", r"thinner"),
    ('W5 railroad ties', r"railroad", r"railroad"),
    ('W6 manure', r"manure|animal remains", r"manure|animal remains"),
    ('W8 rubber or tires', r"materials containing rubber|tires", r"rubber|tires"),
    ('W9 yard waste', r"lawn clippings|yard waste", r"lawn|yard waste"),
    ('W10 colored paper', r"colou?red paper|junk mail", r"colou?red paper|junk mail"),
    ('W11 immediate cleaning', r"immediate cleaning|cleaned immediately|immediately cleaned", r"immediate"),
    ('W12 check daily', r"check daily|inspect daily|daily for creosote|daily inspection", r"daily"),
    ('W13 do not over-fire', r"do not over-?fire|never over-?fire|don't over-?fire", r"(don't|do not|never) over-?fire"),
    ('W14 keep liquids away', r"keep all such liquids", r"liquids"),
    ('W16 goggles and gloves', r"safety goggles|goggles and gloves", r"goggles"),
    ('W18 must burn wet wood', r"necessary to burn wet", r"must burn wet|necessary to burn wet|have to burn wet"),
    ('W19 plastic', r"materials containing plastic|plastic", r"plastic"),
    ('W20 asbestos', r"materials containing asbestos", r"asbestos"),
    ('W21 construction or demolition debris', r"demolition debris", r"debris|demolition"),
    ('W22 waste petroleum products', r"waste petroleum|petroleum products", r"petroleum"),
    ('W23 solvents', r"solvents", r"solvent"),
    ('W24 salt water driftwood', r"salt ?water", r"salt"),
    ('W25 paper products, cardboard, plywood, particleboard', r"particle ?board", r"particle ?board|plywood"),
    ('W26 treated wood', r"treated wood", r"treated"),
    ('W27 toxic fumes consequence', r"toxic fumes", r"toxic|fumes"),
    ('W28 over-firing response keeps immediately', r"over-?fir\w*[^.]{0,150}immediately|immediately[^.]{0,150}over-?fir", r"over-?fir\w*[^.]{0,250}(immediately|right away)|(immediately|right away)[^.]{0,250}over-?fir"),
]

flags = {}
for gid in ids:
    if gid in skip:
        continue
    unit = json.load(open(ROOT / 'build' / 'guide_inputs' / gid / 'unit.json'))
    c = json.load(open(ROOT / 'guides' / 'content' / f'{gid}.json'))
    g = guide_text(c)
    cat = unit['category']
    checks = GAS if cat.startswith('gas') else WOOD if (cat.startswith('wood') or cat.startswith('pellet')) else []
    out = []
    for name, mrx, grx in checks:
        pg = pages_of(unit, mrx)
        if name[:3] in ('W3 ','W4 ','W5 ','W6 ','W8 ','W9 ') or name[:3] in ('W10','W19','W20','W21','W22','W23','W24','W25','W26','W27'):
            pg = [x for x in pg if x in pages_of(unit, r"do not burn|never burn|don't burn|prohibit|not burn")]
        if not pg:
            continue
        if name.startswith('W1 '):
            sents = re.split(r'(?<=[.!?])\s', g)
            ok = any(re.search(r'wet|green wood|unseasoned', s) and re.search(r"never|don't|do not|not burn|avoid", s) for s in sents)
        else:
            ok = re.search(grx, g)
        if not ok:
            out.append({'flag': name, 'pages': pg[:6]})
    # summaries that retry without the gas-smell stop
    if cat.startswith('gas'):
        for f in (c.get('faults') or {}).get('panels', []) if isinstance(c.get('faults'), dict) else []:
            for it in f.get('items', []):
                t = fold(it)
                if re.search(r'wait', t) and re.search(r'retry|try again|relight', t) and 'smell' not in t:
                    out.append({'flag': 'G10b retry summary without gas-smell stop', 'where': 'faults: ' + it[:120]})
        for x in c.get('index_extra') or []:
            t = fold(x.get('p', '') + ' ' + x.get('t', ''))
            if re.search(r'wait', t) and re.search(r'retry|try again|relight', t) and 'smell' not in t:
                out.append({'flag': 'G10b retry summary without gas-smell stop', 'where': 'index_extra: ' + (x.get('p') or '')[:120]})
    if out:
        flags[gid] = out

json.dump(flags, open(sys.argv[3] if len(sys.argv) > 3 else '/dev/stdout', 'w'), indent=1)
from collections import Counter
cnt = Counter(f['flag'] for v in flags.values() for f in v)
print('\nguides flagged', len(flags), file=sys.stderr)
for k, v in sorted(cnt.items()): print(f'{v:4d} {k}', file=sys.stderr)
