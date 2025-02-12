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
        bot.end(); // Se o bot já estiver rodando, desconecta antes de criar um novo
        bot = null;
    }

    setTimeout(() => {
        bot = mineflayer.createBot({
            host: "Foca132.aternos.me",
            port: 19003,
            username: "o7patrocina",
            version: '1.21.4',
            plugins: [AutoAuth],
            AutoAuth: "bot112022"
        });

        bot.loadPlugin(pvp);
        bot.loadPlugin(armorManager);
        bot.loadPlugin(pathfinder);

        // Evita kick por inatividade
        bot.on("spawn", () => {
            setInterval(() => {
                if (bot) {
                    bot.setControlState("jump", true);
                    setTimeout(() => bot.setControlState("jump", false), 500);
                }
            }, 30000); // A cada 30 segundos
        });

        bot.on("chat", (username, message) => {
            io.emit("chatMessage", { username, message });
        });

        bot.on("kicked", (reason) => {
            console.log("Bot foi expulso:", reason);
            reconnect();
        });

        bot.on("error", (err) => {
            console.error("Erro no bot:", err);
            reconnect();
        });

        bot.on("end", () => {
            console.log("Bot desconectado.");
            reconnect();
        });
    }, 5000); // Aguarda 5 segundos antes de criar um novo bot
}

// Tenta reconectar o bot automaticamente
function reconnect() {
    console.log("Tentando reconectar em 10 segundos...");
    setTimeout(createBot, 10000);
}

// Comando para parar o bot
function stopBot() {
    if (bot) {
        bot.end(); // Usa 'bot.end()' para desconectar o bot
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