const fs=require('fs'); const sharp=require('sharp');
const finals=['cinema','theatre','hotel','hiking','cafe','restaurant','books'];
const cands=fs.readdirSync('.').filter(f=>/\.(jpg|jpeg|png)$/i.test(f) && /^(pl-|th-|hotel-|restaurant-|cafe-|hiking-|cinema-|books-)/.test(f));
const sig=async f=>{const b=await sharp(f).resize(16,16,{fit:'fill'}).greyscale().raw().toBuffer(); return b;};
const dist=(a,b)=>{let s=0; for(let i=0;i<a.length;i++) s+=(a[i]-b[i])**2; return Math.sqrt(s/a.length);};
(async()=>{
 const candSigs=[]; for(const f of cands){ try{ candSigs.push({f,s:await sig(f)});}catch{} }
 for(const k of finals){
   const s=await sig(`../client/src/assets/places/${k}.webp`);
   const ranked=candSigs.map(c=>({f:c.f,d:dist(s,c.s)})).sort((a,b)=>a.d-b.d).slice(0,3);
   console.log(k, JSON.stringify(ranked));
 }
})();
