import { EventEmitter } from "eventemitter3";
import { BreadlineEvent } from "./enum";
import type {
	BreadlineOptions,
	Queue,
	RunningTask,
	TaskAddOptions
} from "./interfaces";
import {
	BinaryMaxHeap,
	type BinaryMaxHeapAddOptions
} from "./queues/binary-max-heap";
import { PriorityQueue } from "./queues/priority-queue";
import type { TaskWithOptions } from "./types";
import { validateNumericOption } from "./utils";

export class Breadline extends EventEmitter<BreadlineEvent> {
	private q: Queue;

	private readonly interval: number;
	private readonly intervalCap: number;

	#idSource: number = 0;
	#pending: number = 0;
	#concurrency: number;
	#isPaused: boolean;
	#isRateLimited = false;
	#hasRateLimitResetPlanned = false;
	private readonly isRateLimitTracked: boolean;

	private timeoutId?: NodeJS.Timeout;
	private ticks: number[] = [];
	private ticksStartIndex = 0;

	readonly #runningTasks = new Map<symbol, RunningTask>();

	constructor(options?: BreadlineOptions) {
		super();

		const o: Readonly<Required<BreadlineOptions>> = {
			interval: options?.interval ?? 1,
			intervalCap: options?.intervalCap ?? Number.POSITIVE_INFINITY,
			concurrency: options?.concurrency ?? Number.POSITIVE_INFINITY,
			immediate: options?.immediate ?? true,
			queue: PriorityQueue,
			...options
		};

		validateNumericOption("interval", o.interval, { min: 1 });
		validateNumericOption("intervalCap", o.intervalCap, {
			min: 1,
			finite: false
		});
		validateNumericOption("concurrency", o.concurrency, {
			min: 1,
			finite: false
		});

		this.q = new o.queue();
		this.#concurrency = o.concurrency;
		this.#isPaused = o.immediate === false;
		this.interval = o.interval;
		this.intervalCap = o.intervalCap;
		this.isRateLimitTracked = Number.isFinite(o.intervalCap);

		this.startRateLimitTracking();
	}

	/**
	 * Pause execution
	 * */
	public pause(): this {
		this.#isPaused = true;
		return this;
	}

	/**
	 * Start (or resume) executing tasks within concurrency limit.
	 * */
	public start(): this {
		if (!this.#isPaused) return this;
		this.#isPaused = false;
		this.process();
		return this;
	}

	/**
	 * Updates concurrency limit
	 *  */
	public setConcurrency(value: number): this {
		this.#concurrency = value;
		return this;
	}

	/**
	 * Clears the line
	 * */
	public clear(): this {
		this.q = new BinaryMaxHeap();
		// Force synchronous update since clear() should have immediate effect
		this.setRateLimit();
		// Emit events so waiters (onEmpty, onIdle, onSizeLessThan) can resolve
		this.emit(BreadlineEvent.Empty);
		if (this.#pending === 0) {
			this.clearTimeoutTimer();
			this.emit(BreadlineEvent.Idle);
		}
		this.emit(BreadlineEvent.Next);
		return this;
	}

	/** Returns length of the line */
	public get size(): Readonly<number> {
		return this.q.length;
	}
	/** Length of the line filtered by options. **/
	public sizeBy(o: Readonly<Partial<TaskAddOptions>>): number {
		return this.q.filter(o).length;
	}
	get pending(): Readonly<number> {
		return this.#pending;
	}
	get concurrency(): Readonly<number> {
		return this.#concurrency;
	}
	get isRateLimited(): Readonly<boolean> {
		return this.#isRateLimited;
	}
	get runningTasks(): ReadonlyArray<RunningTask> {
		return [...this.#runningTasks.values()].map(task => ({ ...task }));
	}
	get isSaturated(): Readonly<boolean> {
		return (
			(this.#pending === this.#concurrency && this.size > 0) ||
			(this.#isRateLimited && this.size > 0)
		);
	}

	/**
	 * Assigns a priority to the task
	 * */
	public prioritize(id: string, priority: number): this {
		validateNumericOption("priority", priority, {
			min: Number.MIN_SAFE_INTEGER
		});
		this.q.prioritize(id, priority);
		return this;
	}

	/**
	 * Adds a sync or async task to the line
	 * */
	public add<RESULT_TYPE>(
		task: TaskWithOptions<RESULT_TYPE>,
		opts?: TaskAddOptions
	): Promise<RESULT_TYPE> {
		// Create a copy to avoid mutating the original options object
		const o: Readonly<BinaryMaxHeapAddOptions> = {
			id: opts?.id ?? `${this.#idSource++}`,
			priority: opts?.priority ?? 0,
			signal: opts?.signal,
			...opts
		};

		return new Promise((res, rej) => {
			// Create a unique symbol for tracking this task
			const taskSymbol = Symbol(`task-${o.id}`);

			this.q.add(async () => {
				this.#pending++;
				/** track it */
				this.#runningTasks.set(taskSymbol, {
					id: o.id,
					priority: o.priority ?? 0, // Match priority-queue default
					startTime: Date.now()
				});

				let listener: (() => void) | undefined;

				try {
					/** Check abort signal status */
					try {
						o.signal?.throwIfAborted();
					} catch (error) {
						this.restoreTick();
						this.#runningTasks.delete(taskSymbol);
						throw error;
					}

					let operation = task({ signal: o.signal });

					if (o.signal) {
						const { signal } = o;

						operation = Promise.race([
							operation,
							new Promise<never>((_resolve, reject) => {
								listener = () => reject(signal.reason);
								signal.addEventListener("abort", listener, { once: true });
							})
						]);
					}
					const result = await operation;
					res(result);
					this.emit(BreadlineEvent.Done, result);
				} catch (error: unknown) {
					rej(error);
					this.emit(BreadlineEvent.Error, error);
				} finally {
					// Clean up abort event listener
					if (listener && o.signal) {
						o.signal.removeEventListener("abort", listener);
					}
					// Remove from running tasks
					this.#runningTasks.delete(taskSymbol);
					// Use queueMicrotask to prevent deep recursion while maintaining timing
					queueMicrotask(() => {
						this.next();
					});
				}
			}, o);

			this.emit(BreadlineEvent.Add);
			this.tryToStartNewJob();
		});
	}

	/**
	 * Adds many tasks and rejects if unsuccessful
	 * */
	addMany<TaskResultsType>(
		tasks: ReadonlyArray<TaskWithOptions<TaskResultsType>>,
		opts: TaskAddOptions = {}
	): Promise<TaskResultsType[]> {
		return Promise.all(tasks.map(async task => this.add(task, opts)));
	}

	/**
	 * Events
	 * */

	/**
	 * Settles when the line length is 0
	 * */
	public async onEmpty(): Promise<void> {
		if (this.q.length === 0) return;
		await this.onEvent(BreadlineEvent.Empty);
	}

	/**
	 * Settles when `line.length < limit`
	 * */
	public async onSizeLessThan(limit: number): Promise<void> {
		// Instantly resolve if the queue is empty.
		if (this.q.length < limit) return;
		await this.onEvent(BreadlineEvent.Next, () => this.q.length < limit);
	}

	/**
	 * Settles when the line becomes empty, and all promises have completed
	 * */
	public async onIdle(): Promise<void> {
		// Instantly resolve if none pending and if nothing else is queued
		if (this.#pending === 0 && this.q.length === 0) return;
		await this.onEvent(BreadlineEvent.Idle);
	}

	/**
	 * Settles when all currently running tasks have completed
	 */
	public async onPendingZero(): Promise<void> {
		if (this.#pending === 0) return;
		await this.onEvent(BreadlineEvent.PendingZero);
	}

	/**
	 * Settles when the queue becomes rate-limited due to intervalCap.
	 * */
	public async onRateLimit(): Promise<void> {
		if (this.#isRateLimited) return;
		await this.onEvent(BreadlineEvent.RateLimited);
	}

	/**
	 * Settles when the queue is no longer rate-limited
	 * */
	public async onRateLimitCleared(): Promise<void> {
		if (!this.#isRateLimited) return;
		await this.onEvent(BreadlineEvent.RateLimitCleared);
	}

	/**
	 * Rejects when any task in the line throws an error.
	 * Use with `Promise.race([queue.onError(), queue.onIdle()])` to fail on the first error while still resolving normally when the queue goes idle.
	 * Important: The promise returned by `add()` still rejects. You must handle each `add()` promise (for example, `.catch(() => {})`) to avoid unhandled rejections.
	 * */
	public onError(): Promise<never> {
		return new Promise<never>((_, reject) => {
			const handleError = (error: unknown) => {
				this.off(BreadlineEvent.Error, handleError);
				reject(error);
			};

			this.on(BreadlineEvent.Error, handleError);
		});
	}

	/**
	 * Internal methods
	 * */

	/**
	 * Executes all queued functions until it reaches the limit.
	 * */
	private process(): void {
		while (this.tryToStartNewJob()) {
			null;
		}
	}

	private next(): void {
		this.#pending--;
		if (this.#pending === 0) this.emit(BreadlineEvent.PendingZero);
		this.tryToStartNewJob();
		this.emit(BreadlineEvent.Next);
	}

	private cleanup(): void {
		this.emit(BreadlineEvent.Empty);
		if (this.#pending === 0) {
			this.clearTimeoutTimer();
			if (this.ticksStartIndex > 0) this.cleanupTicks(Date.now());
			this.emit(BreadlineEvent.Idle);
		}
	}

	private getActiveTicksCount(): number {
		return this.ticks.length - this.ticksStartIndex;
	}

	private allowsAnotherInterval(): boolean {
		// Check concurrency strictly
		if (this.#pending >= this.#concurrency) return false;

		if (this.isRateLimitTracked) {
			return this.getActiveTicksCount() < this.intervalCap;
		}

		return true;
	}

	private onEvent(
		event: BreadlineEvent,
		filter?: () => boolean
	): Promise<void> {
		return new Promise(resolve => {
			const listener = () => {
				if (filter && !filter()) return;
				this.off(event, listener);
				resolve();
			};
			this.on(event, listener);
		});
	}

	private clearTimeoutTimer(): void {
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = undefined;
		}
	}

	private cleanupTicks(now: number): void {
		// Remove ticks outside the current interval window using circular buffer approach
		while (this.ticksStartIndex < this.ticks.length) {
			const oldestTick = this.ticks[this.ticksStartIndex];
			if (oldestTick !== undefined && now - oldestTick >= this.interval) {
				this.ticksStartIndex++;
			} else break;
		}

		const isTooLarge =
			this.ticksStartIndex > 100 &&
			this.ticksStartIndex > this.ticks.length / 2;
		/** compact if too large or expired */
		if (isTooLarge || this.ticksStartIndex === this.ticks.length) {
			this.ticks = this.ticks.slice(this.ticksStartIndex);
			this.ticksStartIndex = 0;
		}
	}

	private tryToStartNewJob(): boolean {
		if (this.q.length === 0) {
			this.cleanup();
			return false;
		}

		if (!this.#isPaused) {
			const now = Date.now();
			this.onNotPausedNewJob(now);

			if (this.allowsAnotherInterval()) {
				const job = this.q.pick();

				/** should not happen bc we check for it but... */
				if (!job) return false;

				if (this.isRateLimitTracked) {
					this.consumeTick(now);
					this.scheduleRateLimitReset();
				}

				this.emit(BreadlineEvent.Active);

				job();

				return true;
			}
		}

		return false;
	}

	private startRateLimitTracking(): void {
		/** start only if is tracked  */
		if (!this.isRateLimitTracked) return;
		/** attach to events that should reset state */
		this.on(BreadlineEvent.Add, () => {
			if (this.q.length > 0) this.scheduleRateLimitReset();
		});
		this.on(BreadlineEvent.Next, this.scheduleRateLimitReset);
		this.on(BreadlineEvent.RateLimitCleared, () => this.process());
	}

	private scheduleRateLimitReset(): void {
		/** exit if is untracked or flush is already planned */
		if (!this.isRateLimitTracked || this.#hasRateLimitResetPlanned) return;
		this.#hasRateLimitResetPlanned = true;
		queueMicrotask(() => {
			this.#hasRateLimitResetPlanned = false;
			this.setRateLimit();
		});
	}

	private restoreTick(): void {
		if (!this.isRateLimitTracked) return;
		if (this.ticks.length > this.ticksStartIndex) this.ticks.pop();
		this.scheduleRateLimitReset();
	}

	private setRateLimit(): void {
		const prev = this.#isRateLimited;
		/** exit if untracked or empty */
		if (!this.isRateLimitTracked || this.q.length === 0) {
			if (prev) {
				this.#isRateLimited = false;
				this.emit(BreadlineEvent.RateLimitCleared);
			}
			return;
		}

		const now = Date.now();
		this.cleanupTicks(now);

		const count = this.getActiveTicksCount();
		const shouldBeRateLimited = count >= this.intervalCap;
		/** update status based on active ticks vs cap  */
		if (shouldBeRateLimited !== prev) {
			this.#isRateLimited = shouldBeRateLimited;
			this.emit(
				shouldBeRateLimited
					? BreadlineEvent.RateLimited
					: BreadlineEvent.RateLimitCleared
			);
		}
	}

	private onNotPausedNewJob(now: number): void {
		this.cleanupTicks(now);

		const activeTicksCount = this.getActiveTicksCount();
		const oldestTick = this.ticks[this.ticksStartIndex];

		if (activeTicksCount >= this.intervalCap && oldestTick) {
			const delay = this.interval - (now - oldestTick);

			/** break if timeout exists */
			if (this.timeoutId !== undefined) return;

			/** create timeout */
			this.timeoutId = setTimeout(() => {
				this.timeoutId = undefined;
				this.process();
				this.scheduleRateLimitReset();
			}, delay);
		}
	}

	private consumeTick(now: number) {
		this.ticks.push(now);
	}
}
