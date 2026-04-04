'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  TrendingUp,
  Eye,
  AlertCircle
} from 'lucide-react'

export interface RiskAnalysis {
  riskLevel: 'SAFE' | 'CAUTION' | 'DANGER'
  riskScore: number
  confidence: number
  explanation: string
  recommendation: string
  scanTime: number
  details: {
    patternMatches: PatternMatch[]
    mlAnalysis: MLAnalysis
    accountFlags: AccountFlag[]
    programAnalysis: ProgramAnalysis[]
  }
  scanMetadata: {
    scanId: string
    timestamp: string
    processingTimeMs: number
    modelVersion: string
  }
}

export interface PatternMatch {
  patternId: string
  patternType: string
  severity: number
  description: string
  evidence: Record<string, any>
  confidence: number
}

export interface MLAnalysis {
  anomalyScore: number
  classification: string
  confidence: number
  featureImportance: Record<string, number>
  modelVersion: string
}

export interface AccountFlag {
  accountAddress: string
  flagType: string
  severity: number
  description: string
  evidence: Record<string, any>
}

export interface ProgramAnalysis {
  programId: string
  programName?: string
  isVerified: boolean
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
}

interface RiskVisualizationProps {
  analysis: RiskAnalysis
  onDetailsToggle?: (expanded: boolean) => void
}

export function RiskVisualization({ analysis, onDetailsToggle }: RiskVisualizationProps) {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'SAFE': 
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-800',
          icon: 'text-green-600'
        }
      case 'CAUTION': 
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200', 
          text: 'text-orange-800',
          icon: 'text-orange-600'
        }
      case 'DANGER': 
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800', 
          icon: 'text-red-600'
        }
      default: 
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-800',
          icon: 'text-gray-600'
        }
    }
  }

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'SAFE': return CheckCircle
      case 'CAUTION': return AlertTriangle
      case 'DANGER': return XCircle
      default: return AlertCircle
    }
  }

  const colors = getRiskColor(analysis.riskLevel)
  const RiskIcon = getRiskIcon(analysis.riskLevel)

  return (
    <div className="space-y-4">
      {/* Main Risk Assessment */}
      <Alert className={`${colors.bg} ${colors.border} ${colors.text}`}>
        <div className="flex items-start space-x-3">
          <RiskIcon className={`h-6 w-6 mt-0.5 ${colors.icon}`} />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <Badge 
                  variant={analysis.riskLevel === 'DANGER' ? 'destructive' : 'secondary'}
                  className="text-sm font-bold"
                >
                  {analysis.riskLevel}
                </Badge>
                <div className="flex items-center space-x-2 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  <span>Risk Score: {analysis.riskScore}/100</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Eye className="h-4 w-4" />
                  <span>Confidence: {Math.round(analysis.confidence * 100)}%</span>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                <span>Scanned in {analysis.scanTime}ms</span>
              </div>
            </div>
            
            <AlertDescription className="mb-3 text-base">
              <strong>Analysis:</strong> {analysis.explanation}
            </AlertDescription>
            
            <AlertDescription className="text-base">
              <strong>Recommendation:</strong> {analysis.recommendation}
            </AlertDescription>
          </div>
        </div>
      </Alert>

      {/* Risk Score Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Risk Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Risk Score Bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Overall Risk Score</span>
                <span className="font-bold">{analysis.riskScore}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 ${
                    analysis.riskScore >= 70 ? 'bg-red-500' :
                    analysis.riskScore >= 30 ? 'bg-orange-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(analysis.riskScore, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Safe (0-29)</span>
                <span>Caution (30-69)</span>
                <span>Danger (70-100)</span>
              </div>
            </div>

            {/* ML Analysis Score */}
            {analysis.details.mlAnalysis && (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>AI Anomaly Detection</span>
                  <span className="font-bold">
                    {Math.round(analysis.details.mlAnalysis.anomalyScore * 100)}/100
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${analysis.details.mlAnalysis.anomalyScore * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Pattern Matches */}
            {analysis.details.patternMatches.length > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Known Threat Patterns</span>
                  <span className="font-bold text-red-600">
                    {analysis.details.patternMatches.length} matches
                  </span>
                </div>
                <div className="space-y-2">
                  {analysis.details.patternMatches.slice(0, 3).map((match, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded">
                      <div>
                        <span className="text-sm font-medium">{match.patternType}</span>
                        <p className="text-xs text-gray-600">{match.description}</p>
                      </div>
                      <Badge variant="destructive" className="text-xs">
                        Severity {match.severity}
                      </Badge>
                    </div>
                  ))}
                  {analysis.details.patternMatches.length > 3 && (
                    <p className="text-xs text-gray-500 text-center">
                      +{analysis.details.patternMatches.length - 3} more patterns detected
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Program Analysis */}
      {analysis.details.programAnalysis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Program Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.details.programAnalysis.map((program, index) => (
                <div key={index} className="flex items-start justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {program.programId.slice(0, 8)}...{program.programId.slice(-8)}
                      </code>
                      {program.programName && (
                        <span className="text-sm font-medium">{program.programName}</span>
                      )}
                      {program.isVerified && (
                        <Badge variant="secondary" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{program.description}</p>
                  </div>
                  <Badge 
                    variant={
                      program.riskLevel === 'CRITICAL' || program.riskLevel === 'HIGH' 
                        ? 'destructive' 
                        : program.riskLevel === 'MEDIUM' 
                        ? 'secondary' 
                        : 'outline'
                    }
                    className="text-xs"
                  >
                    {program.riskLevel}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Flags */}
      {analysis.details.accountFlags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.details.accountFlags.map((flag, index) => (
                <div key={index} className="flex items-start justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {flag.accountAddress.slice(0, 8)}...{flag.accountAddress.slice(-8)}
                      </code>
                      <span className="text-sm font-medium">{flag.flagType}</span>
                    </div>
                    <p className="text-sm text-gray-600">{flag.description}</p>
                  </div>
                  <Badge 
                    variant={flag.severity >= 7 ? 'destructive' : flag.severity >= 4 ? 'secondary' : 'outline'}
                    className="text-xs"
                  >
                    Severity {flag.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan Metadata */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">Scan ID</p>
              <p className="text-sm font-mono">{analysis.scanMetadata.scanId.slice(0, 8)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Processing Time</p>
              <p className="text-sm font-medium">{analysis.scanMetadata.processingTimeMs}ms</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Model Version</p>
              <p className="text-sm font-medium">{analysis.scanMetadata.modelVersion}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Timestamp</p>
              <p className="text-sm font-medium">
                {new Date(analysis.scanMetadata.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}