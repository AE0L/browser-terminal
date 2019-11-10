define([], () => ({
  modules: [{
    name: 'welcome',
    options: { hide: true },
    help: '',
    run: async function() {
      const terminal = this.terminal
      const name = await terminal.read_line('Enter your name:')
      const symbol = await terminal.read_line('Enter a prompt symbol (e.g. #, $, ~$, etc.):')

      await terminal.set_config('prompt-user', name)
      await terminal.set_config('prompt-symbol', symbol)
    }
  }]
}))