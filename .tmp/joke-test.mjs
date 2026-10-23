const API = "http://localhost:4000";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log("ok -", message);
}

async function login(identifier) {
  const response = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password: "Password123!" }),
  });
  const data = await response.json();
  assert(response.status === 200, `login ${identifier}`);
  const cookies = (response.headers.getSetCookie?.() ?? []).map((entry) => entry.split(";")[0]);
  return {
    user: data.user,
    cookie: cookies.join("; "),
    csrf: cookies.find((entry) => entry.startsWith("ch_csrf="))?.split("=")[1],
  };
}

async function call(session, path, { method = "GET", body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Cookie: session.cookie, "x-csrf-token": session.csrf } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

const TEST_PREFIX = "Test joke:";
const HOUR_MS = 60 * 60 * 1000;
const windowFrom = (openHoursAgo, closeHoursAhead) => ({
  opensAt: new Date(Date.now() - openHoursAgo * HOUR_MS).toISOString(),
  closesAt: new Date(Date.now() + closeHoursAhead * HOUR_MS).toISOString(),
});

const selam = await login("selam@communityhub.et");
const admin = await login("admin@communityhub.et");
const hana = await login("hana@communityhub.et");

// The migration grants the new capability to administrators only.
const adminMe = await call(admin, "/api/admin/me");
assert(adminMe.data.permissions.includes("admin.jokes.manage"), "admin can schedule Joke Time");
const modMe = await call(hana, "/api/admin/me");
assert(!modMe.data.permissions.includes("admin.jokes.manage"), "moderator cannot schedule Joke Time");
const modAttempt = await call(hana, "/api/admin/joke-sessions", {
  method: "POST",
  body: windowFrom(0, 1),
});
assert(modAttempt.status === 403, "moderator scheduling is rejected with 403");

// --- Reset: reopen the demo window and drop anything a previous run created,
// so the suite is repeatable instead of depending on leftover rows.
const scheduled = await call(admin, "/api/admin/joke-sessions");
const demoSession = scheduled.data.sessions.find((session) => session.jokeCount > 0) ?? scheduled.data.sessions[0];
assert(Boolean(demoSession), "a Joke Time session exists");
const sessionId = demoSession.id;

const reopened = await call(admin, `/api/admin/joke-sessions/${sessionId}`, {
  method: "PATCH",
  body: windowFrom(1, 1),
});
assert(reopened.status === 200, "demo window temporarily reopened");

const stale = await call(null, "/api/jokes");
for (const joke of stale.data.jokes ?? []) {
  if (joke.body.startsWith(TEST_PREFIX)) {
    await call(admin, `/api/jokes/${joke.id}`, { method: "DELETE" });
  }
}

const feed = await call(null, "/api/jokes");
assert(feed.data.session?.status === "OPEN", "seed session is open");
assert(feed.data.session.id === sessionId, "feed serves the demo session");
assert(!feed.data.jokes.some((joke) => joke.body.startsWith(TEST_PREFIX)), "board starts clean");
assert(feed.data.jokes.length >= 5, "seed jokes are present");

// Sharing
const jokeA = await call(selam, "/api/jokes", {
  method: "POST",
  body: { body: `${TEST_PREFIX} I named my wifi 'Ethiopian Time' so everyone knows it arrives eventually.` },
});
assert(jokeA.status === 201, "member shares a joke");
const jokeB = await call(hana, "/api/jokes", {
  method: "POST",
  body: { body: `${TEST_PREFIX} My budget has trust issues with my coffee habit.` },
});
assert(jokeB.status === 201, "second member shares a joke");
const anonymousPost = await call(null, "/api/jokes", { method: "POST", body: { body: "nope" } });
assert(anonymousPost.status === 401, "anonymous sharing rejected");

// Reactions push A to the top.
const like = await call(admin, `/api/jokes/${jokeA.data.joke.id}/like`, { method: "POST" });
assert(like.data.likeCount === 1, "like counted");
const likeA2 = await call(hana, `/api/jokes/${jokeA.data.joke.id}/like`, { method: "POST" });
assert(likeA2.data.likeCount === 2, "second like counted");
const likeAgain = await call(hana, `/api/jokes/${jokeA.data.joke.id}/like`, { method: "POST" });
assert(likeAgain.data.likeCount === 2, "repeat like is idempotent");
for (const voter of [hana, admin, selam]) {
  const posted = await call(voter, `/api/jokes/${jokeA.data.joke.id}/comments`, {
    method: "POST",
    body: { body: "This one got me." },
  });
  assert(posted.status === 201, "comment added");
}
const likeB = await call(selam, `/api/jokes/${jokeB.data.joke.id}/like`, { method: "POST" });
assert(likeB.data.likeCount === 1, "like on the second joke");
await call(hana, `/api/jokes/${jokeB.data.joke.id}/comments`, {
  method: "POST",
  body: { body: "Solid follow-up." },
});

// Close the session early to check the winner and the freeze.
const closed = await call(admin, `/api/admin/joke-sessions/${sessionId}`, {
  method: "PATCH",
  body: { closesAt: new Date(Date.now() - 60_000).toISOString() },
});
assert(closed.status === 200 && closed.data.session.status === "CLOSED", "admin closes the session");

const closedFeed = await call(null, "/api/jokes");
assert(closedFeed.data.session.status === "CLOSED", "feed reports the session as closed");
assert(closedFeed.data.winner?.id === jokeA.data.joke.id, "winner is the joke with the most likes + comments");
assert(closedFeed.data.winner.score === 5, "winner score is likes plus comments");
assert(closedFeed.data.jokes[0].id === jokeA.data.joke.id, "closed board is led by the winner");
const ordered = closedFeed.data.jokes.map((joke) => joke.score);
assert(
  ordered.every((score, index) => index === 0 || ordered[index - 1] >= score),
  "closed feed is ranked by score",
);

const closedLike = await call(admin, `/api/jokes/${jokeB.data.joke.id}/like`, { method: "POST" });
assert(closedLike.status === 400, "liking after close is rejected");
const closedComment = await call(admin, `/api/jokes/${jokeB.data.joke.id}/comments`, {
  method: "POST",
  body: { body: "late comment" },
});
assert(closedComment.status === 400, "commenting after close is rejected");
const closedPost = await call(admin, "/api/jokes", { method: "POST", body: { body: "late joke" } });
assert(closedPost.status === 400, "sharing after close is rejected");

// --- Teardown: hand the demo window back open, then check the overlap guard
// against that live window before removing this run's jokes.
const restored = await call(admin, `/api/admin/joke-sessions/${sessionId}`, {
  method: "PATCH",
  body: windowFrom(1, 6),
});
assert(restored.status === 200 && restored.data.session.status === "OPEN", "demo session restored to open");

const overlap = await call(admin, "/api/admin/joke-sessions", {
  method: "POST",
  body: { opensAt: new Date(Date.now() - 60_000).toISOString(), closesAt: new Date(Date.now() + HOUR_MS).toISOString() },
});
assert(overlap.status === 409, "overlapping schedule is rejected");

for (const joke of [jokeA, jokeB]) {
  const removed = await call(admin, `/api/jokes/${joke.data.joke.id}`, { method: "DELETE" });
  assert(removed.status === 204 || removed.status === 200, "test joke cleaned up");
}

const openFeed = await call(null, "/api/jokes");
assert(openFeed.data.session.status === "OPEN", "feed is open again");
assert(openFeed.data.winner === null, "no winner while a session is open");
assert(openFeed.data.canPost === false, "anonymous visitors cannot share");
assert(!openFeed.data.jokes.some((joke) => joke.body.startsWith(TEST_PREFIX)), "board left clean");

console.log("\nALL JOKE TIME TESTS PASSED");
process.exit(process.exitCode ?? 0);
