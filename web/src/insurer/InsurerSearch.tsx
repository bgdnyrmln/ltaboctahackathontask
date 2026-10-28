import type { RiskBand } from '@data'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { maskCode } from '../demo/personas'
import { BAND_TEXT, usePortfolio } from './InsurerPortal'
import type { DriverRow } from './portfolio'
import { useT, useTn } from '../i18n'

// Insurer's driver database: look a person up by personal code, name or plate,
// the way an underwriter or claims handler would. Driving data is only shown for
// drivers who share it with this insurer.

// Lower-case, strip Latvian diacritics, spaces and dashes: "Bērziņa" ~ "berzina",
// "300291-17428" ~ "30029117428", "DEMO-101" ~ "demo101".
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s-]/g, '')

type Sharing = 'all' | 'sharing' | 'private'

function matches(r: DriverRow, q: string) {
  if (!q) return true
  const fields = [r.name, r.personalCode ?? '', r.plate ?? '', r.vehicle ?? ''].map(norm)
  return fields.some((f) => f.includes(q))
}

export function InsurerSearch() {
  const t = useT()
  const tn = useTn()
  const rows = usePortfolio()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [sharing, setSharing] = useState<Sharing>((params.get('sharing') as Sharing) ?? 'all')
  const [band, setBand] = useState<RiskBand | 'any'>((params.get('band') as RiskBand) ?? 'any')
  const searched = params.has('q')

  const results = useMemo(() => {
    if (!rows || !searched) return []
    const q = norm(params.get('q') ?? '')
    const s = (params.get('sharing') as Sharing) ?? 'all'
    const b = params.get('band') ?? 'any'
    return rows.filter(
      (r) =>
        matches(r, q) &&
        (s === 'all' || (s === 'sharing' ? Boolean(r.shared) : !r.shared)) &&
        (b === 'any' || r.shared?.report.result.band === b),
    )
  }, [rows, params, searched])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = { q: query.trim() }
    if (sharing !== 'all') next.sharing = sharing
    if (band !== 'any') next.band = band
    setParams(next)
  }

  return (
    <div className="ins-page">
      <div className="ins-page__head">
        <h1>{t('Driver database')}</h1>
        <p className="muted">
          {t('Find a driver by personal code, name or vehicle plate. Driving scores appear only for drivers who share them with you.')}
        </p>
      </div>

      <form className="panel ins-search-form" onSubmit={submit} role="search">
        <label className="field ins-search-form__q">
          <span className="field__label">{t('Personal code, name or plate')}</span>
          <input
            className="field__input ins-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('e.g. 300291-17428, Bērziņa or DEMO-101')}
            autoFocus
          />
        </label>
        <label className="field">
          <span className="field__label">{t('Data sharing')}</span>
          <select
            className="field__input ins-select"
            value={sharing}
            onChange={(e) => setSharing(e.target.value as Sharing)}
          >
            <option value="all">{t('All drivers')}</option>
            <option value="sharing">{t('Sharing with us')}</option>
            <option value="private">{t('Not sharing')}</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">{t('Risk band')}</span>
          <select
            className="field__input ins-select"
            value={band}
            onChange={(e) => setBand(e.target.value as RiskBand | 'any')}
          >
            <option value="any">{t('Any')}</option>
            {(Object.keys(BAND_TEXT) as RiskBand[]).map((b) => (
              <option key={b} value={b}>
                {t(BAND_TEXT[b])}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn--primary ins-search-form__go">
          {t('Search')}
        </button>
      </form>

      {!rows ? (
        <p className="muted">{t('Loading…')}</p>
      ) : !searched ? (
        <section className="panel ins-empty">
          <p>
            {t('Enter a personal code, name or plate and press')} <strong>{t('Search')}</strong>.{' '}
            {t('Leave the field empty to list everyone ({n} drivers in the database).', { n: rows.length })}
          </p>
        </section>
      ) : (
        <section className="panel">
          <p className="ins-count">
            {tn(results.length, '{n} record found', '{n} records found')}
          </p>
          {results.length === 0 ? (
            <p className="muted">{t('No driver matches. Check the personal code or try a name or plate.')}</p>
          ) : (
            <div className="ins-table-wrap">
              <table className="ins-table">
                <thead>
                  <tr>
                    <th>{t('Driver')}</th>
                    <th>{t('Personal code')}</th>
                    <th>{t('Vehicle')}</th>
                    <th>{t('Data sharing')}</th>
                    <th>{t('Final score')}</th>
                    <th>{t('Band')}</th>
                    <th>{t('This week')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const s = r.shared
                    return (
                      <tr key={r.driverId} className={s ? '' : 'is-private'}>
                        <td>{s ? <Link to={`/insurer/drivers/${r.driverId}`}>{r.name}</Link> : r.name}</td>
                        <td className="num">
                          {r.personalCode ? (s ? r.personalCode : maskCode(r.personalCode)) : '—'}
                        </td>
                        <td>
                          {r.plate && <span className="plate">{r.plate}</span>} {r.vehicle}
                        </td>
                        <td>
                          <span className={`share-badge${s ? ' is-on' : ''}`}>
                            {s ? t('Sharing') : r.deleted ? t('Data deleted') : t('Not sharing')}
                          </span>
                        </td>
                        <td className="num">
                          {s ? (
                            <span className={`score-pill score-pill--${s.report.result.band ?? 'none'}`}>
                              {s.final ?? '—'}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{s?.report.result.band ? t(BAND_TEXT[s.report.result.band]) : '—'}</td>
                        <td className="num">{s ? `${Math.round(s.report.totals.distanceKm)} km` : '—'}</td>
                        <td>
                          {s && (
                            <Link to={`/insurer/drivers/${r.driverId}`} className="btn btn--outline ins-open">
                              {t('Open record')}
                            </Link>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
