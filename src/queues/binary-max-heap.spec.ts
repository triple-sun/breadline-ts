import type { Task } from "../types";
import { BinaryMaxHeap } from "./binary-max-heap";

describe("Binary Min-Max ", () => {
	let heap: BinaryMaxHeap;
	const noop: Task = async () => null;

	beforeEach(() => {
		heap = new BinaryMaxHeap();
	});

	it("should start empty", () => {
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

	it("should pick higher priority tasks first", () => {
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

	it("should re-prioritize existing tasks", () => {
		const task1: Task = async () => "1";
		const task2: Task = async () => "2";

		heap.add(task1, { id: "1", priority: 0 });
		heap.add(task2, { id: "2", priority: 10 });

		// Originally task2 is first
		heap.prioritize("1", 20);

		// Now task1 should be first
		expect(heap.pick()).toBe(task1);
		expect(heap.pick()).toBe(task2);
	});

	it("should throw when prioritizing non-existent task", () => {
		expect(() => heap.prioritize("ghost", 10)).toThrow(ReferenceError);
	});

	it("should filter tasks by priority", () => {
		heap.add(noop, { id: "1", priority: 1 });
		heap.add(noop, { id: "2", priority: 2 });
		heap.add(noop, { id: "3", priority: 1 });

		const p1Tasks = heap.filter({ priority: 1 });
		expect(p1Tasks.length).toBe(2);

		const p2Tasks = heap.filter({ priority: 2 });
		expect(p2Tasks.length).toBe(1);
	});
});
