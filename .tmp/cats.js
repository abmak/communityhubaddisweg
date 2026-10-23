const http=require('http');
http.get('http://127.0.0.1:4000/api/categories',res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{const j=JSON.parse(d);for(const c of j.categories) console.log(c.sortOrder,c.slug,c.name,c.icon,c.color,c.postCount+' posts');});});
