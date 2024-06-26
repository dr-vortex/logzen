import { LogLevel } from './levels.js';
import type { Readable, Writable } from 'stream';
import type { ReadableStream, WritableStream } from 'stream/web';
import { Logger } from './logger.js';

/**
 * For sending messages between interfaces and loggers
 */
export interface IOMessage {
	/**
	 * The message contents
	 */
	contents: string;

	/**
	 * If the message has already been computed, this will contain the computed message
	 */
	computed?: string;

	/**
	 * The log level of the message
	 */
	level?: LogLevel;

	/**
	 * The prefix to add to the message
	 */
	prefix?: string;
}

/**
 * Input, output, etc.
 */
export interface IOChannel {
	/**
	 * Which log levels should be used with the channel
	 */
	levels: Set<LogLevel>;

	/**
	 * Whether the channel is enabled
	 */
	enabled: boolean;
}

/**
 * Stores an I/O interface and associated log levels.
 */
export interface IO<I extends SupportedInterface = SupportedInterface> {
	/**
	 * The internal input/output.
	 */
	io: I;

	/**
	 * Input channel
	 */
	input: IOChannel;

	/**
	 * Output channel
	 */
	output: IOChannel;

	/**
	 * The type of interface
	 */
	type: NameOfInterface<I>;

	/**
	 * An optional prefix to add to messages
	 */
	prefix?: string;
}

/**
 * Checks if arg is an IO
 * @param arg thing to check
 * @returns If arg is an IO
 */
export function isIO<I extends SupportedInterface>(arg: unknown): arg is IO<I> {
	return !!(typeof arg == 'object' && arg && 'io' in arg && !(arg instanceof Logger));
}

/**
 * Common interface for I/O
 */
export interface IOInterface<I extends SupportedInterface> {
	send?(io: I, message: IOMessage): boolean;
	receive?(io: I, handler: (message: IOMessage) => boolean): void;
}

/**
 * @internal
 */
export interface SupportedInterfaces {
	Readable: Readable;
	Writable: Writable;
	ReadableStream: ReadableStream<string>;
	WritableStream: WritableStream<string>;
	Console: Console;
	Logger: Logger;
}

/**
 * The names of interfaces Logger can use
 */
export type SupportedInterfaceName = keyof SupportedInterfaces;

/**
 * The interfaces Logger can use
 */
export type SupportedInterface = SupportedInterfaces[SupportedInterfaceName];

export type InterfaceWithName<N extends SupportedInterfaceName> = SupportedInterfaces[N];

export type NameOfInterface<I> = {
	[K in SupportedInterfaceName]: I extends SupportedInterfaces[K] ? K : never;
}[SupportedInterfaceName];

export const interfaces: { [N in SupportedInterfaceName]: IOInterface<SupportedInterfaces[N]> } = {
	Readable: {
		receive(io, handler) {
			io.on('data', (data: Buffer | string) => {
				handler({ contents: data.toString().trim() });
			});
		},
	},
	Writable: {
		send(io, { computed }) {
			try {
				io.write(computed);
				return true;
			} catch (e) {
				return false;
			}
		},
	},
	ReadableStream: {
		async receive(io, handler) {
			let data = '';
			for await (const chunk of io) {
				data += chunk;
			}
			handler({ contents: data });
		},
	},
	WritableStream: {
		send(io, { computed }) {
			try {
				io.getWriter().write(computed);
				return true;
			} catch (e) {
				return false;
			}
		},
	},
	Console: {
		send(io, { computed, level }) {
			try {
				const method = LogLevel[level].toLowerCase();
				if (typeof io[method] == 'function') {
					io[method](computed);
				}
				return true;
			} catch (e) {
				return false;
			}
		},
	},
	Logger: {
		send(io, message) {
			try {
				io.send(message);
				return true;
			} catch (e) {
				return false;
			}
		},
		receive(io, handler) {
			io.on('send', message => {
				handler(message);
			});
		},
	},
};
