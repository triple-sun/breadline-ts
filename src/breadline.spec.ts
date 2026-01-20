import { Breadline } from "./breadline";
import { BreadlineEvent } from "./enum";

describe("Breadline", () => {
	let queue: Breadline;

	afterEach(() => {
		// cleanup any timers
		if (queue) queue.clear();
	});

	describe("Initialization", () => {
		it("should initialize with default options", () => {
			queue = new Breadline();
			expect(queue.concurrency).toBe(Number.POSITIVE_INFINITY);
		});

		it("should validate options", () => {
			expect(() => new Breadline({ interval: 0 })).toThrow(); // interval >= 1
			expect(() => new Breadline({ intervalCap: 0 })).toThrow(); // cap >= 1
		});
	});

	describe("Queue Management", () => {
		beforeEach(() => {
			queue = new Breadline();
		});

		it("should add tasks and execute them", async () => {
			const result = await queue.add(async () => "success");
			expect(result).toBe("success");
		});

		it("should report length and pending counts", async () => {
			queue.pause(); // stop processing to check length
			queue.add(async () => {});
			queue.add(async () => {});
			expect(queue.length).toBe(2);
			expect(queue.pending).toBe(0);

			queue.start();
			// Assuming tasks are instant, but let's check pending if we make them wait
		});

		it("should clear the queue", () => {
			queue.pause();
			queue.add(async () => {});
			queue.add(async () => {});
			expect(queue.length).toBe(2);
			queue.clear();
			expect(queue.length).toBe(0);
		});
	});

	describe("Concurrency", () => {
		it("should limit concurrent tasks", async () => {
			queue = new Breadline({ concurrency: 1 });
			let active = 0;
			let maxActive = 0;

			const task = async () => {
				active++;
				maxActive = Math.max(maxActive, active);
				await new Promise((r) => setTimeout(r, 10)); // small delay
				active--;
			};

			await Promise.all([queue.add(task), queue.add(task), queue.add(task)]);

			expect(maxActive).toBe(1);
		});
	});

	describe("Rate Limiting", () => {
		it("should respect interval cap", async () => {
			// 2 tasks per 100ms
			queue = new Breadline({ interval: 100, intervalCap: 2 });
			const start = Date.now();
			let last = Date.now();

			// Add 3 tasks.
			// 1, 2 run immediately.
			// 3 should run after 100ms.
			await queue.addMany([
				async () => {
					return console.log(1);
				},
				async () => {
					return console.log(2);
				},
				async () => {
					last = Date.now();
					return console.log(3);
				},
			]);

			expect(last - start).toBeGreaterThanOrEqual(90); // Allow some jitter tolerance
		});

		it("should emit RateLimited events", async () => {
			queue = new Breadline({ interval: 100, intervalCap: 1 });
			const spyOnRateLimit = jest.fn();
			queue.on(BreadlineEvent.RateLimited, spyOnRateLimit);

			queue.add(async () => {});
			queue.add(async () => {});

			// First task runs, consuming cap. Second task triggers rate limit check.
			// Note: Implementation details might trigger this slightly differently depending on when check happens
			// Based on code: `tryToStartAnother` checks `allowsAnotherInterval`.

			// Allow event loop to turn
			await new Promise((r) => setTimeout(r, 10));
			expect(spyOnRateLimit).toHaveBeenCalled();
		});

		it("should toggle rate limit state correctly", async () => {
			queue = new Breadline({ interval: 50, intervalCap: 1 });
			const spyLimited = jest.fn();
			const spyCleared = jest.fn();
			queue.on(BreadlineEvent.RateLimited, spyLimited);
			queue.on(BreadlineEvent.RateLimitCleared, spyCleared);

			// Hit limit
			queue.add(async () => {});
			queue.add(async () => {});
			await new Promise((r) => setTimeout(r, 10));
			expect(spyLimited).toHaveBeenCalledTimes(1);

			// Wait for clear
			await new Promise((r) => setTimeout(r, 60));
			expect(spyCleared).toHaveBeenCalledTimes(1);

			// Hit limit again
			queue.add(async () => {});
			await new Promise((r) => setTimeout(r, 10));
			expect(spyLimited).toHaveBeenCalledTimes(2);
		});
	});

	describe("AbortSignal", () => {
		it("should reject when signal is aborted", async () => {
			queue = new Breadline();
			const ac = new AbortController();
			const taskPromise = queue.add(
				async () => {
					return new Promise((_, __) => {
						// Never resolves naturally
					});
				},
				{ signal: ac.signal },
			);

			setTimeout(() => ac.abort("Aborted"), 10);

			await expect(taskPromise).rejects.toBe("Aborted");
		});

		it("should clean up listeners", async () => {
			/** TODO: implement */
		});
	});

	describe("Events", () => {
		it("should emit idle/empty", async () => {
			queue = new Breadline();
			const idleSpy = jest.fn();
			const emptySpy = jest.fn();

			queue.on(BreadlineEvent.Idle, idleSpy);
			queue.on(BreadlineEvent.Empty, emptySpy);

			await queue.add(async () => {});

			expect(emptySpy).toHaveBeenCalled();
			expect(idleSpy).toHaveBeenCalled();
		});
	});
});
