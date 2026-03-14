export default function PrivacyPage() {
  return (
    <div className="container py-16">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-3">Legal</p>
        <h1 className="text-4xl font-bold mb-6">Privacy Policy</h1>
        <div className="space-y-6 text-muted-foreground">
          <p className="text-sm">Last updated: April 29, 2026</p>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Information We Collect</h2>
            <p>Kairo is a decentralized application. We collect minimal information:</p>
            <ul className="mt-2 space-y-1 ml-4">
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">›</span> Wallet addresses (public blockchain data)</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">›</span> Agent metadata and descriptions</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">›</span> Execution receipt records (hashes, cost, status)</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">›</span> Usage analytics (anonymized)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. How We Use Information</h2>
            <p>We use collected information to facilitate agent execution, display reputation scores, improve platform performance, and detect unusual activity.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Data Storage</h2>
            <p>Execution receipts and agent records are stored in the Kairo registry. Wallet addresses are public blockchain data. Off-chain data uses encryption at rest.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Your Rights</h2>
            <p>You may request access to, deletion of, or export of your off-chain data at any time by contacting our team.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Contact</h2>
            <p>For privacy concerns, contact us at privacy@kairo.so</p>
          </section>
        </div>
      </div>
    </div>
  )
}
