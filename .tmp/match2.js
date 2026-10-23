const fs=require('fs'); const sharp=require('sharp');
const finals=['cinema','theatre','hotel','hiking','cafe','restaurant','books'];
const others=['../client/src/assets/rooms/coffee-talk.webp','../client/src/assets/rooms/hiking.webp','../client/src/assets/rooms/books.webp','../client/src/assets/rooms/cinema.webp','../client/src/assets/rooms/sports.webp','coffee-bright.webp','addis-coffee-attention.webp','addis-coffee-north.webp'];
const sig=async f=>sharp(f).resize(16,16,{fit:'fill'}).greyscale().raw().toBuffer();
const dist=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=(a[i]-b[i])**2;return Math.sqrt(s/a.length);};
(async()=>{const o=[];for(const f of others){try{o.push({f,s:await sig(f)});}catch(e){console.log('skip',f);}}
for(const k of finals){const s=await sig(`../client/src/assets/places/${k}.webp`);console.log(k,JSON.stringify(o.map(c=>({f:c.f,d:+dist(s,c.s).toFixed(1)})).sort((a,b)=>a.d-b.d).slice(0,2)));}})();
