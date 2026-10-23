const https = require("https");
const sharp = require("sharp");
function get(u, depth = 0) {
  return new Promise((res, rej) => {
    https.get(u, { headers: { "User-Agent": "AddisMaed/1.0" } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && depth < 6) {
        r.resume();
        return get(new URL(r.headers.location, u).href, depth + 1).then(res, rej);
      }
      const c = [];
      r.on("data", (x) => c.push(x));
      r.on("end", () => res(Buffer.concat(c)));
    }).on("error", rej);
  });
}
const TITLES = [
  "File:Coffee ceremony of Ethiopia and Eritrea 4.jpg",
  "File:Coffee ceremony of Ethiopia and Eritrea 5.jpg",
  "File:Ethiopian coffee ceremony jebena and finjan.jpg",
];
(async () => {
  const tiles = [];
  for (const t of TITLES) {
    const api = "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1400&titles=" + encodeURIComponent(t);
    const info = Object.values(JSON.parse((await get(api)).toString()).query.pages)[0].imageinfo[0];
    try {
      const buf = await sharp(await get(info.thumburl || info.url))
        .resize(640, 640, { fit: "cover", position: "attention" })
        .toBuffer();
      tiles.push(buf);
      console.log(t, "|", info.extmetadata?.LicenseShortName?.value, "|", (info.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, ""));
    } catch (e) {
      console.log("skip", t, e.message);
    }
  }
  const sheet = await sharp({ create: { width: 1280, height: 1280, channels: 3, background: "#111" } })
    .composite(tiles.map((input, i) => ({ input, left: (i % 2) * 640, top: Math.floor(i / 2) * 640 })))
    .jpeg({ quality: 84 })
    .toBuffer();
  require("fs").writeFileSync("sheet-coffee3.jpg", sheet);
})();
