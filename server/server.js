const express = require('express');
const { KafkaClient, Consumer } = require('kafka-node');
const mongo = require('mongodb').MongoClient;

const app = express();
const mongoUrl = 'mongodb://my-mongodb.default.svc.cluster.local:27017';
const dbName = 'purchases';
const client = new KafkaClient({ kafkaHost: 'kafka-service.default.svc.cluster.local:9092' });
const consumer = new Consumer(client, [{ topic: 'purchases', partition: 0 }], { autoCommit: true });

let db;
let mongoClient;
let server;

// Asynchronous function to connect to MongoDB
const connectToMongoDB = async () => {
  try {
    mongoClient = await mongo.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
    db = mongoClient.db(dbName);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    throw err;
  }
};

// Middleware to check database connection
app.use((req, res, next) => {
  if (!db) {
    return res.status(500).json({ error: 'Database connection not established' });
  }
  next();
});

app.get('/purchases', async (req, res) => {
  try {
    const docs = await db.collection('purchases').find({}).toArray();
    res.json(docs);
  } catch (err) {
    console.error('Error fetching purchases', err);
    res.status(500).json({ error: 'Error fetching purchases' });
  }
});

// Kafka Consumer Logic
consumer.on('message', (message) => {
  try {
    const purchase = JSON.parse(message.value);
    console.log('Received purchase', purchase);
    db.collection('purchases').insertOne(purchase, (error, response) => {
      if (error) {
        console.error('Error inserting purchase into MongoDB', error);
      } else {
        console.log('Purchase inserted successfully');
      }
    });
  } catch (parseError) {
    console.error('Error parsing Kafka message', parseError);
  }
});

consumer.on('error', (error) => {
  console.error('Error with Kafka consumer', error);
});

const port = 3000;

const startServer = async () => {
  try {
    await connectToMongoDB();
    server = app.listen(port, () => {
      console.log(`Server is running on port: ${port}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
  }
};

const gracefulShutdown = () => {
  console.log('Shutting down gracefully');
  server.close(async () => {
    consumer.close(true, () => {
      console.log('Kafka consumer closed');
    });

    if (mongoClient) {
      await mongoClient.close();
      console.log('MongoDB connection closed');
    }

    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown).on('SIGTERM', gracefulShutdown);

startServer();