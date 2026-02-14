import { jest } from "@jest/globals";
import { Breadline, BreadlineEvent } from "./index";

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: <jesting>
describe("Breadline", () => {
	let queue: Breadline;

	afterEach(() => {
		if (queue) queue.clear();
		jest.useRealTimers();
	});

	describe("Initialization", () => {
		it("should initialize with default options", () => {
			queue = new Breadline();
			expect(queue.concurrency).toBe(Number.POSITIVE_INFINITY);
			expect(queue.runningTasks.length).toBe(0);
			expect(queue.size).toBe(0);
			expect(queue.pending).toBe(0);
		});

		it("should validate options", () => {
			expect(() => new Breadline({ interval: 0 })).toThrow(TypeError);
			expect(() => new Breadline({ intervalCap: 0 })).toThrow(TypeError);
			expect(() => new Breadline({ concurrency: 0 })).toThrow(TypeError);
			expect(
				() => new Breadline({ intervalCap: Number.POSITIVE_INFINITY })
			).not.toThrow();
		});

		it("should allow disabling rate limit tracking with infinite cap", () => {
			// This exercises the logic where isRateLimitTracked becomes false
			queue = new Breadline({
				intervalCap: Number.POSITIVE_INFINITY
			});
			expect(queue.isRateLimited).toBe(false);
		});
	});

	describe("Queue Management", () => {
		beforeEach(() => {
			queue = new Breadline();
		});

		it("should add tasks and execute them", async () => {
			const taskSpy = jest.fn(() => "success");
			const result = await queue.add(taskSpy);
			expect(result).toBe("success");
			expect(taskSpy).toHaveBeenCalled();
		});

		it("should add many tasks at once", async () => {
			const results = await queue.addMany([
				async () => 1,
				async () => 2,
				async () => 3
			]);
			expect(results).toEqual([1, 2, 3]);
		});

		it("should clear the queue and events", () => {
			const nextSpy = jest.fn();
			queue.on(BreadlineEvent.Next, nextSpy);

			queue.pause();
			queue.add(async () => null);
			queue.add(async () => null);
			expect(queue.size).toBe(2);

			queue.clear();
			expect(queue.size).toBe(0);
			expect(nextSpy).toHaveBeenCalled();
		});

		it("should report lengthBy priority", () => {
			queue.pause();
			queue.add(async () => null, { priority: 1 });
			queue.add(async () => null, { priority: 2 });
			queue.add(async () => null, { priority: 1 });

			expect(queue.sizeBy({ priority: 1 })).toBe(2);
			expect(queue.sizeBy({ priority: 2 })).toBe(1);
			expect(queue.sizeBy({ priority: 99 })).toBe(0);
		});

		it("should allow re-prioritizing tasks", () => {
			queue.pause();
			const id = "task-1";
			queue.add(async () => "low", { id, priority: 0 });
			queue.add(async () => "high", { id: "task-2", priority: 10 });

			// Initially high is picked first
			// But we promote task-1
			queue.prioritize(id, 20);

			queue.start();
			// We can't easily intercept execution order without async spies
			// But we can check internal line order or use mocked tasks
		});

		it("should throw when prioritizing non-existent task", () => {
			expect(() => queue.prioritize("ghost", 10)).toThrow(); // ReferenceError
		});

		it("should allow setConcurrency dynamically", () => {
			queue.setConcurrency(5);
			expect(queue.concurrency).toBe(5);
		});
	});

	describe("Concurrency & Flow Control", () => {
		it("should limit concurrent tasks", async () => {
			queue = new Breadline({ concurrency: 1 });
			let active = 0;
			let maxActive = 0;

			const task = async () => {
				active++;
				maxActive = Math.max(maxActive, active);
				await new Promise(r => setTimeout(r, 20));
				active--;
			};

			await Promise.all([queue.add(task), queue.add(task), queue.add(task)]);
			expect(maxActive).toBe(1);
		});

		it("should pause and resume", async () => {
			queue = new Breadline({ immediate: false }); // Start paused
			const spy = jest.fn();
			queue.add(async () => spy());

			await new Promise(r => setTimeout(r, 10));
			expect(spy).not.toHaveBeenCalled(); // Still paused

			queue.start();
			await new Promise(r => setTimeout(r, 20)); // Give time to process
			expect(spy).toHaveBeenCalled();
		});
	});

	describe("Rate Limiting", () => {
		it("should respect interval cap", async () => {
			queue = new Breadline({ interval: 100, intervalCap: 2 });
			const timestamps: number[] = [];

			const task = () => {
				timestamps.push(Date.now());
			};

			// Add 3 tasks. Cap is 2 per 100ms.
			// Task 1: T+0
			// Task 2: T+0
			// Task 3: T+100
			await queue.addMany([task, task, task]);

			expect(timestamps.length).toBe(3);
			const diff = (timestamps[2] ?? 0) - (timestamps[0] ?? 0);
			expect(diff).toBeGreaterThanOrEqual(90); // 100ms interval +/- tolerance
		});

		it("should emit RateLimited and RateLimitCleared events", async () => {
			queue = new Breadline({ interval: 50, intervalCap: 1 });

			const rateLimitedSpy = jest.fn();
			const rateLimitClearedSpy = jest.fn();
			queue.on(BreadlineEvent.RateLimited, rateLimitedSpy);
			queue.on(BreadlineEvent.RateLimitCleared, rateLimitClearedSpy);

			// Add tasks
			queue.addMany([async () => null, async () => null]);
			// Wait for microtasks/processing
			await new Promise(r => setTimeout(r, 10));

			expect(rateLimitedSpy).toHaveBeenCalled();

			// Advance time to clear limit (> 50ms)
			await new Promise(r => setTimeout(r, 60));

			expect(rateLimitClearedSpy).toHaveBeenCalled();
		});

		it("should handle wait for onRateLimit/onRateLimitCleared", async () => {
			queue = new Breadline({ interval: 50, intervalCap: 1 });

			const rateLimitedSpy = jest.fn();
			const rateLimitClearedSpy = jest.fn();
			queue.on(BreadlineEvent.RateLimited, rateLimitedSpy);
			queue.on(BreadlineEvent.RateLimitCleared, rateLimitClearedSpy);

			// Consume token
			queue.addMany([async () => null, async () => null]);
			await new Promise(r => setTimeout(r, 10));

			expect(rateLimitedSpy).toHaveBeenCalled();

			const clearPromise = queue.onRateLimitCleared();
			// Wait for clear (>50ms total since start)
			// we already waited 10. wait 50 more.
			await new Promise(r => setTimeout(r, 60));

			await clearPromise; // Should resolve
			expect(queue.isRateLimited).toBe(false);
		});
	});

	describe("Events", () => {
		beforeEach(() => {
			queue = new Breadline();
		});

		it("should wait for onEmpty", async () => {
			queue.pause();
			queue.add(async () => null);
			const emptyPromise = queue.onEmpty();

			queue.clear();
			await expect(emptyPromise).resolves.toBeUndefined();
		});

		it("should wait for onIdle", async () => {
			let resolved = false;

			const task = queue.add(async () => {
				await new Promise(r => setTimeout(r, 100)); // Longer delay
			});

			// Now that task is added and running (pending=1), onIdle should wait
			const p = queue.onIdle().then(() => {
				resolved = true;
			});

			// wait a bit, but less than task duration
			await new Promise(r => setTimeout(r, 10));
			expect(resolved).toBe(false); // Task still running

			await task;
			await p;
			expect(resolved).toBe(true);
		});

		it("should wait for onPendingZero", async () => {
			const task = queue.add(async () => {
				await new Promise(r => setTimeout(r, 20));
			});
			const pendingZero = queue.onPendingZero();
			await task;
			await expect(pendingZero).resolves.toBeUndefined();
		});

		it("should wait for onSizeLessThan", async () => {
			queue.pause();
			queue.add(async () => null);
			queue.add(async () => null);

			const p = queue.onSizeLessThan(2);
			queue.start();
			// First picks one, size becomes 1. Should resolve.
			await p;
			expect(queue.size).toBeLessThan(2);
		});
	});

	describe("Errors & AbortSignal", () => {
		it("should emit Error event and reject add promise", async () => {
			queue = new Breadline();
			const errorSpy = jest.fn();
			queue.on(BreadlineEvent.Error, errorSpy);

			const err = new Error("fail");
			await expect(
				queue.add(() => {
					throw err;
				})
			).rejects.toThrow("fail");
			expect(errorSpy).toHaveBeenCalledWith(err);
		});

		it("should allow waiting for onError", async () => {
			queue = new Breadline();
			const p = queue.onError();
			queue
				.add(() => {
					throw new Error("boom");
				})
				.catch(() => null);
			await expect(p).rejects.toThrow("boom");
		});

		it("should handle AbortSignal before task starts", async () => {
			queue.pause(); // Task sits in queue
			const ac = new AbortController();

			const p = queue.add(async () => null, { signal: ac.signal });
			ac.abort("Aborted Early");

			// We must start the queue for the task to be picked and check signal
			queue.start();

			await expect(p).rejects.toBe("Aborted Early");
		});

		it("should handle AbortSignal while task running", async () => {
			const ac = new AbortController();
			const p = queue.add(
				({ signal }) => {
					return new Promise((_, reject) => {
						signal?.addEventListener("abort", () => reject(signal.reason));
					});
				},
				{ signal: ac.signal }
			);

			// Use immediate abort to avoid timeout flakiness with real timers
			setTimeout(() => ac.abort("Aborted Mid"), 10);
			await expect(p).rejects.toBe("Aborted Mid");
		});

		it("should restore interval token if task aborted immediately", async () => {
			// If a task is picked but aborts immediately, it shouldn't consume rate limit token
			queue = new Breadline({ interval: 1000, intervalCap: 1 });
			const ac = new AbortController();
			ac.abort();

			await expect(
				queue.add(async () => null, { signal: ac.signal })
			).rejects.toThrow("This operation was aborted");

			// Should explicitly not be rate limited because it didn't really run
			expect(queue.isRateLimited).toBe(false);
		});
	});

	describe("Internal & Edge Cases", () => {
		it("should handle queue saturation property", () => {
			queue = new Breadline({ concurrency: 1 });
			// Add 1 running, 1 queued
			queue.add(async () => new Promise(r => setTimeout(r, 50)));
			queue.add(async () => null);

			expect(queue.isSaturated).toBe(true);
		});
	});
});
