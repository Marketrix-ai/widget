import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { sdk } from '../sdk';
import { MarketrixApiService } from '../services/ApiService';
import { chatService, createAgentMessage, createUserMessage } from '../services/ChatService';
import { configManager } from '../services/ConfigManager';
import { sessionManager } from '../services/SessionManager';
import { toolExecutionService } from '../services/ToolService';
import { WebSocketClient, type WebSocketMessage, type WebSocketStatus } from '../services/WebSocketClient';
import type { ChatMessage, InstructionType, TaskProgress, WidgetState } from '../types';
import { isToolCallRequestMessage, type ToolCallResponseMessage } from '../types/toolMessages';
import {
  addProgressLine,
  addThinkingMarker,
  findMessageForProgress,
  getFriendlyToolName,
  markProgressLineComplete,
  markProgressLineFailed,
  updateThinkingMarker,
} from '../utils/chat';

// Define Context Interface
interface WidgetContextType {
  state: WidgetState;
  actions: {
    setState: (payload: Partial<WidgetState>) => void;
    toggleWidget: () => void;
    closeWidget: () => void;
    setMode: (mode: InstructionType) => void;
    setLoading: (loading: boolean) => void;
    setAgentAvailable: (available: boolean) => void;
    setError: (error: string | undefined) => void;
    clearError: () => void;
    setTaskState: (payload: {
      activeTaskId: string | null;
      isTaskRunning: boolean;
      taskProgress?: TaskProgress[];
    }) => void;
    addMessage: (message: ChatMessage) => void;
    updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
    removeMessage: (messageId: string) => void;
    setMessages: (messages: ChatMessage[]) => void;
    resetState: () => void;
    stopTask: () => Promise<void>;
    clearChatHistory: () => void;
    sendMessage: (
      content: string,
      mode?: InstructionType,
      connectionId?: number,
      question?: string,
      skipUserMessage?: boolean,
    ) => Promise<void>;
  };
}

// Tool call types are now imported from toolMessages.ts

const WidgetContext = createContext<WidgetContextType | undefined>(undefined);

export const WidgetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<WidgetState>({
    isOpen: false,
    isMinimized: false,
    isLoading: false,
    messages: [],
    currentMode: 'tell',
    agentAvailable: false,
    activeTaskId: null,
    isTaskRunning: false,
    taskProgress: [],
    urlGuideMessages: undefined,
  });

  // Function to check URL guide match
  const checkUrlGuide = useCallback(async (url?: string) => {
    if (typeof window === 'undefined') return;

    const currentUrl = url || window.location.href;
    const config = configManager.getConfig();
    
    if (!config) {
      console.log('⚠️ [Widget] No config available for URL guide check');
      return;
    }

    // Log current URL information
    console.log('🌐 [Widget] Current page URL information:', {
      full_url: currentUrl,
      origin: window.location.origin,
      pathname: window.location.pathname,
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      hash: window.location.hash,
      search: window.location.search,
    });

    try {
      // Import IntegrationService to fetch integration data
      const { IntegrationService } = await import('../services/IntegrationService');
      const integrationService = new IntegrationService(
        config.mtxId,
        config.mtxKey,
        config.mtxApp
      );
      
      // Fetch integration to get integration_id (with retry)
      let integrationData = await integrationService.fetchIntegrationSettings();
      
      // Retry once if integration data not found (might be loading)
      if (!integrationData || !integrationData.id) {
        console.log('⚠️ [Widget] Integration data not found, retrying in 1 second...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        integrationData = await integrationService.fetchIntegrationSettings();
      }
      
      if (integrationData && integrationData.id) {
        const integrationId = integrationData.id;
        
        // Print integration ID
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🆔 [Widget] Integration ID:', integrationId);
        console.log('═══════════════════════════════════════════════════════════');
        
        // Fetch all URL guides for this integration
        try {
          const urlGuidesResponse = await sdk.urlGuideSearch({
            query: {
              integration_id: integrationId,
            },
          });
          const urlGuides = sdk.parse(urlGuidesResponse);
          
          if (urlGuides && Array.isArray(urlGuides) && urlGuides.length > 0) {
            console.log(`📋 [Widget] Found ${urlGuides.length} URL guide(s) in url_guide table for integration ${integrationId}:`);
            console.log('═══════════════════════════════════════════════════════════');
            urlGuides.forEach((guide: any, index: number) => {
              console.log(`  ${index + 1}. URL Guide ID: ${guide.id}`);
              console.log(`     URL Pattern: "${guide.url_pattern}"`);
              console.log(`     Message: "${guide.message}"`);
              if (guide.description) {
                console.log(`     Description: "${guide.description}"`);
              }
              console.log(`     Created: ${new Date(guide.created_at).toLocaleString()}`);
              console.log('');
            });
            console.log('═══════════════════════════════════════════════════════════');
          } else {
            console.log(`ℹ️ [Widget] No URL guides found in url_guide table for integration ${integrationId}`);
          }
        } catch (error) {
          console.error('❌ [Widget] Failed to fetch URL guides:', error);
        }
        
        console.log('🔍 [Widget] Checking URL guide match:', {
          integration_id: integrationId,
          current_url: currentUrl,
        });
        
        const response = await sdk.urlGuideMatch({
          query: {
            integration_id: integrationId,
            url: currentUrl,
          },
        });
        const guide = sdk.parse(response);
        
        if (guide && guide.message) {
          // Normalize URLs for comparison (same as backend)
          const normalizeUrl = (url: string): string => {
            return url.trim().toLowerCase().replace(/\/+$/, '');
          };
          const normalizedPattern = normalizeUrl(guide.url_pattern);
          const normalizedCurrentUrl = normalizeUrl(currentUrl);
          
          // Check if it's an exact match
          const isExactMatch = normalizedPattern === normalizedCurrentUrl;
          
          if (isExactMatch) {
            console.log('═══════════════════════════════════════════════════════════');
            console.log('🎯 [Widget] EXACT URL MATCH FOUND!');
            console.log('═══════════════════════════════════════════════════════════');
            console.log(`✅ URL Pattern: "${guide.url_pattern}"`);
            console.log(`✅ Current URL: "${currentUrl}"`);
            console.log(`✅ MATCH TYPE: EXACT EQUAL`);
            console.log(`✅ Message to show: "${guide.message}"`);
            console.log('═══════════════════════════════════════════════════════════');
            // Store the URL guide messages to display as chips (only for exact matches)
            // Convert single message to array, or use array if already an array
            const messages = Array.isArray(guide.message) ? guide.message : [guide.message];
            setState((prev) => ({
              ...prev,
              urlGuideMessages: messages,
            }));
          } else {
            console.log('✅ [Widget] URL guide match found!', {
              url_pattern: guide.url_pattern,
              message: guide.message,
              current_url: currentUrl,
              match_type: 'URL pattern matched (contains/starts-with/ends-with)',
            });
            // Clear URL guide messages for non-exact matches
            setState((prev) => ({
              ...prev,
              urlGuideMessages: undefined,
            }));
          }
        } else {
          console.log('ℹ️ [Widget] No URL guide match found for:', currentUrl);
          console.log('   Current URL does not match any URL patterns in url_guide table');
          // Clear URL guide message if no match
          setState((prev) => ({
            ...prev,
            urlGuideMessages: undefined,
          }));
        }
      } else {
        console.log('⚠️ [Widget] No integration data found after retry, URL:', currentUrl);
        // Still log the URL even if integration data is not available
      }
    } catch (error) {
      console.error('❌ [Widget] URL guide check failed:', error);
      console.error('   Current URL:', currentUrl);
    }
  }, []);

  // Initialize ChatService on mount
  useEffect(() => {
    const initChat = async () => {
      const chatId = await sessionManager.getOrCreateChatId();

      chatService.createInitialContext(chatId);

      chatService.initialize(chatId);
      setState(prev => ({
        ...prev,
        messages: chatService.getMessages(),
        isLoading: chatService.getIsLoading(),
        isTaskRunning: chatService.getIsTaskRunning(),
        activeTaskId: chatService.getActiveTaskId(),
        taskProgress: chatService.getTaskProgress(),
        currentMode: chatService.getCurrentMode(),
        isOpen: chatService.getIsOpen(),
        isMinimized: chatService.getIsMinimized(),
      }));

      // Connect WebSocket if chat ID exists
      if (chatId) {
        // Ensure config is loaded before initializing WebSocket
        const config = configManager.getConfig();
        if (config) {
          const wsClient = WebSocketClient.getInstance(config);
          wsClient.connect(chatId).catch((err: unknown) => console.error('Initial WebSocket connection failed:', err));
        }

        // Check for URL guide messages from ValidationService (stored in sessionStorage)
        if (typeof window !== 'undefined') {
          const storedMessage = sessionStorage.getItem('marketrix_url_guide_message');
          if (storedMessage) {
            console.log('💾 [Widget] Found URL guide message from validation:', storedMessage);
            // Try to parse as JSON array, otherwise treat as single message
            try {
              const parsed = JSON.parse(storedMessage);
              const messages = Array.isArray(parsed) ? parsed : [parsed];
              setState((prev) => ({
                ...prev,
                urlGuideMessages: messages,
              }));
            } catch {
              // Not JSON, treat as single message string
              setState((prev) => ({
                ...prev,
                urlGuideMessages: [storedMessage],
              }));
            }
            // Clear it after reading
            sessionStorage.removeItem('marketrix_url_guide_message');
          }
          
          // Check for URL guide match on initial load
          console.log('🚀 [Widget] Widget loaded, checking initial URL...');
          await checkUrlGuide();
        }
      }
    };
    initChat();
  }, [checkUrlGuide]);

  // Monitor URL changes for SPAs (pushState, replaceState, popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastUrl = window.location.href;

    // Function to handle URL changes
    const handleUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('🔄 [Widget] URL changed detected:', {
          from: lastUrl,
          to: currentUrl,
        });
        lastUrl = currentUrl;
        // Check URL guide for new URL
        checkUrlGuide(currentUrl);
      }
    };

    // Override pushState to detect URL changes
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args);
      setTimeout(handleUrlChange, 0);
    };

    // Override replaceState to detect URL changes
    const originalReplaceState = window.history.replaceState;
    window.history.replaceState = function (...args) {
      originalReplaceState.apply(window.history, args);
      setTimeout(handleUrlChange, 0);
    };

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', handleUrlChange);

    // Listen for hash changes
    window.addEventListener('hashchange', handleUrlChange);

    // Cleanup
    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, [checkUrlGuide]);

  // Helper to update progress
  const updateProgressForTool = useCallback(
    (toolName: string, explanation: string, status: 'running' | 'completed' | 'failed', error?: string) => {
      setState(prev => {
        const friendlyName = getFriendlyToolName(toolName);
        const found = findMessageForProgress({
          messages: prev.messages,
          isTaskRunning: prev.isTaskRunning,
          currentMode: prev.currentMode,
          preferPlaceholder: true,
          requireContent: status === 'failed',
        });

        if (!found) return prev;

        let updatedMsg = found.message;

        // Determine if this tool interaction requires user waiting
        // Matches ToolService.requiresHighlight logic + show mode
        const isInteractiveTool = [
          'click_element',
          'type_text',
          'select_dropdown_option',
          'send_keys',
          'upload_file',
        ].includes(toolName);

        const shouldWait = prev.isTaskRunning && prev.currentMode === 'show' && isInteractiveTool;

        // Skip progress line for "done" tool - we show status icon instead
        const isDoneTool = toolName === 'done';

        if (status === 'running') {
          if (!isDoneTool) {
            updatedMsg = addProgressLine(updatedMsg, friendlyName, explanation || friendlyName);
          }
          if (prev.isTaskRunning && (prev.currentMode === 'show' || prev.currentMode === 'do')) {
            updatedMsg = updateThinkingMarker(updatedMsg, prev.isTaskRunning, prev.currentMode, shouldWait);
          }
        } else if (status === 'completed') {
          if (!isDoneTool) {
            updatedMsg = markProgressLineComplete(updatedMsg);
          }
          // When tool completes, revert to 'thinking' state (not waiting)
          if (prev.isTaskRunning && (prev.currentMode === 'show' || prev.currentMode === 'do')) {
            updatedMsg = updateThinkingMarker(updatedMsg, prev.isTaskRunning, prev.currentMode, false);
          }
        } else {
          updatedMsg = markProgressLineFailed(updatedMsg, friendlyName, error || '');
          // On failure, we might also want to revert to thinking or just leave it (likely task will stop soon)
          if (prev.isTaskRunning && (prev.currentMode === 'show' || prev.currentMode === 'do')) {
            updatedMsg = updateThinkingMarker(updatedMsg, prev.isTaskRunning, prev.currentMode, false);
          }
        }

        const newMessages = [...prev.messages];
        newMessages[found.index] = updatedMsg;

        chatService.setMessages(newMessages);
        return { ...prev, messages: newMessages };
      });
    },
    [],
  );

  // WebSocket Setup
  useEffect(() => {
    // Ensure config is loaded before initializing WebSocket
    const config = configManager.getConfig();
    const wsClient = WebSocketClient.getInstance(config || undefined);

    const handleStatusChange = (status: WebSocketStatus) => {
      setState(prev => ({ ...prev, agentAvailable: status === 'registered' }));
    };

    const handleMessage = async (message: WebSocketMessage) => {
      if (isToolCallRequestMessage(message)) {
        const params = message.params;
        const toolName = params.name;
        const args = params.arguments;
        const mode = params.mode || state.currentMode || 'do';
        const explanation = params.explanation || '';
        const requestId = message.id;

        updateProgressForTool(toolName, explanation, 'running');

        const result = await toolExecutionService.executeTool(toolName, args, mode, explanation);

        if (result.success) {
          try {
            // If result is a waiting message (from Show Mode user confirmation),
            // we don't complete the tool yet. We might want to send a status update?
            // But currently the agent expects a tool result to proceed.
            // If we send "Waiting...", the agent might think that's the output.
            // For interactive tools in Show Mode, we really want to tell the agent "Action Performed".
            // The ToolExecutionService returned "User completed the action" or similar.
            // Send the full ToolExecutionResult as JSON to match agent's expectations
            const resultJson = JSON.stringify(result);
            const response: ToolCallResponseMessage = {
              jsonrpc: '2.0',
              id: requestId,
              result: {
                content: [{ type: 'text', text: resultJson }],
              },
            };
            wsClient.send(response);
            updateProgressForTool(toolName, explanation, 'completed');
            // If the "done" tool completed successfully, mark the task as complete
            if (toolName === 'done' && result.success) {
              setState(prev => {
                chatService.setTaskState(false, null, []);
                // Find the task message and update its taskStatus
                const found = findMessageForProgress({
                  messages: prev.messages,
                  isTaskRunning: prev.isTaskRunning,
                  currentMode: prev.currentMode,
                  preferPlaceholder: true,
                  requireContent: false,
                });
                const newMessages = [...prev.messages];
                if (found) {
                  // Remove any "done" progress lines since we show icon instead
                  const updatedParts =
                    found.message.parts?.filter(part => !(part.type === 'progress' && part.toolName === 'done')) || [];
                  newMessages[found.index] = {
                    ...found.message,
                    taskStatus: 'done',
                    parts: updatedParts,
                  };
                  chatService.setMessages(newMessages);
                }
                return {
                  ...prev,
                  messages: newMessages,
                  isTaskRunning: false,
                  activeTaskId: null,
                  taskProgress: [],
                };
              });
            }
          } catch (error) {
            console.error('Failed to send tool result:', error);
            // Even if send fails, we mark as completed locally so UI doesn't hang?
            // Or failed? If agent doesn't get it, task is stuck.
            updateProgressForTool(toolName, explanation, 'failed', 'Connection error');
            // If this is a critical connection error and task is running, mark as failed
            if (state.isTaskRunning) {
              setState(prev => {
                const found = findMessageForProgress({
                  messages: prev.messages,
                  isTaskRunning: prev.isTaskRunning,
                  currentMode: prev.currentMode,
                  preferPlaceholder: true,
                  requireContent: false,
                });
                const newMessages = [...prev.messages];
                if (found && found.message.taskStatus !== 'done' && found.message.taskStatus !== 'stopped') {
                  newMessages[found.index] = {
                    ...found.message,
                    taskStatus: 'failed',
                  };
                  chatService.setMessages(newMessages);
                }
                return { ...prev, messages: newMessages };
              });
            }
          }
        } else {
          try {
            // Send error as JSON-serialized ToolExecutionResult to match agent's expectations
            const resultJson = JSON.stringify(result);
            const response: ToolCallResponseMessage = {
              jsonrpc: '2.0',
              id: requestId,
              result: {
                content: [{ type: 'text', text: resultJson }],
              },
            };
            wsClient.send(response);
          } catch (error) {
            console.error('Failed to send tool error:', error);
          }
          updateProgressForTool(toolName, explanation, 'failed', result.error);
        }
      } else if (message.method === 'task/status') {
        // Handle task status updates (completed, failed, stopped)
        const params = message.params as { status: string; message?: string; timestamp?: string };
        const status = params?.status;
        const statusMessage = params?.message || '';

        if (status === 'completed' || status === 'failed' || status === 'stopped') {
          setState(prev => {
            chatService.setTaskState(false, null, []);
            // Find the task message and update its taskStatus
            const found = findMessageForProgress({
              messages: prev.messages,
              isTaskRunning: prev.isTaskRunning,
              currentMode: prev.currentMode,
              preferPlaceholder: true,
              requireContent: false,
            });
            const newMessages = [...prev.messages];
            if (found) {
              // Map status to taskStatus
              let taskStatus: 'done' | 'failed' | 'stopped' = 'done';
              if (status === 'failed') taskStatus = 'failed';
              else if (status === 'stopped') taskStatus = 'stopped';

              newMessages[found.index] = {
                ...found.message,
                taskStatus,
                // Add status message if provided
                ...(statusMessage && { content: statusMessage }),
              };
              chatService.setMessages(newMessages);
            }
            return {
              ...prev,
              messages: newMessages,
              isTaskRunning: false,
              activeTaskId: null,
              taskProgress: [],
            };
          });
        }
      }
    };

    const handleError = (error: Error) => {
      setState(prev => ({ ...prev, error: error.message }));
    };

    const callbacks = {
      onStatusChange: handleStatusChange,
      onMessage: handleMessage,
      onError: handleError,
    };

    wsClient.addCallbacks(callbacks);

    return () => {
      wsClient.removeCallbacks(callbacks);
    };
  }, [updateProgressForTool]);

  // Action Implementations
  const setTaskState = useCallback(
    (payload: { activeTaskId: string | null; isTaskRunning: boolean; taskProgress?: TaskProgress[] }) => {
      setState(prev => {
        chatService.setTaskState(payload.isTaskRunning, payload.activeTaskId, payload.taskProgress || []);
        return { ...prev, ...payload };
      });
    },
    [],
  );

  const resetState = useCallback(() => {
    chatService.clearMessages();
    setState(prev => ({
      ...prev,
      messages: [],
      isTaskRunning: false,
      activeTaskId: null,
      taskProgress: [],
      error: undefined,
    }));
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setState(prev => {
      chatService.addMessage(message);
      return { ...prev, messages: [...prev.messages, message] };
    });
  }, []);

  // Implement actual sendMessage logic using API service
  const sendMessage = useCallback(
    async (
      content: string,
      mode?: InstructionType,
      connectionId?: number,
      question?: string,
      skipUserMessage?: boolean,
    ) => {
      // Attempt to reload config if missing (e.g. from localStorage)
      let config = configManager.getConfig();
      if (!config) {
        config = configManager.loadConfig();
      }

      if (!config || (!config.mtxId && !config.mtxKey && !config.mtxAgent)) {
        console.error('Config not loaded or incomplete');
        // We could fallback to throwing error or showing UI error here
        const errorMsg = createAgentMessage(
          'Configuration error: Missing API credentials. Please check your widget settings.',
        );
        addMessage(errorMsg);
        return;
      }

      // Add user message if not skipped
      if (!skipUserMessage) {
        const userMsg = createUserMessage(content, mode || state.currentMode);
        addMessage(userMsg);
      }

      // Create placeholder message
      const placeholderId = `temp-${Date.now()}`;
      const placeholderMsg: ChatMessage = {
        id: placeholderId,
        content: '',
        sender: 'agent',
        timestamp: new Date(),
        mode: mode || state.currentMode,
        isPlaceholder: true,
        placeholderState: 'thinking',
        parts: [],
      };
      // Add thinking marker for the active message logic to work
      placeholderMsg.content = addThinkingMarker('');
      addMessage(placeholderMsg);

      setState(prev => ({ ...prev, isLoading: true }));

      // Send to API
      const apiService = new MarketrixApiService(config);
      try {
        // Override config if connectionId is provided (for chips with specific connection)
        if (connectionId) {
          apiService.updateConfig({ mtxApp: connectionId });
        }

        const response = await apiService.sendMessage({
          message: content,
          mode: mode || state.currentMode,
          question, // Pass question context if available (e.g. from chips)
        });

        // Connect WebSocket if not connected
        const chatId = apiService.getChatId();
        if (chatId) {
          const wsClient = WebSocketClient.getInstance(config);
          if (!wsClient.isConnected()) {
            wsClient.connect(chatId).catch(err => console.error('WebSocket connection failed:', err));
          }
        }

        // Update placeholder with final response
        setState(prev => {
          const newMessages = prev.messages.map(msg => {
            if (msg.id === placeholderId) {
              const currentParts = msg.parts || [];
              // Append response as a text part
              const newParts = [...currentParts, { type: 'text' as const, content: response.response }];

              return {
                ...msg,
                id: response.messageId, // Update to real ID
                content: response.response,
                mode: response.mode,
                timestamp: response.timestamp,
                isPlaceholder: false,
                placeholderState: undefined,
                parts: newParts,
              };
            }
            return msg;
          });

          chatService.setMessages(newMessages);
          return { ...prev, messages: newMessages };
        });

        // If task started (task_id present), update state
        if (response.task_id) {
          setState(prev => {
            // Find the placeholder message and set taskStatus to 'ongoing'
            const placeholderIndex = prev.messages.findIndex(msg => msg.id === placeholderId);
            const newMessages = [...prev.messages];
            if (placeholderIndex >= 0) {
              newMessages[placeholderIndex] = {
                ...newMessages[placeholderIndex],
                taskStatus: 'ongoing',
              };
              chatService.setMessages(newMessages);
            }
            chatService.setTaskState(true, response.task_id || null, []);
            return {
              ...prev,
              messages: newMessages,
              activeTaskId: response.task_id || null,
              isTaskRunning: true,
              taskProgress: [],
            };
          });
        }
      } catch (error) {
        console.error('Failed to send message:', error);

        // Update placeholder to show error
        setState(prev => {
          const newMessages = prev.messages.map(msg => {
            if (msg.id === placeholderId) {
              const errorMessage = "I'm sorry, I encountered an error processing your request. Please try again.";
              const currentParts = msg.parts || [];
              const newParts = [...currentParts, { type: 'text' as const, content: errorMessage }];

              return {
                ...msg,
                isPlaceholder: false,
                parts: newParts,
                content: errorMessage,
              };
            }
            return msg;
          });

          chatService.setMessages(newMessages);
          return { ...prev, messages: newMessages };
        });
      } finally {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    },
    [state.currentMode, addMessage, setTaskState, state],
  );

  const actions = useMemo(
    () => ({
      setState: (payload: Partial<WidgetState>) => setState(prev => ({ ...prev, ...payload })),
      toggleWidget: () =>
        setState(prev => {
          const newState = {
            ...prev,
            isOpen: !prev.isOpen,
            isMinimized: !prev.isOpen ? false : true,
          };
          chatService.setWidgetState(newState.isOpen, newState.isMinimized);
          return newState;
        }),
      closeWidget: () =>
        setState(prev => {
          const newState = { ...prev, isOpen: false, isMinimized: true };
          chatService.setWidgetState(newState.isOpen, newState.isMinimized);
          return newState;
        }),
      setMode: (mode: InstructionType) =>
        setState(prev => {
          chatService.setMode(mode);
          return { ...prev, currentMode: mode };
        }),
      setLoading: (loading: boolean) => {
        chatService.setIsLoading(loading);
        setState(prev => ({ ...prev, isLoading: loading }));
      },
      setAgentAvailable: (available: boolean) => setState(prev => ({ ...prev, agentAvailable: available })),
      setError: (error: string | undefined) => setState(prev => ({ ...prev, error })),
      clearError: () => setState(prev => ({ ...prev, error: undefined })),
      setTaskState,
      addMessage,
      updateMessage: (messageId: string, updates: Partial<ChatMessage>) =>
        setState(prev => {
          chatService.updateMessage(messageId, updates);
          return {
            ...prev,
            messages: prev.messages.map(msg => (msg.id === messageId ? { ...msg, ...updates } : msg)),
          };
        }),
      removeMessage: (messageId: string) =>
        setState(prev => {
          chatService.removeMessage(messageId);
          return { ...prev, messages: prev.messages.filter(msg => msg.id !== messageId) };
        }),
      setMessages: (messages: ChatMessage[]) =>
        setState(prev => {
          chatService.setMessages(messages);
          return { ...prev, messages };
        }),
      resetState,
      stopTask: async () => {
        const taskId = state.activeTaskId;
        setState(prev => {
          // Find the task message and update its taskStatus
          const found = findMessageForProgress({
            messages: prev.messages,
            isTaskRunning: prev.isTaskRunning,
            currentMode: prev.currentMode,
            preferPlaceholder: true,
            requireContent: false,
          });
          const newMessages = [...prev.messages];
          if (found) {
            newMessages[found.index] = {
              ...found.message,
              taskStatus: 'stopped',
            };
            chatService.setMessages(newMessages);
          }
          chatService.setTaskState(false, null, []);
          return {
            ...prev,
            messages: newMessages,
            isTaskRunning: false,
            activeTaskId: null,
            taskProgress: [],
          };
        });

        // Attempt to reload config if missing
        let config = configManager.getConfig();
        if (!config) {
          config = configManager.loadConfig();
        }

        if (config) {
          try {
            const apiService = new MarketrixApiService(config);
            await apiService.stopTask(taskId || undefined);
          } catch (error) {
            console.error('Failed to stop task remotely:', error);
          }
        }
      },
      clearChatHistory: resetState,
      sendMessage,
    }),
    [state.currentMode, setTaskState, resetState, addMessage, sendMessage],
  );

  return <WidgetContext.Provider value={{ state, actions }}>{children}</WidgetContext.Provider>;
};

export const useWidgetContext = () => {
  const context = useContext(WidgetContext);
  if (context === undefined) {
    throw new Error('useWidgetContext must be used within a WidgetProvider');
  }
  return context;
};
