import { type AgentData, type ConnectionData, type IntegrationData, sdk } from '../../sdk';
import type { MarketrixConfig } from '../../types';
import { extractApiData, handleApiError, isValidApiResponse } from '../../utils/apiUtils';
import {
  isAgentData,
  isConnectionData,
  isIntegrationDataArray,
} from '../../utils/validation/typeGuards';

export interface WidgetValidationResult {
  isValid: boolean;
  error?: string;
  integration?: IntegrationData;
  agent?: AgentData;
  connection?: ConnectionData;
}

/**
 * WidgetValidationService
 *
 * Validates widget configuration by checking:
 * 1. Integration exists (via marketrix_id and marketrix_key) OR
 * 2. Agent ID and Connection ID exist and match
 */
export class WidgetValidationService {
  /**
   * Validate widget configuration
   * Handles both marketrixId+marketrixKey and agentId+connectionId cases
   */
  async validateConfig(config: MarketrixConfig): Promise<WidgetValidationResult> {
    if (config.marketrixId && config.marketrixKey) {
      return this.validateByMarketrixId(config.marketrixId, config.marketrixKey);
    }
    if (config.agentId && config.connectionId) {
      return this.validateByAgentAndConnection(config.agentId, config.connectionId);
    }
    return {
      isValid: false,
      error: 'Please provide either (marketrixId + marketrixKey) OR (agentId + connectionId)',
    };
  }

  /**
   * Validate by marketrixId and marketrixKey
   */
  private async validateByMarketrixId(
    marketrixId: string,
    marketrixKey: string
  ): Promise<WidgetValidationResult> {
    try {
      // Step 1: Fetch integration by marketrix_id and marketrix_key
      console.log('Validating widget - fetching integration...', { marketrixId, marketrixKey });

      const integrationResponse = await sdk.integrationSearch({
        query: {
          marketrix_id: marketrixId,
          marketrix_key: marketrixKey,
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
        integrations.map((i) => ({
          id: i.id,
          type: i.type,
          status: i.status,
          marketrix_id: i.marketrix_id,
        }))
      );

      // Find the widget integration
      const widgetIntegration = integrations.find(
        (integration: IntegrationData) =>
          integration.type === 'widget' && integration.status === 'active'
      );

      if (!widgetIntegration) {
        // Check if there are any widget integrations with different status
        const widgetIntegrations = integrations.filter(
          (integration: IntegrationData) => integration.type === 'widget'
        );

        if (widgetIntegrations.length > 0) {
          const statuses = widgetIntegrations.map((i) => i.status).join(', ');
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
        const types = integrations.map((i) => i.type).join(', ');
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
            error: agentData
              ? 'Invalid agent data format'
              : `Agent with ID ${widgetIntegration.agent_id} not found`,
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
      return handleApiError(error, 'Widget validation');
    }
  }

  /**
   * Validate by agentId and connectionId directly
   * Validates connection and agent by ID
   */
  private async validateByAgentAndConnection(
    agentId: number,
    connectionId: number
  ): Promise<WidgetValidationResult> {
    try {
      console.log('Validating agent and connection by ID...', { agentId, connectionId });

      // Step 1: Validate connection exists (using connectionGet instead of connectionSearch)
      const connectionResponse = await sdk.connectionGet({
        params: { connection_id: connectionId },
      });

      const connectionData = extractApiData(connectionResponse);
      if (!connectionData || !isConnectionData(connectionData)) {
        return {
          isValid: false,
          error: connectionData
            ? 'Invalid connection data format'
            : `Connection with ID ${connectionId} not found`,
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
        params: { agent_id: agentId },
      });

      const agentData = extractApiData(agentResponse);
      if (!agentData || !isAgentData(agentData)) {
        return {
          isValid: false,
          error: agentData ? 'Invalid agent data format' : `Agent with ID ${agentId} not found`,
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

      // Step 3: Validate that agent's connection_id matches the provided marketrix-connection-id
      if (agent.connection_id !== connectionId) {
        return {
          isValid: false,
          error: `Agent ID ${agentId} belongs to connection ID ${agent.connection_id}, but provided connection ID is ${connectionId}. Please verify the connection ID matches the agent's connection_id.`,
          connection,
          agent,
        };
      }

      // Validation successful
      console.log('✅ Validation successful:', { connection_id: connectionId, agent_id: agentId });

      return {
        isValid: true,
        connection,
        agent,
      };
    } catch (error) {
      console.error('Agent and Connection validation error:', error);
      return handleApiError(error, 'Agent and Connection validation');
    }
  }
}

export default WidgetValidationService;
