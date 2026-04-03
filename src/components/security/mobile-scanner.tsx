'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  Smartphone, 
  Camera,
  QrCode,
  Upload,
  Wallet,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

interface MobileScannerProps {
  onScanSubmit: (data: string, type: 'qr' | 'camera' | 'wallet') => void
  isScanning: boolean
}

export function MobileScanner({ onScanSubmit, isScanning }: MobileScannerProps) {
  const [scanMethod, setScanMethod] = useState<'qr' | 'camera' | 'wallet'>('qr')

  const handleQuickScan = (method: 'qr' | 'camera' | 'wallet') => {
    setScanMethod(method)
    
    // Simulate different scan methods
    switch (method) {
      case 'qr':
        // In real implementation, this would open QR scanner
        onScanSubmit('qr_scan_data_example', 'qr')
        break
      case 'camera':
        // In real implementation, this would open camera for transaction screenshot
        onScanSubmit('camera_ocr_data_example', 'camera')
        break
      case 'wallet':
        // In real implementation, this would connect to wallet
        onScanSubmit('wallet_connection_data', 'wallet')
        break
    }
  }

  return (
    <div className="space-y-4">
      {/* Mobile-First Scanner */}
      <Card className="border-red-200 bg-gradient-to-br from-red-50 to-orange-50">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center mb-2">
            <div className="p-3 bg-red-100 rounded-full">
              <Smartphone className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-xl text-red-800">
            Mobile Security Scanner
          </CardTitle>
          <p className="text-sm text-red-600">
            Scan transactions instantly on your mobile device
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Scan Methods */}
          <div className="grid grid-cols-1 gap-3">
            <Button
              onClick={() => handleQuickScan('qr')}
              disabled={isScanning}
              className="h-16 bg-red-600 hover:bg-red-700 text-white dark:text-white flex flex-col items-center justify-center space-y-1"
              size="lg"
            >
              <QrCode className="h-6 w-6" />
              <span className="text-sm font-medium">Scan QR Code</span>
              <span className="text-xs opacity-90">Point camera at transaction QR</span>
            </Button>

            <Button
              onClick={() => handleQuickScan('camera')}
              disabled={isScanning}
              variant="outline"
              className="h-16 border-red-200 hover:bg-red-50 flex flex-col items-center justify-center space-y-1"
              size="lg"
            >
              <Camera className="h-6 w-6 text-red-600" />
              <span className="text-sm font-medium text-red-700">Photo Scan</span>
              <span className="text-xs text-red-600">Take photo of transaction</span>
            </Button>

            <Button
              onClick={() => handleQuickScan('wallet')}
              disabled={isScanning}
              variant="outline"
              className="h-16 border-red-200 hover:bg-red-50 flex flex-col items-center justify-center space-y-1"
              size="lg"
            >
              <Wallet className="h-6 w-6 text-red-600" />
              <span className="text-sm font-medium text-red-700">Connect Wallet</span>
              <span className="text-xs text-red-600">Scan recent transactions</span>
            </Button>
          </div>

          {/* Scanning Status */}
          {isScanning && (
            <div className="bg-white rounded-lg p-4 border border-red-200">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                <div>
                  <p className="font-medium text-red-800">Scanning Transaction</p>
                  <p className="text-sm text-red-600">Analyzing for security threats...</p>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Tips */}
          <div className="bg-white rounded-lg p-4 border border-red-200">
            <h4 className="font-medium text-red-800 mb-2 flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              Mobile Security Tips
            </h4>
            <ul className="space-y-1 text-sm text-red-600">
              <li className="flex items-start">
                <CheckCircle className="h-3 w-3 mt-0.5 mr-2 text-green-600" />
                Always scan before signing transactions
              </li>
              <li className="flex items-start">
                <AlertTriangle className="h-3 w-3 mt-0.5 mr-2 text-orange-600" />
                Never ignore DANGER warnings
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-3 w-3 mt-0.5 mr-2 text-green-600" />
                Keep your wallet app updated
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats for Mobile */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">1,892</div>
            <div className="text-xs text-gray-600">Threats Blocked</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">1.8s</div>
            <div className="text-xs text-gray-600">Avg Scan Time</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}