const https = require("https");
const fs = require("fs");
const sharp = require("../node_modules/sharp");

const UA = { headers: { "User-Agent": "AddisMaedDemo/1.0 (dev)" } };

const WANTS = [
  ["ET Addis asv2018-01 img02 Stadium.jpg", "../client/src/assets/rooms/sports.webp"],
  ["Newspapers in Yaoundé, Cameroon - 2020 (cropped).jpg", "../client/src/assets/rooms/news.webp"],
  ["Womens in Great Run - Ethiopia.jpg", "../client/src/assets/rooms/exercise.webp"],
  ["Blue Boat, Lake Tana (8958188650).jpg", "../client/src/assets/rooms/travel.webp"],
  ["Multifunctional cable and row machines in a gym.jpg", "../client/src/assets/places/gym.webp"],
  ["Art gallery guided tour visitors viewing colorful painting.jpg", "../client/src/assets/places/gallery.webp"],
];

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, UA, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return res(get(r.headers.location));
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => res(Buffer.concat(chunks)));
    }).on("error", rej);
  });
}

(async () => {
  const titles = WANTS.map(([t]) => `File:${t}`).join("|");
  const api =
    "https://commons.wikimedia.org/w/api.php?action=query&titles=" +
    encodeURIComponent(titles) +
    "&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=1200&format=json";
  const meta = JSON.parse((await get(api)).toString());
  const byTitle = {};
  for (const p of Object.values(meta.query.pages)) byTitle[p.title.replace(/^File:/, "")] = p;

  for (const [title, dest] of WANTS) {
    const page = byTitle[title];
    const info = page?.imageinfo?.[0];
    if (!info) { console.error("MISSING", title); continue; }
    const url = info.thumburl || info.url;
    const buf = await get(url.split("?")[0]);
    await sharp(buf).resize(640).webp({ quality: 74 }).toFile(dest);
    const lic = (info.extmetadata?.LicenseShortName?.value || "").replace(/<[^>]+>/g, "");
    console.log("OK", dest, buf.length, "->", lic);
  }
})();
