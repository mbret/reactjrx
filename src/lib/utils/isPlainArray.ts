export function isPlainArray(value: unknown) {
	return Array.isArray(value) && value.length === Object.keys(value).length;
}
