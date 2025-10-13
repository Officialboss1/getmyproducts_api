import dotenv from "dotenv";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// Load test environment variables
dotenv.config({ path: ".env.test" });

// Global test setup
let mongoServer;

beforeAll(async () => {
  // Close any existing connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Start in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  // Close database connection and stop server
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  // Clear all collections after each test
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
});