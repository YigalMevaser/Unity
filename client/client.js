const express = require('express');
const fetch = require('node-fetch');
const { KafkaClient, Producer } = require('kafka-node');

const app = express();

// Use express.json() middleware to parse JSON request bodies
app.use(express.json());

const client = new KafkaClient({ kafkaHost: 'kafka-service.default.svc.cluster.local:9092' });
const producer = new Producer(client);
const apiEndpoint = 'http://customer-management-api.default.svc.cluster.local:80/purchases';

// Initialize the producer and handle the 'ready' and 'error' events
producer.on('ready', () => {
    console.log('Kafka Producer is connected and ready.');
});

producer.on('error', (error) => {
    console.error('Kafka Producer encountered an error:', error);
});

app.post('/buy', (req, res) => {
    // Assume req.body contains {username, userid, price, timestamp}
    const purchase = req.body;
    const payloads = [{ topic: 'purchases', messages: JSON.stringify(purchase), partition: 0 }];

    producer.send(payloads, (err, data) => {
        if (err) {
            console.error('Error sending purchase to Kafka:', err);
            res.status(500).send('Error sending purchase to Kafka');
        } else {
            res.send('Purchase sent successfully');
        }
    });
});

app.get('/getAllUserBuys', async (req, res) => {
    try {
        const response = await fetch(apiEndpoint);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const purchases = await response.json();
        res.json(purchases);
    } catch (error) {
        console.error('Error fetching purchases:', error);
        res.status(500).send(`Error fetching purchases: ${error.message}`);
    }
});

// If serving a frontend, the static files would be served here:
// app.use(express.static('path_to_static_files'));

const port = 3001;
app.listen(port, () => console.log(`Customer-Facing Web Server running on port ${port}`));