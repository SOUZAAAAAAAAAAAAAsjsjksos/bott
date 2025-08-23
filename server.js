const mineflayer = require('mineflayer');
const config = require('./settings.json');

function createBot() {
    const bot = mineflayer.createBot({
        username: config['bot-account']['username'],
        password: config['bot-account']['password'],
        auth: config['bot-account']['type'],
        host: config.server.ip,
        port: config.server.port,
        version: config.server.version,
    });

    bot.once('spawn', () => {
        console.log('[AfkBot] Bot entrou no servidor.');

        // Anti-AFK: pular a cada 1 minuto
        setInterval(() => {
            bot.setControlState('jump', true);
            setTimeout(() => bot.setControlState('jump', false), 500); // pular por 0.5s
        }, 60 * 1000);
    });

    bot.on('kicked', reason => {
        console.log(`[AfkBot] Bot foi expulso. Motivo: ${reason}`);
        reconnect();
    });

    bot.on('end', () => {
        console.log('[AfkBot] Conexão encerrada, reconectando...');
        reconnect();
    });

    bot.on('error', err => console.log(`[ERRO] ${err.message}`));

    function reconnect() {
        setTimeout(createBot, config.utils['auto-reconnect-delay'] || 5000); // delay padrão de 5s
    }
}

createBot();
