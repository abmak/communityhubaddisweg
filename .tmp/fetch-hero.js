// Fetch and crop the four room photos used by the landing hero mosaic.
const https = require("https");
const fs = require("fs");
const sharp = require("sharp");

const PICKS = [
  { slug: "coffee", title: "File:Coffee ceremony.jpg" },
  { slug: "hiking", title: "File:Simien Mountains Landscape, Ethiopia (2466923746).jpg" },
  {
    slug: "books",
    title: "File:African biography reference books - Main Reading Room - Library of Congress.jpg",
  },
  { slug: "cinema", title: "File:Piccadilly Cinema screen, Perth.jpg" },
];

function get(u, depth = 0) {
  return new Promise((res, rej) => {
    https.get(u, { headers: { "User-Agent": "AddisMaed/1.0 (dev)" } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && depth < 6) {
        r.resume();
        return get(new URL(r.headers.location, u).href, depth + 1).then(res, rej);
      }
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => res(Buffer.concat(chunks)));
    }).on("error", rej);
  });
}

(async () => {
  for (const pick of PICKS) {
    const api =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo" +
      "&iiprop=url|extmetadata|size&iiurlwidth=1400&titles=" +
      encodeURIComponent(pick.title);
    const info = Object.values(JSON.parse((await get(api)).toString()).query.pages)[0].imageinfo[0];
    const raw = await get(info.thumburl || info.url);
    const meta = {
      slug: pick.slug,
      title: pick.title,
      page: info.descriptionurl,
      license: info.extmetadata?.LicenseShortName?.value,
      artist: (info.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").trim(),
    };
    await sharp(raw).resize(900, 900, { fit: "cover", position: "attention" }).jpeg({ quality: 88 }).toFile(`pick-${pick.slug}.jpg`);
    await sharp(raw).resize(640, 640, { fit: "cover", position: "attention" }).webp({ quality: 72 }).toFile(`tile-${pick.slug}-640.webp`);
    console.log(meta.slug, "|", meta.artist, "|", meta.license, "|", meta.page);
  }
})().catch((e) => {
  console.error("FAILED", e.message);
  process.exit(1);
});
