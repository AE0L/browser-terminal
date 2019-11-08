define([
		'utilities/htmlDom',
		'utilities/styles',
		'utilities/storage'
	],

	(dom, styles, storage) => {
		const Terminal = function() {}

		Terminal.prototype = (function(dom, styles, storage) {
			let config = {}

			let states = {
				curr_buffer: 0,
				curr_history: 0,
				history: [],
			}

			/**
			 * The HTML elements used by the terminal.
			 */
			let components = {
				main_stdin_cont: dom.getById('input-cont'),
				main_stdin: dom.getById('main-stdin'),
				curr_stdin: null,
				prompt_user: dom.getById('main-stdin-user'),
				prompt_symbol: dom.getById('main-stdin-symbol'),
				bottom_offset: dom.getById('bottom-offset'),
				stdout: dom.getById('stdout'),
			}

			/**
			 * Contains the all the commands included in the terminal.
			 */
			let commands = {
				installed: {},
				aliases: [],

				valid: function(command) {
					let valid = false

					if (this.installed[command] !== undefined) {
						return true
					} else {
						return this.aliases.filter(alias => alias.split('=')[0] === command).length !== 0
					}
				},

				help: function(command) {
					return this.installed[command].help
				},

				get: function(command) {
					let search = this.installed[command]

					if (search === undefined) {
						command = this.aliases.filter(alias => alias.split('=')[0] === command)[0].split('=')[1]
						search = this.installed[command]
					}

					return search
				}
			}

			/**
			 * Checks if the key can be found on the available configuration.
			 */
			function check_config_key(key) {
				return new Promise((resolve, reject) => {
					if (config[key] !== undefined)
						return resolve()
					else
						return reject()
				})
			}

			/**
			 * Sets the value of a key in the configuration. Updates the CSS variables and reload the main
			 * STDIN.
			 */
			function set_config(key, value) {
				return new Promise((resolve, reject) => {
					config[key] = value
					styles.setVar(`--config-${key}`, value)
					storage.store('terminal-config', config)
					reload_main_stdin()

					return resolve()
				})
			}

			/**
			 * Get the names of the installed commands in the terminal.
			 */
			function get_installed_commands() {
				return Object.keys(commands.installed)
			}

			/**
			 * Gets the help(String) of the specified command.
			 */
			function get_command_help(command) {
				return new Promise((resolve, reject) => {
					const help = commands.help(command)

					if (help)
						return resolve(help)
					else
						return reject()
				})
			}

			/**
			 * Gets the terminal's configuration
			 */
			function get_config() {
				return config
			}


			/**
			 * Must be run first before doing anything with the terminal. Retrieves the configuration in 
			 * Local Storage if there is any and setups the main STDIN.
			 */
			function setup() {
				const _config = storage.retrieve('terminal-config')

				if (!_config) {
					config = {
						background: styles.getVar('--config-background'),
						foreground: styles.getVar('--config-foreground'),
						font_size: styles.getVar('--config-font_size'),
						font_weight: styles.getVar('--config-font_weight'),
						margin_sides: styles.getVar('--config-margins_sides'),
						prompt_user_color: styles.getVar('--config-prompt_user_color'),
						prompt_symbol_color: styles.getVar('--config-prompt_symbol_color'),
						prompt_symbol: '$',
						error_source_color: styles.getVar('--config-error_source_color'),
						error_code_color: styles.getVar('--config-error_code_color'),
						secondary_color: '#608460',
						prompt_user: 'User',
						max_buffer: 50,
						max_history: 10,
						tab_size: 2
					}

					storage.store('terminal-config', config)
				} else {
					config = _config
				}

				Object.keys(config).forEach(key => set_config(key, config[key]))

				reload_main_stdin()

				change_curr_stdin(components.main_stdin)
			}

			/**
			 * Changes the current used STDIN and any click events will focus it. If the STDIN is the main
			 * STDIN, it will add the correct keyboard events.
			 */
			function change_curr_stdin(stdin) {
				if (components.curr_stdin)
					components.curr_stdin.disabled = true
				components.curr_stdin = stdin

				if (stdin !== null) {
					document.onclick = () => components.curr_stdin.focus()

					if (stdin === components.main_stdin) {
						components.main_stdin.disabled = false
						document.onkeydown = (e) => {
							if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
								console.log('pressed')
								run_command(components.curr_stdin.value, false)
							} else if (e.key === 'Tab') {
								e.preventDefault()
								e.target.value = `${e.target.value}${' '.repeat(config.tab_size)}`
							} else if (e.key === 'ArrowUp') {
								e.preventDefault()
								e.target.value = history_up() || e.target.value
							} else if (e.key === 'ArrowDown') {
								e.preventDefault()
								e.target.value = history_down() || e.target.value
							}
						}
					} else {
						document.onkeydown = () => {}
					}

					components.curr_stdin.focus()
				} else {
					document.onclick = () => {}
					document.onkeydown = () => {}
				}
			}

			/**
			 * Checks first if the command is valid. If valid, runs a Promise Race with the run method of
			 * the specified command and the cancel Promise, which will resolve if 'CTRL+C' is pressed. If
			 * the command throws an error or reject, display it in the terminal.
			 */
			function run_command(input, quiet) {
				if (quiet === false) {
					display_command(input)
				}

				add_to_history(input)

				input = input.split(' ')
				const command = input.shift()
				input = input.join(' ').trim()

				const cancel_command = () => new Promise(resolve => {
					const key_handler = (e) => {
						if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
							document.removeEventListener('keydown', key_handler)

							return resolve()
						}
					}

					document.addEventListener('keydown', key_handler, false)
				})

				const remove_cancel_listener = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }))

				if (commands.valid(command)) {
					hide_main_stdin()

					Promise.race([commands.get(command).run(input), cancel_command()])
						.catch((err) => {
							error(command, err.code, err.details)
						})
						.then(() => {
							console.log('command execution successful')
							remove_cancel_listener()
							show_main_stdin()
						})
				} else if (command === '') {
					show_main_stdin()
				} else {
					error('Terminal', null, 'command not found...')
					show_main_stdin()
				}
			}

			/**
			 * Add the input to the terminal's history state.
			 */
			function add_to_history(input) {
				states.history.unshift(input)
				states.curr_history = -1
				if (states.history.length > config.max_history) {
					states.history.pop()
				}
			}

			/**
			 * Cycles down in the terminal's history
			 */
			function history_down() {
				if (states.curr_history - 1 >= 0) {
					states.curr_history -= 1
					return states.history[states.curr_history]
				} else if (states.curr_history === -1) {
					states.curr_history = 1
					return states.history[0]
				} else {
					return states.history[0]
				}
			}

			/**
			 * Cycles up in the termina's history
			 */
			function history_up() {
				if (states.curr_history + 1 < states.history.length) {
					states.curr_history += 1
					return states.history[states.curr_history]
				} else {
					return states.history[states.history.length - 1]
				}
			}

			/**
			 * Installs the package and its command modules. If a module contains aliases add it to the
			 * aliases directory.
			 */
			function install(terminal, package) {
				package.modules.forEach(module => {
					module.terminal = terminal

					if (module.aliases) {
						module.aliases.forEach(alias => {
							commands.aliases.push(`${alias}=${module.name}`)
						})
					}

					commands.installed = { ...commands.installed, [`${module.name}`]: module }
				})
			}

			/**
			 * Clears the STDOUT by removing all children node.
			 */
			function clear() {
				const stdout = components.stdout

				while (stdout.firstChild)
					stdout.removeChild(stdout.firstChild)

				states.curr_buffer = 0
			}

			/**
			 * Prints the given text to the STDOUT
			 */
			function print(text) {
				const line = document.createElement('pre')
				line.classList.add('line')
				line.appendChild(document.createTextNode(text))
				append_stdout(line)
				components.bottom_offset.scrollIntoView()
			}

			/**
			 * Adds a empty line in the STDOUT
			 */
			function new_line() {
				const line = document.createElement('pre')
				line.appendChild(dom.text(' '))
				line.classList.add('line')
				append_stdout(line)
				components.bottom_offset.scrollIntoView()
			}

			/**
			 * 
			 */
			function read_line(label_text) {
				hide_main_stdin()
				return new Promise((resolve, reject) => {
					const line = dom.create('div')
					const input = dom.create('input')
					let label

					if (label_text) {
						label = dom.create('pre')
						label.appendChild(dom.text(label_text))
						label.classList.add('label')
						line.appendChild(label)
					}

					input.classList.add('stdin')
					line.classList.add('command')
					line.appendChild(input)

					function submit(e) {
						if (e.key === 'Enter') {
							e.preventDefault()
							this.removeEventListener('keydown', submit)
							return resolve(this.value)
						}
					}

					input.addEventListener('keydown', submit)

					append_stdout(line)
					change_curr_stdin(input)
				})
			}

			/**
			 * Add a Textarea in the STDOUT. If `SHIFT+Enter` was pressed it will resolve and return the
			 * textarea's current value. Accepts a text parameter for the initial value of the textarea.
			 */
			function read_textarea(text) {
				hide_main_stdin()
				return new Promise((resolve, reject) => {
					const textarea = document.createElement('textarea')

					textarea.setAttribute('spellcheck', false)

					if (text) {
						textarea.value = text
					}

					resize = (target) => setTimeout(() => {
						target.style.height = 'auto'
						target.style.height = `${target.scrollHeight}px`
						components.bottom_offset.scrollIntoView()
					}, 0)

					function autosize(e) {
						if (e.key === 'Enter' && e.shiftKey) {
							e.preventDefault()
							return resolve(this.value)
						} else if (e.key === 'Tab') {
							e.preventDefault()
							this.value = `${this.value}${' '.repeat(config.tab_size)}`
						} else {
							resize(e.target)
						}
					}

					textarea.addEventListener('keydown', autosize)
					append_stdout(textarea)
					resize(textarea)
					change_curr_stdin(textarea)
				})
			}

			/**
			 * Display the error source, error code (If specified), and the error details in the terminal.
			 */
			function error(source, code, details) {
				const err_cont = document.createElement('div')
				const err_source = document.createElement('pre')
				const err_details = document.createElement('pre')

				err_cont.appendChild(err_source)
				err_source.appendChild(document.createTextNode(`[${source}]`))
				err_source.classList.add('error-source')
				err_source.classList.add('line')
				err_details.classList.add('line')

				if (code) {
					const err_code = document.createElement('pre')
					err_code.classList.add('error-code')
					err_code.classList.add('line')
					err_code.appendChild(document.createTextNode(`[Error Code: ${code}]`))
					err_cont.appendChild(err_code)
					err_cont.classList.add('error-with-code')
				} else {
					err_cont.classList.add('error')
				}

				err_cont.appendChild(err_details)
				err_details.appendChild(document.createTextNode(details))

				append_stdout(err_cont)
			}

			/**
			 * Displays the submitted input from the main STDIN.
			 */
			function display_command(command) {
				const display = document.createElement('div')
				const input = document.createElement('pre')
				const prompt = document.createElement('div')
				const user = document.createElement('span')
				const symbol = document.createElement('span')

				prompt.classList.add('prompt')
				prompt.appendChild(user)
				prompt.appendChild(symbol)
				user.classList.add('user-name')
				user.appendChild(document.createTextNode(`[${config.prompt_user}]`))
				symbol.classList.add('prompt-symbol')
				symbol.appendChild(document.createTextNode(config.prompt_symbol))
				input.appendChild(document.createTextNode(command))
				input.classList.add('line')
				display.classList.add('command')
				display.appendChild(prompt)
				display.appendChild(input)
				append_stdout(display)
			}

			/**
			 * Append the given HTML node to the STDOUT
			 */
			function append_stdout(node) {
				components.stdout.appendChild(node)
				if (++states.curr_buffer > config.max_buffer)
					components.stdout.removeChild(stdout.firstChild)
			}

			/**
			 * Hides the main STDIN and remove all keyboard events attached to it.
			 */
			function hide_main_stdin() {
				components.main_stdin_cont.classList.add('hide-stdin')
				change_curr_stdin(null)
			}

			/**
			 * Shows the main STDIN and re-enables all keyboard events attached to it.
			 */
			function show_main_stdin() {
				components.main_stdin_cont.classList.remove('hide-stdin')
				components.main_stdin.value = ''
				components.bottom_offset.scrollIntoView()
				setTimeout(() => change_curr_stdin(components.main_stdin))
			}

			/**
			 * Checks if there were any changes made to the configuration (prompt_user & prompt_symbol).
			 */
			function reload_main_stdin() {
				components.prompt_user.innerText = `[${config.prompt_user}]`
				components.prompt_symbol.innerText = config.prompt_symbol
			}

			return {
				constructor: Terminal,

				/* stdout methods */
				clear: clear,
				print: print,
				new_line: new_line,

				/* stdin methods */
				read_textarea: read_textarea,
				read_line: read_line,

				/* getters */
				get_installed_commands: get_installed_commands,
				get_command_help: get_command_help,

				/* terminal core methods */
				setup: setup,
				install: function(module) { install(this, module) },
				run_command: run_command,

				/* config functions */
				get_config: get_config,
				check_config_key: check_config_key,
				set_config: set_config,
			}
		})(dom, styles, storage)

		return Terminal
	}
)