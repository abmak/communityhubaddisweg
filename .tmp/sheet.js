const fs = require('fs');
const sharp = require('sharp');
const https = require('https');
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'addis-maed/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.headers.location) return resolve(get(res.headers.location));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}
(async () => {
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
  const thumbs = [];
  for (const [key, title] of picks) {
    const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent('File:' + title)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=700`;
    const data = JSON.parse((await get(api)).toString());
    const page = Object.values(data.query.pages)[0];
    const info = page.imageinfo?.[0];
    if (!info) { console.log('miss', title); continue; }
    const buf = await get(info.thumburl);
    const file = `cand-${key}-${thumbs.length}.jpg`;
    await sharp(buf).resize(700, 700, { fit: 'cover' }).jpeg({ quality: 82 }).toFile(file);
    thumbs.push({ file, key, title, artist: (info.extmetadata?.Artist?.value || '').replace(/<[^>]+>/g, '').trim(), license: info.extmetadata?.LicenseShortName?.value, page: info.descriptionurl });
    console.log('ok', title, thumbs.length - 1);
  }
  fs.writeFileSync('picks.json', JSON.stringify(thumbs, null, 2));
  const cols = 3, size = 300;
  const rows = Math.ceil(thumbs.length / cols);
  const composite = thumbs.map((t, i) => ({ input: t.file, left: (i % cols) * size, top: Math.floor(i / cols) * size }));
  await sharp({ create: { width: cols * size, height: rows * size, channels: 3, background: '#111' } }).composite(composite).jpeg({ quality: 80 }).toFile('sheet-places.jpg');
  console.log(thumbs.map((t, i) => `${i}: ${t.key} ${t.title} (${t.license})`).join('\n'));
})();
