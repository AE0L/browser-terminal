define([
  'utilities/storage',
], (storage) => {
  return {
    modules: [{
        name: 'test',
        help: '',
        run: async function(args) {
          const terminal = this.terminal
        }
      },

      {
        name: 'time',
        help: `~Command Help
              ~~Command: time
              ~Details:  get current time and date
              ~Usage:    time~`,
        run: async function() {
          const terminal = this.terminal
          terminal.print(new Date())
        }
      },

      {
        name: 'js',
        help: `~Command Help
               ~~Command: js
               ~Details: evaluates a JavaScript statement/s
               ~Usage:   js~`,
        run: async function(args) {
          const terminal = this.terminal
          const js = await terminal.read_textarea()

          try {
            eval(js)
          } catch (err) {
            throw { code: null, details: 'invalid JavaScript statement/s' }
          }
        }
      },

      {
        name: 'music',
        help: `~Command Help
              ~~Command: music
              ~Details: plays song/s from the user's machine.
              ~Usage:   music [command]
              ~Commands:
              ~    play, pause, stop, next, prev, list, new~`,
        error_codes: {
          M01: {
            code: null,
            details: `there are no songs loaded, check the help commnand for more details`
          },
          M02: {
            code: null,
            details: `invalid action, check the help command for more details`
          }
        },
        run: async function(args) {
          const terminal = this.terminal
          const action = args.shift() || ''
          let _music_ = {}

          function shuffle(songs) {
            let shuffled = Array.from(songs)

            for (let i = songs.length - 1; i > 0; i--) {
              const j = ~~(Math.random() * (i + 1))
              const temp = shuffled[i];
              shuffled[i] = shuffled[j];
              shuffled[j] = temp;
            }

            return shuffled
          }

          const process = terminal.get_process('music')

          if (process) {
            _music_ = process.data._music_
          } else {
            _music_ = {
              reader: new FileReader(),
              files: null,
              index: 0,
              audio: null,
            }
          }

          const hasFiles = () => !!_music_.files && _music_.files.length > 0

          const playAudio = () => {
            if (hasFiles())
              _music_.audio.play()
            else
              throw this.error_codes.M01
          }

          const pauseAudio = () => {
            if (hasFiles())
              _music_.audio.pause()
            else
              throw this.error_codes.M01
          }

          const stopAudio = () => {
            if (hasFiles()) {
              _music_.audio.currentTime = 0
              _music_.audio.pause()
            } else {
              throw this.error_codes.M01
            }
          }

          const nextAudio = () => {
            if (hasFiles()) {
              if (_music_.files.length === 1) {
                pauseAudio()
                _music_.reader.readAsDataURL(_music_.files[0])
              } else {
                _music_.audio.currentTime = _music_.audio.duration
              }
            } else {
              throw this.error_codes.M01
            }
          }

          const prevAudio = () => {
            if (hasFiles()) {
              pauseAudio()

              if (_music_.files.length > 1) {
                _music_.index -= 1
              }

              _music_.reader.readAsDataURL(_music_.files[_music_.index])
            } else {
              throw this.error_codes.M01
            }
          }

          const listSongs = () => {
            if (hasFiles())
              _music_.files.forEach((f, i) => terminal.print(`${i} - ${f.name}`))
            else
              throw this.error_codes.M01
          }

          const newAudio = async () => {
            let newFiles = await terminal.read_files(true)

            if (process) {
              process.data._music_.audio.pause()
              terminal.end_process('music')
            }

            newFiles = shuffle(newFiles)
            _music_.files = newFiles
            _music_.index = 0

            if (_music_.audio) {
              _music_.audio.pause()
            }

            terminal.print(`Playing ${_music_.files[0].name.replace(/\.[^.]+$/, '')}${_music_.files.length > 1 ? ` and ${_music_.files.length - 1} more`: ''} ...`)

            _music_.reader.onload = (e) => {
              _music_.audio = new Audio()
              window.x = _music_.audio
              const actx = new(window.AudioContext || window.webkitAudioContext)()
              const src = actx.createMediaElementSource(_music_.audio)
              const fader = actx.createGain()

              src.connect(fader).connect(actx.destination)

              _music_.audio.src = e.target.result

              _music_.audio.onloadedmetadata = function() {
                const duration = _music_.audio.duration

                this.onplay = () => {
                  fader.gain.setValueAtTime(0.0, 0.0)
                  fader.gain.linearRampToValueAtTime(0.75, 4.0)
                  fader.gain.linearRampToValueAtTime(0.75, duration - 5.0)
                  fader.gain.linearRampToValueAtTime(0.00, duration)
                }

                this.play()
              }

              _music_.audio.onended = () => {
                _music_.index += 1

                if (_music_.index < _music_.files.length)
                  _music_.reader.readAsDataURL(_music_.files[_music_.index])
              }
            }

            _music_.reader.readAsDataURL(_music_.files[_music_.index])

            terminal.add_process({
              name: 'music',
              data: {
                _music_: _music_
              }
            })
          }

          async function endAudio() {
            const process = terminal.get_process('music')

            if (process) {
              process.data._music_.audio.pause()
            }

            terminal.end_process('music')
          }

          switch (action) {
            case 'play':
              await playAudio();
              break
            case 'pause':
              await pauseAudio();
              break
            case 'stop':
              await stopAudio();
              break
            case 'next':
              await nextAudio();
              break
            case 'prev':
              await prevAudio();
              break
            case 'list':
              await listSongs();
              break
            case 'new':
            case '':
              await newAudio();
              break
            case 'end':
              await endAudio()
              break
            default:
              throw this.error_codes.M02
          }
        },
      },

      {
        name: 'clear',
        aliases: ['cls'],
        help: `~Command Help
              ~~Command: clear
              ~Alias:   cls
              ~Details: resets the terminal's buffer and clear the screen.
              ~Usage:   clear [no-args]~`,
        run: async function() {
          this.terminal.clear()
        }
      },

      {
        name: 'config',
        help: `~Command Help:
              ~~Command: config
              ~Details: Change or view the terminal's configuration.
              ~Usage:   config [command] [key=value]
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
              ~~The only configuration that has specific values is 'font-weight'. Possible values are bold and regular.
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
        run: function(args) {
          return new Promise((resolve, reject) => {
            const terminal = this.terminal
            const config = terminal.get_config()
            const keys = Object.keys(config).sort()
            let target
            let pair

            const valid = () => {
              const hasExcessArgs = () => args.filter(x => /^-[vcr]$/.test(x)).length !== 0

              if (args[0] && args[0].match(/^-[vcr]$/)) {
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
                  'prompt-symbol-color': '#85C1B9',
                  'error-source-color': '#C53535',
                  'prompt-user-color': '#449DA1',
                  'error-code-color': '#F98058',
                  'prompt-symbol': '$',
                  'margin-sides': '16px',
                  'max-history': 10,
                  'font-weight': 'regular',
                  'prompt-user': 'local',
                  'label-color': '#608460',
                  'background': '#091016',
                  'foreground': '#C6C8C7',
                  'max-buffer': 50,
                  'font-size': '16px',
                  'tab-size': 2
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
              ~Usage:   echo [string]~`,
        run: async function(args) {
          this.terminal.print(args.join(' '))
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

        run: async function(args) {
          const terminal = this.terminal
          const print = (i) => terminal.print(i)
          const newLine = () => terminal.new_line()

          if (!args[0]) {
            newLine()
            print('This is the help page. Here are the registered commands:')
            newLine()
            terminal.get_installed_commands()
              .sort()
              .forEach(command => print(`${command}`))
            newLine()
            print(`Type 'help [command]' for more info`)
            newLine()
          } else {
            try {
              const help = await terminal.get_command_help(args[0])
              const lines = help
                .split('~')
                .map(line => line.replace(/\r?\n|\r/, ''))
                .forEach(line => {
                  if (line) {
                    print(line)
                  } else {
                    newLine()
                  }
                })
            } catch (err) {
              throw (this.error_codes.H01)
            }
          }
        }
      },

      {
        name: 'notes',
        help: `~Command help
              ~~Command: notes
              ~Details: create and st,re notes in the terminal. Notes are saved through sessions.
              ~Usage:   notes [command] <note name>
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
        run: function(args) {
          return new Promise((resolve, reject) => {
            const terminal = this.terminal
            let notes = storage.retrieve('notes')
            let target
            let noteName

            if (!notes) {
              notes = { list: [] }
              storage.store('notes', notes)
            }

            const valid = () => {
              const hasExcessArgs = () => args.filter(x => /^-[cerdl]$/.test(x)).length > 0

              if (args[0] && args[0].match(/^-[cerdl]$/)) {
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
              ~Alias: rs
              ~Details: restart the terminal
              ~Usage:   restart~`,
        run: async function() {
          this.terminal.print('restarting...')
          document.location.reload(false)
        }
      }
    ]
  }
})