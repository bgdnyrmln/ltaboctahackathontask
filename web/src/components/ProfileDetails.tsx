import { isInspectionOverdue, isUnknown, type Maybe, type Profile, type Vehicle } from '@data'
import { fullName, PERSONAL_CODE_NOTE, personaOf } from '../demo/personas'

// Unknown values are rendered as a placeholder, never as 0 or a guess (HACK-17).
export function show<T>(value: Maybe<T>, format: (v: T) => string = String): string {
  return isUnknown(value) ? 'Not available' : format(value)
}

const yearOf = (iso: string) => new Date(iso).getFullYear()
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Vehicle specs (C's HACK-27 fields); unknown values are named, never guessed.
function specsOf(v: Vehicle): string {
  const opt = <T,>(x: Maybe<T> | undefined) => (x === undefined || isUnknown(x) ? null : x)
  const parts = [
    opt(v.fuelType) && cap(String(opt(v.fuelType))),
    opt(v.powerKw) !== null && `${opt(v.powerKw)} kW`,
    opt(v.bodyType) && cap(String(opt(v.bodyType))),
    opt(v.seats) !== null && `${opt(v.seats)} seats`,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Technical data not available'
}

function inspectionText(v: Vehicle): string {
  const until = v.inspectionValidUntil
  if (until === undefined || isUnknown(until)) return 'Inspection: not available'
  const date = new Date(until).toLocaleDateString('lv-LV')
  return isInspectionOverdue(v) ? `Inspection overdue (was valid until ${date})` : `Inspection valid until ${date}`
}

const inspectionClass = (v: Vehicle) => (isInspectionOverdue(v) ? ' is-overdue' : '')

export function ProfileDetails({ profile }: { profile: Profile }) {
  const { driver, vehicles } = profile
  return (
    <div className="profile-details">
      <dl className="facts">
        <div>
          <dt>Name</dt>
          <dd>{fullName(driver)}</dd>
        </div>
        {personaOf(driver.id) && (
          <div>
            <dt>Personal code</dt>
            <dd title={PERSONAL_CODE_NOTE}>
              {personaOf(driver.id)!.personalCode} <span className="demo-tag">demo</span>
            </dd>
          </div>
        )}
        <div>
          <dt>Licence categories</dt>
          <dd>{show(driver.licenseCategories, (c) => c.join(', '))}</dd>
        </div>
        <div>
          <dt>Licence since</dt>
          <dd>
            {show(driver.licenseSince, (d) => {
              const n = new Date().getFullYear() - yearOf(d)
              return `${yearOf(d)} (${n} ${n === 1 ? 'year' : 'years'})`
            })}
          </dd>
        </div>
      </dl>

      <h3 className="profile-details__sub">Vehicles</h3>
      {vehicles.length === 0 ? (
        <p className="muted">No vehicle on record.</p>
      ) : (
        <ul className="vehicles">
          {vehicles.map((v) => (
            <li key={v.id} className="vehicle">
              <span className="plate">{v.plateLabel}</span>
              <span>
                {isUnknown(v.make) && isUnknown(v.model)
                  ? 'Make and model not available'
                  : `${show(v.make)} ${show(v.model)}`}
              </span>
              <span className="muted">Year: {show(v.year)}</span>
              <span className="vehicle__specs">{specsOf(v)}</span>
              <span className={`vehicle__inspection${inspectionClass(v)}`}>{inspectionText(v)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
