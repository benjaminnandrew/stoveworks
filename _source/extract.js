const fs=require("fs");
const files=fs.readdirSync("html").filter(f=>f.endsWith(".html"));
const imgs=new Set();
const summary=[];
for(const f of files){
  const h=fs.readFileSync("html/"+f,"utf8");
  const t=h.match(/<div class="page-title-head hgroup"><h1[^>]*>([\s\S]*?)<\/h1>/);
  const start=h.indexOf('<div id="content" class="content" role="main">');
  const end=h.indexOf('</div><!-- #content -->');
  const content = (start>-1 && end>start) ? h.slice(start,end) : "";
  fs.writeFileSync("extract/"+f.replace(".html",".content.html"),content);
  const re=/https:\/\/stoveworksinc\.com\/wp-content\/uploads\/[^"'\s)>]+/g;
  let m; while((m=re.exec(h))) imgs.add(m[0].replace(/&#0?38;/g,"&"));
  summary.push({file:f,title:t?t[1].trim():"(no h1 / home)",len:content.length});
}
summary.forEach(s=>console.log(String(s.len).padStart(7),"|",s.title.padEnd(32),"|",s.file));
const list=[...imgs].sort();
fs.writeFileSync("json/images.txt",list.join("\n"));
console.log("\nUNIQUE IMAGE URLS: "+list.length);
