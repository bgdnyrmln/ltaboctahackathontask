import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { KpiIcon } from '../components/KpiIcon'
import { ScoreRing } from '../components/ScoreRing'
import { hero, kpiSection, privacy, scorePreview, steps } from '../content/landing'
import { useT } from '../i18n'
import './Landing.css'

// Balcia-style section: title column with a cyan rule on the left, content on the right.
function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string
  title: string
  subtitle?: string
  children: ReactNode
}) {
  const t = useT()
  return (
    <section id={id} className="section" aria-labelledby={`${id}-title`}>
      <div className="container section__inner">
        <div className="section__head">
          <h2 id={`${id}-title`} className="section__title">
            {t(title)}
          </h2>
          {subtitle && <p className="section__subtitle">{t(subtitle)}</p>}
        </div>
        <div className="section__body">{children}</div>
      </div>
    </section>
  )
}

function Hero() {
  const t = useT()
  return (
    <section className="hero" aria-labelledby="hero-title">
      <svg className="hero__art" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path d="M-80 760C260 520 420 860 760 640S1220 300 1520 420V900H-80Z" fill="#ff8a5c" opacity=".55" />
        <path d="M980 -60c180 120 120 300 300 380s240-40 240-40V-60Z" fill="#ffd4b5" opacity=".35" />
        <path
          d="M560 900C640 700 820 640 900 500S1000 220 1140 120"
          fill="none"
          stroke="#fff"
          strokeOpacity=".22"
          strokeWidth="90"
          strokeLinecap="round"
        />
        <path
          d="M560 900C640 700 820 640 900 500S1000 220 1140 120"
          fill="none"
          stroke="#fff"
          strokeOpacity=".7"
          strokeWidth="4"
          strokeDasharray="28 30"
        />
      </svg>

      <div className="container hero__inner">
        <div className="hero__actions">
          <Link to={hero.primaryCta.href} className="btn btn--primary">
            {t(hero.primaryCta.label)}
          </Link>
          <a href={hero.secondaryCta.href} className="btn btn--outline-light">
            {t(hero.secondaryCta.label)}
          </a>
        </div>

        <div className="hero__copy">
          <h1 id="hero-title" className="hero__title">
            {hero.lines.map((line) => (
              <span key={line.text} className={line.outlined ? 'hero__line hero__line--outlined' : 'hero__line'}>
                {t(line.text)}
              </span>
            ))}
          </h1>
          <p className="hero__lead">{t(hero.lead)}</p>
        </div>
      </div>
    </section>
  )
}

function Kpis() {
  const t = useT()
  return (
    <Section id="kpis" title={kpiSection.title} subtitle={kpiSection.subtitle}>
      <ul className="kpi-grid">
        {kpiSection.kpis.map((kpi) => (
          <li key={kpi.title} className="kpi-card">
            <div className="kpi-card__media">
              <KpiIcon name={kpi.icon} />
            </div>
            <h3 className="kpi-card__title">{t(kpi.title)}</h3>
            <p className="kpi-card__unit">{t(kpi.unit)}</p>
            <div className="kpi-card__row">
              <p className="kpi-card__value">
                {kpi.value}
                {kpi.decimals && `.${kpi.decimals}`}
                <span className="kpi-card__suffix">{kpi.suffix}</span>
              </p>
              <p className="kpi-card__note">{t(kpi.note)}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="section__footnote">{t('Sample values. Final KPIs and weights are being agreed by the team.')}</p>
    </Section>
  )
}

function Steps() {
  const t = useT()
  return (
    <section id="how-it-works" className="band" aria-labelledby="steps-title">
      <div className="container">
        <h2 id="steps-title" className="band__title">
          {steps.title.map((line) => (
            <span key={line}>{t(line)}</span>
          ))}
        </h2>
        <ol className="steps">
          {steps.items.map((step, index) => (
            <li key={step.title} className="steps__item">
              <span className="steps__number" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="steps__title">{t(step.title)}</h3>
              <p className="steps__detail">{t(step.detail)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Score() {
  const t = useT()
  return (
    <Section id="score" title={scorePreview.title} subtitle={scorePreview.subtitle}>
      <div className="score-grid">
        <article className="score-card">
          <ScoreRing score={scorePreview.score} label={t(scorePreview.scoreLabel)} />
          <ul className="factors" aria-label={t('Top factors')}>
            {scorePreview.factors.map((factor) => (
              <li key={factor.label} className={`factors__item factors__item--${factor.impact}`}>
                <span className="factors__sign" aria-hidden="true">
                  {factor.impact === 'positive' ? '+' : '−'}
                </span>
                <span>
                  <span className="visually-hidden">{factor.impact === 'positive' ? t('Helps: ') : t('Hurts: ')}</span>
                  {t(factor.label)}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <div className="score-side">
          <article className="tip-card">
            <h3 className="tip-card__title">{t(scorePreview.tip.title)}</h3>
            <p>{t(scorePreview.tip.body)}</p>
          </article>
          <article className="octa-card">
            <h3 className="octa-card__title">{t(scorePreview.octa.title)}</h3>
            <p className="octa-card__band">{t(scorePreview.octa.band)}</p>
            <div className="octa-card__scale" aria-hidden="true">
              <span />
              <span className="is-active" />
              <span />
              <span />
            </div>
            <p className="octa-card__disclaimer">{t(scorePreview.octa.disclaimer)}</p>
          </article>
        </div>
      </div>
    </Section>
  )
}

function Privacy() {
  const t = useT()
  return (
    <section id="privacy" className="why" aria-labelledby="privacy-title">
      <div className="container why__inner">
        <dl className="why__stats">
          {privacy.stats.map((stat) => (
            <div key={stat.label} className="why__stat">
              <dt className="why__value">{stat.value}</dt>
              <dd className="why__label">{t(stat.label)}</dd>
            </div>
          ))}
        </dl>
        <div className="why__copy">
          <h2 id="privacy-title" className="section__title">
            {t(privacy.title)}
          </h2>
          <p>{t(privacy.body)}</p>
          <a href="#score" className="btn btn--outline">
            {t('See a sample score')}
          </a>
        </div>
      </div>
    </section>
  )
}

export function Landing() {
  return (
    <>
      <Hero />
      <Kpis />
      <Steps />
      <Score />
      <Privacy />
    </>
  )
}
