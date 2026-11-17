const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 10000;

// Configurações (Substitua pelas suas variáveis de ambiente no Render)
const token = process.env.TELEGRAM_TOKEN || 'COLOQUE_SEU_TOKEN_AQUI';
const mongoUri = process.env.MONGO_URI || 'COLOQUE_SUA_URL_MONGODB_AQUI';

// Middleware para ler JSON nas requisições do site
app.use(express.json());

// Conexão com o MongoDB Atlas
mongoose.connect(mongoUri)
  .then(() => console.log('✅ Conectado ao MongoDB Atlas com sucesso!'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Definição do modelo de Utilizador no Banco de Dados
const userSchema = new mongoose.Schema({
  chatId: { type: Number, unique: true },
  username: { type: String, default: 'Utilizador' },
  anunciosVistos: { type: Number, default: 0 },
  saldo: { type: Number, default: 0.00 },
  progressoCiclo: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

// Inicializar o Bot do Telegram com Polling ativo
const bot = new TelegramBot(token, { polling: true });

// Comando /start no Telegram
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name || 'Utilizador';

  try {
    await User.findOneAndUpdate(
      { chatId: chatId },
      { 
        $setOnInsert: { anunciosVistos: 0, saldo: 0.00, progressoCiclo: 0 },
        $set: { username: username }
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('Erro ao registar utilizador:', err);
  }

  // URL da aplicação no Render
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

// --- ROTAS DO SITE (WEB APP) ---

// Servir a página principal do painel com a barra inferior integrada
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ELEX - Painel</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <style>
            body { font-family: Arial, sans-serif; background-color: #0d1117; color: #fff; margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; min-height: 100vh; padding-bottom: 70px; }
            .container { width: 100%; max-width: 400px; padding: 20px; box-sizing: border-box; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
            .header h1 { color: #00f2fe; font-size: 24px; margin: 0; }
            .user-tag { color: #00f2fe; font-size: 14px; }
            .card { background: #161b22; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
            .saldo { font-size: 32px; font-weight: bold; color: #00f2fe; margin: 10px 0; }
            .btn { width: 100%; padding: 12px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-bottom: 10px; font-size: 14px; }
            .btn-blue { background: linear-gradient(90deg, #00c6ff, #0072ff); color: #fff; }
            .input-box { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #30363d; background: #161b22; color: #fff; margin-bottom: 10px; box-sizing: border-box; }
            
            /* Barra de Navegação Inferior */
            .nav-bar { position: fixed; bottom: 0; left: 0; width: 100%; background: #161b22; border-top: 1px solid #30363d; display: flex; justify-content: space-around; padding: 12px 0; z-index: 1000; }
            .nav-item { background: none; border: none; color: #8b949e; font-size: 20px; cursor: pointer; display: flex; flex-direction: column; align-items: center; }
            .nav-item.active { color: #00f2fe; }
            .nav-item svg { width: 24px; height: 24px; fill: currentColor; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>ELEX</h1>
                <span class="user-tag" id="usernameDisplay">@Utilizador</span>
            </div>
            
            <div class="card">
                <div>SALDO ACUMULADO</div>
                <div class="saldo" id="saldoDisplay">R$ 0,00</div>
                <div id="cicloDisplay">Progresso no Ciclo: 0/30</div>
            </div>

            <button class="btn btn-blue" onclick="verAnuncio(5, 1)">⚡ Anúncio Rápido (5s) [+1 no ciclo]</button>
            <button class="btn btn-blue" onclick="verAnuncio(30, 1)">⏳ Anúncio Completo (30s) [+1 no ciclo]</button>

            <div style="margin-top: 20px; background: #161b22; padding: 15px; border-radius: 12px;">
                <label style="font-size: 14px; font-weight: bold;">Solicitar Levantamento PIX</label>
                <input type="text" id="chavePix" class="input-box" placeholder="Chave PIX (CPF, Email, Telefone)">
                <button class="btn btn-blue" onclick="solicitarSaque()">Solicitar Levantamento (Mín. R$ 0,50)</button>
            </div>
        </div>

        <!-- Barra de Navegação Fixa Inferior -->
        <div class="nav-bar">
            <button class="nav-item active" onclick="navegar('home')">
                <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            </button>
            <button class="nav-item" onclick="navegar('ads')">
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <button class="nav-item" onclick="navegar('chat')">
                <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0-2-.9-2-2V4c0-1.1-.9-2-2-2z"/></svg>
            </button>
            <button class="nav-item" onclick="navegar('search')">
                <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            </button>
            <button class="nav-item" onclick="navegar('profile')">
                <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            </button>
        </div>

        <script>
            const tg = window.Telegram.WebApp;
            tg.expand();

            const user = tg.initDataUnsafe?.user;
            const chatId = user ? user.id : 123456;
            const username = user ? (user.username || user.first_name) : 'Utilizador';
            
            document.getElementById('usernameDisplay').innerText = '@' + username;

            function carregarDados() {
                fetch('/api/user?chatId=' + chatId)
                    .then(res => res.json())
                    .then(data => {
                        document.getElementById('saldoDisplay').innerText = 'R$ ' + (data.saldo || 0).toFixed(2);
                        document.getElementById('cicloDisplay').innerText = 'Progresso no Ciclo: ' + (data.progressoCiclo || 0) + '/30';
                    });
            }

            function verAnuncio(duracao, progressoInc) {
                alert('A abrir anúncio... Aguarde ' + duracao + ' segundos.');
                fetch('/api/assistir', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chatId: chatId, progressoInc: progressoInc })
                })
                .then(res => res.json())
                .then(data => {
                    if(data.success) {
                        alert('Anúncio concluído com sucesso!');
                        carregarDados();
                    } else {
                        alert(data.message);
                    }
                });
            }

            function solicitarSaque() {
                const chave = document.getElementById('chavePix').value;
                if(!chave) {
                    alert('Insira uma chave PIX válida.');
                    return;
                }
                alert('Pedido de levantamento enviado com sucesso!');
            }

            function navegar(secao) {
                if(secao === 'chat') {
                    alert('Secção de mensagens/suporte da ELEX.');
                } else if(secao === 'profile') {
                    alert('Utilizador: @' + username);
                } else if(secao === 'search') {
                    alert('Funcionalidade de pesquisa rápida.');
                }
            }

            carregarDados();
        </script>
    </body>
    </html>
  `);
});

// API para consultar dados do utilizador
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

// API para contabilizar o anúncio assistido (Com limite estrito de 30)
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

    user.progressoCiclo += progressoInc;
    user.saldo += 0.05; // Valor em R$ adicionado por anúncio concluído
    await user.save();

    res.json({ success: true, progressoCiclo: user.progressoCiclo, saldo: user.saldo });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro no servidor' });
  }
});

app.listen(port, () => {
  console.log(`Servidor ELEX ativo na porta ${port}`);
});

