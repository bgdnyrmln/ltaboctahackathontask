import { brand } from '../content/landing'

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo${light ? ' logo--light' : ''}`}>
      <svg className="logo__mark" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M16 16 L24 9" stroke="var(--logo-accent, var(--color-accent))" strokeWidth="3" strokeLinecap="round" />
        <circle cx="16" cy="16" r="3" fill="var(--logo-accent, var(--color-accent))" />
      </svg>
      <span className="logo__text">
        <span className="logo__name">{brand.name}</span>
        <span className="logo__tagline">{brand.tagline}</span>
      </span>
    </span>
  )
}
