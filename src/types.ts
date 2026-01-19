import type { TaskRunOptions } from "./interfaces";

export type Task = () => Promise<unknown>;
export type TaskWithOptions<RESULT_TYPE = unknown> =
	| ((options: TaskRunOptions) => PromiseLike<RESULT_TYPE>)
	| ((options: TaskRunOptions) => RESULT_TYPE);
