/**
 * The four closed vocabularies an activity-log row's shape is keyed on — `type` (what happened),
 * the two enums that ride INSIDE some per-type metadata shapes (`ApplicationTypeSchema`,
 * `WidgetTypeSchema`), and `SlackCommandLogStatusSchema` (the `slack_command` metadata's `status`,
 * and `contracts/slack.ts`'s command-log entity status — one home per `tests/unit/contractEnumHomes.test.ts`).
 * Split out of `contracts/entities.ts` into this dependency-free leaf — no `@orpc/contract` import —
 * so `contracts/activityLogMetadata.ts`'s per-type registry can import them without cycling back
 * through `entities.ts`, which needs the registry to type `ActivityLogEntitySchema.metadata`
 * precisely instead of `.passthrough()`, and so an audience that never touches oRPC contract routes
 * (the internal/monitor mirror) doesn't pull `@orpc/contract` in through the metadata registry.
 * `entities.ts` re-exports the first three (unchanged); `SlackCommandLogStatusSchema` is new here and
 * has no `entities.ts` re-export since nothing imported it from there before.
 */
import { z } from 'zod';

export const ApplicationTypeSchema = z.enum(['app', 'website']);
export type ApplicationType = z.infer<typeof ApplicationTypeSchema>;

export const WidgetTypeSchema = z.enum(['widget']);
export type WidgetType = z.infer<typeof WidgetTypeSchema>;

export const ActivityLogTypeSchema = z.enum([
  'update_workspace',
  'update_user',
  'create_application',
  'update_application',
  'delete_application',
  'create_widget',
  'update_widget',
  'delete_widget',
  'create_knowledge',
  'update_knowledge',
  'delete_knowledge',
  // Exactly two membership verbs: someone REQUESTS membership, an admin INVITES them — no approving;
  // a request is answered with a WorkOS invitation or not at all, and it still must be accepted.
  'request_membership',
  'invite_user',
  // Workspace + subscription lifecycle — the transparency record a customer reads in settings, so
  // SYSTEM actions (Stripe webhooks) write these too with `user_id: null` rather than a fabricated admin.
  'create_workspace',
  'trial_started',
  'trial_ending_soon',
  'trial_ended',
  'subscription_created',
  'subscription_canceled',
  'plan_changed',
  'payment_succeeded',
  'payment_failed',
  'widget_question',
  'start_simulation',
  'create_workflow',
  'update_workflow',
  'delete_workflow',
  'toggle_workflow',
  'slack_command',
  'publish_survey',
  'unpublish_survey',
  'delete_survey_response',
]);
export type ActivityLogType = z.infer<typeof ActivityLogTypeSchema>;

export const SlackCommandLogStatusSchema = z.enum(['received', 'classifying', 'dispatched', 'completed', 'failed']);
