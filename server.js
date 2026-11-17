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
  userId: { type: String, unique: true, default: 'user_padrao' },
  anunciosVistos: { type: Number, default: 0 },
  saldo: { type: Number, default: 0.00 },
  progressoCiclo: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

// Rota principal que envia o index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/user', async (req, res) => {
  const userId = req.query.userId || 'user_padrao';
  try {
    let user = await User.findOne({ userId: userId });
    if (!user) {
      user = await User.create({ userId: userId, saldo: 0, progressoCiclo: 0 });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

app.post('/api/assistir', async (req, res) => {
  const { userId = 'user_padrao', progressoInc } = req.body;
  const LIMITE_DIARIO = 30;

  try {
    let user = await User.findOne({ userId: userId });
    if (!user) {
      user = new User({ userId: userId, progressoCiclo: 0, saldo: 0 });
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

