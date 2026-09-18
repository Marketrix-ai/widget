/**
 * Tests for the widget's public lifecycle (`init`/`mount`/`update`/`unmount`/preview): mounting,
 * disabled or misconfigured configs, concurrent and preview-vs-production initialization, and that a
 * config update re-mounts without losing an in-flight chat.
 */
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'bun:test';

import { initWidget, MarketrixWidgetPreview, mountWidget, unmountWidget, updateMarketrixConfig } from './index';
import type { WidgetSettingsData } from './sdk';
import { chatSessionManager } from './services/ChatSessionManager';
import * as ScreenShareService from './services/ScreenShareService';
import {
  type CredentialedConfig,
  readChatSnapshot,
  storageService,
  writeChatSnapshot,
} from './services/StorageService';
import { streamClient } from './services/StreamClient';
import * as WidgetService from './services/WidgetService';
import { agentMessage, credentialedConfig, mountTarget, validSettings } from './test/fixtures';

const expectNotMounted = (container: HTMLElement) => {
  expect(container.querySelector('.marketrix-widget-container')).toBeNull();
  expect(window.__mtx).toBeUndefined();
};

afterEach(() => {
  unmountWidget();
  vi.restoreAllMocks();
  document.head.replaceChildren();
  document.body.replaceChildren();
  window.__mtx = undefined;
});

describe('public widget lifecycle', () => {
  it('disconnects the stream on public unmount', () => {
    const disconnect = vi.spyOn(streamClient, 'disconnect');

    unmountWidget();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('ends an in-flight screen share on public unmount', () => {
    const stopScreenShare = vi.spyOn(ScreenShareService, 'stopScreenShare');

    unmountWidget();

    expect(stopScreenShare).toHaveBeenCalledTimes(1);
  });

  it('mounts programmatic preview settings without an API fetch and owns its cleanup', async () => {
    const loadConfig = vi.spyOn(WidgetService, 'loadWidgetConfig');
    const container = mountTarget();
    const replacement = mountTarget();
    const unrelated = mountTarget();
    unrelated.className = 'marketrix-widget-container';
    document.body.append(container, replacement, unrelated);

    await act(() =>
      mountWidget({
        settings: validSettings(),
        container,
      }),
    );

    expect(loadConfig).not.toHaveBeenCalled();
    expect(container.querySelector('.marketrix-widget-container')).toBeTruthy();

    await act(() =>
      mountWidget({
        settings: validSettings(),
        container: replacement,
      }),
    );

    expect(container.querySelector('.marketrix-widget-container')).toBeNull();
    expect(replacement.querySelector('.marketrix-widget-container')).toBeTruthy();

    unmountWidget();

    expect(replacement.querySelector('.marketrix-widget-container')).toBeNull();
    expect(unrelated).toBeInTheDocument();
  });

  it('a config the settings schema refuses names the fields that failed instead of mounting silently', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const container = mountTarget();
    document.body.append(container);
    const broken = {
      ...validSettings(),
      widget_position: 'middle',
    } as unknown as WidgetSettingsData;

    await act(() => mountWidget({ settings: broken, container }));

    expect(container.querySelector('.marketrix-widget-container')).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('widget_position'));
  });

  it('lets a preview invalidate pending production initialization', async () => {
    const settings = validSettings();
    let resolveProduction!: (config: CredentialedConfig) => void;
    vi.spyOn(WidgetService, 'loadWidgetConfig').mockReturnValueOnce(
      new Promise(resolve => {
        resolveProduction = resolve;
      }),
    );
    const productionContainer = mountTarget();
    const previewContainer = mountTarget();
    document.body.append(productionContainer, previewContainer);

    const production = initWidget(
      { mtxId: 'production', mtxKey: 'key', mtxApiHost: 'https://api.test' },
      productionContainer,
    );
    await act(() => mountWidget({ settings, container: previewContainer }));
    resolveProduction(credentialedConfig({ mtxId: 'production', mtxKey: 'key' }));
    await production;

    expect(productionContainer.querySelector('.marketrix-widget-container')).toBeNull();
    expect(previewContainer.querySelectorAll('.marketrix-widget-container')).toHaveLength(1);
  });

  it('refuses production init without an API host instead of posting at the host page', async () => {
    const load = vi.spyOn(WidgetService, 'loadWidgetConfig');
    const container = mountTarget();
    document.body.append(container);

    await initWidget({ mtxId: 'no-host', mtxKey: 'key' }, container);

    expect(load).not.toHaveBeenCalled();
    expectNotMounted(container);
  });

  it('stops short of mounting, connecting or recording when the resolved config is disabled', async () => {
    const load = vi
      .spyOn(WidgetService, 'loadWidgetConfig')
      .mockResolvedValue(credentialedConfig({ widget_enabled: false, mtxId: 'disabled', mtxKey: 'key' }));
    const container = mountTarget();
    document.body.append(container);

    await initWidget({ mtxId: 'disabled', mtxKey: 'key', mtxApiHost: 'https://api.test' }, container);

    expect(load).toHaveBeenCalledTimes(1);
    expectNotMounted(container);
  });

  it('cancels stale production initialization and shares one in-flight promise', async () => {
    let resolveFirst!: (config: CredentialedConfig) => void;
    let resolveSecond!: (config: CredentialedConfig) => void;
    const firstLoad = new Promise<CredentialedConfig>(resolve => {
      resolveFirst = resolve;
    });
    const secondLoad = new Promise<CredentialedConfig>(resolve => {
      resolveSecond = resolve;
    });
    vi.spyOn(WidgetService, 'loadWidgetConfig').mockReturnValueOnce(firstLoad).mockReturnValueOnce(secondLoad);
    const firstContainer = mountTarget();
    const secondContainer = mountTarget();
    const unrelated = mountTarget();
    unrelated.className = 'marketrix-widget-container';
    document.body.append(firstContainer, secondContainer, unrelated);

    const first = initWidget({ mtxId: 'first', mtxKey: 'first-key', mtxApiHost: 'https://api.test' }, firstContainer);
    const concurrent = initWidget(
      { mtxId: 'ignored', mtxKey: 'ignored-key', mtxApiHost: 'https://api.test' },
      secondContainer,
    );

    expect(concurrent).toBe(first);
    expect(WidgetService.loadWidgetConfig).toHaveBeenCalledTimes(1);

    unmountWidget();
    const second = initWidget(
      { mtxId: 'second', mtxKey: 'second-key', mtxApiHost: 'https://api.test' },
      secondContainer,
    );
    resolveFirst(credentialedConfig({ mtxId: 'first', mtxKey: 'first-key', mtxApp: 1 }));
    await first;

    expect(firstContainer.querySelector('.marketrix-widget-container')).toBeNull();
    expect(secondContainer.querySelector('.marketrix-widget-container')).toBeNull();

    resolveSecond(credentialedConfig({ mtxId: 'second', mtxKey: 'second-key', mtxApp: 2 }));
    await second;

    expect(secondContainer.querySelector('.marketrix-widget-container')).toBeTruthy();

    unmountWidget();

    expect(secondContainer.querySelector('.marketrix-widget-container')).toBeNull();
    expect(unrelated).toBeInTheDocument();
  });

  it('re-mounts an updated config into the container it was given, not the body', async () => {
    vi.spyOn(WidgetService, 'loadWidgetConfig').mockImplementation(async config =>
      credentialedConfig({ ...config, mtxApp: 1 }),
    );
    const container = mountTarget();
    document.body.append(container);

    await act(() => initWidget({ mtxId: 'first', mtxKey: 'key', mtxApiHost: 'https://api.test' }, container));
    expect(container.querySelector('.marketrix-widget-container')).toBeTruthy();

    await act(() => updateMarketrixConfig({ mtxKey: 'rotated' }));

    expect(container.querySelectorAll('.marketrix-widget-container')).toHaveLength(1);
    expect(document.body.querySelector(':scope > .marketrix-widget-container')).toBeNull();
  });

  it('keeps an imperative preview a preview when its config is updated', async () => {
    const settings = validSettings();
    const loadConfig = vi.spyOn(WidgetService, 'loadWidgetConfig');
    const container = mountTarget();
    document.body.append(container);

    await act(() => mountWidget({ settings, container }));
    await act(() => updateMarketrixConfig({ userId: 7 }));

    expect(loadConfig).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.marketrix-widget-container')).toHaveLength(1);
  });

  it('stores the credentials production was initialized with', async () => {
    vi.spyOn(WidgetService, 'loadWidgetConfig').mockImplementation(async config =>
      credentialedConfig({ ...config, mtxId: 'prod-id', mtxKey: 'prod-key', mtxApp: 1 }),
    );
    const container = mountTarget();
    document.body.appendChild(container);

    await act(() => initWidget({ mtxId: 'prod-id', mtxKey: 'prod-key', mtxApiHost: 'https://api.test' }, container));

    expect(storageService.getCredentialedConfig()).toMatchObject({ mtxId: 'prod-id', mtxKey: 'prod-key' });
  });

  it('leaves the stored production credentials alone when a preview mounts beside it', async () => {
    const settings = validSettings();
    storageService.setConfig(credentialedConfig({ mtxId: 'prod-id', mtxKey: 'prod-key' }));
    const preview = mountTarget();
    document.body.appendChild(preview);

    render(<MarketrixWidgetPreview settings={settings} container={preview} />);
    await waitFor(() => expect(preview.querySelector('.marketrix-widget-container')).toBeTruthy());

    expect(storageService.getCredentialedConfig()).toMatchObject({ mtxId: 'prod-id', mtxKey: 'prod-key' });
  });

  it('with no container prop, mounts into its own rendered div rather than beside it', async () => {
    const settings = validSettings();

    const { container: renderedRoot } = render(<MarketrixWidgetPreview settings={settings} />);
    const ownDiv = renderedRoot.firstElementChild as HTMLElement;

    await waitFor(() => expect(ownDiv.querySelector('.marketrix-widget-container')).toBeTruthy());
    expect(renderedRoot.querySelectorAll(':scope > .marketrix-widget-container')).toHaveLength(0);
  });
});

describe('a config-change re-mount preserves an in-flight chat', () => {
  it('keeps the same chat_id and transcript across updateMarketrixConfig, minting no new chat', async () => {
    vi.spyOn(WidgetService, 'loadWidgetConfig').mockImplementation(async config =>
      credentialedConfig({ ...config, mtxId: 'reflow-1', mtxApp: 1 }),
    );
    vi.spyOn(streamClient, 'connect').mockResolvedValue();
    const getOrCreateChatId = vi.spyOn(chatSessionManager, 'getOrCreateChatId');

    storageService.setConfig(credentialedConfig({ mtxId: 'reflow-1', mtxKey: 'key', mtxApp: 1 }));
    storageService.setChatId('chat-inflight-1');
    writeChatSnapshot({
      messages: [agentMessage({ parts: [{ type: 'text', content: 'still here after the config change' }] })],
      currentMode: 'tell',
      isOpen: true,
    });

    const container = mountTarget();
    document.body.appendChild(container);

    await act(() => initWidget({ mtxId: 'reflow-1', mtxKey: 'key', mtxApiHost: 'https://api.test' }, container));
    await waitFor(() => expect(getOrCreateChatId).toHaveBeenCalled());
    expect(await getOrCreateChatId.mock.results[0]?.value).toBe('chat-inflight-1');
    expect(storageService.getChatId()).toBe('chat-inflight-1');
    const messageBefore = readChatSnapshot().messages[0];
    expect(messageBefore).toBeDefined();

    getOrCreateChatId.mockClear();

    await act(() => updateMarketrixConfig({ userId: 42 }));

    await waitFor(() => expect(getOrCreateChatId).toHaveBeenCalled());
    expect(await getOrCreateChatId.mock.results[0]?.value).toBe('chat-inflight-1');
    expect(storageService.getChatId()).toBe('chat-inflight-1');
    expect(readChatSnapshot().messages).toEqual([messageBefore!]);
  });
});
