const express = require("express");
const amqp = require('amqplib');
const axios = require("axios");

if (!process.env.PORT) {
    throw new Error("Please specify the port number for the HTTP server with the environment variable PORT.");
}

if (!process.env.RABBIT) {
    throw new Error("Please specify the name of the RabbitMQ host using environment variable RABBIT");
}

const PORT = process.env.PORT;
const RABBIT = process.env.RABBIT;

async function main() {
    const messagingConnection = await amqp.connect(RABBIT);

    const messageChannel = await messagingConnection.createChannel();

    await messageChannel.assertExchange("viewed", "fanout");

    function broadcastViewedMessage(messageChannel, videoId) {
        console.log(`Publishing message on "viewed" exchange.`);

        const msg = { video: { id: videoId } };
        const jsonMsg = JSON.stringify(msg);
        messageChannel.publish("viewed", "", Buffer.from(jsonMsg));
    }

    const app = express();

    app.get("/video", async (req, res) => {

        const videoId = req.query.id;
        const response = await axios({
            method: "GET",
            url: `http://video-storage/video?id=${videoId}`,
            data: req,
            responseType: "stream",
        });
        response.data.pipe(res);

        broadcastViewedMessage(messageChannel, videoId);
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