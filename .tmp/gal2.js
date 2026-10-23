const https=require("https");const sharp=require("../node_modules/sharp");
const UA={headers:{'User-Agent':'AddisMaedDemo/1.0 (dev)'}};
function get(url){return new Promise((res,rej)=>{https.get(url,UA,r=>{if(r.statusCode>=300&&r.statusCode<400&&r.headers.location)return res(get(r.headers.location));const c=[];r.on('data',d=>c.push(d));r.on('end',()=>res({b:Buffer.concat(c),s:r.statusCode}));}).on('error',rej);});}
const CANDS=["Exhibition view with visitors – RedART, Zürich 2025.jpg","SZ 深圳 大芬油畫村 Da Fen Oil Painting Village art gallery exhibition hall visitors.JPG"];
(async()=>{
 for(const t of CANDS){
  const j=JSON.parse((await get("https://commons.wikimedia.org/w/api.php?action=queryJSON.parse((await get("https://commons.wikimedia.org/w/api.php?action=query&titles="+encodeURIComponent("File:"+t)+"&prop=imageinfo&iiprop=url&iiurlwidth=1000&format=json")).toString())titles="+encodeURIComponent("File:"+t)+"JSON.parse((await get("https://commons.wikimedia.org/w/api.php?action=query&titles="+encodeURIComponent("File:"+t)+"&prop=imageinfo&iiprop=url&iiurlwidth=1000&format=json")).toString())prop=imageinfoJSON.parse((await get("https://commons.wikimedia.org/w/api.php?action=query&titles="+encodeURIComponent("File:"+t)+"&prop=imageinfo&iiprop=url&iiurlwidth=1000&format=json")).toString())iiprop=urlJSON.parse((await get("https://commons.wikimedia.org/w/api.php?action=query&titles="+encodeURIComponent("File:"+t)+"&prop=imageinfo&iiprop=url&iiurlwidth=1000&format=json")).toString())iiurlwidth=1000JSON.parse((await get("https://commons.wikimedia.org/w/api.php?action=query&titles="+encodeURIComponent("File:"+t)+"&prop=imageinfo&iiprop=url&iiurlwidth=1000&format=json")).toString())format=json")).b.toString());
  const p=Object.values(j.query.pages)[0];const ii=p.imageinfo?.[0]; if(!ii){console.log("no ii",t);continue;}
  const r=await get(ii.thumburl||ii.url);
  console.log(t.slice(0,40),"status",r.s,"bytes",r.b.length,r.b.slice(0,4).toString('hex'));
  if(r.b.length>20000){await sharp(r.b).resize(640).webp({quality:74}).toFile("../client/src/assets/places/gallery.webp");console.log("SAVED from",t);return;}
 }
 process.exit(1);
})().catch(e=>{console.error("ERR",e.message);process.exit(1);});
