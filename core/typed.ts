/**
 * A typed variant of the platform `FormData` API.
 * Constrains `append`, `get`, `getAll`, `has`, and `set` to the fields
 * defined in `TData`.
 *
 * @template TData A record mapping field names to their value types.
 */
export interface TypedFormData<TData extends Record<string, string | File> = Record<string, string | File>>
	extends DomIterable<keyof TData, TData[keyof TData]> {
	append<TName extends keyof TData>(name: TName, value: TData[TName] extends File ? Blob : TData[TName], fileName?: string): void;
	delete<TName extends keyof TData>(name: TName): void;
	get<TName extends keyof TData>(name: TName): TData[TName] | null;
	getAll<TName extends keyof TData>(name: TName): TData[TName][];
	has<TName extends keyof TData>(name: TName): boolean;
	set<TName extends keyof TData>(name: TName, value: TData[TName] extends File ? Blob : TData[TName], fileName?: string): void;
}

/** This Fetch API interface allows you to perform various actions on HTTP
 * request and response headers. These actions include retrieving, setting,
 * adding to, and removing. A Headers object has an associated header list,
 * which is initially empty and consists of zero or more name and value pairs.
 * You can add to this using methods like append() (see Examples). In all
 * methods of this interface, header names are matched by case-insensitive byte
 * sequence.
 *
 * @category Fetch
 */
export interface TypedHeaders<TData extends Record<string, string | undefined>> extends DomIterable<keyof TData, TData[keyof TData]> {
	/** Appends a new value onto an existing header inside a `Headers` object, or
	 * adds the header if it does not already exist.
	 */
	append<TName extends keyof TData>(name: TName, value: TData[TName]): void;

	/** Deletes a header from a `Headers` object. */
	delete<TName extends keyof TData>(name: TName): void;

	/** Returns a `ByteString` sequence of all the values of a header within a
	 * `Headers` object with a given name.
	 */
	get<TName extends keyof TData>(name: TName): TData[TName] | null;

	/** Returns a boolean stating whether a `Headers` object contains a certain
	 * header.
	 */
	has<TName extends keyof TData>(name: TName): boolean;

	/** Sets a new value for an existing header inside a Headers object, or adds
	 * the header if it does not already exist.
	 */
	set<TName extends keyof TData>(name: TName, value: TData[TName]): void;

	/** Returns an array containing the values of all `Set-Cookie` headers
	 * associated with a response.
	 */
	getSetCookie(): string[];
}

/**
 * URLSearchParams provides methods for working with the query string of a URL.
 *
 * Use this interface to:
 * - Parse query parameters from URLs
 * - Build and modify query strings
 * - Handle form data (when used with FormData)
 * - Safely encode/decode URL parameter values
 *
 * @category URL
 */
export interface TypedURLSearchParams<TData extends Record<string, string | undefined>> {
	/** Appends a specified key/value pair as a new search parameter.
	 *
	 * ```ts
	 * let searchParams = new URLSearchParams();
	 * searchParams.append('name', 'first');
	 * searchParams.append('name', 'second');
	 * ```
	 */
	append<TName extends keyof TData>(name: TName, value: TData[TName]): void;

	/** Deletes search parameters that match a name, and optional value,
	 * from the list of all search parameters.
	 *
	 * ```ts
	 * let searchParams = new URLSearchParams([['name', 'value']]);
	 * searchParams.delete('name');
	 * searchParams.delete('name', 'value');
	 * ```
	 */
	delete<TName extends keyof TData>(name: TName, value?: TData[TName]): void;

	/** Returns all the values associated with a given search parameter
	 * as an array.
	 *
	 * ```ts
	 * searchParams.getAll('name');
	 * ```
	 */
	getAll<TName extends keyof TData>(name: TName): TData[TName][] | undefined;

	/** Returns the first value associated to the given search parameter.
	 *
	 * ```ts
	 * searchParams.get('name');
	 * ```
	 */
	get<TName extends keyof TData>(name: TName): TData[TName] | null;

	/** Returns a boolean value indicating if a given parameter,
	 * or parameter and value pair, exists.
	 *
	 * ```ts
	 * searchParams.has('name');
	 * searchParams.has('name', 'value');
	 * ```
	 */
	has<TName extends keyof TData>(name: TName, value?: TData[TName]): boolean;

	/** Sets the value associated with a given search parameter to the
	 * given value. If there were several matching values, this method
	 * deletes the others. If the search parameter doesn't exist, this
	 * method creates it.
	 *
	 * ```ts
	 * searchParams.set('name', 'value');
	 * ```
	 */
	set<TName extends keyof TData>(name: TName, value: TData[TName]): void;

	/** Sort all key/value pairs contained in this object in place and
	 * return undefined. The sort order is according to Unicode code
	 * points of the keys.
	 *
	 * ```ts
	 * searchParams.sort();
	 * ```
	 */
	sort(): void;

	/** Calls a function for each element contained in this object in
	 * place and return undefined. Optionally accepts an object to use
	 * as this when executing callback as second argument.
	 *
	 * ```ts
	 * const params = new URLSearchParams([["a", "b"], ["c", "d"]]);
	 * params.forEach((value, key, parent) => {
	 *   console.log(value, key, parent);
	 * });
	 * ```
	 */
	forEach(
		callbackfn: (value: TData[keyof TData], key: keyof TData, parent: this) => void,
		thisArg?: any,
	): void;

	/** Returns an iterator allowing to go through all keys contained
	 * in this object.
	 *
	 * ```ts
	 * const params = new URLSearchParams([["a", "b"], ["c", "d"]]);
	 * for (const key of params.keys()) {
	 *   console.log(key);
	 * }
	 * ```
	 */
	keys(): URLSearchParamsIterator<keyof TData>;

	/** Returns an iterator allowing to go through all values contained
	 * in this object.
	 *
	 * ```ts
	 * const params = new URLSearchParams([["a", "b"], ["c", "d"]]);
	 * for (const value of params.values()) {
	 *   console.log(value);
	 * }
	 * ```
	 */
	values(): URLSearchParamsIterator<TData[keyof TData]>;

	/** Returns an iterator allowing to go through all key/value
	 * pairs contained in this object.
	 *
	 * ```ts
	 * const params = new URLSearchParams([["a", "b"], ["c", "d"]]);
	 * for (const [key, value] of params.entries()) {
	 *   console.log(key, value);
	 * }
	 * ```
	 */
	entries(): URLSearchParamsIterator<[keyof TData, TData[keyof TData]]>;

	/** Returns an iterator allowing to go through all key/value
	 * pairs contained in this object.
	 *
	 * ```ts
	 * const params = new URLSearchParams([["a", "b"], ["c", "d"]]);
	 * for (const [key, value] of params) {
	 *   console.log(key, value);
	 * }
	 * ```
	 */
	[Symbol.iterator](): URLSearchParamsIterator<[keyof TData, TData[keyof TData]]>;

	/** Returns a query string suitable for use in a URL.
	 *
	 * ```ts
	 * searchParams.toString();
	 * ```
	 */
	toString(): string;

	/** Contains the number of search parameters
	 *
	 * ```ts
	 * searchParams.size
	 * ```
	 */
	readonly size: number;
}

/** The URL interface represents an object providing static methods used for
 * creating, parsing, and manipulating URLs in Deno.
 *
 * Use the URL API for safely parsing, constructing, normalizing, and encoding URLs.
 * This is the preferred way to work with URLs in Deno rather than manual string
 * manipulation which can lead to errors and security issues.
 *
 * @see https://developer.mozilla.org/docs/Web/API/URL
 *
 * @category URL
 */
export type TypedURL<TSearchParams extends Record<string, string | undefined>> = Omit<globalThis.URL, "searchParams"> & {
	/**
	 * The `searchParams` property of the URL interface provides a direct interface to
	 * query parameters through a {@linkcode URLSearchParams} object.
	 *
	 * This property offers a convenient way to:
	 * - Parse URL query parameters
	 * - Manipulate query strings
	 * - Add, modify, or delete URL parameters
	 * - Work with form data in a URL-encoded format
	 * - Handle query string encoding/decoding automatically
	 *
	 * @example
	 * ```ts
	 * // Parse and access query parameters from a URL
	 * const myURL = new URL('https://example.org/search?term=deno&page=2&sort=desc');
	 * const params = myURL.searchParams;
	 *
	 * console.log(params.get('term'));  // Logs "deno"
	 * console.log(params.get('page'));  // Logs "2"
	 *
	 * // Check if a parameter exists
	 * console.log(params.has('sort'));  // Logs true
	 *
	 * // Add or modify parameters (automatically updates the URL)
	 * params.append('filter', 'recent');
	 * params.set('page', '3');
	 * console.log(myURL.href);  // URL is updated with new parameters
	 *
	 * // Remove a parameter
	 * params.delete('sort');
	 *
	 * // Iterate over all parameters
	 * for (const [key, value] of params) {
	 *   console.log(`${key}: ${value}`);
	 * }
	 * ```
	 *
	 * @see https://developer.mozilla.org/docs/Web/API/URL/searchParams
	 */
	readonly searchParams: TypedURLSearchParams<TSearchParams>;
};
