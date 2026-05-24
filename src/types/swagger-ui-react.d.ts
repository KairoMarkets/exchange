declare module 'swagger-ui-react' {
  import { ComponentType } from 'react'

  export interface SwaggerUIProps {
    spec?: any
    url?: string
    onComplete?: (system: any) => void
    requestInterceptor?: (request: any) => any
    responseInterceptor?: (response: any) => any
    onFailure?: (error: any) => void
    docExpansion?: 'list' | 'full' | 'none'
    defaultModelsExpandDepth?: number
    defaultModelExpandDepth?: number
    defaultModelRendering?: 'example' | 'model'
    displayOperationId?: boolean
    displayRequestDuration?: boolean
    deepLinking?: boolean
    filter?: boolean | string
    layout?: string
    plugins?: any[]
    presets?: any[]
    showExtensions?: boolean
    showCommonExtensions?: boolean
    tryItOutEnabled?: boolean
    supportedSubmitMethods?: string[]
    validatorUrl?: string | null
    withCredentials?: boolean
    persistAuthorization?: boolean
    oauth2RedirectUrl?: string
    requestSnippetsEnabled?: boolean
    requestSnippets?: any
    syntaxHighlight?: {
      activated?: boolean
      theme?: string
    }
    [key: string]: any
  }

  const SwaggerUI: ComponentType<SwaggerUIProps>
  export default SwaggerUI
}