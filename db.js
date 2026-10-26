const mongoose = require('mongoose');

// Disable buffering so queries fail immediately if disconnected rather than hanging
mongoose.set('bufferCommands', false);

let isConnected = false;

async function connectDB(customUri = null) {
  const uri = customUri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shristi_hackathon';

  if (isConnected && mongoose.connection.readyState === 1) {
    return { success: true, message: 'Already connected to MongoDB', uri };
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 4000,
      autoIndex: true
    });

    isConnected = true;
    const host = conn.connection.host;
    const dbName = conn.connection.name;

    console.log(`\x1b[32m✔ MongoDB Connected Successfully!\x1b[0m`);
    console.log(`  Host: \x1b[36m${host}\x1b[0m`);
    console.log(`  Database: \x1b[36m${dbName}\x1b[0m`);
    console.log(`  ReadyState: \x1b[32m${conn.connection.readyState}\x1b[0m`);

    return {
      success: true,
      message: 'Connected to MongoDB',
      host,
      dbName,
      uri: uri.replace(/:([^:@]+)@/, ':****@') // mask password in logs
    };
  } catch (error) {
    isConnected = false;
    console.error(`\x1b[31m✖ MongoDB Connection Error:\x1b[0m`, error.message);
    return {
      success: false,
      message: error.message,
      uri: uri.replace(/:([^:@]+)@/, ':****@')
    };
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('\x1b[33m⚠ MongoDB disconnected.\x1b[0m');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('\x1b[32m✔ MongoDB reconnected.\x1b[0m');
});

function getDBStatus() {
  const states = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];
  const stateCode = mongoose.connection.readyState;
  return {
    state: states[stateCode] || 'Unknown',
    stateCode,
    isConnected: stateCode === 1,
    host: mongoose.connection.host || null,
    dbName: mongoose.connection.name || null
  };
}

module.exports = {
  connectDB,
  getDBStatus,
  mongoose
};
