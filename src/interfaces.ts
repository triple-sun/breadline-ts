import type { Task } from "./types";
export interface RunningTask {
	readonly id?: string;
	readonly priority: number;
	readonly startTime: number;
	readonly timeout?: number;
}

export interface TaskRunOptions {
	/**
	 * Task priority; Tasks with higher priority will be executed first.
	 * @default 0
	 * */
	readonly priority?: number;
	/**
	 * AbortSignal for operations
	 * */
	readonly signal?: AbortSignal | undefined;
}

export interface Queue {
	get length(): number;
	pick(): Task | undefined;
	add(task: Task, o: TaskAddOptions): void;
	prioritize(id: string, priority: number): void;
	filter(o: Readonly<Partial<TaskAddOptions>>): Task[];
}

export interface TaskAddOptions extends TaskRunOptions {
	/**
	 * Task id; @default crypto.randomUUID()
	 * */
	readonly id?: Readonly<string>;
}

export interface BreadlineOptions {
	/**
	 * Queue constructor
	 *
	 * @see {@link file://./queues/binary-max-heap.d.ts | BinaryMaxHeap}
	 * @see {@link file://./queues/priority-queue.d.ts | PriorityQueue}
	 *
	 * @default PriorityQueue
	 */
	readonly queue?: new () => Queue;

	/**
	 * Execure tasks immediately after they're added
	 * @default true
	 * */
	readonly immediate?: boolean;

	/**
	 * Concurrent tasks limit
	 * min: 1; @default Number.POSITIVE_INFINITY
	 * */
	readonly concurrency?: number;

	/**
	 * The length of time in milliseconds before the interval count resets.
	 * finite; min: 1; @default 1
	 * */
	readonly interval?: number;

	/**
	 * The max number of runs in the given interval of time
	 * min: 1; @default Number.POSITIVE_INFINITY
	 * */
	readonly intervalCap?: number;
}
