const express = require("express");
const mongodb = require("mongodb");
const amqp = require('amqplib');

async function startMicroservice(dbHost, dbName, rabbitHost, port) {
    const client = await mongodb.MongoClient.connect(dbHost, { useUnifiedTopology: true });
    const db = client.db(dbName);
    const videosCollection = db.collection("videos");

    const messagingConnection = await amqp.connect(rabbitHost)
    const messageChannel = await messagingConnection.createChannel();

    const app = express();
    app.use(express.json());
    app.get("/videos", async (req, res) => {
        const videos = await videosCollection.find().toArray();
        res.json({
            videos: videos
        });
    });

    app.get("/video", async (req, res) => {
        const videoId = new mongodb.ObjectId(req.query.id);
        const video = await videosCollection.findOne({ _id: videoId })
        if (!video) {
            res.sendStatus(404);
        }
        else {
            res.json({ video });
        }
    });

    async function consumeVideoUploadedMessage(msg) {
        console.log("Received a 'viewed-uploaded' message");

        const parsedMsg = JSON.parse(msg.content.toString());

        const videoMetadata = {
            _id: new mongodb.ObjectId(parsedMsg.video.id),
            name: parsedMsg.video.name,
        };

        await videosCollection.insertOne(videoMetadata)

        console.log("Acknowledging message was handled.");
        messageChannel.ack(msg);
    };

    await messageChannel.assertExchange("video-uploaded", "fanout")

    const { queue } = await messageChannel.assertQueue("", {});
    await messageChannel.bindQueue(queue, "video-uploaded", "")

    await messageChannel.consume(queue, consumeVideoUploadedMessage);

    app.listen(port, () => {
        console.log("Microservice online.");
    });
}

//
// Application entry point.
//
async function main() {
    if (!process.env.PORT) {
        throw new Error("Please specify the port number for the HTTP server with the environment variable PORT.");
    }

    if (!process.env.DBHOST) {
        throw new Error("Please specify the database host using environment variable DBHOST.");
    }

    if (!process.env.DBNAME) {
        throw new Error("Please specify the database name using environment variable DBNAME.");
    }

    if (!process.env.RABBIT) {
        throw new Error("Please specify the name of the RabbitMQ host using environment variable RABBIT");
    }

    const PORT = process.env.PORT;
    const DBHOST = process.env.DBHOST;
    const DBNAME = process.env.DBNAME;
    const RABBIT = process.env.RABBIT;

    await startMicroservice(DBHOST, DBNAME, RABBIT, PORT);
}

if (require.main === module) {
    // Only start the microservice normally if this script is the "main" module.
    main()
        .catch(err => {
            console.error("Microservice failed to start.");
            console.error(err && err.stack || err);
        });
}
else {
    // Otherwise we are running under test
    module.exports = {
        startMicroservice,
    };
}

