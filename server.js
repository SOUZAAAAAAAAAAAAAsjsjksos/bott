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

    bot.once('spawn', async () => {
        console.log('\x1b[33m[AfkBot] Bot entrou no servidor', '\x1b[0m');

        setTimeout(() => {
            bot.chat('/tpa desacato');
            console.log('[INFO] Comando /tpa desacato enviado após 10 segundos.');
        }, 10000);

        // Função para encontrar comida no inventário
        function getFood() {
            const foodItems = [
                'cooked_beef', 'cooked_porkchop', 'cooked_chicken', 
                'bread', 'baked_potato', 'cooked_mutton', 'cooked_rabbit'
            ];
            return bot.inventory.items().find(item => foodItems.includes(item.name));
        }

        // Sistema de Auto Eat (Comer quando estiver com fome)
        bot.on('physicTick', async () => {
            if (bot.food < 15) { // Come quando a barra de fome estiver abaixo de 15
                const food = getFood();
                if (food) {
                    try {
                        console.log(`[INFO] Bot está com fome! Comendo ${food.name}...`);
                        await bot.equip(food, 'hand'); // Equipa a comida na mão
                        await bot.consume(); // Come a comida
                        console.log('[INFO] Bot comeu e está satisfeito.');

                        // Voltar a segurar a espada de diamante após comer
                        const sword = bot.inventory.items().find(item => item.name === 'diamond_sword');
                        if (sword) {
                            await bot.equip(sword, 'hand');
                            console.log('[INFO] Espada de diamante equipada novamente.');
                        }
                    } catch (err) {
                        console.log('[ERRO] Falha ao comer:', err);
                    }
                } else {
                    console.log('[INFO] Bot está com fome, mas não tem comida.');
                }
            }

            // Atacar mobs se não estiver comendo
            const nearestMob = bot.nearestEntity(entity => entity.type === 'mob');
            if (nearestMob && bot.food >= 15) {
                bot.attack(nearestMob);
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