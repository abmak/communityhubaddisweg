const https=require('https');
function get(url){return new Promise((res,rej)=>{https.get(url,{headers:{'User-Agent':'AddisMaedDemo/1.0 (dev)'}},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}).on('error',rej);});}
(async()=>{
  for (const term of process.argv.slice(2)) {
    const url='https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent('filetype:bitmap '+term)+'&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=900&format=json';
    const j=await get(url);
    console.log('\n=== '+term);
    for (const p of Object.values(j.query?.pages||{})) {
      const ii=p.imageinfo?.[0]; if(!ii) continue;
      const m=ii.extmetadata||{};
      const lic=(m.LicenseShortName?.value||'').replace(/<[^>]+>/g,'');
      const author=(m.Artist?.value||'').replace(/<[^>]+>/g,'').slice(0,50);
      console.log([p.title, lic, author, ii.thumburl].join(' | '));
    }
  }
})();
