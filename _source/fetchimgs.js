const fs=require("fs"),path=require("path"),{execFileSync}=require("child_process");
const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
let list=fs.readFileSync("json/originals.txt","utf8").trim().split("\n")
  .map(u=>u.replace(/[\|].*$/,""))
  .filter(u=>/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(u));
list=[...new Set(list)].sort();
const dir="../public/images";
fs.mkdirSync(dir,{recursive:true});
console.log("downloading",list.length,"images");
let ok=0,fail=0;
for(const u of list){
  const name=path.basename(u);
  const out=path.join(dir,name);
  if(fs.existsSync(out)&&fs.statSync(out).size>0){ok++;continue;}
  try{
    execFileSync("curl",["-sL","--compressed","-H","User-Agent: "+UA,u,"-o",out],{stdio:"pipe"});
    const sz=fs.statSync(out).size;
    if(sz<500){fail++;console.log("  SMALL",name,sz);} else {ok++;}
  }catch(e){fail++;console.log("  FAIL",name);}
}
console.log("ok:",ok,"fail:",fail);
