import type { Queue, TaskAddOptions } from "../interfaces";
import type { Task } from "../types";
import { lbound } from "../utils";

interface PriorityQueueElement extends TaskAddOptions {
	readonly priority: number;
	readonly task: Task;
}

export interface PriorityQueueAddOptions extends TaskAddOptions {
	readonly id: string;
	readonly priority: number;
}

export class PriorityQueue implements Queue {
	private readonly line: Readonly<PriorityQueueElement>[] = [];

	get length(): number {
		return this.line.length;
	}

	filter(o: Readonly<Partial<PriorityQueueAddOptions>>): Task[] {
		return this.line
			.filter(el => el.priority === o.priority)
			.map(({ task }) => task);
	}

	public pick(): Task | undefined {
		const item = this.line.shift();
		return item?.task;
	}

	public add(task: Task, o: PriorityQueueAddOptions): void {
		const newElement: PriorityQueueElement = {
			task,
			id: o.id,
			priority: o.priority
		};

		const lastElement = this.line[this.length - 1];

		if (!lastElement || lastElement.priority >= newElement.priority) {
			this.line.push(newElement);
		} else {
			const lb = lbound(
				this.line,
				newElement,
				(a, b) => b.priority - a.priority
			);

			this.line.splice(lb, 0, newElement);
		}
	}

	public prioritize(id: string, priority: number): void {
		const index: number = this.line.findIndex(el => el.id === id);
		if (index === -1) throw new ReferenceError(`task [${id}] does not exist`);
		const [item] = this.line.splice(index, 1);
		if (item) this.add(item.task, { priority, id });
	}
}
