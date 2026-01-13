import { type AgentData, type ConnectionData, type IntegrationData, sdk } from '../sdk';
import type { MarketrixConfig } from '../types';
import { extractApiData, handleApiError, isValidApiResponse } from '../utils/apiUtils';
import { isAgentData, isConnectionData, isIntegrationDataArray } from '../utils/validation';

export interface WidgetValidationResult {
  isValid: boolean;
  error?: string;
  integration?: IntegrationData;
  agent?: AgentData;
  connection?: ConnectionData;
  urlGuideMessage?: string | string[]; // URL guide message(s) when exact URL match is found
}

/**
 * WidgetValidationService
 *
 * Validates widget configuration by checking:
 * 1. Integration exists (via marketrix_id and marketrix_key) OR
 * 2. Agent ID and Connection ID exist and match
 */
export class WidgetValidationService {
  private config?: MarketrixConfig;

  /**
   * Validate widget configuration
   * Handles both mtxId+mtxKey and mtxApp+mtxAgent cases
   */
  async validateConfig(config: MarketrixConfig): Promise<WidgetValidationResult> {
    this.config = config;
    if (config.mtxId && config.mtxKey) {
      return this.validateByMarketrixId(config.mtxId, config.mtxKey);
    }
    if (config.mtxApp && config.mtxAgent) {
      return this.validateByAgentAndConnection(config.mtxApp, config.mtxAgent);
    }
    return {
      isValid: false,
      error: 'Please provide either (mtxId + mtxKey) OR (mtxApp + mtxAgent)',
    };
  }

  /**
   * Validate by mtxId and mtxKey
   */
  private async validateByMarketrixId(mtxId: string, mtxKey: string): Promise<WidgetValidationResult> {
    try {
      // Step 1: Fetch integration by marketrix_id and marketrix_key
      console.log('Validating widget - fetching integration...', { mtxId, mtxKey });

      const integrationResponse = await sdk.integrationSearch({
        query: {
          marketrix_id: mtxId,
          marketrix_key: mtxKey,
        },
      });

      if (!isValidApiResponse(integrationResponse)) {
        return {
          isValid: false,
          error: 'Integration not found or invalid credentials',
        };
      }

      const integrationsData = extractApiData(integrationResponse);
      if (!integrationsData || !isIntegrationDataArray(integrationsData)) {
        return {
          isValid: false,
          error: 'Invalid integration data format',
        };
      }

      const integrations = integrationsData;

      // Debug: Log what integrations were found
      console.log(
        'Found integrations:',
        integrations.length,
        integrations.map(i => ({
          id: i.id,
          type: i.type,
          status: i.status,
          marketrix_id: i.marketrix_id,
        })),
      );

      // Find the widget integration
      const widgetIntegration = integrations.find(
        (integration: IntegrationData) => integration.type === 'widget' && integration.status === 'active',
      );

      if (!widgetIntegration) {
        // Check if there are any widget integrations with different status
        const widgetIntegrations = integrations.filter((integration: IntegrationData) => integration.type === 'widget');

        if (widgetIntegrations.length > 0) {
          const statuses = widgetIntegrations.map(i => i.status).join(', ');
          return {
            isValid: false,
            error: `Found widget integration(s) but none are active. Current status(es): ${statuses}. Please activate the integration in the dashboard.`,
          };
        }

        // Check if there are any integrations at all
        if (integrations.length === 0) {
          return {
            isValid: false,
            error:
              'No integrations found for the provided marketrix_id and marketrix_key. Please verify your credentials.',
          };
        }

        // There are integrations but no widget type
        const types = integrations.map(i => i.type).join(', ');
        return {
          isValid: false,
          error: `No widget integration found. Found integration type(s): ${types}. Please create a widget integration.`,
        };
      }

      // Step 2: Validate agent ID exists
      if (!widgetIntegration.agent_id) {
        return {
          isValid: false,
          error: 'Integration missing agent_id',
          integration: widgetIntegration,
        };
      }

      console.log('Validating agent ID...', widgetIntegration.agent_id);

      try {
        const agentResponse = await sdk.agentGet({
          params: { agent_id: widgetIntegration.agent_id },
        });

        const agentData = extractApiData(agentResponse);
        if (!agentData || !isAgentData(agentData)) {
          return {
            isValid: false,
            error: agentData ? 'Invalid agent data format' : `Agent with ID ${widgetIntegration.agent_id} not found`,
            integration: widgetIntegration,
          };
        }

        const agent = agentData;

        // Step 3: Validate connection ID exists
        if (!widgetIntegration.connection_id) {
          return {
            isValid: false,
            error: 'Integration missing connection_id',
            integration: widgetIntegration,
            agent,
          };
        }

        console.log('Validating connection ID...', widgetIntegration.connection_id);

        const connectionResponse = await sdk.connectionGet({
          params: { connection_id: widgetIntegration.connection_id },
        });

        const connectionData = extractApiData(connectionResponse);
        if (!connectionData || !isConnectionData(connectionData)) {
          return {
            isValid: false,
            error: connectionData
              ? 'Invalid connection data format'
              : `Connection with ID ${widgetIntegration.connection_id} not found`,
            integration: widgetIntegration,
            agent,
          };
        }

        const connection = connectionData;

        // Fetch and check URL guides for this integration
        const integrationId = widgetIntegration.id;
        if (integrationId) {
          try {
            // Get current URL if available (browser environment)
            const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
            
            const urlGuidesResponse = await sdk.urlGuideSearch({
              query: {
                integration_id: integrationId,
              },
            });

            if (isValidApiResponse(urlGuidesResponse)) {
              const urlGuides = extractApiData(urlGuidesResponse);
              if (urlGuides && Array.isArray(urlGuides) && urlGuides.length > 0) {
                console.log('═══════════════════════════════════════════════════════════');
                console.log(`📋 [Validation] URL Guides for Integration ID: ${integrationId}`);
                console.log(`   Found ${urlGuides.length} URL guide(s) in url_guide table:`);
                console.log('═══════════════════════════════════════════════════════════');
                
                // Normalize URLs for comparison (same as backend)
                const normalizeUrl = (url: string): string => {
                  return url.trim().toLowerCase().replace(/\/+$/, '');
                };
                
                const normalizedCurrentUrl = currentUrl ? normalizeUrl(currentUrl) : '';
                if (currentUrl) {
                  console.log(`🌐 [Validation] Current URL: "${currentUrl}"`);
                  console.log(`🔧 [Validation] Normalized Current URL: "${normalizedCurrentUrl}"`);
                  console.log('');
                }
                
                let exactMatchFound = false;
                let matchedMessage: string | string[] | undefined = undefined;
                
                urlGuides.forEach((guide: any, index: number) => {
                  const pattern = guide.url_pattern.trim();
                  const normalizedPattern = normalizeUrl(pattern);
                  
                  console.log(`  ${index + 1}. URL Pattern: "${pattern}"`);
                  console.log(`     Normalized Pattern: "${normalizedPattern}"`);
                  console.log(`     Message: "${guide.message}"`);
                  if (guide.description) {
                    console.log(`     Description: "${guide.description}"`);
                  }
                  console.log(`     Guide ID: ${guide.id}`);
                  
                  // Check for exact match
                  if (currentUrl && normalizedPattern === normalizedCurrentUrl) {
                    exactMatchFound = true;
                    matchedMessage = guide.message; // Store the matched message
                    console.log(`     ✅ EXACT MATCH FOUND!`);
                    console.log('');
                    console.log('═══════════════════════════════════════════════════════════');
                    console.log('🎯 [Validation] EXACT URL MATCH DETECTED!');
                    console.log('═══════════════════════════════════════════════════════════');
                    console.log(`✅ URL Pattern: "${pattern}"`);
                    console.log(`✅ Current URL: "${currentUrl}"`);
                    console.log(`✅ MATCH TYPE: EXACT EQUAL`);
                    console.log(`✅ Message to show: "${guide.message}"`);
                    console.log('═══════════════════════════════════════════════════════════');
                    console.log('');
                  } else {
                    console.log('');
                  }
                });
                
                if (!exactMatchFound && currentUrl) {
                  console.log(`ℹ️ [Validation] No exact URL match found. Current URL does not exactly match any URL pattern.`);
                } else if (!currentUrl) {
                  console.log(`ℹ️ [Validation] Cannot check URL match (not in browser environment)`);
                }
                
                console.log('═══════════════════════════════════════════════════════════');
                
                // Store matched message for widget state
                if (matchedMessage && typeof window !== 'undefined') {
                  // Use URL guide match API to get the full guide data and ensure consistency
                  try {
                    const matchResponse = await sdk.urlGuideMatch({
                      query: {
                        integration_id: integrationId,
                        url: currentUrl,
                      },
                    });
                    const matchedGuide = sdk.parse(matchResponse);
                    if (matchedGuide && matchedGuide.message) {
                      // Normalize URLs to verify it's still an exact match (reuse existing normalizeUrl function)
                      const normalizedPattern = normalizeUrl(matchedGuide.url_pattern);
                      const normalizedCurrentUrl = normalizeUrl(currentUrl);
                      if (normalizedPattern === normalizedCurrentUrl) {
                        matchedMessage = matchedGuide.message;
                        // Store in sessionStorage so WidgetContext can access it
                        // ValidationService runs before WidgetContext is initialized
                        // Serialize array to JSON if it's an array
                        if (matchedMessage) {
                          const messageToStore = Array.isArray(matchedMessage) 
                            ? JSON.stringify(matchedMessage) 
                            : matchedMessage;
                          sessionStorage.setItem('marketrix_url_guide_message', messageToStore);
                          console.log('💾 [Validation] Stored URL guide message(s) for widget display:', matchedMessage);
                        }
                      }
                    }
                  } catch (matchError) {
                    console.warn('⚠️ [Validation] Failed to verify URL guide match:', matchError);
                    // Still store the message we found earlier
                    if (matchedMessage) {
                      const messageToStoreFallback = Array.isArray(matchedMessage) 
                        ? JSON.stringify(matchedMessage) 
                        : matchedMessage;
                      sessionStorage.setItem('marketrix_url_guide_message', messageToStoreFallback);
                      console.log('💾 [Validation] Stored URL guide message(s) (fallback):', matchedMessage);
                    }
                  }
                }
              } else {
                console.log(`ℹ️ [Validation] No URL guides found in url_guide table for integration ${integrationId}`);
              }
            }
          } catch (urlGuideError) {
            console.warn('⚠️ [Validation] Failed to fetch URL guides:', urlGuideError);
          }
        }

        console.log('Widget validation successful', {
          integration: widgetIntegration.id,
          agent: agent.id,
          connection: connection.id,
        });

        return {
          isValid: true,
          integration: widgetIntegration,
          agent,
          connection,
        };
      } catch (agentError) {
        console.error('Error validating agent:', agentError);
        return {
          isValid: false,
          error: `Failed to validate agent: ${agentError instanceof Error ? agentError.message : 'Unknown error'}`,
          integration: widgetIntegration,
        };
      }
    } catch (error) {
      console.error('Widget validation error:', error);
      return handleApiError(error, 'Widget validation', this.config);
    }
  }

  /**
   * Validate by mtxApp and mtxAgent directly
   * Validates connection and agent by ID
   */
  private async validateByAgentAndConnection(mtxApp: number, mtxAgent: number): Promise<WidgetValidationResult> {
    try {
      console.log('Validating agent and connection by ID...', { mtxApp, mtxAgent });

      // Step 1: Validate connection exists (using connectionGet instead of connectionSearch)
      const connectionResponse = await sdk.connectionGet({
        params: { connection_id: mtxApp },
      });

      const connectionData = extractApiData(connectionResponse);
      if (!connectionData || !isConnectionData(connectionData)) {
        return {
          isValid: false,
          error: connectionData ? 'Invalid connection data format' : `Connection with ID ${mtxApp} not found`,
        };
      }

      const connection = connectionData;

      // Log connection data as object
      console.log('✅ Connection found:', {
        id: connection.id,
        name: connection.name,
        type: connection.type,
        url: connection.url,
        allowed_domains: connection.allowed_domains,
      });

      // Step 2: Validate agent exists
      const agentResponse = await sdk.agentGet({
        params: { agent_id: mtxAgent },
      });

      const agentData = extractApiData(agentResponse);
      if (!agentData || !isAgentData(agentData)) {
        return {
          isValid: false,
          error: agentData ? 'Invalid agent data format' : `Agent with ID ${mtxAgent} not found`,
          connection,
        };
      }

      const agent = agentData;

      // Log agent data as object
      console.log('✅ Agent found:', {
        id: agent.id,
        agent_name: agent.agent_name,
        connection_id: agent.connection_id,
        agent_type: agent.agent_type,
      });

      // Step 3: Validate that agent's connection_id matches the provided mtx-app
      if (agent.connection_id !== mtxApp) {
        return {
          isValid: false,
          error: `Agent ID ${mtxAgent} belongs to connection ID ${agent.connection_id}, but provided connection ID is ${mtxApp}. Please verify the connection ID matches the agent's connection_id.`,
          connection,
          agent,
        };
      }

      // Validation successful
      console.log('✅ Validation successful:', { connection_id: mtxApp, agent_id: mtxAgent });

      return {
        isValid: true,
        connection,
        agent,
      };
    } catch (error) {
      console.error('Agent and Connection validation error:', error);
      return handleApiError(error, 'Agent and Connection validation', this.config);
    }
  }
}

export default WidgetValidationService;
