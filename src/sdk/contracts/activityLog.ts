import { oc } from '@orpc/contract';
import { z } from 'zod';

import { paginatedListOf, PaginationSchema, SuccessSchema } from './common';
import { ActivityLogEntitySchema, ActivityLogTypeSchema, WidgetQuestionLogSchema } from './entities';

/**
 * How long an activity row is kept. The timeline is informational, not an audit record, so it is
 * bounded rather than grown forever. It lives on the contract because the reader clamp, the purge cron
 * and the retention notice shown to the customer must all quote the SAME number.
 */
export const ACTIVITY_RETENTION_DAYS = 90;

export const activityLogCreate = oc
  .route({
    method: 'POST',
    tags: ['Activity Log'],
    path: '/log',
    summary: 'Log a widget question',
    description: 'Records a question asked through the widget, authenticated by the widget credentials it carries',
  })
  .input(WidgetQuestionLogSchema)
  .output(SuccessSchema);

export const activityLogSearch = oc
  .route({
    method: 'GET',
    tags: ['Activity Log'],
    path: '/log',
    summary: 'Search and filter activity logs',
    description:
      'Returns activity logs newest first, matching the workspace, any of `types`, an application, or only the ' +
      "caller's own. `types` takes several values so a page showing a few kinds reads them in one request.",
  })
  .input(
    z
      .object({
        workspace_id: z.coerce.number().optional(),
        types: z.array(ActivityLogTypeSchema).min(1).optional(),
        application_id: z.coerce.number().optional(),
        /** Restrict to the caller's OWN activity. A flag rather than a user_id so one member can never read another's. */
        mine: z.coerce.boolean().optional(),
      })
      .extend(PaginationSchema.shape),
  )
  .output(paginatedListOf(ActivityLogEntitySchema));

export const activityLogRoutes = {
  activityLogCreate,
  activityLogSearch,
};
