require('dotenv').config();

const http = require('http');
const { createApp } = require('./app');

const PORT = process.env.PORT || 5000;

const app = createApp();
const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});