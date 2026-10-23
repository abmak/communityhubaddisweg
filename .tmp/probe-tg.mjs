const url = "https://t.me/s/Century_Cinema";
const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; AddisMaedBot/1.0)" } });
const html = await r.text();
const blocks = [...html.matchAll(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].map((m) =>
  m[1].replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
);
console.log("blocks:", blocks.length);
for (const b of blocks.slice(-4)) console.log("\n----\n" + b.slice(0, 600));
