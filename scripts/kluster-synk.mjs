// Kopierar src/lib/kluster/ till klustrets andra sajter, eller kontrollerar
// att kopiorna är identiska. Se src/lib/kluster/README.md.
//
//   node scripts/kluster-synk.mjs             kopiera
//   node scripts/kluster-synk.mjs --kontroll  jämför, exit 1 vid skillnad
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";

const KALLA = new URL("../src/lib/kluster/", import.meta.url);
const SAJTER = ["../../regionsdelen-ny/", "../../varddelen-se/"].map(
  (r) => new URL(`${r}src/lib/kluster/`, import.meta.url),
);
const kontroll = process.argv.includes("--kontroll");
const filer = readdirSync(KALLA).sort();
const sha = (b) => createHash("sha256").update(b).digest("hex").slice(0, 12);

let fel = 0;
for (const mal of SAJTER) {
  if (!existsSync(new URL("..", mal))) {
    console.error(`saknas: ${mal.pathname}`);
    fel++;
    continue;
  }
  if (!kontroll) mkdirSync(mal, { recursive: true });
  const finns = existsSync(mal) ? readdirSync(mal) : [];
  for (const f of filer) {
    const k = readFileSync(new URL(f, KALLA));
    const m = existsSync(new URL(f, mal)) ? readFileSync(new URL(f, mal)) : null;
    if (m && k.equals(m)) continue;
    if (kontroll) {
      console.error(`SKILJER: ${mal.pathname}${f}`);
      fel++;
    } else {
      writeFileSync(new URL(f, mal), k);
      console.log(`kopierad: ${mal.pathname}${f} (${sha(k)})`);
    }
  }
  for (const f of finns.filter((f) => !filer.includes(f))) {
    if (kontroll) {
      console.error(`EXTRA: ${mal.pathname}${f}`);
      fel++;
    } else {
      rmSync(new URL(f, mal));
      console.log(`borttagen: ${mal.pathname}${f}`);
    }
  }
}
if (kontroll) console.log(fel ? `${fel} skillnad(er)` : `identiska: ${filer.map((f) => `${f} ${sha(readFileSync(new URL(f, KALLA)))}`).join(", ")}`);
process.exit(fel ? 1 : 0);
