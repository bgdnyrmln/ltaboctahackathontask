import { finalScore, inputsFromProfile, profileRisk, type Confidence, type RiskBand } from '@data'
import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { ScoreRing } from '../../components/ScoreRing'
import { firstName } from '../../demo/personas'
import { useDriverData } from '../../demo/useDriverData'
import { tipText, useLang, useT, useTn } from '../../i18n'

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
const weekLabel = (weekStart: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(`${weekStart}T12:00:00`))

export function Home() {
  const t = useT()
  const tn = useTn()
  const { lang } = useLang()
  const { state } = useAuth()
  const { loading, report, trend } = useDriverData()
  if (state.status !== 'signedIn' || loading || !report) return <p className="muted">{t('Loading…')}</p>

  const { result, totals, tips, octa } = report
  // D's profile layer: a bounded factor from static data, applied on top of the behaviour score.
  const risk = profileRisk(inputsFromProfile(state.profile, new Date()), new Date())
  const fin = finalScore(result.score, risk)
  const previous = trend.length > 1 ? trend[trend.length - 2] : undefined
  const name = firstName(state.profile.driver)
  const nightShare = totals.distanceKm > 0 ? (totals.nightKm / totals.distanceKm) * 100 : 0

  return (
    <div className="app-page">
      <h1 className="app-page__title">{t('Hi, {name}', { name })}</h1>
      <p className="muted">
        {t('This week')} · {fmt(totals.distanceKm, 0)} km · {tn(report.trips, '{n} trip', '{n} trips')}
      </p>

      <div className="dash">
        <div className="dash__col">
          <section className="panel score-panel" aria-labelledby="score-h">
            <h2 id="score-h" className="visually-hidden">
              {t('Driving score')}
            </h2>
            {result.score === null ? (
              <div className="insufficient">
                <p className="insufficient__big">—</p>
                <p>
                  <strong>{t('Not enough data yet.')}</strong> {t('Missing data never lowers your score.')}
                </p>
                <Link to="/app/drive" className="btn btn--primary">
                  {t('Record a trip')}
                </Link>
              </div>
            ) : (
              <>
                <ScoreRing score={result.score} label={result.band ? t(BAND_TEXT[result.band]) : ''} />
                {fin.final !== null && (
                  <p className="final-score">
                    {t('With profile:')} <strong>{fin.final}</strong> · {t('Profile ×{p}', { p: risk.p.toFixed(2) })}
                    <small> {t('Behaviour score above; tips use behaviour only.')}</small>
                  </p>
                )}
                {previous?.score != null && (
                  <p className={`delta ${result.score >= previous.score ? 'delta--up' : 'delta--down'}`}>
                    {result.score >= previous.score ? '▲' : '▼'}{' '}
                    {t('{n} vs previous week', { n: Math.abs(result.score - previous.score) })}
                  </p>
                )}
              </>
            )}
            {result.score !== null && (
              <p className={`confidence confidence--${result.confidence}`}>{t(CONFIDENCE_TEXT[result.confidence])}</p>
            )}
            {result.score !== null && result.limitsApproximate && (
              <p className="confidence confidence--limits">{t('Speed limits are approximate (demo map).')}</p>
            )}
          </section>

          {tips.map((tip) => (
            <section key={tip.kind} className="panel tip-card">
              <h2 className="tip-card__title">{tip.kind === 'fatigue_context' ? t('Take breaks') : t('Tip of the week')}</h2>
              <p>
                {tipText(t, tip)}
                {tip.projectedScore !== null && result.score !== null && (
                  <>
                    {' '}
                    {t('Your score could rise from {from} to about {to}.', { from: result.score, to: tip.projectedScore })}
                  </>
                )}
              </p>
            </section>
          ))}

          <section className="panel octa-card">
            <h2 className="octa-card__title">{t('Illustrative OCTA direction')}</h2>
            <p className="octa-card__band">{t(octa.label)}</p>
            <p className="octa-card__disclaimer">{t(octa.disclaimer)}</p>
          </section>
        </div>

        <div className="dash__col">
          <section className="panel">
            <h2 className="panel__title">{t('What shaped your score')}</h2>
            <ul className="kpi-list">
              {result.kpis.map((k) => (
                <li key={k.id} className="kpi-row">
                  <div className="kpi-row__head">
                    <span className="kpi-row__label">{t(k.label)}</span>
                    <span className="kpi-row__value">
                      {k.value === null ? '—' : fmt(k.value)} <small>{t(k.unit)}</small>
                    </span>
                  </div>
                  <div className="bar" aria-hidden="true">
                    <span style={{ width: `${k.subscore ?? 0}%` }} />
                  </div>
                  <p className="kpi-row__meta">
                    {k.subscore === null
                      ? t('No data')
                      : t('{score}/100 · weight {w}%', { score: Math.round(k.subscore), w: Math.round(k.weight * 100) })}
                    {k.pointsLost !== null && k.pointsLost >= 1 && ` · ${t('−{n} pts', { n: fmt(k.pointsLost, 0) })}`}
                  </p>
                </li>
              ))}
            </ul>
            <p className="context-note">
              {t('Night driving: {n}% of distance. Counts only together with a long stretch without a break.', { n: fmt(nightShare, 0) })}
              {report.fatigueContext && ` ${t('Some long night drives without a stop.')}`}
            </p>
          </section>

          <section className="panel">
            <h2 className="panel__title">{t('Trend')}</h2>
            <div
              className="trend"
              role="img"
              aria-label={t('Weekly scores: {list}', { list: trend.map((w) => w.score ?? t('no data')).join(', ') })}
            >
              {trend.map((w, i) => (
                <div key={w.weekStart} className="trend__col">
                  <span className="trend__value">{w.score ?? '—'}</span>
                  <span
                    className={`trend__bar${i === trend.length - 1 ? ' is-current' : ''}`}
                    style={{ height: `${w.score ?? 4}%` }}
                  />
                  <span className="trend__label">{i === trend.length - 1 ? t('Now') : weekLabel(w.weekStart, lang === 'lv' ? 'lv-LV' : 'en-GB')}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <p className="provisional-note">
        {t('Weights and thresholds are illustrative, not final.')}
      </p>
    </div>
  )
}
