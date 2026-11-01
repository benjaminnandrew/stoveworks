#!/usr/bin/env node
/* Stoveworks guide QA harness (v3).
   Usage: node qa-guide.js <guide.html> [more guides…]
   Validates a built guide against the build-spec contract: structure, data-block contracts,
   PAGEREF (incl. which manual), PAGES per manual, and the required scaffold features
   (home link, model headline, three search surfaces, manual deep links).
   Reads v3 guides (generated: one JSON line per data block) and v2 hand-built guides. */
const fs = require('fs');

function qa(path) {
  const h = fs.readFileSync(path, 'utf8');
  const name = path.split('/').pop();
  let pass = 0, fail = 0, warn = 0;
  const ok  = m => { pass++; console.log('  ✓ ' + m); };
  const bad = m => { fail++; console.log('  ✗ ' + m); };
  const wrn = m => { warn++; console.log('  ! ' + m); };
  console.log('\n=== QA: ' + name + ' ===');

  /* ---- 1. structure ---- */
  h.startsWith('<!DOCTYPE html>') ? ok('doctype') : bad('missing doctype');
  (h.match(/<style>/g)||[]).length===1 ? ok('single <style>') : bad('style count');
  (h.match(/<script>/g)||[]).length===1 ? ok('single <script>') : bad('script count');
  const shell = h.replace(/^const PAGES ?= ?\[.*\];$/m, 'const PAGES=[];').replace(/const PAGES=\[[\s\S]*?\];/, 'const PAGES=[];')
                 .replace(/^const MANUAL_BASE = .*;$/m, '').replace(/^const MANUALS = .*;$/m, '');
  const ext = (shell.match(/https?:\/\/[^"')\s]+/g)||[]).filter(u=>!u.includes('fonts.googleapis')&&!u.includes('fonts.gstatic')&&!u.includes('www.w3.org'));
  ext.length===0 ? ok('no external deps beyond Google Fonts') : wrn('external refs: '+[...new Set(ext)].slice(0,4).join(', '));
  const left = h.match(/\{\{[A-Z0-9_]+\}\}/g);
  left ? bad('unfilled template tokens: '+[...new Set(left)].join(',')) : ok('no unfilled template tokens');

  /* ---- 2. data layer ---- */
  const v3 = /^const MANUALS = /m.test(h);
  let D;
  try {
    if (v3) {
      const block = n => { const m = h.match(new RegExp('^const ' + n + ' = (.*);$', 'm')); if (!m) throw new Error('MISSING BLOCK: ' + n); return JSON.parse(m[1]); };
      D = {};
      for (const n of ['HOME_PRIMARY','HOME_SECONDARY','SPECS','STEPS','CODES','FAULTS','DETAIL','PAGEREF','INDEX_EXTRA','MANUAL_BASE','MANUALS','PAGES']) D[n] = block(n);
      D.STEPS.forEach((s,i)=>{ D.DETAIL['step'+i]={tag:'Installer · step '+(i+1), title:s[0], cool:true, html:s[2]||`<p>${s[1]}</p>`}; });
      D.INDEX = [
        ...D.HOME_PRIMARY.map(d=>({k:'h',id:d.id,t:d.title,p:d.blurb})),
        ...D.HOME_SECONDARY.map(d=>({k:'h',id:d.id,t:d.title,p:d.blurb})),
        ...D.SPECS.map(s=>({k:'i',id:s.tap,t:s.lab,p:s.rows.map(r=>r[0]+' '+r[1]).join(' · ')})),
        ...D.STEPS.map((s,i)=>({k:'i',id:'step'+i,t:s[0],p:s[1]})),
        ...D.INDEX_EXTRA,
      ];
    } else {
      const grab = (re, label) => { const m = h.match(re); if(!m) throw new Error('MISSING BLOCK: '+label); return m[0]; };
      const src = [
        grab(/const HOME_PRIMARY = \[[\s\S]*?STEPS\.forEach\([\s\S]*?\}\);/, 'HOME..DETAIL..STEPS.forEach'),
        grab(/const PAGEREF=\{[\s\S]*?\};/, 'PAGEREF'),
        grab(/const INDEX=\[[\s\S]*?\];/, 'INDEX'),
        grab(/const MANUAL_URL = '[^']*';/, 'MANUAL_URL'),
        grab(/const PAGES=\[[\s\S]*?\];/, 'PAGES'),
      ].join('\n') + '\nreturn {HOME_PRIMARY,HOME_SECONDARY,SPECS,STEPS,CODES,DETAIL,INDEX,PAGEREF,PAGES,MANUAL_URL};';
      D = new Function(src)();
      D.MANUALS = [{n:1,label:'manual',short:'',url:D.MANUAL_URL,pages:D.PAGES.length}];
      D.PAGES = D.PAGES.map(p=>({d:1,...p}));
      D.FAULTS = null; D.MANUAL_BASE = '';
    }
    ok('data blocks parse' + (v3 ? ' (v3)' : ' (v2)'));
  } catch(e){ bad('data parse failed: '+e.message); return {pass,fail,warn}; }

  const { HOME_PRIMARY, HOME_SECONDARY, SPECS, STEPS, CODES, FAULTS, DETAIL, INDEX, PAGEREF, PAGES, MANUALS } = D;

  /* ---- 3. data-block contracts ---- */
  const tiles = [...HOME_PRIMARY, ...HOME_SECONDARY];
  const homeIds = tiles.map(t=>t.id);
  const dupHome = homeIds.filter((v,i)=>homeIds.indexOf(v)!==i);
  dupHome.length ? bad('duplicate tile ids: '+dupHome.join(',')) : ok(homeIds.length+' unique homeowner tiles');
  ok(SPECS.length+' spec cards, '+STEPS.length+' install steps');
  const dk = new Set(Object.keys(DETAIL));
  const missTile = homeIds.filter(id=>!dk.has(id));
  const missTap  = SPECS.map(s=>s.tap).filter(t=>!dk.has(t));
  missTile.length ? bad('tiles with no DETAIL: '+missTile.join(',')) : ok('every tile id has a DETAIL');
  missTap.length  ? bad('spec taps with no DETAIL: '+missTap.join(',')) : ok('every spec tap has a DETAIL');
  const missStep = STEPS.map((_,i)=>'step'+i).filter(k=>!dk.has(k));
  missStep.length ? bad('step drawers missing: '+missStep.join(',')) : ok('all '+STEPS.length+' step drawers generated');
  const noIcon = tiles.filter(t=>!t.icon || !/^M/.test(t.icon)).map(t=>t.id);
  noIcon.length ? wrn('tiles missing icon: '+noIcon.join(',')) : ok('every tile has an icon');
  const badCode = CODES.filter(c=>!(Array.isArray(c)&&c.length===3&&(Number.isInteger(c[0])||typeof c[0]==='string')));
  badCode.length ? bad(badCode.length+' malformed CODES rows') : ok(CODES.length ? CODES.length+' control codes' : 'no code table (section hidden)');
  if (FAULTS) {
    const fp = FAULTS.panels||[];
    (fp.length>=1 && fp.length<=4 && fp.every(p=>p.title&&Array.isArray(p.items)&&p.items.length)) ? ok(fp.length+' fault panels') : bad('FAULTS panels malformed');
  } else ok('no fault panels (section hidden)');
  /* drawer html: balanced building blocks, nothing executable */
  const htmlIssues = [];
  for (const [k,d] of Object.entries(DETAIL)) {
    const s = d.html||'';
    if (/<\s*script|\son\w+\s*=|javascript:/i.test(s)) htmlIssues.push(k+': executable content');
    for (const t of ['p','h4','ol','ul','li','div','b','span']) {
      const o=(s.match(new RegExp('<'+t+'(\\s[^>]*)?>','gi'))||[]).length, c=(s.match(new RegExp('</'+t+'\\s*>','gi'))||[]).length;
      if (o!==c) { htmlIssues.push(k+': <'+t+'> '+o+'/'+c); break; }
    }
  }
  htmlIssues.length ? bad('drawer html: '+htmlIssues.slice(0,5).join('; ')) : ok('drawer html balanced');

  /* ---- 4. manuals & PAGES ---- */
  const nDocs = MANUALS.length;
  (nDocs>=1 && MANUALS.every(m=>m.url&&m.label&&Number.isInteger(m.pages))) ? ok(nDocs+' manual'+(nDocs>1?'s':'')+': '+MANUALS.map(m=>m.label+' ('+m.pages+' pp)').join(' + ')) : bad('MANUALS malformed');
  for (let n=1;n<=nDocs;n++){
    const pp = PAGES.filter(p=>(p.d||1)===n);
    const seq = pp.every((p,i)=>p.p===i+1);
    (seq && pp.length===MANUALS[n-1].pages) ? ok('manual '+n+': PAGES sequential 1..'+pp.length) : bad('manual '+n+': PAGES not sequential or count mismatch ('+pp.length+' vs '+MANUALS[n-1].pages+')');
    const empty = pp.filter(p=>!p.t||p.t.trim().length<3).map(p=>p.p);
    if (empty.length) wrn('manual '+n+': '+empty.length+' page(s) with no text: p'+empty.slice(0,12).join(',p')+(empty.length>12?'…':''));
  }

  /* ---- 5. PAGEREF ---- */
  const refKeys = Object.keys(PAGEREF);
  const badKey  = refKeys.filter(k=>!dk.has(k));
  badKey.length ? bad('PAGEREF keys with no drawer: '+badKey.join(',')) : ok(refKeys.length+' PAGEREF keys, each maps to a drawer');
  const refOf = v => Array.isArray(v) ? {d:v[0],p:v[1]} : {d:1,p:v};
  const badPage = refKeys.filter(k=>{const r=refOf(PAGEREF[k]);return !(Number.isInteger(r.d)&&r.d>=1&&r.d<=nDocs&&Number.isInteger(r.p)&&r.p>=1&&r.p<=MANUALS[r.d-1].pages);});
  badPage.length ? bad('PAGEREF pages out of range: '+badPage.join(',')) : ok('all PAGEREF pages within their manual');
  const stop = new Set(['the','a','an','and','or','to','of','in','on','for','your','it','its','with','what','how','&','this','that','from','into','when','then','than','them','they','will','have','been','only','each','also','more','most','make','sure','just','like','turn','keep','before','after','about','every','there','their','these','those','which','while','where','should','would','could']);
  const sniffMiss = [];
  for (const k of refKeys){
    const d = DETAIL[k]; if(!d) continue;
    const txt = ((d.title||'')+' '+(d.html||'').replace(/<[^>]+>/g,' ')).toLowerCase();
    const words = [...new Set(txt.replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>3 && !stop.has(w)))];
    const r = refOf(PAGEREF[k]);
    const pg = PAGES.find(p=>(p.d||1)===r.d&&p.p===r.p); const t = pg? pg.t.toLowerCase() : '';
    if (words.length && !words.some(w=>t.includes(w))) sniffMiss.push(k+'→'+(nDocs>1?'m'+r.d+' ':'')+'p'+r.p);
  }
  sniffMiss.length ? wrn('PAGEREF worth re-checking (no drawer word on page): '+sniffMiss.join(', ')) : ok('PAGEREF pages pass semantic sniff');
  const unref = [...homeIds, ...SPECS.map(s=>s.tap)].filter(k=>!(k in PAGEREF));
  if (unref.length) wrn('drawers with no manual page link: '+unref.join(','));

  /* ---- 6. INDEX ---- */
  const idxBadRole = INDEX.filter(x=>x.k!=='h'&&x.k!=='i').length;
  idxBadRole ? bad(idxBadRole+' INDEX entries with bad role key') : ok(INDEX.length+' INDEX entries, roles valid');
  const idxOrphan = INDEX.filter(x=>!dk.has(x.id)).map(x=>x.id);
  idxOrphan.length ? wrn('INDEX ids not in DETAIL: '+[...new Set(idxOrphan)].join(',')) : ok('every INDEX id maps to a drawer');

  /* ---- 7. required scaffold features (HTML level) ---- */
  const feat = [
    ['home link (brandHome + goHome)', /id="brandHome"/.test(h) && /function goHome\(/.test(h)],
    ['model-name headline (not the old sentence)', /<h1>[^<]+<\/h1>/.test((h.match(/<section class="gate"[\s\S]*?<\/section>/)||[''])[0]) && !/Two people open this manual/.test(h)],
    ['header search (#q)', /id="q"/.test(h)],
    ['owner inline search (#oq + renderOwnerSearch)', /id="oq"/.test(h) && /renderOwnerSearch/.test(h)],
    ['installer inline search (#mq + renderManualSearch)', /id="mq"/.test(h) && /renderManualSearch/.test(h)],
    ['drawer deep-link footer wired (PAGEREF in openDrawer)', /PAGEREF\[id\]/.test(h) && /manlink/.test(h)],
    ['no parent-site back-link chrome', !/class="back"/.test(h) && !/Seeley/.test(h)],
  ];
  if (v3) feat.push(['multi-manual support (MANUALS + pdfMenu)', /id="pdfMenu"/.test(h) && /function pdfHref\(/.test(h)]);
  feat.forEach(([m,c])=> c?ok(m):bad(m));

  console.log('\n  RESULT: '+pass+' pass / '+fail+' fail / '+warn+' warn' + (fail? '   ✗ FAILED':'   ✓ OK'));
  return {pass,fail,warn};
}

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node qa-guide.js <guide.html> [more…]'); process.exit(2); }
let failed = 0;
for (const f of files) { const r = qa(f); if (r.fail) failed++; }
if (files.length>1) console.log('\n'+(files.length-failed)+' of '+files.length+' guides passed');
process.exit(failed?1:0);
