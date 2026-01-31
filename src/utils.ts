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
