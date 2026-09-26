/**
 * The Simulation status vocabulary, a leaf so the widget's mirror carries it without the foundation entities:
 * `SimulationStatusSchema`, the terminal and active subsets, and `isSimulationTerminal`.
 */
import { z } from 'zod';

export const SimulationStatusSchema = z.enum(['queued', 'running', 'has_question', 'completed', 'failed', 'stopped']);

export type SimulationStatus = z.infer<typeof SimulationStatusSchema>;

const SimulationTerminalStatusSchema = SimulationStatusSchema.extract(['completed', 'failed', 'stopped']);

export const SIMULATION_TERMINAL_STATUSES = SimulationTerminalStatusSchema.options;

export const SIMULATION_ACTIVE_STATUSES = SimulationStatusSchema.exclude(SIMULATION_TERMINAL_STATUSES).options;

export type SimulationTerminalStatus = z.infer<typeof SimulationTerminalStatusSchema>;

export const isSimulationTerminal = (status: SimulationStatus): status is SimulationTerminalStatus =>
  SimulationTerminalStatusSchema.safeParse(status).success;
