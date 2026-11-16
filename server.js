const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 10000;

// Configurações
const token = process.env.TELEGRAM_TOKEN || 'COLOQUE_SEU_TOKEN_AQUI';
const mongoUri = process.env.MONGO_URI || 'COLOQUE_SUA_URL_MONGODB_AQUI';

// Conexão com o MongoDB Atlas
mongoose.connect(mongoUri)
  .then(() => console.log('✅ Conectado ao MongoDB Atlas com sucesso!'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Definição do modelo de Utilizador no Banco de Dados
const userSchema = new mongoose.Schema({
  chatId: { type: Number, unique: true },
  anunciosVistos: { type: Number, default: 0 },
  pontos: { type: Number, default: 0 },
  indicados: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

// Inicializar o Bot do Telegram
const bot = new TelegramBot(token, { polling: true });

// Comando /start com os botões fixos
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  // Regista o utilizador na base de dados se ele ainda não existir
  try {
    await User.findOneAndUpdate(
      { chatId: chatId },
      { $setOnInsert: { anunciosVistos: 0, pontos: 0, indicados: 0 } },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('Erro ao registar utilizador:', err);
  }

  const menuBotoes = {
    reply_markup: {
      keyboard: [
        [{ text: '🎬 Assistir Anúncios e Ganhar' }],
        [{ text: '💰 Meu Saldo' }, { text: '📤 Sacar' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };

  bot.sendMessage(
    chatId,
    '👋 Bem-vindo de volta à **Elex**!\n\nEscolha uma opção abaixo para ver os seus ganhos ou assistir a anúncios:',
    { parse_mode: 'Markdown', ...menuBotoes }
  );
});

// Respostas e interações com os botões
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text;

  // Ignora se for comando /start
  if (texto === '/start') return;

  if (texto === '🎬 Assistir Anúncios e Ganhar') {
    try {
      let user = await User.findOne({ chatId: chatId });
      
      // Limite diário configurado para 30 anúncios
      const LIMITE_DIARIO = 30;

      if (user && user.anunciosVistos >= LIMITE_DIARIO) {
        bot.sendMessage(
          chatId,
          `⚠️ **Limite Diário Atingido**\n\nVocê já assistiu aos **${LIMITE_DIARIO} anúncios** permitidos para hoje. Volte amanhã para continuar a acumular pontos!`,
          { parse_mode: 'Markdown' }
        );
      } else {
        // Incrementa +1 anúncio visto e +10 pontos
        await User.updateOne({ chatId: chatId }, { $inc: { anunciosVistos: 1, pontos: 10 } });

        bot.sendMessage(
          chatId,
          `📺 **Área de Anúncios Disponíveis**\n\nClique no link abaixo para ver o anúncio:\n👉 https://elex-bot.onrender.com\n\n*(Anúncio contabilizado com sucesso! Ganhou 10 pontos).*`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (err) {
      bot.sendMessage(chatId, 'Erro ao processar o anúncio. Tente novamente.');
    }
  } 
  else if (texto === '💰 Meu Saldo') {
    try {
      let user = await User.findOne({ chatId: chatId });
      if (!user) {
        user = { anunciosVistos: 0, pontos: 0 };
      }

      const ganhoEstimado = (user.anunciosVistos * 0.0018).toFixed(4);

      bot.sendMessage(
        chatId,
        `💰 **O seu Extrato Atual**\n\n` +
        `👁️ Anúncios vistos: **${user.anunciosVistos} / 30** (Hoje)\n` +
        `⭐ Pontos acumulados: **${user.pontos}**\n` +
        `💵 Valor estimado: **$${ganhoEstimado}**`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      bot.sendMessage(chatId, 'Erro ao consultar o saldo. Tente novamente mais tarde.');
    }
  } 
  else if (texto === '📤 Sacar') {
    bot.sendMessage(
      chatId,
      '📤 **Solicitar Saque**\n\nO saldo mínimo para resgate ainda não foi atingido ou a data de liberação (dia 20) ainda não chegou.',
      { parse_mode: 'Markdown' }
    );
  }
});

// Rota web para o Render
app.get('/', (req, res) => {
  res.send('Servidor Elex está online e a gerir os utilizadores!');
});

app.listen(port, () => {
  console.log(`Servidor Elex ativo em http://localhost:${port}`);
});

