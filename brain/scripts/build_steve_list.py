"""Build the data for Steve's safety list: every in-manual disagreement (substantive) and every
website-vs-manual difference on an installation-safety value, classed by topic, safety first."""
import hashlib, json, re, sys
from collections import Counter
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'build' / 'steve_list.json'
plan = {u['id']: u for u in json.load(open(ROOT / 'build' / 'guide_plan.json'))['units']}
models = {m['id']: m for m in json.load(open(ROOT / 'package' / 'stoveworks-brain' / 'data' / 'models.json'))}
ids = [p.stem for p in sorted((ROOT / 'guides' / 'content').glob('*.json'))]

CATS = [
    ('gas', 'Gas pressure, input & combustion air', r'\binlet\b|manifold|pressure|w\.?\s?c\b|kpa|\bbtu|input|orifice|regulator|conversion kit|propane kit|lp kit|altitude|air shutter|venturi'),
    ('vent', 'Venting & chimney', r'\bvent|chimney|\bflue|liner|terminat|draft|connector|\bcap\b|elbow|horizontal run|vertical run|\bpipe\b|snorkel|restrictor|thimble|chase'),
    ('clear', 'Clearances, hearth & mantels', r'clearance|mantel|mantle|combustible|alcove|hearth|floor protect|ember|framing|enclosure|facing|ceiling|header|surround|nailing|stand-?off'),
    ('elec', 'Electrical', r'\bvolt|\bamp\b|amps|amperage|\bwatt|electric|wiring|\bwire|circuit|receptacle|battery|batteries|\bpower\b|transformer|fuse'),
    ('air', 'Outside air & mobile homes', r'outside air|combustion air|fresh air|mobile|manufactured home'),
    ('op', 'Lighting, burning & use', r'light|pilot|ignit|\bburn|fire\b|firing|reload|air control|damper|bypass|catalyst|combustor|glass|door|gasket|fuel|wood|log|remote|thermostat|flame|blower|fan\b|ash|creosote|smoke|pellet|hopper|auger'),
]
SAFETY = {'gas', 'vent', 'clear', 'elec', 'air'}
KEYCAT = [(r'^spec(inlet|manifold|input|gas|orifice|pressure|conversion|altitude|fuel)', 'gas'),
          (r'^spec(vent|flue|chimney|liner|horiz|vert|term|draft|connector|restrictor|snorkel|cap)', 'vent'),
          (r'^spec(clear|mantel|hearth|floor|alcove|fram|frame|enclosure|opening|facing|ember|chase|cavity|dims|ceiling|non)', 'clear'),
          (r'^spec(elec|power|wiring|blower)', 'elec'),
          (r'^spec(air|outside|oa|mobile)', 'air')]


def classify(where, title, issue):
    w = (where or '').lower()
    for rx, cat in KEYCAT:
        if re.search(rx, w):
            return cat
    text = f'{title} {issue}'.lower()
    for cat, _, rx in CATS:
        if re.search(rx, text):
            return cat
    return 'other'


def page_links(gid, pages):
    docs = plan[gid]['docs']
    out = []
    for pg in pages or []:
        d, n = (pg if isinstance(pg, list) and len(pg) == 2 else (1, pg))
        if not (0 < d <= len(docs)):
            continue
        doc = docs[d - 1]
        short = ('Owner\'s' if 'owner' in (doc.get('label') or '').lower() else 'Install') if len(docs) > 1 else ''
        out.append({'label': (short + ' ' if short else '') + f'p. {n}', 'url': f"{doc['url']}#page={n}" if doc.get('url') else None})
    return out


def nice_field(f):
    t = re.sub(r"^sizes\[['\"]([^'\"]+)['\"]\]\.", r"\1: ", f).replace('_', ' ').strip()
    t = re.sub(r' in$', ' (in.)', t)
    t = re.sub(r'\bbtu\b', 'BTU', t, flags=re.I)
    t = re.sub(r'\bng\b', 'NG', t); t = re.sub(r'\blp\b', 'LP', t)
    t = re.sub(r'\bmin\b', 'min.', t); t = re.sub(r'\bmax\b', 'max.', t)
    t = t.replace('clearances note', 'clearances')
    return t[:1].upper() + t[1:]


def title_of(c, where):
    if where in (c.get('detail') or {}):
        return c['detail'][where].get('title') or where
    m = re.match(r'step(\d+)$', where or '')
    if m and int(m.group(1)) < len(c.get('steps') or []):
        return 'Install step: ' + c['steps'][int(m.group(1))][0]
    return where or ''


items = []
for gid in ids:
    c = json.load(open(ROOT / 'guides' / 'content' / f'{gid}.json'))
    u = plan[gid]
    title = c['shell'].get('title') or gid
    brand = u['brand']
    for x in (c.get('review') or {}).get('conflicts') or []:
        if x.get('class') != 'substantive':
            continue
        where = x.get('where') or ''
        topic = title_of(c, where)
        cat = classify(where, topic, x.get('issue', ''))
        key = hashlib.sha1(f"{gid}|m|{where}|{x.get('issue','')[:120]}".encode()).hexdigest()[:12]
        items.append({'id': key, 'part': 'manual', 'cat': cat, 'safety': cat in SAFETY, 'brand': brand, 'guide': gid,
                      'model': title, 'topic': topic, 'text': x.get('issue', ''), 'pages': page_links(gid, x.get('pages'))})
    for m in (c.get('review') or {}).get('catalog_mismatches') or []:
        field = (m.get('field') or '').lower()
        safety_field = re.search(r'clearance|mantel|hearth|vent|flue|chimney|input|btu_input|pressure|mobile|outside_air|termination|framing|alcove|floor|ember|electric|amp|volt', field)
        if not safety_field or re.search(r'ember bed|lighting|media|firebox capacity|features?$', field):
            continue
        if re.search(r'clear|mantel|hearth|framing|alcove|floor|ember', field): cat = 'clear'
        elif re.search(r'input|pressure|btu', field): cat = 'gas'
        elif re.search(r'vent|flue|chimney|termination', field): cat = 'vent'
        elif re.search(r'mobile|outside', field): cat = 'air'
        elif re.search(r'electric|amp|volt', field): cat = 'elec'
        else: cat = classify('', field.replace('_', ' '), f"{m.get('catalog','')} {m.get('manual','')}")
        key = hashlib.sha1(f"{gid}|w|{field}|{str(m.get('catalog',''))[:80]}".encode()).hexdigest()[:12]
        mid = m.get('model') if m.get('model') in models else (u.get('model_ids') or [None])[0]
        url = models.get(mid, {}).get('product_url') if mid else None
        items.append({'id': key, 'part': 'website', 'cat': cat, 'safety': cat in SAFETY, 'brand': brand, 'guide': gid,
                      'model': title, 'topic': nice_field(m.get('field') or ''),
                      'website': str(m.get('catalog', '')), 'manual': str(m.get('manual', '')),
                      'site': url, 'pages': page_links(gid, [m.get('page')] if m.get('page') else [])})

order = {k: i for i, k in enumerate(['vent', 'clear', 'gas', 'elec', 'air', 'op', 'other'])}
items.sort(key=lambda i: (0 if i['safety'] else 1, order[i['cat']], i['brand'], i['model'], i['part']))
seen = set(); dedup = []
for i in items:
    if i['id'] in seen:
        continue
    seen.add(i['id']); dedup.append(i)
cats = {k: n for k, n, _ in CATS}; cats['other'] = 'Other (warranty, parts, upkeep)'
data = {'built': '2026-10-12', 'cats': cats, 'items': dedup}
OUT.write_text(json.dumps(data, ensure_ascii=False))
print(len(dedup), Counter((i['part'], i['cat']) for i in dedup))
