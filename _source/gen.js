const fs=require("fs");
const N=JSON.parse(fs.readFileSync("json/normalized.json","utf8"));
const IDX=JSON.parse(fs.readFileSync("json/index.json","utf8"));

// tidy WP rich text: drop junk classes/spans, normalise entities
function tidy(h){
  if(!h) return "";
  return h
    .replace(/<span class="c0"[^>]*>([\s\S]*?)<\/span>/g,"$1")
    .replace(/<span style="color: #000000;">([\s\S]*?)<\/span>/g,"$1")
    .replace(/\s*class="p[01]"/g,"")
    .replace(/\s*style="text-align: center;"/g,"")
    .replace(/&#8217;/g,"’").replace(/&#8216;/g,"‘")
    .replace(/&#8220;/g,"“").replace(/&#8221;/g,"”")
    .replace(/&#8211;/g,"–").replace(/&#8212;/g,"—")
    .replace(/&#0?38;/g,"&").replace(/&#8482;/g,"™")
    .replace(/’/g,"’")
    .replace(/<p>\s*<\/p>/g,"")
    .replace(/\s+/g," ")
    .replace(/>\s+</g,">\n<")
    .trim();
}
const media=m=>({src:m.src,alt:m.alt||m.title||"",width:m.width,height:m.height,...(m.href?{href:m.href}:{})});

const key2slug={}; IDX.forEach(p=>key2slug[p.path.replace(/\//g,"_")]=p.path);
const titles={}; IDX.forEach(p=>titles[p.path.replace(/\//g,"_")]=p.title.replace(/&#0?38;/g,"&").replace(/&#8211;/g,"–"));

const pages=[];
for(const [key,sections] of Object.entries(N)){
  if(key==="home") continue;
  const slug=key2slug[key]; if(!slug) { console.error("no slug for",key); continue; }
  const out=[];
  for(const s of sections){
    if(s.type==="brand"){
      out.push({type:"brand",name:s.name,body:tidy(s.body),logo:media(s.logo)});
      continue;
    }
    const cols=s.cols;
    const textCol=cols.find(c=>c.els.some(e=>e.type==="text"));
    const imgOnlyCols=cols.filter(c=>c.els.length&&c.els.every(e=>e.type==="image"));
    // text (col 8) + aside images (col 4)
    if(textCol && imgOnlyCols.length===1 && cols.length===2){
      out.push({type:"prose-aside",
        html:tidy(textCol.els.filter(e=>e.type==="text").map(e=>e.html).join("\n")),
        aside:imgOnlyCols[0].els.map(media)});
      continue;
    }
    // all-image row -> grid
    if(!textCol && imgOnlyCols.length){
      const items=imgOnlyCols.flatMap(c=>c.els.map(media));
      if(items.length) out.push({type:"media-grid",cols:imgOnlyCols.length,items});
      continue;
    }
    // single column mixed
    for(const c of cols){
      const texts=c.els.filter(e=>e.type==="text");
      const images=c.els.filter(e=>e.type==="image");
      const raws=c.els.filter(e=>e.type==="raw");
      const nestedTextCols=c.nestedRows.flat();
      if(texts.length && !c.nestedRows.length){
        out.push({type:"prose",html:tidy(texts.map(e=>e.html).join("\n"))});
      } else if(texts.length){
        // nested layout: emit each nested column group
        out.push({type:"prose",html:tidy(texts.map(e=>e.html).join("\n"))});
      }
      if(images.length && !c.nestedRows.length) out.push({type:"media-grid",cols:Math.min(images.length,2),items:images.map(media)});
      else if(images.length) out.push({type:"media-grid",cols:Math.min(images.length,2),items:images.map(media)});
      raws.forEach(r=>out.push({type:"embed",html:r.html}));
    }
  }
  pages.push({slug,title:titles[key],sections:out});
}
pages.sort((a,b)=>a.slug.localeCompare(b.slug));
fs.writeFileSync("json/pages-out.json",JSON.stringify(pages,null,2));
pages.forEach(p=>console.log(p.slug.padEnd(45),p.sections.map(s=>s.type).join(", ")));
