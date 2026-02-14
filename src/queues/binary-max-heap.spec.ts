/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: <jest> */
import type { Task } from "../types";
import { BinaryMaxHeap } from "./binary-max-heap";

describe("BinaryMaxHeap", () => {
	let heap: BinaryMaxHeap;
	const noop: Task = async () => null;

	beforeEach(() => {
		heap = new BinaryMaxHeap();
	});

	describe("Initialization", () => {
		it("should start empty", () => {
			expect(heap.length).toBe(0);
			expect(heap.pick()).toBeUndefined();
		});
	});

	describe("add & pick", () => {
		it("should add a single task and pick it", () => {
			const task: Task = async () => "task";
			heap.add(task, { id: "1", priority: 10 });
			expect(heap.length).toBe(1);
			expect(heap.pick()).toBe(task);
			expect(heap.length).toBe(0);
		});

		it("should add tasks and pick them in FIFO order if priority is same", () => {
			const task1: Task = async () => "1";
			const task2: Task = async () => "2";

			heap.add(task1, { id: "1", priority: 0 });
			heap.add(task2, { id: "2", priority: 0 });

			expect(heap.length).toBe(2);
			expect(heap.pick()).toBe(task1);
			expect(heap.pick()).toBe(task2);
			expect(heap.length).toBe(0);
		});

		it("should pick higher priority tasks first (bubble up)", () => {
			const taskLow: Task = async () => "low";
			const taskHigh: Task = async () => "high";
			const taskMedium: Task = async () => "medium";

			heap.add(taskLow, { id: "low", priority: 0 });
			heap.add(taskHigh, { id: "high", priority: 10 });
			heap.add(taskMedium, { id: "medium", priority: 5 });

			expect(heap.pick()).toBe(taskHigh);
			expect(heap.pick()).toBe(taskMedium);
			expect(heap.pick()).toBe(taskLow);
		});

		it("should handle mixed priorities triggering bubble down correctly", () => {
			const t100: Task = async () => "100";
			const t80: Task = async () => "80";
			const t90: Task = async () => "90";
			const t50: Task = async () => "50";

			heap.add(t100, { id: "100", priority: 100 });
			heap.add(t80, { id: "80", priority: 80 });
			heap.add(t90, { id: "90", priority: 90 });
			heap.add(t50, { id: "50", priority: 50 });

			expect(heap.pick()).toBe(t100);

			const next = heap.pick();
			expect(next).toBe(t90);

			expect(heap.pick()).toBe(t80);
			expect(heap.pick()).toBe(t50);
		});

		it("should handle bubble down where left child is larger than right child", () => {
			const t100: Task = async () => "100";
			const t90: Task = async () => "90"; // Left
			const t80: Task = async () => "80"; // Right
			const t50: Task = async () => "50";

			heap.add(t100, { id: "100", priority: 100 });
			heap.add(t90, { id: "90", priority: 90 });
			heap.add(t80, { id: "80", priority: 80 });
			heap.add(t50, { id: "50", priority: 50 });

			expect(heap.pick()).toBe(t100);
			// After pick: 50 becomes root. [50, 90, 80]
			// Bubble down: 90 > 80, swap 50 with 90. [90, 50, 80]

			expect(heap.pick()).toBe(t90);
			expect(heap.pick()).toBe(t80);
			expect(heap.pick()).toBe(t50);
		});

		it("should handle bubble down where right child is larger than current but left is smaller", () => {
			const t200: Task = async () => "200";
			const t10: Task = async () => "10";
			const t100: Task = async () => "100";
			const t50: Task = async () => "50";
			const t5: Task = async () => "5";
			const t4: Task = async () => "4";

			heap.add(t200, { id: "200", priority: 200 });
			heap.add(t10, { id: "10", priority: 10 });
			heap.add(t100, { id: "100", priority: 100 });
			heap.add(t5, { id: "5", priority: 5 });
			heap.add(t4, { id: "4", priority: 4 });
			heap.add(t50, { id: "50", priority: 50 });

			expect(heap.pick()).toBe(t200);

			expect(heap.pick()).toBe(t100);
			expect(heap.pick()).toBe(t50);
			expect(heap.pick()).toBe(t10);
		});

		it("should handle bubble down with only left child", () => {
			const t100: Task = async () => "100";
			const t50: Task = async () => "50";
			const t10: Task = async () => "10";

			heap.add(t100, { id: "100", priority: 100 });
			heap.add(t50, { id: "50", priority: 50 }); // Left child of 100

			expect(heap.pick()).toBe(t100);
			// After pick 100, 50 moves to root (no children)

			heap.add(t10, { id: "10", priority: 10 });
		});
	});

	describe("prioritize", () => {
		it("should re-prioritize existing tasks (increase priority - bubble up)", () => {
			const task1: Task = async () => "1";
			const task2: Task = async () => "2";

			heap.add(task1, { id: "1", priority: 0 });
			heap.add(task2, { id: "2", priority: 10 });

			// Originally task2 (10) is first, task1 (0) is second.
			// Increase task1 to 20.
			heap.prioritize("1", 20);

			// Now task1 should be first
			expect(heap.pick()).toBe(task1);
			expect(heap.pick()).toBe(task2);
		});

		it("should re-prioritize existing tasks (decrease priority - bubble down)", () => {
			const t100: Task = async () => "100";
			const t50: Task = async () => "50";
			const t10: Task = async () => "10";

			heap.add(t100, { id: "100", priority: 100 }); // index 0
			heap.add(t50, { id: "50", priority: 50 }); // index 1
			heap.add(t10, { id: "10", priority: 10 }); // index 2

			// Change 100 to 5. It should sink down.
			heap.prioritize("100", 5);

			// Expected Order: 50, 10, 5 (since 50 > 10, and 5 is < both)
			expect(heap.pick()).toBe(t50);
			expect(heap.pick()).toBe(t10);
			expect(heap.pick()).toBe(t100);
		});

		it("should do nothing if priority is same", () => {
			const t10: Task = async () => "10";
			heap.add(t10, { id: "10", priority: 10 });
			heap.prioritize("10", 10);
			expect(heap.pick()).toBe(t10);
		});

		it("should handle prioritizing the last element (no move)", () => {
			const t100: Task = async () => "100";
			const t50: Task = async () => "50";

			heap.add(t100, { id: "100", priority: 100 });
			heap.add(t50, { id: "50", priority: 50 });

			// t50 is at index 1 (last). Change 50 -> 60. Still < 100.
			heap.prioritize("50", 60);

			// Order remains 100, 50(now 60)
			expect(heap.pick()).toBe(t100);
			expect(heap.pick()).toBe(t50);
		});

		it("should throw when prioritizing non-existent task", () => {
			expect(() => heap.prioritize("ghost", 10)).toThrow(ReferenceError);
		});
	});

	describe("filter", () => {
		it("should filter tasks by priority and assume sorted result", () => {
			heap.add(noop, { id: "1", priority: 1 });
			heap.add(noop, { id: "2", priority: 2 });
			heap.add(noop, { id: "3", priority: 1 });
			heap.add(noop, { id: "4", priority: 5 });

			const p1Tasks = heap.filter({ priority: 1 });
			expect(p1Tasks.length).toBe(2);
			// Filter sorts by priority desc

			const p2Tasks = heap.filter({ priority: 2 });
			expect(p2Tasks.length).toBe(1);

			const p5Tasks = heap.filter({ priority: 5 });
			expect(p5Tasks.length).toBe(1);

			const noMatch = heap.filter({ priority: 999 });
			expect(noMatch.length).toBe(0);
		});

		it("should filter tasks without criteria (return all)", () => {
			const t1 = async () => "1";
			const t2 = async () => "2";
			heap.add(t1, { id: "1", priority: 10 });
			heap.add(t2, { id: "2", priority: 20 });

			const all = heap.filter({});
			expect(all.length).toBe(2);
			expect(all[0]).toBe(t2); // Sorted by priority desc
			expect(all[1]).toBe(t1);
		});
	});

	describe("Internal Consistency", () => {
		it("should maintain indexMap correctly after swaps", () => {
			const tasks = Array.from({ length: 10 }, (_, i) => ({
				id: `${i}`,
				priority: i,
				task: async () => `${i}`
			}));

			// Random shuffle add
			const shuffled = [...tasks].sort(() => Math.random() - 0.5);

			for (const t of shuffled) {
				heap.add(t.task, { id: t.id, priority: t.priority });
			}

			// Prioritize middle element to max
			heap.prioritize("5", 100);
			const t5 = tasks[5];
			if (t5) {
				expect(heap.pick()).toBe(t5.task); // Should be the one we boosted
			} else {
				throw new Error("Task 5 not found in setup");
			}

			heap.prioritize("9", -1);

			// Now "9" should be potentially last (or close to it).
			// The new max should be "8".
			const t8 = tasks[8];
			if (t8) {
				expect(heap.pick()).toBe(t8.task);
			} else {
				throw new Error("Task 8 not found");
			}

			// Drain the heap
			let t = heap.pick();
			while (t) {
				t = heap.pick();
			}
			expect(heap.length).toBe(0);
		});
	});

	describe("Defensive / Impossible States (Coverage)", () => {
		it("should handle prioritize if indexMap points to invalid index", () => {
			heap.add(noop, { id: "1", priority: 1 });
			// Manually corrupt map
			// biome-ignore lint/suspicious/noExplicitAny: needed for testing private members
			(heap as any).indexMap.set("1", 999);
			// Should verify it returns early and doesn't crash (line 77)
			expect(() => heap.prioritize("1", 10)).not.toThrow();
		});

		it("should handle swap with invalid indices", () => {
			// Access private swap via any (line 153)
			// biome-ignore lint/suspicious/noExplicitAny: needed for testing private members
			expect(() => (heap as any).swap(0, 999)).not.toThrow();
		});

		it("should handle bubbleDown with invalid index", () => {
			// Access private bubbleDown via any (line 125)
			// biome-ignore lint/suspicious/noExplicitAny: needed for testing private members
			expect(() => (heap as any).bubbleDown(999)).not.toThrow();
		});
	});
});
