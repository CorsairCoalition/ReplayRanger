# Replay Ranger

A utility to record and replay generals.io game updates to Redis. It listens to a Redis channel for game events, stores them in JSON files, and replays them back to the same Redis channels on demand.

## Execution

```
npx @corsaircoalition/replay-ranger --help
```

## Configuration

See [`config.json`](https://github.com/CorsairCoalition/docs/blob/main/config.json.example).

## Usage

### Recording Events

```
$ npx @corsaircoalition/replay-ranger save --help

Usage: @corsaircoalition/replay-ranger save [options] <configFile>

Receive events from Redis and save them to a file

Options:
  --data-directory <dir>  Directory to store event replay files (default: "data")
```

### Replaying Events

```
$ npx @corsaircoalition/replay-ranger replay --help

Usage: @corsaircoalition/replay-ranger replay [options] <configFile> <filename>

Load events from a file and send them to Redis

Options:
  -S, --send-game-state  Send initial game state event (default: false)
  -s, --skip <number>    Number of events to skip (default: "0")
  -c, --count <number>   Number of events to send (default: "10")
  --delay <number>       Delay between messages in milliseconds (default: "1000")
```

## Examples

```sh
npx @corsaircoalition/replay-ranger save config.json
# data saved to cortex-G5mNGWK-sdmxg1nyf.json

npx @corsaircoalition/replay-ranger replay --send-game-state --skip 10 --count 5 --delay 2000 config.json cortex-G5mNGWK-sdmxg1nyf.json
# replays events 11-15 to the same channels
```
