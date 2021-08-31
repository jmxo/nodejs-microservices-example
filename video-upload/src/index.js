const express = require("express");
const mongodb = require("mongodb");
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

    const app = express();

    function broadcastVideoUploadedMessage(videoMetadata) {
        console.log(`Publishing message on "video-uploaded" exchange.`);

        const msg = { video: videoMetadata };
        const jsonMsg = JSON.stringify(msg);
        messageChannel.publish("video-uploaded", "", Buffer.from(jsonMsg));
    }

    app.post("/upload", async (req, res) => {

        const fileName = req.headers["file-name"];
        const videoId = new mongodb.ObjectId();
        const response = await axios({
            method: "POST",
            url: "http://video-storage/upload",
            data: req,
            responseType: "stream",
            headers: {
                "content-type": req.headers["content-type"],
                "id": videoId,
            },
        });
        response.data.pipe(res);

        broadcastVideoUploadedMessage({ id: videoId, name: fileName });
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