const https=require("https");
const TITLES=[
 "ET Addis asv2018-01 img02 Stadium.jpg",
 "Newspapers in Yaoundé, Cameroon - 2020 (cropped).jpg",
 "Womens in Great Run - Ethiopia.jpg",
 "Blue Boat, Lake Tana (8958188650).jpg",
 "Multifunctional cable and row machines in a gym.jpg",
 "Art gallery guided tour visitors viewing colorful painting.jpg"];
const UA={headers:{'User-Agent':'AddisMaedDemo/1.0 (dev)'}};
function get(url){return new Promise((res,rej)=>{https.get(url,UA,r=>{const c=[];r.on('data',d=>c.push(d));r.on('end',()=>res(Buffer.concat(c)));}).on('error',rej);});}
const strip=s=>(s||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
(async()=>{
 const api="https://commons.wikimedia.org/w/api.php?action=query&titles="+encodeURIComponent(TITLES.map(t=>"File:"+t).join("|"))+"&prop=imageinfo&iiprop=extmetadata&format=json";
 const j=JSON.parse((await get(api)).toString());
 const by={};for(const p of Object.values(j.query.pages))by[p.title.replace(/^File:/,'')]=p;
 for(const t of TITLES){
  const m=by[t]?.imageinfo?.[0]?.extmetadata||{};
  console.log("FILE:",t);
  console.log("  artist:",strip(m.Artist?.value));
  console.log("  credit:",strip(m.Credit?.value).slice(0,80));
  console.log("  license:",strip(m.LicenseShortName?.value));
 }
})();
