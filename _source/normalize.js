const fs=require("fs");
const P=JSON.parse(fs.readFileSync("json/parsed.json","utf8"));
const strip=h=>h.replace(/<[^>]+>/g," ").replace(/&#8211;/g,"-").replace(/&#8217;/g,"'").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();

const out={};
for(const [key,rows] of Object.entries(P)){
  const sections=[];
  for(const row of rows){
    const cols=row.cols;
    // brand row: 2 cols, first has text starting with h3, second has one image
    const textCol=cols.find(c=>c.els.some(e=>e.type==="text"));
    const imgCol=cols.find(c=>c!==textCol && c.els.some(e=>e.type==="image"));
    const t=textCol&&textCol.els.find(e=>e.type==="text");
    if(cols.length===2 && t && /^<h3>/.test(t.html) && imgCol && imgCol.els.filter(e=>e.type==="image").length===1){
      const h3=t.html.match(/^<h3>([\s\S]*?)<\/h3>/);
      const logo=imgCol.els.find(e=>e.type==="image");
      sections.push({type:"brand",name:strip(h3?h3[1]:""),body:t.html.replace(/^<h3>[\s\S]*?<\/h3>\s*/,"").trim(),logo});
      continue;
    }
    // separator-only row
    const allEls=cols.flatMap(c=>c.els);
    if(allEls.length && allEls.every(e=>e.type==="separator")) continue;
    sections.push({type:"raw-row",cols,nested:cols.some(c=>c.nestedRows.length)});
  }
  out[key]=sections;
}
fs.writeFileSync("json/normalized.json",JSON.stringify(out,null,2));
for(const [k,s] of Object.entries(out)){
  const brands=s.filter(x=>x.type==="brand");
  console.log("== "+k+"  ("+s.length+" sections, "+brands.length+" brands)");
  s.forEach(x=>{
    if(x.type==="brand") console.log("     brand: "+x.name.padEnd(30)+" logo="+x.logo.src.replace("/images/","")+"  -> "+(x.logo.href||"—"));
    else console.log("     row:   "+x.cols.map(c=>c.width+":["+c.els.map(e=>e.type).join(",")+"]").join("  "));
  });
}
