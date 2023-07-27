#!/usr/bin/env node

import { Command } from 'commander'
import App from './app.js'
import fs from 'node:fs/promises'
import { Log, Redis, hashUserId } from '@corsaircoalition/common'

const packageJsonPath = new URL('../package.json', import.meta.url)
const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))

Log.stdout(`[initilizing] ${pkg.name} v${pkg.version}`)

// command line parser
const program = new Command()
program
	.name(pkg.name)
	.version(pkg.version)
	.description(pkg.description)
	.option('-d, --debug', 'enable debugging', false)
	.showHelpAfterError()

program
	.command('save <configFile>')
	.description('Receive events from Redis and save them to a file')
	.option('--data-directory <dir>', 'Directory to store event replay files', 'data')
	.action(async (configFile, options) => {
		App.dataDirectory = options.dataDirectory || 'data'
		await initialize(configFile)
		App.startListening()
	})

program
	.command('replay <configFile> <filename>')
	.description('Load events from a file and send them to Redis')
	.option('--send-game-state', 'Send initial game state event', false)
	.option('--number <number>', 'Number of events to send', '10')
	.option('--skip <number>', 'Number of events to skip', '0')
	.option('--delay <number>', 'Delay between messages in milliseconds', '1000')
	.action(async (configFile, filename, options) => {
		const numEventsToSend = parseInt(options.number);
		const numEventsToSkip = parseInt(options.skip);
		const sendGameState = options.sendGameState
		const delay = parseInt(options.delay)
		await initialize(configFile)
		App.sendEventsToRedis(filename, sendGameState, numEventsToSend, numEventsToSkip, delay)
	})

await program.parseAsync()


async function initialize(configFile: string) {
	// read and process command line options
	const options = program.opts()
	const config = JSON.parse(await fs.readFile(configFile, 'utf8'))
	const gameConfig = config.gameConfig
	App.botId = gameConfig.BOT_ID_PREFIX + '-' + hashUserId(gameConfig.userId)
	Log.enableDebugOutput(options['debug'])

	// debug output
	Log.debug("[debug] debugging enabled")
	Log.debugObject('Game configuration', gameConfig)
	Log.debugObject('Command Line Options', options)

	// start the application to initiate redis and socket connections
	Log.stdout(`[initilizing] botId: ${App.botId}`)

	Redis.initilize(config.redisConfig)
}

// gracefully exit on SIGINT and SIGTERM
process.once('SIGINT', async () => {
	Log.stderr('Interrupted. Exiting gracefully.')
	await Redis.quit()
})

process.once('SIGTERM', async () => {
	Log.stderr('Terminated. Exiting gracefully.')
	await Redis.quit()
})

process.on('exit', () => {
	Log.stderr('Exiting now.')
})
