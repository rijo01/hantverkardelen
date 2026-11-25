// Nödbroms och körlogg för scripts/importera-pafyllning.mjs och
// scripts/steg2-upphorda.mjs (beslut 2026-11-25, lib/sql/hantverk-steg2-005.sql).
//
// En körning skriver ingenting om
//   - SCB-underlaget i mtoz är mindre än 98 % av förra läsningen, eller den
//     senaste läsningen inte är klar, eller
//   - den skulle dölja eller ta bort fler än 2 % av de rader den styr som
//     visades efter förra körningen.
// Förra versionen ligger då kvar. `--tvinga` kör ändå (manuellt val).
// Varje körning loggas i hantverk_korning, också de som stoppas.

export const GRANS_DOLJS = 0.02;
export const GRANS_SCB = 0.98;

/** SQL för mtoz: de två senaste läsningarna och antalet verksamma nu. */
export const SCB_UNDERLAG_SQL = `
  select (select json_agg(l order by l.id desc) from (
            select id, afr_datum, status, afr_count from arbetsstalle_lasning order by id desc limit 5) l) as lasningar,
         (select count(*) from arbetsstalle where aestat = 1 and borta_ur_afr is null)::int as verksamma`;

export function korlogg({ rest, skript, tvinga }) {
  let id = null;
  const fore = async () => {
    const r = await rest(`hantverk_korning?select=*&skript=eq.${skript}&status=eq.klar&order=id.desc&limit=1`);
    return r?.[0] ?? null;
  };
  const skriv = async (falt) => {
    if (id == null) {
      const [r] = await rest("hantverk_korning", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ skript, status: "pagar", tvingad: tvinga, ...falt }),
      });
      id = r.id;
    } else {
      await rest(`hantverk_korning?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(falt) });
    }
  };
  return {
    fore,
    skriv,
    /**
     * Kontrollerar SCB-underlaget. `rad` är svaret på SCB_UNDERLAG_SQL,
     * `forra` den senaste klara körningen. Returnerar skälen att stoppa.
     */
    scbSkal(rad, forra) {
      const skal = [];
      const lasningar = typeof rad.lasningar === "string" ? JSON.parse(rad.lasningar) : rad.lasningar;
      const [senaste] = lasningar;
      const klara = lasningar.filter((l) => l.status === "klar");
      if (!senaste || senaste.status !== "klar") {
        skal.push(`senaste SCB-läsningen i mtoz (id ${senaste?.id}) har status "${senaste?.status}", inte "klar"`);
      }
      if (klara.length >= 2 && klara[0].afr_count < GRANS_SCB * klara[1].afr_count) {
        skal.push(`SCB-läsningen ${klara[0].afr_datum} har ${klara[0].afr_count} arbetsställen, mindre än 98 % av förra läsningens ${klara[1].afr_count}`);
      }
      const verksamma = Number(rad.verksamma);
      if (forra?.scb_verksamma && verksamma < GRANS_SCB * forra.scb_verksamma) {
        skal.push(`${verksamma} verksamma arbetsställen i mtoz, mindre än 98 % av ${forra.scb_verksamma} vid förra körningen (${forra.startad})`);
      }
      return { skal, verksamma, afrDatum: klara[0]?.afr_datum ?? null };
    },
    /** Kontrollerar hur många visade rader körningen döljer. */
    doljsSkal(visadeFore, doljs) {
      if (!visadeFore) return [];
      return doljs > GRANS_DOLJS * visadeFore
        ? [`körningen skulle dölja eller ta bort ${doljs} av ${visadeFore} visade rader (${((100 * doljs) / visadeFore).toFixed(1)} %, gränsen är 2 %)`]
        : [];
    },
    /** Stoppar körningen om det finns skäl och den inte är tvingad. */
    async stoppaOm(skal, falt = {}) {
      if (!skal.length) return;
      if (tvinga) {
        console.error(`NÖDBROMSEN SLOG TILL MEN --tvinga ANGAVS, körningen fortsätter:\n  - ${skal.join("\n  - ")}`);
        await skriv({ ...falt, orsak: `tvingad förbi: ${skal.join("; ")}` });
        return;
      }
      console.error(`NÖDBROMS: inget skrivet, förra versionen ligger kvar.\n  - ${skal.join("\n  - ")}\nKör om med --tvinga om ändringen är avsedd.`);
      await skriv({ ...falt, status: "stoppad", klar: new Date().toISOString(), orsak: skal.join("; ") });
      process.exit(3);
    },
  };
}
