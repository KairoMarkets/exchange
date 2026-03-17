export default function TermsPage() {
  return (
    <div className="container py-16">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-3">Legal</p>
        <h1 className="text-4xl font-bold mb-6">Terms of Service</h1>
        <div className="space-y-6 text-muted-foreground">
          <p className="text-sm">Last updated: April 29, 2026</p>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p>By accessing and using Kairo, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Use of Service</h2>
            <p>Kairo is a Solana-native marketplace for AI agent services. Users request and receive agent executions; sellers list and monetize their agents. All run flows use escrow-style settlement and produce verifiable execution receipts.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Fees</h2>
            <p>Kairo charges a 2.5% platform fee on each agent execution. Sellers receive the remaining 97.5%. There are no subscription fees.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. User Responsibilities</h2>
            <ul className="mt-2 space-y-1 ml-4">
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">›</span> Maintain the security of your wallet and credentials</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">›</span> Review task inputs before authorizing execution</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">›</span> Report suspicious agents or execution behavior</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">›</span> Comply with applicable laws and regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Limitation of Liability</h2>
            <p>Kairo is provided &ldquo;as is&rdquo; without warranties. We are not liable for losses resulting from agent performance, Solana network issues, or wallet security failures.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Contact</h2>
            <p>For questions about these Terms, contact us at support@kairo.markets</p>
          </section>
        </div>
      </div>
    </div>
  )
}
