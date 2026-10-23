const https = require("https");
const sharp = require("sharp");
const fs = require("fs");
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
(async () => {
  const api = "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600&titles=" + encodeURIComponent("File:Ethiopian coffee ceremony - Addis Ababa.jpg");
  const info = Object.values(JSON.parse((await get(api)).toString()).query.pages)[0].imageinfo[0];
  const raw = await get(info.thumburl || info.url);
  fs.writeFileSync("addis-coffee-raw.jpg", raw);
  const m = await sharp(raw).metadata();
  console.log("source", m.width + "x" + m.height, info.extmetadata?.LicenseShortName?.value, (info.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, ""));
  for (const [name, pos] of [["attention", "attention"], ["north", "north"]]) {
    await sharp(raw).resize(640, 640, { fit: "cover", position: pos }).webp({ quality: 74 }).toFile(`addis-coffee-${name}.webp`);
  }
})().catch((e) => { console.error("FAILED", e.message); process.exit(1); });
