/**
 * Integration Module Index
 * Re-exports all integration-related functionality
 */

// Registry
export {
  INTEGRATIONS,
  CATEGORIES,
  getIntegration,
  getIntegrationsByCategory,
  getIntegrationsWithApi,
  getIntegrationsWithBrowserOnly,
  getIntegrationByCapability,
  getAllCapabilities,
  searchIntegrations,
  type IntegrationConfig,
  type ApiProvider,
  type AuthType,
  type IntegrationCapability,
} from './registry';

// Router
export {
  routeIntegrationTask,
  routeTask,
  routeTasks,
  requiresBrowser,
  shouldFallbackToBrowser,
  detectIntegration,
  type RoutingDecision,
  type RoutingContext,
  type RoutingMethod,
} from './router';

// Status
export {
  getIntegrationStatus,
  getIntegrationCounts,
  getSimpleStatus,
  isIntegrationAvailable,
  getRequiredSetup,
  getDashboardStatus,
  isIntegrationConnected,
  getIntegrationConnectionType,
  getStatusMessage,
  type IntegrationStatus,
  type ApiConnectionStatus,
  type BrowserSessionStatus,
  type IntegrationCounts,
} from './status';

// Messages
export {
  getIntegrationIntroMessage,
  getIntegrationIntroShort,
  getApiFallbackMessage,
  getBrowserRequiredMessage,
  getSetupRequiredMessage,
  getMethodExplanation,
  getCapabilityMessage,
  getSuggestionMessage,
  formatIntegrationList,
  getIntegrationHelpMessage,
  getBrowserProgressMessage,
  getErrorRecoveryMessage,
} from './messages';

// Resolver
export {
  resolveIntegration,
  resolveFromText,
  parseServicesFromText,
  type ResolvedIntegration,
} from './resolver';
