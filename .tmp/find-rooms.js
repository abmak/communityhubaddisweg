// Build contact sheets of candidate Commons photos per topic so we can pick hero tiles.
const https = require("https");
const sharp = require("sharp");

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

const TOPICS = process.argv[2]
  ? { [process.argv[2]]: process.argv[3] }
  : {
      hiking: "Simien Mountains landscape",
      books: "books reading library",
      cinema: "cinema audience screening",
      sports: "athletics running race",
    };

(async () => {
  for (const [slug, query] of Object.entries(TOPICS)) {
    const api =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=" +
      encodeURIComponent(query) +
      "&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400";
    const json = JSON.parse((await get(api)).toString());
    if (!json.query) {
      console.log(`\n== ${slug} == no results for "${query}"`);
      continue;
    }
    const pages = Object.values(json.query.pages);
    const tiles = [];
    const meta = [];
    for (const p of pages) {
      const info = p.imageinfo && p.imageinfo[0];
      if (!info) continue;
      try {
        const buf = await sharp(await get(info.thumburl || info.url))
          .resize(300, 220, { fit: "cover" })
          .toBuffer();
        tiles.push(buf);
        meta.push({
          title: p.title,
          page: info.descriptionurl,
          license: info.extmetadata?.LicenseShortName?.value,
          artist: (info.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").trim(),
        });
      } catch (e) {}
      if (tiles.length === 9) break;
    }
    const cols = 3;
    const rows = Math.ceil(tiles.length / cols);
    await sharp({ create: { width: cols * 300, height: rows * 220, channels: 3, background: "#111" } })
      .composite(tiles.map((input, i) => ({ input, left: (i % cols) * 300, top: Math.floor(i / cols) * 220 })))
      .jpeg({ quality: 82 })
      .toFile(`sheet-${slug}.jpg`);
    console.log(`\n== ${slug} ==`);
    meta.forEach((m, i) => console.log(i, m.title, "|", m.license));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
