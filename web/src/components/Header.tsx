import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { brand, nav } from '../content/landing'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { LangSwitch, useT } from '../i18n'
import { Logo } from './Logo'

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { canInstall, install } = useInstallPrompt()
  const t = useT()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Full-screen mobile menu: lock page scroll and close on Escape or when resized to desktop.
  useEffect(() => {
    if (!menuOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    const desktop = window.matchMedia('(min-width: 1200px)')
    const onDesktop = () => desktop.matches && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    desktop.addEventListener('change', onDesktop)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
      desktop.removeEventListener('change', onDesktop)
    }
  }, [menuOpen])

  const solid = scrolled || menuOpen
  const closeMenu = () => setMenuOpen(false)

  return (
    <header className={`site-header${solid ? ' site-header--solid' : ''}${menuOpen ? ' site-header--menu-open' : ''}`}>
      <div className="container site-header__inner">
        <Link to="/" className="site-header__logo" aria-label={t('{name} home', { name: brand.name })} onClick={closeMenu}>
          <Logo light={!solid} />
        </Link>

        <nav className="site-nav" aria-label={t('Main')}>
          <ul>
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{t(item.label)}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-header__actions">
          {canInstall && (
            <button type="button" className="btn btn--pill btn--cyan" onClick={install}>
              {t('Install app')}
            </button>
          )}
          <Link to="/insurer" className="btn btn--pill btn--outline-light site-header__insurer">
            {t('For insurers')}
          </Link>
          <Link to="/login" className="btn btn--pill btn--outline-light site-header__demo">
            {t('Try demo')}
          </Link>
          <LangSwitch />
          <button
            type="button"
            className="site-header__menu-btn"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="site-header__burger" aria-hidden="true" />
            {menuOpen ? t('Close') : t('Menu')}
          </button>
        </div>
      </div>

      <nav id="mobile-menu" className={`mobile-menu${menuOpen ? ' is-open' : ''}`} aria-label={t('Main')} inert={!menuOpen}>
        <ul className="container">
          {nav.map((item, index) => (
            <li key={item.href} style={{ '--i': index } as React.CSSProperties}>
              <a href={item.href} onClick={closeMenu}>
                {t(item.label)}
              </a>
            </li>
          ))}
        </ul>
        <div className="container mobile-menu__footer">
          <Link to="/login" className="btn btn--primary" onClick={closeMenu}>
            {t('Try demo')}
          </Link>
          <Link to="/insurer" className="btn btn--outline" onClick={closeMenu}>
            {t('For insurers')}
          </Link>
        </div>
      </nav>
    </header>
  )
}
