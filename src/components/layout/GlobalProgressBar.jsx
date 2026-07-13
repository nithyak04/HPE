export default function GlobalProgressBar({ percent }) {
  return (
    <div className="global-progress-track print-hide" aria-hidden="true">
      <div className="global-progress-fill" style={{ width: `${percent}%` }} />
    </div>
  )
}
