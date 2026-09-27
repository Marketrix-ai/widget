/**
 * The Simulation status schema, a leaf so the widget's mirror carries it without the foundation entities:
 * `SimulationStatusSchema`, the active subset and `isSimulationTerminal`.
 */
import { z } from 'zod';

import { SIMULATION_STATUSES, SIMULATION_TERMINAL_STATUSES } from './jobStatuses';

export const SimulationStatusSchema = z.enum(SIMULATION_STATUSES);

export type SimulationStatus = z.infer<typeof SimulationStatusSchema>;

const SimulationTerminalStatusSchema = SimulationStatusSchema.extract(SIMULATION_TERMINAL_STATUSES);

export const SIMULATION_ACTIVE_STATUSES = SimulationStatusSchema.exclude(SIMULATION_TERMINAL_STATUSES).options;

export type SimulationTerminalStatus = z.infer<typeof SimulationTerminalStatusSchema>;

export const isSimulationTerminal = (status: SimulationStatus): status is SimulationTerminalStatus =>
  SimulationTerminalStatusSchema.safeParse(status).success;
