const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

const token = process.env.TELEGRAM_TOKEN || 'COLOQUE_SEU_TOKEN_AQUI';
const mongoUri = process.env.MONGO_URI || 'COLOQUE_SUA_URL_MONGODB_AQUI';

app.use(express.json());
app.use(express.static(path.join(__dirname)));

mongoose.connect(mongoUri)
  .then(() => console.log('✅ Conectado ao MongoDB Atlas com sucesso!'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

const userSchema = new mongoose.Schema({
  chatId: { type: Number, unique: true },
  username: { type: String, default: 'Utilizador' },
  anunciosVistos: { type: Number, default: 0 },
  saldo: { type: Number, default: 0.00 },
  progressoCiclo: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name || 'Utilizador';

  try {
    await User.findOneAndUpdate(
      { chatId: chatId },
      { 
        $setOnInsert: { anunciosVistos: 0, saldo: 0.00, progressoCiclo: 0 },$set: { username: username }
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('Erro ao registar utilizador:', err);
  }

  const webAppUrl = 'https://elex-bot.onrender.com';
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 Abrir Painel ELEX', web_app: { url: webAppUrl } }]
      ]
    }
  };

  bot.sendMessage(
    chatId,
    `👋 Olá **@${username}**!\n\nBem-vindo ao painel da **ELEX**. Clique no botão abaixo para abrir a aplicação:`,
    { parse_mode: 'Markdown', ...opts }
  );
});

// Envia o ficheiro index.html separado
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/user', async (req, res) => {
  const chatId = req.query.chatId;
  try {
    let user = await User.findOne({ chatId: chatId });
    if (!user) {
      user = { saldo: 0, progressoCiclo: 0 };
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

app.post('/api/assistir', async (req, res) => {
  const { chatId, progressoInc } = req.body;
  const LIMITE_DIARIO = 30;

  try {
    let user = await User.findOne({ chatId: chatId });
    if (!user) {
      user = new User({ chatId: chatId, progressoCiclo: 0, saldo: 0 });
    }

    if (user.progressoCiclo >= LIMITE_DIARIO) {
      return res.json({ success: false, message: '⚠️ Limite diário de 30 anúncios atingido! Volte amanhã.' });
    }

    user.progressoCiclo += (progressoInc || 1);
    user.saldo += 0.05;
    await user.save();

    res.json({ success: true, progressoCiclo: user.progressoCiclo, saldo: user.saldo });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro no servidor' });
  }
});

app.listen(port, () => {
  console.log(`Servidor ELEX

