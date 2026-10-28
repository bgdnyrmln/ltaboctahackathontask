import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { onLiveTrip } from '../telemetry/liveChannel'
import { PHONE_FRAME_NAME } from '../telemetry/platform'
import { simulatedNow, type SimRun } from '../telemetry/simClock'
import './PhoneFrame.css'
import { useLang, useT } from '../i18n'

const PHONE_W = 390
const PHONE_H = 800
const CAPTION_H = 36
const BOTTOM_GAP = 24
const MIN_SCALE = 0.55

// A phone mockup that runs the mobile app inside the website. The frame's name
// switches the app into phone-simulator mode, so trips can be started there.
// With `fit`, the whole phone scales down to fit the browser window height; the
// app inside keeps its real phone width, so its layout does not change.
function PhoneClock() {
  const { lang } = useLang()
  const [now, setNow] = useState(() => Date.now())
  const run = useRef<SimRun | null>(null)

  // A simulated trip speeds the clock up for as long as the trip lasts, then it returns to real time.
  useEffect(
    () =>
      onLiveTrip((m) => {
        if (m.type === 'start') run.current = m.speed ? { at: m.at, speed: m.speed, durationSec: m.durationSec ?? Infinity } : null
        if (m.type === 'end') run.current = null
      }),
    [],
  )
  useEffect(() => {
    const id = window.setInterval(() => setNow(simulatedNow(run.current, Date.now())), 250)
    return () => window.clearInterval(id)
  }, [])

  return <span>{new Intl.DateTimeFormat(lang === 'lv' ? 'lv-LV' : 'en-GB', { hour: '2-digit', minute: '2-digit' }).format(now)}</span>
}

export function PhoneFrame({
  src = '/app/drive',
  caption,
  fit = false,
}: {
  src?: string
  caption?: string
  fit?: boolean
}) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    if (!fit) return
    const measure = () => {
      const el = box.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      const available = window.innerHeight - top - BOTTOM_GAP - (caption ? CAPTION_H : 0)
      setScale(Math.max(MIN_SCALE, Math.min(1, available / PHONE_H)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [fit, caption])

  return (
    <figure className="phone" aria-label={t('Phone app')}>
      <div ref={box} className="phone__fit" style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
        <div className="phone__body" style={scale < 1 ? { transform: `scale(${scale})` } : undefined}>
          <div className="phone__status" aria-hidden="true">
            <PhoneClock />
            <span className="phone__notch" />
            <span>5G ▮▮▮</span>
          </div>
          <iframe name={PHONE_FRAME_NAME} src={src} title={t('Fake OCTA Coach phone app')} className="phone__screen" />
        </div>
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
