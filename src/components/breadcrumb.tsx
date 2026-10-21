import Link from "next/link";

export function Breadcrumb({
  items,
}: {
  items: Array<{ name: string; href?: string }>;
}) {
  return (
    <nav aria-label="Brödsmulor" className="mb-4 pt-4 text-sm text-[var(--text-muted)]">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {it.href && !last ? (
                <Link
                  href={it.href}
                  className="underline-offset-4 transition-colors hover:text-[var(--brand-ink)] hover:underline"
                >
                  {it.name}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "text-[var(--text-body)]" : ""}>
                  {it.name}
                </span>
              )}
              {!last && (
                <span aria-hidden className="text-[var(--text-faint)]">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
