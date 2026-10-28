import { isInspectionOverdue, isUnknown, type Maybe, type Profile, type Vehicle } from '@data'
import { fullName, PERSONAL_CODE_NOTE, personaOf } from '../demo/personas'
import { useLang, useT, useTn, type TFn, type TnFn } from '../i18n'

// Unknown values are rendered as a placeholder, never as 0 or a guess (HACK-17).
export function show<T>(value: Maybe<T>, format: (v: T) => string = String, t: TFn = (s) => s): string {
  return isUnknown(value) ? t('Not available') : format(value)
}

const yearOf = (iso: string) => new Date(iso).getFullYear()
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Vehicle specs (C's HACK-27 fields); unknown values are named, never guessed.
function specsOf(v: Vehicle, t: TFn): string {
  const opt = <T,>(x: Maybe<T> | undefined) => (x === undefined || isUnknown(x) ? null : x)
  const parts = [
    opt(v.fuelType) && t(cap(String(opt(v.fuelType)))),
    opt(v.powerKw) !== null && `${opt(v.powerKw)} kW`,
    opt(v.bodyType) && t(cap(String(opt(v.bodyType)))),
    opt(v.seats) !== null && t('{n} seats', { n: opt(v.seats) as number }),
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : t('Technical data not available')
}

function inspectionText(v: Vehicle, t: TFn): string {
  const until = v.inspectionValidUntil
  if (until === undefined || isUnknown(until)) return t('Inspection: not available')
  const date = new Date(until).toLocaleDateString('lv-LV')
  return isInspectionOverdue(v)
    ? t('Inspection overdue (was valid until {date})', { date })
    : t('Inspection valid until {date}', { date })
}

const inspectionClass = (v: Vehicle) => (isInspectionOverdue(v) ? ' is-overdue' : '')

export function ProfileDetails({ profile }: { profile: Profile }) {
  const t = useT()
  const tn: TnFn = useTn()
  useLang()
  const { driver, vehicles } = profile
  return (
    <div className="profile-details">
      <dl className="facts">
        <div>
          <dt>{t('Name')}</dt>
          <dd>{fullName(driver)}</dd>
        </div>
        {personaOf(driver.id) && (
          <div>
            <dt>{t('Personal code')}</dt>
            <dd title={PERSONAL_CODE_NOTE}>
              {personaOf(driver.id)!.personalCode} <span className="demo-tag">{t('demo')}</span>
            </dd>
          </div>
        )}
        <div>
          <dt>{t('Licence categories')}</dt>
          <dd>{show(driver.licenseCategories, (c) => c.join(', '), t)}</dd>
        </div>
        <div>
          <dt>{t('Licence since')}</dt>
          <dd>
            {show(
              driver.licenseSince,
              (d) => {
                const n = new Date().getFullYear() - yearOf(d)
                return `${yearOf(d)} (${tn(n, '{n} year', '{n} years')})`
              },
              t,
            )}
          </dd>
        </div>
      </dl>

      <h3 className="profile-details__sub">{t('Vehicles')}</h3>
      {vehicles.length === 0 ? (
        <p className="muted">{t('No vehicle on record.')}</p>
      ) : (
        <ul className="vehicles">
          {vehicles.map((v) => (
            <li key={v.id} className="vehicle">
              <span className="plate">{v.plateLabel}</span>
              <span>
                {isUnknown(v.make) && isUnknown(v.model)
                  ? t('Make and model not available')
                  : `${show(v.make, String, t)} ${show(v.model, String, t)}`}
              </span>
              <span className="muted">{t('Year: {y}', { y: show(v.year, String, t) })}</span>
              <span className="vehicle__specs">{specsOf(v, t)}</span>
              <span className={`vehicle__inspection${inspectionClass(v)}`}>{inspectionText(v, t)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
