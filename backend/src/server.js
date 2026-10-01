require('./db/init');
const os = require('os');
const app = require('./app');
const { port } = require('./config/env');

const lanAddresses = () => Object.values(os.networkInterfaces())
  .flat()
  .filter(network => network.family === 'IPv4' && !network.internal && !network.address.startsWith('169.254.'))
  .map(network => network.address);

app.listen(port, '0.0.0.0', () => {
  console.log(`Chromora API:\n  Local: http://localhost:${port}/api`);
  lanAddresses().forEach(address => console.log(`  LAN: http://${address}:${port}/api`));
});
