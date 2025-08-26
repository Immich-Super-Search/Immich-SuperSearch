/* supersearch.esm.v1.0.js */
import express from "express";

const DEFAULT_API = "http://immich-server:3001/api";
const IMMICH_URL = stripTrailingSlash(process.env.IMMICH_URL || DEFAULT_API);
const IMMICH_API_KEY = process.env.IMMICH_API_KEY || process.env.IMMICH_TOKEN;
if (!IMMICH_API_KEY) { console.error("Set IMMICH_API_KEY (or IMMICH_TOKEN)."); process.exit(1); }
const IMMICH_WEB_BASE = (process.env.IMMICH_WEB_BASE && stripTrailingSlash(process.env.IMMICH_WEB_BASE)) || stripTrailingSlash(IMMICH_URL.replace(/\/api\/?$/, ""));
const PORT = Number(process.env.PORT || 8080);

const I_HEADERS = { "x-api-key": IMMICH_API_KEY, "content-type": "application/json" };
const app = express();
app.use(express.json({ limit: "1mb" }));

function stripTrailingSlash(s){ return s.endsWith("/") ? s.slice(0,-1) : s; }
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
function safeJSON(t){ try{ return t?JSON.parse(t):null }catch{ return null } }

function parseDurationToSec(d){
  if (d==null) return null;
  if (typeof d==="number") return d>1000?Math.round(d/1000):Math.round(d);
  if (typeof d==="string"){
    const p=d.split(":").map(Number); if (p.some(n=>Number.isNaN(n))) return null;
    if (p.length===3) return p[0]*3600+p[1]*60+p[2];
    if (p.length===2) return p[0]*60+p[1];
    return p[0];
  }
  return null;
}
function extractDims(a){
  const ex=a?.exifInfo||{};
  const width=ex.exifImageWidth??a.imageWidth??a.width??null;
  const height=ex.exifImageHeight??a.imageHeight??a.height??null;
  const size=ex.fileSizeInByte??a.fileSizeInByte??a.size??null;
  return {width,height,size};
}
function boolish(v){ if(v===""||v==null)return null; if(typeof v==="boolean")return v; if(typeof v==="string"){const s=v.toLowerCase(); if(s==="true")return true; if(s==="false")return false;} return null; }
function num(v){ if(v===""||v==null)return null; const n=Number(v); return Number.isFinite(n)?n:null; }

const ROUTES={meta:null,large:null};
async function fetchText(url,opts){ const res=await fetch(url,opts); return {status:res.status,ok:res.ok,text:await res.text()}; }
async function detectRoutes(){
  const candM=[{path:"search/metadata",method:"POST",mode:"json"},{path:"search/assets",method:"POST",mode:"json"},{path:"search",method:"POST",mode:"json"}];
  for(const c of candM){ const u=new URL(`${IMMICH_URL}/${c.path}`); const body=JSON.stringify({page:1,size:1,withExif:true}); const {status}=await fetchText(u,{method:c.method,headers:I_HEADERS,body}); if(status===200){ ROUTES.meta=c; break; } }
  const candL=[{path:"search/large-assets",method:"POST",mode:"json"},{path:"search/large-assets",method:"POST",mode:"qs"},{path:"search-large-assets",method:"GET",mode:"qs"}];
  for(const c of candL){ const u=new URL(`${IMMICH_URL}/${c.path}`); let opts; if(c.mode==="qs"){ u.searchParams.set("page","1"); u.searchParams.set("size","1"); opts={method:c.method,headers:I_HEADERS}; } else { opts={method:c.method,headers:I_HEADERS,body:JSON.stringify({page:1,size:1})}; } const {status}=await fetchText(u,opts); if(status===200){ ROUTES.large=c; break; } }
  if(!ROUTES.meta) throw new Error("No compatible metadata search endpoint found");
}

function firstArrayCandidate(o){
  if(Array.isArray(o)) return o;
  if(!o||typeof o!=="object") return null;
  if(Array.isArray(o.items)) return o.items;
  if(Array.isArray(o.assets)) return o.assets;
  if(Array.isArray(o.results)) return o.results;
  if(o.assets&&typeof o.assets==="object"){
    if(Array.isArray(o.assets.items)) return o.assets.items;
    if(Array.isArray(o.assets.results)) return o.assets.results;
  }
  if(o.data){
    const d=o.data;
    if(Array.isArray(d)) return d;
    if(Array.isArray(d.items)) return d.items;
    if(Array.isArray(d.assets)) return d.assets;
    if(Array.isArray(d.results)) return d.results;
  }
  for(const k of Object.keys(o)){ const v=o[k]; if(Array.isArray(v)) return v; if(v&&typeof v==="object"){ if(Array.isArray(v.items)) return v.items; if(Array.isArray(v.assets)) return v.assets; if(Array.isArray(v.results)) return v.results; } }
  return null;
}
function truthyHasMoreToken(v,page){ if(v==null)return null; if(typeof v==="boolean")return v; if(typeof v==="number")return v>(typeof page==="number"?page:0); if(typeof v==="string"){ const n=Number(v); if(!Number.isNaN(n)) return n>(typeof page==="number"?page:0); return v.length>0; } return null; }
function computeHasMore(obj,items,page,pageSize){
  const chk=(o)=>{ if(!o||typeof o!=="object") return null;
    const a=truthyHasMoreToken(o.nextPage,page); if(a!==null) return a;
    const b=truthyHasMoreToken(o.hasNextPage,page); if(b!==null) return b;
    if(o.pagination&&typeof o.pagination==="object"){
      const p1=truthyHasMoreToken(o.pagination.hasNextPage,page); if(p1!==null) return p1;
      const p2=truthyHasMoreToken(o.pagination.nextPage,page); if(p2!==null) return p2;
      const p3=truthyHasMoreToken(o.pagination.nextPageToken,page); if(p3!==null) return p3;
    }
    return null;
  };
  const nests=[obj,obj?.data,obj?.assets,obj?.albums];
  for(const n of nests){ const got=chk(n); if(got!==null) return got; }
  return (Array.isArray(items)&&items.length===pageSize);
}
async function fetchSearchPageDetected({kind,body,page,pageSize}){
  const route= kind==="large" ? ROUTES.large : ROUTES.meta;
  if(!route) throw new Error(`Route not detected for ${kind}`);
  const url=new URL(`${IMMICH_URL}/${route.path}`);
  let opts;
  if(route.mode==="qs"){
    url.searchParams.set("size",String(pageSize));
    url.searchParams.set("page",String(page));
    const keys=["type","minFileSize","isMotion","isNotInAlbum","isFavorite","takenAfter","takenBefore","withExif","order","albumIds"];
    for(const k of keys){ if(body[k]!==undefined && body[k]!==null){ const v=Array.isArray(body[k])?body[k].join(","):String(body[k]); url.searchParams.set(k,v);} }
    opts={method:route.method,headers:I_HEADERS};
  } else {
    const payload=Object.assign({},body||{},{page,size:pageSize,withExif:true,order:"desc"});
    opts={method:route.method,headers:I_HEADERS,body:JSON.stringify(payload)};
  }
  const res=await fetch(url,opts);
  const text=await res.text();
  if(!res.ok) throw new Error(`${route.path} failed [${res.status}]: ${text}`);
  const data=safeJSON(text)??{};
  const items=firstArrayCandidate(data)||[];
  const hasMore=computeHasMore(data,items,page,pageSize);
  return {items,hasMore};
}

function normalizeQuery(q){
  const out=Object.assign({},q||{});
  for(const k of ["isFavorite","isMotion","isNotInAlbum"]){ const v=boolish(out[k]); if(v===null) delete out[k]; else out[k]=v; }
  for(const k of ["limit","minDurationSec","maxDurationSec","minFileSize","maxFileSize","minWidth","maxWidth","minHeight","maxHeight"]){
    const n=num(out[k]); if(n===null) delete out[k]; else out[k]=n;
  }
  if(out.type!=null && typeof out.type!=="string") delete out.type;
  if(out.takenAfter==="") delete out.takenAfter;
  if(out.takenBefore==="") delete out.takenBefore;
  if(out.createAlbumName==="") delete out.createAlbumName;
  if(out.fileNameStartsWith!=null){
    const s=String(out.fileNameStartsWith||"").trim();
    if(s) out.fileNameStartsWith=s; else delete out.fileNameStartsWith;
  }
  out.replace=Boolean(out.replace);
  return out;
}

function clientFilterOne(a,q){
  if(q.type){ const at=a.type??a.assetType??null; if(at!==q.type) return null; }
  if(q.fileNameStartsWith){
    const pref=q.fileNameStartsWith.toLowerCase();
    const nm=(a.originalFileName||a.fileName||"").toLowerCase();
    if(!nm.startsWith(pref)) return null;
  }
  const sec=parseDurationToSec(a.duration);
  if(q.minDurationSec!=null && (sec==null||sec<q.minDurationSec)) return null;
  if(q.maxDurationSec!=null && (sec==null||sec>q.maxDurationSec)) return null;
  const dims=extractDims(a);
  const width=dims.width, height=dims.height, size=dims.size;
  if(q.minFileSize!=null && (size==null||size<q.minFileSize)) return null;
  if(q.maxFileSize!=null && (size==null||size>q.maxFileSize)) return null;
  if(q.minWidth!=null && (width==null||width<q.minWidth)) return null;
  if(q.maxWidth!=null && (width==null||width>q.maxWidth)) return null;
  if(q.minHeight!=null && (height==null||height<q.minHeight)) return null;
  if(q.maxHeight!=null && (height==null||height>q.maxHeight)) return null;

  return { id:a.id, durationSec:sec, width,height, fileSizeInByte:dims.size??null, originalFileName:a.originalFileName??a.fileName??null, type:a.type??a.assetType??null };
}

async function findOrCreateAlbum(name){
  const q=new URL(`${IMMICH_URL}/albums`); q.searchParams.set("size","1000"); q.searchParams.set("withoutAssets","true");
  const r=await fetch(q,{headers:I_HEADERS});
  if(r.ok){ let data; try{ data=await r.json(); }catch{ data=[]; }
    const list=Array.isArray(data?.items)?data.items:(Array.isArray(data)?data:[]);
    const hit=list.find(a=>a.albumName===name); if(hit) return hit;
  }
  const mk=await fetch(`${IMMICH_URL}/albums`,{method:"POST",headers:I_HEADERS,body:JSON.stringify({albumName:name})});
  if(!mk.ok) throw new Error(`create album failed: ${await mk.text()}`);
  return mk.json();
}
async function getAlbumAssetIds(albumId){
  const assets=await pageSearchAssets({albumIds:[albumId],withExif:false,order:"desc",size:1000},false,Infinity,{});
  return assets.map(a=>a.id);
}

async function pageSearchAssets(body,preferLarge=false,need=Infinity,clientQ={}){
  const kind= preferLarge ? "large" : "meta";
  const pageSize=(body&&body.size)?body.size:1000;
  const out=[]; let page=(body&&body.page)?body.page:1;
  while(true){
    const {items,hasMore}=await fetchSearchPageDetected({kind,body:body||{},page,pageSize});
    if(Array.isArray(items)&&items.length){
      for(const a of items){
        const t=clientFilterOne(a,clientQ);
        if(t){ out.push(t); if(out.length>=need) return out; }
      }
    }
    if(!hasMore) return out;
    page+=1; await sleep(20);
  }
}

app.get("/supersearch/health",(_req,res)=>{ res.json({ok:true,immichApi:IMMICH_URL,webBase:IMMICH_WEB_BASE,routes:ROUTES}); });

app.post("/supersearch/search", async (req,res)=>{
  try{
    const q=normalizeQuery(req.body);
    const limit=Number.isFinite(q.limit)?q.limit:5000;
    const serverBody={
      type:q.type, isMotion:q.isMotion, isFavorite:q.isFavorite, isNotInAlbum:q.isNotInAlbum,
      takenAfter:q.takenAfter, takenBefore:q.takenBefore,
      withExif:true, order:"desc", size:1000
    };
    if(Number.isFinite(q.minFileSize)&&q.minFileSize>0) serverBody.minFileSize=q.minFileSize;
    const preferLarge= Number.isFinite(q.minFileSize)&&q.minFileSize>0;

    const clientQ={
      type:q.type, fileNameStartsWith:q.fileNameStartsWith,
      minDurationSec:q.minDurationSec, maxDurationSec:q.maxDurationSec,
      minFileSize:q.minFileSize, maxFileSize:q.maxFileSize,
      minWidth:q.minWidth, maxWidth:q.maxWidth,
      minHeight:q.minHeight, maxHeight:q.maxHeight
    };

    const selected=await pageSearchAssets(serverBody, preferLarge, limit, clientQ);
    const trimmed=selected.slice(0,limit);

    let album=null, albumUrl=null, replaced=false;
    if(q.createAlbumName){
      const albumObj=await findOrCreateAlbum(q.createAlbumName);
      album={id:albumObj.id, albumName:albumObj.albumName};
      albumUrl=`${IMMICH_WEB_BASE}/albums/${album.id}`;
      const desiredIds=trimmed.map(x=>x.id);
      const haveIds=await getAlbumAssetIds(album.id);
      const haveSet=new Set(haveIds), wantSet=new Set(desiredIds);
      const toAdd=desiredIds.filter(id=>!haveSet.has(id));
      const toRemove=q.replace ? haveIds.filter(id=>!wantSet.has(id)) : [];
      replaced=q.replace && toRemove.length>0;
      for(let i=0;i<toRemove.length;i+=100){
        const ids=toRemove.slice(i,i+100);
        const r=await fetch(`${IMMICH_URL}/albums/${album.id}/assets`,{method:"DELETE",headers:I_HEADERS,body:JSON.stringify({ids})});
        if(!r.ok) throw new Error(`remove from album failed: ${await r.text()}`);
      }
      for(let i=0;i<toAdd.length;i+=100){
        const ids=toAdd.slice(i,i+100);
        const add=await fetch(`${IMMICH_URL}/albums/${album.id}/assets`,{method:"PUT",headers:I_HEADERS,body:JSON.stringify({ids})});
        if(!add.ok) throw new Error(`add to album failed: ${await add.text()}`);
      }
    }

    res.json({ count:trimmed.length, album, albumUrl, sample:trimmed.slice(0,20), replaced });
  }catch(e){ res.status(500).json({error:String(e)}); }
});

await detectRoutes();
app.listen(PORT,"0.0.0.0",()=>{
  console.log(`SuperSearch :${PORT} -> ${IMMICH_URL}`);
  console.log(`Album URLs at: ${IMMICH_WEB_BASE}`);
  console.log(`Routes:`, ROUTES);
});