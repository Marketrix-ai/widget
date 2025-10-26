import { useCallback, useEffect, useRef, useState } from 'react';

import MarketrixApiService from '../services/api';
import DemoApiService from '../services/demo-api';
import type { ChatMessage, ChatMode, MarketrixConfig, WidgetState } from '../types';

interface UseMarketrixWidgetProps {
  config: MarketrixConfig;
}

export const useMarketrixWidget = ({ config }: UseMarketrixWidgetProps) => {
  const [state, setState] = useState<WidgetState>({
    isOpen: false,
    isMinimized: false,
    isLoading: false,
    messages: [],
    currentMode: 'tell',
    agentAvailable: false,
  });

  const apiServiceRef = useRef<MarketrixApiService | DemoApiService | null>(null);

  // Initialize API service (use demo service for demo mode)
  useEffect(() => {
    const isDemoMode =
      config.marketrixId === 'demo-marketrix-id' || config.marketrixKey === 'demo-marketrix-key';
    apiServiceRef.current = isDemoMode
      ? new DemoApiService(config)
      : new MarketrixApiService(config);

    // Check agent availability on mount
    checkAgentAvailability();

    // Get agent info from API
    getAgentInfo();
  }, [config.marketrixId, config.marketrixKey]);

  const checkAgentAvailability = useCallback(async () => {
    if (!apiServiceRef.current) return;

    try {
      const available = await apiServiceRef.current.checkAgentAvailability();
      setState((prev) => ({ ...prev, agentAvailable: available }));
    } catch (error) {
      console.error('Failed to check agent availability:', error);
      setState((prev) => ({ ...prev, agentAvailable: false }));
    }
  }, []);

  const getAgentInfo = useCallback(async () => {
    if (!apiServiceRef.current) return;

    try {
      const agentInfo = await apiServiceRef.current.getAgentInfo();
      if (agentInfo) {
        // Agent info is now handled through atmosphere config
        // No need to update config with agent info
      }
    } catch (error) {
      console.error('Failed to get agent info:', error);
    }
  }, []);

  const toggleWidget = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: !prev.isOpen,
      isMinimized: false,
    }));
  }, []);

  const minimizeWidget = useCallback(() => {
    setState((prev) => ({ ...prev, isMinimized: true }));
  }, []);

  const maximizeWidget = useCallback(() => {
    setState((prev) => ({ ...prev, isMinimized: false }));
  }, []);

  const closeWidget = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
      isMinimized: false,
    }));
  }, []);

  const setMode = useCallback((mode: ChatMode) => {
    setState((prev) => ({ ...prev, currentMode: mode }));
  }, []);

  const sendMessage = useCallback(
    async (content: string, mode?: ChatMode, connectionId?: number, question?: string) => {
      if (!apiServiceRef.current || !content.trim()) return;

      const messageMode = mode || state.currentMode;
      const messageId = Date.now().toString();
      const userMessage: ChatMessage = {
        id: messageId,
        content: content.trim(),
        sender: 'user',
        timestamp: new Date(),
        mode: messageMode,
      };

      // Add user message immediately
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isLoading: true,
      }));

      try {
        const response = await apiServiceRef.current.sendMessage({
          message: content.trim(),
          mode: messageMode,
          connection_id: connectionId,
          question: question,
        });

        const agentMessage: ChatMessage = {
          id: response.messageId,
          content: response.response,
          sender: 'agent',
          timestamp: response.timestamp,
          mode: response.mode,
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, agentMessage],
          isLoading: false,
        }));
      } catch (error) {
        console.error('Failed to send message:', error);

        const errorMessage: ChatMessage = {
          id: `error-${messageId}`,
          content: 'Sorry, I encountered an error. Please try again.',
          sender: 'agent',
          timestamp: new Date(),
          mode: messageMode,
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, errorMessage],
          isLoading: false,
          error: 'Failed to send message',
        }));
      }
    },
    [state.currentMode]
  );

  const clearMessages = useCallback(() => {
    setState((prev) => ({ ...prev, messages: [] }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: undefined }));
  }, []);

  const setDemoContext = useCallback((context: string | null) => {
    if (apiServiceRef.current && apiServiceRef.current instanceof DemoApiService) {
      apiServiceRef.current.setCurrentContext(context);
    }
  }, []);

  const getDemoContextMessage = useCallback((elementType: string) => {
    if (apiServiceRef.current && apiServiceRef.current instanceof DemoApiService) {
      return apiServiceRef.current.getContextMessage(elementType);
    }
    return null;
  }, []);

  return {
    state,
    actions: {
      toggleWidget,
      minimizeWidget,
      maximizeWidget,
      closeWidget,
      setMode,
      sendMessage,
      clearMessages,
      clearError,
      checkAgentAvailability,
      setDemoContext,
      getDemoContextMessage,
    },
  };
};
