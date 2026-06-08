import { oc } from '@orpc/contract';
import { z } from 'zod';

export const chatCreate = oc
  .route({
    method: 'POST',
    tags: ['Chat'],
    path: '/chat',
    summary: 'Create a new chat thread',
    description: 'Initializes new chat thread and returns session ID',
  })
  .output(z.string());

export const chatRoutes = {
  chatCreate,
};
