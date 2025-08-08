// Simple script to test database connection and model synchronization
const fs = require('fs');
const path = require('path');
const { sequelize, testConnection, syncModels } = require('./src/services/database');

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ Created data directory');
}

// Test the connection and sync models
async function test() {
  try {
    console.log('🔌 Testing database connection...');
    const connected = await testConnection();
    
    if (connected) {
      console.log('✅ Database connection successful');
      
      console.log('🔄 Synchronizing database models...');
      const synced = await syncModels();
      
      if (synced) {
        console.log('✅ Database models synchronized successfully');
        
        // Test creating a simple record
        try {
          const Webhook = require('./src/models/webhook')(sequelize);
          await Webhook.create({
            url: 'https://example.com/webhook',
            name: 'test-webhook',
            events: ['*']
          });
          console.log('✅ Successfully created test webhook');
        } catch (error) {
          console.error('❌ Error creating test record:', error.message);
        }
      } else {
        console.error('❌ Failed to synchronize database models');
      }
    } else {
      console.error('❌ Database connection failed');
    }
  } catch (error) {
    console.error('❌ Error during database test:', error);
  } finally {
    // Close the database connection
    await sequelize.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the test
test();
