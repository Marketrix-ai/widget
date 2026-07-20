import { eventIterator, oc } from '@orpc/contract';
import { z } from 'zod';

import { ByWidgetIdSchema, paginatedListOf, PaginationSchema } from './common';
import { ApplicationReadSchema, WidgetEntitySchema, WidgetSettingsDataSchema, WidgetTypeSchema } from './entities';

export const ApplicationWithWidgetsSchema = ApplicationReadSchema.extend({
  widgets: z.array(WidgetEntitySchema).optional(),
});
export type ApplicationWithWidgetsData = z.infer<typeof ApplicationWithWidgetsSchema>;

export const WidgetCreateSchema = WidgetEntitySchema.partial().extend({
  application_id: z.number().positive(),
  type: WidgetTypeSchema,
  settings: WidgetSettingsDataSchema.optional(),
});
export type WidgetCreateData = z.infer<typeof WidgetCreateSchema>;

export const WidgetUpdateSchema = WidgetEntitySchema.partial();
export type WidgetUpdateData = z.infer<typeof WidgetUpdateSchema>;

export type WidgetSettingsKey = keyof z.infer<typeof WidgetSettingsDataSchema>;

/** Server → Widget events. */
export const WidgetEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('registered'), chat_id: z.string(), application_id: z.number().optional() }),
  z.object({ type: z.literal('heartbeat') }),
  z.object({
    type: z.literal('chat/response'),
    request_id: z.string(),
    text: z.string(),
  }),
  z.object({
    // One streamed text fragment of the in-flight reply; the widget appends fragments and the
    // final chat/response (the full text) replaces the accumulated stream.
    type: z.literal('chat/delta'),
    request_id: z.string(),
    text: z.string(),
  }),
  z.object({
    type: z.literal('chat/error'),
    request_id: z.string(),
    error: z.string(),
  }),
  z.object({
    type: z.literal('task/status'),
    // Matches SimulationStatus on the agent side.
    status: z.enum(['running', 'completed', 'failed', 'stopped', 'has_question']),
    message: z.string().optional(),
    task_id: z.string().optional(),
    timestamp: z.number().optional(),
  }),
  z.object({
    type: z.literal('tool/call'),
    tool_call_id: z.string(),
    browser_tool: z.string(),
    args: z.record(z.string(), z.unknown()),
    mode: z.enum(['show', 'do']).optional(),
    explanation: z.string().optional(),
  }),
]);
export type WidgetEvent = z.infer<typeof WidgetEventSchema>;

/** Widget → Server commands. */
export const WidgetCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chat/tell'), request_id: z.string(), content: z.string() }),
  z.object({ type: z.literal('chat/show'), request_id: z.string(), content: z.string() }),
  z.object({ type: z.literal('chat/do'), request_id: z.string(), content: z.string() }),
  z.object({ type: z.literal('chat/stop'), task_id: z.string().optional() }),
  z.object({
    type: z.literal('tool/response'),
    tool_call_id: z.string(),
    success: z.boolean(),
    data: z.string().optional(),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal('rrweb/metadata'),
    rrweb_session_id: z.string(),
    chat_id: z.string(),
    application_id: z.number(),
    url: z.string().optional(),
    user_agent: z.string().optional(),
    timestamp: z.number().optional(),
    viewport: z
      .object({
        width: z.number(),
        height: z.number(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal('rrweb/events'),
    rrweb_session_id: z.string(),
    events: z.array(z.unknown()),
  }),
]);
export type WidgetCommand = z.infer<typeof WidgetCommandSchema>;

export const widgetCreate = oc
  .route({
    method: 'POST',
    tags: ['Widget'],
    path: '/widgets',
    summary: 'Create a new widget',
    description: 'Creates a new widget for an application and returns the created entity. Requires an application_id.',
  })
  .input(WidgetCreateSchema)
  .output(WidgetEntitySchema);

export const widgetSearch = oc
  .route({
    method: 'GET',
    tags: ['Widget'],
    path: '/widgets',
    summary: 'Search widgets for workspace',
    description: 'Search widgets by type, application, marketrix_id, or marketrix_key',
  })
  .input(
    z
      .object({
        type: WidgetTypeSchema.optional(),
        application_id: z.coerce.number().optional(),
        marketrix_id: z.string().optional(),
        marketrix_key: z.string().optional(),
      })
      .extend(PaginationSchema.shape),
  )
  .output(paginatedListOf(WidgetEntitySchema));

export const widgetDefaultGet = oc
  .route({
    method: 'GET',
    tags: ['Widget'],
    path: '/widgets/defaults/{type}',
    summary: 'Get default settings for widget type',
    description: 'Returns default settings for the specified widget type',
  })
  .input(z.object({ type: WidgetTypeSchema }))
  .output(WidgetSettingsDataSchema);

export const widgetUpdate = oc
  .route({
    method: 'PUT',
    tags: ['Widget'],
    path: '/widgets/{widget_id}',
    summary: 'Update widget',
    description: 'Updates widget settings and configuration',
  })
  .input(WidgetUpdateSchema.extend({ widget_id: z.coerce.number() }))
  .output(WidgetEntitySchema);

export const widgetDelete = oc
  .route({
    method: 'DELETE',
    tags: ['Widget'],
    path: '/widgets/{widget_id}',
    summary: 'Delete widget',
    description: 'Permanently deletes a widget from an application. This action cannot be undone.',
  })
  .input(ByWidgetIdSchema)
  .output(z.object({ success: z.literal(true) }));

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
    z.object({
      chat_id: z.string(),
      tab_id: z.string().optional(),
      marketrix_id: z.string().optional(),
      marketrix_key: z.string().optional(),
      application_id: z.coerce.number().optional(),
    }),
  )
  .output(eventIterator(WidgetEventSchema));

export const widgetMessage = oc
  .route({
    method: 'POST',
    tags: ['Widget'],
    path: '/widget/message',
    summary: 'Send a typed command from widget to server',
    description: 'Receives chat commands, tool responses, and keepalive pings from the widget.',
  })
  .input(
    z.object({
      chat_id: z.string(),
      tab_id: z.string().optional(),
      command: WidgetCommandSchema,
    }),
  )
  .output(z.object({ ok: z.boolean() }));

export const widgetRoutes = {
  widgetCreate,
  widgetSearch,
  widgetDefaultGet,
  widgetUpdate,
  widgetDelete,
  widgetStream,
  widgetMessage,
};
