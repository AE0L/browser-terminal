define(() => {
	const storage = window.localStorage
	const toString = (o) => JSON.stringify(o)
	const parse = (s) => JSON.parse(s)

	return {
		store: (k,v) => storage.setItem(k,toString(v)),
		storeAll: (items) => items.forEach(({k,v}) => storage.setItem(k,toString(v))),
		retrieve: (k) => parse(storage.getItem(k)),
	}
})