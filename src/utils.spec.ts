import { lowerBound, validateNumericOption } from "./utils";

describe("utils", () => {
	describe("lowerBound", () => {
		const comparator = (a: number, b: number) => a - b;

		it("should return 0 for an empty array", () => {
			expect(lowerBound([], 5, comparator)).toBe(0);
		});

		it("should return index where element should be inserted to maintain order", () => {
			const arr = [1, 2, 4, 5];
			expect(lowerBound(arr, 3, comparator)).toBe(2);
			expect(lowerBound(arr, 0, comparator)).toBe(0);
			expect(lowerBound(arr, 6, comparator)).toBe(4);
		});

		it("should return the first occurrence index for duplicate values", () => {
			const arr = [1, 2, 2, 2, 3];
			expect(lowerBound(arr, 2, comparator)).toBe(4);
		});

		it("should work with objects and custom comparator", () => {
			const arr = [{ val: 1 }, { val: 3 }];
			const comp = (a: { val: number }, b: { val: number }) => a.val - b.val;
			expect(lowerBound(arr, { val: 2 }, comp)).toBe(1);
		});
	});

	describe("validateNumericOption", () => {
		it("should not throw for valid values", () => {
			expect(() => validateNumericOption("test", 10, { min: 0 })).not.toThrow();
			expect(() =>
				validateNumericOption("test", Number.POSITIVE_INFINITY, {
					finite: false,
				}),
			).not.toThrow();
		});

		it("should throw if value is not a number", () => {
			expect(() => validateNumericOption("test", "10" as any, {})).toThrow(
				TypeError,
			);
			expect(() => validateNumericOption("test", NaN, {})).toThrow(TypeError);
		});

		it("should throw if value is less than min", () => {
			expect(() => validateNumericOption("test", -1, { min: 0 })).toThrow(
				TypeError,
			);
		});

		it("should throw if value is indeed infinite when finite is required", () => {
			expect(() =>
				validateNumericOption("test", Number.POSITIVE_INFINITY, {
					finite: true,
				}),
			).toThrow(TypeError);
		});
	});
});
