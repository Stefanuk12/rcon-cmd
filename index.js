#!/usr/bin/env node

// Dependencies
import { program } from "commander"
import keypress from "keypress"
import Rcon from "rcon"
import * as fs from "fs"

// Vars
const PackageData = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf-8"))

// Program Data
program
    .name(PackageData.name)
    .description(PackageData.description)
    .version(PackageData.version)

// Main functionality (connect)
{
    const Command = program.command("connect").description("Connect to RCON")

    // Options
    Command.option("-h, --host <string>", "Host Server", "localhost")
    Command.option("-p, --port <number>", "The port to connect to with", 4976)
    Command.option("-pw, --password <string>", "RCON Password")

    Command.option("-udp", "Uses UDP protocol to connect", false)
    Command.option("-c, --challenge", "Whether to use the challenge protocol or not", false)
    Command.option("-o, --stdin", "Enables stdin listener for commands", false)

    // async so it doesn't end --> Rewritten https://github.com/pushrax/node-rcon/blob/master/examples/stdio.js
    Command.action(async (Options) => {
        // Create a new client
        const QueuedCommands = []
        const Client = new Rcon(Options.host, Options.port, Options.password, {
            tcp: !Options.Udp,
            challenge: Options.challenge
        })

        // Listeners
        Client.on("auth", () => {
            console.log("RCON> Connected.")
    
            // Executing queued commands
            for (let i = 0; i < QueuedCommands.length; i++) {
                Client.send(QueuedCommands[i])
                QueuedCommands.splice(i, 1)
            }
        })
        Client.on("response", (response) => {
            console.log(`RCON> ${response}`)
        })
        Client.on("error", (err) => {
            console.error(`RCON> ${err}`)
        })
        Client.on("end", () => {
            console.error("RCON> Connection closed.")
        })

        // Connect
        Client.connect()

        // stdin stuff
        if (Options.stdin) {
            // Configure stdin
            keypress(process.stdin)
            process.stdin.setRawMode(true)
            program.stdin.resume()

            // Vars
            let buffer = ""

            // See when a key is pressed
            process.stdin.on("keypress", (Chunk, Key) => {
                // Add to chunk
                process.stdout.write(Chunk)

                // Make sure we have a key
                if (!Key) {
                    // Add to buffer and return
                    buffer += Chunk
                    return
                }

                // Disconnecting
                if (Key.ctrl && (Key.name == "c" || Key.name == "d")) {
                    Client.disconnect()
                    return
                }

                // Entering a command
                if (Key.name == "enter" || Key.name == "return") {
                    // Making sure is authed
                    if (Client.hasAuthed) {
                        Client.send(buffer)
                    } else {
                        QueuedCommands.push(buffer)
                    }

                    // Set
                    buffer = ""
                    process.stdout.write("\n")
                    return
                }

                // Removing characters
                if (Key.name == "backspace") {
                    buffer = buffer.slice(0, -1)
                    process.stdout.write("\x1B[K") // Clear to end of line
                    return
                }
            })
        }
    })
}

// Process
program.parse(process.argv)