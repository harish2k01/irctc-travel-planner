// Runs only in the trusted default-branch workflow, never with PR write credentials.
import { execFileSync } from "node:child_process";
import { appendFile, writeFile } from "node:fs/promises";
import { allPages, github } from "./github.mjs";
import { planVersions, VERSION, compareVersions } from "./version.mjs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const releases = (await allPages("releases")).filter(
  (r) => !r.draft && !r.prerelease && VERSION.test(r.tag_name),
);
releases.sort((a, b) => compareVersions(a.tag_name, b.tag_name));
const latest = releases.at(-1);
const head = git("rev-parse", "HEAD");
if (latest) git("merge-base", "--is-ancestor", latest.tag_name, head);
const commits = git(
  "rev-list",
  "--first-parent",
  "--reverse",
  latest ? `${latest.tag_name}..${head}` : head,
)
  .split("\n")
  .filter(Boolean);
const commitsWithPRs = [];
for (const sha of commits) {
  const prs = await allPages(`commits/${sha}/pulls`);
  commitsWithPRs.push({ sha, prs });
}
const plans = planVersions(latest?.tag_name || "v0.0.0", commitsWithPRs);
// Validate the entire batch before creating anything. Reconcile all merges in order,
// so GitHub concurrency replacing a pending run cannot lose a version bump.
const dryRun = process.argv.includes("--dry-run");
for (const plan of dryRun ? [] : plans) {
  let existing;
  try {
    existing = git("rev-parse", "--verify", `refs/tags/${plan.tag}^{commit}`);
  } catch {
    /* New tag. */
  }
  if (existing && existing !== plan.sha)
    throw new Error(`Refusing to move existing tag ${plan.tag}`);
  if (!existing)
    await github("git/refs", {
      method: "POST",
      body: { ref: `refs/tags/${plan.tag}`, sha: plan.sha },
    });
  await github("releases", {
    method: "POST",
    body: {
      tag_name: plan.tag,
      name: plan.tag,
      target_commitish: plan.sha,
      generate_release_notes: true,
      body: `Railplan release from #${plan.pr} (${plan.bump}).\n\nThe release workflow publishes the GHCR image after validation. The image metadata asset records its immutable digest and source commit.`,
    },
  });
  console.log(`Created ${plan.tag} from #${plan.pr} at ${plan.sha}`);
}
// Reconcile only unfinished Railplan publications; historical releases stay untouched.
const unfinished = releases
  .filter((r) => r.body?.startsWith("Railplan release from #") && !r.assets.some((asset) => asset.name === "image.json"))
  .map((r) => ({
    tag: r.tag_name,
    sha: git("rev-parse", `${r.tag_name}^{commit}`),
  }));
const targets = [
  ...new Map(
    [...unfinished, ...plans].map((target) => [
      target.tag,
      target,
    ]),
  ).values(),
];
await writeFile("release-plan.json", JSON.stringify(targets, null, 2));
if (process.env.GITHUB_OUTPUT)
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `targets=${JSON.stringify(targets)}\nnew_count=${plans.length}\n`,
  );
console.log(
  targets.length
    ? `Publish: ${targets.map((p) => p.tag).join(", ")}`
    : "No merged, labeled PR release yet; nothing to publish.",
);
