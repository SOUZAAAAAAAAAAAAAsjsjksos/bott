const mineflayer = require('mineflayer');
const { Movements, pathfinder, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const axios = require('axios');
const config = require('./settings.json');

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1341006196756451329/0pG9GVudpx1AEhDebq05IbZgMpEEVr-9rVaRNtSdwpBlVI1x7s6pwsgt-mE-70fnwVWz'; // URL da webhook do Discord

function createBot() {
    const bot = mineflayer.createBot({
        username: config['bot-account']['username'],
        password: config['bot-account']['password'],
        auth: config['bot-account']['type'],
        host: config.server.ip,
        port: config.server.port,
        version: config.server.version,
    });

    bot.loadPlugin(pathfinder);
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);

    bot.once('spawn', () => {
        console.log('\x1b[33m[AfkBot] Bot entrou no servidor', '\x1b[0m');

        // Autenticação automática
        if (config.utils['auto-auth'].enabled) {
            console.log('[INFO] Autenticação automática ativada');
            const password = config.utils['auto-auth'].password;
            bot.chat(`/login ${password}`);
        }

        // Enviar mensagens do Minecraft para a Webhook do Discord
        bot.on('chat', (username, message) => {
            if (username === bot.username) return; // Evita mensagens duplicadas do próprio bot

            const embed = {
                username: 'Minecraft Chat',
                avatar_url: 'https://cdn.icon-icons.com/icons2/2699/PNG/512/minecraft_logo_icon_168974.png',
                embeds: [{
                    title: '💬 Nova mensagem no servidor',
                    description: `**${username}**: ${message}`,
                    color: 3447003, // Azul
                    timestamp: new Date()
                }]
            };

            axios.post(WEBHOOK_URL, embed)
                .catch(err => console.error('[Webhook Error]', err.message));
        });

        // Se movimentar para posição específica
        if (config.position.enabled) {
            const { x, y, z } = config.position;
            bot.pathfinder.setMovements(defaultMove);
            bot.pathfinder.setGoal(new GoalBlock(x, y, z));
        }
    });

    bot.on('kicked', reason => console.log('\x1b[33m', `[AfkBot] Bot foi expulso. Motivo: \n${reason}`, '\x1b[0m'));
    bot.on('error', err => console.log(`\x1b[31m[ERRO] ${err.message}\x1b[0m`));

    if (config.utils['auto-reconnect']) {
        bot.on('end', () => {
            setTimeout(createBot, config.utils['auto-reconnect-delay']);
        });
    }
}

createBot();