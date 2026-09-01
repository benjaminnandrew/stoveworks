const N=require("./json/normalized.json");
const keys=process.argv.slice(2);
for(const k of keys){
  console.log("\n=========== "+k+" ===========");
  N[k].forEach((s,i)=>{
    if(s.type==="brand"){console.log(` [${i}] BRAND ${s.name}\n     ${s.body}`);return;}
    console.log(` [${i}] ROW`);
    s.cols.forEach(c=>{
      console.log(`   col-${c.width}`);
      c.els.forEach(e=>{
        if(e.type==="text") console.log("     TEXT: "+e.html);
        else if(e.type==="image") console.log("     IMG:  "+e.src+"  alt="+JSON.stringify(e.alt)+" "+e.width+"x"+e.height+" href="+e.href);
        else console.log("     "+e.type.toUpperCase()+": "+(e.html||"").slice(0,300));
      });
      c.nestedRows.forEach((nr,j)=>{ console.log(`     NESTED ROW ${j}`); nr.forEach(nc=>{
        console.log(`       ncol-${nc.width}`);
        nc.els.forEach(e=> console.log("         "+e.type+": "+(e.type==="image"? e.src+" alt="+JSON.stringify(e.alt)+" href="+e.href : (e.html||"").slice(0,400))));
      });});
    });
  });
}
