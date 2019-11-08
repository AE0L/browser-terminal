define([
	'utilities/storage',
], (storage) => {
	return {
		modules: [{
				name: 'clear',
				aliases: ['cls', 'clr'],
				help: `~Command Help
		      ~~Command: clear
		      ~Details: resets the terminal's buffer and clear the screen.
		      ~Usage:   clear [no-args]~`,
				run: function() {
					return new Promise((resolve, reject) => {
						this.terminal.clear()
						return resolve()
					})
				}
			},

			{
				name: 'config',
				help: `~Command Help:
					~~Command: config
					~Details: Change or view the terminal's configuration.
					~Aliases: 'cls', 'clr'
					~Usage:   config [command] [key=value pair]
					~Commands:
					~~    -v   view the configuration.
					~    -c   change a value of a key
					~    -r   resets the whole configuration or a specific key.
					~~To change a key in the configuration, specify the key and the new value. Colors and Measurements
					~must be a valid CSS value. 
					~~    config -c background=#ffffff
					~    config font-size = 24px
					~    config -c foreground= rgb(17, 17, 17, 0.5)
					~    config prompt_symbol = #
					~~There are two ways to view all configuration:
					~~    config
					~    config -v
					~~To reset a specific configuration, specify the key:
					~~    config -r prompt_color
					~~To reset the whole configuration, run without a key:
					~~    config -r~`,
				error_codes: {
					C01: {
						code: 'C01',
						details: 'invalid use of command, run "help config" for more details'
					},
					C02: {
						code: 'C02',
						details: 'invalid key, run "config" or "config -v" to see all available configuration'
					},
					C03: {
						code: 'C03',
						details: 'invalid given value, try checking your input'
					},
					C04: {
						code: 'C04',
						details: 'invalid key=value pair, try checking your input. Make sure to add "=" in between'
					},
					C05: {
						code: 'C05',
						details: 'error occured while changing the configuration, please try again'
					}
				},
				run: function(input) {
					return new Promise((resolve, reject) => {
						const terminal = this.terminal
						const config = terminal.get_config()
						const keys = Object.keys(config)
						let args = input.split(' ')
						let target
						let pair

						const valid = () => {
							const hasExcessArgs = () => args.filter(x => /^-[vcr]$/.test(x)).length !== 0

							if (args[0].match(/^-[vcr]$/)) {
								target = args.shift()

								if (!hasExcessArgs()) {
									args = args.join('')
									return true
								} else {
									return false
								}
							} else {
								if (!hasExcessArgs()) {
									args = args.join('')
									return true
								} else {
									return false
								}
							}
						}

						if (!valid()) {
							return reject(this.error_codes.C01)
						} else {
							const validPair = () => args.length > 0 && args.includes('=')
							const getKey = () => args.split('=')[0]
							const getValue = () => args.split('=')[1]

							const isValidValue = (old, value) => {
								let x = new Option().style
								if (value.match(/%|cm|em|ex|in|mm|pc|pt|px/g)) {
									x.fontSize = value
									return x.fontSize !== ''
								} else if (value.match(/(^#([\da-fA-F]{3,6}$))|(^rgb)|(^rgba)/g)) {
									x.color = value
									return x.color !== ''
								} else {
									const numValue = parseInt(value)

									if (!numValue) {
										return typeof old === typeof value
									} else {
										return typeof old === typeof numValue
									}
								}
							}

							const isValidKey = (key) => {
								return keys.includes(key)
							}

							const viewConfiguration = () => {
								terminal.new_line()
								terminal.print('Configuration data:')
								terminal.new_line()
								keys.forEach(key => terminal.print(` * ${key}=${config[key].toString().trim()}`))
								terminal.new_line()

								return resolve()
							}

							const changeConfiguration = () => {
								if (!validPair()) {
									return reject(this.error_codes.C04)
								}

								let key = getKey()
								let value = getValue()

								if (isValidKey(key)) {
									if (isValidValue(config[key], value)) {
										terminal.set_config(key, value).then(() => {
											terminal.print(`${key} change was successful`)
											return resolve()
										})
									} else {
										return reject(this.error_codes['C03'])
									}
								} else {
									return reject(this.error_codes['C02'])
								}
							}

							const resetConfiguration = () => {
								let key = getKey()

								const default_config = {
									background: '#121212',
									foreground: '#FFFFFF',
									font_size: '17px',
									margin_sides: '16px',
									prompt_color: '#4be14b',
									prompt_symbol: '$',
									prompt_user: 'Guest',
									max_buffer: 50,
									max_history: 10,
									tab_size: 2
								}

								if (args.length > 0) {
									terminal.set_config(key, default_config[key])
										.then(() => {
											terminal.print(`${key} was changed to default`)
											return resolve()
										})
										.catch(() => {
											return reject(this.error_codes.C05)
										})
								} else {
									storage.store('terminal-config', default_config)
									terminal.run_command('rs')
								}
							}

							switch (target) {
								case '-v':
									viewConfiguration()
									break

								case '-c':
									changeConfiguration()
									break

								case '-r':
									resetConfiguration()
									break

								default:
									if (args.length > 0) {
										changeConfiguration()
									} else {
										viewConfiguration()
									}

									return resolve()
							}
						}
					})
				}

			},

			{
				name: 'echo',
				help: `~Command Help
		      ~~Command: echo
		      ~Details: prints a string on the terminal.
		      ~Usage:   echo string~`,
				run: function(text) {
					return new Promise((resolve, reject) => {
						this.terminal.print(text)
						return resolve()
					})
				}
			},

			{
				name: 'help',
				help: `~Command Help
					~~Command: help
					~Details: displays all registered commands on the terminal or display a specific command info.
					~Usage:   help [command]~`,
				error_codes: {
					H01: {
						code: 'H01',
						details: 'cannnot find command or command doesn\'t have a manual...'
					}
				},

				run: function(command) {
					return new Promise((resolve, reject) => {
						const terminal = this.terminal
						const args = command.split(' ')

						if (args.length === 1 && args[0] === '') {
							terminal.new_line()
							terminal.print('This is the help page. Here are the registered commands:')
							terminal.new_line()
							terminal.get_installed_commands().forEach(command => { terminal.print(`${command}`) })
							terminal.new_line()
							terminal.print(`Type 'help [command]' for more info`)
							terminal.new_line()

							return resolve()
						} else {
							terminal.get_command_help(args[0]).then(
								manual => {
									const lines = manual.split('~').map(line => line.replace(/\r?\n|\r/, ''))
									lines.forEach(line => {
										if (line === '')
											terminal.new_line()
										else
											terminal.print(line)
									})

									return resolve()
								},

								() => reject(this.error_codes.H01)
							)
						}
					})
				}
			},

			{
				name: 'notes',
				aliases: ['nts', 'note'],
				help: `~Command help
					~~Command: notes
					~Aliases: note, nts
					~Details: create and st,re notes in the terminal. Notes are saved through sessions.
					~Usage:   notes [command] note name
					~Commands:
					~~    -c   create a new note
					~    -e   edit a note
					~    -r   read a note
					~    -d   delete a note
					~    -l   list all notes
					~~Create a note named 'to-do-list'.
					~~    notes -c to-do-list
					~    notes -c my to-do list
					~~Edit a note (To save the current note press 'SHIFT + ENTER').
					~~    notes -e to-do-list
					~~You can also use without a argument. If the note name already exists it will read its content,
					~if not, it will create a new note.
					~~    notes new note    (will create a new note named 'new note')
					~    notes recent-note (if note exists, it will display its content)~`,
				error_codes: {
					N01: {
						code: null,
						details: 'Invalid use of command, run "help notes" to find out more...'
					},

					N02: {
						code: null,
						details: 'Note was not found, try checking the name...'
					},

					N03: {
						code: null,
						details: 'You don\'t have any saved notes, try creating one...'
					},

					N04: {
						code: null,
						details: 'The note already exists, try another name'
					}
				},
				run: function(command) {
					return new Promise((resolve, reject) => {
						const terminal = this.terminal
						const args = command.split(' ')
						let notes = storage.retrieve('notes')
						let target
						let noteName

						if (!notes) {
							notes = { list: [] }
							storage.store('notes', notes)
						}

						const valid = () => {
							const hasExcessArgs = () => args.filter(x => /^-[cerdl]$/.test(x)).length > 0

							if (args[0].match(/^-[cerdl]$/)) {
								target = args.shift()

								if (!hasExcessArgs()) {
									noteName = args.join(' ')
									return true
								} else {
									return false
								}
							} else {
								if (!hasExcessArgs()) {
									noteName = args.join(' ')
									return true
								} else {
									return false
								}
							}
						}

						if (!valid()) {
							return reject(this.error_codes.N01)
						} else {
							const findNote = () => notes.list.findIndex(note => note.name === noteName) > -1
							const searchNote = () => notes.list.find(note => note.name === noteName)

							const createNote = () => {
								if (!findNote()) {
									terminal.read_textarea(`Title: ${noteName}`).then((input) => {
										notes.list.push({ name: noteName, note: input })
										storage.store('notes', notes)

										return resolve()
									})
								} else {
									return reject(this.error_codes.N04)
								}
							}

							const editNote = () => {
								if (findNote()) {
									const searched = searchNote()

									terminal.new_line()
									terminal.read_textarea(searched.note.trim()).then((input) => {
										input = input.replace(/^\s*\n/gm, '').trim()

										notes.list[notes.list.indexOf(searched)] = { name: noteName, note: input }

										storage.store('notes', notes)

										terminal.new_line()
										terminal.print('[NOTES INFO]: Note edit was succesfully saved...')
										terminal.new_line()

										return resolve()
									})
								} else {
									return reject(this.error_codes.N02)
								}
							}

							const readNote = () => {
								if (findNote()) {
									const searched = searchNote()

									terminal.new_line()
									searched.note.split('\n').forEach(line => terminal.print(line))
									terminal.new_line()

									return resolve()
								} else {
									return reject(this.error_codes.N02)
								}
							}

							const deleteNote = () => {
								if (findNote()) {
									notes.list = notes.list.filter(note => note.name !== noteName)

									storage.store('notes', notes)

									terminal.new_line()
									terminal.print('[NOTES INFO]: Note deleted succesfully...')
									terminal.new_line()

									return resolve()
								} else {
									return reject(this.error_codes['N02'])
								}
							}

							const listNotes = () => {
								if (notes.list.length > 0) {
									terminal.new_line()
									terminal.print('Notes saved:')
									notes.list.forEach(note => terminal.print(` * ${note.name}`))
									terminal.new_line()

									return resolve()
								} else {
									return reject(this.error_codes.N03)
								}
							}

							switch (target) {
								case '-c':
									createNote()
									break

								case '-e':
									editNote()
									break

								case '-r':
									readNote()
									break

								case '-d':
									deleteNote()
									break

								case '-l':
									listNotes()
									break

								default:
									if (findNote()) {
										readNote()
									} else if (noteName) {
										createNote()
									} else {
										terminal.run_command('help notes', true)
									}
							}
						}
					})
				}
			},

			{
				name: 'restart',
				aliases: ['rs'],
				help: `~Command help
		      ~~Command: restart
		      ~Aliases: rs
		      ~Details: restart the terminal
		      ~Usage:   restart [no-args]~`,
				run: function() {
					return new Promise((resolve, reject) => {
						this.terminal.print('restarting...')
						document.location.reload(false)
					})
				}
			}
		]
	}
})