const fs=require("fs");
const all=fs.readFileSync("json/images.txt","utf8").trim().split("\n");
const base=u=>u.replace(/-\d+x\d+(\.(jpg|jpeg|png|gif|webp|svg))$/i,"$1");
const originals=new Set(all.map(base));
const list=[...originals].sort();
fs.writeFileSync("json/originals.txt",list.join("\n"));
console.log("originals:",list.length);
list.forEach(u=>console.log("  "+u.replace("https://stoveworksinc.com/wp-content/uploads/","")));
