/**
 * Sajtens märke: en orange kvadrat med navy "H" och ordmärket i 800.
 * Ritas med text, inte som bild — ingen extra förfrågan, skarp i alla storlekar.
 */
export function Ordmarke({ stor = false }: { stor?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center bg-signal font-extrabold leading-none text-navy ${
          stor ? "size-8 text-[19px]" : "size-7 text-[17px]"
        }`}
      >
        H
      </span>
      <span
        className={`font-extrabold leading-none tracking-[-0.03em] text-white ${
          stor ? "text-[21px]" : "text-[19px]"
        }`}
      >
        hantverkardelen
      </span>
    </span>
  );
}
