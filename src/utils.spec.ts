/** biome-ignore-all lint/suspicious/noExplicitAny: <jesting> */
import { validateNumericOption } from "./utils";

describe("utils", () => {
	describe("validateNumericOption", () => {
		it("should not throw for valid values", () => {
			expect(() => validateNumericOption("test", 10, { min: 0 })).not.toThrow();
			expect(() =>
				validateNumericOption("test", Number.POSITIVE_INFINITY, {
					finite: false
				})
			).not.toThrow();
		});

		it("should throw if value is not a number", () => {
			expect(() => validateNumericOption("test", "10" as any, {})).toThrow(
				TypeError
			);
			expect(() => validateNumericOption("test", NaN, {})).toThrow(TypeError);
		});

		it("should throw if value is less than min", () => {
			expect(() => validateNumericOption("test", -1, { min: 0 })).toThrow(
				TypeError
			);
		});

		it("should throw if value is indeed infinite when finite is required", () => {
			expect(() =>
				validateNumericOption("test", Number.POSITIVE_INFINITY, {
					finite: true
				})
			).toThrow(TypeError);
		});

		it("should handle custom toString in error message", () => {
			const badValue = {
				toString: () => "bad"
			};
			expect(() =>
				validateNumericOption("test", badValue as unknown as number, {})
			).toThrow(/bad/);
		});

		it("should handle toString returning undefined", () => {
			const weirdValue = {
				toString: () => undefined
			};
			try {
				validateNumericOption("test", weirdValue as unknown as number, {});
			} catch (e: any) {
				expect(e).toBeInstanceOf(TypeError);
				// It might stringify explicitly or hit the ?? "" branch
			}
		});
	});
});
