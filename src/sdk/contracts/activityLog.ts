import { oc } from '@orpc/contract';
import { z } from 'zod';

import { paginatedListOf, PaginationSchema } from './common';
import { ActivityLogCreateSchema, ActivityLogEntitySchema, ActivityLogTypeSchema } from './entities';

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
      })
      .extend(PaginationSchema.shape),
  )
  .output(paginatedListOf(ActivityLogEntitySchema));

export const activityLogRoutes = {
  activityLogCreate,
  activityLogSearch,
};
