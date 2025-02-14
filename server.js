const mineflayer = require('mineflayer');
const { Movements, pathfinder, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const config = require('./settings.json');
const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Bot chegou'));
app.listen(8000, () => console.log('Servidor iniciado'));

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
                console.log(`[Log de Chat] <${username}> ${message}`);
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
                console.log(`[Log de Chat] <${username}> ${message}`);
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

        // Executar o comando /tpa
        bot.chat('/tpa desacato');
        console.log('[INFO] Comando /tpa desacato enviado.');

        // Atacar mobs
        bot.on('physicTick', () => {
            const nearestMob = bot.nearestEntity(entity => entity.type === 'mob');
            if (nearestMob) {
                bot.attack(nearestMob);
            }
        });

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

        // Pegar espada quando dropada
        bot.on('itemSpawn', (item) => {
            if (item.name === 'diamond_sword' || item.name === 'iron_sword' || item.name === 'stone_sword') {
                console.log(`[INFO] Espada detectada: ${item.name}`);
                bot.tossStack(item); // Descartar qualquer item indesejado

                // Fazer o bot pegar o item e equipar a espada
                bot.equip(item, 'hand', (err) => {
                    if (err) {
                        console.log('[ERRO] Não foi possível equipar a espada:', err);
                    } else {
                        console.log('[INFO] Espada equipada na mão.');
                    }
                });
            }
        });

        if (config.position.enabled) {
            const { x, y, z } = config.position;
            console.log(`\x1b[32m[AfkBot] Movendo para (${x}, ${y}, ${z})\x1b[0m`);
            bot.pathfinder.setMovements(defaultMove);
            bot.pathfinder.setGoal(new GoalBlock(x, y, z));
        }

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

    if (config.utils['auto-reconnect']) {
        bot.on('end', () => {
            setTimeout(createBot, config.utils['auto-recconect-delay']);
        });
    }

    bot.on('kicked', reason => console.log('\x1b[33m', `[AfkBot] Bot foi expulso. Motivo: \n${reason}`, '\x1b[0m'));

    bot.on('error', err => console.log(`\x1b[31m[ERRO] ${err.message}\x1b[0m`));
}

createBot();