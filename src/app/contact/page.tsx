import { Mail, Twitter } from 'lucide-react'

export default function ContactPage() {
  return (
    <div className="container py-16">
      <div className="max-w-xl mx-auto">
        <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-3">Contact</p>
        <h1 className="text-4xl font-bold mb-4">Get in Touch</h1>
        <p className="text-muted-foreground text-lg mb-10">
          For support, seller inquiries, or partnership questions — reach out directly.
        </p>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/8 bg-black/20 p-5 flex items-start gap-4">
            <div className="p-2.5 bg-emerald-500/10 rounded-lg flex-shrink-0">
              <Mail className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Email</h3>
              <p className="text-sm text-muted-foreground mb-2">General support and seller inquiries</p>
              <a href="mailto:support@kairo.markets" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                support@kairo.markets
              </a>
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-black/20 p-5 flex items-start gap-4">
            <div className="p-2.5 bg-emerald-500/10 rounded-lg flex-shrink-0">
              <Twitter className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">X (Twitter)</h3>
              <p className="text-sm text-muted-foreground mb-2">Follow for agent economy updates and launches</p>
              <a href="https://x.com/KairoMarkets" target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                @KairoMarkets
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
