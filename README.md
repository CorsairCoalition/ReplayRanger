# Replay Ranger

[Generally Genius](https://corsaircoalition.github.io/) (GG) is a modular generals.io bot framework for development and analysis of game strategies and actions. [CorsairCoalition](https://corsaircoalition.github.io/) is a collection of components that form the GG framework.


Replay Ranger is a utility to record and replay generals.io game updates to the [Redis](https://redis.io/) message broker. It listens to a Redis channel for game events, stores them in JSON files, and replays them back to the same Redis channels on demand.

## Configuration

Download `config.example.json` from the [documentation repository](https://github.com/CorsairCoalition/docs) and make desired changes.

To setup other components, see the [detailed instructions](https://corsaircoalition.github.io/setup/) on the [project website](https://corsaircoalition.github.io/).

## Execution

Install and run the executable:

```sh
npm install -g @corsaircoalition/replay-ranger
replay-ranger config.json
```

or run directly from npm library:

```sh
npx @corsaircoalition/replay-ranger --help
```

or use docker:

```sh
docker run -it -v ./config.json:/config.json ghcr.io/corsaircoalition/commandercortex:latest --help
```

## Usage

### Recording Events

```
$ npx @corsaircoalition/replay-ranger save --help

Usage: @corsaircoalition/replay-ranger save [options] <configFile>

Receive events from Redis and save them to a file

Options:
  -D, --data-directory <dir>  Directory to store event replay files (default: "data")
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
  -D, --delay <number>       Delay between events in milliseconds (default: "1000")
```

## Examples

```sh
npx @corsaircoalition/replay-ranger save config.json
# data saved to cortex-G5mNGWK-sdmxg1nyf.json

npx @corsaircoalition/replay-ranger replay config.json --send-game-state --skip 10 --count 5 --delay 2000 cortex-G5mNGWK-sdmxg1nyf.json
# replays events 11-15 to the same channels
```
