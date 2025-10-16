// app.cjs - Simple CJS wrapper
require('dotenv').config();

console.log('🚀 Starting CJS wrapper for ES module...');

// Import the ES module
import('./server.js')
    .then(module => {
        console.log('✅ ES module loaded successfully');
        // The server should handle its own listening in this case
    })
    .catch(err => {
        console.error(' ❌ Failed to load ES module:', err);
        process.exit(1);
    });

// Export a dummy app to satisfy lsnode.js
module.exports = {
    dummy: true,
    message: 'CJS wrapper for ES module - actual app loaded via dynamic import'
};
