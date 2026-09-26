/**
 * The Simulation status vocabulary, a leaf so the widget's mirror carries it without the foundation entities:
 * `SimulationStatusSchema`, the terminal and active subsets, and `isSimulationTerminal`.
 */
import { z } from 'zod';

export const SimulationStatusSchema = z.enum(['queued', 'running', 'has_question', 'completed', 'failed', 'stopped']);

export type SimulationStatus = z.infer<typeof SimulationStatusSchema>;

export const SIMULATION_TERMINAL_STATUSES = [
  'completed',
  'failed',
  'stopped',
] as const satisfies readonly SimulationStatus[];

export const SIMULATION_ACTIVE_STATUSES = SimulationStatusSchema.exclude(SIMULATION_TERMINAL_STATUSES).options;

export type SimulationTerminalStatus = (typeof SIMULATION_TERMINAL_STATUSES)[number];

export const isSimulationTerminal = (status: string): status is SimulationTerminalStatus =>
  (SIMULATION_TERMINAL_STATUSES as readonly string[]).includes(status);
