import { Line } from "./line";
import type { Task } from "./types";

describe("Line", () => {
	let line: Line;
	const noop: Task = async () => {};

	beforeEach(() => {
		line = new Line();
	});

	it("should start empty", () => {
		expect(line.length).toBe(0);
	});

	it("should add tasks and pick them in FIFO order if priority is same", () => {
		const task1: Task = async () => "1";
		const task2: Task = async () => "2";

		line.add(task1, { id: "1", priority: 0 });
		line.add(task2, { id: "2", priority: 0 });

		expect(line.length).toBe(2);
		expect(line.pick()).toBe(task1);
		expect(line.pick()).toBe(task2);
		expect(line.length).toBe(0);
	});

	it("should pick higher priority tasks first", () => {
		const taskLow: Task = async () => "low";
		const taskHigh: Task = async () => "high";
		const taskMedium: Task = async () => "medium";

		line.add(taskLow, { id: "low", priority: 0 });
		line.add(taskHigh, { id: "high", priority: 10 });
		line.add(taskMedium, { id: "medium", priority: 5 });

		expect(line.pick()).toBe(taskHigh);
		expect(line.pick()).toBe(taskMedium);
		expect(line.pick()).toBe(taskLow);
	});

	it("should re-prioritize existing tasks", () => {
		const task1: Task = async () => "1";
		const task2: Task = async () => "2";

		line.add(task1, { id: "1", priority: 0 });
		line.add(task2, { id: "2", priority: 10 });

		// Originally task2 is first
		line.prioritize("1", 20);

		// Now task1 should be first
		expect(line.pick()).toBe(task1);
		expect(line.pick()).toBe(task2);
	});

	it("should throw when prioritizing non-existent task", () => {
		expect(() => line.prioritize("ghost", 10)).toThrow(ReferenceError);
	});

	it("should filter tasks by priority", () => {
		line.add(noop, { id: "1", priority: 1 });
		line.add(noop, { id: "2", priority: 2 });
		line.add(noop, { id: "3", priority: 1 });

		const p1Tasks = line.filter({ priority: 1 });
		expect(p1Tasks.length).toBe(2);

		const p2Tasks = line.filter({ priority: 2 });
		expect(p2Tasks.length).toBe(1);
	});
});
