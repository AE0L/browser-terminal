require(['terminal', 'commands/internal'], (Terminal, internal) => {
  const terminal = new Terminal()

  terminal.setup()
  terminal.install(internal)
})