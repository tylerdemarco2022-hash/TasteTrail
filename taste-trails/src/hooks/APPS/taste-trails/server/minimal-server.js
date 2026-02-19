// Renamed to minimal-server.legacy.js to prevent accidental execution
import express from 'express';
const app = express();
app.get('/', (req, res) => res.send('Hello World!'));
app.listen(3000, () => console.log('Minimal Express server running on http://localhost:3000'));
