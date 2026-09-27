/**
 * The Simulation, Run and Graph status tuples and the Run terminal record, zod-free so monitor's client bundle
 * can read them; `simulationStatus.ts`, `foundationEntities.ts` and `internal.ts` derive their schemas from here.
 */
export const SIMULATION_STATUSES = ['queued', 'running', 'has_question', 'completed', 'failed', 'stopped'] as const;

export const SIMULATION_TERMINAL_STATUSES = ['completed', 'failed', 'stopped'] as const;

export const RUN_STATUSES = ['created', 'running', 'paused', 'finalizing', 'completed', 'failed', 'stopped'] as const;

export const RUN_STATUS_TERMINAL = {
  created: false,
  running: false,
  paused: false,
  finalizing: false,
  completed: true,
  failed: true,
  stopped: true,
} as const satisfies Record<(typeof RUN_STATUSES)[number], boolean>;

export const RUN_TERMINAL_STATUSES = RUN_STATUSES.filter(status => RUN_STATUS_TERMINAL[status]);

export const GRAPH_STATUSES = ['pending', 'generating', 'completed', 'failed'] as const;
