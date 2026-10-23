const https=require('https'),fs=require('fs'),path=require('path');
const sharp=require('sharp');
const url='https://upload.wikimedia.org/wikipedia/commons/c/c7/Canadian_artist_Heather_Horton_painting_at_an_easel.jpg';
const UA='AddisMaedDemo/1.0 (local development; contact dev@example.com)';
function get(u,dest,attempt=1){return new Promise((res,rej)=>{https.get(u,{headers:{'User-Agent':UA,'Referer':'https://commons.wikimedia.org/'}},r=>{
  if(r.statusCode===429 && attempt<5){r.resume();return setTimeout(()=>get(u,dest,attempt+1).then(res,rej),2000*attempt);}
  if(r.statusCode!==200){r.resume();return rej(new Error('HTTP '+r.statusCode));}
  const f=fs.createWriteStream(dest);r.pipe(f);f.on('finish',()=>res(dest));}).on('error',rej);});}
(async()=>{
 const raw=path.join(__dirname,'raw-paint2.jpg');
 await get(url,raw);
 const img=sharp(raw); const meta=await img.metadata();
 const side=Math.min(meta.width,meta.height);
 await img.extract({left:Math.round((meta.width-side)/2),top:Math.round((meta.height-side)/2),width:side,height:side}).resize(640,640,{fit:'cover'}).webp({quality:80}).toFile(path.join(__dirname,'try-paint2.webp'));
 console.log(meta.width+'x'+meta.height);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
