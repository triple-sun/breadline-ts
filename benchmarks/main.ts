import { bench, group, run } from "mitata";
import { Breadline } from "../src";

// Helpers
const noop = async () => null;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
	// 1. Throughput & Overhead
	// Measure the raw overhead of adding and processing a no-op task under different concurrency limits.
	group("Throughput: Add & Process (Concurrency)", () => {
		const qInf = new Breadline({ concurrency: Number.POSITIVE_INFINITY });
		const q100 = new Breadline({ concurrency: 100 });
		const q10 = new Breadline({ concurrency: 10 });
		const q1 = new Breadline({ concurrency: 1 });

		bench("Unbounded (Infinity)", async () => {
			await qInf.add(noop);
		});
		bench("High Concurrency (100)", async () => {
			await q100.add(noop);
		});
		bench("Medium Concurrency (10)", async () => {
			await q10.add(noop);
		});
		bench("Sequential (1)", async () => {
			await q1.add(noop);
		});
	});

	// 2. Priority Queue Overhead
	// Measure the cost of using the priority feature.
	group("Feature: Priority Queueing", () => {
		const q = new Breadline({ concurrency: Number.POSITIVE_INFINITY });

		bench("Add (Default Priority)", async () => {
			await q.add(noop);
		});
		bench("Add (Explicit Priority 0)", async () => {
			await q.add(noop, { priority: 0 });
		});
		bench("Add (High Priority 100)", async () => {
			await q.add(noop, { priority: 100 });
		});
	});

	// 3. Rate Limiting Overhead
	// Measure checking against rate limits vs no limits.
	group("Feature: Rate Limiting", () => {
		const qNoLimit = new Breadline({ concurrency: Number.POSITIVE_INFINITY });
		// Cap high enough to not actually limit, just measure tracking cost
		const qTracked = new Breadline({
			interval: 1000,
			intervalCap: 1_000_000
		});

		bench("No Rate Limit", async () => {
			await qNoLimit.add(noop);
		});
		bench("Rate Limit Tracked", async () => {
			await qTracked.add(noop);
		});
	});

	// 4. Large Batch Processing (Throughput)
	// Simulate processing a larger batch of tasks.
	group("Scenario: Large Batch (1k tasks)", () => {
		const tasks = new Array(1000).fill(noop);
		// Re-create queue per bench to avoid accumulation?
		// mitata runs the function repeatedly.
		// For this test, we want to measure throughput of the *queue instance* or *addMany*?
		// We'll reuse the queue to measure sustained throughput.
		const q = new Breadline({ concurrency: 100 });

		bench("Process 1k tasks", async () => {
			await q.addMany(tasks);
		});
	});

	// 5. Async Task Handling
	// Measure overhead when tasks are not instant (microtask) but actual async ticks.
	group("Scenario: Async Tasks (Sleep 0)", () => {
		const q = new Breadline({ concurrency: 100 });

		bench("process sleep(0)", async () => {
			await q.add(() => sleep(0));
		});
	});

	await run();
}

main();
