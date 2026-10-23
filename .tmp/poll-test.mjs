import { io } from "socket.io-client";

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
  assert(response.status === 200, `login ${identifier} (${response.status})`);
  const raw = response.headers.getSetCookie?.() ?? [];
  const cookies = raw.map((entry) => entry.split(";")[0]);
  const csrf = cookies.find((entry) => entry.startsWith("ch_csrf="))?.split("=")[1];
  const token = cookies.find((entry) => entry.startsWith("ch_token="))?.split("=").slice(1).join("=");
  return {
    user: data.user,
    cookie: cookies.join("; "),
    csrf,
    token,
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

const selam = await login("selam@communityhub.et");
const admin = await login("admin@communityhub.et");
const hana = await login("hana@communityhub.et");

// Calendar preference round-trip.
const preference = await call(selam, "/api/users/me", {
  method: "PATCH",
  body: { calendarPreference: "ETHIOPIAN" },
});
assert(preference.status === 200, "PATCH calendar preference");
assert(
  preference.data?.user?.calendarPreference === "ETHIOPIAN",
  "preference returned as ETHIOPIAN",
);
const sessionMe = await call(selam, "/api/auth/me");
assert(
  sessionMe.data?.user?.calendarPreference === "ETHIOPIAN",
  "preference persists on /api/auth/me",
);
await call(selam, "/api/users/me", { method: "PATCH", body: { calendarPreference: "GREGORIAN" } });

// Poll creation.
const categories = await call(null, "/api/categories");
const category = categories.data.categories.find((item) => item.kind === "DISCUSSION");
assert(Boolean(category), "found a discussion room");

const created = await call(selam, "/api/posts", {
  method: "POST",
  body: {
    categoryId: category.id,
    body: "",
    poll: {
      question: "Best Ethiopian movie of the decade?",
      options: ["Lambadina", "Teza", "Difret"],
    },
  },
});
assert(created.status === 201, `poll post created (${created.status})`);
const post = created.data.post;
assert(post.poll?.options?.length === 3, "poll has three options");
assert(post.poll?.totalVotes === 0, "new poll starts at zero votes");

// Validation: one option is rejected.
const invalid = await call(selam, "/api/posts", {
  method: "POST",
  body: {
    categoryId: category.id,
    poll: { question: "Too short?", options: ["Only one"] },
  },
});
assert(invalid.status === 400, "poll with one option is rejected");

// Real-time: a socket connected as Selam should hear about Admin's vote.
const socket = io(API, { auth: { token: selam.token }, transports: ["websocket"] });
const update = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("no poll:update within 8s")), 8000);
  socket.on("poll:update", (payload) => {
    if (payload.postId !== post.id) return;
    clearTimeout(timer);
    resolve(payload);
  });
});
await new Promise((resolve, reject) => {
  socket.on("connect", resolve);
  socket.on("connect_error", reject);
});

const optionA = post.poll.options[0];
const optionB = post.poll.options[1];

const voteAdmin = await call(admin, `/api/posts/${post.id}/poll/vote`, {
  method: "POST",
  body: { optionId: optionA.id },
});
assert(voteAdmin.status === 200, "admin vote accepted");
assert(voteAdmin.data.poll.totalVotes === 1, "total votes is 1 after first vote");

const broadcast = await update;
assert(broadcast.totalVotes === 1, "socket broadcast carried the new vote total");

// Same user voting again for the same option is idempotent.
const repeat = await call(admin, `/api/posts/${post.id}/poll/vote`, {
  method: "POST",
  body: { optionId: optionA.id },
});
assert(repeat.data.poll.totalVotes === 1, "repeat vote does not double count");

// Moving a vote shifts the counts.
const moved = await call(admin, `/api/posts/${post.id}/poll/vote`, {
  method: "POST",
  body: { optionId: optionB.id },
});
const optionAcount = moved.data.poll.options.find((option) => option.id === optionA.id).voteCount;
const optionBcount = moved.data.poll.options.find((option) => option.id === optionB.id).voteCount;
assert(optionAcount === 0 && optionBcount === 1, "moving a vote updates both options");
assert(moved.data.poll.myOptionId === optionB.id, "myOptionId reflects the new choice");

// A second member adds an independent vote.
const voteHana = await call(hana, `/api/posts/${post.id}/poll/vote`, {
  method: "POST",
  body: { optionId: optionA.id },
});
assert(voteHana.data.poll.totalVotes === 2, "second member raises total to 2");

// Unknown option is rejected.
const badOption = await call(hana, `/api/posts/${post.id}/poll/vote`, {
  method: "POST",
  body: { optionId: "not-a-real-option" },
});
assert(badOption.status === 400, "unknown option is rejected");

// Anonymous view cannot see anyone's vote, but sees counts.
const anonymous = await call(null, `/api/posts/${post.id}`);
assert(anonymous.data.post.poll.myOptionId === null, "anonymous viewer has no vote");
assert(anonymous.data.post.poll.totalVotes === 2, "anonymous viewer sees the tally");

// Viewer-specific vote state.
const selamView = await call(selam, `/api/posts/${post.id}`);
assert(selamView.data.post.poll.myOptionId === null, "Selam has not voted yet");

socket.close();

// Clean up the test post so the demo feed stays tidy.
const removed = await call(selam, `/api/posts/${post.id}`, { method: "DELETE" });
assert(removed.status === 204, "test post deleted");

console.log("\nALL POLL TESTS PASSED");
process.exit(process.exitCode ?? 0);
