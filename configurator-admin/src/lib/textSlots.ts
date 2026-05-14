import type { TextLevel } from '@/types/database'
import type { Lang } from '@/i18n'

/** One entry of the slot catalogue: a friendly label and a description of
 *  where the text actually appears, both in EN and SR. */
interface SlotMeta {
  label:       { en: string; sr: string }
  description: { en: string; sr: string }
}

/** Catalogue keyed by `(level, slot)`. The same `slot` string can mean
 *  different things at different levels (e.g. `product` at the tenant level
 *  is a "global product text", at the product level it's a per-product
 *  text block), so we key on level first. */
const TEXT_SLOT_META: Record<TextLevel, Record<string, SlotMeta>> = {
  tenant: {
    pdf_footer: {
      label: { en: 'PDF footer', sr: 'Podnožje PDF-a' },
      description: {
        en: 'Shown at the bottom of every page on every quotation PDF.',
        sr: 'Prikazuje se na dnu svake strane svake PDF ponude.',
      },
    },
    public_page_title: {
      label: { en: 'Public page title', sr: 'Naslov javne stranice' },
      description: {
        en: 'Browser tab title on the public quotation response page (/q/:token).',
        sr: 'Naslov kartice u pretraživaču na javnoj stranici odgovora na ponudu (/q/:token).',
      },
    },
    post_inquiry_message: {
      label: { en: 'Post-inquiry message', sr: 'Poruka nakon upita' },
      description: {
        en: 'Confirmation shown to the customer in the widget after they submit an inquiry.',
        sr: 'Potvrda koja se prikazuje kupcu u vidžetu nakon slanja upita.',
      },
    },
    quotation_email_intro: {
      label: { en: 'Quotation email intro', sr: 'Uvod e-mail-a ponude' },
      description: {
        en: 'Opening paragraph in the email body sent with each quotation PDF.',
        sr: 'Početni pasus u telu e-mail-a koji se šalje uz svaku PDF ponudu.',
      },
    },
    quotation_accept_message: {
      label: { en: 'Quotation accept message', sr: 'Poruka pri prihvatu ponude' },
      description: {
        en: 'Shown on the public response page after the customer accepts a quotation.',
        sr: 'Prikazuje se na javnoj stranici odgovora nakon što kupac prihvati ponudu.',
      },
    },
    quotation_reject_message: {
      label: { en: 'Quotation reject message', sr: 'Poruka pri odbijanju ponude' },
      description: {
        en: 'Shown on the public response page after the customer rejects a quotation.',
        sr: 'Prikazuje se na javnoj stranici odgovora nakon što kupac odbije ponudu.',
      },
    },
    terms_line: {
      label: { en: 'Terms & Conditions line', sr: 'Stavka uslova i odredbi' },
      description: {
        en: 'One line of the editable Terms & Conditions block printed on every quotation PDF. Sort order controls the line position.',
        sr: 'Jedna stavka uređivog bloka „Uslovi i odredbe” koji se štampa na svakoj PDF ponudi. Redosled određuje poziciju stavke.',
      },
    },
    product: {
      label: { en: 'Global product text', sr: 'Globalni tekst proizvoda' },
      description: {
        en: 'Stand-alone "Product description"-style text block printed on every quotation PDF, available to all products.',
        sr: 'Samostalan blok teksta tipa „Opis proizvoda” koji se štampa na svakoj PDF ponudi, dostupan svim proizvodima.',
      },
    },
    specification: {
      label: { en: 'Global specification', sr: 'Globalna specifikacija' },
      description: {
        en: 'Stand-alone specifications block printed on every quotation PDF, available to all products.',
        sr: 'Samostalan blok specifikacija koji se štampa na svakoj PDF ponudi, dostupan svim proizvodima.',
      },
    },
    note: {
      label: { en: 'Global note', sr: 'Globalna napomena' },
      description: {
        en: 'Stand-alone note block printed on every quotation PDF, available to all products.',
        sr: 'Samostalan blok napomene koji se štampa na svakoj PDF ponudi, dostupan svim proizvodima.',
      },
    },
    terms: {
      label: { en: 'Global terms block', sr: 'Globalni blok uslova' },
      description: {
        en: 'Stand-alone Terms block printed on every quotation PDF. Different from the editable line-by-line "Terms & Conditions" block above.',
        sr: 'Samostalan blok Uslova koji se štampa na svakoj PDF ponudi. Razlikuje se od uređivog bloka „Uslovi i odredbe” po stavkama.',
      },
    },
  },
  product: {
    name: {
      label: { en: 'Product name', sr: 'Naziv proizvoda' },
      description: {
        en: 'Translated product name. Shown in the widget header and as the line-item title on the quotation PDF.',
        sr: 'Prevedeni naziv proizvoda. Prikazuje se u zaglavlju vidžeta i kao naslov stavke u PDF ponudi.',
      },
    },
    description: {
      label: { en: 'Product description', sr: 'Opis proizvoda' },
      description: {
        en: 'Long-form product description. Used by the widget under the product header.',
        sr: 'Detaljan opis proizvoda. Koristi se u vidžetu ispod zaglavlja proizvoda.',
      },
    },
    product: {
      label: { en: 'Product text block', sr: 'Blok teksta proizvoda' },
      description: {
        en: "Text block printed under this product's line item on the quotation PDF. The Label column becomes the block heading.",
        sr: 'Blok teksta koji se štampa ispod stavke ovog proizvoda u PDF ponudi. Kolona „Oznaka” postaje naslov bloka.',
      },
    },
    specification: {
      label: { en: 'Specification', sr: 'Specifikacija' },
      description: {
        en: "Specifications block printed under this product's line item on the quotation PDF.",
        sr: 'Blok specifikacija koji se štampa ispod stavke ovog proizvoda u PDF ponudi.',
      },
    },
    note: {
      label: { en: 'Note', sr: 'Napomena' },
      description: {
        en: "Note block printed under this product's line item on the quotation PDF.",
        sr: 'Blok napomene koji se štampa ispod stavke ovog proizvoda u PDF ponudi.',
      },
    },
    terms: {
      label: { en: 'Terms', sr: 'Uslovi' },
      description: {
        en: "Per-product Terms block printed under this product's line item on the quotation PDF.",
        sr: 'Blok uslova specifičan za ovaj proizvod, koji se štampa ispod stavke proizvoda u PDF ponudi.',
      },
    },
  },
  characteristic: {
    name: {
      label: { en: 'Characteristic name', sr: 'Naziv karakteristike' },
      description: {
        en: 'Translated characteristic name. Shown in the widget as the field label and on the quotation PDF under the configuration breakdown.',
        sr: 'Prevedeni naziv karakteristike. Prikazuje se u vidžetu kao oznaka polja i u PDF ponudi u razlaganju konfiguracije.',
      },
    },
    description: {
      label: { en: 'Characteristic description', sr: 'Opis karakteristike' },
      description: {
        en: "Optional helper text. Renders under the chosen value on the quotation PDF when the 'Show characteristic descriptions' section is enabled in the PDF preview.",
        sr: 'Opcioni opis. Prikazuje se ispod izabrane vrednosti u PDF ponudi kada je uključena sekcija „Prikaži opise karakteristika” u pregledu PDF-a.',
      },
    },
    specification: {
      label: { en: 'Characteristic specification', sr: 'Specifikacija karakteristike' },
      description: {
        en: 'Detailed specification text for this characteristic. Printed as a 1.x. chapter in the Technical Specification Word document, under the parent product.',
        sr: 'Detaljan tekst specifikacije za ovu karakteristiku. Štampa se kao poglavlje 1.x. u Word dokumentu Tehničke specifikacije, ispod nadređenog proizvoda.',
      },
    },
  },
  characteristic_value: {
    label: {
      label: { en: 'Value label', sr: 'Oznaka vrednosti' },
      description: {
        en: 'Translated label for this characteristic value. Shown wherever the option is presented (widget, quotation PDF, exports).',
        sr: 'Prevedena oznaka za ovu vrednost karakteristike. Prikazuje se gde god se opcija prikazuje (vidžet, PDF ponuda, izvozi).',
      },
    },
    description: {
      label: { en: 'Value description', sr: 'Opis vrednosti' },
      description: {
        en: 'Optional description for this value. Reserved for future use; not yet read by any renderer.',
        sr: 'Opcioni opis ove vrednosti. Rezervisano za buduću upotrebu; nijedan renderer ga još ne čita.',
      },
    },
    specification: {
      label: { en: 'Value specification', sr: 'Specifikacija vrednosti' },
      description: {
        en: 'Detailed specification text for this characteristic value. Printed as a 1.x.1 chapter in the Technical Specification Word document, under the parent characteristic.',
        sr: 'Detaljan tekst specifikacije za ovu vrednost karakteristike. Štampa se kao poglavlje 1.x.1 u Word dokumentu Tehničke specifikacije, ispod nadređene karakteristike.',
      },
    },
  },
}

/** Friendly label for `(level, slot)` in the requested language. Falls back
 *  to the raw `slot` string when the catalogue has no entry — useful for
 *  custom slots a tenant creates ad-hoc via "Add text". */
export function slotLabel(level: TextLevel, slot: string, lang: Lang): string {
  const entry = TEXT_SLOT_META[level]?.[slot]
  if (!entry) return slot
  return entry.label[lang] || entry.label.en || slot
}

/** Human description of where the slot's text gets printed. Returns the
 *  empty string when no description is available so callers can decide
 *  whether to render a tooltip at all. */
export function slotDescription(level: TextLevel, slot: string, lang: Lang): string {
  const entry = TEXT_SLOT_META[level]?.[slot]
  if (!entry) return ''
  return entry.description[lang] || entry.description.en || ''
}

/** Level-agnostic label lookup: returns the first matching `(level, slot)`
 *  entry's label. Used by the Slot filter dropdown on the Central Texts
 *  page, where the filter doesn't yet narrow by level. */
export function slotLabelAnyLevel(slot: string, lang: Lang): string {
  for (const level of Object.keys(TEXT_SLOT_META) as TextLevel[]) {
    const entry = TEXT_SLOT_META[level][slot]
    if (entry) return entry.label[lang] || entry.label.en || slot
  }
  return slot
}
