const https = require('https');
const fs = require('fs');
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'addis-maed/1.0 (demo project)' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}
const queries = {
  hotel: 'Addis Ababa hotel building',
  theatre: 'National Theatre Addis Ababa',
  restaurant: 'injera Ethiopian restaurant',
};
(async () => {
  for (const [key, q] of Object.entries(queries)) {
    const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=14&gsrsearch=${encodeURIComponent('filetype:bitmap ' + q)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=600`;
    const data = JSON.parse((await get(api)).toString());
    const pages = Object.values(data.query?.pages ?? {});
    const picks = pages.map((p) => ({
      title: p.title,
      thumb: p.imageinfo?.[0]?.thumburl,
      page: p.imageinfo?.[0]?.descriptionurl,
      artist: (p.imageinfo?.[0]?.extmetadata?.Artist?.value || '').replace(/<[^>]+>/g, '').trim(),
      license: p.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value,
    })).filter((p) => p.thumb);
    fs.writeFileSync(`cand-${key}.json`, JSON.stringify(picks, null, 2));
    console.log(key, picks.length, picks.map((p) => p.title).join(' | '));
  }
})();
