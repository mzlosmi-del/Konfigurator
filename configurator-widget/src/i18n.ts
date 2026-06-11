// Serbian (Latin) translations for the widget
const sr: Record<string, string> = {
  // Widget states
  'Loading configurator…':            'Učitavanje konfiguratora…',
  'Product not found or not published':    'Proizvod nije pronađen ili nije objavljen',
  'Inquiry sent!':                         'Upit je poslat!',
  'Thank you. We\'ll get back to you as soon as possible.': 'Hvala. Javićemo vam se što pre moguće.',
  'Powered by Konfigurator':               'Pokretano od Konfiguratora',
  'Total price':                           'Ukupna cena',
  'Base price':                            'Osnovna cena',
  'Price breakdown':                       'Pregled cene',
  'Request a quote':                       'Zatraži ponudu',
  // Neon text preview (migration 096)
  'Your sign text':                        'Tekst vašeg natpisa',
  'Your text':                             'Vaš tekst',
  'Select all options to continue':        'Izaberite sve opcije da biste nastavili',
  'This is an estimated price. The official quote will be provided by the company after your inquiry.':
    'Ovo je procenjena cena. Zvaničnu ponudu će vam dostaviti kompanija nakon vašeg upita.',

  // Inquiry form
  'Your name *':                           'Vaše ime *',
  'Ivan Horvat':                           'Petar Petrović',
  'Email address *':                       'E-mail adresa *',
  'ivan@example.com':                      'petar@primer.com',
  'Message (optional)':                    'Poruka (opciono)',
  'Any additional details or questions…': 'Dodatni detalji ili pitanja…',
  'Name is required':                      'Ime je obavezno',
  'Email is required':                     'E-mail je obavezan',
  'Enter a valid email':                   'Unesite ispravnu e-mail adresu',
  'Sending…':                         'Slanje…',
  'Send inquiry':                          'Pošalji upit',
  'Failed to submit. Please try again.':   'Slanje nije uspelo. Pokušajte ponovo.',
  'Quote requests are temporarily paused. Please contact us directly.':
    'Slanje upita je privremeno pauzirano. Kontaktirajte nas direktno.',

  // File uploads
  'Attach images (optional)':              'Priložite slike (opciono)',
  'Allowed formats: JPG, PNG, GIF, WebP, HEIC. Up to 3 files, max 20 MB each.':
    'Dozvoljeni formati: JPG, PNG, GIF, WebP, HEIC. Najviše 3 fajla, do 20 MB po fajlu.',
  'Add files':                             'Dodaj fajlove',
  'Remove':                                'Ukloni',
  'You can attach up to 3 files.':         'Možete priložiti najviše 3 fajla.',
  'Each file must be 20 MB or smaller.':   'Svaki fajl mora biti 20 MB ili manji.',
  'Only image files are allowed (JPG, PNG, GIF, WebP, HEIC).':
    'Dozvoljene su samo slike (JPG, PNG, GIF, WebP, HEIC).',
  'Your inquiry was received, but some files could not be uploaded.':
    'Vaš upit je primljen, ali neki fajlovi nisu mogli biti otpremljeni.',

  // Language switcher
  'coming soon':                           'uskoro',

  // CharacteristicInput
  'Auto-set':                              'Automatski postavljeno',
  'Included':                              'Uključeno',
  'No image available':                    'Nema dostupne slike',
  'Product visualization':                 'Vizualizacija proizvoda',
}

// Numeric bounds validation message. Built here (not as a flat key) because it
// interpolates the min/max values. Mirrors `isNumericInRange` in types.ts.
export function tNumericRange(min: number | null | undefined, max: number | null | undefined): string {
  const en = _lang === 'en'
  if (min != null && max != null) {
    return en ? `Value must be between ${min} and ${max}` : `Vrednost mora biti između ${min} i ${max}`
  }
  if (min != null) {
    return en ? `Value must be at least ${min}` : `Vrednost mora biti najmanje ${min}`
  }
  return en ? `Value must be at most ${max}` : `Vrednost mora biti najviše ${max}`
}

// Out-of-range message for 'text' characteristics (min/max character length).
export function tTextLength(min: number | null | undefined, max: number | null | undefined): string {
  const en = _lang === 'en'
  if (min != null && max != null) {
    return en ? `Must be between ${min} and ${max} characters` : `Mora imati između ${min} i ${max} karaktera`
  }
  if (min != null) {
    return en ? `Must be at least ${min} characters` : `Mora imati najmanje ${min} karaktera`
  }
  return en ? `Must be at most ${max} characters` : `Mora imati najviše ${max} karaktera`
}

// Widget *user* languages that are actually translated and selectable today.
export const LANGS = ['en', 'sr'] as const
export type Lang = typeof LANGS[number]

// The enabled user languages, shown on top of the picker and highlighted.
// For now this is the full translated set (EN + SR). When more widget
// translations are added (or a per-tenant enabled-languages setting lands),
// extend LANGS and this follows automatically.
export const ENABLED_LANGS: readonly Lang[] = LANGS

// Forward-looking: languages advertised below the enabled ones, de-emphasized
// and disabled (no widget UI translations exist for them yet). Selecting one is
// a no-op. Kept local so the widget bundle stays self-contained (the admin's
// CONTENT_LANGUAGES list is in a separate package).
export const OTHER_LANGS: readonly { code: string; name: string }[] = [
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'ru', name: 'Русский' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
]

let _lang: Lang = (typeof localStorage !== 'undefined'
  ? (localStorage.getItem('lang') as Lang | null) ?? 'sr'
  : 'sr')

export function getLang(): Lang { return _lang }

export function setLang(l: Lang) {
  _lang = l
  if (typeof localStorage !== 'undefined') localStorage.setItem('lang', l)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('langchange', { detail: l }))
}

export function t(key: string): string {
  if (_lang === 'en') return key
  return sr[key] ?? key
}

// For select placeholder: "Select {name}…"
export function tSelect(name: string): string {
  if (_lang === 'en') return `Select ${name}…`
  return `Izaberite ${name}…`
}

// Pick a translated string from a JSONB i18n map, falling back to the primary value.
export function pickTranslation(
  i18n: Record<string, string> | null | undefined,
  lang: string,
  fallback: string
): string {
  return i18n?.[lang] || fallback
}
