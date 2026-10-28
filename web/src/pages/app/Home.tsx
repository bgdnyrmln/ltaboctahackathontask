import { finalScore, inputsFromProfile, profileRisk, type Confidence, type RiskBand } from '@data'
import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { ScoreRing } from '../../components/ScoreRing'
import { useDriverData } from '../../demo/useDriverData'

const CONFIDENCE_TEXT: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence: drive a bit more for a stable score',
  insufficient: 'Not enough data yet',
}

const BAND_TEXT: Record<RiskBand, string> = {
  low: 'Low risk',
  moderate_low: 'Moderate-low risk',
  moderate: 'Moderate risk',
  elevated: 'Elevated risk',
}

const fmt = (n: number, digits = 1) => n.toFixed(digits)
const weekLabel = (weekStart: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(`${weekStart}T12:00:00`))

export function Home() {
  const { state } = useAuth()
  const { loading, report, trend } = useDriverData()
  if (state.status !== 'signedIn' || loading || !report) return <p className="muted">Loading…</p>

  const { result, totals, tips, octa } = report
  // D's profile layer: a bounded factor from static data, applied on top of the behaviour score.
  const risk = profileRisk(inputsFromProfile(state.profile, new Date()), new Date())
  const fin = finalScore(result.score, risk)
  const previous = trend.length > 1 ? trend[trend.length - 2] : undefined
  const firstName = state.profile.driver.displayName.split(' ').pop()
  const nightShare = totals.distanceKm > 0 ? (totals.nightKm / totals.distanceKm) * 100 : 0

  return (
    <div className="app-page">
      <h1 className="app-page__title">Hi, {firstName}</h1>
      <p className="muted">
        This week · {fmt(totals.distanceKm, 0)} km · {report.trips} {report.trips === 1 ? 'trip' : 'trips'}
      </p>

      <div className="dash">
        <div className="dash__col">
          <section className="panel score-panel" aria-labelledby="score-h">
            <h2 id="score-h" className="visually-hidden">
              Driving score
            </h2>
            {result.score === null ? (
              <div className="insufficient">
                <p className="insufficient__big">—</p>
                <p>
                  <strong>Not enough data yet.</strong> Missing data never lowers your score.
                </p>
                <Link to="/app/drive" className="btn btn--primary">
                  Record a trip
                </Link>
              </div>
            ) : (
              <>
                <ScoreRing score={result.score} label={result.band ? BAND_TEXT[result.band] : ''} />
                {fin.final !== null && (
                  <p className="final-score">
                    With profile: <strong>{fin.final}</strong> · Profile ×{risk.p.toFixed(2)}
                    <small> Behaviour score above; tips use behaviour only.</small>
                  </p>
                )}
                {previous?.score != null && (
                  <p className={`delta ${result.score >= previous.score ? 'delta--up' : 'delta--down'}`}>
                    {result.score >= previous.score ? '▲' : '▼'} {Math.abs(result.score - previous.score)} vs previous
                    week
                  </p>
                )}
              </>
            )}
            {result.score !== null && (
              <p className={`confidence confidence--${result.confidence}`}>{CONFIDENCE_TEXT[result.confidence]}</p>
            )}
          </section>

          {tips.map((tip) => (
            <section key={tip.kind} className="panel tip-card">
              <h2 className="tip-card__title">{tip.kind === 'fatigue_context' ? 'Take breaks' : 'Tip of the week'}</h2>
              <p>
                {tip.text}
                {tip.projectedScore !== null && result.score !== null && (
                  <>
                    {' '}
                    Your score could rise from {result.score} to about {tip.projectedScore}.
                  </>
                )}
              </p>
            </section>
          ))}

          <section className="panel octa-card">
            <h2 className="octa-card__title">Illustrative OCTA direction</h2>
            <p className="octa-card__band">{octa.label}</p>
            <p className="octa-card__disclaimer">{octa.disclaimer}</p>
          </section>
        </div>

        <div className="dash__col">
          <section className="panel">
            <h2 className="panel__title">What shaped your score</h2>
            <ul className="kpi-list">
              {result.kpis.map((k) => (
                <li key={k.id} className="kpi-row">
                  <div className="kpi-row__head">
                    <span className="kpi-row__label">{k.label}</span>
                    <span className="kpi-row__value">
                      {k.value === null ? '—' : fmt(k.value)} <small>{k.unit}</small>
                    </span>
                  </div>
                  <div className="bar" aria-hidden="true">
                    <span style={{ width: `${k.subscore ?? 0}%` }} />
                  </div>
                  <p className="kpi-row__meta">
                    {k.subscore === null ? 'No data' : `${Math.round(k.subscore)}/100`} · weight{' '}
                    {Math.round(k.weight * 100)}%
                    {k.pointsLost !== null && k.pointsLost >= 1 && ` · −${fmt(k.pointsLost, 0)} pts`}
                  </p>
                </li>
              ))}
            </ul>
            <p className="context-note">
              Night driving: {fmt(nightShare, 0)}% of distance. Counts only together with a long stretch without a
              break.
              {report.fatigueContext && ' Some long night drives without a stop.'}
            </p>
          </section>

          <section className="panel">
            <h2 className="panel__title">Trend</h2>
            <div
              className="trend"
              role="img"
              aria-label={`Weekly scores: ${trend.map((w) => w.score ?? 'no data').join(', ')}`}
            >
              {trend.map((w, i) => (
                <div key={w.weekStart} className="trend__col">
                  <span className="trend__value">{w.score ?? '—'}</span>
                  <span
                    className={`trend__bar${i === trend.length - 1 ? ' is-current' : ''}`}
                    style={{ height: `${w.score ?? 4}%` }}
                  />
                  <span className="trend__label">{i === trend.length - 1 ? 'Now' : weekLabel(w.weekStart)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <p className="provisional-note">
        Interim scoring from the team's draft spec. Weights and thresholds are not final.
      </p>
    </div>
  )
}
