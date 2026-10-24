import Link from "next/link";

/**
 * Gemensam ram för resultatsidorna (sök, kommun, yrke + ort): rubrik med
 * antalet till höger, sidospalt till vänster och listan till höger.
 *
 * På mobil finns ingen vänsterspalt. Rutorna läggs i samma kolumn som listan:
 * de med `overst` (storleksvalet) före listan, länklistorna efter — så att
 * första träffen fortfarande syns i första skärmen.
 */
export function ResultatVy({
  rubrik,
  antal,
  ingress,
  sidospalt,
  children,
}: {
  rubrik: string;
  /** "23 företag", eller null medan söket körs. */
  antal: string | null;
  ingress?: React.ReactNode;
  sidospalt: { overst?: React.ReactNode; under?: React.ReactNode };
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-line pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h1 className="sg-display text-balance break-words text-[2.125rem] sm:text-[2.75rem]">
            {rubrik}
          </h1>
          <p className="text-[17px] font-bold tabular-nums text-ink-2">
            {antal ?? <span className="font-medium text-ink-3">Söker i registret …</span>}
          </p>
        </div>
        {ingress && <div className="mt-2 max-w-3xl text-[16px] leading-relaxed text-ink-2">{ingress}</div>}
      </header>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
        <aside
          aria-label="Filter och fler sidor"
          className="contents lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:gap-4"
        >
          {sidospalt.overst && <div className="order-1 lg:order-none">{sidospalt.overst}</div>}
          {sidospalt.under && (
            <div className="order-3 space-y-4 lg:order-none">{sidospalt.under}</div>
          )}
        </aside>
        <div className="order-2 min-w-0 space-y-5 lg:order-none lg:col-start-2 lg:row-start-1">
          {children}
        </div>
      </div>
    </>
  );
}

/** En ruta i sidospalten: vit yta, 1px kant, versal etikett. */
export function SidoRuta({
  rubrik,
  children,
}: {
  rubrik: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sg-panel p-4 sm:p-5">
      <h2 className="sg-label">{rubrik}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Storleksvalet: knappar, den valda fylld navy. */
export function StorlekVal({
  val,
}: {
  val: ReadonlyArray<{ label: string; href: string; aktiv: boolean }>;
}) {
  return (
    <SidoRuta rubrik="Storlek">
      <ul className="flex flex-wrap gap-2 lg:grid lg:grid-cols-2">
        {val.map((v) => (
          <li key={v.label}>
            <Link
              href={v.href}
              aria-current={v.aktiv ? "true" : undefined}
              className={`sg-btn min-h-11 w-full px-3 text-[14px] ${
                v.aktiv ? "sg-btn-navy" : "border-line bg-white font-semibold text-ink-2 hover:border-navy hover:text-navy"
              }`}
            >
              {v.label}
            </Link>
          </li>
        ))}
      </ul>
    </SidoRuta>
  );
}

/** Länklista med antal till höger, 1px-linjer mellan raderna. */
export function LankLista({
  rubrik,
  lankar,
  sist,
}: {
  rubrik: string;
  lankar: ReadonlyArray<{ href: string; label: string; antal?: number }>;
  /** En avslutande länk, t.ex. "Alla hantverkare i Kungälv". */
  sist?: { href: string; label: string };
}) {
  if (lankar.length === 0 && !sist) return null;
  return (
    <SidoRuta rubrik={rubrik}>
      <ul className="-my-1 divide-y divide-line-soft">
        {lankar.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group flex min-h-11 items-center justify-between gap-3 py-1.5 text-[15px]"
            >
              <span className="min-w-0 truncate font-semibold text-ink underline-offset-4 group-hover:underline">
                {l.label}
              </span>
              {l.antal != null && (
                <span className="shrink-0 tabular-nums text-ink-3">
                  {l.antal.toLocaleString("sv-SE")}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {sist && (
        <Link href={sist.href} className="sg-link mt-3 inline-flex min-h-11 items-center text-[15px]">
          {sist.label}
        </Link>
      )}
    </SidoRuta>
  );
}

/** Föregående / Nästa under listan. */
export function Sidbyte({
  sida,
  foregaende,
  nasta,
}: {
  sida: number;
  foregaende: string | null;
  nasta: string | null;
}) {
  if (!foregaende && !nasta) return null;
  return (
    <nav aria-label="Sidor" className="flex items-center justify-between gap-3 text-[15px]">
      {foregaende ? (
        <Link href={foregaende} className="sg-btn sg-btn-outline">
          ← Föregående
        </Link>
      ) : (
        <span />
      )}
      <span className="tabular-nums text-ink-3">Sida {sida}</span>
      {nasta ? (
        <Link href={nasta} className="sg-btn sg-btn-outline">
          Nästa →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
