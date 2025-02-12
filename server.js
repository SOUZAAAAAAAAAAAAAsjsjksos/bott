const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mineflayer = require("mineflayer");
const pvp = require("mineflayer-pvp").plugin;
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const armorManager = require("mineflayer-armor-manager");
const AutoAuth = require("mineflayer-auto-auth");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let bot = null; // Variável para armazenar o bot

// Servir os arquivos do site
app.use(express.static("public"));

// Criar o bot Minecraft quando o usuário clicar no botão no site
function createBot() {
    if (bot) {
        return; // Se o bot já estiver rodando, não cria outro
    }

    bot = mineflayer.createBot({
        host: "Foca132.aternos.me",
        port: 19003,
        username: "o7patrocina",
        version: false,
        plugins: [AutoAuth],
        AutoAuth: "bot112022"
    });

    bot.loadPlugin(pvp);
    bot.loadPlugin(armorManager);
    bot.loadPlugin(pathfinder);

    bot.on("chat", (username, message) => {
        io.emit("chatMessage", { username, message });
    });

    bot.on("kicked", (reason) => {
        console.log("Bot foi expulso:", reason);
        bot = null;
    });

    bot.on("error", (err) => {
        console.error("Erro no bot:", err);
    });

    bot.on("end", () => {
        console.log("Bot desconectado.");
        bot = null;
    });
}

// Comando para parar o bot
function stopBot() {
    if (bot) {
        bot.quit();
        bot = null;
    }
}

// Comunicação com o site
io.on("connection", (socket) => {
    socket.on("startBot", () => {
        createBot();
    });

    socket.on("stopBot", () => {
        stopBot();
    });

    socket.on("sendMessage", (msg) => {
        if (bot) {
            bot.chat(msg);
        }
    });

    socket.on("executeCommand", (command) => {
        if (bot) {
            bot.chat(`/${command}`);
        }
    });
});

// Iniciar o servidor
server.listen(3000, () => {
    console.log("Servidor rodando em http://localhost:3000");
});