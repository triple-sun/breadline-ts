# Breadline

[![npm version](https://img.shields.io/npm/v/breadline.svg)](https://www.npmjs.com/package/breadline)
[![npm downloads](https://img.shields.io/npm/dm/breadline.svg)](https://www.npmjs.com/package/breadline)
[![License](https://img.shields.io/npm/l/breadline.svg)](https://github.com/triple-sun/breadline/blob/master/LICENSE)

**Breadline** is a robust, type-safe asynchronous task queue for Node.js. It helps you manage concurrency, enforce rate limits, and schedule tasks with priorities, all while retaining full control over execution flow.

## Features

* **Concurrency Control**: Limit the number of tasks running in parallel.
* **Rate Limiting**: Enforce strict execution limits over time windows (e.g., 10 reqs / 1 sec).
* **Priority Support**: Schedule urgent tasks to run before others.
* **AbortSignal Support**: Cancel queued or running tasks using standard `AbortController`.
* **Event-Driven**: Hook into lifecycle events like `empty`, `idle`, or `rateLimited`.
* **Zero Dependencies**: (Almost) zero — only `eventemitter3` for efficient event handling.
* **TypeScript**: Written in TypeScript with full type definitions.

## Installation

```bash
npm install breadline-ts
```

## Usage

### Basic Usage (Concurrency Control)

Limit concurrent execution to prevent overwhelming resources.

```typescript
import { Breadline } from "breadline";

// Create a queue allowing 2 concurrent tasks
const queue = new Breadline({ concurrency: 2 });

const task = (id: number) => async () => {
    console.log(`Start ${id}`);
    await new Promise(r => setTimeout(r, 1000));
    console.log(`End ${id}`);
    return id;
};

// Add tasks
queue.add(task(1));
queue.add(task(2));
queue.add(task(3)); // Will wait until 1 or 2 finishes
```

### Rate Limiting

Ensure you don't exceed API rate limits (e.g., 5 requests per second).

```typescript
const queue = new Breadline({
    interval: 1000, // 1 second window
    intervalCap: 5  // Max 5 tasks per window
});

for (let i = 0; i < 20; i++) {
    queue.add(async () => {
        await fetch("https://api.example.com/data");
    });
}
```

### Prioritization

Process important tasks first, even if they were added later.

```typescript
const queue = new Breadline({ concurrency: 1 });

queue.add(async () => console.log("Low priority"), { priority: 0 });
queue.add(async () => console.log("High priority"), { priority: 10 });
queue.add(async () => console.log("Medium priority"), { priority: 5 });

// Output:
// High priority
// Medium priority
// Low priority
```

### Cancellation (AbortSignal)

Cancel tasks that are waiting in the queue or currently running (if supported by the task).

```typescript
const controller = new AbortController();
const queue = new Breadline();

queue.add(
    async ({ signal }) => {
        const response = await fetch("https://example.com", { signal });
        return response.json();
    },
    { signal: controller.signal }
).catch(err => console.log("Task aborted:", err));

// Cancel the task
controller.abort();
```

## API Reference

### `new Breadline(options?)`

Creates a new queue instance.

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `concurrency` | `number` | `Infinity` | Max concurrent tasks. |
| `interval` | `number` | `1` | Time window in milliseconds for rate limiting. |
| `intervalCap` | `number` | `Infinity` | Max tasks allowed per `interval`. |
| `immediate` | `boolean` | `true` | If `true`, tasks start immediately. If `false`, call `start()`. |

### Methods

* **`add(task, options?)`**: Adds a task to the queue. Returns a Promise that resolves with the task result.
  * `task`: `({ signal }) => Promise<T>`
  * `options`: `{ priority?: number, signal?: AbortSignal, id?: string }`
* **`addMany(tasks, options?)`**: Adds multiple tasks.
* **`pause()`**: Pauses processing of new tasks.
* **`start()`**: Resumes processing.
* **`clear()`**: Removes all queued tasks.
* **`prioritize(id, priority)`**: Updates the priority of a waiting task.
* **`onEmpty()`**: Returns a Promise that resolves when the queue becomes empty.
* **`onIdle()`**: Returns a Promise that resolves when the queue is empty AND all running tasks have finished.

### Events

The queue emits the following events:

* `"add"`: A task was added.
* `"active"`: A task started executing.
* `"done"`: A task completed successfully.
* `"error"`: A task failed.
* `"empty"`: The queue is empty (but tasks may be running).
* `"idle"`: The queue is empty and no tasks are running.
* `"rateLimited"`: Rate limit has been reached.
* `"rateLimitCleared"`: Rate limit has reset.

## License

ISC
