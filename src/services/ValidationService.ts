import { type AgentData, type ApplicationData, sdk, type WidgetData } from '../sdk';
import type { MarketrixConfig } from '../types';
import { extractErrorMessage, handleApiError } from '../utils/apiUtils';

export interface WidgetValidationResult {
  isValid: boolean;
  error?: string;
  widget?: WidgetData;
  agent?: AgentData;
  connection?: ApplicationData;
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
      // Step 1: Fetch widget by marketrix_id and marketrix_key
      console.log('Validating widget - fetching widget...', { mtxId, mtxKey });

      const widgetsData = await sdk.widgetSearch({
        marketrix_id: mtxId,
        marketrix_key: mtxKey,
      });

      if (!widgetsData || widgetsData.length === 0) {
        return {
          isValid: false,
          error: 'Widget not found or invalid credentials',
        };
      }

      const widgets = widgetsData;

      // Debug: Log what widgets were found
      console.log(
        'Found widgets:',
        widgets.length,
        widgets.map((i: WidgetData) => ({
          id: i.id,
          type: i.type,
          status: i.status,
          marketrix_id: i.marketrix_id,
        })),
      );

      // Find the active widget
      const activeWidget = widgets.find((widget: WidgetData) => widget.type === 'widget' && widget.status === 'active');

      if (!activeWidget) {
        // Check if there are any widgets with different status
        const widgetMatches = widgets.filter((widget: WidgetData) => widget.type === 'widget');

        if (widgetMatches.length > 0) {
          const statuses = widgetMatches.map((i: WidgetData) => i.status).join(', ');
          return {
            isValid: false,
            error: `Found widget(s) but none are active. Current status(es): ${statuses}. Please activate the widget in the dashboard.`,
          };
        }

        // Check if there are any widgets at all
        if (widgets.length === 0) {
          return {
            isValid: false,
            error: 'No widgets found for the provided marketrix_id and marketrix_key. Please verify your credentials.',
          };
        }

        // There are widgets but no widget type
        const types = widgets.map((i: WidgetData) => i.type).join(', ');
        return {
          isValid: false,
          error: `No widget found. Found widget type(s): ${types}. Please create a widget.`,
        };
      }

      // Step 2: Validate agent ID exists
      if (!activeWidget.agent_id) {
        return {
          isValid: false,
          error: 'Widget missing agent_id',
          widget: activeWidget,
        };
      }

      console.log('Validating agent ID...', activeWidget.agent_id);

      try {
        const agent = await sdk.agentGet({ agent_id: activeWidget.agent_id });

        // Step 3: Validate connection ID exists
        if (!activeWidget.application_id) {
          return {
            isValid: false,
            error: 'Widget missing application_id',
            widget: activeWidget,
            agent,
          };
        }

        console.log('Validating connection ID...', activeWidget.application_id);

        const connection = await sdk.applicationGet({ application_id: activeWidget.application_id });

        console.log('Widget validation successful', {
          widget: activeWidget.id,
          agent: agent.id,
          connection: connection.id,
        });

        return {
          isValid: true,
          widget: activeWidget,
          agent,
          connection,
        };
      } catch (agentError) {
        console.error('Error validating agent:', agentError);
        return {
          isValid: false,
          error: `Failed to validate agent: ${extractErrorMessage(agentError)}`,
          widget: activeWidget,
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

      // Step 1: Validate connection exists
      const connection = await sdk.applicationGet({ application_id: mtxApp });

      // Log connection data as object
      console.log('Connection found:', {
        id: connection.id,
        name: connection.name,
        type: connection.type,
        url: connection.url,
        allowed_domains: connection.allowed_domains,
      });

      // Step 2: Validate agent exists
      const agent = await sdk.agentGet({ agent_id: mtxAgent });

      // Log agent data as object
      console.log('Agent found:', {
        id: agent.id,
        agent_name: agent.agent_name,
        application_id: agent.application_id,
        agent_type: agent.agent_type,
      });

      // Step 3: Validate that agent's application_id matches the provided mtx-app
      if (agent.application_id !== mtxApp) {
        return {
          isValid: false,
          error: `Agent ID ${mtxAgent} belongs to connection ID ${agent.application_id}, but provided connection ID is ${mtxApp}. Please verify the connection ID matches the agent's application_id.`,
          connection,
          agent,
        };
      }

      // Validation successful
      console.log('Validation successful:', { application_id: mtxApp, agent_id: mtxAgent });

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
