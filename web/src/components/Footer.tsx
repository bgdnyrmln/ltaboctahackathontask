import { footer, nav } from '../content/landing'
import { useT } from '../i18n'
import { Logo } from './Logo'

export function Footer() {
  const t = useT()
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <Logo light />
        <nav aria-label={t('Footer')}>
          <ul className="site-footer__nav">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{t(item.label)}</a>
              </li>
            ))}
            <li>
              <a href="/insurer">{t('For insurers')}</a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="container">
        <p className="site-footer__disclaimer">{t(footer.disclaimer)}</p>
        <p className="site-footer__credit">{t(footer.credit)}</p>
      </div>
    </footer>
  )
}
