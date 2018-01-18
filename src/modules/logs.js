const app = require('../apps/websocket');

const rawStream = require('../lib/pipeline');

app.streamToWebsocket('/logs/raw', rawStream);

const { stream: augmentedStream } = require('../pipeline/augmented');

app.streamToWebsocket('/logs/augmented', augmentedStream);

const { stream: dashboardStream } = require('../pipeline/dashboard');

app.streamToWebsocket('/logs', dashboardStream);
