import type { RiskBand } from '@data'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useNavigate, useParams } from 'react-router'
import { onSharedDataChange } from '../auth/appApi'
import { Logo } from '../components/Logo'
import { maskCode, PERSONAL_CODE_NOTE } from '../demo/personas'
import { loadPortfolio, portfolioCsv, type DriverRow } from './portfolio'
import { LangSwitch, useT, useTn } from '../i18n'
import './insurer.css'

// Insurer portal (demo). A fictional insurer, not Balcia or any real company.
const ORG = 'Demo Insurer AS'
const SESSION_KEY = 'foc.insurer'

export const BAND_TEXT: Record<RiskBand, string> = {
  low: 'Low risk',
  moderate_low: 'Moderate-low',
  moderate: 'Moderate',
  elevated: 'Elevated',
}

function isSignedIn() {
  try {
    return localStorage.getItem(SESSION_KEY) === ORG
  } catch {
    return false
  }
}

export function usePortfolio() {
  const [rows, setRows] = useState<DriverRow[] | null>(null)
  const load = useCallback(() => {
    loadPortfolio().then(setRows)
  }, [])
  useEffect(() => {
    load()
    // Live: a driver saving a trip or changing consent in another tab updates the portal.
    return onSharedDataChange(load)
  }, [load])
  return rows
}

export function InsurerLogin() {
  const t = useT()
  const navigate = useNavigate()
  return (
    <div className="ins-login">
      <div className="ins-login__card">
        <div className="ins-login__top">
          <Logo />
          <LangSwitch />
        </div>
        <h1>{t('Insurer portal')}</h1>
        <p className="muted">
          {t('Weekly driving-score summaries of drivers who chose to share them. Demo: fictional insurer, synthetic data, no real quotes.')}
        </p>
        <button
          type="button"
          className="btn btn--primary btn--big"
          onClick={() => {
            try {
              localStorage.setItem(SESSION_KEY, ORG)
            } catch {
              // ignore
            }
            navigate('/insurer', { replace: true })
          }}
        >
          {t('Sign in as {org}', { org: ORG })}
        </button>
        <Link to="/" className="back-link">
          {t('← Back to the site')}
        </Link>
      </div>
    </div>
  )
}

export function InsurerLayout() {
  const t = useT()
  const navigate = useNavigate()
  if (!isSignedIn()) return <Navigate to="/insurer/login" replace />
  return (
    <div className="ins">
      <header className="ins__bar">
        <div className="ins__brand">
          <Logo />
          <span className="ins__badge">{t('Insurer portal')}</span>
        </div>
        <nav className="ins__nav" aria-label={t('Insurer')}>
          <NavLink to="/insurer" end>
            {t('Driver database')}
          </NavLink>
          <NavLink to="/insurer/portfolio">{t('Portfolio')}</NavLink>
          <NavLink to="/insurer/data">{t('Data & consent')}</NavLink>
        </nav>
        <div className="ins__user">
          <span>{ORG}</span>
          <LangSwitch />
          <span className="demo-badge">{t('Demo data')}</span>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              try {
                localStorage.removeItem(SESSION_KEY)
              } catch {
                // ignore
              }
              navigate('/insurer/login')
            }}
          >
            {t('Sign out')}
          </button>
        </div>
      </header>
      <main className="ins__main">
        <Outlet />
      </main>
      <footer className="ins__foot">
        {t('Hackathon simulation. Scores and OCTA directions are illustrative, not a tariff, quote or offer from Balcia or any other insurer.')}
      </footer>
    </div>
  )
}

function Spark({ values }: { values: Array<number | null> }) {
  const pts = values.map(
    (v, i) => `${(i / Math.max(1, values.length - 1)) * 60},${v === null ? 20 : 22 - (v / 100) * 20}`,
  )
  return (
    <svg className="spark" viewBox="0 0 60 24" aria-hidden="true">
      <polyline points={pts.join(' ')} />
    </svg>
  )
}

export function InsurerPortfolio() {
  const t = useT()
  const tn = useTn()
  const rows = usePortfolio()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'score' | 'name'>('score')

  const shared = useMemo(() => (rows ?? []).filter((r) => r.shared), [rows])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (rows ?? []).filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.plate ?? '').toLowerCase().includes(q) ||
        (r.personalCode ?? '').includes(q),
    )
    return list.sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : (b.shared?.final ?? -1) - (a.shared?.final ?? -1) || a.name.localeCompare(b.name),
    )
  }, [rows, query, sort])

  if (!rows) return <p className="muted">{t('Loading…')}</p>

  const scored = shared.filter((r) => r.shared!.final !== null)
  const avg = scored.length ? Math.round(scored.reduce((s, r) => s + r.shared!.final!, 0) / scored.length) : null
  const km = Math.round(shared.reduce((s, r) => s + r.shared!.report.totals.distanceKm, 0))
  const bands: RiskBand[] = ['low', 'moderate_low', 'moderate', 'elevated']
  const bandCount = (b: RiskBand) => shared.filter((r) => r.shared!.report.result.band === b).length

  const download = () => {
    const blob = new Blob([portfolioCsv(rows)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `driving-scores-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="ins-page">
      <div className="ins-page__head">
        <h1>{t('Portfolio')}</h1>
        <p className="muted">{t("This week's driving scores from drivers who share them with you. Updates live.")}</p>
      </div>

      <div className="ins-stats">
        <div className="ins-stat">
          <span>{t('Drivers sharing')}</span>
          <strong>
            {shared.length}
            <small> / {rows.length}</small>
          </strong>
        </div>
        <div className="ins-stat">
          <span>{t('Average final score')}</span>
          <strong>{avg ?? '—'}</strong>
        </div>
        <div className="ins-stat">
          <span>{t('Distance this week')}</span>
          <strong>
            {km}
            <small> km</small>
          </strong>
        </div>
        <div className="ins-stat ins-stat--bands">
          <span>{t('Risk bands')}</span>
          <div className="bands">
            {bands.map((b) => (
              <div key={b} className={`bands__col bands__col--${b}`}>
                <i style={{ height: `${shared.length ? (bandCount(b) / shared.length) * 100 : 0}%` }} />
                <b>{bandCount(b)}</b>
                <small>{t(BAND_TEXT[b])}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="ins-toolbar">
          <input
            className="field__input ins-search"
            placeholder={t('Search name, personal code or plate')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('Search drivers')}
          />
          <div className="seg" role="group" aria-label={t('Sort')}>
            <button type="button" className={sort === 'score' ? 'is-on' : ''} onClick={() => setSort('score')}>
              {t('By score')}
            </button>
            <button type="button" className={sort === 'name' ? 'is-on' : ''} onClick={() => setSort('name')}>
              {t('By name')}
            </button>
          </div>
          <button type="button" className="btn btn--outline" onClick={download}>
            {t('Export CSV')}
          </button>
        </div>

        <div className="ins-table-wrap">
          <table className="ins-table">
            <thead>
              <tr>
                <th>{t('Driver')}</th>
                <th>{t('Vehicle')}</th>
                <th>{t('Final score')}</th>
                <th>{t('Behaviour')}</th>
                <th>{t('Profile')}</th>
                <th>{t('Band')}</th>
                <th>{t('Trend (4 wk)')}</th>
                <th>{t('This week')}</th>
                <th>{t('OCTA direction')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const s = r.shared
                return (
                  <tr key={r.driverId} className={s ? '' : 'is-private'}>
                    <td>
                      {s ? <Link to={`/insurer/drivers/${r.driverId}`}>{r.name}</Link> : r.name}
                      {r.personalCode && <small className="ins-code">{maskCode(r.personalCode)}</small>}
                    </td>
                    <td>
                      {r.plate && <span className="plate">{r.plate}</span>} {r.vehicle}
                    </td>
                    {s ? (
                      <>
                        <td className="num">
                          <span className={`score-pill score-pill--${s.report.result.band ?? 'none'}`}>
                            {s.final ?? '—'}
                          </span>
                        </td>
                        <td className="num">{s.report.result.score ?? '—'}</td>
                        <td className="num">×{s.risk.p.toFixed(2)}</td>
                        <td>{s.report.result.band ? t(BAND_TEXT[s.report.result.band]) : t('Not enough data')}</td>
                        <td>
                          <Spark values={s.trend.map((t) => t.score)} />
                        </td>
                        <td className="num">
                          {Math.round(s.report.totals.distanceKm)} km · {tn(s.report.trips, '{n} trip', '{n} trips')}
                        </td>
                        <td>{t(s.report.octa.label)}</td>
                      </>
                    ) : (
                      <td colSpan={7} className="muted">
                        {r.deleted ? t('Driver deleted their data') : t('Not shared by the driver')}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export function InsurerDriver() {
  const t = useT()
  const tn = useTn()
  const { id } = useParams()
  const navigate = useNavigate()
  const rows = usePortfolio()
  if (!rows) return <p className="muted">{t('Loading…')}</p>
  const r = rows.find((x) => x.driverId === id)
  if (!r || !r.shared) {
    return (
      <div className="ins-page">
        <button type="button" className="link-btn back-link" onClick={() => navigate(-1)}>
          {t('← Back')}
        </button>
        <p className="muted">
          {t('This driver does not share their driving data with you. Only name, personal code and vehicle are on record.')}
        </p>
      </div>
    )
  }
  const s = r.shared
  const res = s.report.result

  return (
    <div className="ins-page">
      <button type="button" className="link-btn back-link" onClick={() => navigate(-1)}>
        {t('← Back')}
      </button>
      <div className="ins-page__head">
        <h1>{r.name}</h1>
        <p className="muted">
          {r.personalCode && (
            <span title={PERSONAL_CODE_NOTE}>
              {t('Personal code')} {r.personalCode} <span className="demo-tag">{t('demo')}</span> ·{' '}
            </span>
          )}
          {r.plate && <span className="plate">{r.plate}</span>} {r.vehicle} · {t('week of {date}', { date: s.report.weekStart })}
        </p>
      </div>

      <div className="ins-stats">
        <div className="ins-stat">
          <span>{t('Final score')}</span>
          <strong>{s.final ?? '—'}</strong>
        </div>
        <div className="ins-stat">
          <span>{t('Behaviour score')}</span>
          <strong>{res.score ?? '—'}</strong>
        </div>
        <div className="ins-stat">
          <span>{t('Profile factor')}</span>
          <strong>×{s.risk.p.toFixed(2)}</strong>
        </div>
        <div className="ins-stat">
          <span>{t('OCTA direction (illustrative)')}</span>
          <strong className="ins-stat__text">{t(s.report.octa.label)}</strong>
        </div>
      </div>

      <div className="dash">
        <div className="dash__col">
          <section className="panel">
            <h2 className="panel__title">{t('Score trend')}</h2>
            <div
              className="trend"
              role="img"
              aria-label={t('Weekly scores: {list}', { list: s.trend.map((w) => w.score ?? t('no data')).join(', ') })}
            >
              {s.trend.map((t, i) => (
                <div key={t.weekStart} className="trend__col">
                  <span className="trend__value">{t.score ?? '—'}</span>
                  <span
                    className={`trend__bar${i === s.trend.length - 1 ? ' is-current' : ''}`}
                    style={{ height: `${t.score ?? 4}%` }}
                  />
                  <span className="trend__label">{t.weekStart.slice(5)}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2 className="panel__title">{t('What drives the score')}</h2>
            <ul className="kpi-list">
              {res.kpis.map((k) => (
                <li key={k.id} className="kpi-row">
                  <div className="kpi-row__head">
                    <span className="kpi-row__label">{t(k.label)}</span>
                    <span className="kpi-row__value">
                      {k.value === null ? '—' : k.value.toFixed(1)} <small>{t(k.unit)}</small>
                    </span>
                  </div>
                  <div className="bar" aria-hidden="true">
                    <span style={{ width: `${k.subscore ?? 0}%` }} />
                  </div>
                  <p className="kpi-row__meta">
                    {k.subscore === null
                      ? t('No data')
                      : t('{score}/100 · weight {w}%', { score: Math.round(k.subscore), w: Math.round(k.weight * 100) })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="dash__col">
          <section className="panel">
            <h2 className="panel__title">{t('Profile factors')}</h2>
            <ul className="factors-list">
              {s.risk.factors.map((f) => (
                <li key={f.id} className={f.known ? '' : 'is-unknown'}>
                  <span>
                    <strong>{t(f.label)}</strong>
                    <small>{f.known ? f.detail : t('No data')}</small>
                  </span>
                  <span className="factors-list__adj">
                    {f.known
                      ? f.adjustment === 0
                        ? '±0'
                        : `${f.adjustment > 0 ? '+' : ''}${f.adjustment.toFixed(2)}`
                      : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <h2 className="panel__title">{t('Shared with you')}</h2>
            <ul className="checklist">
              <li>
                {t('Weekly scores, risk band, KPI values and totals ({km} km, {trips}).', { km: Math.round(s.report.totals.distanceKm), trips: tn(s.report.trips, '{n} trip', '{n} trips') })}
              </li>
              <li>{t('Confidence: {level}.', { level: t(res.confidence) })}</li>
              <li>
                <strong>{t('Not shared:')}</strong> {t('individual trips, routes, locations, times of day.')}
              </li>
              <li>{t('The driver can stop sharing or delete their data at any time; it disappears here immediately.')}</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

export function InsurerData() {
  const t = useT()
  return (
    <div className="ins-page">
      <div className="ins-page__head">
        <h1>{t('Data & consent')}</h1>
        <p className="muted">{t("How the portal works as the insurer's database of drivers and scores.")}</p>
      </div>
      <div className="dash">
        <section className="panel">
          <h2 className="panel__title">{t('What you receive')}</h2>
          <ul className="checklist">
            <li>{t('Driver identity (verified at sign-up via Smart-ID; demo uses fake Smart-ID) and vehicle plate.')}</li>
            <li>
              {t('Weekly behaviour score, profile factor and final score, risk band, KPI values, confidence and totals.')}
            </li>
            <li>{t('Illustrative OCTA direction (potential discount / no change / possible surcharge), never a price.')}</li>
            <li>{t('CSV export of shared summaries for underwriting and renewal systems.')}</li>
          </ul>
        </section>
        <section className="panel">
          <h2 className="panel__title">{t('What you never receive')}</h2>
          <ul className="checklist">
            <li>{t('Individual trips, GPS routes, locations or times.')}</li>
            <li>{t('Data from drivers who did not opt in, or who withdrew or deleted their data.')}</li>
          </ul>
        </section>
        <section className="panel">
          <h2 className="panel__title">{t('Architecture')}</h2>
          <ul className="checklist">
            <li>
              <strong>{t('Prototype:')}</strong> {t('the app and this portal share one data store in the browser, so changes show up live.')}
            </li>
            <li>
              <strong>{t('Production:')}</strong> {t('phone apps upload weekly summaries (not trips) to a central EU-hosted database (e.g. Postgres). Each insurer reads only rows of drivers with an active consent for that insurer (row-level security), via this portal or an API.')}
            </li>
            <li>{t('Consent is per insurer, logged with time and purpose, and revocable in the app.')}</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
