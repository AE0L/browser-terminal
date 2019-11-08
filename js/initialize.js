require(
	['terminal', 'commands/BaseCommands'],
	(Terminal, base) => {
		const terminal = new Terminal()
		terminal.setup()
		terminal.install(base)
	}
)