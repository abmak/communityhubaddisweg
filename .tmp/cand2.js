const fs = require('fs');
const sharp = require('sharp');
const https = require('https');
function get(url, depth = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'addis-maed/1.0 (contact: demo@example.com)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && depth < 5) {
        res.resume();
        resolve(get(new URL(res.headers.location, url).toString(), depth + 1));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}
const queries = ['Sheraton Addis Ababa', 'Skylight Hotel Addis', 'Hyatt Regency Addis Ababa', 'hotel lobby Ethiopia'];
(async () => {
  const seen = new Set();
  const picks = [];
  for (const q of queries) {
    const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=${encodeURIComponent('filetype:bitmap ' + q)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=500`;
    const { body } = await get(api);
    const data = JSON.parse(body.toString());
    for (const p of Object.values(data.query?.pages ?? {})) {
      const info = p.imageinfo?.[0];
      if (!info || seen.has(p.title)) continue;
      seen.add(p.title);
      picks.push({ title: p.title.replace('File:', ''), thumb: info.thumburl });
    }
  }
  console.log('candidates', picks.length);
  const files = [];
  for (const [i, pick] of picks.slice(0, 16).entries()) {
    try {
      const image = await get(pick.thumb);
      if (!/^image\//.test(image.type || '')) continue;
      const file = `hotel-${i}.jpg`;
      await sharp(image.body).resize(320, 320, { fit: 'cover' }).jpeg({ quality: 78 }).toFile(file);
      files.push({ file, title: pick.title });
    } catch (error) { console.log('fail', pick.title); }
  }
  const cols = 4, size = 240;
  const rows = Math.ceil(files.length / cols);
  await sharp({ create: { width: cols * size, height: rows * size, channels: 3, background: '#111' } })
    .composite(files.map((f, i) => ({ input: f.file, left: (i % cols) * size, top: Math.floor(i / cols) * size })))
    .jpeg({ quality: 80 }).toFile('sheet-hotels.jpg');
  console.log(files.map((f, i) => `${i} ${f.title}`).join('\n'));
})();
