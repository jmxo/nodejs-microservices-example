const express = require("express");
const path = require("path");
const axios = require("axios");

if (!process.env.PORT) {
    throw new Error("Please specify the port number for the HTTP server with the environment variable PORT.");
}

const PORT = process.env.PORT;

async function main() {
    const app = express();

    app.set("views", path.join(__dirname, "views"));
    app.set("view engine", "hbs");
    app.use(express.static("public"));

    app.get("/", async (req, res) => {

        const videosResponse = await axios.get("http://metadata/videos");
        res.render("video-list", { videos: videosResponse.data.videos });
    });

    app.get("/video", async (req, res) => {

        const videoId = req.query.id;
        const videoResponse = await axios.get(`http://metadata/video?id=${videoId}`);
        const video = {
            metadata: videoResponse.data.video,
            url: `/api/video?id=${videoId}`,
        };
        res.render("play-video", { video });
    });

    app.get("/upload", (req, res) => {
        res.render("upload-video", {});
    });

    app.get("/history", async (req, res) => {

        const historyResponse = await axios.get("http://history/history");
        res.render("history", { videos: historyResponse.data.history });
    });

    app.get("/api/video", async (req, res) => {

        const response = await axios({
            method: "GET",
            url: `http://video-streaming/video?id=${req.query.id}`,
            data: req,
            responseType: "stream",
        });
        response.data.pipe(res);
    });

    app.post("/api/upload", async (req, res) => {

        const response = await axios({
            method: "POST",
            url: "http://video-upload/upload",
            data: req,
            responseType: "stream",
            headers: {
                "content-type": req.headers["content-type"],
                "file-name": req.headers["file-name"],
            },
        });
        response.data.pipe(res);
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