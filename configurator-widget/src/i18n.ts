// Serbian (Latin) translations for the widget
const sr: Record<string, string> = {
  // Widget states
  'Loading configurator\u2026':            'Učitavanje konfiguratora\u2026',
  'Product not found or not published':    'Proizvod nije pronađen ili nije objavljen',
  'Inquiry sent!':                         'Upit je poslat!',
  'Thank you. We\'ll get back to you as soon as possible.': 'Hvala. Javićemo vam se što pre moguće.',
  'Powered by Konfigurator':               'Pokretano od Konfiguratora',
  'Total price':                           'Ukupna cena',
  'Request a quote':                       'Zatraži ponudu',
  'Select all options to continue':        'Izaberite sve opcije da biste nastavili',

  // Inquiry form
  'Your name *':                           'Vaše ime *',
  'Ivan Horvat':                           'Petar Petrović',
  'Email address *':                       'E-mail adresa *',
  'ivan@example.com':                      'petar@primer.com',
  'Message (optional)':                    'Poruka (opciono)',
  'Any additional details or questions\u2026': 'Dodatni detalji ili pitanja\u2026',
  'Name is required':                      'Ime je obavezno',
  'Email is required':                     'E-mail je obavezan',
  'Enter a valid email':                   'Unesite ispravnu e-mail adresu',
  'Sending\u2026':                         'Slanje\u2026',
  'Send inquiry':                          'Pošalji upit',
  'Failed to submit. Please try again.':   'Slanje nije uspelo. Pokušajte ponovo.',

  // CharacteristicInput
  'Auto-set':                              'Automatski postavljeno',
  'No image available':                    'Nema dostupne slike',
  'Product visualization':                 'Vizualizacija proizvoda',
}

export const LANGS = ['en', 'sr'] as const
export type Lang = typeof LANGS[number]

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
  if (_lang === 'en') return `Select ${name}\u2026`
  return `Izaberite ${name}\u2026`
}
