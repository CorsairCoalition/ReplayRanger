# Replay Ranger

A utility to record and replay generals.io game updates to Redis. It listens to a Redis channel for game events, stores them in JSON files, and replays them back to the desired Redis channel on demand.

## Installation

```
npm install
npm run build
```

## Configuration

Copy `config.json.example` to `config.json` and enter your Redis configuration.

## Usage

### Recording Events

```
node app save <channel>
```

### Replaying Events

```
node app replay [options] <filename> <channel>

Options:
  -n, --number <number>  Number of events to send (default: "100")
  -s, --skip <number>    Number of events to skip (default: "0")
  -d, --delay <number>   Delay between messages in milliseconds (default: "250")
```
