const tdb = "https://www.thesportsdb.com/api/v1/json/123/eventsnextleague.php?id=4959";
const tg = "https://t.me/s/Century_Cinema";
const century = "https://centuryaddismall.com/";
async function probe(name, url, kind) {
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; AddisMaedBot/1.0)" } });
    const text = await r.text();
    console.log(`\n== ${name} == status ${r.status} len ${text.length} ctype ${r.headers.get("content-type")}`);
    if (kind === "json") {
      const j = JSON.parse(text);
      const arr = j.events ?? j.results ?? null;
      console.log("keys:", Object.keys(j));
      if (arr) {
        console.log("count:", arr.length);
        console.log("first:", JSON.stringify(arr[0], null, 1).slice(0, 700));
      }
    } else {
      console.log(text.replace(/\s+/g, " ").slice(0, 700));
    }
  } catch (e) {
    console.log(`\n== ${name} == ERROR ${e.message}`);
  }
}
await probe("thesportsdb EPL fixtures", tdb, "json");
await probe("century mall", century, "html");
await probe("century cinema telegram", tg, "html");
