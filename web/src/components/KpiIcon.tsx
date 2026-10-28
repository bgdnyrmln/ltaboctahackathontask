import type { Kpi } from '../content/landing'

const paths: Record<Kpi['icon'], React.ReactNode> = {
  speed: (
    <>
      <path d="M12 44a28 28 0 0 1 56 0" />
      <path d="M40 44 54 26" />
      <circle cx="40" cy="44" r="4" />
    </>
  ),
  brake: (
    <>
      <circle cx="40" cy="36" r="20" />
      <circle cx="40" cy="36" r="8" />
      <path d="M14 18a34 34 0 0 0 0 36M66 18a34 34 0 0 1 0 36" />
    </>
  ),
  night: <path d="M50 14a24 24 0 1 0 16 38A26 26 0 0 1 50 14Z" />,
  signal: (
    <>
      <path d="M18 56V46M32 56V38M46 56V28M60 56V18" />
    </>
  ),
}

export function KpiIcon({ name }: { name: Kpi['icon'] }) {
  return (
    <svg className="kpi-card__icon" viewBox="0 0 80 72" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        {paths[name]}
      </g>
    </svg>
  )
}
