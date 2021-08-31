const express = require("express");
const mongodb = require("mongodb");
const amqp = require('amqplib');

if (!process.env.PORT) {
    throw new Error("Please specify the port number for the HTTP server with the environment variable PORT.");
}

if (!process.env.DBHOST) {
    throw new Error("Please specify the database host using environment variable DBHOST.");
}

if (!process.env.DBNAME) {
    throw new Error("Please specify the name of the database using environment variable DBNAME");
}

if (!process.env.RABBIT) {
    throw new Error("Please specify the name of the RabbitMQ host using environment variable RABBIT");
}

const PORT = process.env.PORT;
const DBHOST = process.env.DBHOST;
const DBNAME = process.env.DBNAME;
const RABBIT = process.env.RABBIT;

async function main() {

    const app = express();

    app.use(express.json());

    const client = await mongodb.MongoClient.connect(DBHOST);
    const db = client.db(DBNAME);

    const historyCollection = db.collection("history");
    const messagingConnection = await amqp.connect(RABBIT);
    const messageChannel = await messagingConnection.createChannel();
    await messageChannel.assertExchange("viewed", "fanout");
    const { queue } = await messageChannel.assertQueue("", { exclusive: true });

    console.log(`Created queue ${queue}, binding it to "viewed" exchange.`);

    await messageChannel.bindQueue(queue, "viewed", "");

    await messageChannel.consume(queue, async (msg) => {
        console.log("Received a 'viewed' message");
        const parsedMsg = JSON.parse(msg.content.toString());
        await historyCollection.insertOne({ videoId: parsedMsg.video.id });
        console.log("Acknowledging message was handled.");
        messageChannel.ack(msg);
    });

    app.get("/history", async (req, res) => {
        const history = await historyCollection.find().toArray();
        res.json({ history });
    });

    app.listen(PORT, () => {
        console.log("Microservice online.");
    });
}

main()
    .catch(err => {
        console.error("Microservice failed to start.");
        console.error(err && err.stack || err);
    });