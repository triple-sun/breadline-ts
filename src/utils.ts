/**
 * {@link https://en.cppreference.com/w/cpp/algorithm/lower_bound | C++ lower_bound}*/
export const lbound = <T>(
	array: readonly T[],
	value: T,
	comparator: (a: T, b: T) => number
): number => {
	let first = 0;
	let count = array.length;

	while (count > 0) {
		const step = Math.trunc(count / 2);
		let it = first + step;

		// biome-ignore lint/style/noNonNullAssertion: <math>
		if (comparator(array[it]!, value) <= 0) {
			first = ++it;
			count -= step + 1;
		} else {
			count = step;
		}
	}

	return first;
};

export const validateNumericOption = (
	name: string,
	value: number,
	opts: Readonly<{ min?: number; finite?: boolean }>
) => {
	const { min = 0, finite = true } = { ...opts };

	if (
		!(
			typeof value === "number" &&
			value >= min &&
			(finite ? Number.isFinite(value) : true)
		)
	) {
		throw new TypeError(
			`"${name}" should be a ${finite ? "finite" : "infinite"} number >=${min}; instead got "${value.toString() ?? ""}" (${typeof value})`
		);
	}
};
