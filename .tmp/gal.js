const https=require("https");const sharp=require("../node_modules/sharp");
const UA={headers:{'User-Agent':'AddisMaedDemo/1.0 (dev)'}};
function get(url){return new Promise((res,rej)=>{https.get(url,UA,r=>{if(r.statusCode>=300&&r.statusCode<400&&r.headers.location)return res(get(r.headers.location));const c=[];r.on('data',d=>c.push(d));r.on('end',()=>res(Buffer.concat(c)));}).on('error',rej);});}
(async()=>{
 const t=encodeURIComponent("File:Art gallery guided tour visitors viewing colorful painting.jpg");
 const j=JSON.parse((await get("https://commons.wikimedia.org/w/api.php?action=query&titles="+t+"&prop=imageinfo&iiprop=url&iiurlwidth=1000&format=json")).toString());
 const p=Object.values(j.query.pages)[0];const ii=p.imageinfo[0];
 console.log("thumb:",ii.thumburl);console.log("url:",ii.url);
 const buf=await get(ii.thumburl||ii.url);
 console.log("bytes:",buf.length, buf.slice(0,12).toString('hex'));
 await sharp(buf).resize(640).webp({quality:74}).toFile("../client/src/assets/places/gallery.webp");
 console.log("OK gallery.webp");
})().catch(e=>{console.error("ERR",e.message);process.exit(1);});
