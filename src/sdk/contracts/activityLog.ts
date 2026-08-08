import { oc } from '@orpc/contract';
import { z } from 'zod';

import { paginatedListOf, PaginationSchema } from './common';
import { ActivityLogCreateSchema, ActivityLogEntitySchema, ActivityLogTypeSchema } from './entities';

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
    summary: 'Create new activity log entry',
    description: 'Records user or system action for auditing and tracking purposes',
  })
  .input(ActivityLogCreateSchema)
  .output(ActivityLogEntitySchema);

export const activityLogSearch = oc
  .route({
    method: 'GET',
    tags: ['Activity Log'],
    path: '/log',
    summary: 'Search and filter activity logs',
    description: 'Returns list of activity logs matching search parameters (workspace, type)',
  })
  .input(
    z
      .object({
        workspace_id: z.coerce.number().optional(),
        type: ActivityLogTypeSchema.optional(),
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
