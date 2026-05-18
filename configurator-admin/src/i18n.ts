// Serbian (Latin) translations for the admin
const sr: Record<string, string> = {
  // App / branding
  'Configurator':                          'Configureout',

  // Auth – Login
  'Sign in':                               'Prijava',
  'Enter your email and password to continue': 'Unesite e-mail i lozinku da biste nastavili',
  'Email':                                 'E-mail',
  'you@example.com':                       'vi@primer.com',
  'Password':                              'Lozinka',
  'Enter a valid email':                   'Unesite ispravnu e-mail adresu',
  'Password is required':                  'Lozinka je obavezna',
  "Don't have an account?":               'Nemate nalog?',
  'Create one':                            'Kreirajte ga',

  // Auth – Register
  'Create your account':                   'Kreirajte nalog',
  'Set up your configurator workspace':    'Podesite vaš konfigurator radni prostor',
  'Company name':                          'Naziv kompanije',
  'This becomes your workspace name':      'Ovo postaje naziv vašeg radnog prostora',
  'Acme Furniture Co.':                    'Primer d.o.o.',
  'Company name must be at least 2 characters': 'Naziv kompanije mora imati najmanje 2 karaktera',
  'Min. 8 characters':                     'Min. 8 karaktera',
  'Password must be at least 8 characters': 'Lozinka mora imati najmanje 8 karaktera',
  'Confirm password':                      'Potvrdi lozinku',
  'Passwords do not match':                'Lozinke se ne poklapaju',
  'Create account':                        'Kreirajte nalog',
  'Already have an account?':             'Već imate nalog?',
  'A company with that name already exists. Try a different name.': 'Kompanija sa tim nazivom već postoji. Pokušajte sa drugim nazivom.',
  'Account setup failed. Please try again.': 'Podešavanje naloga nije uspelo. Pokušajte ponovo.',

  // Navigation
  'Dashboard':                             'Kontrolna tabla',
  'Products':                              'Proizvodi',
  'Library':                               'Biblioteka',
  'Inquiries':                             'Upiti',
  'Settings':                              'Podešavanja',
  'Sign out':                              'Odjavi se',

  // Dashboard
  'Overview of your configurator activity.': 'Pregled aktivnosti vašeg konfiguratora.',
  'Published products':                    'Objavljeni proizvodi',
  'total':                                 'ukupno',
  'New inquiries':                         'Novi upiti',
  'Awaiting review':                       'Čeka pregled',
  'Total inquiries':                       'Ukupni upiti',
  'All time':                              'Ukupno',
  'Recent inquiries':                      'Nedavni upiti',
  'View all':                              'Pogledaj sve',
  'No inquiries yet':                      'Nema još upita',
  'Create your first product':             'Kreirajte vaš prvi proizvod',
  'Welcome':                               'Dobrodošli',

  // Inquiries list
  'Quote requests submitted by your customers.': 'Zahtevi za ponude koje su podneli vaši kupci.',
  'All':                                   'Svi',
  'New':                                   'Novo',
  'Read':                                  'Pročitano',
  'Replied':                               'Odgovoreno',
  'Closed':                                'Zatvoreno',
  'When customers submit quote requests, they will appear here.': 'Kada kupci podnesu zahteve za ponude, pojaviće se ovde.',
  'Customer':                              'Kupac',
  'Product':                               'Proizvod',
  'Total':                                 'Ukupno',
  'Status':                                'Status',
  'Received':                              'Primljeno',
  'No new inquiries.':                     'Nema novih upita.',
  'No read inquiries.':                    'Nema pročitanih upita.',
  'No replied inquiries.':                 'Nema odgovorenih upita.',
  'No closed inquiries.':                  'Nema zatvorenih upita.',

  // Inquiry detail
  'Reply by email':                        'Odgovori e-mailom',
  'All inquiries':                         'Svi upiti',
  'Configuration':                         'Konfiguracija',
  'No configuration data recorded.':      'Nema sačuvanih podataka o konfiguraciji.',
  'Message':                               'Poruka',
  'Quote':                                 'Ponuda',
  'Valid until':                           'Važi do',
  'Generate & Send Quote':                 'Generiši i pošalji ponudu',
  'Sent quotes':                           'Poslate ponude',
  'PDF':                                   'PDF',
  'Expires':                               'Ističe',
  'Name':                                  'Ime',
  'View product':                          'Pogledaj proizvod',
  'Timeline':                              'Vremenska linija',
  'Updated':                               'Ažurirano',
  'Changing status here does not send any email. Use "Reply by email" to contact the customer.':
    'Promena statusa ovde ne šalje e-mail. Koristite „Odgovori e-mailom" da kontaktirate kupca.',
  'Quote sent to':                         'Ponuda poslata na',
  'Failed to generate quote':              'Generisanje ponude nije uspelo',
  'Status updated':                        'Status ažuriran',
  'Failed to update status':              'Ažuriranje statusa nije uspelo',
  'Inquiry not found':                     'Upit nije pronađen',
  'Back to inquiries':                     'Nazad na upite',

  // Products list
  'Manage your configurable products.':   'Upravljajte vašim konfigurabilnim proizvodima.',
  'New product':                           'Novi proizvod',
  'No products yet':                       'Nema još proizvoda',
  'Create your first configurable product to get started.': 'Kreirajte vaš prvi konfigurabilni proizvod da biste počeli.',
  'Create product':                        'Kreiraj proizvod',
  'Base price':                            'Osnovna cena',
  'Actions':                               'Akcije',
  'Unpublish':                             'Ukloni iz prodaje',
  'Publish':                               'Objavi',
  'Edit':                                  'Uredi',
  'Delete':                                'Obriši',
  'Delete product?':                       'Obriši proizvod?',
  'Delete failed':                         'Brisanje nije uspelo',
  'Product published':                     'Proizvod objavljen',
  'Product unpublished':                   'Proizvod uklonjen iz prodaje',
  'Failed to load products':               'Učitavanje proizvoda nije uspelo',
  'Product deleted':                       'Proizvod obrisan',
  'Update failed':                         'Ažuriranje nije uspelo',

  // New product page
  'Start by giving your product a name and base price.': 'Počnite davanjem naziva i osnovne cene vašem proizvodu.',
  'Product details':                       'Detalji proizvoda',
  'You can add characteristics and options after saving.': 'Možete dodati karakteristike i opcije nakon čuvanja.',
  'Failed to create product':              'Kreiranje proizvoda nije uspelo',

  // Edit product page
  'All products':                          'Svi proizvodi',
  'Details':                               'Detalji',
  'Characteristics':                       'Karakteristike',
  'Rules':                                 'Pravila',
  'Formula pricing':                       'Cenovne formule',
  'Visualization':                         'Vizualizacija',
  'Embed':                                 'Ugradnja',
  'Update the product name, description, and pricing.': 'Ažurirajte naziv, opis i cene proizvoda.',
  'Save changes':                          'Sačuvaj promene',
  'Characteristics & options':             'Karakteristike i opcije',
  'Define what customers can configure. Each characteristic has selectable values with optional price modifiers.':
    'Definišite šta kupci mogu da konfigurišu. Svaka karakteristika ima vrednosti sa opcionalnim modifikatorima cene.',
  'Configuration rules':                   'Pravila konfiguracije',
  'Automatically hide, disable, lock, or set values based on other selections.':
    'Automatski sakrijte, onemogućite, zaključajte ili postavite vrednosti na osnovu drugih izbora.',
  'Build custom pricing rules that calculate surcharges or discounts based on the configuration.':
    'Izgradite prilagođena pravila cena koja računaju doplate ili popuste na osnovu konfiguracije.',
  'Upload or link images and renders. Attach them to specific option values so the product visual updates as customers configure.':
    'Otpremite ili povežite slike i prikaze. Priložite ih specifičnim vrednostima opcija da vizualni prikaz proizvoda bude ažuriran dok kupci konfigurišu.',
  'Visualization assets':                  'Vizualizacioni resursi',
  'Embed & share':                         'Ugradnja i deljenje',
  'Get the embed code to place the configurator on your website.': 'Dobijte kod za ugradnju konfiguratora na vaš sajt.',
  'Product not found.':                    'Proizvod nije pronađen.',
  'Back to products':                      'Nazad na proizvode',
  'Product saved':                         'Proizvod sačuvan',
  'Failed to save product':                'Čuvanje proizvoda nije uspelo',
  'Product published ':                    'Proizvod objavljen',

  // Product form
  'Product name':                          'Naziv proizvoda',
  'e.g. Solid Wood Dining Table':          'npr. Trpezarijski sto od punog drveta',
  'Description':                           'Opis',
  'Shown to customers in the configurator': 'Prikazuje se kupcima u konfiguratoru',
  'Brief product description...':          'Kratak opis proizvoda...',
  'Before any option modifiers':           'Pre bilo kakvih modifikatora opcija',
  'Price must be 0 or more':              'Cena mora biti 0 ili više',
  'Name is required':                      'Naziv je obavezan',
  'Currency':                              'Valuta',
  '0.00':                                  '0.00',
  'Cancel':                                'Otkaži',
  'Save product':                          'Sačuvaj proizvod',

  // CharacteristicsPanel
  'No classes assigned yet. Add a class below to define what customers can configure.': 'Još nema dodeljenih klasa. Dodajte klasu ispod da definišete šta kupci mogu da konfigurišu.',
  'Go to the':                             'Idite na',
  'to create classes and characteristics first.': 'da biste prvo kreirali klase i karakteristike.',
  'No characteristics in this class yet. Add some in the Library.': 'Nema karakteristika u ovoj klasi. Dodajte neke u Biblioteci.',
  'Add a class\u2026':                     'Dodaj klasu\u2026',
  'Add':                                   'Dodaj',
  'All library classes are already assigned to this product.': 'Sve klase iz biblioteke su već dodeljene ovom proizvodu.',
  'Remove class from product?':            'Ukloni klasu sa proizvoda?',
  'Remove':                                'Ukloni',
  'Failed to load classes':                'Učitavanje klasa nije uspelo',
  'Failed to add class':                   'Dodavanje klase nije uspelo',
  'Failed to remove class':                'Uklanjanje klase nije uspelo',

  // CharacteristicValuesEditor
  'Label is required':                     'Oznaka je obavezna',
  'Add value':                             'Dodaj vrednost',
  'Value label (e.g. Oak)':               'Oznaka vrednosti (npr. Hrast)',
  'Failed to add value':                   'Dodavanje vrednosti nije uspelo',
  'Failed to delete value':                'Brisanje vrednosti nije uspelo',
  'Failed to update value':                'Ažuriranje vrednosti nije uspelo',

  // Embed panel
  'This product is not published. Publish it first so the widget can load it.':
    'Ovaj proizvod nije objavljen. Objavite ga prvo da bi widget mogao da ga učita.',
  'Live preview':                          'Pregled uživo',
  'Reload':                                'Osveži',
  'Publish the product to see a live preview.': 'Objavite proizvod da biste videli pregled uživo.',
  'Open in new tab':                       'Otvori u novom tabu',
  'Embed code':                            'Kod za ugradnju',
  'Paste this into any HTML page to embed the configurator.': 'Nalepite ovo u bilo koju HTML stranicu da ugradite konfigurator.',
  'Copy':                                  'Kopiraj',
  'Copied':                                'Kopirano',
  'Deploying the widget to your site':     'Postavljanje widgeta na vaš sajt',

  // Formula panel
  'No formulas yet. Add one below.':       'Nema još formula. Dodajte jednu ispod.',
  'Active':                                'Aktivno',
  'Inactive':                              'Neaktivno',
  'Formula name':                          'Naziv formule',
  'Formula expression':                    'Izraz formule',
  'Save formula':                          'Sačuvaj formulu',
  'New formula':                           'Nova formula',
  "Formula name (e.g. 'Size surcharge', 'Material discount')":
    "Naziv formule (npr. 'Doplata za veličinu', 'Popust za materijal')",
  'Create formula':                        'Kreiraj formulu',
  'Add formula':                           'Dodaj formulu',
  'Failed to load formulas':               'Učitavanje formula nije uspelo',
  'Enter a formula name':                  'Unesite naziv formule',
  'Failed to create formula':              'Kreiranje formule nije uspelo',
  'Formula created':                       'Formula kreirana',
  'Formula saved':                         'Formula sačuvana',
  'Failed to save formula':                'Čuvanje formule nije uspelo',
  'Failed to update formula':              'Ažuriranje formule nije uspelo',
  'Failed to delete formula':              'Brisanje formule nije uspelo',

  // Formula builder – node type labels
  'Price modifier of':                     'Modifikator cene za',
  'Numeric input':                         'Numerički unos',
  'Is selected':                           'Je izabrano',
  'Add (+)':                               'Saberi (+)',
  'Subtract (\u2212)':                     'Oduzmi (\u2212)',
  'Multiply (\u00d7)':                     'Pomnoži (\u00d7)',
  'Divide (\u00f7)':                       'Podeli (\u00f7)',
  'Greater than (>)':                      'Veće od (>)',
  'Greater or equal (\u2265)':             'Veće ili jednako (\u2265)',
  'Less than (<)':                         'Manje od (<)',
  'Less or equal (\u2264)':               'Manje ili jednako (\u2264)',
  'Equal (=)':                             'Jednako (=)',
  'AND':                                   'I',
  'OR':                                    'ILI',
  'IF / THEN / ELSE':                      'AKO / ONDA / INAČE',
  'No characteristics available':          'Nema dostupnih karakteristika',
  'No values for this characteristic':     'Nema vrednosti za ovu karakteristiku',
  'base price':                            'osnovna cena',
  'Quick templates':                       'Brzi predlošci',
  'Simple (no condition)':                 'Jednostavno (bez uslova)',
  'Conditional (IF / THEN / ELSE)':        'Uslovni (AKO / ONDA / INAČE)',
  'Base price + fixed amount':             'Osnovna cena + fiksni iznos',
  'base price + X':                        'osnovna cena + X',
  'Base price \u00d7 percentage':          'Osnovna cena \u00d7 procenat',
  'base price \u00d7 X':                   'osnovna cena \u00d7 X',
  'Base price \u00d7 input':               'Osnovna cena \u00d7 unos',
  'base price \u00d7 numeric characteristic': 'osnovna cena \u00d7 numerička karakteristika',
  'Base price \u00d7 input \u00d7 input':  'Osnovna cena \u00d7 unos \u00d7 unos',
  'base price \u00d7 Width \u00d7 Height (two numeric inputs)': 'osnovna cena \u00d7 Širina \u00d7 Visina (dva numerička unosa)',
  'Base price + modifier':                 'Osnovna cena + modifikator',
  'base price + price modifier of a characteristic': 'osnovna cena + modifikator cene karakteristike',
  'Add amount if value selected':          'Dodaj iznos ako je vrednost izabrana',
  'IF [char] = value THEN base + X ELSE base': 'AKO [kar.] = vrednost ONDA osnova + X INAČE osnova',
  'Multiply base if value selected':       'Pomnoži osnovu ako je vrednost izabrana',
  'IF [char] = value THEN base \u00d7 X ELSE base': 'AKO [kar.] = vrednost ONDA osnova \u00d7 X INAČE osnova',
  'Add amount if input > N':               'Dodaj iznos ako je unos > N',
  'IF [numeric input] > N THEN base + X ELSE base': 'AKO [numerički unos] > N ONDA osnova + X INAČE osnova',
  'Add if A or B selected':                'Dodaj ako je A ili B izabrano',
  'IF (A = v1 OR B = v2) THEN base + X ELSE base': 'AKO (A = v1 ILI B = v2) ONDA osnova + X INAČE osnova',
  'Add if A and B selected':               'Dodaj ako su A i B izabrani',
  'IF (A = v1 AND B = v2) THEN base + X ELSE base': 'AKO (A = v1 I B = v2) ONDA osnova + X INAČE osnova',
  'IF':                                    'AKO',
  'THEN':                                  'ONDA',
  'ELSE':                                  'INAČE',
  'Start with':                            'Počni sa',
  'Adjustment':                            'Korekcija',
  'Factor':                                'Faktor',
  'Characteristic value':                  'Vrednost karakteristike',
  'Compare to':                            'Uporedi sa',
  'First condition':                       'Prvi uslov',
  'Second condition':                      'Drugi uslov',

  // Status values (lowercase, for badges/options)
  'new':                                   'Novo',
  'read':                                  'Pročitano',
  'replied':                               'Odgovoreno',
  'closed':                                'Zatvoreno',
  'published':                             'Objavljeno',
  'draft':                                 'Nacrt',
  'archived':                              'Arhivirano',

  // Time ago
  'just now':                              'upravo sada',

  // Inquiries (missing keys)
  'Failed to load inquiries':              'Učitavanje upita nije uspelo',
  'Inquiry not found.':                    'Upit nije pronađen.',

  // Products (missing keys)
  'Product not found':                     'Proizvod nije pronađen',

  // Auth (missing)
  'Sign up failed. Please try again.':     'Registracija nije uspela. Pokušajte ponovo.',
  'Check your email':                      'Proverite email',
  'We sent a verification link to':        'Poslali smo link za verifikaciju na',
  'Click the link to activate your account.': 'Kliknite na link da aktivirate nalog.',
  'Back to sign in':                       'Nazad na prijavu',

  // Visualization (missing)
  'Enter a URL first':                     'Prvo unesite URL',
  'Asset added':                           'Resurs dodat',

  // Formula Builder node groups
  'Selection':                             'Selekcija',
  'Arithmetic':                            'Aritmetika',
  'Compare':                               'Poređenje',
  'Logic':                                 'Logika',
  'Conditional':                           'Uslovni',
  'Base':                                  'Osnova',

  // Rules panel
  'Rule added':                            'Pravilo dodato',
  'No rules yet. Add one below.':          'Nema još pravila. Dodajte jedno ispod.',
  'Hide value':                            'Sakrij vrednost',
  'Disable value':                         'Onemogući vrednost',
  'Override price':                        'Promeni cenu',
  'Set default':                           'Postavi podrazumevano',
  'Lock value':                            'Zaključaj vrednost',
  'No values':                             'Nema vrednosti',
  'New rule':                              'Novo pravilo',
  'ON':                                    'NA',
  'value':                                 'vrednost',
  'e.g. 50 or \u221220':                   'npr. 50 ili \u221220',
  'Add rule':                              'Dodaj pravilo',
  'Select a condition characteristic':     'Izaberite karakteristiku za uslov',
  'Select a condition value':              'Izaberite vrednost za uslov',
  'Select a target characteristic':        'Izaberite ciljanu karakteristiku',
  'Select a target value':                 'Izaberite ciljanu vrednost',
  'Failed to load rules':                  'Učitavanje pravila nije uspelo',
  'Failed to add rule':                    'Dodavanje pravila nije uspelo',
  'Failed to delete rule':                 'Brisanje pravila nije uspelo',
  'amount':                                'iznos',

  // Visualization panel
  'No visualization assets yet. Add one below.': 'Nema još vizualizacionih resursa. Dodajte jedan ispod.',
  'Default':                               'Podrazumevano',
  'Image':                                 'Slika',
  'Render':                                'Prikaz',
  '3D Model':                              '3D model',
  'Add visualization asset':              'Dodaj vizualizacioni resurs',
  'Add asset':                             'Dodaj resurs',
  'Paste URL':                             'Nalepi URL',
  'Upload file':                           'Otpremi fajl',
  'https://example.com/image.jpg':         'https://primer.com/slika.jpg',
  'Type':                                  'Tip',
  'Attach to value':                       'Priloži vrednosti',
  'Default (no specific value)':           'Podrazumevano (bez specifične vrednosti)',
  'Also use as default fallback':          'Koristi i kao podrazumevano',
  'Set as default':                        'Postavi kao podrazumevano',
  'Unset default':                         'Ukloni podrazumevano',
  'Move up':                               'Pomeri gore',
  'Move down':                             'Pomeri dole',
  'Delete asset?':                         'Obriši resurs?',
  'This will remove the asset. The image file itself (if hosted externally) will not be deleted.':
    'Ovo će ukloniti resurs. Sam fajl slike (ako je hostovan eksterno) neće biti obrisan.',
  'File uploaded \u2014 click Add to save': 'Fajl otpremljen \u2014 kliknite Dodaj za čuvanje',
  'Asset uploaded and saved':              'Resurs otpremljen i sačuvan',
  'Upload and save':                       'Otpremi i sačuvaj',
  'Upload failed':                         'Otpremanje nije uspelo',
  'Failed to add asset':                   'Dodavanje resursa nije uspelo',
  'Failed to delete asset':                'Brisanje resursa nije uspelo',
  'Failed to update asset':                'Ažuriranje resursa nije uspelo',
  'Failed to reorder':                     'Promena redosleda nije uspela',

  // Library page
  'Characteristic Library':                'Biblioteka karakteristika',
  'Manage all characteristics and classes. Drag a characteristic onto a class card to assign it.':
    'Upravljajte svim karakteristikama i klasama. Prevucite karakteristiku na karticu klase da je dodelite.',
  'Classes':                               'Klase',
  'Group characteristics into named sections. Assign classes to products.':
    'Grupi\u0161ite karakteristike u imenovane sekcije. Dodelite klase proizvodima.',
  'New class':                             'Nova klasa',
  'No classes yet.':                       'Nema još klasa.',
  'Class name (e.g. Dimensions, Material)': 'Naziv klase (npr. Dimenzije, Materijal)',
  'Create':                                'Kreiraj',
  'New characteristic':                    'Nova karakteristika',
  'New characteristic ':                   'Nova karakteristika',
  'Name (e.g. Material, Width)':           'Naziv (npr. Materijal, Širina)',
  'Select':                                'Izbor',
  'Radio':                                 'Radio',
  'Swatch':                                'Uzorak',
  'Toggle':                                'Preklopnik',
  'No characteristics yet.':              'Nema još karakteristika.',
  'Drag characteristics here':             'Prevucite karakteristike ovde',
  'Drop here to add':                      'Spustite ovde da dodate',
  '+ drop here':                           '+ spustite ovde',
  'no class':                              'bez klase',
  'val':                                   'vred.',
  'vals':                                  'vred.',
  'Values':                                'Vrednosti',
  'Delete characteristic?':               'Obriši karakteristiku?',
  'Delete class?':                         'Obriši klasu?',
  'Failed to load library':                'Učitavanje biblioteke nije uspelo',
  'Failed to create characteristic':       'Kreiranje karakteristike nije uspelo',
  'Failed to rename characteristic':       'Preimenovanje karakteristike nije uspelo',
  'Failed to update type':                 'Ažuriranje tipa nije uspelo',
  'Failed to delete characteristic':       'Brisanje karakteristike nije uspelo',
  'Failed to create class':                'Kreiranje klase nije uspelo',
  'Failed to delete class':                'Brisanje klase nije uspelo',
  'Failed to add characteristic to class': 'Dodavanje karakteristike u klasu nije uspelo',
  'Failed to remove characteristic from class': 'Uklanjanje karakteristike iz klase nije uspelo',
  'Drag to assign to class':               'Prevucite da biste dodelili klasi',

  // Settings page
  'Manage your account and workspace.':   'Upravljajte vašim nalogom i radnim prostorom.',
  'Workspace':                             'Radni prostor',
  'Your tenant details':                   'Detalji vašeg naloga',
  'Inquiry notifications':                 'Obaveštenja o upitima',
  'Where to send email alerts when a customer submits a new inquiry. Defaults to your account email if left blank.':
    'Gde slati e-mail upozorenja kada kupac podnese novi upit. Podrazumevano je vaš nalog e-mail ako se ostavi prazno.',
  'Notification email':                    'E-mail za obaveštenja',
  'you@example.com (fallback)':            'vi@primer.com (rezervno)',
  'Save':                                  'Sačuvaj',
  'Account':                               'Nalog',
  'Your login details':                    'Vaši podaci za prijavu',
  'Notification email saved':              'E-mail za obaveštenja sačuvan',
  'Failed to save':                        'Čuvanje nije uspelo',
  'Plan':                                  'Plan',
  'Slug':                                  'Identifikator',
  'Company Profile':                       'Profil kompanije',
  'This information appears on generated PDF quotations.': 'Ove informacije se pojavljuju na generisanim PDF ponudama.',
  'Logo':                                  'Logo',
  'Upload logo':                           'Otpremi logo',
  'PNG or JPG, max 2 MB':                  'PNG ili JPG, maks. 2 MB',
  'Contact person':                        'Kontakt osoba',
  'e.g. Jane Smith':                       'npr. Iva Matić',
  'Street, City, Country':                 'Ulica, grad, zemlja',
  'Website':                               'Veb sajt',
  'Save company profile':                  'Sačuvaj profil kompanije',
  'Rejection Reasons':                     'Razlozi odbijanja',
  'Predefined reasons shown when marking a quotation as rejected.':
    'Predefinisani razlozi koji se prikazuju pri označavanju ponude kao odbijene.',
  'No reasons defined yet.':              'Nema još definisanih razloga.',
  'e.g. Price too high':                  'npr. Cena previsoka',
  'Delete rejection reason':              'Obriši razlog odbijanja',
  'This reason will be removed. Existing quotations linked to it will keep the reference but the label will no longer resolve.':
    'Ovaj razlog će biti uklonjen. Postojeće ponude zadržaće referencu, ali oznaka neće biti prikazana.',
  'File too large':                        'Fajl je prevelik',
  'Max 2 MB':                              'Maks. 2 MB',
  'Logo uploaded':                         'Logo otpremljen',
  'Logo upload failed':                    'Otpremanje loga nije uspelo',
  'Failed to add reason':                  'Dodavanje razloga nije uspelo',
  'Failed to save reason':                 'Čuvanje razloga nije uspelo',
  'Failed to delete reason':               'Brisanje razloga nije uspelo',
  'Company profile saved':                 'Profil kompanije sačuvan',

  // Quotations list
  'Quotations':                            'Ponude',
  'Create and manage quotations for your customers.': 'Kreirajte i upravljajte ponudama za vaše kupce.',
  'New Quotation':                         'Nova ponuda',
  'No quotations yet':                     'Nema još ponuda',
  'Create your first quotation to get started.': 'Kreirajte vašu prvu ponudu za početak.',
  'Reference':                             'Referenca',
  'Created':                               'Kreirano',
  'Failed to load quotations':             'Učitavanje ponuda nije uspelo',
  'Report':                                'Izveštaj',

  // Quotation statuses
  'In preparation':                        'U pripremi',
  'Confirmed & sent':                      'Potvrđena i poslata',
  'Accepted — no changes':                 'Prihvaćena — bez izmena',
  'Accepted with changes':                 'Prihvaćena sa izmenama',
  'Rejected':                              'Odbijena',
  'Expired':                               'Istekla',

  // Quotation detail page
  'Failed to load quotation':              'Učitavanje ponude nije uspelo',
  'Quotation':                             'Ponuda',
  'Quotation not found':                   'Ponuda nije pronađena',
  'Back to Quotations':                    'Nazad na ponude',
  'Download PDF':                          'Preuzmi PDF',
  'Technical spec':                        'Tehnička specifikacija',
  'Generate a Word document with the technical specification of the products on this quotation.':
    'Kreiraj Word dokument sa tehničkom specifikacijom proizvoda iz ove ponude.',
  'Failed to generate technical specification':
    'Generisanje tehničke specifikacije nije uspelo',
  'Generate PDF':                          'Generiši PDF',
  'PDF saved':                             'PDF sačuvan',
  'Company':                               'Kompanija',
  'Phone':                                 'Telefon',
  'Address':                               'Adresa',
  'Line Items':                            'Stavke',
  'SKU':                                   'SKU',
  'Qty':                                   'Kol.',
  'Unit Price':                            'Jedin. cena',
  'Subtotal':                              'Međuzbir',
  'Notes':                                 'Napomene',
  'Mark as Rejected':                      'Označi kao odbijeno',
  'Select a reason and optionally add a note.': 'Izaberite razlog i po potrebi dodajte napomenu.',
  'Reason':                                'Razlog',
  '— select a reason —':                  '— izaberite razlog —',
  'No predefined reasons yet. Add some in Settings.': 'Nema još predefinisanih razloga. Dodajte neke u Podešavanjima.',
  'Additional note':                       'Dodatna napomena',
  'optional':                              'opciono',
  'e.g. Customer requested a revised offer instead.': 'npr. Kupac je zahtevao revidiranu ponudu.',
  'Confirm rejection':                     'Potvrdi odbijanje',
  'Quotation marked as rejected':          'Ponuda označena kao odbijena',
  'Save PDF to cloud?':                    'Sačuvati PDF u oblak?',
  'The PDF will be stored in Supabase storage and a permanent download link will be attached to this quotation.':
    'PDF će biti sačuvan i stalni link za preuzimanje biće priložen ovoj ponudi.',
  'Save PDF':                              'Sačuvaj PDF',
  'PDF saved to cloud':                    'PDF sačuvan u oblaku',
  'Failed to save PDF':                    'Čuvanje PDF-a nije uspelo',
  'Failed to generate PDF':               'Generisanje PDF-a nije uspelo',

  // Quotation form page
  'Edit Quotation':                        'Uredi ponudu',
  'Quote Details':                         'Detalji ponude',
  'Valid Until':                           'Važi do',
  'Internal notes or terms\u2026':         'Interne napomene ili uslovi\u2026',
  'Add line item':                         'Dodaj stavku',
  'No line items yet. Add a product to get started.': 'Nema još stavki. Dodajte proizvod za početak.',
  'Select a product\u2026':               'Izaberite proizvod\u2026',
  'Line total':                            'Ukupno za stavku',
  'Surcharges, Discounts & Taxes':         'Doplate, popusti i porezi',
  'Add adjustment':                        'Dodaj korekciju',
  'No adjustments. Add tax, surcharges, or discounts.': 'Nema korekcija. Dodajte porez, doplate ili popuste.',
  'Surcharge':                             'Doplata',
  'Discount':                              'Popust',
  'Tax':                                   'Porez',
  'Label (e.g. VAT 20%)':                 'Oznaka (npr. PDV 20%)',
  'Customer name is required':             'Naziv kupca je obavezan',
  'Customer email is required':            'E-mail kupca je obavezan',
  'All line items must have a product selected': 'Sve stavke moraju imati izabran proizvod',
  'Failed to save quotation':              'Čuvanje ponude nije uspelo',
  'Save Draft':                            'Sačuvaj nacrt',
  'Save & Generate PDF':                   'Sačuvaj i generiši PDF',
  'Preview PDF':                           'Pregled PDF-a',
  'Confirm & Generate PDF':                'Potvrdi i generiši PDF',
  'Quotation confirmed':                   'Ponuda potvrđena',
  'Copy quotation':                        'Kopiraj ponudu',
  'Failed to copy quotation':              'Kopiranje ponude nije uspelo',
  'This quotation is confirmed and cannot be edited.':
    'Ova ponuda je potvrđena i ne može se izmeniti.',
  'Failed to load product details':        'Učitavanje detalja proizvoda nije uspelo',

  // Configure product dialog
  'Configure':                             'Konfiguriši',
  'Select options for this product. The price updates automatically.': 'Izaberite opcije za ovaj proizvod. Cena se automatski ažurira.',
  'locked':                                'zaključano',
  'No available options':                  'Nema dostupnih opcija',
  'Configured unit price':                 'Konfigurisana jedinična cena',
  'Apply configuration':                   'Primeni konfiguraciju',
  'Reconfigure':                           'Rekonfiguriši',

  // PDF layout dialog
  'Customize PDF Layout':                  'Prilagodi raspored PDF-a',
  'Drag to reorder sections. Click the eye icon to show or hide a section.':
    'Prevucite za promenu redosleda. Kliknite na ikonicu oka za prikaz ili skrivanje sekcije.',
  'Always included':                       'Uvek uključeno',
  'Line Items & Summary':                  'Stavke i pregled cene',
  'Terms & Conditions':                    'Uslovi i odredbe',
  'PDF Language':                          'Jezik PDF-a',

  // Texts page & panel
  'Texts':                                 'Tekstovi',
  'Global text blocks included in PDF quotations. Product-specific texts are managed in the product editor.':
    'Globalni blokovi teksta uključeni u PDF ponude. Tekstovi specifični za proizvod upravljaju se u uređivaču proizvoda.',
  'Text Types':                            'Tipovi tekstova',
  'Global Text Blocks':                    'Globalni blokovi teksta',
  'No global text blocks yet.':            'Nema još globalnih blokova teksta.',
  "Product-specific texts (Product description, Specification) are managed in each product's Texts tab.":
    'Tekstovi specifični za proizvod (Opis, Specifikacija) upravljaju se u kartici Tekstovi svakog proizvoda.',
  'Product description':                   'Opis proizvoda',
  'Specification':                         'Specifikacija',
  'Note':                                  'Napomena',
  'Terms':                                 'Uslovi',
  'Add text block':                        'Dodaj blok teksta',
  'No text blocks yet. Add one below.':    'Nema još blokova teksta. Dodajte jedan ispod.',
  'Add text':                              'Dodaj tekst',
  'e.g. Technical specs, Warranty, Note': 'npr. Tehničke specifikacije, Garancija, Napomena',
  'Label':                                 'Oznaka',
  'Content...':                            'Sadržaj...',
  '(empty)':                               '(prazno)',
  'Delete text block':                     'Obriši blok teksta',
  'Text block added':                      'Blok teksta dodat',
  'Text block saved':                      'Blok teksta sačuvan',
  'Text block deleted':                    'Blok teksta obrisan',
  'Failed to load texts':                  'Učitavanje tekstova nije uspelo',
  'Failed to add text':                    'Dodavanje teksta nije uspelo',
  'Failed to save text':                   'Čuvanje teksta nije uspelo',

  // Central Texts page (migration 076 / 077)
  'Central Texts':                         'Centralni tekstovi',
  'Maintain every piece of customer-facing copy in one place — keyed by level, reference, slot and language. Edit inline; changes save when you click the save icon or blur the textarea.':
    'Održavajte svaki tekst koji vide klijenti na jednom mestu — po nivou, referenci, slotu i jeziku. Izmene se čuvaju kada kliknete ikonu za čuvanje ili napustite polje.',
  'Tenant':                                'Nalog',
  'All levels':                            'Svi nivoi',
  'All slots':                             'Svi slotovi',
  'Slot':                                  'Slot',
  'Lang':                                  'Jez',
  'Both':                                  'Oba',
  'Content':                               'Sadržaj',
  'Search content, label, reference…':     'Pretraži sadržaj, oznaku, referencu…',
  'Showing':                               'Prikazano',
  'of':                                    'od',
  'rows':                                  'redova',
  'No texts yet. Run the migration 077 backfill, or click "Add text" to create the first row.':
    'Nema još tekstova. Pokrenite backfill iz migracije 077 ili kliknite „Dodaj tekst“ za prvi red.',
  'No rows match the current filters.':    'Nema redova koji odgovaraju filterima.',
  'Delete text?':                          'Obrisati tekst?',
  'This text will be removed. If a renderer depends on it, the legacy column fallback will be used until you restore it.':
    'Tekst će biti uklonjen. Ako renderer zavisi od njega, koristiće se rezerva iz nasleđene kolone dok ga ne vratite.',
  'Text deleted':                          'Tekst obrisan',
  'Pick a level, reference (if applicable), slot and language. The combination must be unique unless the slot is multi-row.':
    'Izaberite nivo, referencu (ako je potrebno), slot i jezik. Kombinacija mora biti jedinstvena osim ako je slot višestruki.',
  '— pick one —':                          '— izaberite —',
  'Please pick a reference':               'Izaberite referencu',
  'Failed to create text':                 'Kreiranje teksta nije uspelo',
  'Sort order':                            'Redosled',
  'Optional — shown as the block heading on the PDF':
    'Opciono — prikazuje se kao naslov bloka u PDF-u',
  'Type the text…':                        'Unesite tekst…',
  'Saved':                                 'Sačuvano',
  'Failed to delete text':                 'Brisanje teksta nije uspelo',
  'Language':                              'Jezik',
  'English':                               'Engleski',
  'Serbian':                               'Srpski',

  // Product form
  'Number':                                'Broj',
  'Unit of Measure':                       'Jedinica mere',
  'e.g. pcs, m², kg, m':             'npr. kom, m², kg, m',
  'Optional unique product identifier':    'Opcioni jedinstveni identifikator proizvoda',

  // Characteristics panel
  'characteristic':                        'karakteristika',

  // Formula builder
  'No other formulas available':           'Nema dostupnih formula',

  // Rules panel
  'on':                                    'na',

  // Quotations
  'All statuses':                          'Svi statusi',
  'Clear':                                 'Poništi filter',
  'Search by customer or reference…': 'Pretraži po kupcu ili referenci…',
  'No quotations match the current filters.': 'Nema ponuda koje odgovaraju filterima.',
  'quotation':                             'ponuda',
  'quotations':                            'ponude',
  'Quotations Report':                     'Izveštaj o ponudama',
  'SKU / Code':                            'SKU / kod',
  'Customer name':                         'Naziv kupca',

  // Edit product page
  'Product Texts':                         'Tekstovi proizvoda',

  // Texts panel
  'Named text blocks included in PDF quotations. Use these for product descriptions, specifications, or terms.':
    'Imenovani blokovi teksta koji se uključuju u PDF ponude. Koristite ih za opise proizvoda, specifikacije ili uslove.',
  'This text block will be permanently deleted.': 'Ovaj blok teksta će biti trajno obrisan.',

  // Address (lowercase variant used in company profile)
  'Street, city, country':                 'Ulica, grad, zemlja',

  // 3D / Visualization
  '3D models':                             '3D modeli',
  'Enable AR (augmented reality) button on 3D model': 'Omogući AR (proširena stvarnost) dugme na 3D modelu',
  'Load mesh names from model':            'Učitaj nazive mreža iz modela',
  'Mesh name':                             'Naziv mreže',
  'Mesh rules':                            'Pravila mreže',
  'Mesh rules saved':                      'Pravila mreže sačuvana',
  'Configure mesh rules':                  'Konfiguriši pravila mreže',
  'Save mesh rules':                       'Sačuvaj pravila mreže',
  'Failed to save mesh rules':             'Čuvanje pravila mreže nije uspelo',
  'Show a mesh only when a specific value is selected. Meshes not listed here are always visible.':
    'Prikazuj mrežu samo kada je izabrana određena vrednost. Mreže koje ovde nisu navedene su uvek vidljive.',
  'Show when value selected':              'Prikaži kada je vrednost izabrana',
  'No visibility rules yet.':             'Nema još pravila vidljivosti.',
  'Add visibility rule':                   'Dodaj pravilo vidljivosti',
  'No dimension rules yet.':              'Nema još pravila dimenzija.',
  'Add dimension rule':                    'Dodaj pravilo dimenzija',
  'Add at least one numeric characteristic to this product to use dimension rules.':
    'Dodajte najmanje jednu numeričku karakteristiku ovom proizvodu da biste koristili pravila dimenzija.',
  'Scale a model node along an axis based on a numeric characteristic. Useful for width, height, depth.':
    'Skalirajte čvor modela duž ose na osnovu numeričke karakteristike. Korisno za širinu, visinu, dubinu.',
  'Axis':                                  'Osa',
  'Node name':                             'Naziv čvora',
  'Scale min':                             'Min. skala',
  'Scale max':                             'Maks. skala',
  'Value min':                             'Min. vrednost',
  'Value max':                             'Maks. vrednost',
  'Select node…':                          'Izaberite čvor…',
  'Select mesh…':                          'Izaberite mrežu…',
  'Surface type':                          'Vrsta površine',
  'Wall':                                  'Zid',
  'Floor':                                 'Pod',
  'For furniture, appliances':             'Za nameštaj, aparate',
  'For windows, paintings, shelves':       'Za prozore, slike, police',
  'Viewer':                                'Prikaz',
  'Dimensions':                            'Dimenzije',

  // Embed / widget
  'Embed options':                         'Opcije ugradnje',
  'Three ways to add the configurator widget to your website.': 'Tri načina za dodavanje konfiguratora na vaš sajt.',
  'Script tag':                            'Script tag',
  'Script tag embed':                      'Ugradnja putem script taga',
  'iFrame':                                'iFrame',
  'iFrame embed':                          'iFrame ugradnja',
  'Web Component':                         'Web Component',
  'Web Component embed':                   'Web Component ugradnja',
  'Best for':                              'Najpogodnije za',
  'Most websites, CMS':                    'Većina sajtova, CMS',
  'React, Vue, Angular apps':              'React, Vue, Angular aplikacije',
  'Strict CSP, no-JS sites':              'Strogi CSP, sajtovi bez JS',
  'Full isolation; requires a published public slug':
    'Potpuna izolacija; zahteva objavljeni javni identifikator',
  'Fully isolated embed served from the Configureout CDN. Suitable for strict Content Security Policy environments. Requires the product to be published with a public share link.':
    'Potpuno izolovana ugradnja servirana sa Configureout CDN-a. Pogodno za stroga CSP okruženja. Zahteva da je proizvod objavljen sa javnim linkom za deljenje.',
  'Paste one snippet, widget mounts automatically': 'Nalepite jedan isečak, widget se montira automatski',
  'Custom element — place anywhere in JSX/templates': 'Prilagođeni element — postavite bilo gde u JSX/predloške',
  'Add the snippet below to any HTML page. The widget mounts automatically on elements that have a':
    'Dodajte isečak ispod na bilo koju HTML stranicu. Widget se automatski montira na elemente koji imaju',
  'custom element anywhere a standard HTML element is valid, including inside React and Vue components.':
    'prilagođeni element bilo gde gde je validan standardni HTML element, uključujući React i Vue komponente.',
  'TypeScript will warn about unknown JSX elements. Add a declaration file:':
    'TypeScript će upozoriti na nepoznate JSX elemente. Dodajte deklaracioni fajl:',
  'React usage note':                      'Napomena za React upotrebu',
  'Copy the snippet':                      'Kopiraj isečak koda',
  'Replace the placeholder IDs':           'Zamenite ID-ove sa stvarnim vrednostima',
  'Set width to 100% and adjust height to fit your layout (400–700 px is typical).':
    'Postavite širinu na 100% i podesite visinu prema vašem izgledu (400–700 px je tipično).',
  'For responsive height, use a ResizeObserver on the iframe with postMessage from the widget (advanced).':
    'Za responzivnu visinu, koristite ResizeObserver na iframu sa postMessage iz widgeta (napredno).',
  'The iframe background is transparent — it inherits your page background.':
    'Pozadina iframea je prozirna — nasleđuje pozadinu vaše stranice.',
  'Sizing tips':                           'Saveti za dimenzionisanje',
  'Share link':                            'Link za deljenje',
  'Public slug':                           'Javni identifikator',
  'Anyone with this link can preview your configurator without logging in.':
    'Svako ko ima ovaj link može pregledati vaš konfigurator bez prijave.',
  'Link is active':                        'Link je aktivan',
  'Link is disabled':                      'Link je onemogućen',
  'Open link':                             'Otvori link',
  'Download QR':                           'Preuzmi QR',
  'Scan to open the configurator on any device.': 'Skenirajte za otvaranje konfiguratora na bilo kom uređaju.',
  'Publish the product':                   'Objavi proizvod',
  'Publish this product to get a shareable preview link.': 'Objavite ovaj proizvod da dobijete link za deljenje pregleda.',
  'Publish your product and paste the embed code on your website.': 'Objavite vaš proizvod i nalepite kod za ugradnju na vaš sajt.',
  'Publish and embed':                     'Objavi i ugradi',
  'A shareable link will appear here once the product is saved after publishing.':
    'Link za deljenje će se pojaviti ovde kada se proizvod sačuva nakon objavljivanja.',
  'Copy the slug from the share link on the product Embed tab.':
    'Kopirajte identifikator sa linka za deljenje na kartici Ugradnja proizvoda.',
  'on the product Embed tab in the admin.': 'na kartici Ugradnja proizvoda u adminu.',
  'Use the':                               'Koristite',
  'Use':                                   'Koristite',
  'Find your':                             'Pronađite vaš',
  'Type your workspace slug':              'Unesite identifikator radnog prostora',
  'Widget style':                          'Stil widgeta',
  'Choose a colour palette and font that matches your site.': 'Izaberite paletu boja i font koji odgovaraju vašem sajtu.',
  'Branding':                              'Brendiranje',
  'Remove branding':                       'Ukloni brendiranje',
  'Remove "Powered by Configureout" badge': 'Ukloni oznaku "Powered by Configureout"',
  'The "Powered by Configureout" badge is shown on all widgets. Upgrade to Growth or Scale to remove it.':
    'Oznaka "Powered by Configureout" prikazuje se na svim widgetima. Nadogradite na Growth ili Scale da je uklonite.',
  'The widget will only load data for published products. Set status to Published in the product editor.':
    'Widget će učitati podatke samo za objavljene proizvode. Postavite status na Objavljeno u uređivaču proizvoda.',

  // AI / New product
  'AI product setup':                      'AI podešavanje proizvoda',
  'AI product setup is available on Starter and higher plans.': 'AI podešavanje proizvoda dostupno je na Starter planu i višim.',
  'AI setups this month':                  'AI podešavanja ovog meseca',
  'Claude will generate a configurable product structure from your description.':
    'Claude će generisati konfigurabilnu strukturu proizvoda iz vašeg opisa.',
  'Describe your product':                 'Opišite vaš proizvod',
  'e.g. A custom wooden desk available in three widths with a choice of solid oak or walnut surface and metal or wood legs...':
    'npr. Prilagođeni drveni sto dostupan u tri širine sa izborom punog hrasta ili orahovine i metalnim ili drvenim nogama...',
  'Generate':                              'Generiši',
  'Generating product structure…':         'Generišem strukturu proizvoda…',
  'Generation failed':                     'Generisanje nije uspelo',
  'Regenerate':                            'Regeneriši',
  'Suggestions':                           'Predlozi',
  'From description':                      'Iz opisa',
  'From scratch':                          'Od nule',
  'From template':                         'Iz predloška',
  'Start from a template or build from scratch with options and pricing.':
    'Počnite od predloška ili izgradite od nule sa opcijama i cenama.',
  'Start from a template or build from scratch.': 'Počnite od predloška ili izgradite od nule.',
  'No templates available.':              'Nema dostupnih predložaka.',
  'Upgrade your plan to use AI product setup.': 'Nadogradite plan za korišćenje AI podešavanja proizvoda.',
  'Vertical':                              'Vertikala',
  'Furniture':                             'Nameštaj',
  'Windows':                               'Prozori',
  'Doors':                                 'Vrata',
  'Other':                                 'Ostalo',
  '— select vertical —':                  '— izaberite kategoriju —',
  'All products were created as drafts. Open each one to add characteristics and publish.':
    'Svi proizvodi su kreirani kao nacrti. Otvorite svaki da dodate karakteristike i objavite.',

  // CSV import
  'Import':                                'Uvezi',
  'Import CSV':                            'Uvezi CSV',
  'Import more':                           'Uvezi više',
  'Import products from CSV':              'Uvezi proizvode iz CSV',
  'Upload CSV':                            'Otpremi CSV',
  'Upload a CSV file to create multiple products at once.': 'Otpremite CSV fajl da kreirate više proizvoda odjednom.',
  'Click to upload a CSV file':            'Kliknite za otpremanje CSV fajla',
  'CSV format':                            'CSV format',
  'CSV import is available on Starter plan and above.': 'Uvoz CSV dostupan je na Starter planu i višim.',
  'Max 200 rows':                          'Maks. 200 redova',
  'Your file must include a header row. Supported columns:': 'Vaš fajl mora uključivati red zaglavlja. Podržane kolone:',
  'Review before importing. All products will be created as drafts.': 'Pregledajte pre uvoza. Svi proizvodi će biti kreirani kao nacrti.',
  'Validation errors:':                    'Greške validacije:',
  'products imported successfully':        'proizvoda uvezeno uspešno',
  'Column':                                'Kolona',
  'Example':                               'Primer',

  // Quotation form & inquiry actions
  'Convert to quotation':                  'Konvertuj u ponudu',
  'Pre-fill a new quotation with the customer info, product, and selected options from this inquiry.':
    'Unapred popunite novu ponudu podacima kupca, proizvodom i izabranim opcijama iz ovog upita.',
  'A quotation has already been created from this inquiry.': 'Ponuda je već kreirana iz ovog upita.',
  'Created from inquiry':                  'Kreirano iz upita',
  'View linked quotation':                 'Pogledaj povezanu ponudu',
  'Some options could not be carried over': 'Neke opcije nisu mogle biti prenete',
  'The product was edited since the inquiry was submitted.': 'Proizvod je uređen od kada je upit podnet.',
  'Item adjustments':                      'Korekcije stavke',
  'Applied to the subtotal. For per-item adjustments, use the controls inside each line item.':
    'Primenjuje se na međuzbir. Za korekcije po stavci, koristite kontrole unutar svake stavke.',
  'Scheduled price':                       'Zakazana cena',
  'replaces catalogue price':              'zamenjuje kataloški cenu',

  // Form config
  'Configure the inquiry form':            'Konfiguriši obrazac upita',
  'Configure the lead-capture form shown to customers, including optional fields and GDPR consent.':
    'Konfiguriši obrazac prikazan kupcima, uključujući opciona polja i GDPR saglasnost.',
  'Inquiry form':                          'Obrazac upita',
  'Optional fields':                       'Opciona polja',
  'Phone number':                          'Broj telefona',
  'Add an optional phone number field to the inquiry form.': 'Dodajte opciono polje za broj telefona u obrazac upita.',
  'Add an optional company name field to the inquiry form.': 'Dodajte opciono polje za naziv kompanije u obrazac upita.',
  'GDPR consent checkbox':                 'Polje za GDPR saglasnost',
  'Require visitors to tick a consent box before submitting.': 'Zahtevajte od posetilaca da potvrde saglasnost pre slanja.',
  'Consent text':                          'Tekst saglasnosti',
  'Link text':                             'Tekst linka',
  'Link URL':                              'URL linka',
  'Privacy policy':                        'Politika privatnosti',
  'I agree to the processing of my personal data.': 'Slažem se sa obradom mojih ličnih podataka.',
  'Add GDPR consent and optional fields on the Form tab of your product.':
    'Dodajte GDPR saglasnost i opciona polja na kartici Forma vašeg proizvoda.',
  'Save form settings':                    'Sačuvaj podešavanja obrasca',
  'Form settings saved':                   'Podešavanja obrasca sačuvana',

  // Translations (i18n editor)
  'Name translations':                     'Prevodi naziva',
  'Description translations':             'Prevodi opisa',
  'Translated name':                       'Prevedeni naziv',
  'Translated description':               'Prevedeni opis',
  'Description (optional, per language)':  'Opis (opciono, po jeziku)',
  'Shown on the quotation PDF when descriptions are enabled': 'Prikazuje se u PDF-u ponude kada su opisi uključeni',
  'Failed to save description translation': 'Greška pri čuvanju prevoda opisa',
  'Desc':                                  'Opis',
  'Add description':                       'Dodaj opis',
  'Expand to edit name translations and description': 'Proširite za uređivanje prevoda naziva i opisa',
  'Failed to save translation':            'Čuvanje prevoda nije uspelo',

  // Analytics
  'Analytics':                             'Analitika',
  'Advanced analytics':                    'Napredna analitika',
  'Analytics appear once your widget is embedded and visitors start interacting.':
    'Analitika se pojavljuje kada je vaš widget ugrađen i posetioci počnu da interaguju.',
  'Last 30 days of widget activity.':      'Poslednjih 30 dana aktivnosti widgeta.',
  'Views':                                 'Pregledi',
  'Conversion':                            'Konverzija',
  'Inquiries this month':                  'Upiti ovog meseca',
  'Avg quote price':                       'Prosečna cena ponude',
  'Funnel':                                'Tok konverzije',
  'Funnel analysis, per-characteristic drop-off, value frequency and CSV export are available on the Growth plan.':
    'Analiza toka, opadanje po karakteristikama, učestalost vrednosti i CSV izvoz dostupni su na Growth planu.',
  'By product':                            'Po proizvodu',
  'Most-interacted characteristics':       'Najkorišćenije karakteristike',
  'Most selected values':                  'Najčešće birane vrednosti',
  'Price distribution':                    'Raspodela cena',
  'Drop-off — last characteristic before abandonment': 'Odustajanje — poslednja karakteristika pre napuštanja',
  'Inquiry → quotation pipeline':          'Tok: upit → ponuda',
  'Widget inquiries':                      'Upiti sa widgeta',
  'Became quotations':                     'Postale ponude',
  'Accepted':                              'Prihvaćeno',
  'No data yet':                           'Nema podataka',
  'views → inquiry':                       'pregledi → upit',
  'Visibility':                            'Vidljivost',

  // Webhooks
  'Webhooks':                              'Vebhukovi',
  'Webhooks are available on the Growth plan and above.': 'Vebhukovi su dostupni na Growth planu i višim.',
  'Add endpoint':                          'Dodaj endpoint',
  'Failed to add webhook':                 'Dodavanje vebhuka nije uspelo',
  'Method':                                'Metod',
  'Subject / Title':                       'Predmet / naslov',
  'Webhook payload (v2)':                  'Vebhuk payload (v2)',
  'When a customer submits an inquiry, Configureout fires an':
    'Kada kupac podnese upit, Configureout šalje',
  'Receive HTTP POST events when inquiries or quotations change.': 'Primajte HTTP POST događaje kada se upiti ili ponude promene.',
  'Recent deliveries':                     'Nedavne isporuke',
  'No deliveries yet.':                    'Nema još isporuka.',
  'Started':                               'Pokrenuto',
  'Submitted':                             'Poslano',

  // Team / invitations
  'Team':                                  'Tim',
  'Team members':                          'Članovi tima',
  'Member':                                'Član',
  'Members':                               'Članovi',
  'Admin':                                 'Administrator',
  'Invite member':                         'Pozovi člana',
  'Invite a team member':                  'Pozovite člana tima',
  'Invite colleagues to your workspace.': 'Pozovite kolege u vaš radni prostor.',
  'Add colleagues so they can manage products and inquiries.': 'Dodajte kolege da mogu da upravljaju proizvodima i upitima.',
  'Send invitation':                       'Pošalji pozivnicu',
  'Invitation sent':                       'Pozivnica poslata',
  'Failed to send invitation':             'Slanje pozivnice nije uspelo',
  'Already a member':                      'Već je član',
  'This person is already a member of your workspace.': 'Ova osoba je već član vašeg radnog prostora.',
  'Invalid email address':                 'Nevažeća e-mail adresa',
  'Email address must contain only standard ASCII characters.': 'E-mail adresa sme sadržati samo standardne ASCII znakove.',
  'Invitation created — email not sent':   'Pozivnica kreirana — e-mail nije poslat',
  'Share this link manually:':             'Podelite ovaj link ručno:',
  'Pending invitations':                   'Pozivnice na čekanju',
  'colleague@company.com':                 'kolega@kompanija.com',
  'Accept invitation':                     'Prihvati pozivnicu',
  'Checking invite':                       'Proveravam pozivnicu',
  'Invalid invitation':                    'Nevažeća pozivnica',
  'Invalid invite link.':                  'Nevažeći link pozivnice.',
  'Invite not found or already used.':    'Pozivnica nije pronađena ili je već iskorišćena.',
  'This invite has already been accepted.': 'Ova pozivnica je već prihvaćena.',
  'This invite has expired.':              'Ova pozivnica je istekla.',
  'You have been invited to join':         'Pozvani ste da se pridružite',
  'a workspace':                           'radni prostor',
  'Create account & join':                 'Kreirajte nalog i pridružite se',
  'Join workspace':                        'Pridruži se radnom prostoru',
  'Join':                                  'Pridruži se',
  'Team member limit reached for your plan. Upgrade to add more members.':
    'Dostignut limit članova tima za vaš plan. Nadogradite da dodate više članova.',
  'Wrong account':                         'Pogrešan nalog',
  "You're signed in as":                   'Prijavljeni ste kao',
  'but this invite is for':                'ali je ova pozivnica za',
  'Sign out and continue':                 'Odjavi se i nastavi',
  "We've sent a confirmation link to":     'Poslali smo link za potvrdu na',
  'Click the link to verify your address and complete joining the workspace.':
    'Kliknite na link da potvrdite adresu i završite pridruživanje radnom prostoru.',

  // Password reset
  'Forgot password?':                      'Zaboravili ste lozinku?',
  'Reset your password':                   'Resetujte lozinku',
  'Send reset link':                       'Pošalji link za resetovanje',
  'We sent a password reset link to':      'Poslali smo link za resetovanje lozinke na',
  'Checking reset link':                   'Proveravam link za resetovanje',
  'Please wait while we verify your reset link.': 'Molimo sačekajte dok proveravamo vaš link za resetovanje.',
  'Set new password':                      'Postavite novu lozinku',
  'Set a password to create your account.': 'Postavite lozinku da kreirate nalog.',
  'New password':                          'Nova lozinka',
  'Update password':                       'Ažuriraj lozinku',
  'Choose a strong password for your account.': 'Izaberite jaku lozinku za vaš nalog.',

  // Billing / plan
  'Billing':                               'Naplata',
  'To change your plan, reach out to sales.': 'Za promenu plana, kontaktirajte prodaju.',
  "and we'll set you up.":                 'i mi ćemo vam pomoći.',
  'Paid until':                            'Plaćeno do',
  'Renews on':                             'Obnavlja se',
  'Cancels on':                            'Otkazuje se',
  'expired':                               'isteklo',
  'Billing Address':                       'Adresa za naplatu',
  'Delivery Address':                      'Adresa za dostavu',
  'Leave blank if same as billing':        'Ostavite prazno ako je ista kao adresa za naplatu',
  'Current plan':                          'Trenutni plan',
  'Subscription status':                   'Status pretplate',
  'No active subscription — on free plan.': 'Nema aktivne pretplate — koristite besplatni plan.',
  'Manage subscription & invoices':        'Upravljajte pretplatom i fakturama',
  'Payment Terms':                         'Uslovi plaćanja',
  'Payment failed. Service continues until': 'Plaćanje nije uspelo. Usluga nastavlja do',
  'Update your payment method to avoid downgrade.': 'Ažurirajte način plaćanja da biste izbegli degradaciju plana.',
  'Annual':                                'Godišnje',
  'Monthly':                               'Mesečno',
  'Upgrade':                               'Nadogradite',
  'Upgrade plan':                          'Nadogradite plan',
  'Upgrade plan →':                        'Nadogradite plan →',
  'Upgrade your plan to add more products': 'Nadogradite plan za dodavanje više proizvoda',
  'Plan limit reached':                    'Dostignut limit plana',
  'Get started':                           'Počnite',
  'Start':                                 'Početak',
  'Failed to open billing portal':         'Otvaranje portala za naplatu nije uspelo',
  'Failed to start checkout':              'Pokretanje naplate nije uspelo',
  'Your tenant details and plan usage':    'Detalji vašeg naloga i korišćenje plana',
  'Some resources are read-only because your workspace exceeds the free plan limits. Upgrade to restore full access — your data is safe.':
    'Neki resursi su samo za čitanje jer vaš radni prostor prelazi limite besplatnog plana. Nadogradite za pun pristup — vaši podaci su bezbedni.',

  // Settings – company / workspace
  'VAT Number':                            'PDV broj',
  'VAT / Tax ID':                          'PDV / poreski ID',
  'Company Reg. Number':                   'Matični broj kompanije',
  'e.g. DE123456789':                      'npr. RS123456789',
  'e.g. HRB 12345':                        'npr. MB 12345',
  'e.g. Net 30, 50% upfront':             'npr. Odloženo 30 dana, 50% avansno',
  'e.g. Custom furniture package for office renovation': 'npr. Prilagođeni nameštaj za renovaciju kancelarije',
  'Danger Zone':                           'Opasna zona',
  'Delete workspace':                      'Obriši radni prostor',
  'Permanently delete your workspace and all its data.': 'Trajno obrišite vaš radni prostor i sve podatke.',
  'Failed to delete workspace':            'Brisanje radnog prostora nije uspelo',
  'to confirm deletion.':                  'za potvrdu brisanja.',
  'URL must start with https://':          'URL mora početi sa https://',
  'Required':                              'Obavezno',
  'General':                               'Opšte',

  // Loading / feedback
  'Loading inquiry…':                      'Učitavam upit…',
  'Failed to load inquiry':                'Učitavanje upita nije uspelo',
  'Failed to load product data':           'Učitavanje podataka o proizvodu nije uspelo',
  'Failed to clone template':              'Kloniranje predloška nije uspelo',
  'Failed to rename class':                'Preimenovanje klase nije uspelo',
  'Close':                                 'Zatvori',
  'Dismiss':                               'Odbaci',
  'Disabled':                              'Onemogućeno',
  'Preview':                               'Pregled',
  'PDF Preview':                           'Pregled PDF-a',
  'Send to customer':                      'Pošalji kupcu',
  'Resend to customer':                    'Ponovo pošalji kupcu',
  'Quotation sent':                        'Ponuda je poslata',
  'No customer email on this quotation':   'Nema email adrese kupca na ovoj ponudi',
  'Confirm the quotation first':           'Prvo potvrdite ponudu',
  'Failed to send':                        'Slanje nije uspelo',
  'To':                                    'Za',
  'Template':                              'Šablon',
  'Sections':                              'Sekcije',
  'Modern':                                'Moderni',
  'Classic':                               'Klasični',
  'Compact':                               'Kompaktni',
  'Bold':                                  'Naglašeni',
  'Minimal light palette. Hierarchy from typography and thin rules.':
    'Minimalna svetla paleta. Hijerarhija pomoću tipografije i tankih linija.',
  'Traditional invoice look. Navy accents, filled table header, navy total bar.':
    'Tradicionalni izgled fakture. Tamno plavi akcenti, ispunjeno zaglavlje tabele, plava traka ukupnog iznosa.',
  'Same content as Modern, tighter margins and smaller type. Fits short quotes on one page.':
    'Isti sadržaj kao Moderni, uže margine i manji font. Za kratke ponude koje staju na jednu stranu.',
  'Editorial style. Left accent stripe, coral section labels, accent total band.':
    'Uredni stil. Naglasna traka s leve strane, koralni naslovi sekcija, naglašena traka ukupnog iznosa.',
  'View products':                         'Pogledaj proizvode',
  'Receive your first inquiry':            'Primite vaš prvi upit',
  'A customer fills out your configurator and submits a quote request.':
    'Kupac popunjava vaš konfigurator i šalje zahtev za ponudu.',
  'Coming soon. This feature is under development.': 'Uskoro. Ova funkcija je u razvoju.',
  'No characteristic values found for this product. Add characteristics with values in the Characteristics tab first.':
    'Nema vrednosti karakteristika za ovaj proizvod. Prvo dodajte karakteristike sa vrednostima u kartici Karakteristike.',
  'Click to rename':                       'Kliknite za preimenovanje',
  'Characteristic':                        'Karakteristika',
  'id':                                    'id',

  // Remaining
  'Name (default)':                        'Naziv (podrazumevano)',
  'Drag to reorder. Toggle eye to show / hide.': 'Prevucite za promenu redosleda. Kliknite na oko za prikaz/skrivanje.',
  'Secret (shown once — copy now)':   'Tajni ključ (prikazan jednom — kopirajte sada)',
  'Secret copied':                         'Tajni ključ kopiran',
  'From':                                  'Od',
  'Select characteristic…':           'Izaberite karakteristiku…',
  'Select value…':                    'Izaberite vrednost…',

  // ── Pricing Center ──────────────────────────────────────────────────────────
  'Pricing':                               'Cenovnik',
  'Manage scheduled prices, tax rates, and preset adjustments.': 'Upravljajte zakazanim cenama, poreskim stopama i prilagođenjima.',
  'Set scheduled prices, modifier overrides, tax rates, and preset adjustments per product.': 'Podesite zakazane cene, izmene modifikatora, poreske stope i prilagođenja po proizvodu.',
  'Create a product first before managing pricing schedules.': 'Prvo kreirajte proizvod pre upravljanja rasporedima cena.',
  'Base Prices':                           'Osnovne cene',
  'Char. Modifiers':                       'Modifikatori karakteristika',
  'Tax Rates':                             'Poreske stope',
  'Preset Adjustments':                    'Unapred podešena prilagođenja',
  'Add schedule':                          'Dodaj raspored',
  'Catalogue base price:':                 'Kataloška osnovna cena:',
  'No schedules yet.':                     'Još nema rasporeda.',
  'Price':                                 'Cena',
  'Valid from':                            'Važi od',
  'Valid to':                              'Važi do',
  'Edit price schedule':                   'Uredi raspored cena',
  'New price schedule':                    'Novi raspored cena',
  'Note (optional)':                       'Napomena (opcionalno)',
  'e.g. Summer promo':                     'npr. Letnja akcija',
  'Delete schedule':                       'Obriši raspored',
  'Remove this price schedule?':           'Ukloniti ovaj raspored cena?',
  'Invalid price':                         'Nevažeća cena',
  'Valid from is required':                'Polje "Važi od" je obavezno',
  'Deleted':                               'Obrisano',
  'Error':                                 'Greška',
  'No modifier schedules yet.':            'Još nema rasporeda modifikatora.',
  'Modifier':                              'Modifikator',
  'Edit modifier schedule':                'Uredi raspored modifikatora',
  'New modifier schedule':                 'Novi raspored modifikatora',
  'Price modifier (can be negative)':      'Modifikator cene (može biti negativan)',
  'e.g. Q3 promo':                         'npr. Q3 akcija',
  'Remove this modifier schedule?':        'Ukloniti ovaj raspored modifikatora?',
  'Invalid modifier':                      'Nevažeći modifikator',
  'Select a characteristic value':         'Izaberite vrednost karakteristike',
  'select':                                'izaberite',
  'Add tax rate':                          'Dodaj poresku stopu',
  'No tax rates yet.':                     'Još nema poreskih stopa.',
  'Rate':                                  'Stopa',
  'Edit tax rate':                         'Uredi poresku stopu',
  'New tax rate':                          'Nova poreska stopa',
  'Rate (%)':                              'Stopa (%)',
  'Delete tax rate':                       'Obriši poresku stopu',
  'Remove this tax rate preset?':          'Ukloniti ovu poresku stopu?',
  'Rate must be > 0':                      'Stopa mora biti > 0',
  'No preset adjustments yet.':            'Još nema unapred podešenih prilagođenja.',
  'Amount':                                'Iznos',
  'Edit adjustment':                       'Uredi prilagođenje',
  'New preset adjustment':                 'Novo unapred podešeno prilagođenje',
  'Mode':                                  'Način',
  'Value':                                 'Vrednost',
  'Percent (%)':                           'Procenat (%)',
  'Fixed amount':                          'Fiksni iznos',
  'Delete adjustment':                     'Obriši prilagođenje',
  'Remove this preset adjustment?':        'Ukloniti ovo prilagođenje?',
  'Value must be > 0':                     'Vrednost mora biti > 0',
  'e.g. Bulk discount':                    'npr. Grupni popust',

  // Post-inquiry message
  'Post-inquiry message':                  'Poruka nakon upita',
  'Quotation messages':                    'Poruke ponude',
  'Custom email intro and after-response messages, per language. Leave blank to use the default copy. The customer sees these in the language the quotation was generated in.':
    'Prilagođeni uvod e-maila i poruke nakon odgovora, po jeziku. Ostavite prazno za podrazumevani tekst. Kupac vidi tekst na jeziku na kom je ponuda generisana.',
  'Email intro':                           'Uvod e-maila',
  'Inserted into the quotation email body, after the greeting.':
    'Umeće se u telo e-maila ponude, nakon pozdrava.',
  'After accept':                          'Nakon prihvatanja',
  'Shown on the public quotation page once the customer accepts.':
    'Prikazuje se na javnoj stranici ponude kada kupac prihvati.',
  'After reject':                          'Nakon odbijanja',
  'Shown on the public quotation page once the customer rejects.':
    'Prikazuje se na javnoj stranici ponude kada kupac odbije.',
  'Quotation messages saved':              'Poruke ponude su sačuvane',
  'Shown to the customer in the widget after they submit an inquiry.':
    'Prikazuje se korisniku u widgetu nakon slanja upita.',
  'Post-inquiry message saved':            'Poruka nakon upita sačuvana',

  // Quotation deletion
  'Delete quotation':                      'Obriši ponudu',
  'Delete quotation?':                     'Obrisati ponudu?',
  'This quotation will be permanently deleted. This cannot be undone.':
    'Ova ponuda će biti trajno obrisana. Ova radnja se ne može poništiti.',
  'Failed to delete quotation':            'Brisanje ponude nije uspelo',

  // CharacteristicValuesEditor
  'Failed to update translation':          'Ažuriranje prevoda nije uspelo',
  'Language…':                             'Jezik…',
  '+ language':                            '+ jezik',
  '— editing':                             '— uređivanje',
  'labels':                                'oznaka',

  // Relative timestamps
  'm ago':                                 'min pre',
  'h ago':                                 'h pre',
  'd ago':                                 'd pre',

  // Analytics
  'quotes':                                'ponuda',

  // Library / i18n editor
  'Add translation':                       'Dodaj prevod',

  // Text type descriptions (labels already exist above)
  'Printed under the product row in PDF line items': 'Štampa se ispod reda proizvoda u PDF stavkama',
  'Printed in line items as specs':        'Štampa se u stavkama kao specifikacija',
  'Appears as a separate section in the PDF (global or per-product)':
    'Prikazuje se kao posebna sekcija u PDF-u (globalno ili po proizvodu)',
  'Appears as terms & conditions section in the PDF':
    'Prikazuje se kao sekcija sa uslovima u PDF-u',

  // Authorizations
  'Authorizations':                        'Ovlašćenja',
  'Role Permissions':                      'Dozvole po ulozi',
  'Configure what each role can access. Admin always has full access.':
    'Podesite šta svaka uloga može da pristupa. Admin uvek ima pun pristup.',
  'Functionality':                         'Funkcionalnost',
  'Full access':                           'Pun pristup',
  'No access':                             'Bez pristupa',
  'View':                                  'Pregled',
  'Failed to save permission':             'Nije uspelo čuvanje dozvole',

  // Audit log
  'Audit log':                             'Dnevnik izmena',
  'Recent changes across products, pricing, texts, settings, and quotations. Retained for 90 days.':
    'Nedavne izmene proizvoda, cena, tekstova, podešavanja i ponuda. Čuva se 90 dana.',
  'Change history':                        'Istorija izmena',
  'Recent changes to this product. Visible to admins only.':
    'Nedavne izmene ovog proizvoda. Vidljivo samo administratorima.',
  'No history recorded yet.':              'Još nema zabeleženih izmena.',
  'No log entries match your filters.':    'Nijedan zapis ne odgovara filterima.',
  'No field changes recorded':             'Nije zabeležena izmena polja',
  'Failed to load audit log':              'Nije uspelo učitavanje dnevnika',
  'Entity type':                           'Tip entiteta',
  'Entity':                                'Entitet',
  'All entities':                          'Svi entiteti',
  'Class':                                 'Klasa',
  'Formula':                               'Formula',
  'Product text':                          'Tekst proizvoda',
  'Global text':                           'Globalni tekst',
  'When':                                  'Kada',
  'Change':                                'Izmena',
  'Fields':                                'Polja',
  'Field':                                 'Polje',
  'Before':                                'Pre',
  'After':                                 'Posle',
  'Unknown':                               'Nepoznato',
  'Unknown user':                          'Nepoznat korisnik',
  'Clear filters':                         'Obriši filtere',
  'History':                               'Istorija',
  'Page':                                  'Strana',
  'Previous':                              'Prethodno',
  'Company registration number':           'Matični broj',

  // ── User manual ────────────────────────────────────────────────────────
  'User manual':                           'Uputstvo za korisnike',
  'How to set up products, handle inquiries, send quotations, and embed the widget.':
    'Kako da podesite proizvode, obrađujete upite, šaljete ponude i ugradite vidžet na sajt.',
  'Getting started':                       'Prvi koraci',
  'Products & configuration':              'Proizvodi i konfiguracija',
  'Inquiries & quotations':                'Upiti i ponude',
  'Branding, email, team, plan':           'Brendiranje, email, tim, plan',
  'Embedding the widget':                  'Ugradnja vidžeta',
  'Pricing center':                        'Centar za cene',
  'Library & texts':                       'Biblioteka i tekstovi',

  // Getting started
  'Welcome to Configureout':               'Dobrodošli u Configureout',
  'This guide walks you from sign in to a published configurator embedded on your website. Plan on 10–15 minutes for the basics.':
    'Ovo uputstvo vas vodi od prijave do objavljenog konfiguratora ugrađenog na vaš sajt. Računajte na 10–15 minuta za osnove.',
  'Signing in':                            'Prijava',
  'Open the admin at your workspace URL and enter the email and password you registered with. If you forgot your password, click "Forgot password?" on the sign-in screen — we email you a reset link.':
    'Otvorite admin na URL-u vašeg radnog prostora i unesite e-mail i lozinku sa kojom ste se registrovali. Ako ste zaboravili lozinku, kliknite "Zaboravljena lozinka?" na ekranu za prijavu — poslaćemo vam link za reset.',
  'Workspace owners can invite teammates from Settings → Team. Invitees get an email with a link that auto-creates their account.':
    'Vlasnici radnog prostora mogu pozvati saradnike iz Podešavanja → Tim. Pozvani dobijaju email sa linkom koji automatski kreira njihov nalog.',
  'Dashboard tour':                        'Pregled kontrolne table',
  'After signing in, the dashboard summarises your workspace at a glance.':
    'Nakon prijave, kontrolna tabla pruža pregled vašeg radnog prostora.',
  'Dashboard — three stat cards and the recent-inquiries table':
    'Kontrolna tabla — tri kartice sa statistikom i tabela skorašnjih upita',
  'Stat cards — click any to drill in':    'Kartice — kliknite na bilo koju za detalje',
  'Click a row to open the inquiry':       'Kliknite na red da otvorite upit',
  'Each stat card is a shortcut: click "Published products" to jump to the Products page, "New inquiries" to filter inquiries to unread, and so on.':
    'Svaka kartica je prečica: kliknite "Objavljeni proizvodi" da odete na stranicu Proizvodi, "Novi upiti" da filtrirate nepročitane, i tako dalje.',
  'First product in 5 minutes':            'Prvi proizvod za 5 minuta',
  'A minimal walkthrough — one product, one characteristic, one embed snippet.':
    'Minimalni vodič — jedan proizvod, jedna karakteristika, jedan snippet za ugradnju.',
  'Open Products and click "New product"': 'Otvorite Proizvodi i kliknite "Novi proizvod"',
  'From the sidebar choose Products, then the green "New product" button in the top-right of the list.':
    'Iz bočne trake odaberite Proizvodi, zatim zeleno dugme "Novi proizvod" gore desno u listi.',
  'Fill in the Details tab':               'Popunite karticu Detalji',
  'Name, base price, currency. The SKU is optional. Status stays as Draft until you publish.':
    'Naziv, osnovna cena, valuta. SKU je opciono. Status ostaje "Skica" dok ne objavite.',
  'Add one Characteristic with two values': 'Dodajte jednu Karakteristiku sa dve vrednosti',
  'Switch to the Characteristics tab. Add a characteristic (e.g. "Color"), then add two values (e.g. "Black" +€0, "White" +€20). Customers will pick from these in the widget.':
    'Otvorite karticu Karakteristike. Dodajte karakteristiku (npr. "Boja"), zatim dodajte dve vrednosti (npr. "Crna" +€0, "Bela" +€20). Kupci će birati iz ovih opcija u vidžetu.',
  'Click Publish in the top-right of the product editor. The status flips to Published and the product becomes embeddable.':
    'Kliknite Objavi gore desno u editoru proizvoda. Status se menja na "Objavljeno" i proizvod postaje spreman za ugradnju.',
  'Grab the embed snippet':                'Preuzmite snippet za ugradnju',
  'Open the Embed tab on the same product. Copy the Script tag snippet and paste it into any HTML page on your website — the widget will mount automatically where the snippet sits.':
    'Otvorite karticu Ugradnja na istom proizvodu. Kopirajte Script tag snippet i nalepite ga na bilo koju HTML stranicu vašeg sajta — vidžet će se automatski prikazati tu gde stoji snippet.',
  'Open Products':                         'Otvori Proizvode',
  'Full embed reference':                  'Kompletno uputstvo za ugradnju',
  "What's next":                           'Šta dalje',
  'Once the widget is live, customer inquiries land in the Inquiries tab. See the Inquiries & quotations chapter to learn the reply workflow.':
    'Kada je vidžet aktivan, upiti kupaca stižu u karticu Upiti. Pogledajte poglavlje Upiti i ponude da naučite tok odgovora.',
  'For a custom From-address on quotation emails, see Settings → Email. For team invites, see Settings → Team.':
    'Za prilagođenu Od-adresu na e-mailovima ponuda, vidite Podešavanja → Email. Za pozive u tim, vidite Podešavanja → Tim.',

  // Products & configuration
  'Each product has nine tabs in the editor. Work through them roughly in order — Details first, then Characteristics, then everything else as needed.':
    'Svaki proizvod ima devet kartica u editoru. Prođite kroz njih redom — najpre Detalji, pa Karakteristike, pa sve ostalo po potrebi.',
  'The nine tabs':                         'Devet kartica',
  'Product editor — tabs across the top, Publish button on the right':
    'Editor proizvoda — kartice na vrhu, dugme Objavi sa desne strane',
  'Publish here':                          'Objavi ovde',
  'Tabs in suggested order':               'Kartice po preporučenom redosledu',
  'Name, description, base price, currency and SKU. The Status field controls visibility: Draft is editor-only, Published is live and embeddable, Archived hides the product without deleting data.':
    'Naziv, opis, osnovna cena, valuta i SKU. Polje Status kontroliše vidljivost: Skica je samo u editoru, Objavljeno je uživo i može se ugraditi, Arhivirano sakriva proizvod bez brisanja podataka.',
  'The options customers pick from. Four types: text (free input), single-select (one of N values), numeric (a number with optional min/max), and boolean (a single checkbox). Each value can carry a price modifier — flat amount or percent — applied to the running total.':
    'Opcije koje kupci biraju. Četiri tipa: tekst (slobodan unos), izbor jedne vrednosti, broj (sa opcionim min/max), i logički (jedan čekboks). Svaka vrednost može imati modifikator cene — fiksni iznos ili procenat — koji se primenjuje na ukupnu cenu.',
  'If/then logic. Conditions look at characteristic selections; effects can show, hide, or lock other characteristics. Useful for dependent options (e.g. "Glass thickness" only appears when "Material = Glass"). Rules evaluate every time a customer changes a selection.':
    'Ako/onda logika. Uslovi gledaju izbore karakteristika; efekti mogu prikazati, sakriti ili zaključati druge karakteristike. Korisno za zavisne opcije (npr. "Debljina stakla" se pojavljuje samo kada je "Materijal = Staklo"). Pravila se izvršavaju svaki put kada kupac promeni izbor.',
  'Surcharges computed from characteristic values — e.g. price per m² × width × height. Build expressions from characteristic IDs, constants, and the standard math operators. Use the Pricing center for tax and discount logic at the product or quotation level.':
    'Dodaci na cenu izračunati iz vrednosti karakteristika — npr. cena po m² × širina × visina. Sastavite izraze od ID-jeva karakteristika, konstanti i standardnih matematičkih operatora. Za poreze i popuste koristite Centar za cene na nivou proizvoda ili ponude.',
  'Image assets tied to characteristic values. When a customer picks a value, the matching image layers into the widget preview. For 3D models, mesh rules map characteristic values to visible meshes inside a single GLB file.':
    'Slike vezane za vrednosti karakteristika. Kada kupac izabere vrednost, odgovarajuća slika se prikazuje u pregledu vidžeta. Za 3D modele, mesh pravila mapiraju vrednosti karakteristika na vidljive mesheve unutar jednog GLB fajla.',
  'The fields shown in the inquiry form after the customer clicks "Request a quote". Toggle which fields appear (name, email, phone, company, message) and which are required.':
    'Polja koja se prikazuju u formi za upit nakon što kupac klikne "Zatraži ponudu". Uključite ili isključite koja polja se pojavljuju (ime, email, telefon, firma, poruka) i koja su obavezna.',
  'The snippet to paste on your site, plus a theme picker (Cloud, Forest, Slate, Sand, etc.) that changes the widget\'s visual style. Theme is stored per product so different products on the same site can look different.':
    'Snippet za lepljenje na vaš sajt, plus birač teme (Cloud, Forest, Slate, Sand, itd.) koji menja vizualni stil vidžeta. Tema se čuva po proizvodu tako da različiti proizvodi na istom sajtu mogu izgledati drugačije.',
  'Shortcut to Central Texts, pre-filtered to this product. Edit customer-facing strings (characteristic names, value labels, descriptions) in English and Serbian here.':
    'Prečica do Centralnih tekstova, već filtriranih za ovaj proizvod. Ovde uređujete tekstove koje vide kupci (nazivi karakteristika, labele vrednosti, opisi) na engleskom i srpskom.',
  'Audit log of every save and delete on this product, with a before/after diff. Admin-only.':
    'Dnevnik svih izmena i brisanja na ovom proizvodu, sa pregledom pre/posle. Dostupno samo administratorima.',
  'Library (reusable characteristic classes)': 'Biblioteka (klase karakteristika za višekratnu upotrebu)',

  // Inquiries & quotations
  'What happens when a customer asks for a quote, and how to send one back as a PDF or email.':
    'Šta se dešava kada kupac zatraži ponudu, i kako poslati ponudu kao PDF ili email.',
  'How an inquiry arrives':                'Kako stiže upit',
  'Customer fills the widget':             'Kupac popunjava vidžet',
  'Inquiry POSTed to your workspace':      'Upit se šalje u vaš radni prostor',
  'Notification email (optional)':         'Email obaveštenje (opciono)',
  'Appears in Inquiries with a red "new" dot': 'Pojavljuje se u Upitima sa crvenom "novo" tačkom',
  'Set the notification email in Settings → Branding. Without it, you still see inquiries in the admin — you just don\'t get a heads-up.':
    'Postavite email za obaveštenja u Podešavanja → Brendiranje. Bez njega i dalje vidite upite u adminu — samo nećete dobiti najavu.',
  'Status workflow':                       'Tok statusa',
  'Important:':                            'Važno:',
  'Changing status via the dropdown does NOT send an email. To actually reply to the customer, use the "Reply by email" button on the inquiry detail page — that opens your mail client (or, if you\'ve created a quotation, lets you send the PDF directly).':
    'Promena statusa preko padajućeg menija NE šalje email. Da biste zaista odgovorili kupcu, koristite dugme "Odgovori e-mailom" na strani sa detaljima upita — to otvara vaš mail klijent (ili, ako ste kreirali ponudu, omogućava direktno slanje PDF-a).',
  'Creating a quotation from an inquiry':  'Kreiranje ponude iz upita',
  'Open the inquiry from the Inquiries list.': 'Otvorite upit iz liste Upita.',
  'Click "Create quotation". A draft quotation opens with line items pre-filled from the inquiry\'s configuration (product, quantity, selected options, computed price).':
    'Kliknite "Kreiraj ponudu". Otvara se skica ponude sa stavkama unapred popunjenim iz konfiguracije upita (proizvod, količina, izabrane opcije, izračunata cena).',
  'Edit the line items, add discount / tax adjustments at line or quotation level, and write any notes or terms.':
    'Uredite stavke, dodajte popust / porez na nivou stavke ili ponude, i upišite napomene ili uslove.',
  'Quotation lifecycle':                   'Životni ciklus ponude',
  'Draft':                                 'Skica',
  'Confirmed':                             'Potvrđeno',
  'Locked':                                'Zaključano',
  'Locked quotations are read-only — that\'s by design, so the version the customer received can never change retroactively. To revise a locked quotation, use Duplicate to make a new draft copy.':
    'Zaključane ponude su samo za čitanje — to je namerno, kako se verzija koju je kupac dobio ne bi mogla naknadno menjati. Da biste izmenili zaključanu ponudu, koristite Dupliraj za novu skicu.',
  'PDF preview dialog':                    'Dijalog za pregled PDF-a',
  'Click "Preview PDF" on a quotation to fine-tune the layout before generating the final file.':
    'Kliknite "Pregled PDF-a" na ponudi da finije podesite raspored pre generisanja finalnog fajla.',
  'Left: section controls (drag to reorder, eye-icon to toggle). Right: live A4 preview of the actual quotation data.':
    'Levo: kontrole sekcija (prevucite da promenite redosled, ikona oka da uključite/isključite). Desno: pregled A4 stranice sa stvarnim podacima ponude.',
  'Header':                                'Zaglavlje',
  'Bill-to':                               'Naplata',
  'Line items':                            'Stavke',
  'Drag to reorder':                       'Prevucite da promenite redosled',
  'Toggle visibility':                     'Uključi/isključi vidljivost',
  'Language switch':                       'Promena jezika',
  'The right panel shows what the PDF will actually look like with your data. Toggle a section\'s eye icon to include or omit it without losing the content.':
    'Desni panel pokazuje kako će PDF zaista izgledati sa vašim podacima. Uključite ili isključite sekciju ikonom oka bez gubljenja sadržaja.',
  'Sending the quotation email':           'Slanje email-a sa ponudom',
  'Click "Send to customer" on a confirmed quotation. We send the PDF and an HTML email with the intro text from Settings → Branding.':
    'Kliknite "Pošalji kupcu" na potvrđenoj ponudi. Šaljemo PDF i HTML email sa uvodnim tekstom iz Podešavanja → Brendiranje.',
  'The From address depends on your plan: on Scale with a verified domain you send from your own address; on lower plans the email goes from the platform default (replies still come to your notification email).':
    'Od-adresa zavisi od vašeg plana: na Scale planu sa verifikovanim domenom šaljete sa svoje adrese; na nižim planovima email ide sa platformskog default-a (odgovori i dalje stižu na vašu adresu za obaveštenja).',
  'Open Inquiries':                        'Otvori Upite',
  'Open Quotations':                       'Otvori Ponude',

  // Settings
  'Branding, email, team & plan':          'Brendiranje, email, tim i plan',
  'Everything under the Settings tab — the controls that change how your workspace looks to customers and who can access it.':
    'Sve pod karticom Podešavanja — kontrole koje menjaju kako vaš radni prostor izgleda kupcima i ko mu može pristupiti.',
  'PNG or JPG up to 2 MB. Appears on PDFs and on the public preview page. Square or wide is fine; we don\'t crop.':
    'PNG ili JPG do 2 MB. Pojavljuje se na PDF-ovima i na javnoj stranici za pregled. Kvadrat ili širok format — ne sečemo.',
  'PDF footer':                            'PDF futer',
  'Replaces the "Configureout" attribution at the bottom of every quotation PDF.':
    'Menja "Configureout" potpis u dnu svakog PDF-a sa ponudom.',
  'Scale plan':                            'Scale plan',
  'Widget footer':                         'Futer vidžeta',
  'Toggle the "Powered by Configureout" footer in your embedded widget. Available on Growth and Scale; locked on Free and Starter.':
    'Uključite ili isključite "Powered by Configureout" futer u ugrađenom vidžetu. Dostupno na Growth i Scale; zaključano na Free i Starter.',
  'Where we send a heads-up when a new inquiry arrives. Defaults to your account email.':
    'Adresa na koju šaljemo najavu kada stigne novi upit. Podrazumevano je email vašeg naloga.',
  'Send quotation emails from your own domain (e.g. quotes@yourcompany.com) instead of the platform default.':
    'Šaljite email-ove sa ponudama sa svog domena (npr. ponude@vasakompanija.com) umesto sa platformske podrazumevane adrese.',
  'Three steps:':                          'Tri koraka:',
  'Register your domain in Settings → Email from-address.':
    'Registrujte svoj domen u Podešavanja → Email Od-adresa.',
  'Copy the DNS records we show and add them at your domain registrar.':
    'Kopirajte DNS zapise koje vam prikazujemo i dodajte ih kod vašeg registrara domena.',
  'Click "Re-check verification" periodically until the banner turns green.':
    'Kliknite "Ponovo proveri verifikaciju" povremeno dok banner ne postane zelen.',
  'Three verification states — green when DNS records are detected and validated, amber while propagation is in flight, red if records are missing or wrong.':
    'Tri stanja verifikacije — zeleno kada su DNS zapisi detektovani i potvrđeni, žuto dok propagacija traje, crveno ako zapisi nedostaju ili su pogrešni.',
  'Propagation usually finishes within an hour, but some registrars cache for up to 48 hours. The amber state is normal — don\'t panic if it sits there.':
    'Propagacija obično završi u roku od sat vremena, ali neki registrari keširaju do 48 sati. Žuto stanje je normalno — nemojte paničiti ako stoji.',
  'Invite teammates by email and choose their role. They get an email with a link that auto-creates their account inside your workspace.':
    'Pozovite saradnike e-mailom i odaberite njihovu ulogu. Dobijaju email sa linkom koji automatski kreira njihov nalog u vašem radnom prostoru.',
  'Full access including team, plan, audit log, danger zone.':
    'Puni pristup uključujući tim, plan, dnevnik izmena i opasnu zonu.',
  'Edit products, inquiries, quotations. Cannot manage team or plan.':
    'Uređivanje proizvoda, upita, ponuda. Ne može da upravlja timom ili planom.',
  'Read-only access. Cannot save changes.': 'Pristup samo za čitanje. Ne može da sačuva izmene.',
  'Fine-tune each role\'s access per feature in Settings → Authorizations (admin-only).':
    'Detaljno podesite pristup svake uloge po funkcionalnosti u Podešavanja → Autorizacije (samo administrator).',
  'See your current usage against plan limits and upgrade or downgrade via Stripe Checkout.':
    'Pogledajte trenutnu potrošnju u odnosu na limite plana i pređite na viši ili niži plan preko Stripe Checkout-a.',
  'Usage bars show how close you are to each plan limit.':
    'Trake potrošnje pokazuju koliko ste blizu svakog limita plana.',
  'At limit — upgrade to add more':        'Na limitu — pređite na viši plan za više',
  'On downgrade, no data is deleted. Over-limit resources become read-only (e.g. excess products keep showing in the list but customers can\'t configure them); restore full access by upgrading again.':
    'Pri prelasku na niži plan, podaci se ne brišu. Resursi iznad limita postaju samo za čitanje (npr. višak proizvoda i dalje se prikazuje u listi ali ih kupci ne mogu konfigurisati); puni pristup se vraća kada ponovo pređete na viši plan.',
  'Open Settings':                         'Otvori Podešavanja',

  // Embed chapter
  'Three integration methods, all served from one widget bundle. Pick the one that fits your site.':
    'Tri metoda integracije, svi iz jednog widget bundle-a. Odaberite onaj koji vam odgovara.',
  'The three methods':                     'Tri metoda',
  'Where to find the snippet':             'Gde se nalazi snippet',
  'Open any published product, click the Embed tab. The snippet is ready to copy. Pick a theme to change the widget\'s visual style — the choice is saved per product, so different products on the same site can look different.':
    'Otvorite bilo koji objavljen proizvod, kliknite karticu Ugradnja. Snippet je spreman za kopiranje. Odaberite temu da promenite vizualni stil vidžeta — izbor se čuva po proizvodu, tako da različiti proizvodi na istom sajtu mogu izgledati drugačije.',
  'Embed tab on a product — copy the script, paste it into your HTML.':
    'Kartica Ugradnja na proizvodu — kopirajte skriptu, nalepite je u svoj HTML.',
  'Copy & paste':                          'Kopiraj i nalepi',
  'The Embed tab on the product is the simplest path. For the full reference (Web Component + iFrame snippets, comparison table, copy buttons), open the Embed page from the sidebar.':
    'Kartica Ugradnja na proizvodu je najjednostavniji put. Za kompletno uputstvo (Web Component + iFrame snippet-i, tabela poređenja, dugmad za kopiranje), otvorite stranicu Ugradnja iz bočne trake.',

  // Stubs
  'Edit base-price schedules, characteristic modifiers, tax presets and quotation-level adjustments in one place. Schedules carry valid_from / valid_to dates so you can prepare a price change in advance and have it activate on the right day.':
    'Uređujte rasporede osnovnih cena, modifikatore karakteristika, poreske presete i prilagođavanja na nivou ponude na jednom mestu. Rasporedi imaju datume važi_od / važi_do tako da možete unapred pripremiti promenu cene i aktivirati je na pravi dan.',
  'Open Pricing center':                   'Otvori Centar za cene',
  'The Library page groups reusable characteristics into classes so you can reuse the same options across products. The Texts page is the central editor for every customer-facing string in English and Serbian — characteristic names, value labels, descriptions, post-inquiry messages.':
    'Stranica Biblioteka grupiše karakteristike koje se mogu ponovo koristiti u klase, tako da iste opcije možete koristiti na više proizvoda. Stranica Tekstovi je centralni editor za sve tekstove koje vide kupci, na engleskom i srpskom — nazivi karakteristika, labele vrednosti, opisi, poruke nakon upita.',
  'Open Library':                          'Otvori Biblioteku',
  'Open Texts':                            'Otvori Tekstove',
  'Per-product views, inquiries and conversion rate, plus revenue over time. The characteristic-value breakdown shows which options customers actually pick, and the inquiry-to-quotation funnel helps you spot leaks in the workflow.':
    'Po-proizvodu pregledi, upiti i stopa konverzije, plus prihod tokom vremena. Razlaganje po vrednostima karakteristika pokazuje koje opcije kupci zaista biraju, a levak upit-do-ponude pomaže da uočite mesta gde se gubi prilika.',
  'Open Analytics':                        'Otvori Analitiku',
  'Admin-only. Every save and delete across products, quotations, characteristics, formulas and settings is logged with a before/after diff. Filter by entity type and date range. Use it to investigate who changed what.':
    'Samo za administratore. Svako čuvanje i brisanje proizvoda, ponuda, karakteristika, formula i podešavanja se beleži sa razlikom pre/posle. Filtrirajte po tipu entiteta i opsegu datuma. Koristite ga da istražite ko je šta menjao.',
  'Open Audit log':                        'Otvori Dnevnik izmena',
  'A detailed walkthrough for this chapter is on the way. For now, the page itself is mostly self-explanatory once you\'re there.':
    'Detaljan vodič za ovo poglavlje stiže uskoro. Za sada, sama stranica je uglavnom samoobjašnjavajuća kada je otvorite.',

  // ── User manual: Rules sub-chapter ─────────────────────────────────────
  'What it does:':                         'Šta radi:',
  'When it fires:':                        'Kada se aktivira:',
  'Deep dive below — editor anatomy, the six effect kinds, and three worked examples.':
    'Detaljan prikaz ispod — anatomija editora, šest tipova efekata i tri primera iz prakse.',
  'Deep dive below — editor anatomy, the available nodes and operators, and three worked examples.':
    'Detaljan prikaz ispod — anatomija editora, dostupni čvorovi i operatori, i tri primera iz prakse.',
  'Anatomy of a rule':                     'Anatomija pravila',
  'Every rule is a pair: an IF block (the condition) and a THEN block (one or more effects).':
    'Svako pravilo je par: IF blok (uslov) i THEN blok (jedan ili više efekata).',
  'Rules editor — IF / THEN structure with a mode toggle, predicate rows, and effect rows.':
    'Editor pravila — IF / THEN struktura sa biračem moda, redovima predikata i redovima efekata.',
  'ALL match (AND)':                       'SVI ispunjeni (I)',
  'ANY match (OR)':                        'BILO KOJI ispunjen (ILI)',
  'Add predicate':                         'Dodaj predikat',
  'ALL vs ANY':                            'SVI vs BILO KOJI',
  'Effect kind':                           'Tip efekta',
  'Delete row':                            'Obriši red',
  'Predicates can be Value conditions (characteristic = / ≠ value) or Numeric conditions (numeric expression compared with > ≥ < ≤ = ≠). Add more predicates and pick ALL or ANY to combine them. Add as many effects as the rule needs — they all fire when the condition is met.':
    'Predikati mogu biti uslovi po vrednosti (karakteristika = / ≠ vrednost) ili numerički uslovi (numerički izraz upoređen sa > ≥ < ≤ = ≠). Dodajte više predikata i odaberite SVI ili BILO KOJI da ih kombinujete. Dodajte koliko god efekata pravilo zahteva — svi se aktiviraju kada je uslov ispunjen.',

  'The six effect kinds':                  'Šest tipova efekata',
  'the value disappears from the widget UI as if it didn\'t exist.':
    'vrednost nestaje iz vidžeta kao da ne postoji.',
  'the value is still visible but greyed out — useful when you want the customer to see why an option is unavailable.':
    'vrednost je i dalje vidljiva ali zasivljena — korisno kada želite da kupac vidi zašto opcija nije dostupna.',
  'Set default (value)':                   'Postavi podrazumevano (vrednost)',
  'auto-selects a value the moment the condition is met. The customer can still change it.':
    'automatski bira vrednost čim je uslov ispunjen. Kupac i dalje može da je promeni.',
  'forces a value and makes it read-only. Tick "Free of charge (included)" to waive its price modifier — useful when the locked value is bundled into another option\'s premium.':
    'prinudno bira vrednost i čini je samo za čitanje. Označite "Bez naknade (uključeno)" da se odustane od modifikatora cene — korisno kada je zaključana vrednost uračunata u premiju druge opcije.',
  'Set default (number)':                  'Postavi podrazumevano (broj)',
  'sets a numeric input to the result of an expression (can reference other characteristics and constants).':
    'postavlja numeričko polje na rezultat izraza (može da koristi druge karakteristike i konstante).',
  'Lock number':                           'Zaključaj broj',
  'same as above, but the field is read-only.':
    'isto kao gore, ali polje je samo za čitanje.',

  'Example 1 — hide impossible combinations': 'Primer 1 — sakrij nemoguće kombinacije',
  'Removes the Triple glazing option from the widget entirely.':
    'U potpunosti uklanja opciju Trostruko staklo iz vidžeta.',
  'The instant the customer picks Opening = Fixed. If they switch back to a different opening, the Triple option reappears.':
    'Čim kupac izabere Otvaranje = Fiksno. Ako se vrati na drugo otvaranje, Trostruka opcija se ponovo pojavljuje.',
  'Why: fixed windows can\'t physically take triple glazing — the glazing needs a casement or tilt-turn mechanism. Hiding rather than disabling keeps the UI clean for the most common workflow.':
    'Zašto: fiksni prozori fizički ne mogu da prime trostruko staklo — staklu je potreban krilni ili tilt-turn mehanizam. Sakrivanje umesto onemogućavanja čuva UI jednostavnim za najčešći tok rada.',
  'Example 2 — lock a dependent default for free': 'Primer 2 — zaključaj zavisni podrazumevani izbor bez naknade',
  'Forces the Handle to Brass and waives its +€20 modifier. The customer sees Brass pre-selected and read-only.':
    'Prinudno postavlja Kvaku na Mesing i odustaje od modifikatora od +€20. Kupac vidi Mesing kao već izabran i samo za čitanje.',
  'Whenever Wood is the selected Material. Switching to a different material releases the lock and the handle becomes editable again.':
    'Svaki put kada je Drvo izabran Materijal. Prelazak na drugi materijal otpušta zaključavanje i kvaka ponovo postaje izmenjiva.',
  'Why: the brass handle is bundled into the wood premium — charging again would double-bill. The "Free of charge (included)" checkbox on Lock value is exactly for this case.':
    'Zašto: mesingana kvaka je uračunata u premiju za drvo — ponovna naplata bi bila duplo. Polje "Bez naknade (uključeno)" na Zaključaj vrednost je upravo za ovaj slučaj.',
  'Example 3 — numeric guard':             'Primer 3 — numerički štit',
  'Greys out the Single glazing option (still visible, not clickable).':
    'Zasivljuje opciju Jednostruko staklo (i dalje vidljiva, ne može da se klikne).',
  'Whenever the Width numeric input crosses 1200 mm. Drop it back below 1200 and Single glazing becomes selectable again.':
    'Svaki put kada numerički unos Širine pređe 1200 mm. Vratite ga ispod 1200 i Jednostruko staklo ponovo postaje izborivo.',
  'Why: single glazing isn\'t structurally sound for wide units. Disabling rather than hiding keeps the option visible so the customer understands why it\'s unavailable — better UX than silent removal.':
    'Zašto: jednostruko staklo nije strukturno dovoljno za široke jedinice. Onemogućavanje umesto sakrivanja čuva opciju vidljivom kako bi kupac razumeo zašto nije dostupna — bolji UX od tihog uklanjanja.',

  'Quick tips':                            'Brze beleške',
  'Rules re-evaluate on every selection change — no save needed in the widget.':
    'Pravila se ponovo procenjuju pri svakoj promeni izbora — nije potrebno čuvanje u vidžetu.',
  'A single rule can have multiple effects — they all fire together when the condition is met.':
    'Jedno pravilo može imati više efekata — svi se aktiviraju zajedno kada je uslov ispunjen.',
  'Numeric conditions read the current value of the numeric input, not the modifier.':
    'Numerički uslovi čitaju trenutnu vrednost numeričkog polja, ne modifikator.',
  'If a rule\'s condition is not met, none of its effects apply — there\'s no "ELSE" — write a second rule with the opposite condition if you need one.':
    'Ako uslov pravila nije ispunjen, nijedan efekat se ne primenjuje — nema "ELSE" — napišite drugo pravilo sa suprotnim uslovom ako vam treba.',
  'Rules never affect price directly. To waive a price modifier, use Lock value with "Free of charge".':
    'Pravila nikada ne utiču direktno na cenu. Da se odustane od modifikatora cene, koristite Zaključaj vrednost sa "Bez naknade".',

  // ── User manual: Formula pricing sub-chapter ──────────────────────────
  'Anatomy of a formula':                  'Anatomija formule',
  'A formula is a tree of nodes — values at the leaves, operators at the branches. Add as many formulas as you need; their results are summed into the widget\'s total price.':
    'Formula je stablo čvorova — vrednosti na listovima, operatori na granama. Dodajte koliko god formula vam treba; njihovi rezultati se sabiraju u ukupnu cenu vidžeta.',
  'Formula editor — existing formulas listed on top, the new-formula card below with a template picker and the node-type tree builder.':
    'Editor formula — postojeće formule navedene na vrhu, kartica za novu formulu ispod sa biračem šablona i graditeljem stabla čvorova.',
  'NEW':                                   'NOVO',
  'Template:':                             'Šablon:',
  'Add node':                              'Dodaj čvor',
  'Name your formula':                     'Imenujte formulu',
  'Quick-start templates':                 'Brzi šabloni',
  'Tree builder':                          'Graditelj stabla',
  'Toggle active':                         'Uključi/isključi aktivno',
  'Pick a template to scaffold a common shape, then edit the nodes to fit. Each non-leaf node has a dropdown to change its operator (× to +, > to =, etc.); each leaf has a dropdown to choose what value to read (base price, a modifier, a numeric input, a constant, another formula\'s result).':
    'Odaberite šablon da napravite uobičajeni oblik, pa uredite čvorove po potrebi. Svaki čvor koji nije list ima padajući meni za promenu operatora (× u +, > u =, itd.); svaki list ima padajući meni za izbor koju vrednost da čita (osnovna cena, modifikator, numerički unos, konstanta, rezultat druge formule).',

  'What nodes can you combine':            'Koje čvorove možete da kombinujete',
  'Values (leaves)':                       'Vrednosti (listovi)',
  'a constant like 200 or 1.21':           'konstanta poput 200 ili 1.21',
  'the product\'s base price':             'osnovna cena proizvoda',
  'the price modifier of the value selected in a given characteristic':
    'modifikator cene vrednosti izabrane u datoj karakteristici',
  'the current value of a numeric characteristic (Width, Height, Quantity)':
    'trenutna vrednost numeričke karakteristike (Širina, Visina, Količina)',
  'true/false: does the customer have a specific value selected':
    'tačno/netačno: da li kupac ima izabranu određenu vrednost',
  'the computed result of another formula on this product':
    'izračunati rezultat druge formule na ovom proizvodu',
  'Operators (branches)':                  'Operatori (grane)',
  'arithmetic':                            'aritmetika',
  'comparisons (return true/false)':       'poređenja (vraćaju tačno/netačno)',
  'combine comparisons':                   'kombinovanje poređenja',
  'pick one of two sub-expressions based on a condition':
    'bira jedan od dva pod-izraza na osnovu uslova',

  'Example 1 — sum of modifiers (the default shape)':
    'Primer 1 — zbir modifikatora (podrazumevani oblik)',
  'Every time the customer changes any of the three characteristics, the total recomputes live. If they pick a smaller size (+€0) and a different material (+€0), the total drops accordingly.':
    'Svaki put kada kupac promeni bilo koju od tri karakteristike, ukupna cena se preračunava uživo. Ako izabere manju veličinu (+€0) i drugi materijal (+€0), ukupna cena pada srazmerno.',
  'Use this whenever each option independently nudges the price. It\'s the same idea as ticking checkboxes on a buy form — modifiers add up, no math required.':
    'Koristite ovo kada svaka opcija nezavisno pomera cenu. Ista ideja kao štikliranje polja na narudžbenici — modifikatori se sabiraju, bez računice.',
  'Example 2 — size-based pricing (Base price × Width × Height)':
    'Primer 2 — cena po veličini (Osnovna cena × Širina × Visina)',
  'Multiplies the base price by two numeric characteristics — typically Width and Height in metres — giving an area-based price.':
    'Množi osnovnu cenu sa dve numeričke karakteristike — obično Širina i Visina u metrima — dajući cenu po površini.',
  'Recomputes the moment either number changes in the widget. Made width 1.5 instead of 1.2? Total jumps from €48 to €60 immediately.':
    'Preračunava se čim se bilo koji broj promeni u vidžetu. Promenili širinu na 1.5 umesto 1.2? Ukupno odmah skoči sa €48 na €60.',
  'Use for products priced by area: glass panels, banners, table tops, fabric. Pair with a second formula for fixed surcharges (cuts, edges, delivery) — both formulas sum into the total.':
    'Koristite za proizvode čija cena ide po površini: stakleni paneli, baneri, stolne ploče, tkanina. Uparite sa drugom formulom za fiksne doplate (sečenje, ivice, dostava) — obe formule se sabiraju u ukupnu cenu.',
  'Example 3 — conditional surcharge (IF / THEN / ELSE)':
    'Primer 3 — uslovna doplata (IF / THEN / ELSE)',
  'Adds a flat €200 surcharge to the base price, but only when the customer picks Steel as the material. Any other material returns the base price unchanged.':
    'Dodaje fiksnu doplatu od €200 na osnovnu cenu, ali samo kada kupac odabere Čelik kao materijal. Bilo koji drugi materijal vraća osnovnu cenu nepromenjenu.',
  'Every time the Material selection changes. Pick Steel → +€200 added. Switch to Wood → the +€200 disappears.':
    'Svaki put kada se promeni izbor Materijala. Izaberite Čelik → +€200 dodato. Pređite na Drvo → +€200 nestaje.',
  'Use IF / THEN / ELSE when one option needs special-case price logic that doesn\'t fit a simple modifier. Keep configuration logic (hide / disable / lock) in Rules and price logic in Formulas — they\'re separate systems for a reason.':
    'Koristite IF / THEN / ELSE kada jedna opcija zahteva posebnu logiku cene koja se ne uklapa u jednostavan modifikator. Logiku konfiguracije (sakrij / onemogući / zaključaj) držite u Pravilima, a logiku cena u Formulama — to su posebni sistemi sa razlogom.',

  'Active vs draft':                       'Aktivno vs skica',
  'The widget evaluates every active formula on the product and adds the results into the total. Toggling a formula to inactive keeps it in the editor but stops it from affecting the price — useful for staging price changes before going live.':
    'Vidžet izvršava svaku aktivnu formulu na proizvodu i sabira rezultate u ukupnu cenu. Prebacivanje formule na neaktivno čuva je u editoru ali sprečava da utiče na cenu — korisno za pripremu promena cena pre objavljivanja.',
  'Formulas can also reference each other via formula_result, so you can build a "subtotal" formula and reuse it inside a "tax" formula. The widget evaluates them in sort order.':
    'Formule mogu i da se međusobno pozivaju preko formula_result, tako da možete napraviti "međuzbir" formulu i ponovo je koristiti unutar "porez" formule. Vidžet ih izvršava po redosledu sortiranja.',

  'Formula vs Rule vs price modifier — when to use which':
    'Formula vs Pravilo vs modifikator cene — kada koristiti koji',
  'Price modifier on a value':             'Modifikator cene na vrednosti',
  'set in the Characteristics tab':        'podešen u kartici Karakteristike',
  'use for "this option adds +€X". Covers 80% of pricing cases with zero math.':
    'koristite za "ova opcija dodaje +€X". Pokriva 80% slučajeva sa cenom bez ikakve računice.',
  'use when the price depends on numeric inputs (m², width × height), interactions between characteristics, or conditional logic.':
    'koristite kada cena zavisi od numeričkih unosa (m², širina × visina), interakcija između karakteristika ili uslovne logike.',
  'Rule':                                  'Pravilo',
  'never about price (except Lock value + Free of charge for waiving). Use Rules for visibility, defaults, and constraints — what the customer can see and pick.':
    'nikad o ceni (osim Zaključaj vrednost + Bez naknade za odustajanje). Koristite Pravila za vidljivost, podrazumevane vrednosti i ograničenja — šta kupac vidi i može da izabere.',
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

export function pickTranslation(
  i18n: Record<string, string> | null | undefined,
  lang: string,
  fallback: string,
): string {
  return (i18n && i18n[lang]) ? i18n[lang] : fallback
}
