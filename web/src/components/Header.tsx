import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { brand, nav } from '../content/landing'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { Logo } from './Logo'

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { canInstall, install } = useInstallPrompt()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const solid = scrolled || menuOpen

  return (
    <header className={`site-header${solid ? ' site-header--solid' : ''}`}>
      <div className="container site-header__inner">
        <Link to="/" className="site-header__logo" aria-label={`${brand.name} home`}>
          <Logo light={!solid} />
        </Link>

        <div className="site-header__actions">
          {canInstall && (
            <button type="button" className="btn btn--pill btn--cyan" onClick={install}>
              Install app
            </button>
          )}
          <a href="#score" className="btn btn--pill btn--outline-light site-header__demo">
            Try demo
          </a>
          <button
            type="button"
            className="site-header__menu-btn"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="site-header__burger" aria-hidden="true" />
            Menu
          </button>
        </div>
      </div>

      <nav id="site-menu" className="site-menu" hidden={!menuOpen} aria-label="Main">
        <ul className="container">
          {nav.map((item) => (
            <li key={item.href}>
              <a href={item.href} onClick={() => setMenuOpen(false)}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
