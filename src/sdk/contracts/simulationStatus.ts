/**
 * The status schemas, a leaf so the widget's and monitor's mirrors carry them without the foundation entities:
 * `SimulationStatusSchema` with its active subset and `isSimulationTerminal`, `RunStatusSchema` and `GraphStatusSchema`.
 */
import { z } from 'zod';

import { GRAPH_STATUSES, RUN_STATUSES, SIMULATION_STATUSES, SIMULATION_TERMINAL_STATUSES } from './jobStatuses';

export const RunStatusSchema = z.enum(RUN_STATUSES);

export const GraphStatusSchema = z.enum(GRAPH_STATUSES);

export const SimulationStatusSchema = z.enum(SIMULATION_STATUSES);

export type SimulationStatus = z.infer<typeof SimulationStatusSchema>;

const SimulationTerminalStatusSchema = SimulationStatusSchema.extract(SIMULATION_TERMINAL_STATUSES);

export const SIMULATION_ACTIVE_STATUSES = SimulationStatusSchema.exclude(SIMULATION_TERMINAL_STATUSES).options;

export type SimulationTerminalStatus = z.infer<typeof SimulationTerminalStatusSchema>;

export const isSimulationTerminal = (status: SimulationStatus): status is SimulationTerminalStatus =>
  SimulationTerminalStatusSchema.safeParse(status).success;
