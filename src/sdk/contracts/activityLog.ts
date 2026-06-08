import { oc } from '@orpc/contract';
import { z } from 'zod';

import { paginatedListOf, PaginationSchema } from './common';
import { ActionLogCreateSchema, ActionLogEntitySchema, ActionLogTypeSchema } from './entities';

export const activityLogCreate = oc
  .route({
    method: 'POST',
    tags: ['Activity Log'],
    path: '/log',
    summary: 'Create new activity log entry',
    description: 'Records user or system action for auditing and tracking purposes',
  })
  .input(ActionLogCreateSchema)
  .output(ActionLogEntitySchema);

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
        type: ActionLogTypeSchema.optional(),
        application_id: z.coerce.number().optional(),
      })
      .extend(PaginationSchema.shape),
  )
  .output(paginatedListOf(ActionLogEntitySchema));

export const activityLogRoutes = {
  activityLogCreate,
  activityLogSearch,
};
