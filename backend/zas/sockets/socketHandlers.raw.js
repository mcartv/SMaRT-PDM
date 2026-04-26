// Extracted socket connection + server listen block
io.on('connection', (socket) => {
  console.log(`User connected via Socket.io: ${socket.id}`);
  if (socket.user?.user_id) {
    socket.join(`user:${socket.user.user_id}`);
  }

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// ===== 404 HANDLER - MUST BE LAST =====
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: `Cannot ${req.method} ${req.originalUrl}`,
    message: 'The requested endpoint does not exist',
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/socket-health',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/courses',
      'GET /api/faqs',
      'GET /api/profile/me',
      'GET /api/openings'
    ]
  });
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running and listening on port ${PORT}`);
});

