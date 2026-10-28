import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { ScoreRing } from '../../components/ScoreRing'
import { useDriverData } from '../../demo/useDriverData'
import type { Confidence } from '../../score/provisional'

const CONFIDENCE_TEXT: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence: drive a bit more for a stable score',
  insufficient: 'Not enough data yet',
}

const fmt = (n: number, digits = 1) => n.toFixed(digits)

export function Home() {
  const { state } = useAuth()
  const { loading, weeks } = useDriverData()
  if (state.status !== 'signedIn' || loading) return <p className="muted">Loading…</p>

  const current = weeks[weeks.length - 1]
  const previous = weeks[weeks.length - 2]
  const firstName = state.profile.driver.displayName.split(' ').pop()

  return (
    <div className="app-page">
      <h1 className="app-page__title">Hi, {firstName}</h1>
      <p className="muted">Last 7 days · {fmt(current.totals.distanceKm, 0)} km · {current.totals.trips} trips</p>

      <section className="panel score-panel" aria-labelledby="score-h">
        <h2 id="score-h" className="visually-hidden">
          Driving score
        </h2>
        {current.score === null ? (
          <div className="insufficient">
            <p className="insufficient__big">—</p>
            <p>
              <strong>Not enough data yet.</strong> Drive at least 30 km this week to get a score. Missing data never
              lowers your score.
            </p>
            <Link to="/app/drive" className="btn btn--primary">
              Record a trip
            </Link>
          </div>
        ) : (
          <>
            <ScoreRing score={current.score} label={current.zone?.label ?? ''} />
            {previous?.score != null && (
              <p className={`delta ${current.score >= previous.score ? 'delta--up' : 'delta--down'}`}>
                {current.score >= previous.score ? '▲' : '▼'} {Math.abs(current.score - previous.score)} vs previous week
              </p>
            )}
          </>
        )}
        <p className={`confidence confidence--${current.confidence}`}>{CONFIDENCE_TEXT[current.confidence]}</p>
      </section>

      {current.tip && (
        <section className="panel tip-card">
          <h2 className="tip-card__title">Tip of the week</h2>
          <p>
            {current.tip.text}. Your score could rise from {current.score} to about {current.tip.projectedScore}.
          </p>
        </section>
      )}

      <section className="panel">
        <h2 className="panel__title">What shaped your score</h2>
        <ul className="kpi-list">
          {current.kpis.map((k) => (
            <li key={k.id} className="kpi-row">
              <div className="kpi-row__head">
                <span className="kpi-row__label">{k.label}</span>
                <span className="kpi-row__value">
                  {fmt(k.value)} <small>{k.unit}</small>
                </span>
              </div>
              <div className="bar" aria-hidden="true">
                <span style={{ width: `${k.subscore}%` }} />
              </div>
              <p className="kpi-row__meta">
                {Math.round(k.subscore)}/100 · weight {Math.round(k.weight * 100)}%
                {k.lostPoints >= 1 && ` · −${fmt(k.lostPoints, 0)} pts`}
              </p>
            </li>
          ))}
        </ul>
        <p className="context-note">
          Night driving: {fmt(current.nightShare, 0)}% of distance. Context only, not scored.
        </p>
      </section>

      <section className="panel">
        <h2 className="panel__title">Trend</h2>
        <div className="trend" role="img" aria-label={`Weekly scores: ${weeks.map((w) => w.score ?? 'no data').join(', ')}`}>
          {weeks.map((w, i) => (
            <div key={w.from} className="trend__col">
              <span className="trend__value">{w.score ?? '—'}</span>
              <span className={`trend__bar${i === weeks.length - 1 ? ' is-current' : ''}`} style={{ height: `${w.score ?? 4}%` }} />
              <span className="trend__label">{i === weeks.length - 1 ? 'Now' : `−${weeks.length - 1 - i}w`}</span>
            </div>
          ))}
        </div>
      </section>

      {current.zone && (
        <section className="panel octa-card">
          <h2 className="octa-card__title">Illustrative OCTA direction</h2>
          <p className="octa-card__band">{current.zone.octaDirection}</p>
          <p className="muted">{current.zone.label} band.</p>
          <p className="octa-card__disclaimer">Hackathon simulation. Not a Balcia tariff, quote, or offer. No EUR amounts.</p>
        </section>
      )}

      <p className="provisional-note">
        Provisional scoring from the team's draft spec. Weights and thresholds are not final.
      </p>
    </div>
  )
}
