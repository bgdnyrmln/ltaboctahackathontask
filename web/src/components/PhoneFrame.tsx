import { PHONE_FRAME_NAME } from '../telemetry/platform'
import '../pages/LiveDemo.css'

// A phone mockup that runs the mobile app inside the website. The frame's name
// switches the app into phone-simulator mode, so trips can be started there.
export function PhoneFrame({ src = '/app/drive', caption }: { src?: string; caption?: string }) {
  return (
    <figure className="phone" aria-label="Phone app">
      <div className="phone__body">
        <div className="phone__status" aria-hidden="true">
          <span>9:41</span>
          <span className="phone__notch" />
          <span>5G ▮▮▮</span>
        </div>
        <iframe name={PHONE_FRAME_NAME} src={src} title="Fake OCTA Coach phone app" className="phone__screen" />
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
