import type { TaskAddOptions } from "./interfaces.js";
import type { Task } from "./types.js";
import { lowerBound } from "./utils.js";

interface LineElement extends TaskAddOptions {
	readonly priority: number;
	readonly task: Task;
}

export interface LineAddOptions extends TaskAddOptions {
	readonly id: string;
	readonly priority: number;
}

export class Line {
	private readonly _line: Readonly<LineElement>[] = [];
	
	private get line(): Readonly<LineElement>[] {
		return this._line;
	}

	get length(): number {
		return this._line.length;
	}

	filter(o: Readonly<Partial<LineAddOptions>>): Task[] {
		return this.line
			.filter((el) => el.priority === o.priority)
			.map(({ task }) => task);
	}

	public pick(): Task | undefined {
		const item = this.line.shift();
		return item?.task;
	}

	public add(task: Task, o: LineAddOptions): void {
		const newElement: LineElement = {
			task,
			id: o.id,
			priority: o.priority,
		};

		const lastElement = this.line[this.length - 1];

		if (!lastElement || lastElement.priority >= newElement.priority) {
			this.line.push(newElement);
		} else {
			const lb = lowerBound(
				this.line,
				newElement,
				(a, b) => b.priority - a.priority,
			);

			this.line.splice(lb, 0, newElement);
		}
	}

	public prioritize(id: string, priority: number): void {
		const index: number = this.line.findIndex((el) => el.id === id);
		if (index === -1) throw new ReferenceError(`task [${id}] does not exist`);
		const [item] = this.line.splice(index, 1);
		if (item) this.add(item.task, { priority, id });
	}
}
