// Signed-in app: home, drive, trips, trip detail, profile, score text built in the data layer.
export const APP: Record<string, string> = {
  // Home
  'Loading…': 'Ielāde…',
  'Hi, {name}': 'Sveiki, {name}',
  'This week': 'Šonedēļ',
  '{n} trip': '{n} brauciens',
  '{n} trips': '{n} braucieni',
  'Driving score': 'Braukšanas vērtējums',
  'Not enough data yet.': 'Pagaidām nepietiek datu.',
  'Missing data never lowers your score.': 'Trūkstoši dati nekad nepazemina jūsu vērtējumu.',
  'Record a trip': 'Ierakstīt braucienu',
  'Low risk': 'Zems risks',
  'Moderate-low risk': 'Mēreni zems risks',
  'Moderate risk': 'Mērens risks',
  'Elevated risk': 'Paaugstināts risks',
  'With profile:': 'Ar profilu:',
  'Profile ×{p}': 'Profils ×{p}',
  'Behaviour score above; tips use behaviour only.': 'Augstāk redzams uzvedības vērtējums; padomi balstās tikai uz uzvedību.',
  '{n} vs previous week': '{n} salīdzinājumā ar iepriekšējo nedēļu',
  'High confidence': 'Augsta uzticamība',
  'Medium confidence': 'Vidēja uzticamība',
  'Low confidence: drive a bit more for a stable score': 'Zema uzticamība: braucot vēl nedaudz, vērtējums kļūs stabilāks',
  'Not enough data yet': 'Pagaidām nepietiek datu',
  'Speed limits are approximate (demo map).': 'Ātruma ierobežojumi ir aptuveni (demo karte).',
  'Take breaks': 'Veiciet pārtraukumus',
  'Your score could rise from {from} to about {to}.': 'Jūsu vērtējums varētu pieaugt no {from} līdz aptuveni {to}.',
  'Illustrative OCTA direction': 'Ilustratīvs OCTA virziens',
  'What shaped your score': 'Kas ietekmēja jūsu vērtējumu',
  'No data': 'Nav datu',
  '{score}/100 · weight {w}%': '{score}/100 · svars {w}%',
  '−{n} pts': '−{n} p.',
  'Night driving: {n}% of distance. Counts only together with a long stretch without a break.':
    'Braukšana naktī: {n}% no attāluma. Tiek ņemta vērā tikai kopā ar ilgu braucienu bez pārtraukuma.',
  'Some long night drives without a stop.': 'Daži gari nakts braucieni bez apstāšanās.',
  Trend: 'Tendence',
  'Weekly scores: {list}': 'Nedēļas vērtējumi: {list}',
  'no data': 'nav datu',
  Now: 'Tagad',
  'Weights and thresholds are illustrative, not final.': 'Svari un sliekšņi ir ilustratīvi, nav galīgi.',

  // Score text built in the data layer (KPI labels and units, tips, OCTA direction)
  Speeding: 'Ātruma pārsniegšana',
  'Harsh acceleration': 'Asa paātrināšanās',
  'Long drives without a break': 'Ilgi braucieni bez pārtraukuma',
  'Phone use while driving': 'Tālruņa lietošana braukšanas laikā',
  'Far below the limit': 'Ievērojami zem ierobežojuma',
  '% of driving time': '% no braukšanas laika',
  'per 100 km': 'uz 100 km',
  'min beyond the limit': 'min pēc robežas',
  'Speeding took {from}% of your driving time. Bringing it down to {to}% is the biggest win this week.':
    'Ātruma pārsniegšana aizņēma {from}% no jūsu braukšanas laika. Samazinot to līdz {to}%, šonedēļ ieguvums būtu vislielākais.',
  'You braked hard {from} times per 100 km. Leaving more distance ahead could bring it to about {to}.':
    'Jūs bremzējāt asi {from} reizes uz 100 km. Atstājot lielāku distanci pret priekšā braucošo, tas varētu samazināties līdz aptuveni {to}.',
  'You accelerated hard {from} times per 100 km. Smoother starts could bring it to about {to}.':
    'Jūs paātrinājāties asi {from} reizes uz 100 km. Mierīgāka startēšana to varētu samazināt līdz aptuveni {to}.',
  'You drove far below the limit for {from}% of your driving time. Keeping with the flow of traffic where it is safe could bring that to about {to}%.':
    'Jūs braucāt ievērojami zem ierobežojuma {from}% no braukšanas laika. Ja drošos apstākļos turaties pie satiksmes plūsmas, tas varētu samazināties līdz aptuveni {to}%.',
  'Phone use was {from}% of your driving time. Keeping it at about {to}% would help most. Use a mount and set the route before you start.':
    'Tālruņa lietošana bija {from}% no braukšanas laika. Ja to noturēsiet ap {to}%, tas palīdzēs visvairāk. Izmantojiet turētāju un iestatiet maršrutu pirms sākat braukt.',
  'Your longest drive ran {from} minutes past 4 hours without a stop. Taking a break every 4 hours could bring that to about {to}.':
    'Jūsu garākais brauciens ilga {from} minūtes pēc 4 stundām bez apstāšanās. Ja pārtraukumu veicat ik pēc 4 stundām, tas varētu samazināties līdz aptuveni {to}.',
  'Drive at least 30 km this week to get a score. Missing data never lowers your score.':
    'Nobrauciet vismaz 30 km šonedēļ, lai saņemtu vērtējumu. Trūkstoši dati nekad nepazemina jūsu vērtējumu.',
  'Some night drives ran over 4 hours without a stop. Plan a short break before the 4-hour mark.':
    'Daži nakts braucieni ilga vairāk nekā 4 stundas bez apstāšanās. Plānojiet īsu pārtraukumu pirms 4 stundu robežas.',
  'Not enough data for an estimate': 'Novērtējumam nepietiek datu',
  'Potential discount': 'Iespējama atlaide',
  'No change expected': 'Izmaiņas nav gaidāmas',
  'Possible surcharge': 'Iespējams uzcenojums',
  'Hackathon simulation. Not a Balcia tariff, quote or offer; no real price is calculated.':
    'Hakatona simulācija. Nav Balcia tarifs, cenas aprēķins vai piedāvājums; reāla cena netiek aprēķināta.',
}
