import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { appApi } from '../auth/appApi'
import { Logo } from '../components/Logo'
import { PHONE_FRAME_NAME } from '../telemetry/platform'
import './LiveDemo.css'

const DESKTOP_W = 1280
const DESKTOP_H = 860

// Phone app and web account side by side on one page. Both are the same site
// and share one data store, so a trip recorded on the phone appears in the
// web account immediately.
export function LiveDemo() {
  const desktopBox = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.6)
  const [frameKey, setFrameKey] = useState(0)

  useEffect(() => {
    const box = desktopBox.current
    if (!box) return
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / DESKTOP_W)))
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  const resetDemo = async () => {
    await appApi().resetDemo()
    setFrameKey((k) => k + 1) // reload both frames from the restored data
  }

  return (
    <div className="live-demo">
      <header className="live-demo__bar">
        <Link to="/" aria-label="Back to home">
          <Logo />
        </Link>
        <div className="live-demo__actions">
          <span className="demo-badge">Demo data</span>
          <button type="button" className="btn btn--outline live-demo__reset" onClick={resetDemo}>
            Reset demo data
          </button>
        </div>
      </header>

      <div className="live-demo__intro">
        <h1>Phone app + web account, one shared database</h1>
        <ol className="live-demo__steps">
          <li>Sign in on the phone with a demo profile (the web account follows).</li>
          <li>
            Open <strong>Drive</strong> on the phone and tap <strong>Start trip</strong>: a simulated drive through
            Riga.
          </li>
          <li>Tap Stop and save, then watch the score and trips update in the web account.</li>
        </ol>
      </div>

      <div className="live-demo__stage">
        <figure className="phone" aria-label="Phone app">
          <div className="phone__body">
            <div className="phone__status" aria-hidden="true">
              <span>9:41</span>
              <span className="phone__notch" />
              <span>5G ▮▮▮</span>
            </div>
            <iframe
              key={`phone-${frameKey}`}
              name={PHONE_FRAME_NAME}
              src="/app/drive"
              title="Fake OCTA Coach phone app"
              className="phone__screen"
            />
          </div>
          <figcaption>Mobile app (PWA)</figcaption>
        </figure>

        <figure className="desktop" aria-label="Web account">
          <div className="desktop__chrome" aria-hidden="true">
            <span />
            <span />
            <span />
            <p>fake-octa-coach.app/app</p>
          </div>
          <div ref={desktopBox} className="desktop__viewport" style={{ height: DESKTOP_H * scale }}>
            <iframe
              key={`desktop-${frameKey}`}
              src="/app"
              title="Fake OCTA Coach web account"
              style={{ width: DESKTOP_W, height: DESKTOP_H, transform: `scale(${scale})` }}
            />
          </div>
          <figcaption>Web account (desktop)</figcaption>
        </figure>
      </div>
    </div>
  )
}
