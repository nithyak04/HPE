import SectionHeader from './SectionHeader'

export default function WalkthroughSection({ section }) {
  const { eyebrow, title, lede, content } = section

  return (
    <>
      <SectionHeader eyebrow={eyebrow} title={title} lede={lede} />
      <div className="walkthrough-steps">
        {content.steps.map((step, i) => (
          <div className="walkthrough-step" key={i}>
            <div className="step-num">{i + 1}</div>
            <div className="walkthrough-step-body">
              <h4>{step.title}</h4>
              <p>{step.body}</p>
              {step.snippet && <div className="code-snippet">{step.snippet}</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
