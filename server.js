const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;
const mongoUri = process.env.MONGO_URI || 'COLOQUE_SUA_URL_MONGODB_AQUI';

app.use(express.json());
app.use(express.static(path.join(__dirname)));

mongoose.connect(mongoUri)
  .then(() => console.log('✅ Conectado ao MongoDB Atlas com sucesso!'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  saldo: { type: Number, default: 0.00 },
  progressoCiclo: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota de Login / Registo Automático
app.post('/api/auth', async (req, res) => {
  const { username, password, action } = req.body;
  if (!username || !password) {
    return res.json({ success: false, message: 'Preencha todos os campos.' });
  }

  try {
    let user = await User.findOne({ username: username.toLowerCase().trim() });

    if (action === 'register') {
      if (user) {
        return res.json({ success: false, message: 'Este utilizador já existe.' });
      }
      user = await User.create({
        username: username.toLowerCase().trim(),
        password: password,
        saldo: 0,
        progressoCiclo: 0
      });
      return res.json({ success: true, user });
    } else {
      if (!user || user.password !== password) {
        return res.json({ success: false, message: 'Utilizador ou palavra-passe incorretos.' });
      }
      return res.json({ success: true, user });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro no servidor.' });
  }
});

// Buscar dados atualizados do utilizador
app.get('/api/user', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: 'Username necessário' });

  try {
    const user = await User.findOne({ username: username });
    if (!user) return res.status(404).json({ error: 'Utilizador não encontrado' });
    res.json({ username: user.username, saldo: user.saldo, progressoCiclo: user.progressoCiclo });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

// Assistir anúncio
app.post('/api/assistir', async (req, res) => {
  const { username, progressoInc } = req.body;
  const LIMITE_DIARIO = 30;

  try {
    let user = await User.findOne({ username: username });
    if (!user) {
      return res.json({ success: false, message: 'Sessão inválida. Faça login novamente.' });
    }

    if (user.progressoCiclo >= LIMITE_DIARIO) {
      return res.json({ success: false, message: '⚠️ Limite diário de 30 anúncios atingido!' });
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
  console.log(`Servidor web ativo na porta ${port}`);
});

