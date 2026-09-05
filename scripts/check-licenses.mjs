import fs from "node:fs";
import path from "node:path";

// 强传染性（Copyleft，必须开源整个项目）—— 命中即失败
const STRONG = /\b(GPL|AGPL|SSPL)\b/i;
// 弱传染性（仅限文件/库级别）—— 命中仅告警，需人工确认
const WEAK = /\b(LGPL|MPL|EPL|CC-BY-SA|EUPL|CPL|OSL|CDDL)\b/i;

const results = new Map();

function readLicense(pkg) {
  if (typeof pkg.license === "string") return pkg.license;
  if (pkg.license && typeof pkg.license === "object") {
    return pkg.license.type || JSON.stringify(pkg.license);
  }
  if (Array.isArray(pkg.licenses) && pkg.licenses.length) {
    return pkg.licenses.map((l) => l.type || "?").join(", ");
  }
  return "UNKNOWN";
}

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue;
    const pkgPath = path.join(dir, e.name);
    const pkgJson = path.join(pkgPath, "package.json");
    if (fs.existsSync(pkgJson)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf8"));
        const id = `${pkg.name || e.name}@${pkg.version || "?"}`;
        if (!results.has(id)) results.set(id, readLicense(pkg));
      } catch {}
    }
    const nested = path.join(pkgPath, "node_modules");
    if (fs.existsSync(nested)) walk(nested);
  }
}

walk(path.join(process.cwd(), "node_modules"));

const strong = [];
const weak = [];
const unknown = [];
for (const [id, lic] of results) {
  if (STRONG.test(lic)) strong.push(`${id} => ${lic}`);
  else if (WEAK.test(lic)) weak.push(`${id} => ${lic}`);
  else if (lic === "UNKNOWN") unknown.push(id);
}

console.log(`\n依赖包总数: ${results.size}`);
console.log("\n=== 强传染性许可证（GPL/AGPL/SSPL，必须处理）===");
if (strong.length === 0) console.log("（无）");
else strong.forEach((s) => console.log("  ❌ " + s));
console.log("\n=== 弱传染性许可证（LGPL/MPL 等，需人工确认）===");
if (weak.length === 0) console.log("（无）");
else weak.forEach((w) => console.log("  ⚠️ " + w));
console.log("\n=== 许可证字段缺失的包 ===");
if (unknown.length === 0) console.log("（无）");
else unknown.forEach((u) => console.log("  ? " + u));

if (strong.length > 0) {
  console.error("\n检测到强传染性许可证，请替换依赖或与法务确认后修改白名单。");
  process.exit(1);
}
console.log("\n未发现强传染性许可证。");
