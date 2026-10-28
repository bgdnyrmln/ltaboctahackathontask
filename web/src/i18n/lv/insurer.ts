// Insurer portal: login, layout, portfolio, driver record, data and consent, driver database search.
export const INSURER: Record<string, string> = {
  'Insurer portal': 'Apdrošinātāja portāls',
  'Weekly driving-score summaries of drivers who chose to share them. Demo: fictional insurer, synthetic data, no real quotes.':
    'Nedēļas braukšanas vērtējumu kopsavilkumi vadītājiem, kuri izvēlējās tos kopīgot. Demo: izdomāts apdrošinātājs, sintētiski dati, nekādu īstu piedāvājumu.',
  'Sign in as {org}': 'Pieslēgties kā {org}',
  '← Back to the site': '← Atpakaļ uz vietni',
  Insurer: 'Apdrošinātājs',
  'Driver database': 'Vadītāju datubāze',
  Portfolio: 'Portfelis',
  'Data & consent': 'Dati un piekrišana',
  'Hackathon simulation. Scores and OCTA directions are illustrative, not a tariff, quote or offer from Balcia or any other insurer.':
    'Hakatona simulācija. Vērtējumi un OCTA virzieni ir ilustratīvi, nav Balcia vai cita apdrošinātāja tarifs, cenas aprēķins vai piedāvājums.',

  'Moderate-low': 'Mēreni zems',
  Moderate: 'Mērens',
  Elevated: 'Paaugstināts',
  "This week's driving scores from drivers who share them with you. Updates live.":
    'Šīs nedēļas braukšanas vērtējumi vadītājiem, kas tos kopīgo ar jums. Atjaunojas reāllaikā.',
  'Drivers sharing': 'Vadītāji, kas kopīgo',
  'Average final score': 'Vidējais gala vērtējums',
  'Distance this week': 'Attālums šonedēļ',
  'Risk bands': 'Riska joslas',
  'Search name, personal code or plate': 'Meklēt pēc vārda, personas koda vai numura zīmes',
  'Search drivers': 'Meklēt vadītājus',
  Sort: 'Kārtot',
  'By score': 'Pēc vērtējuma',
  'By name': 'Pēc vārda',
  'Export CSV': 'Eksportēt CSV',
  Driver: 'Vadītājs',
  Vehicle: 'Transportlīdzeklis',
  'Final score': 'Gala vērtējums',
  Behaviour: 'Uzvedība',
  Band: 'Josla',
  'Trend (4 wk)': 'Tendence (4 ned.)',
  'OCTA direction': 'OCTA virziens',
  'Not enough data': 'Nepietiek datu',
  'Driver deleted their data': 'Vadītājs izdzēsa savus datus',
  'Not shared by the driver': 'Vadītājs nekopīgo',

  '← Back': '← Atpakaļ',
  'This driver does not share their driving data with you. Only name, personal code and vehicle are on record.':
    'Šis vadītājs nekopīgo braukšanas datus ar jums. Reģistrēts tikai vārds, personas kods un transportlīdzeklis.',
  'week of {date}': 'nedēļa no {date}',
  'Behaviour score': 'Uzvedības vērtējums',
  'Profile factor': 'Profila koeficients',
  'OCTA direction (illustrative)': 'OCTA virziens (ilustratīvs)',
  'Score trend': 'Vērtējuma tendence',
  'What drives the score': 'Kas veido vērtējumu',
  'Profile factors': 'Profila faktori',
  'Shared with you': 'Kopīgots ar jums',
  'Weekly scores, risk band, KPI values and totals ({km} km, {trips}).':
    'Nedēļas vērtējumi, riska josla, rādītāju vērtības un kopsummas ({km} km, {trips}).',
  'Confidence: {level}.': 'Uzticamība: {level}.',
  high: 'augsta',
  medium: 'vidēja',
  low: 'zema',
  insufficient: 'nepietiekama',
  'Not shared:': 'Nekopīgo:',
  'individual trips, routes, locations, times of day.': 'atsevišķi braucieni, maršruti, atrašanās vietas, diennakts laiki.',
  'The driver can stop sharing or delete their data at any time; it disappears here immediately.':
    'Vadītājs jebkurā laikā var pārtraukt kopīgošanu vai izdzēst savus datus; tie šeit uzreiz pazūd.',

  "How the portal works as the insurer's database of drivers and scores.": 'Kā portāls darbojas kā apdrošinātāja vadītāju un vērtējumu datubāze.',
  'What you receive': 'Ko jūs saņemat',
  'Driver identity (verified at sign-up via Smart-ID; demo uses fake Smart-ID) and vehicle plate.':
    'Vadītāja identitāte (apstiprināta reģistrējoties ar Smart-ID; demo izmanto izdomātu Smart-ID) un transportlīdzekļa numurs.',
  'Weekly behaviour score, profile factor and final score, risk band, KPI values, confidence and totals.':
    'Nedēļas uzvedības vērtējums, profila koeficients un gala vērtējums, riska josla, rādītāju vērtības, uzticamība un kopsummas.',
  'Illustrative OCTA direction (potential discount / no change / possible surcharge), never a price.':
    'Ilustratīvs OCTA virziens (iespējama atlaide / bez izmaiņām / iespējams uzcenojums), nekad cena.',
  'CSV export of shared summaries for underwriting and renewal systems.': 'Kopīgoto kopsavilkumu CSV eksports riska izvērtēšanas un atjaunošanas sistēmām.',
  'What you never receive': 'Ko jūs nekad nesaņemat',
  'Individual trips, GPS routes, locations or times.': 'Atsevišķus braucienus, GPS maršrutus, atrašanās vietas vai laikus.',
  'Data from drivers who did not opt in, or who withdrew or deleted their data.':
    'Datus no vadītājiem, kuri nav piekrituši vai ir atsaukuši piekrišanu vai izdzēsuši savus datus.',
  Architecture: 'Arhitektūra',
  'Prototype:': 'Prototips:',
  'the app and this portal share one data store in the browser, so changes show up live.':
    'lietotne un šis portāls izmanto vienu datu krātuvi pārlūkā, tāpēc izmaiņas redzamas uzreiz.',
  'Production:': 'Produkcija:',
  'phone apps upload weekly summaries (not trips) to a central EU-hosted database (e.g. Postgres). Each insurer reads only rows of drivers with an active consent for that insurer (row-level security), via this portal or an API.':
    'tālruņa lietotnes augšupielādē nedēļas kopsavilkumus (nevis braucienus) centrālā ES hostētā datubāzē (piem., Postgres). Katrs apdrošinātājs lasa tikai to vadītāju rindas, kuri devuši aktīvu piekrišanu šim apdrošinātājam (rindu līmeņa drošība), izmantojot šo portālu vai API.',
  'Consent is per insurer, logged with time and purpose, and revocable in the app.':
    'Piekrišana ir katram apdrošinātājam atsevišķa, tiek reģistrēta ar laiku un mērķi, un to var atsaukt lietotnē.',

  'Find a driver by personal code, name or vehicle plate. Driving scores appear only for drivers who share them with you.':
    'Atrodiet vadītāju pēc personas koda, vārda vai transportlīdzekļa numura. Braukšanas vērtējumi redzami tikai vadītājiem, kuri tos kopīgo ar jums.',
  'Personal code, name or plate': 'Personas kods, vārds vai numura zīme',
  'e.g. 300291-17428, Bērziņa or DEMO-101': 'piem., 300291-17428, Bērziņa vai DEMO-101',
  'Data sharing': 'Datu kopīgošana',
  'All drivers': 'Visi vadītāji',
  'Sharing with us': 'Kopīgo ar mums',
  'Not sharing': 'Nekopīgo',
  'Risk band': 'Riska josla',
  Any: 'Jebkura',
  Search: 'Meklēt',
  'Enter a personal code, name or plate and press': 'Ievadiet personas kodu, vārdu vai numura zīmi un nospiediet',
  'Leave the field empty to list everyone ({n} drivers in the database).':
    'Atstājiet lauku tukšu, lai redzētu visus ({n} vadītāji datubāzē).',
  '{n} record found': 'Atrasts {n} ieraksts',
  '{n} records found': 'Atrasti {n} ieraksti',
  'No driver matches. Check the personal code or try a name or plate.':
    'Neviens vadītājs neatbilst. Pārbaudiet personas kodu vai mēģiniet ar vārdu vai numura zīmi.',
  Sharing: 'Kopīgo',
  'Data deleted': 'Dati izdzēsti',
  'Open record': 'Atvērt ierakstu',
}
