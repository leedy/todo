const mongoose = require('mongoose');

const buildMongoUri = () => {
  const host = process.env.MONGO_HOST || 'localhost';
  const port = process.env.MONGO_PORT || '27017';
  const database = process.env.MONGO_DATABASE || 'medication-kiosk';
  const username = process.env.MONGO_USERNAME;
  const password = process.env.MONGO_PASSWORD;

  if (username && password) {
    return `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=admin`;
  }
  return `mongodb://${host}:${port}/${database}`;
};

const connectDB = async () => {
  try {
    const uri = buildMongoUri();
    await mongoose.connect(uri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
