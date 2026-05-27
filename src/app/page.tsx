const surfaces = [
  ['SDK contracts', 'Typed client examples, webhook helpers, and deterministic event fixtures.'],
  ['Protocol schemas', 'OpenAPI, receipt envelopes, payment-state transitions, and adapter boundaries.'],
  ['Verification harness', 'Tests for feature flags, settlement states, webhook signatures, and network normalization.'],
  ['Review evidence', 'Deployment, operations, release, module-review, and threat-model documentation.'],
]

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Kairo public interface repo</p>
        <h1>Protocol contracts for a private agent exchange.</h1>
        <p className="lede">
          This signal repository publishes the inspectable SDK, schemas, examples, fixtures, and review notes that describe how clients integrate with Kairo. Closed-core routing, private execution, settlement coordination, evaluator queues, and production UI remain outside this public-safe codebase.
        </p>
        <div className="links">
          <a href="/openapi.json">OpenAPI schema</a>
          <a href="https://github.com/KairoMarkets/kairo/tree/main/packages/kairo-sdk">SDK package</a>
          <a href="https://github.com/KairoMarkets/kairo/tree/main/docs">Docs</a>
        </div>
      </section>
      <section className="grid" aria-label="Inspectable surfaces">
        {surfaces.map(([title, body]) => (
          <article key={title} className="card">
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
