import { VITE_API_URL } from '../config';
import { type AgentData, type ConnectionData, type IntegrationData, sdk } from '../sdk';
import {
  isAgentData,
  isAgentDataArray,
  isConnectionData,
  isIntegrationDataArray,
} from '../utils/typeGuards';

export interface WidgetValidationResult {
  isValid: boolean;
  error?: string;
  integration?: IntegrationData;
  agent?: AgentData;
  connection?: ConnectionData;
}

export interface FallbackValidationResult {
  isValid: boolean;
  error?: string;
  connection?: ConnectionData;
  agent?: AgentData;
  connectionId?: number;
  agentId?: number;
}

/**
 * WidgetValidationService
 *
 * Validates widget configuration by checking:
 * 1. Integration exists (via marketrix_id and marketrix_key)
 * 2. Agent ID exists in agent table
 * 3. Connection ID exists in connection table
 *
 * Also provides fallback validation when marketrix_id/key are missing:
 * - Fetches connections and agents to validate they exist
 */
export class WidgetValidationService {
  /**
   * Validate widget configuration
   */
  async validateWidget(marketrixId: string, marketrixKey: string): Promise<WidgetValidationResult> {
    try {
      // Step 1: Fetch integration by marketrix_id and marketrix_key
      console.log('Validating widget - fetching integration...', { marketrixId, marketrixKey });

      const integrationResponse = await sdk.integrationSearch({
        query: {
          marketrix_id: marketrixId,
          marketrix_key: marketrixKey,
        },
      });

      if (integrationResponse.status !== 200 || !integrationResponse.body?.success) {
        return {
          isValid: false,
          error: 'Integration not found or invalid credentials',
        };
      }

      if (!isIntegrationDataArray(integrationResponse.body.data)) {
        return {
          isValid: false,
          error: 'Invalid integration data format',
        };
      }

      const integrations = integrationResponse.body.data;

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

        if (agentResponse.status !== 200 || !agentResponse.body?.success) {
          return {
            isValid: false,
            error: `Agent with ID ${widgetIntegration.agent_id} not found`,
            integration: widgetIntegration,
          };
        }

        if (!isAgentData(agentResponse.body.data)) {
          return {
            isValid: false,
            error: 'Invalid agent data format',
            integration: widgetIntegration,
          };
        }

        const agent = agentResponse.body.data;

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

        if (connectionResponse.status !== 200 || !connectionResponse.body?.success) {
          return {
            isValid: false,
            error: `Connection with ID ${widgetIntegration.connection_id} not found`,
            integration: widgetIntegration,
            agent,
          };
        }

        if (!isConnectionData(connectionResponse.body.data)) {
          return {
            isValid: false,
            error: 'Invalid connection data format',
            integration: widgetIntegration,
            agent,
          };
        }

        const connection = connectionResponse.body.data;

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

      // Check if it's a network/connection error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isConnectionError =
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('ERR_CONNECTION_REFUSED') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Network request failed');

      if (isConnectionError) {
        return {
          isValid: false,
          error: `Cannot connect to API server. Please ensure the API server is running at ${VITE_API_URL}. Error: ${errorMessage}`,
        };
      }

      return {
        isValid: false,
        error: `Validation failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Fallback validation when marketrix_id and marketrix_key are missing
   * Uses connectionGet with provided connectionId instead of connectionSearch
   */
  async validateWithFallback(connectionId?: number): Promise<FallbackValidationResult> {
    try {
      console.log('Starting fallback validation...');

      // Skip connectionSearch - use connectionGet with provided connectionId if available
      // If no connectionId provided, validation will fail
      if (!connectionId) {
        return {
          isValid: false,
          error: 'Connection ID is required for validation',
        };
      }

      // Get connection by ID (using connectionGet instead of connectionSearch)
      const connectionResponse = await sdk.connectionGet({
        params: { connection_id: connectionId },
      });

      if (connectionResponse.status !== 200 || !connectionResponse.body?.success) {
        return {
          isValid: false,
          error: 'Failed to fetch connection',
        };
      }

      if (!isConnectionData(connectionResponse.body.data)) {
        return {
          isValid: false,
          error: 'Invalid connection data format',
        };
      }

      const connection = connectionResponse.body.data;

      if (!connection.id) {
        return {
          isValid: false,
          error: 'Connection missing ID',
          connection,
        };
      }

      console.log('Found connection:', connection.id);

      // Step 2: Fetch agents for this connection
      const agentResponse = await sdk.agentSearch({
        query: {
          connection_id: connection.id,
        },
      });

      if (agentResponse.status !== 200 || !agentResponse.body?.success) {
        return {
          isValid: false,
          error: 'Failed to fetch agents',
          connection,
          connectionId,
        };
      }

      if (!isAgentDataArray(agentResponse.body.data)) {
        return {
          isValid: false,
          error: 'Invalid agents data format',
          connection,
          connectionId,
        };
      }

      const agents = agentResponse.body.data;

      if (!agents || agents.length === 0) {
        return {
          isValid: false,
          error: 'No agents found for connection',
          connection,
          connectionId,
        };
      }

      // Get first agent
      const agent = agents[0];
      const agentId = agent.id;

      if (!agentId) {
        return {
          isValid: false,
          error: 'Agent missing ID',
          connection,
          agent,
          connectionId,
        };
      }

      console.log('Found agent:', agentId);

      // Validation successful
      console.log('Fallback validation successful', {
        connection_id: connectionId,
        agent_id: agentId,
      });

      return {
        isValid: true,
        connection,
        agent,
        connectionId,
        agentId,
      };
    } catch (error) {
      console.error('Fallback validation error:', error);

      // Check if it's a network/connection error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isConnectionError =
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('ERR_CONNECTION_REFUSED') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Network request failed');

      if (isConnectionError) {
        return {
          isValid: false,
          error: `Cannot connect to API server. Please ensure the API server is running at ${VITE_API_URL}. Error: ${errorMessage}`,
        };
      }

      return {
        isValid: false,
        error: `Fallback validation failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Validate by marketrix-agent and marketrix-connection-id directly
   * Used when marketrix_id and marketrix_key are not available
   * Validates connection and agent by ID
   */
  async validateByAgentAndConnection(
    agentId: number,
    connectionId: number
  ): Promise<FallbackValidationResult> {
    try {
      console.log('Validating agent and connection by ID...', { agentId, connectionId });

      // Step 1: Validate connection exists (using connectionGet instead of connectionSearch)
      const connectionResponse = await sdk.connectionGet({
        params: { connection_id: connectionId },
      });

      if (connectionResponse.status !== 200 || !connectionResponse.body?.success) {
        return {
          isValid: false,
          error: `Connection with ID ${connectionId} not found`,
        };
      }

      if (!isConnectionData(connectionResponse.body.data)) {
        return {
          isValid: false,
          error: 'Invalid connection data format',
        };
      }

      const connection = connectionResponse.body.data;

      // Log all connection table values from the database
      console.log('📊 ========== CONNECTION TABLE VALUES (marketrix database) ==========');
      console.log('✅ Connection found in database with all values:');
      console.log('   id:', connection.id);
      console.log('   tenant_id:', connection.tenant_id);
      console.log('   name:', connection.name);
      console.log('   type:', connection.type);
      console.log('   url:', connection.url);
      console.log('   username:', connection.username);
      console.log('   password:', connection.password ? '***hidden***' : null);
      console.log('   allowed_domains:', connection.allowed_domains);
      console.log('   created_at:', connection.created_at);
      console.log('   updated_at:', connection.updated_at);
      console.log('📊 =================================================================');

      // Step 2: Validate agent exists
      const agentResponse = await sdk.agentGet({
        params: { agent_id: agentId },
      });

      if (agentResponse.status !== 200 || !agentResponse.body?.success) {
        return {
          isValid: false,
          error: `Agent with ID ${agentId} not found`,
          connection,
          connectionId,
        };
      }

      if (!isAgentData(agentResponse.body.data)) {
        return {
          isValid: false,
          error: 'Invalid agent data format',
          connection,
          connectionId,
        };
      }

      const agent = agentResponse.body.data;

      // Log all agent table values from the database
      console.log('📊 ========== AGENT TABLE VALUES (marketrix database) ==========');
      console.log('✅ Agent found in database with all values:');
      console.log('   id:', agent.id);
      console.log('   tenant_id:', agent.tenant_id);
      console.log('   user_id:', agent.user_id);
      console.log('   connection_id:', agent.connection_id);
      console.log('   agent_name:', agent.agent_name);
      console.log('   agent_type:', agent.agent_type);
      console.log('   agent_voice:', agent.agent_voice);
      console.log('   agent_description:', agent.agent_description);
      console.log('   image_url:', agent.image_url);
      console.log('   instructions:', agent.instructions);
      console.log('   vector_store_id:', agent.vector_store_id);
      console.log('   pdf_search_index_id:', agent.pdf_search_index_id);
      console.log('   json_search_index_id:', agent.json_search_index_id);
      console.log('   created_at:', agent.created_at);
      console.log('   updated_at:', agent.updated_at);
      console.log('📊 ============================================================');

      // Step 3: Validate that agent's connection_id matches the provided marketrix-connection-id
      if (agent.connection_id !== connectionId) {
        return {
          isValid: false,
          error: `Agent ID ${agentId} belongs to connection ID ${agent.connection_id}, but provided connection ID is ${connectionId}. Please verify the marketrix-connection-id matches the agent's connection_id.`,
          connection,
          agent,
          connectionId,
        };
      }

      // Validation successful
      console.log('✅ Agent and Connection validation successful!', {
        connection_id: connectionId,
        agent_id: agentId,
        connection: {
          id: connection.id,
          name: connection.name,
          type: connection.type,
        },
        agent: {
          id: agent.id,
          agent_name: agent.agent_name,
          connection_id: agent.connection_id,
        },
      });

      // Final check: Verify connection exists (using connectionGet instead of connectionSearch)
      let connectionIdMatches = false;
      try {
        const finalConnectionResponse = await sdk.connectionGet({
          params: { connection_id: connectionId },
        });
        if (
          finalConnectionResponse.status === 200 &&
          finalConnectionResponse.body?.success &&
          isConnectionData(finalConnectionResponse.body.data)
        ) {
          connectionIdMatches = true;

          if (connectionIdMatches) {
            console.log('✅ Connection ID verification: TRUE - Connection exists!');
            console.log('🎯 Default widget settings will be applied');
          } else {
            console.warn('⚠️ Connection ID verification: FALSE - Connection not found');
          }
        }
      } catch (verifyError) {
        console.warn('⚠️ Could not verify connection:', verifyError);
      }

      return {
        isValid: true,
        connection,
        agent,
        connectionId,
        agentId,
      };
    } catch (error) {
      console.error('Agent and Connection validation error:', error);

      // Check if it's a network/connection error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isConnectionError =
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('ERR_CONNECTION_REFUSED') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Network request failed');

      if (isConnectionError) {
        return {
          isValid: false,
          error: `Cannot connect to API server. Please ensure the API server is running at ${VITE_API_URL}. Error: ${errorMessage}`,
        };
      }

      return {
        isValid: false,
        error: `Validation failed: ${errorMessage}`,
      };
    }
  }
}

export default WidgetValidationService;
