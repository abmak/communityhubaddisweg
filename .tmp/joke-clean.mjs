const API = "http://localhost:4000";
async function login(identifier) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password: "Password123!" }),
  });
  const cookies = (r.headers.getSetCookie?.() ?? []).map((e) => e.split(";")[0]);
  return { cookie: cookies.join("; "), csrf: cookies.find((e) => e.startsWith("ch_csrf="))?.split("=")[1] };
}
async function call(s, path, method = "GET", body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: s.cookie, "x-csrf-token": s.csrf },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, data };
}
const admin = await login("admin@communityhub.et");
const list = await call(admin, "/api/admin/joke-sessions");
const sessions = list.data.sessions;
const demo = sessions.find((s) => s.jokeCount > 0);
const strays = sessions.filter((s) => s.id !== demo.id && s.jokeCount === 0);
for (const stray of strays) {
  const removed = await call(admin, `/api/admin/joke-sessions/${stray.id}`, "DELETE");
  console.log("deleted stray session", stray.id, removed.status);
}
const restored = await call(admin, `/api/admin/joke-sessions/${demo.id}`, "PATCH", {
  opensAt: new Date(Date.now() - 3600_000).toISOString(),
  closesAt: new Date(Date.now() + 6 * 3600_000).toISOString(),
});
console.log("restored demo window:", restored.status, restored.data?.session?.status);
const feed = await call(admin, "/api/jokes");
for (const joke of feed.data.jokes ?? []) {
  if (joke.body.startsWith("Test joke:")) {
    const removed = await call(admin, `/api/jokes/${joke.id}`, "DELETE");
    console.log("deleted test joke", joke.id, removed.status);
  }
}
const after = await call(admin, "/api/jokes");
console.log(
  JSON.stringify({
    status: after.data.session?.status,
    jokes: after.data.jokes.length,
    leftovers: after.data.jokes.filter((j) => j.body.startsWith("Test joke:")).length,
    scores: after.data.jokes.map((j) => j.score),
  }),
);
