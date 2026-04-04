'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  FileSearch, 
  Database, 
  Brain, 
  Shield, 
  CheckCircle,
  Clock
} from 'lucide-react'

interface ScanningProgressProps {
  isScanning: boolean
  onComplete?: () => void
}

interface ScanStep {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  duration: number // in milliseconds
}

const scanSteps: ScanStep[] = [
  {
    id: 'parsing',
    label: 'Parsing Transaction',
    description: 'Analyzing transaction structure and instructions',
    icon: FileSearch,
    duration: 300
  },
  {
    id: 'patterns',
    label: 'Pattern Matching',
    description: 'Checking against 10M+ known exploit patterns',
    icon: Database,
    duration: 400
  },
  {
    id: 'ml-analysis',
    label: 'AI Analysis',
    description: 'Running ML models for anomaly detection',
    icon: Brain,
    duration: 800
  },
  {
    id: 'risk-assessment',
    label: 'Risk Assessment',
    description: 'Calculating final risk score and recommendations',
    icon: Shield,
    duration: 300
  }
]

export function ScanningProgress({ isScanning, onComplete }: ScanningProgressProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [startTime, setStartTime] = useState<number | null>(null)

  useEffect(() => {
    if (!isScanning) {
      setCurrentStep(0)
      setProgress(0)
      setCompletedSteps(new Set())
      setStartTime(null)
      return
    }

    setStartTime(Date.now())
    let stepIndex = 0
    let stepProgress = 0

    const interval = setInterval(() => {
      if (stepIndex >= scanSteps.length) {
        setProgress(100)
        setCompletedSteps(new Set(scanSteps.map(step => step.id)))
        clearInterval(interval)
        setTimeout(() => {
          onComplete?.()
        }, 200)
        return
      }

      const currentStepData = scanSteps[stepIndex]
      const stepDuration = currentStepData.duration
      const increment = 100 / (stepDuration / 50) // Update every 50ms

      stepProgress += increment

      if (stepProgress >= 100) {
        // Complete current step
        setCompletedSteps(prev => new Set([...prev, currentStepData.id]))
        stepIndex++
        stepProgress = 0
        setCurrentStep(stepIndex)
      }

      // Calculate overall progress
      const overallProgress = ((stepIndex * 100) + stepProgress) / scanSteps.length
      setProgress(Math.min(overallProgress, 100))
    }, 50)

    return () => clearInterval(interval)
  }, [isScanning, onComplete])

  const getElapsedTime = () => {
    if (!startTime) return 0
    return Date.now() - startTime
  }

  if (!isScanning) return null

  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
              <h3 className="text-lg font-semibold text-red-800">
                Scanning Transaction for Threats
              </h3>
            </div>
            <p className="text-sm text-red-600">
              Kairo Execution Auditor is analyzing your transaction for security risks
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-red-700">Progress</span>
              <span className="text-red-700 font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress 
              value={progress} 
              className="h-3 bg-red-100"
            />
            <div className="flex justify-between text-xs text-red-600">
              <span>Starting scan...</span>
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{(getElapsedTime() / 1000).toFixed(1)}s</span>
              </div>
            </div>
          </div>

          {/* Step Progress */}
          <div className="space-y-3">
            {scanSteps.map((step, index) => {
              const isCompleted = completedSteps.has(step.id)
              const isCurrent = index === currentStep && !isCompleted
              const isPending = index > currentStep

              const Icon = step.icon

              return (
                <div 
                  key={step.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-green-50 border border-green-200' 
                      : isCurrent 
                      ? 'bg-blue-50 border border-blue-200' 
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className={`flex-shrink-0 mt-0.5 ${
                    isCompleted 
                      ? 'text-green-600' 
                      : isCurrent 
                      ? 'text-blue-600' 
                      : 'text-gray-400'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Icon className={`h-5 w-5 ${isCurrent ? 'animate-pulse' : ''}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className={`font-medium ${
                        isCompleted 
                          ? 'text-green-800' 
                          : isCurrent 
                          ? 'text-blue-800' 
                          : 'text-gray-600'
                      }`}>
                        {step.label}
                      </h4>
                      {isCompleted && (
                        <span className="text-xs text-green-600 font-medium">
                          Complete
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-xs text-blue-600 font-medium">
                          Processing...
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${
                      isCompleted 
                        ? 'text-green-600' 
                        : isCurrent 
                        ? 'text-blue-600' 
                        : 'text-gray-500'
                    }`}>
                      {step.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Security Notice */}
          <div className="bg-red-100 border border-red-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <Shield className="h-4 w-4 text-red-600 mt-0.5" />
              <div className="text-sm text-red-700">
                <p className="font-medium mb-1">Security Analysis in Progress</p>
                <p>
                  We&apos;re checking your transaction against Kairo&apos;s exploit intelligence layer
                  and running advanced AI models to detect potential threats.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}