#!/usr/bin/env node
// scripts/release.mjs — versionamento automatico (Conventional Commits) p/ aura-platform
// Uso:
//   GH_TOKEN=... node scripts/release.mjs --dry-run            (default, nao escreve nada)
//   GH_TOKEN=... node scripts/release.mjs --apply              (commita + tag + release)
//   GH_TOKEN=... node scripts/release.mjs --dry-run --since=v1.3.0   (teste: forca base)
import https from "node:https";
import crypto from "node:crypto";

const REPO   = process.env.RELEASE_REPO || "helygp/aura-platform";
const BRANCH = process.env.RELEASE_BRANCH || "main";
const TOKEN  = process.env.GH_TOKEN;
const APPLY  = process.argv.includes("--apply");
const SINCE  = (process.argv.find(a => a.startsWith("--since=")) || "").split("=")[1] || null;
const CL_PATH  = "apps/erp/public/changelog.json";
const BUF_PATH = "apps/erp/public/changelog.unreleased.json";
const MD_PATH  = "CHANGELOG.md";

function gh(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opt = { host: "api.github.com", path, method, headers: {
      "Authorization": "Bearer " + TOKEN, "User-Agent": "AuraSuporte-release", "Accept": "application/vnd.github+json" } };
    if (data) { opt.headers["Content-Type"] = "application/json"; opt.headers["Content-Length"] = Buffer.byteLength(data); }
    const r = https.request(opt, res => { let d = ""; res.on("data", c => d += c); res.on("end", () => {
      let j = null; try { j = JSON.parse(d); } catch (e) {}
      if (res.statusCode >= 200 && res.statusCode < 300) resolve(j);
      else reject(new Error(method + " " + path + " -> " + res.statusCode + " " + d.slice(0, 200))); }); });
    r.on("error", reject); if (data) r.write(data); r.end();
  });
}
const b64 = p => gh("GET", `/repos/${REPO}/contents/${p}?ref=${BRANCH}`)
  .then(o => ({ text: Buffer.from(o.content, "base64").toString("utf8"), sha: o.sha }))
  .catch(() => null);
const hasCyrillic = s => /[\u0400-\u04FF]/.test(s);

function parseSemverTag(name) { const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(name); return m ? [+m[1], +m[2], +m[3]] : null; }
function parseCommit(message) {
  const subject = message.split("\n")[0].trim();
  const m = subject.match(/^(\w+)(\(([^)]*)\))?(!)?:\s*(.+)$/);
  const breaking = /(^|\n)BREAKING CHANGE/.test(message) || (m && !!m[4]);
  if (!m) return { type: null, scope: null, breaking, desc: subject };
  return { type: m[1].toLowerCase(), scope: m[3] || null, breaking, desc: m[5] };
}

const CAT = { feat: "Adicionado", fix: "Corrigido", perf: "Performance", refactor: "Alterado", revert: "Revertido" };
const ICON = { feat: "\u2728", fix: "\uD83D\uDC1B", perf: "\u26A1", refactor: "\u267B\uFE0F", revert: "\u21A9\uFE0F" };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const IGNORE_SCOPES = new Set(["ci", "build", "deps", "release", "chore", "infra", "deploy"]);

(async () => {
  if (!TOKEN) throw new Error("GH_TOKEN ausente");

  // 1. ultima tag semver
  const tags = await gh("GET", `/repos/${REPO}/tags?per_page=50`);
  let latest = null, latestArr = [0, 0, 0];
  for (const t of tags) { const a = parseSemverTag(t.name); if (a) {
    if (a[0]>latestArr[0]||(a[0]===latestArr[0]&&a[1]>latestArr[1])||(a[0]===latestArr[0]&&a[1]===latestArr[1]&&a[2]>latestArr[2])) { latest = t.name; latestArr = a; } } }
  const base = SINCE || latest || null;
  console.log(`# base: ${base || "(repo sem tags — primeira release)"}  ->  head: ${BRANCH}`);

  // 2. commits desde a base
  let commits;
  if (base) { const cmp = await gh("GET", `/repos/${REPO}/compare/${base}...${BRANCH}`); commits = cmp.commits || []; }
  else { commits = (await gh("GET", `/repos/${REPO}/commits?sha=${BRANCH}&per_page=100`)).reverse(); }
  const parsed = commits.map(c => ({ sha: c.sha.slice(0,7), ...parseCommit(c.commit.message) }));
  const eff = parsed.filter(c => !(c.scope && IGNORE_SCOPES.has(c.scope)));

  // 3. nivel de bump (ignora escopos de infra)
  let level = null;
  if (eff.some(c => c.breaking)) level = "major";
  else if (eff.some(c => c.type === "feat")) level = "minor";
  else if (eff.some(c => c.type === "fix" || c.type === "perf")) level = "patch";

  if (!level) {
    console.log(`# Nenhum commit feat/fix/perf/breaking desde ${base}. Commits analisados: ${parsed.length}.`);
    parsed.forEach(c => console.log(`   - ${c.sha} [${c.type || "?"}] ${c.desc}`));
    console.log("# => SEM RELEASE. Deploy segue normal.");
    return;
  }

  const [MA, MI, PA] = latestArr;
  const next = level === "major" ? [MA+1,0,0] : level === "minor" ? [MA,MI+1,0] : [MA,MI,PA+1];
  const version = next.join(".");
  const today = new Date().toISOString().slice(0, 10);
  console.log(`# bump: ${level}  ->  v${version}  (${today})`);

  // 4. monta secao CHANGELOG.md
  const groups = {};
  for (const c of eff) { const cat = CAT[c.type]; if (!cat) continue;
    (groups[cat] = groups[cat] || []).push(`- ${c.scope ? `**${c.scope}:** ` : ""}${cap(c.desc)} (${c.sha})`); }
  let mdSection = `## [${version}] \u2014 ${today}\n\n`;
  for (const cat of ["Adicionado","Alterado","Corrigido","Performance","Revertido"]) {
    if (groups[cat]) mdSection += `### ${cat}\n${groups[cat].join("\n")}\n\n`; }

  // 5. highlights do changelog.json: buffer humano > fallback derivado
  const bufFile = await b64(BUF_PATH);
  let highlights = [];
  if (bufFile && bufFile.text.trim()) { try { highlights = JSON.parse(bufFile.text); } catch (e) {} }
  if (!Array.isArray(highlights) || highlights.length === 0) {
    highlights = eff.filter(c => c.type === "feat" || c.type === "fix")
      .map(c => ({ icon: ICON[c.type] || "\u2022", text: cap(c.desc) }));
    if (highlights.length === 0) highlights = [{ icon: "\uD83D\uDD27", text: `Melhorias internas (v${version})` }];
  }
  const clFile = await b64(CL_PATH);
  const cl = JSON.parse(clFile.text);
  const title = highlights.length === 1 ? highlights[0].text : `${highlights.length} novidades nesta versão`;
  const newRelease = { version, date: today, title, highlights };

  // dry-run: so imprime
  console.log("\n----- CHANGELOG.md (nova secao) -----\n" + mdSection);
  console.log("----- changelog.json (novo bloco) -----");
  console.log(JSON.stringify(newRelease, null, 2));

  if (!APPLY) { console.log("\n# DRY-RUN: nada foi escrito."); return; }

  // 6. APPLY: monta arquivos finais + guardas
  cl.current = version; cl.releases.unshift(newRelease);
  const clNew = JSON.stringify(cl, null, 2) + "\n";
  const mdFile = await b64(MD_PATH);
  const marker = "## [";
  const idx = mdFile.text.indexOf(marker, mdFile.text.indexOf("---"));
  const mdNew = idx === -1 ? mdFile.text + "\n" + mdSection : mdFile.text.slice(0, idx) + mdSection + mdFile.text.slice(idx);
  if (hasCyrillic(clNew) || hasCyrillic(mdNew)) throw new Error("HOMOGLIFO detectado — abortando");
  JSON.parse(clNew);

  // 7. commit unico via Git Data API (zera o buffer junto)
  const ref = await gh("GET", `/repos/${REPO}/git/ref/heads/${BRANCH}`);
  const headSha = ref.object.sha;
  const baseTree = (await gh("GET", `/repos/${REPO}/git/commits/${headSha}`)).tree.sha;
  const mk = async content => (await gh("POST", `/repos/${REPO}/git/blobs`, { content, encoding: "utf-8" })).sha;
  const tree = [
    { path: CL_PATH, mode: "100644", type: "blob", sha: await mk(clNew) },
    { path: MD_PATH, mode: "100644", type: "blob", sha: await mk(mdNew) },
    { path: BUF_PATH, mode: "100644", type: "blob", sha: await mk("[]\n") },
  ];
  const newTree = await gh("POST", `/repos/${REPO}/git/trees`, { base_tree: baseTree, tree });
  const commit = await gh("POST", `/repos/${REPO}/git/commits`, {
    message: `chore(release): v${version} [skip ci]`, tree: newTree.sha, parents: [headSha] });
  await gh("PATCH", `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false });
  const rel = await gh("POST", `/repos/${REPO}/releases`, {
    tag_name: `v${version}`, target_commitish: commit.sha, name: `v${version}`,
    body: mdSection, draft: false, prerelease: false });
  console.log(`# APPLY OK: commit ${commit.sha.slice(0,7)} | tag v${version} | ${rel.html_url}`);
})().then(() => process.exit(0)).catch(e => { console.error("ERRO:", e.message); process.exit(1); });
