define(() => {
	const storage = window.localStorage
	const dataToString = (o) => JSON.stringify(o)
	const parse = (s) => JSON.parse(s)

	return {
		store: (k, v) => storage.setItem(k, dataToString(v)),

		storeAll: (items) => items.forEach(({ k, v }) => storage.setItem(k, dataToString(v))),

		retrieve: (k) => parse(storage.getItem(k)),
	}
})