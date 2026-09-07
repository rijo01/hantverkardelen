import type { MetadataRoute } from "next";
import { ALL_KOMMUNER } from "@/lib/kommuner";
import { getBranschNamesBulk } from "@/lib/branscher";
import { HANTVERK_BRANSCHER } from "@/lib/hantverk-branscher";
import {
  branschPageSlug,
  foretagSlug,
  listIndexableForetag,
} from "@/lib/queries";
import {
  farFinnasISitemap,
  foretagIsIndexable,
  hubIsIndexable,
  snapshotKommunBranschCount,
  snapshotKommunCount,
} from "@/lib/seo";

/**
 * Sitemap enligt tvågrindsmodellen i lib/seo.ts.
 *
 * Bara sidor som faktiskt renderas med `index` kommer med. Tunna hubbar och
 * innehållslösa företagssidor utelämnas — de får `noindex, follow` på sidan
 * och ska inte anmälas till Google alls.
 *
 * Byggspärren nedan kastar om en URL på väg in i sitemap inte passerar sin
 * grind. Det är samma funktioner som sidorna använder för sina robots-taggar,
 * så sitemap och noindex kan inte glida isär utan att bygget faller.
 */

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkardelen.se";

type Entry = MetadataRoute.Sitemap[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  const push = (path: string, rest: Omit<Entry, "url">) => {
    if (!farFinnasISitemap(path)) {
      throw new Error(`Sitemap: ${path} får aldrig ligga i sitemap (noindex per design).`);
    }
    entries.push({ url: `${SITE_URL}${path === "/" ? "" : path}`, ...rest });
  };

  // ---- Statiska sidor -----------------------------------------------------
  push("/", { lastModified: now, changeFrequency: "daily", priority: 1 });
  push("/kommuner", { lastModified: now, changeFrequency: "weekly", priority: 0.9 });
  push("/branscher", { lastModified: now, changeFrequency: "weekly", priority: 0.9 });
  push("/kontakt", { lastModified: now, changeFrequency: "monthly", priority: 0.5 });

  // ---- Grind 1: kommunhubbar ---------------------------------------------
  const branschNamn = await getBranschNamesBulk([...HANTVERK_BRANSCHER]);

  for (const k of ALL_KOMMUNER) {
    const kommunCount = snapshotKommunCount(k.code);
    if (!hubIsIndexable(kommunCount)) continue;
    push(`/kommun/${k.slug}`, {
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });

    // ---- Grind 1: kommun × bransch ----------------------------------------
    for (const ng1 of HANTVERK_BRANSCHER) {
      const count = snapshotKommunBranschCount(k.code, ng1);
      if (!hubIsIndexable(count)) continue;
      const namn = branschNamn.get(String(ng1));
      // Utan branschnamn kan vi inte bilda den kanoniska sluggen — hoppa
      // hellre över sidan än att publicera en URL som inte är kanonisk.
      if (!namn) continue;
      push(`/kommun/${k.slug}/${branschPageSlug(namn, ng1)}`, {
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  // ---- Grind 2: företagssidor med substans --------------------------------
  const foretag = await listIndexableForetag();
  for (const f of foretag) {
    if (!foretagIsIndexable(f)) {
      throw new Error(
        `Sitemap: företag ${f.cfarnr} kom ur substans-queryn men föll på ` +
          "foretagIsIndexable(). Predikatet i listIndexableForetag() och " +
          "grinden i lib/seo.ts har glidit isär.",
      );
    }
    push(`/foretag/${foretagSlug(f)}`, {
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  return entries;
}
