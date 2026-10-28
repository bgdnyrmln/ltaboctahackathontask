import { useLayoutEffect, useRef, useState } from 'react'
import { PHONE_FRAME_NAME } from '../telemetry/platform'
import '../pages/LiveDemo.css'

const PHONE_W = 390
const PHONE_H = 800
const CAPTION_H = 36
const BOTTOM_GAP = 24
const MIN_SCALE = 0.55

// A phone mockup that runs the mobile app inside the website. The frame's name
// switches the app into phone-simulator mode, so trips can be started there.
// With `fit`, the whole phone scales down to fit the browser window height; the
// app inside keeps its real phone width, so its layout does not change.
export function PhoneFrame({
  src = '/app/drive',
  caption,
  fit = false,
}: {
  src?: string
  caption?: string
  fit?: boolean
}) {
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
    <figure className="phone" aria-label="Phone app">
      <div ref={box} className="phone__fit" style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
        <div className="phone__body" style={scale < 1 ? { transform: `scale(${scale})` } : undefined}>
          <div className="phone__status" aria-hidden="true">
            <span>9:41</span>
            <span className="phone__notch" />
            <span>5G ▮▮▮</span>
          </div>
          <iframe name={PHONE_FRAME_NAME} src={src} title="Fake OCTA Coach phone app" className="phone__screen" />
        </div>
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
