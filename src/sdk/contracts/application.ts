import { oc } from '@orpc/contract';
import { z } from 'zod';

import { ByApplicationIdSchema, paginatedListOf, PaginationSchema, SuccessSchema } from './common';
import { ApplicationEntitySchema, ApplicationReadSchema, ApplicationTypeSchema, WidgetEntitySchema } from './entities';

// ---- application-only schemas ----

export const ApplicationFilterSchema = z.object({
  application_id: z.coerce.number().optional(),
});

export const ApplicationCreateSchema = ApplicationEntitySchema.partial().extend({
  type: ApplicationTypeSchema,
  name: z.string().min(1),
  url: z.string(),
  allowed_domains: z.array(z.string()).optional().default([]),
});
export type ApplicationCreateData = z.infer<typeof ApplicationCreateSchema>;

export const ApplicationUpdateSchema = ApplicationEntitySchema.partial().omit({ workspace_id: true, slug: true });
export type ApplicationUpdateData = z.infer<typeof ApplicationUpdateSchema>;

// ---- procedures ----

export const applicationCreate = oc
  .route({
    method: 'POST',
    tags: ['Application'],
    path: '/applications',
    summary: 'Create a new application',
    description: 'Creates a new application for the authenticated workspace and returns the created entity.',
  })
  .input(ApplicationCreateSchema)
  .output(ApplicationReadSchema);

export const applicationSearch = oc
  .route({
    method: 'GET',
    tags: ['Application'],
    path: '/applications',
    summary: 'Search applications for workspace',
    description:
      'Returns applications for the authenticated workspace, optionally filtered by type, always includes widgets',
  })
  .input(
    z
      .object({
        type: ApplicationTypeSchema.optional(),
        include: z.array(z.enum(['widgets'])).optional(),
      })
      .extend(PaginationSchema.shape),
  )
  .output(
    paginatedListOf(
      ApplicationReadSchema.extend({
        widgets: z.array(WidgetEntitySchema).optional(),
      }),
    ),
  );

export const applicationGet = oc
  .route({
    method: 'GET',
    tags: ['Application'],
    path: '/applications/{application_id}',
    summary: 'Get application by ID',
    description: 'Returns specific application details by ID, always includes widgets',
  })
  .input(ByApplicationIdSchema)
  .output(
    ApplicationReadSchema.extend({
      widgets: z.array(WidgetEntitySchema),
    }),
  );

export const applicationUpdate = oc
  .route({
    method: 'PUT',
    tags: ['Application'],
    path: '/applications/{application_id}',
    summary: 'Update application',
    description: 'Updates application details and configuration',
  })
  .input(ApplicationUpdateSchema.extend({ application_id: z.coerce.number() }))
  .output(ApplicationReadSchema);

export const applicationDelete = oc
  .route({
    method: 'DELETE',
    tags: ['Application'],
    path: '/applications/{application_id}',
    summary: 'Delete application',
    description: 'Permanently deletes an application and all associated widgets. This action cannot be undone.',
  })
  .input(ByApplicationIdSchema)
  .output(SuccessSchema);

// ---- domain aggregate ----

export const applicationRoutes = {
  applicationCreate,
  applicationSearch,
  applicationGet,
  applicationUpdate,
  applicationDelete,
};
