/**
 * Support Widget contracts for settings, public boot, CRUD, and live chat.
 * They define the event and command vocabulary while keeping credentials out of public responses.
 */

import { eventIterator, oc } from '@orpc/contract';
import { z } from 'zod';

import {
  ByApplicationIdSchema,
  discriminatedUnionOfRecord,
  IdSchema,
  paginatedListOf,
  PaginationSchema,
  SuccessSchema,
} from './common';
import { RrwebEventSchema } from './rrweb';
import { NonBlankStringSchema } from './schemaRules';
import { SimulationStatusSchema } from './simulationStatus';
import {
  ApplicationWidgetEntitySchema,
  ApplicationWidgetPublicSchema,
  InstructionTypeSchema,
  WidgetSettingsWriteSchema,
} from './widgetSettings';
import type { WIDGET_TOOL_NAMES } from './widgetToolNames';

const WidgetWriteSchema = z.strictObject({
  application_id: IdSchema,
  settings: WidgetSettingsWriteSchema.partial().optional(),
});
export type WidgetWriteData = z.infer<typeof WidgetWriteSchema>;

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

const WidgetToolArgsSchemas = {
  get_html: WidgetEmptyArgsSchema,
  get_screenshot: WidgetEmptyArgsSchema,
  click_element: z.strictObject({ index: WidgetElementIndexSchema }),
  navigate: z.strictObject({ url: z.string(), new_tab: z.boolean() }),
  type_text: z.strictObject({ index: WidgetElementIndexSchema, text: z.string(), clear: z.boolean() }),
  scroll: z.strictObject({ direction: z.enum(['up', 'down']), pages: z.number().positive() }),
  scroll_to_text: z.strictObject({ text: z.string() }),
  extract: z.strictObject({ extract_links: z.boolean() }),
  go_back: WidgetEmptyArgsSchema,
  send_keys: WidgetSendKeysArgsSchema,
  close_tab: WidgetEmptyArgsSchema,
  select_dropdown_option: z.strictObject({ index: WidgetElementIndexSchema, option: z.string() }),
  get_dropdown_options: z.strictObject({ index: WidgetElementIndexSchema }),
  wait: z.strictObject({ seconds: z.number().min(0.1).max(30) }),
  search: z.strictObject({ query: z.string(), engine: z.enum(['duckduckgo', 'google', 'bing']) }),
  done: z.strictObject({ message: z.string(), success: z.boolean() }),
} as const satisfies Record<WidgetToolName, z.ZodType>;

type WidgetToolName = (typeof WIDGET_TOOL_NAMES)[number];

const widgetToolCall = <Name extends WidgetToolName>(browserTool: Name) =>
  z.strictObject({
    type: z.literal('tool/call'),
    request_id: z.string().optional(),
    tool_call_id: z.string(),
    browser_tool: z.literal(browserTool),
    args: WidgetToolArgsSchemas[browserTool],
    mode: InstructionTypeSchema.exclude(['tell']),
    explanation: z.string().optional(),
  });

const WidgetToolCallSchemas = {
  get_html: widgetToolCall('get_html'),
  get_screenshot: widgetToolCall('get_screenshot'),
  click_element: widgetToolCall('click_element'),
  navigate: widgetToolCall('navigate'),
  type_text: widgetToolCall('type_text'),
  scroll: widgetToolCall('scroll'),
  scroll_to_text: widgetToolCall('scroll_to_text'),
  extract: widgetToolCall('extract'),
  go_back: widgetToolCall('go_back'),
  send_keys: widgetToolCall('send_keys'),
  close_tab: widgetToolCall('close_tab'),
  select_dropdown_option: widgetToolCall('select_dropdown_option'),
  get_dropdown_options: widgetToolCall('get_dropdown_options'),
  wait: widgetToolCall('wait'),
  search: widgetToolCall('search'),
  done: widgetToolCall('done'),
} satisfies Record<WidgetToolName, z.ZodObject>;

export const WidgetToolCallEventSchema = discriminatedUnionOfRecord('browser_tool', WidgetToolCallSchemas);

export const WidgetEventSchema = z.union([
  z.strictObject({ type: z.literal('registered'), chat_id: z.string() }),
  z.strictObject({ type: z.literal('heartbeat') }),
  z.strictObject({ type: z.literal(['chat/response', 'chat/delta']), request_id: z.string(), text: z.string() }),
  z.strictObject({
    type: z.literal('chat/error'),
    request_id: z.string(),
    error: z.string(),
  }),
  z.strictObject({
    type: z.literal('task/status'),
    request_id: z.string().optional(),
    status: SimulationStatusSchema.exclude(['queued']),
    message: z.string().optional(),
  }),
  WidgetToolCallEventSchema,
]);
export type WidgetEvent = z.infer<typeof WidgetEventSchema>;

export const WidgetToolResultSchema = z.union([
  z.strictObject({ text: z.string() }),
  z.strictObject({
    title: z.string(),
    url: z.string(),
    text: z.string(),
    links: z.array(z.strictObject({ text: z.string(), href: z.string().nullable() })),
  }),
  z.strictObject({ options: z.array(z.strictObject({ value: z.string(), text: z.string() })) }),
  z.strictObject({ page_reloaded: z.literal(true) }),
]);
export type WidgetToolResult = z.infer<typeof WidgetToolResultSchema>;

export const WidgetCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal(['chat/tell', 'chat/show', 'chat/do']),
    request_id: z.string(),
    content: z.string(),
  }),
  z.strictObject({ type: z.literal('chat/stop') }),
  z.discriminatedUnion('success', [
    z.strictObject({
      type: z.literal('tool/response'),
      tool_call_id: z.string(),
      success: z.literal(true),
      result: WidgetToolResultSchema,
    }),
    z.strictObject({
      type: z.literal('tool/response'),
      tool_call_id: z.string(),
      success: z.literal(false),
      error: z.string(),
    }),
  ]),
  z.strictObject({
    type: z.literal('rrweb/metadata'),
    rrweb_session_id: z.string(),
    url: NonBlankStringSchema,
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

export const widgetCreate = oc.input(WidgetWriteSchema).output(ApplicationWidgetEntitySchema);

export const widgetGet = oc.input(ByApplicationIdSchema).output(ApplicationWidgetEntitySchema.nullable());

export const widgetPublicSearch = oc
  .input(
    z
      .strictObject({
        marketrix_id: NonBlankStringSchema,
        marketrix_key: NonBlankStringSchema,
      })
      .extend(PaginationSchema.shape),
  )
  .output(paginatedListOf(ApplicationWidgetPublicSchema));

export const widgetUpdate = oc.input(WidgetWriteSchema).output(ApplicationWidgetEntitySchema);

export const widgetDelete = oc.input(ByApplicationIdSchema).output(SuccessSchema);

export const widgetStream = oc
  .input(
    z.strictObject({
      chat_id: z.string(),
      tab_id: z.string().optional(),
      marketrix_id: NonBlankStringSchema,
      marketrix_key: NonBlankStringSchema,
    }),
  )
  .output(eventIterator(WidgetEventSchema));

export const widgetMessagePost = oc
  .input(
    z.strictObject({
      chat_id: z.string(),
      tab_id: z.string().optional(),
      command: WidgetCommandSchema,
    }),
  )
  .output(SuccessSchema);
