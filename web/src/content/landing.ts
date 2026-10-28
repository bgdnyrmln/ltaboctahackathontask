// All landing copy lives here so it can be translated (LV) in one place.
// KPI values are illustrative samples until the scoring task is approved.

export const brand = {
  name: 'Fake OCTA Coach',
  tagline: 'Safer driving, explained',
}

export const nav = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'What we measure', href: '#kpis' },
  { label: 'Your score', href: '#score' },
  { label: 'Privacy', href: '#privacy' },
]

export const hero = {
  lines: [
    { text: 'Drive', outlined: true },
    { text: 'Safer', outlined: false },
    { text: 'Know why', outlined: true },
  ],
  lead: 'Fake OCTA Coach turns everyday trips into a transparent driving score, one practical tip a week, and an illustrative OCTA estimate.',
  primaryCta: { label: 'Try a sample trip', href: '#score' },
  secondaryCta: { label: 'How it works', href: '#how-it-works' },
}

export type Kpi = {
  title: string
  unit: string
  value: string
  decimals?: string
  suffix: string
  note: string
  icon: 'speed' | 'brake' | 'night' | 'signal'
}

export const kpiSection = {
  title: 'What we measure',
  subtitle: 'Three behaviour signals plus context. All normalised by distance or time.',
  kpis: [
    {
      title: 'Speeding exposure',
      unit: 'Share of driving time',
      value: '4',
      decimals: '2',
      suffix: '%',
      note: 'Above the posted limit',
      icon: 'speed',
    },
    {
      title: 'Harsh braking',
      unit: 'Events per 100 km',
      value: '1',
      decimals: '8',
      suffix: '/100 km',
      note: 'Includes harsh acceleration',
      icon: 'brake',
    },
    {
      title: 'Night driving',
      unit: 'Share of distance',
      value: '12',
      suffix: '%',
      note: 'Context, not a penalty',
      icon: 'night',
    },
    {
      title: 'Data confidence',
      unit: 'Trip coverage',
      value: '93',
      suffix: '%',
      note: 'Low data lowers confidence, not your score',
      icon: 'signal',
    },
  ] satisfies Kpi[],
}

export const steps = {
  title: ['From trip to tip', 'in four steps'],
  items: [
    { title: 'Drive as usual', detail: 'Trips are recorded with minimal setup' },
    { title: 'KPIs are calculated', detail: 'On your device, per 100 km' },
    { title: 'Score is explained', detail: '0–100, with the top factors' },
    { title: 'Get one tip', detail: 'Plus an illustrative OCTA band' },
  ],
}

export const scorePreview = {
  title: 'Your score, explained',
  subtitle: 'Sample week based on synthetic trips',
  score: 78,
  scoreLabel: 'Safer than average',
  factors: [
    { label: 'Smooth braking on city trips', impact: 'positive' as const },
    { label: 'Few minutes above the limit', impact: 'positive' as const },
    { label: 'Harsh acceleration on motorway on-ramps', impact: 'negative' as const },
  ],
  tip: {
    title: 'Tip of the week',
    body: 'Ease into on-ramps: start accelerating earlier and more gently. Fewer harsh events could add about 4 points next week.',
  },
  octa: {
    title: 'Illustrative OCTA band',
    band: 'Lower-risk band',
    disclaimer: 'Hackathon simulation. Not a Balcia tariff, quote, or offer.',
  },
}

export const privacy = {
  title: 'Why Fake OCTA Coach',
  body: 'Built for safer roads, not surveillance. Your trip data is processed on your device, you decide what is shared, and every number comes with an explanation.',
  stats: [
    { value: '0', label: 'Accounts needed for the demo' },
    { value: '100%', label: 'On-device KPI calculation' },
    { value: '3–5', label: 'Explainable KPIs, no black box' },
    { value: 'EU', label: 'Hosting preference, GDPR first' },
  ],
}

export const footer = {
  disclaimer:
    'Fake OCTA Coach is a hackathon prototype. Scores and OCTA bands are illustrative simulations and are not an insurance offer, tariff, or quote from Balcia or any other insurer.',
  credit: 'All data is fake / made by solanaflippers',
}
