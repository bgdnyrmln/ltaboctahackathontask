import { useState } from 'react'
import { useObdLink } from '../telemetry/obdLink'
import { useT } from '../i18n'

// Phone card + sheet: connect a (simulated) OBD-II adapter over Bluetooth.
export function ObdConnect({ vehicle }: { vehicle: string }) {
  const t = useT()
  const obd = useObdLink()
  const [open, setOpen] = useState(false)
  const busy = obd.status === 'scanning' || obd.status === 'pairing' || obd.status === 'initializing'

  return (
    <>
      <section className={`panel obd-card${obd.status === 'connected' ? ' is-on' : ''}`}>
        <div className="obd-card__row">
          <span className="obd-card__icon" aria-hidden="true">
            ᛒ
          </span>
          <div className="obd-card__text">
            <strong>{obd.status === 'connected' ? t('{name} connected', { name: obd.device?.name ?? '' }) : t('OBD-II adapter')}</strong>
            <small>
              {obd.status === 'connected'
                ? t('{vehicle} · speed and engine data from the car', { vehicle })
                : t('Not connected · using phone GPS')}
            </small>
          </div>
          {obd.status === 'connected' ? (
            <button type="button" className="link-btn obd-card__btn" onClick={obd.disconnect}>
              {t('Disconnect')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--outline obd-card__btn"
              onClick={() => {
                setOpen(true)
                obd.scan()
              }}
            >
              {t('Connect')}
            </button>
          )}
        </div>
      </section>

      {open && (
        <div className="sheet" role="dialog" aria-label={t('Connect OBD-II adapter')}>
          <div className="sheet__body">
            <div className="sheet__head">
              <h2>{t('Connect OBD-II adapter')}</h2>
              <button
                type="button"
                className="sheet__close"
                aria-label={t('Close')}
                onClick={() => {
                  obd.cancel()
                  setOpen(false)
                }}
              >
                ×
              </button>
            </div>
            <p className="demo-label">{t('Simulated Bluetooth, no hardware needed')}</p>

            {(obd.status === 'scanning' || obd.status === 'found' || obd.status === 'error') && (
              <>
                <p className="sheet__status">
                  {obd.status === 'scanning' ? (
                    <>
                      <span className="bt-radar" aria-hidden="true" /> {t('Searching for Bluetooth devices…')}
                    </>
                  ) : (
                    t('Devices nearby')
                  )}
                </p>
                <ul className="bt-list">
                  {obd.found.map((d) => (
                    <li key={d.id}>
                      <button type="button" className="bt-device" onClick={() => obd.connect(d)} disabled={busy}>
                        <span className="bt-device__name">
                          {d.name}
                          <small>{d.detail}</small>
                        </span>
                        <span className="bt-device__rssi" aria-label={t('Signal {n} dBm', { n: d.rssi })}>
                          {d.rssi > -60 ? '▂▄▆█' : d.rssi > -75 ? '▂▄▆' : '▂▄'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {obd.error && <p className="form-error">{obd.error}</p>}
              </>
            )}

            {(obd.status === 'pairing' || obd.status === 'initializing' || obd.status === 'connected') && (
              <>
                <p className="sheet__status">
                  {obd.status === 'pairing' ? (
                    <>
                      <span className="spinner" aria-hidden="true" /> {t('Pairing…')}
                    </>
                  ) : obd.status === 'initializing' ? (
                    <>
                      <span className="spinner" aria-hidden="true" /> {t('Initialising adapter…')}
                    </>
                  ) : (
                    <>✓ {t('Connected to {name}', { name: obd.device?.name ?? '' })}</>
                  )}
                </p>
                <ol className="obd-log" aria-label={t('Adapter log')}>
                  {obd.log.map((l, i) => (
                    <li key={i} className={`obd-log__${l.dir}`}>
                      {l.dir === 'out' ? '> ' : l.dir === 'in' ? '< ' : ''}
                      {l.text}
                    </li>
                  ))}
                </ol>
                {obd.status === 'connected' && (
                  <>
                    <p className="muted">
                      {t("{vehicle} · engine idling at {rpm} rpm. Trips now use the car's own speed data.", { vehicle, rpm: obd.idleRpm ?? 820 })}
                    </p>
                    <button type="button" className="btn btn--primary btn--big" onClick={() => setOpen(false)}>
                      {t('Done')}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
