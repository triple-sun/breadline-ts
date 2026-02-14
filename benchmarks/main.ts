import { bench, group, run } from "mitata";
import { Breadline } from "../src";

// Helper to simulate work
const noop = async () => null;

async function main() {
	group("Breadline Core: Throughput & Overhead", () => {
		// Baseline: No concurrency constraints
		const baselineQueue = new Breadline({
			immediate: true,
			concurrency: Infinity
		});

		bench("Add & Process (Infinite Concurrency)", async () => {
			await baselineQueue.add(noop);
		});

		const queue10 = new Breadline({ concurrency: 10 });
		bench("Add & Process (Concurrency: 10)", async () => {
			await queue10.add(noop);
		});

		const queue100 = new Breadline({ concurrency: 100 });
		bench("Add & Process (Concurrency: 100)", async () => {
			await queue100.add(noop);
		});
	});

	group("Breadline Core: Rate Limiting", () => {
		// High capacity rate limit to measure tracking overhead
		const rlQueue = new Breadline({ interval: 1000, intervalCap: 100000 });

		bench("Add & Process (Rate Limited - Tracked)", async () => {
			await rlQueue.add(noop);
		});
	});

	await run();
}

main();
