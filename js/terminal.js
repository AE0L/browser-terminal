define([
		'utilities/htmlDom',
		'utilities/styles',
		'utilities/storage'
	],

	(dom, styles, storage) => {
		const Terminal = function() {}

		Terminal.prototype = (function(dom, styles, storage) {
			let config = {}

			// f-state
			let states = {
				curr_buffer: 0,
				curr_history: 0,
				history: [],
			}

			// f-components
			let components = {
				main_stdin_cont: dom.getById('input-cont'),
				bottom_offset: dom.getById('bottom-offset'),
				main_stdin: dom.getById('main-stdin'),
				prompt_user: dom.getById('main-stdin-user'),
				prompt_symbol: dom.getById('main-stdin-symbol'),
				curr_stdin: null,
				stdout: dom.getById('stdout'),
				main_stdin_user: dom.getById('main-stdin-user'),
				main_stdin_prompt: dom.getById('main-stdin-prompt'),
			}

			// f-commands
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

			/* ======================================================================================== */
			/* Public */
			// f-checkconfigkey
			function check_config_key(key) {
				return new Promise((resolve, reject) => {
					if (config[key] !== undefined)
						return resolve()
					else
						return reject()
				})
			}

			/* ======================================================================================== */
			/* Private */
			//f-setconfig
			function set_config(key, value) {
				return new Promise((resolve, reject) => {
					config[key] = value
					styles.setVar(`--config-${key}`, value)
					storage.store('terminal-config', config)
					reload_main_stdin()

					return resolve()
				})
			}

			/* ======================================================================================== */
			/* Private */
			// f-getinstalledcommands
			function get_installed_commands() {
				return Object.keys(commands.installed)
			}

			/* ======================================================================================== */
			/* Private */
			function get_command_help(command) {
				return new Promise((resolve, reject) => {
					const help = commands.help(command)

					if (help)
						return resolve(help)
					else
						return reject()
				})
			}

			/* ======================================================================================== */
			/* Public */
			// f-getconfig
			function get_config() {
				return config
			}

			/* ======================================================================================== */
			/* Public */
			// f-setup
			function setup() {
				const _config = storage.retrieve('terminal-config')

				if (!_config) {
					config = {
						background: styles.getVar('--config-background'),
						foreground: styles.getVar('--config-foreground'),
						font_size: styles.getVar('--config-font_size'),
						margin_sides: styles.getVar('--config-margins_sides'),
						prompt_color: styles.getVar('--config-prompt_color'),
						prompt_symbol: '$',
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

				// components.prompt_user.innerText = `[${config.prompt_user}]`
				// components.prompt_symbol.innerText = config.prompt_symbol

				reload_main_stdin()

				change_curr_stdin(components.main_stdin)
			}

			/* ======================================================================================== */
			/* Private */
			// f-changecurrstdin
			function change_curr_stdin(stdin) {
				components.curr_stdin = stdin

				if (stdin !== null) {
					document.onclick = () => components.curr_stdin.focus()

					/* TODO tab autocomplete function */
					// components.curr_stdin.onkeydown = function(e) {}

					if (stdin === components.main_stdin) {
						document.onkeydown = (e) => {
							if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
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

			/* ======================================================================================== */
			/* Public */
			// f-runcommand
			function run_command(input, quiet) {
				if (quiet === false) {
					display_command(input)
				}

				add_to_history(input)

				input = input.split(' ')
				const command = input.shift()
				input = input.join(' ').trim()

				const cancel_command = new Promise(resolve => {
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
					Promise.race([commands.get(command).run(input), cancel_command]).then(
						() => {
							remove_cancel_listener()
							show_main_stdin()
						},

						(err) => {
							console.log(err)
							error(command, err.code, err.details)
							show_main_stdin()
						}
					)
				} else if (command === '') {
					show_main_stdin()
				} else {
					error('Terminal', null, 'command not found...')
					show_main_stdin()
				}
			}

			/* ======================================================================================== */
			/* Private */
			// f-addtohistory
			function add_to_history(input) {
				states.history.unshift(input)
				states.curr_history = -1
				if (states.history.length > config.max_history) {
					states.history.pop()
				}
			}

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

			function history_up() {
				if (states.curr_history + 1 < states.history.length) {
					states.curr_history += 1
					return states.history[states.curr_history]
				} else {
					return states.history[states.history.length - 1]
				}
			}


			/* ======================================================================================== */
			/* Public */
			// f-install
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

			/* ======================================================================================== */
			/* Terminal Display Methods
			/* ======================================================================================== */
			/* Public */
			// f-clear
			function clear() {
				const stdout = components.stdout

				while (stdout.firstChild)
					stdout.removeChild(stdout.firstChild)

				states.curr_buffer = 0
			}

			/* ======================================================================================== */
			/* Public */
			// f-print
			function print(text) {
				const line = document.createElement('pre')
				line.classList.add('line')
				line.appendChild(document.createTextNode(text))
				append_stdout(line)
			}

			/* ======================================================================================== */
			/* Public */
			// f-newline
			function new_line() {
				const line = document.createElement('pre')
				line.classList.add('line')
				append_stdout(line)
			}

			/* ======================================================================================== */
			/* Standard Inputs Method 
			/* ======================================================================================== */
			/* Public */
			// f-readtextarea
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

			/* ======================================================================================== */
			/* Private */
			// f-error
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

			/* ======================================================================================== */
			/* Private */
			// f-displaycommand
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

			/* ======================================================================================== */
			/* Private */
			// f-appendstdout
			function append_stdout(node) {
				components.stdout.appendChild(node)
				if (++states.curr_buffer > config.max_buffer)
					components.stdout.removeChild(stdout.firstChild)
			}

			/* ======================================================================================== */
			/* Private */
			// f-hidemaindstdin
			function hide_main_stdin() {
				components.main_stdin_cont.classList.add('hide-stdin')
				change_curr_stdin(null)
			}

			/* ======================================================================================== */
			/* Private */
			// f-showmainstdin
			function show_main_stdin() {
				components.main_stdin_cont.classList.remove('hide-stdin')
				components.main_stdin.value = ''
				components.bottom_offset.scrollIntoView()
				change_curr_stdin(components.main_stdin)
			}

			/* ======================================================================================== */
			/* Private */
			// f-reloadmainstdin
			function reload_main_stdin() {
				components.prompt_user.innerText = `[${config.prompt_user}]`
				components.prompt_symbol.innerText = config.prompt_symbol
			}

			/* ======================================================================================== */
			/* Testing function */
			// f-test
			function test() {
				console.log({ config: config, states: states, commands: commands })
			}

			/* ======================================================================================== */
			return {
				constructor: Terminal,

				/* display methods */
				clear: clear,
				print: print,
				new_line: new_line,
				read_textarea: read_textarea,

				/* getters */
				get_installed_commands: get_installed_commands,
				get_command_help: get_command_help,
				get_config: get_config,

				/* core function */
				setup: setup,
				install: function(module) { install(this, module) },
				run_command: run_command,

				/* config functions */
				get_config: get_config,
				check_config_key: check_config_key,
				set_config: set_config,

				/* test functions */
				test: test,
			}

		})(dom, styles, storage)

		return Terminal
	}
)