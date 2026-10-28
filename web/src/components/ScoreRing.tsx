const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ScoreRing({ score, label }: { score: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, score))
  const offset = CIRCUMFERENCE * (1 - clamped / 100)

  return (
    <figure className="score-ring" aria-label={`Driving score ${clamped} out of 100. ${label}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={RADIUS} className="score-ring__track" />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          className="score-ring__value"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <figcaption>
        <span className="score-ring__number">{clamped}</span>
        <span className="score-ring__max">/100</span>
        <span className="score-ring__label">{label}</span>
      </figcaption>
    </figure>
  )
}
