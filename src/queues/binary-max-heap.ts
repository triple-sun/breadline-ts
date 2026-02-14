import type { Queue, TaskAddOptions } from "../interfaces";
import type { Task } from "../types";

interface BinaryMaxHeapElement extends TaskAddOptions {
	readonly priority: number;
	readonly task: Task;
	// We need id to track tasks for prioritize()
	readonly id: string;
}

export interface BinaryMaxHeapAddOptions extends TaskAddOptions {
	readonly id: string;
	readonly priority: number;
}

export class BinaryMaxHeap implements Queue {
	private readonly heap: BinaryMaxHeapElement[] = [];
	private readonly indexMap: Map<string, number> = new Map();

	get length(): number {
		return this.heap.length;
	}

	filter(o: Readonly<Partial<BinaryMaxHeapAddOptions>>): Task[] {
		// Filter based on criteria
		// Note: The heap is not sorted, but the previous implementation returned elements in priority order (implicitly, as it was sorted).
		// To maintain compatibility, we should sort the result of the filter.
		return this.heap
			.filter(el => {
				if (o.priority !== undefined && el.priority !== o.priority)
					return false;
				// Add other filter conditions here if LineAddOptions expands
				return true;
			})
			.sort((a, b) => b.priority - a.priority)
			.map(({ task }) => task);
	}

	public pick(): Task | undefined {
		if (this.length === 0) return undefined;

		const root = this.heap[0];
		const last = this.heap.pop();

		if (root && last && this.length > 0) {
			this.heap[0] = last;
			this.indexMap.set(last.id, 0);
			this.indexMap.delete(root.id);
			this.bubbleDown(0);
		} else {
			// Only one element was in the heap
			// root is guaranteed to be defined here because length was > 0 at start
			// and pop() returns the only element as 'last' (which is equal to 'root' and 'last')
			// but we need 'root' reference for id
			// biome-ignore lint/style/noNonNullAssertion: guaranteed by length check
			this.indexMap.delete(root!.id);
		}

		// biome-ignore lint/style/noNonNullAssertion: guaranteed by length check
		return root!.task;
	}

	public add(task: Task, o: BinaryMaxHeapAddOptions): void {
		const newElement: BinaryMaxHeapElement = {
			task,
			id: o.id,
			priority: o.priority
		};

		this.heap.push(newElement);
		this.indexMap.set(o.id, this.length - 1);
		this.bubbleUp(this.length - 1);
	}

	public prioritize(id: string, priority: number): void {
		const index = this.indexMap.get(id);
		if (index === undefined) {
			throw new ReferenceError(`task [${id}] does not exist`);
		}

		const element = this.heap[index];
		if (!element) return; // Should not happen if map is consistent

		const oldPriority = element.priority;

		// Create new element with updated priority (keeping other props)
		const updatedElement: BinaryMaxHeapElement = {
			...element,
			priority
		};

		this.heap[index] = updatedElement;

		if (priority > oldPriority) {
			this.bubbleUp(index);
		} else {
			this.bubbleDown(index);
		}
	}

	private bubbleUp(index: number): void {
		let currentIndex = index;
		while (currentIndex > 0) {
			const parentIndex = Math.floor((currentIndex - 1) / 2);
			const current = this.heap[currentIndex];
			const parent = this.heap[parentIndex];

			if (current && parent && current.priority > parent.priority) {
				this.swap(currentIndex, parentIndex);
				currentIndex = parentIndex;
			} else {
				break;
			}
		}
	}

	private bubbleDown(index: number): void {
		let currentIndex = index;
		const length = this.length;

		while (true) {
			const leftChildIndex = 2 * currentIndex + 1;
			const rightChildIndex = 2 * currentIndex + 2;
			let swapIndex = -1;

			const current = this.heap[currentIndex];
			const left = this.heap[leftChildIndex];
			const right = this.heap[rightChildIndex];

			if (!current) break;

			if (leftChildIndex < length && left) {
				if (left.priority > current.priority) {
					swapIndex = leftChildIndex;
				}
			}

			if (rightChildIndex < length && right) {
				const compareTo = swapIndex === -1 ? current : this.heap[swapIndex];
				// compareTo is guaranteed to be defined because:
				// 1. inner loop check: current is defined
				// 2. if swapIndex != -1, it is leftChildIndex, and left is defined
				// biome-ignore lint/style/noNonNullAssertion: guaranteed by logic
				if (right.priority > compareTo!.priority) {
					swapIndex = rightChildIndex;
				}
			}

			if (swapIndex !== -1) {
				this.swap(currentIndex, swapIndex);
				currentIndex = swapIndex;
			} else {
				break;
			}
		}
	}

	private swap(i: number, j: number): void {
		const valI = this.heap[i];
		const valJ = this.heap[j];

		if (!valI || !valJ) return;

		this.heap[i] = valJ;
		this.heap[j] = valI;

		this.indexMap.set(valI.id, j);
		this.indexMap.set(valJ.id, i);
	}
}
