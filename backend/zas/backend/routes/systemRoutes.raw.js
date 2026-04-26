// Extracted system routes
app.get('/', (req, res) => {
  res.send('Backend is running! 🚀');
});

app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

// Health check for WebSocket
app.get('/api/socket-health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    websocket: 'enabled',
    transports: ['websocket', 'polling']
  });
});

// // Force WebSocket upgrade path
// app.get('/socket.io/', (req, res) => {
//   res.status(200).send('Socket.io endpoint ready');
// });

// Used by the mobile app to auto-detect the active development backend.
app.get('/api/health', (_req, res) => {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

console.log('✅ CHECK-STUDENT-ID ROUTE LOADED');

