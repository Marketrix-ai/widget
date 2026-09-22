/**
 * Support Widget contracts for settings, public boot, CRUD, and live chat.
 * They define the event and command vocabulary while keeping credentials out of public responses.
 */

import { eventIterator, oc } from '@orpc/contract';
import { z } from 'zod';

import { paginatedListOf, PaginationSchema, RrwebEventSchema, SuccessSchema } from './common';
import {
  ApplicationWidgetEntitySchema,
  ApplicationWidgetPublicSchema,
  WidgetSettingsDataSchema,
  WidgetSettingsWriteSchema,
  WidgetTypeSchema,
} from './entities';

export const WidgetCreateSchema = z.strictObject({
  application_id: z.number().positive(),
  settings: WidgetSettingsWriteSchema.optional(),
});
export type WidgetCreateData = z.infer<typeof WidgetCreateSchema>;

export const WidgetUpdateSchema = z.strictObject({
  application_id: z.number(),
  settings: WidgetSettingsWriteSchema.optional(),
  marketrix_id: z.string().max(100).optional(),
  marketrix_key: z.string().max(100).optional(),
});
export type WidgetUpdateData = z.infer<typeof WidgetUpdateSchema>;

const widgetToolCall = <const Name extends string, Args extends z.ZodType>(browserTool: Name, args: Args) =>
  z.strictObject({
    type: z.literal('tool/call'),
    tool_call_id: z.string(),
    browser_tool: z.literal(browserTool),
    args,
    mode: z.enum(['show', 'do']).optional(),
    explanation: z.string().optional(),
  });

const WidgetElementIndexSchema = z.number().int().nonnegative();
const WidgetEmptyArgsSchema = z.strictObject({});
const WidgetSendKeysArgsSchema = z.strictObject({
  index: WidgetElementIndexSchema,
  keys: z.enum([
    'Escape',
    'Enter',
    'Tab',
    'PageDown',
    'PageUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Backspace',
    'Delete',
    'Home',
    'End',
    'Space',
  ]),
});

export const WidgetToolNameSchema = z.enum([
  'get_html',
  'get_screenshot',
  'click_element',
  'navigate',
  'type_text',
  'scroll',
  'scroll_to_text',
  'extract',
  'go_back',
  'send_keys',
  'close_tab',
  'select_dropdown_option',
  'get_dropdown_options',
  'wait',
  'search',
  'done',
]);

const WidgetToolArgsSchemas = {
  get_html: WidgetEmptyArgsSchema,
  get_screenshot: WidgetEmptyArgsSchema,
  click_element: z.strictObject({ index: WidgetElementIndexSchema }),
  navigate: z.strictObject({ url: z.string(), new_tab: z.boolean() }),
  type_text: z.strictObject({ index: WidgetElementIndexSchema, text: z.string(), clear: z.boolean() }),
  scroll: z.strictObject({ direction: z.enum(['up', 'down']), pages: z.number().positive() }),
  scroll_to_text: z.strictObject({ text: z.string() }),
  extract: z.strictObject({ query: z.string(), extract_links: z.boolean() }),
  go_back: WidgetEmptyArgsSchema,
  send_keys: WidgetSendKeysArgsSchema,
  close_tab: WidgetEmptyArgsSchema,
  select_dropdown_option: z.strictObject({ index: WidgetElementIndexSchema, option: z.string() }),
  get_dropdown_options: z.strictObject({ index: WidgetElementIndexSchema }),
  wait: z.strictObject({ seconds: z.number().min(0.1).max(30) }),
  search: z.strictObject({ query: z.string(), engine: z.enum(['duckduckgo', 'google', 'bing']) }),
  done: z.strictObject({ message: z.string(), success: z.boolean() }),
} as const;

export const widgetToolInputSchema = (toolName: string) =>
  z.strictObject({ args: WidgetToolArgsSchemas[WidgetToolNameSchema.parse(toolName)] });

export const WidgetToolCallEventSchema = z.discriminatedUnion('browser_tool', [
  widgetToolCall('get_html', WidgetToolArgsSchemas.get_html),
  widgetToolCall('get_screenshot', WidgetToolArgsSchemas.get_screenshot),
  widgetToolCall('click_element', WidgetToolArgsSchemas.click_element),
  widgetToolCall('navigate', WidgetToolArgsSchemas.navigate),
  widgetToolCall('type_text', WidgetToolArgsSchemas.type_text),
  widgetToolCall('scroll', WidgetToolArgsSchemas.scroll),
  widgetToolCall('scroll_to_text', WidgetToolArgsSchemas.scroll_to_text),
  widgetToolCall('extract', WidgetToolArgsSchemas.extract),
  widgetToolCall('go_back', WidgetToolArgsSchemas.go_back),
  widgetToolCall('send_keys', WidgetToolArgsSchemas.send_keys),
  widgetToolCall('close_tab', WidgetToolArgsSchemas.close_tab),
  widgetToolCall('select_dropdown_option', WidgetToolArgsSchemas.select_dropdown_option),
  widgetToolCall('get_dropdown_options', WidgetToolArgsSchemas.get_dropdown_options),
  widgetToolCall('wait', WidgetToolArgsSchemas.wait),
  widgetToolCall('search', WidgetToolArgsSchemas.search),
  widgetToolCall('done', WidgetToolArgsSchemas.done),
]);

export const WidgetEventSchema = z.union([
  z.strictObject({ type: z.literal('registered'), chat_id: z.string() }),
  z.strictObject({ type: z.literal('heartbeat') }),
  z.strictObject({
    type: z.literal('chat/response'),
    request_id: z.string(),
    text: z.string(),
  }),
  z.strictObject({
    type: z.literal('chat/delta'),
    request_id: z.string(),
    text: z.string(),
  }),
  z.strictObject({
    type: z.literal('chat/error'),
    request_id: z.string(),
    error: z.string(),
  }),
  z.strictObject({
    type: z.literal('task/status'),
    status: z.enum(['running', 'completed', 'failed', 'stopped', 'has_question']),
    message: z.string().optional(),
  }),
  WidgetToolCallEventSchema,
]);
export type WidgetEvent = z.infer<typeof WidgetEventSchema>;

export const WidgetCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('chat/tell'), request_id: z.string(), content: z.string() }),
  z.strictObject({ type: z.literal('chat/show'), request_id: z.string(), content: z.string() }),
  z.strictObject({ type: z.literal('chat/do'), request_id: z.string(), content: z.string() }),
  z.strictObject({ type: z.literal('chat/stop') }),
  z.strictObject({
    type: z.literal('tool/response'),
    tool_call_id: z.string(),
    success: z.boolean(),
    data: z.string().optional(),
    error: z.string().optional(),
  }),
  z.strictObject({
    type: z.literal('rrweb/metadata'),
    rrweb_session_id: z.string(),
    chat_id: z.string(),
    application_id: z.number(),
    url: z.string().optional(),
    timestamp: z.number().optional(),
    viewport: z
      .strictObject({
        width: z.number(),
        height: z.number(),
      })
      .optional(),
  }),
  z.strictObject({
    type: z.literal('rrweb/events'),
    rrweb_session_id: z.string(),
    events: z.array(RrwebEventSchema),
  }),
]);
export type WidgetCommand = z.infer<typeof WidgetCommandSchema>;

export const widgetCreate = oc
  .route({
    method: 'POST',
    tags: ['Widget'],
    path: '/widgets',
    summary: 'Create a new widget',
    description: 'Enables the widget for an application and returns the created entity. Requires an application_id.',
  })
  .input(WidgetCreateSchema)
  .output(ApplicationWidgetEntitySchema);

export const widgetSearch = oc
  .route({
    method: 'GET',
    tags: ['Widget'],
    path: '/widgets',
    summary: 'Search widgets for workspace',
    description: 'Search the calling workspace’s widgets by application (dashboard-only; session-scoped)',
  })
  .input(
    z
      .strictObject({
        application_id: z.number().optional(),
      })
      .extend(PaginationSchema.shape),
  )
  .output(paginatedListOf(ApplicationWidgetEntitySchema));

export const widgetPublicSearch = oc
  .route({
    method: 'GET',
    tags: ['Widget'],
    path: '/widgets/public',
    summary: 'Resolve a widget by its embed credentials',
    description: 'Session-less lookup by marketrix_id + marketrix_key, for the widget boot call',
  })
  .input(
    z
      .strictObject({
        marketrix_id: z.string(),
        marketrix_key: z.string(),
      })
      .extend(PaginationSchema.shape),
  )
  .output(paginatedListOf(ApplicationWidgetPublicSchema));

export const widgetDefaultGet = oc
  .route({
    method: 'GET',
    tags: ['Widget'],
    path: '/widgets/defaults/{type}',
    summary: 'Get default settings for widget type',
    description: 'Returns default settings for the specified widget type',
  })
  .input(z.strictObject({ type: WidgetTypeSchema }))
  .output(WidgetSettingsDataSchema);

export const widgetUpdate = oc
  .route({
    method: 'PUT',
    tags: ['Widget'],
    path: '/widgets/{application_id}',
    summary: 'Update widget',
    description: 'Updates widget settings and configuration',
  })
  .input(WidgetUpdateSchema)
  .output(ApplicationWidgetEntitySchema);

export const widgetDelete = oc
  .route({
    method: 'DELETE',
    tags: ['Widget'],
    path: '/widgets/{application_id}',
    summary: 'Delete widget',
    description: 'Permanently disables the widget for an application. This action cannot be undone.',
  })
  .input(z.strictObject({ application_id: z.number() }))
  .output(z.strictObject({ success: z.literal(true) }));

export const widgetStream = oc
  .route({
    method: 'GET',
    tags: ['Widget'],
    path: '/widget/stream',
    summary: 'SSE stream for real-time widget events',
    description:
      'Typed event stream delivering tool calls, task status updates, chat responses, and registration confirmation.',
  })
  .input(
    z.strictObject({
      chat_id: z.string(),
      tab_id: z.string().optional(),
      marketrix_id: z.string(),
      marketrix_key: z.string(),
      user_id: z.number().optional(),
    }),
  )
  .output(eventIterator(WidgetEventSchema));

export const widgetMessagePost = oc
  .route({
    method: 'POST',
    tags: ['Widget'],
    path: '/widget/message',
    summary: 'Send a typed command from widget to server',
    description: 'Receives chat commands, tool responses, and keepalive pings from the widget.',
  })
  .input(
    z.strictObject({
      chat_id: z.string(),
      tab_id: z.string().optional(),
      command: WidgetCommandSchema,
    }),
  )
  .output(SuccessSchema);

export const widgetRoutes = {
  widgetCreate,
  widgetSearch,
  widgetPublicSearch,
  widgetDefaultGet,
  widgetUpdate,
  widgetDelete,
  widgetStream,
  widgetMessagePost,
};
