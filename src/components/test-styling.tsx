'use client'

/**
 * Test component to verify CSS and styling is working properly
 * This component can be temporarily added to any page to test styling
 */
export function TestStyling() {
  return (
    <div className="p-8 space-y-6">
      <h2 className="text-2xl font-bold text-foreground">CSS Test Component</h2>
      
      {/* Test basic Tailwind classes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="font-semibold text-card-foreground">Primary Card</h3>
          <p className="text-muted-foreground">This tests basic card styling</p>
          <button className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
            Primary Button
          </button>
        </div>
        
        <div className="bg-secondary p-4 rounded-lg">
          <h3 className="font-semibold text-secondary-foreground">Secondary Card</h3>
          <p className="text-muted-foreground">This tests secondary styling</p>
          <button className="mt-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90">
            Secondary Button
          </button>
        </div>
        
        <div className="bg-muted p-4 rounded-lg">
          <h3 className="font-semibold text-foreground">Muted Card</h3>
          <p className="text-muted-foreground">This tests muted styling</p>
          <button className="mt-2 px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90">
            Accent Button
          </button>
        </div>
      </div>
      
      {/* Test custom CSS classes */}
      <div className="space-y-4">
        <div className="risk-safe p-3 rounded border">
          Safe Risk Indicator
        </div>
        <div className="risk-caution p-3 rounded border">
          Caution Risk Indicator
        </div>
        <div className="risk-danger p-3 rounded border">
          Danger Risk Indicator
        </div>
      </div>
      
      {/* Test capability badges */}
      <div className="flex flex-wrap gap-2">
        <span className="capability-security px-3 py-1 rounded-full text-sm border">Security</span>
        <span className="capability-code px-3 py-1 rounded-full text-sm border">Code</span>
        <span className="capability-analysis px-3 py-1 rounded-full text-sm border">Analysis</span>
        <span className="capability-design px-3 py-1 rounded-full text-sm border">Design</span>
        <span className="capability-data px-3 py-1 rounded-full text-sm border">Data</span>
      </div>
      
      {/* Test animations */}
      <div className="flex gap-4">
        <div className="animate-pulse-slow bg-primary/20 p-4 rounded">
          Pulse Animation
        </div>
        <div className="animate-float bg-secondary/20 p-4 rounded">
          Float Animation
        </div>
      </div>
      
      {/* Test gradient */}
      <div className="gradient-bg p-6 rounded-lg text-white">
        <h3 className="font-bold">Gradient Background</h3>
        <p>This tests the custom gradient background</p>
      </div>
      
      {/* Test glass effect */}
      <div className="glass-effect p-6 rounded-lg">
        <h3 className="font-bold">Glass Effect</h3>
        <p>This tests the glass morphism effect</p>
      </div>
    </div>
  )
}