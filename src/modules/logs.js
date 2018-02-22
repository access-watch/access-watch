const app = require('../apps/websocket');
const pipeline = require('../lib/pipeline');
const memoryIndex = require('../plugins/memory-logs');
const { logIsAugmented } = require('../lib/util');
const { parseFilterQuery } = require('../lib/filter');

// Expose raw logs

app.streamToWebsocket('/logs/raw', pipeline, {
  name: 'WebSocket: raw logs',
  monitoringEnabled: true,
});

const { stream: augmentedStream } = require('../pipeline/augmented');

// Expose augmented logs

app.streamToWebsocket('/logs/augmented', augmentedStream, {
  name: 'WebSocket: augmented logs',
  monitoringEnabled: true,
});

// Expose augmented logs for dashboard

app.streamToWebsocket('/logs', augmentedStream.filter(logIsAugmented));

// Keep logs in memory and expose as API endpoint

augmentedStream.map(memoryIndex.index);

app.get('/logs', (req, res) => {
  const { query } = req;
  memoryIndex.searchLogs(parseFilterQuery(query)).then(logs => res.send(logs));
});
