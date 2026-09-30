import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { chromium, request, expect as baseExpect } from "@playwright/test";
import pg from "pg";

const expect = baseExpect.configure({ timeout: 20000 });
const baseURL = process.env.E2E_URL ?? "http://127.0.0.1:3101";
const dbUrl = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
assert.equal(process.env.RUN_E2E, "1", "Explicit RUN_E2E=1 is required");
assert.ok(dbUrl.pathname.endsWith("_test"), "Never run E2E resets on a live database");
assert.ok(["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname), "E2E is local-only");
const sql = new pg.Client({ connectionString: process.env.DATABASE_URL });
await sql.connect();
await sql.query('TRUNCATE "User", "AppSettings", "RateLimitBucket" CASCADE');
await sql.end();
await mkdir("build/workspace-qa", { recursive: true });
let anonymous = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
let other = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
const password = `Verification#${randomUUID()}`;
const accounts = [0, 1].map((i) => ({ email: `qa-${i}-${randomUUID()}@example.invalid`, name: `Verification ${i}`, password }));
assert.equal((await anonymous.get("/api/workspace/today")).status(), 401);
const signup = await Promise.all([anonymous.post("/api/auth/signup", { data: accounts[0] }), other.post("/api/auth/signup", { data: accounts[1] })]);
const users = await Promise.all(signup.map(async (response) => { assert.equal(response.status(), 201, await response.text()); return (await response.json()).data; }));
// APIRequestContext excludes Secure cookies on HTTP loopback. Browser login below
// still exercises the real Secure cookie; only these direct API probes attach it.
for (const [index, client] of [anonymous, other].entries()) {
  const cookie = signup[index].headersArray().filter((header) => header.name.toLowerCase() === "set-cookie").map((header) => header.value.split(";")[0]).join("; ");
  assert.ok(cookie, "Signup must establish a session");
  const authenticated = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL, Cookie: cookie } });
  await client.dispose();
  if (index === 0) anonymous = authenticated;
  else other = authenticated;
}
assert.equal(users.filter((user) => user.role === "ADMIN").length, 1, "Concurrent bootstrap must elect exactly one admin");
const adminIndex = users.findIndex((user) => user.role === "ADMIN");
const adminApi = adminIndex === 0 ? anonymous : other;
const stranger = adminIndex === 0 ? other : anonymous;
assert.equal((await adminApi.patch("/api/settings", { data: { reminderEmailEnabled: false, reminderDiscordEnabled: false, reminderInAppEnabled: true } })).status(), 200);
assert.equal((await stranger.get("/api/settings")).status(), 403);
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}), headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email", { exact: true }).fill(accounts[adminIndex].email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByText("Nothing needs booking right now")).toBeVisible();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const day = (offset) => { const value = new Date(`${today}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + offset); return value.toISOString().slice(0, 10); };
  await page.getByRole("button", { name: "Add trip", exact: true }).first().click();
  const form = page.getByRole("dialog", { name: "Add trip" });
  await form.getByLabel("From station code").fill("MDU"); await form.getByLabel("To station code").fill("MS");
  await form.getByLabel("From station name").fill("Madurai"); await form.getByLabel("To station name").fill("Chennai Egmore");
  await form.getByLabel("Travel date").fill(day(59));
  await form.getByLabel("Add return journey").check(); await form.getByLabel("Return date").fill(day(65));
  await form.getByLabel("Notes").fill("Browser-created trip");
  await form.getByRole("button", { name: "Add both trips" }).click();
  const detail = page.getByRole("dialog", { name: "Trip details" });
  await expect(detail.getByText("No PNR linked", { exact: true })).toBeVisible();
  await expect(detail.getByText("Linked journey", { exact: true })).toBeVisible();
  const id = new URL(page.url()).searchParams.get("trip"); assert.ok(id);
  let list = (await (await adminApi.get("/api/workspace/trips")).json()).data;
  assert.equal(list.total, 2); assert.ok(list.tickets.every((trip) => !trip.pnrTagged));
  for (const method of ["get", "patch", "delete"]) assert.equal((await stranger[method](`/api/journeys/${id}`, method === "patch" ? { data: { version: 1, notes: "Not yours" } } : {})).status(), 404);
  assert.equal((await adminApi.patch(`/api/journeys/${id}`, { headers: { Origin: "https://attacker.invalid" }, data: { version: 1 } })).status(), 403);
  await detail.getByRole("button", { name: "Edit trip", exact: true }).click();
  await page.getByRole("dialog", { name: "Edit trip" }).getByLabel("Notes").fill("");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(detail.getByText("No PNR linked", { exact: true })).toBeVisible();
  const saved = (await (await adminApi.get(`/api/journeys/${id}`)).json()).data.ticket;
  assert.equal(saved.notes, undefined);
  assert.equal((await adminApi.patch(`/api/journeys/${id}`, { data: { version: 1, notes: "stale" } })).status(), 409);
  await page.keyboard.press("Escape");
  const worker = await adminApi.post("/api/internal/reminders/process", { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  assert.equal(worker.status(), 200, await worker.text());
  await page.reload();
  await page.getByRole("button", { name: /Notifications,/ }).click();
  await expect(page.getByRole("dialog", { name: "Notifications", exact: true })).toBeVisible();
  await page.getByRole("heading", { name: "Today", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Notifications", exact: true })).toBeHidden();
  let notices = (await (await adminApi.get("/api/notifications")).json()).data;
  assert.equal(notices.unreadCount, 1);
  const noticeId = notices.items[0].id;
  await stranger.patch("/api/notifications", { data: { ids: [noticeId] } });
  assert.equal((await (await adminApi.get("/api/notifications")).json()).data.unreadCount, 1, "Another user cannot read your notices");
  await adminApi.patch("/api/notifications", { data: { ids: [noticeId], snoozeMinutes: 60 } });
  assert.equal((await (await adminApi.get("/api/notifications")).json()).data.unreadCount, 0);
  await adminApi.patch("/api/notifications", { data: { ids: [noticeId] } });
  await page.goto(`${baseURL}/trips?trip=${id}`);
  await detail.getByRole("button", { name: "Mark booked", exact: true }).click();
  await expect(detail.getByText("Booked. Booking reminders are stopped.")).toBeVisible();
  let trip = (await (await adminApi.get(`/api/journeys/${id}`)).json()).data.ticket;
  assert.equal(trip.status, "BOOKED"); assert.equal(trip.pnrTagged, false);
  await detail.getByRole("button", { name: "Link PNR", exact: true }).click();
  await detail.getByLabel("PNR", { exact: true }).fill("1234567890");
  await detail.getByRole("button", { name: "Save PNR" }).click();
  await expect(detail.getByText("PNR ending 7890", { exact: true })).toBeVisible();
  trip = (await (await adminApi.get(`/api/journeys/${id}`)).json()).data.ticket;
  assert.equal(trip.pnrSnapshot, undefined);
  assert.equal((await adminApi.patch(`/api/journeys/${id}`, { data: { pnr: "", version: trip.version } })).status(), 200);
  assert.equal((await (await adminApi.get(`/api/journeys/${id}`)).json()).data.ticket.status, "BOOKED", "Removing a PNR must not undo a booking");
  for (let i = 0; i < 22; i++) {
    const response = await adminApi.post("/api/journeys", { data: { sourceCode: i % 2 ? "MS" : "MDU", destinationCode: i % 2 ? "MDU" : "MS", travelDate: day(70 + i), reminderEmailEnabled: false, reminderDiscordEnabled: false, reminderInAppEnabled: true } });
    assert.equal(response.status(), 201, await response.text());
  }
  list = (await (await adminApi.get("/api/workspace/trips?page=2")).json()).data;
  assert.equal(list.total, 23); assert.equal(list.tickets.length, 3);
  assert.equal((await adminApi.get("/api/workspace/trips?page=NaN")).status(), 400);
  await adminApi.patch("/api/preferences", { data: { weekendDays: [0, 6], calendarWeekStartsOn: 0, defaultEmail: false } });
  await adminApi.post("/api/holidays", { data: { name: "Planned leave", date: today, type: "PERSONAL_LEAVE" } });
  const calendarPreview = await adminApi.post("/api/holidays/import-ics", { data: { icsText: `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Imported company leave\r\nDTSTART;VALUE=DATE:${day(2).replaceAll("-", "")}\r\nEND:VEVENT\r\nEND:VCALENDAR` } });
  assert.equal(calendarPreview.status(), 200, await calendarPreview.text());
  const holidays = (await calendarPreview.json()).data;
  for (const expected of [1, 0]) {
    const imported = await adminApi.post("/api/holidays/import-ics", { data: { holidays, save: true } });
    assert.equal(imported.status(), 200, await imported.text());
    assert.equal((await imported.json()).data.added, expected);
  }
  for (const width of [320, 390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const screen of ["today", "trips", "calendar", "settings", "notifications"]) {
      const loaded = screen === "settings" ? Promise.resolve() : page.waitForResponse((response) => response.ok() && response.url().includes(screen === "notifications" ? "/api/notifications?page=" : `/api/workspace/${screen}`));
      await page.goto(`${baseURL}/${screen}`, { waitUntil: "domcontentloaded" });
      await loaded;
      await expect(page.getByRole("heading", { name: screen === "notifications" ? "Notifications" : screen[0].toUpperCase() + screen.slice(1), exact: true }).first()).toBeVisible();
      await expect(page.getByText("Loading your workspace...", { exact: true })).toBeHidden();
      await expect(page.getByText("Loading calendar...", { exact: true })).toBeHidden();
      await expect(page.getByText("Unable to load this view", { exact: true })).toBeHidden();
      if (screen === "calendar" && width >= 768) await expect(page.locator(".fc-col-header-cell").first()).toHaveText("Sun");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${screen} overflows at ${width}`);
      await page.screenshot({ path: `build/workspace-qa/${screen}-${width}.png`, fullPage: true, animations: "disabled" });
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${baseURL}/settings`);
  await page.getByRole("button", { name: "Administration", exact: true }).click();
  await expect(page.getByText("Loading your workspace...", { exact: true })).toBeHidden();
  await expect(page.getByText("Allow public signups", { exact: true })).toBeVisible();
  await page.screenshot({ path: "build/workspace-qa/administration-1280.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/trips?trip=${id}`);
  await expect(detail.getByText("No PNR linked", { exact: true })).toBeVisible();
  await page.screenshot({ path: "build/workspace-qa/trip-mobile.png", fullPage: true });
  await detail.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete trip", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  assert.equal((await adminApi.get(`/api/journeys/${id}`)).status(), 404);
  assert.equal((await (await adminApi.get("/api/workspace/trips")).json()).data.total, 23, "Deleting outbound must preserve the return");
  await page.goto(`${baseURL}/settings`);
  await page.getByRole("button", { name: "Log out", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "passed", flows: ["concurrent signup", "real login", "atomic return", "optional PNR", "ownership", "CSRF", "version conflicts", "persistent edits", "booking without PNR", "PNR unlink", "worker notifications", "persistent snooze", "server pagination", "calendar import deduplication", "Sunday-first calendar", "administration", "responsive layouts", "deletion", "logout"], screenshots: 27 }));
} catch (failure) {
  await page.screenshot({ path: "build/workspace-qa/failure.png", fullPage: true }).catch(() => {});
  console.error(JSON.stringify({ url: page.url(), errors, body: await page.locator("body").innerText().catch(() => "Unavailable") }));
  throw failure;
} finally { await browser.close(); await anonymous.dispose(); await other.dispose(); }
