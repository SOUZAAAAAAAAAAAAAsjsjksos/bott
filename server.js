const mineflayer = require('mineflayer');
const { Movements, pathfinder, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const config = require('./settings.json');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Servir arquivos estáticos (para a interface do site)
app.use(express.static('public'));

app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));

// Função para criar o bot
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

  // Variáveis para armazenar o estado do bot e logs
  let playersOnline = [];
  let chatLogs = [];  // Garantindo que chatLogs esteja definida no escopo correto

  // Função para enviar mensagens de chat
  bot.on('chat', (username, message) => {
    chatLogs.push(`<${username}> ${message}`);
    io.emit('chatMessage', chatLogs); // Envia os logs de chat para o frontend
  });

  bot.once('spawn', async () => {
    console.log('\x1b[33m[AfkBot] Bot entrou no servidor\x1b[0m');

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

    if (config.utils['chat-messages'].enabled) {
      console.log('[INFO] Módulo de mensagens de chat iniciado');
      const messages = config.utils['chat-messages']['messages'];
      if (config.utils['chat-messages'].repeat) {
        const delay = config.utils['chat-messages']['repeat-delay'];
        let i = 0;
        setInterval(() => {
          bot.chat(messages[i]);
          i = (i + 1) % messages.length;
        }, delay * 1000);
      } else {
        messages.forEach(msg => bot.chat(msg));
      }
    }

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

    // Atualiza a lista de jogadores online
    setInterval(() => {
      playersOnline = Object.keys(bot.players);
      io.emit('updatePlayers', playersOnline); // Envia a lista de jogadores online
    }, 1000);
  });

  bot.on('goal_reached', () => {
    console.log(`\x1b[32m[AfkBot] Bot chegou no destino: ${bot.entity.position}\x1b[0m`);
  });

  bot.on('death', () => {
    console.log(`\x1b[33m[AfkBot] Bot morreu e foi respawnado em ${bot.entity.position}\x1b[0m`);
  });

  bot.on('kicked', reason => console.log('\x1b[33m', `[AfkBot] Bot foi expulso. Motivo: \n${reason}`, '\x1b[0m'));

  bot.on('error', err => console.log(`\x1b[31m[ERRO] ${err.message}\x1b[0m`));

  // Função para enviar o comando /register
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

  // Função para enviar o comando /login
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
          reject('Conta não registrada.');
        } else {
          reject(`Falha no login: "${message}"`);
        }
      });
    });
  }

  // Reconectar automaticamente
  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      console.log('[AfkBot] Desconectado. Tentando reconectar...');
      setTimeout(createBot, config.utils['auto-reconnect-delay'] || 20000); // Delay de 20 segundos para reconectar
    });
  }

  return bot;
}

// Inicia o bot
const bot = createBot();

// Socket.IO - Comunicação com o frontend
io.on('connection', (socket) => {
  console.log('Novo cliente conectado.');

  // Envia os logs de chat e jogadores online para o cliente
  socket.emit('chatMessage', chatLogs);
  socket.emit('updatePlayers', Object.keys(bot.players));

  // Ouve comandos do frontend
  socket.on('sendMessage', (message) => {
    bot.chat(message); // Envia a mensagem como bot
    console.log(`[Bot] Enviado: ${message}`);
  });

  socket.on('executeCommand', (command) => {
    bot.chat(command); // Executa o comando como bot
    console.log(`[Bot] Comando executado: ${command}`);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado.');
  });
});

// Inicia o servidor
server.listen(8000, () => {
  console.log('Servidor iniciado na porta 8000');
});