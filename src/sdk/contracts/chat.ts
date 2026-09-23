/**
 * Chat thread creation. Exports `chatCreate`, which starts a new chat and returns its session id.
 */
import { oc } from '@orpc/contract';
import { z } from 'zod';

export const chatCreate = oc.output(z.string());

export const chatRoutes = {
  chatCreate,
};
