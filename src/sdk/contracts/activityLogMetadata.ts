/**
 * `ActivityMetadataByType` — the strict, per-`ActivityLogType` shape of `activity_log.metadata`, the
 * one write-time gate `models/columnSchemas.ts` registers against the column. Moved out of that file
 * so `contracts/entities.ts` can import it to type `ActivityLogEntitySchema.metadata` precisely
 * (a union of every branch) instead of the open `.passthrough()` it carried before — deriving from a
 * registry that lived inside `models/columnSchemas.ts`, which itself imports from `entities.ts`,
 * would have cycled.
 *
 * `slack_command`'s `status` imports `contracts/slack.ts`'s `SlackCommandLogStatusSchema` — the one
 * home `tests/unit/contractEnumHomes.test.ts` requires for that value set — which pulls `slack.ts`
 * into `entities.ts`'s import closure for the first time. See the header this file's own header points
 * to for what that costs each consumer audience.
 */
import { z } from 'zod';

import { type ActivityLogType, ApplicationTypeSchema, WidgetTypeSchema } from './activityLogVocabulary';
import { SlackCommandLogStatusSchema } from './slack';

const activity = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();
const details = { details: z.string() };
const billing = { ...details, plan: z.string().optional() };
const applicationRef = { id: z.number(), name: z.string(), type: ApplicationTypeSchema };
const widgetRef = { ...details, application_id: z.number(), widget_type: WidgetTypeSchema };
const workflowRef = { ...details, id: z.number(), name: z.string() };
const surveyRef = { ...details, survey_id: z.number() };

export const ActivityMetadataByType = {
  update_workspace: activity(details),
  update_user: z.union([
    activity({ ...details, target_user_id: z.number(), target_user_email: z.string(), reason: z.string() }),
    activity({ ...details, target_user_id: z.number() }),
  ]),
  create_application: activity(applicationRef),
  update_application: activity(applicationRef),
  delete_application: activity(applicationRef),
  create_widget: activity(widgetRef),
  update_widget: activity(widgetRef),
  delete_widget: activity(widgetRef),
  create_knowledge: activity({
    application_id: z.number(),
    file_name: z.string(),
    file_size: z.number(),
    file_type: z.string(),
    file_url: z.string(),
    source_url: z.string().optional(),
  }),
  update_knowledge: activity({
    id: z.number(),
    file_name: z.string(),
    source_url: z.string(),
    action: z.literal('refreshed'),
  }),
  delete_knowledge: activity({ id: z.number(), file_name: z.string(), file_type: z.string() }),
  request_membership: activity({ ...details, target_user_email: z.string(), reminder: z.literal(true).optional() }),
  invite_user: activity({ ...details, target_user_email: z.string() }),
  create_workspace: activity({ ...details, slug: z.string() }),
  trial_started: activity({ ...billing, subscription_id: z.string() }),
  trial_ending_soon: activity({ ...billing, subscription_id: z.string() }),
  trial_ended: activity({ ...billing, subscription_id: z.string() }),
  subscription_created: activity({ ...billing, subscription_id: z.string() }),
  subscription_canceled: activity({ ...billing, subscription_id: z.string() }),
  plan_changed: activity({ ...billing, session_id: z.string() }),
  payment_succeeded: activity({ ...billing, invoice_id: z.string() }),
  payment_failed: activity({ ...billing, invoice_id: z.string() }),
  widget_question: activity({
    application_id: z.number(),
    chat_id: z.string(),
    mode: z.string(),
    question: z.string(),
    timestamp: z.string(),
    user_id: z.number().optional(),
  }),
  start_simulation: activity({ application_id: z.number(), simulation_id: z.number() }),
  create_workflow: activity(workflowRef),
  update_workflow: activity(workflowRef),
  delete_workflow: activity(workflowRef),
  toggle_workflow: activity({ ...workflowRef, enabled: z.boolean() }),
  slack_command: activity({
    slack_user_id: z.string(),
    slack_channel_id: z.string().nullable(),
    raw_text: z.string(),
    detected_intent: z.string(),
    extracted_params: z
      .object({
        qaFlowId: z.number().optional(),
        appId: z.number().optional(),
        instructions: z.string().optional(),
        query: z.string().optional(),
        channel: z.string().optional(),
        text: z.string().optional(),
        name: z.string().optional(),
        workflowName: z.string().optional(),
      })
      .strict(),
    status: SlackCommandLogStatusSchema,
    response_text: z.string().nullable(),
    error_message: z.string().nullable(),
    duration_ms: z.number().nullable(),
  }),
  publish_survey: activity(surveyRef),
  unpublish_survey: activity(surveyRef),
  delete_survey_response: activity(surveyRef),
} satisfies Record<ActivityLogType, z.ZodType>;

export type SlackCommandMetadata = z.infer<typeof ActivityMetadataByType.slack_command>;
