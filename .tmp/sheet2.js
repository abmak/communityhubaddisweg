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
const picks = [
  ['hotel', 'Golden Tulip Addis Ababa Hotel External.jpg'],
  ['hotel', 'Model of Sheraton Addis.jpg'],
  ['hotel', 'Addis Ababa light rail street view.jpg'],
  ['theatre', 'Ethiopian National Theater 1.jpg'],
  ['theatre', 'Ethiopian National Theater 2.jpg'],
  ['theatre', 'Ethiopian National Theatre.jpg'],
  ['restaurant', 'Injera be wat.jpg'],
  ['restaurant', 'Ethiopian Food.jpg'],
  ['restaurant', 'Veggie combo at Fassil Restaurant.jpg'],
];
(async () => {
  const thumbs = [];
  for (const [key, title] of picks) {
    try {
      const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent('File:' + title)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=700`;
      const { body } = await get(api);
      const data = JSON.parse(body.toString());
      const info = Object.values(data.query.pages)[0]?.imageinfo?.[0];
      if (!info) { console.log('miss', title); continue; }
      const image = await get(info.thumburl);
      if (!/^image\//.test(image.type || '')) { console.log('bad-type', title, image.status, image.type); continue; }
      const file = `pl-${key}-${thumbs.length}.jpg`;
      await sharp(image.body).resize(720, 720, { fit: 'cover' }).jpeg({ quality: 82 }).toFile(file);
      thumbs.push({ file, key, title, artist: (info.extmetadata?.Artist?.value || '').replace(/<[^>]+>/g, '').trim(), license: info.extmetadata?.LicenseShortName?.value, page: info.descriptionurl });
      console.log('ok', thumbs.length - 1, title);
    } catch (error) {
      console.log('fail', title, error.message);
    }
  }
  fs.writeFileSync('picks.json', JSON.stringify(thumbs, null, 2));
  const cols = 3, size = 300;
  const rows = Math.ceil(thumbs.length / cols);
  const composite = thumbs.map((t, i) => ({ input: t.file, left: (i % cols) * size, top: Math.floor(i / cols) * size }));
  await sharp({ create: { width: cols * size, height: rows * size, channels: 3, background: '#111' } }).composite(composite).jpeg({ quality: 80 }).toFile('sheet-places.jpg');
})();
