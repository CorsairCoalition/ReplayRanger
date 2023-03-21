import Redis from 'redis'
import fs from 'node:fs'
import { Command } from 'commander'
import { URL } from 'node:url'

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'))
const redisConfig = config.redisConfig

const DATA_DIRECTORY = 'data'

function createDataDirectory(directory: string): void {
	if (!fs.existsSync(directory)) {
		fs.mkdirSync(directory, { recursive: true })
		console.log(new Date().toISOString(), 'Created data directory:', directory)
	}
}

const saveEventsToFile = async (channel: string) => {

	createDataDirectory(new URL(DATA_DIRECTORY, import.meta.url).pathname)

	const redisClient = Redis.createClient({
		url: `rediss://${redisConfig.USERNAME}:${redisConfig.PASSWORD}@${redisConfig.HOST}:${redisConfig.PORT}`,
		socket: {
			tls: true,
			servername: redisConfig.HOST,
		},
	})

	redisClient.on('error', (error: Error) => console.error(new Date().toISOString(), '[Redis]', error))
	await redisClient.connect()

	process.once('SIGINT', async (code) => {
		console.error(new Date().toISOString(), 'Interrupted. Exiting gracefully.')
		await redisClient.quit()
	})

	let recording = false
	let events: any[] = []
	let replayId: string | null = null

	const listener = (message: string, channel: string) => {
		let msgObj: {
			game_start?: { replay_id: string }
		}
		try {
			msgObj = JSON.parse(message)
		} catch (error) {
			console.error(new Date().toISOString(), '[JSON]', error)
			return
		}

		if ('chat_message' in msgObj)
			return

		if ('game_start' in msgObj) {
			recording = true
			replayId = msgObj['game_start'].replay_id
			console.log(new Date().toISOString(), 'Game started:', replayId)
		}

		if (recording) {
			events.push(msgObj)

			if ('game_won' in msgObj || 'game_lost' in msgObj) {
				recording = false
				console.log(new Date().toISOString(), 'Game completed:', replayId)

				// Save events to the file
				if (replayId) {
					const filename = `${DATA_DIRECTORY}/${channel}-${replayId}.json`
					const filepath = new URL(filename, import.meta.url).pathname
					fs.writeFileSync(filepath, JSON.stringify(events, null, 2))
					console.log(new Date().toISOString(), 'Saved events to', filename)
				}
				events = []
			}
		}
	}

	redisClient.subscribe(channel, listener).then(() => {
		console.log(new Date().toISOString(), 'Listening for updates on', channel, '...')
	})
}

const sendEventsToRedis = async (replayFile: string, channel: string, numEventsToSend: number, numEventsToSkip: number, delay: number) => {
	const redisClient = Redis.createClient({
		url: `rediss://${redisConfig.USERNAME}:${redisConfig.PASSWORD}@${redisConfig.HOST}:${redisConfig.PORT}`,
		socket: {
			tls: true,
			servername: redisConfig.HOST,
		},
	})

	redisClient.on('error', (error: Error) => console.error(new Date().toISOString(), '[Redis]', error))
	await redisClient.connect()

	process.once('SIGINT', async (code) => {
		console.error(new Date().toISOString(), 'Interrupted. Exiting gracefully.')
		await redisClient.quit()
	})

	const events = JSON.parse(fs.readFileSync(replayFile, 'utf8'))

	// Send messages to Redis with a delay
	let counter = numEventsToSkip
	const sendEvent = async () => {
		if (counter < events.length && (numEventsToSend === 0 || counter < numEventsToSkip + numEventsToSend)) {
			const event = events[counter]
			const message = JSON.stringify(event)
			await redisClient.publish(channel, message)
			counter++
			setTimeout(sendEvent, delay)
		} else {
			console.log(new Date().toISOString(), 'Sent', counter, 'events to', channel)
			await redisClient.quit()
		}
	}

	sendEvent()
}

const program = new Command()

program
	.name(pkg.name)
	.version(pkg.version)
	.description(pkg.description)
	.showHelpAfterError()

program
	.command('save <channel>')
	.description('Receive events from Redis and save them to a file')
	.action((channel: string) => {
		saveEventsToFile(channel)
	})

program
	.command('replay <filename> [channel]')
	.description('Load events from a file and send them to Redis')
	.option('-n, --number <number>', 'Number of events to send', '100')
	.option('-s, --skip <number>', 'Number of events to skip', '0')
	.option('-d, --delay <number>', 'Delay between messages in milliseconds', '250')
	.action((filename, channel, options, command) => {
		if (!channel) channel = 'replay-ranger'
		const numEventsToSend = parseInt(options.number);
		const numEventsToSkip = parseInt(options.skip);
		const delay = parseInt(options.delay)
		sendEventsToRedis(filename, channel, numEventsToSend, numEventsToSkip, delay)
	})

program.parse()
