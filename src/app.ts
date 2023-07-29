import { Log, Redis, later } from '@corsaircoalition/common'
import fs from 'node:fs/promises'
import path from 'node:path'

type StorageObject = {
	botId: string
	replayId: string
	gameStart: RedisData.State
	[RedisData.CHANNEL.GAME_UPDATE]: string[]
	[RedisData.CHANNEL.TURN]: string[]
	KEYS: any[]
}

export default class App {

	public static botId: string
	public static dataDirectory: string
	private static replayId: string
	private static store: StorageObject

	private static reset(replayId: string = null) {
		App.replayId = replayId
		App.store = {
			botId: App.botId,
			replayId: replayId,
			gameStart: null,
			[RedisData.CHANNEL.GAME_UPDATE]: [],
			[RedisData.CHANNEL.TURN]: [],
			KEYS: []
		}
	}

	public static startListening = () => {
		Redis.subscribe(App.botId, RedisData.CHANNEL.STATE, App.handleStateUpdate).then(() => {
			Log.stdout(`Listening for updates on ${App.botId}-${RedisData.CHANNEL.STATE}...`)
		})
		Redis.subscriber.subscribe(`${App.botId}-${RedisData.CHANNEL.GAME_UPDATE}`, App.handleGameUpdate)
		Redis.subscriber.subscribe(`${App.botId}-${RedisData.CHANNEL.TURN}`, App.handleTurnUpdate)
	}

	private static handleGameUpdate = (message: string) => {
		App.store[RedisData.CHANNEL.GAME_UPDATE].push(message)
	}

	private static handleTurnUpdate (message: string) {
		App.store[RedisData.CHANNEL.TURN].push(message)

		// read all hash keys for the current replayId
		Redis.getAllKeys(`${App.botId}-${App.replayId}`).then((keys) => {
			// push hash keys to messages[KEYS]
			App.store['KEYS'].push(keys)
		})
	}

	// use RedisData.CHANNEL.STATE to sync file operations
	private static async handleStateUpdate(data: RedisData.State) {

		if ('game_start' in data) {
			// start recording messages
			App.reset(data.game_start.replay_id)
			Log.stdout('Game started:', App.replayId)
			App.store.gameStart = data
		}

		if ('game_won' in data || 'game_lost' in data) {
			// save messages and reset
			await later(1000)
			Log.stdout('Game over:', App.replayId)
			await App.saveMessagesToFile()
			App.reset()
		}
	}

	private static async saveMessagesToFile() {
		const directory = path.join(process.cwd(), App.dataDirectory)
		Log.debug('Creating data directory:', directory)
		const createDir = await fs.mkdir(directory, { recursive: true })
		if (createDir) {
			Log.stdout('Created data directory:', createDir)
		}
		const filename = `${App.botId}-${App.replayId}.json`
		// const filepath = new URL(filename, directory)
		const filepath = path.join(directory, filename)
		Log.debug('Saving:', filepath)
		await fs.writeFile(filepath, JSON.stringify(App.store, null, 2))
		Log.stdout('Saved:', filename)
	}

	public static sendEventsToRedis = async (replayFile: string, sendGameState: boolean, numEventsToSend: number, numEventsToSkip: number, delay: number) => {

		const dataStore = JSON.parse(await fs.readFile(replayFile, 'utf8'))
		App.botId = dataStore.botId
		App.replayId = dataStore.replayId

		// Send messages to Redis with a delay
		const totalEvents = dataStore[RedisData.CHANNEL.TURN].length

		if (numEventsToSkip > totalEvents) {
			Log.stdout(`Number of events to skip exceeds total events. Skipping all events.`)
			return
		}

		if (numEventsToSkip + numEventsToSend > totalEvents) {
			numEventsToSend = totalEvents - numEventsToSkip
			Log.stdout(`Number of events to send exceeds total events. Sending ${numEventsToSend} events.`)
		}

		if (sendGameState) {
			await Redis.publish(App.botId, RedisData.CHANNEL.STATE, dataStore.gameStart)
			Log.stdout(`Sent game state to ${App.botId}`)
			Log.debugObject('Game state', dataStore.gameStart)
		}

		for (let i = numEventsToSkip; i < numEventsToSkip + numEventsToSend; i++) {
			const pubTurn = Redis.publisher.publish(`${App.botId}-${RedisData.CHANNEL.TURN}`, dataStore[RedisData.CHANNEL.TURN][i])
			const pubUpdate = Redis.publisher.publish(`${App.botId}-${RedisData.CHANNEL.GAME_UPDATE}`, dataStore[RedisData.CHANNEL.GAME_UPDATE][i])

			Log.stdout(`Setting keys for event ${i+1} of ${totalEvents} to ${App.botId}`)
			Redis.setKeys(`${App.botId}-${App.replayId}`, dataStore.KEYS[i]).then(()=> {
				Log.stdout(`Set keys for event ${i+1} of ${totalEvents} to ${App.botId}`)
			}).catch((error) => {
				Log.stderr('Error setting keys: ', error)
			})

			Log.stdout(`Sent event ${i+1} of ${totalEvents} to ${App.botId}`)
			Promise.all([pubTurn, pubUpdate]).then(() => {
				Log.stdout(`Published event ${i+1} of ${totalEvents} to ${App.botId}`)
				Log.debugObject('Turn', dataStore[RedisData.CHANNEL.TURN][i])
				Log.debugObject('Game update', dataStore[RedisData.CHANNEL.GAME_UPDATE][i])
			})

			await later(delay)
		}

		Log.stdout(`Sent ${numEventsToSend} events to ${App.botId}`)
		await Redis.quit()
	}
}
