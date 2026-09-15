import { oc } from '@orpc/contract';
import { z } from 'zod';

import { paginatedListOf, PaginationSchema } from './common';

export const SlackCommandLogStatusSchema = z.enum(['received', 'classifying', 'dispatched', 'completed', 'failed']);

// `workspace_id`, `error_message` and `updated_at` dropped: `SlackCapabilities.tsx` (the one reader)
// renders only `id`/`created_at`/`raw_text`/`detected_intent`/`duration_ms`/`status`.
export const SlackCommandLogEntitySchema = z.object({
  id: z.number(),
  raw_text: z.string(),
  detected_intent: z.string(),
  status: SlackCommandLogStatusSchema,
  duration_ms: z.number().nullable(),
  created_at: z.coerce.date().optional(),
});
export type SlackCommandLogData = z.infer<typeof SlackCommandLogEntitySchema>;

export const SlackCommandLogSearchSchema = PaginationSchema.extend({
  intent: z.string().optional(),
  limit: z.coerce.number().optional().default(20),
});

export const SlackCapabilitySchema = z.object({
  intent: z.string(),
  name: z.string(),
  description: z.string(),
  example: z.string(),
  execution_count: z.number(),
  last_used: z.string().nullable(),
});
export type SlackCapabilityData = z.infer<typeof SlackCapabilitySchema>;

export const slackCommandLogSearch = oc
  .route({
    method: 'GET',
    tags: ['Slack'],
    path: '/slack/command-log',
    summary: 'Search slash command logs',
  })
  .input(SlackCommandLogSearchSchema)
  .output(paginatedListOf(SlackCommandLogEntitySchema));

export const slackCapabilitySearch = oc
  .route({
    method: 'GET',
    tags: ['Slack'],
    path: '/slack/capabilities',
    summary: 'Get Slack capability stats',
  })
  .output(z.array(SlackCapabilitySchema));

export const slackRoutes = {
  slackCommandLogSearch,
  slackCapabilitySearch,
};
