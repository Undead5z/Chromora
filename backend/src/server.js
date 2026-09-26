require('./db/init');
const app = require('./app');
const { port } = require('./config/env');
app.listen(port, () => console.log(`Chromora API listening at http://localhost:${port}/api`));
