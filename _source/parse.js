const fs=require("fs");
const {parse}=require("../node_modules/node-html-parser");

const IMGBASE="https://stoveworksinc.com/wp-content/uploads/";
const localSrc=u=>"/images/"+u.split("/").pop().replace(/-\d+x\d+(\.\w+)$/,"$1");
const clean=s=>s.replace(/\s+/g," ").trim();

// rewrite internal links + image srcs inside a rich-text fragment
function rewrite(html){
  return html
    .replace(/https:\/\/stoveworksinc\.com\/wp-content\/uploads\/[^"']+/g, m=>localSrc(m))
    .replace(/https:\/\/stoveworksinc\.com\//g,"/")
    .replace(/\s*data-dt-location="[^"]*"/g,"")
    .replace(/\s*(fetchpriority|decoding|srcset|sizes|loading)="[^"]*"/g,"")
    .trim();
}

function imgFrom(el){
  const img=el.querySelector("img"); if(!img) return null;
  const a=el.querySelector("a");
  const src=img.getAttribute("src")||"";
  return {
    src: localSrc(src),
    alt: clean(img.getAttribute("alt")||""),
    title: clean(img.getAttribute("title")||""),
    width: Number(img.getAttribute("width"))||null,
    height: Number(img.getAttribute("height"))||null,
    href: a? a.getAttribute("href") : null,
    external: a ? !/stoveworksinc\.com/.test(a.getAttribute("href")||"") : false
  };
}

// pull the elements out of a wpb column
function elements(col){
  const out=[];
  for(const el of col.querySelectorAll(".wpb_text_column, .wpb_single_image, .wpb_raw_code, .vc_separator")){
    if(el.classList.contains("wpb_text_column")){
      const w=el.querySelector(".wpb_wrapper");
      out.push({type:"text", html: rewrite(w?w.innerHTML:el.innerHTML)});
    } else if(el.classList.contains("wpb_single_image")){
      const i=imgFrom(el); if(i) out.push({type:"image", ...i});
    } else if(el.classList.contains("wpb_raw_code")){
      const w=el.querySelector(".wpb_wrapper");
      out.push({type:"raw", html: clean(w?w.innerHTML:el.innerHTML)});
    } else if(el.classList.contains("vc_separator")){
      out.push({type:"separator"});
    }
  }
  return out;
}

const files=fs.readdirSync("extract").filter(f=>f.endsWith(".content.html"));
const pages={};
for(const f of files){
  const key=f.replace(".content.html","");
  const root=parse(fs.readFileSync("extract/"+f,"utf8"));
  const rows=root.querySelectorAll(".wpb-content-wrapper > .vc_row");
  const parsed=[];
  for(const row of rows){
    const cols=row.querySelectorAll(":scope > .wpb_column");
    const rowOut={cols:[]};
    for(const c of cols){
      const widthCls=(c.classList.value.find(x=>/^vc_col-sm-\d+$/.test(x))||"vc_col-sm-12");
      const inner=c.querySelector(".wpb_wrapper");
      // nested rows?
      const nested=c.querySelectorAll(".vc_row.vc_inner");
      rowOut.cols.push({
        width:Number(widthCls.split("-").pop()),
        els: elements(c),
        nestedRows: nested.map(nr=>nr.querySelectorAll(":scope > .wpb_column").map(nc=>({
          width:Number((nc.classList.value.find(x=>/^vc_col-sm-\d+$/.test(x))||"vc_col-sm-12").split("-").pop()),
          els: elements(nc)
        })))
      });
    }
    parsed.push(rowOut);
  }
  pages[key]=parsed;
}
fs.writeFileSync("json/parsed.json",JSON.stringify(pages,null,2));
for(const [k,v] of Object.entries(pages)){
  const n=v.reduce((a,r)=>a+r.cols.reduce((b,c)=>b+c.els.length,0),0);
  console.log(String(v.length).padStart(3),"rows",String(n).padStart(3),"els  ",k);
}
