import { footer, nav } from '../content/landing'
import { Logo } from './Logo'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <Logo light />
        <nav aria-label="Footer">
          <ul className="site-footer__nav">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="container">
        <p className="site-footer__disclaimer">{footer.disclaimer}</p>
        <p className="site-footer__credit">{footer.credit}</p>
      </div>
    </footer>
  )
}
