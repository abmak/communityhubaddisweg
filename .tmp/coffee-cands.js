const https = require("https");
const sharp = require("sharp");

function get(u, depth = 0) {
  return new Promise((res, rej) => {
    https.get(u, { headers: { "User-Agent": "AddisMaed/1.0" } }, (r) => {
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
async function thumb(title, width = 1400) {
  const api = "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=" + width + "&titles=" + encodeURIComponent(title);
  const info = Object.values(JSON.parse((await get(api)).toString()).query.pages)[0].imageinfo[0];
  return get(info.thumburl || info.url);
}
(async () => {
  const ceremony = await thumb("File:Coffee ceremony.jpg");
  const addis = await thumb("File:Ethiopian coffee ceremony - Addis Ababa.jpg");
  const land = await thumb("File:Landmark's Atlantic Plumbing Cinema screening room.jpg");
  const tiles = [
    ["coffee-attention", await sharp(ceremony).resize(640, 640, { fit: "cover", position: "attention" }).toBuffer()],
    ["coffee-north", await sharp(ceremony).resize(640, 640, { fit: "cover", position: "north" }).toBuffer()],
    ["coffee-addis", await sharp(addis).resize(640, 640, { fit: "cover", position: "attention" }).toBuffer()],
    ["cinema-landmark", await sharp(land).resize(640, 640, { fit: "cover", position: "attention" }).toBuffer()],
  ];
  const sheet = await sharp({ create: { width: 1280, height: 1280, channels: 3, background: "#111" } })
    .composite(tiles.map(([, buf], i) => ({ input: buf, left: (i % 2) * 640, top: Math.floor(i / 2) * 640 })))
    .jpeg({ quality: 82 })
    .toBuffer();
  require("fs").writeFileSync("sheet-coffee2.jpg", sheet);
  for (const [name, buf] of tiles) {
    require("fs").writeFileSync(`v-${name}.webp`, await sharp(buf).webp({ quality: 72 }).toBuffer());
  }
  console.log(tiles.map(([n]) => n).join(", "));
})();
