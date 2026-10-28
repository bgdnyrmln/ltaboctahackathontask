import { isUnknown, type Maybe, type Profile } from '@data'

// Unknown values are rendered as a placeholder, never as 0 or a guess (HACK-17).
export function show<T>(value: Maybe<T>, format: (v: T) => string = String): string {
  return isUnknown(value) ? 'Not available' : format(value)
}

const yearOf = (iso: string) => new Date(iso).getFullYear()

export function ProfileDetails({ profile }: { profile: Profile }) {
  const { driver, vehicles } = profile
  return (
    <div className="profile-details">
      <dl className="facts">
        <div>
          <dt>Name</dt>
          <dd>{driver.displayName}</dd>
        </div>
        <div>
          <dt>Licence categories</dt>
          <dd>{show(driver.licenseCategories, (c) => c.join(', '))}</dd>
        </div>
        <div>
          <dt>Licence since</dt>
          <dd>{show(driver.licenseSince, (d) => `${yearOf(d)} (${new Date().getFullYear() - yearOf(d)} years)`)}</dd>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
