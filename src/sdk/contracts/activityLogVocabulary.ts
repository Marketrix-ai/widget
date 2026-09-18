/**
 * Closed vocabularies used across activity log rows: application and widget types, every activity
 * `type` value, and Slack command log status. Kept dependency-free so other contract files can use
 * them without pulling in unrelated imports.
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
  'request_membership',
  'invite_user',
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
