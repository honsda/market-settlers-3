import { commandData } from './commands';

/**
 * Commands supported by the free Cloudflare Worker. The gateway bot can still
 * register the full list; the Worker only needs the commands that do not rely
 * on Discord gateway events.
 */
export const WORKER_COMMAND_NAMES = [
	'price',
	'market',
	'offers',
	'player',
	'post',
	'alerts',
	'initrule'
] as const;

export type WorkerCommandName = (typeof WORKER_COMMAND_NAMES)[number];

const enabled = new Set<string>(WORKER_COMMAND_NAMES);

export const workerCommands = commandData
	.filter((command) => enabled.has(command.name))
	.map((command) => command.toJSON());

export const workerCommandNameSet = new Set(workerCommands.map((command) => command.name));
