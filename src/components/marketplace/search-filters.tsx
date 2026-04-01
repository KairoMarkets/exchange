'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { 
  Shield, 
  Code, 
  BarChart3, 
  Palette, 
  TrendingUp, 
  FileText,
  Filter,
  X
} from 'lucide-react'

interface SearchFiltersProps {
  selectedCapability: string | null
  onCapabilityChange: (capability: string | null) => void
  sortBy: string
  onSortChange: (sortBy: string) => void
}

const capabilities = [
  { name: 'Security', icon: Shield, count: 12 },
  { name: 'Code Generation', icon: Code, count: 8 },
  { name: 'Data Analysis', icon: BarChart3, count: 15 },
  { name: 'Design', icon: Palette, count: 6 },
  { name: 'DeFi', icon: TrendingUp, count: 9 },
  { name: 'Content Writing', icon: FileText, count: 11 },
]

const sortOptions = [
  { value: 'rating', label: 'Highest Rated' },
  { value: 'services', label: 'Most Popular' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
]

export function SearchFilters({
  selectedCapability,
  onCapabilityChange,
  sortBy,
  onSortChange,
}: SearchFiltersProps) {
  const clearFilters = () => {
    onCapabilityChange(null)
    onSortChange('rating')
  }

  const hasActiveFilters = selectedCapability !== null || sortBy !== 'rating'

  return (
    <Card className="sticky top-24">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters
          </CardTitle>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Sort By */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Sort By</Label>
          <RadioGroup value={sortBy} onValueChange={onSortChange}>
            {sortOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={option.value} />
                <Label 
                  htmlFor={option.value} 
                  className="text-sm font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Separator />

        {/* Capabilities */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Capabilities</Label>
          <div className="space-y-2">
            {capabilities.map((capability) => {
              const Icon = capability.icon
              const isSelected = selectedCapability === capability.name
              
              return (
                <div
                  key={capability.name}
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => 
                    onCapabilityChange(isSelected ? null : capability.name)
                  }
                >
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      checked={isSelected}
                      onChange={() => {}}
                      className="pointer-events-none"
                    />
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{capability.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {capability.count}
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>

        <Separator />

        {/* Price Range */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Price Range (SOL)</Label>
          <div className="px-2">
            <Slider
              defaultValue={[0, 1]}
              max={1}
              min={0}
              step={0.01}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>0 SOL</span>
              <span>1+ SOL</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Rating Filter */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Minimum Rating</Label>
          <div className="space-y-2">
            {[4.5, 4.0, 3.5, 3.0].map((rating) => (
              <div key={rating} className="flex items-center space-x-2">
                <Checkbox id={`rating-${rating}`} />
                <Label 
                  htmlFor={`rating-${rating}`} 
                  className="text-sm font-normal cursor-pointer flex items-center"
                >
                  {rating}+ ⭐
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Response Time */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Response Time</Label>
          <div className="space-y-2">
            {[
              { label: 'Under 5 seconds', value: '5s' },
              { label: 'Under 30 seconds', value: '30s' },
              { label: 'Under 1 minute', value: '1m' },
              { label: 'Under 5 minutes', value: '5m' },
            ].map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox id={`time-${option.value}`} />
                <Label 
                  htmlFor={`time-${option.value}`} 
                  className="text-sm font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Agent Status */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Status</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="active" defaultChecked />
              <Label htmlFor="active" className="text-sm font-normal cursor-pointer">
                Active agents only
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="verified" />
              <Label htmlFor="verified" className="text-sm font-normal cursor-pointer">
                Verified sellers
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}