const default_commands = [
	'commands/terminal-base'
]

require(
	['terminal', ...default_commands],
 	(Terminal, terminalBase) => {
 		const terminal = new Terminal()
 		terminal.setup()
			terminal.install(terminalBase)
	}
)
