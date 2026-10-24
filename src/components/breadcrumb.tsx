import Link from "next/link";

export function Breadcrumb({
  items,
}: {
  items: Array<{ name: string; href?: string }>;
}) {
  return (
    <nav aria-label="Brödsmulor" className="pb-4 pt-5 text-sm text-ink-3">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex min-w-0 items-center gap-1.5">
              {it.href && !last ? (
                <Link
                  href={it.href}
                  className="inline-flex min-h-8 items-center font-medium text-ink-2 underline-offset-4 hover:text-navy hover:underline"
                >
                  {it.name}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "truncate text-ink" : ""}>
                  {it.name}
                </span>
              )}
              {!last && (
                <span aria-hidden className="text-ink-3">
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
