const sharp = require("sharp");
const fs = require("fs");

(async () => {
  // Coffee: pick a wide band of the square crop that keeps the face and the cups.
  const coffee = sharp("pick-coffee.jpg");
  const cm = await coffee.metadata();
  const offsets = [0, 80, 160, 240];
  const tiles = [];
  for (const y of offsets) {
    tiles.push(
      await sharp("pick-coffee.jpg")
        .extract({ left: 0, top: y, width: cm.width, height: Math.min(560, cm.height - y) })
        .resize(640, 400, { fit: "cover" })
        .toBuffer(),
    );
  }
  fs.writeFileSync(
    "sheet-coffee-wide.jpg",
    await sharp({ create: { width: 1280, height: 800, channels: 3, background: "#111" } })
      .composite(tiles.map((buf, i) => ({ input: buf, left: (i % 2) * 640, top: Math.floor(i / 2) * 400 })))
      .jpeg({ quality: 85 })
      .toBuffer(),
  );
  console.log("coffee offsets", offsets.join(","), "source", cm.width + "x" + cm.height);
})();
