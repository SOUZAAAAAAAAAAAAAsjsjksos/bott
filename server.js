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

    async function sendRegister(password) {
        return new Promise((resolve, reject) => {
            bot.chat(`/register ${password} ${password}`);
            console.log(`[Autenticação] Comando /register enviado.`);
            bot.once('chat', (username, message) => {
                if (message.includes('successfully registered')) {
                    console.log('[INFO] Registro confirmado.');
                    resolve();
                } else if (message.includes('already registered')) {
                    console.log('[INFO] O bot já foi registrado.');
                    resolve();
                } else {
                    reject(`Falha no registro: "${message}"`);
                }
            });
        });
    }

    async function sendLogin(password) {
        return new Promise((resolve, reject) => {
            bot.chat(`/login ${password}`);
            console.log(`[Autenticação] Comando /login enviado.`);
            bot.once('chat', (username, message) => {
                if (message.includes('successfully logged in')) {
                    console.log('[INFO] Login bem-sucedido.');
                    resolve();
                } else if (message.includes('Invalid password')) {
                    reject('Falha no login: Senha inválida.');
                } else if (message.includes('not registered')) {
                    reject('not registered');
                } else {
                    reject(`Falha no login: "${message}"`);
                }
            });
        });
    }

    bot.once('spawn', async () => {
        console.log('\x1b[33m[AfkBot] Bot entrou no servidor', '\x1b[0m');

        // Enviar comando de TPA após 10 segundos
        setTimeout(() => {
            bot.chat('/tpa desacato');
            console.log('[INFO] Comando /tpa desacato enviado após 10 segundos.');
        }, 10000);

        // Atacar mobs automaticamente
        bot.on('physicTick', () => {
            const nearestMob = bot.nearestEntity(entity => entity.type === 'mob');
            if (nearestMob) {
                bot.attack(nearestMob);
            }
        });

        // Autenticação automática
        if (config.utils['auto-auth'].enabled) {
            console.log('[INFO] Módulo de auto-auth iniciado');
            const password = config.utils['auto-auth'].password;
            try {
                await sendLogin(password);
            } catch (error) {
                console.error('[ERRO]', error);
                if (error === 'not registered') {
                    console.log('[INFO] Tentando registrar a conta...');
                    try {
                        await sendRegister(password);
                        await sendLogin(password);
                    } catch (registerError) {
                        console.error('[ERRO] Falha ao registrar:', registerError);
                    }
                }
            }
        }

        // Pegar espada automaticamente
        bot.on('itemSpawn', (item) => {
            if (item.name.includes('sword')) {
                console.log(`[INFO] Espada detectada: ${item.name}`);
                bot.tossStack(item);

                bot.equip(item, 'hand', (err) => {
                    if (err) {
                        console.log('[ERRO] Não foi possível equipar a espada:', err);
                    } else {
                        console.log('[INFO] Espada equipada na mão.');
                    }
                });
            }
        });

        // Enviar mensagens do Minecraft para a Webhook do Discord
        bot.on('chat', (username, message) => {
            if (username === bot.username) return;

            const embed = {
                username: 'Minecraft Chat',
                avatar_url: 'https://cdn.icon-icons.com/icons2/2699/PNG/512/minecraft_logo_icon_168974.png',
                embeds: [{
                    title: '💬 Nova mensagem no servidor',
                    description: `**${username}**: ${message}`,
                    color: 3447003,
                    timestamp: new Date()
                }]
            };

            axios.post(WEBHOOK_URL, embed)
                .catch(err => console.error('[Webhook Error]', err.message));
        });

        // Mover para posição específica
        if (config.position.enabled) {
            const { x, y, z } = config.position;
            console.log(`\x1b[32m[AfkBot] Movendo para (${x}, ${y}, ${z})\x1b[0m`);
            bot.pathfinder.setMovements(defaultMove);
            bot.pathfinder.setGoal(new GoalBlock(x, y, z));
        }

        // Sistema Anti-AFK
        if (config.utils['anti-afk'].enabled) {
            bot.setControlState('jump', true);
            if (config.utils['anti-afk'].sneak) {
                bot.setControlState('sneak', true);
            }
        }
    });

    bot.on('goal_reached', () => {
        console.log(`\x1b[32m[AfkBot] Bot chegou no destino: ${bot.entity.position}\x1b[0m`);
    });

    bot.on('death', () => {
        console.log(`\x1b[33m[AfkBot] Bot morreu e foi respawnado em ${bot.entity.position}\x1b[0m`);
    });

    // Auto-reconnect
    if (config.utils['auto-reconnect']) {
        bot.on('end', () => {
            setTimeout(createBot, config.utils['auto-reconnect-delay']);
        });
    }

    bot.on('kicked', reason => console.log('\x1b[33m', `[AfkBot] Bot foi expulso. Motivo: \n${reason}`, '\x1b[0m'));
    bot.on('error', err => console.log(`\x1b[31m[ERRO] ${err.message}\x1b[0m`));
}

createBot();