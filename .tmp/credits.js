const https = require('https');
function get(url, depth = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'addis-maed/1.0 (contact: demo@example.com)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && depth < 5) {
        res.resume(); resolve(get(new URL(res.headers.location, url).toString(), depth + 1)); return;
      }
      const c = []; res.on('data', (x) => c.push(x)); res.on('end', () => resolve(Buffer.concat(c)));
    }).on('error', reject);
  });
}
const files = ['Skyline Hotel 2.jpg', 'War Horse (8570054457).jpg', 'Veggie combo at Fassil Restaurant.jpg'];
(async () => {
  for (const title of files) {
    const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent('File:' + title)}&prop=imageinfo&iiprop=url|extmetadata`;
    const info = Object.values(JSON.parse((await get(api)).toString()).query.pages)[0].imageinfo[0];
    const strip = (v) => (v || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    console.log(JSON.stringify({ title, artist: strip(info.extmetadata.Artist?.value), license: info.extmetadata.LicenseShortName?.value, page: info.descriptionurl }, null, 2));
  }
})();
