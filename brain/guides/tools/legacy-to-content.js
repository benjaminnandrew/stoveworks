// Convert a v2 guide (data blocks as JS consts, hand-edited page shell) into a v3 content file.
// usage: node scripts/legacy-to-content.js <v2 guide.html> <guide id> <out.json>
const fs = require('fs');
const path = require('path');
const [src, gid, outPath] = process.argv.slice(2);
const h = fs.readFileSync(src, 'utf8');
const grab = re => { const m = h.match(re); if (!m) throw new Error('missing ' + re); return m[0]; };
const code = [
  grab(/const HOME_PRIMARY = \[[\s\S]*?STEPS\.forEach\([\s\S]*?\}\);/),
  grab(/const PAGEREF=\{[\s\S]*?\};/),
  grab(/const INDEX=\[[\s\S]*?\];/),
].join('\n') + '\nreturn {HOME_PRIMARY,HOME_SECONDARY,SPECS,STEPS,CODES,DETAIL,INDEX,PAGEREF};';
const d = new Function(code)();
const icons = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'guides', 'template', 'icons.json'), 'utf8'));
const byPath = Object.fromEntries(Object.entries(icons).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [v.d, k]));
const tile = t => {
  const o = { id: t.id, icon: byPath[t.icon] || t.icon, title: t.title, blurb: t.blurb };
  if (!byPath[t.icon] && t.fill) o.fill = true;
  return o;
};
const txt = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const unesc = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const pick = re => { const m = h.match(re); return m ? unesc(txt(m[1])) : null; };
const gate = grab(/<section class="gate"[\s\S]*?<\/section>/);
const g = re => { const m = gate.match(re); return m ? unesc(txt(m[1])) : null; };
const ignites = [...gate.matchAll(/<button class="ignite[^"]*"[\s\S]*?<h2>([\s\S]*?)<\/h2>\s*<p>([\s\S]*?)<\/p>/g)];
const foot = g(/<p class="foot">([\s\S]*?)<\/p>/) || '';
const cert = (foot.match(/manual \(([^)]*)\)/) || [])[1] || null;
const inst = grab(/<section class="view" id="installer">[\s\S]*?<\/section>/);
const panels = [...inst.matchAll(/<div class="panel warn">\s*<h3>([\s\S]*?)<\/h3>\s*<ul>([\s\S]*?)<\/ul>/g)].map(m => ({
  title: unesc(txt(m[1])).replace(/^⚠\s*/, ''),
  items: [...m[2].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(x => x[1].trim()),
}));
const faultLabel = (inst.match(/<div class="seclabel">([^<]*)<\/div>\s*<div class="twocol">/) || [])[1] || 'Field faults';
const nAuto = d.HOME_PRIMARY.length + d.HOME_SECONDARY.length + d.SPECS.length + d.STEPS.length;
const ownerNoun = (ignites[0] ? unesc(txt(ignites[0][1])) : 'I own this fireplace').replace(/^I own this\s+/, '');
const ph = (id) => { const m = h.match(new RegExp(`id="${id}"[^>]*placeholder="([^"]*)"`)) || h.match(new RegExp(`placeholder="([^"]*)"[^>]*id="${id}"`)); return m ? unesc(m[1]) : null; };
const ownerHint = (ph('oq') || '').replace(/^Search\s+—\s+/, '').replace(/…$/, '') || null;
const manualHint = (ph('mq') || '').replace(/^.*?—\s+/, '').replace(/…$/, '') || null;
const detail = {};
for (const [k, v] of Object.entries(d.DETAIL)) if (!/^step\d+$/.test(k)) detail[k] = { tag: v.tag, title: v.title, cool: v.cool, html: v.html.replace(/^\s*\n/, '').replace(/\s+$/, '') };
const brand = h.match(/<div class="brand-wrap"><span>([^<]*)<\/span><small>([^<]*)<\/small>/);
const out = {
  id: gid,
  schema: 3,
  origin: `Converted from the v2 guide ${path.basename(src)} (content carried over unchanged).`,
  shell: {
    brand_mark: unesc(brand[1]), brand_line: unesc(brand[2]),
    kicker: g(/<div class="kicker">([\s\S]*?)<\/div>/), title: g(/<h1>([\s\S]*?)<\/h1>/), model_line: g(/<p class="model">([\s\S]*?)<\/p>/),
    owner_noun: ownerNoun,
    owner_card: ignites[0] ? unesc(txt(ignites[0][2])) : '', installer_card: ignites[1] ? unesc(txt(ignites[1][2])) : '',
    certification: cert, owner_search_hint: ownerHint, manual_search_hint: manualHint,
  },
  home_primary: d.HOME_PRIMARY.map(tile),
  home_secondary: d.HOME_SECONDARY.map(tile),
  specs: d.SPECS.map(s => { const o = { id: s.id, lab: s.lab, tap: s.tap, rows: s.rows }; if (s.note) o.note = s.note; return o; }),
  steps: d.STEPS,
  faults: panels.length ? { label: faultLabel, panels } : null,
  codes: d.CODES,
  codes_label: d.CODES.length ? ((inst.match(/<div class="seclabel">([^<]*)<\/div>\s*<div class="codes"/) || [])[1] || 'Control codes') : undefined,
  detail,
  pageref: d.PAGEREF,
  index_extra: d.INDEX.slice(nAuto),
};
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(gid, '| tiles', out.home_primary.length + out.home_secondary.length, '| specs', out.specs.length, '| steps', out.steps.length,
  '| codes', out.codes.length, '| faults', panels.length, '| pageref', Object.keys(out.pageref).length, '| extra index', out.index_extra.length,
  '| unmapped icons', [...out.home_primary, ...out.home_secondary].filter(t => t.icon.startsWith('M')).length);
