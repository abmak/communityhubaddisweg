const https=require('https'),fs=require('fs'),path=require('path');
const sharp=require('sharp');
const jobs=[
 {out:'try-music.webp', url:'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/Krar_player%2C_ethiopia.jpg/960px-Krar_player%2C_ethiopia.jpg'},
 {out:'try-paint.webp', url:'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/50/Chris_OMoore_painting_at_easel_2023.jpg/960px-Chris_OMoore_painting_at_easel_2023.jpg'},
];
const UA='AddisMaedDemo/1.0 (local development; contact dev@example.com)';
function get(url,dest,attempt=1){return new Promise((res,rej)=>{https.get(url,{headers:{'User-Agent':UA,'Referer':'https://commons.wikimedia.org/'}},r=>{
  if(r.statusCode===429 && attempt<4){r.resume();return setTimeout(()=>get(url,dest,attempt+1).then(res,rej),1500*attempt);}
  if(r.statusCode!==200){r.resume();return rej(new Error('HTTP '+r.statusCode));}
  const f=fs.createWriteStream(dest);r.pipe(f);f.on('finish',()=>res(dest));}).on('error',rej);});}
(async()=>{
 for(const job of jobs){
  const raw=path.join(__dirname,'raw-'+job.out.replace('.webp','.jpg'));
  await get(job.url,raw);
  const img=sharp(raw); const meta=await img.metadata();
  const side=Math.min(meta.width,meta.height);
  const out=path.join(__dirname,job.out);
  await img.extract({left:Math.round((meta.width-side)/2),top:Math.round((meta.height-side)/2),width:side,height:side}).resize(640,640,{fit:'cover'}).webp({quality:80}).toFile(out);
  console.log(job.out, meta.width+'x'+meta.height, Math.round(fs.statSync(out).size/1024)+'kb');
  await new Promise(r=>setTimeout(r,1000));
 }
})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
