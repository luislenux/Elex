const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const MONGO_URI = 'mongodb+srv://luislinux1221_db_user:oRDh9Xhvs45jaA8W@cluster0.tsjbjdo.mongodb.net/elexdb?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Conectado ao MongoDB Atlas com sucesso!'))
  .catch(err => console.error('❌ Erro ao conectar no MongoDB:', err));

// Schema de Utilizador com Foto de Perfil
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePic: { type: String, default: '' },
  adsWatched: { type: Number, default: 0 },
  balance: { type: Number, default: 0.00 },
  pixKey: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Schema de Stories
const storySchema = new mongoose.Schema({
  author: { type: String, required: true },
  authorPic: { type: String, default: '' },
  mediaUrl: { type: String, required: true },
  mediaType: { type: String, default: 'image' }, // 'image' ou 'video'
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Apaga após 24h
});
const Story = mongoose.model('Story', storySchema);

// Schema de Mensagens Diretas (Pesquisa direta, sem necessidade de amigos)
const directMessageSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const DirectMessage = mongoose.model('DirectMessage', directMessageSchema);

// Schema de Grupos
const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  creator: { type: String, required: true },
  members: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});
const Group = mongoose.model('Group', groupSchema);

// Schema de Mensagens de Grupo
const groupMessageSchema = new mongoose.Schema({
  groupId: { type: String, required: true },
  sender: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema);

// Schema dos Posts (Feed Social com Suporte a Vídeo e Imagem)
const postSchema = new mongoose.Schema({
  author: { type: String, required: true },
  authorPic: { type: String, default: '' },
  content: { type: String, required: true },
  mediaUrl: { type: String, default: '' },
  mediaType: { type: String, default: 'image' }, // 'image' ou 'video'
  createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// --- ROTAS DE AUTENTICAÇÃO E PERFIL ---
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, profilePic } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Preencha os campos!' });

    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).json({ error: 'Utilizador já existe!' });

    const newUser = new User({ username, password, profilePic: profilePic || '' });
    await newUser.save();
    res.json({ success: true, message: 'Conta criada com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar conta.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });

    if (!user) return res.status(401).json({ error: 'Utilizador ou palavra-passe incorretos!' });

    res.json({ 
      success: true, 
      username: user.username, 
      profilePic: user.profilePic,
      adsWatched: user.adsWatched,
      balance: user.balance.toFixed(2),
      pixKey: user.pixKey
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
});

app.post('/api/profile/update', async (req, res) => {
  try {
    const { username, profilePic } = req.body;
    const user = await User.findOneAndUpdate({ username }, { profilePic }, { new: true });
    res.json({ success: true, profilePic: user.profilePic });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar foto de perfil.' });
  }
});

app.get('/api/users/search/:query', async (req, res) => {
  try {
    const users = await User.find({ username: { $regex: req.params.query, $options: 'i' } }).select('username profilePic');
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar utilizadores.' });
  }
});

// --- ROTAS DE STORIES ---
app.get('/api/stories', async (req, res) => {
  try {
    const stories = await Story.find().sort({ createdAt: -1 });
    res.json({ success: true, stories });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar stories.' });
  }
});

app.post('/api/stories', async (req, res) => {
  try {
    const { author, authorPic, mediaUrl, mediaType } = req.body;
    if (!mediaUrl) return res.status(400).json({ error: 'Insira uma mídia para o story.' });

    const newStory = new Story({ author, authorPic, mediaUrl, mediaType });
    await newStory.save();
    io.emit('new_story', newStory);
    res.json({ success: true, story: newStory });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar story.' });
  }
});

// --- ROTAS DE MENSAGENS E GRUPOS ---
app.get('/api/messages/direct/:user1/:user2', async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const messages = await DirectMessage.find({
      $or: [
        { from: user1, to: user2 },
        { from: user2, to: user1 }
      ]
    }).sort({ createdAt: 1 });

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar mensagens.' });
  }
});

app.post('/api/groups/create', async (req, res) => {
  try {
    const { name, creator } = req.body;
    if (!name || !creator) return res.status(400).json({ error: 'Preencha o nome do grupo.' });

    const newGroup = new Group({ name, creator, members: [creator] });
    await newGroup.save();
    res.json({ success: true, group: newGroup });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar grupo.' });
  }
});

app.get('/api/groups/list/:username', async (req, res) => {
  try {
    const groups = await Group.find().sort({ createdAt: -1 });
    res.json({ success: true, groups });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar grupos.' });
  }
});

app.get('/api/groups/messages/:groupId', async (req, res) => {
  try {
    const messages = await GroupMessage.find({ groupId: req.params.groupId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar mensagens do grupo.' });
  }
});

// --- ROTAS DE FEED & RECOMPENSAS ---
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).limit(30);
    res.json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar o feed.' });
  }
});

app.post('/api/posts', async (req, res) => {
  try {
    const { author, authorPic, content, mediaUrl, mediaType } = req.body;
    if (!author || !content) return res.status(400).json({ error: 'O conteúdo não pode estar vazio.' });

    const newPost = new Post({ author, authorPic, content, mediaUrl, mediaType });
    await newPost.save();
    io.emit('new_post', newPost);
    res.json({ success: true, post: newPost });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar publicação.' });
  }
});

app.post('/api/watch-ad', async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'Utilizador não encontrado.' });

    user.adsWatched += 1;
    let cycleCompleted = false;
    if (user.adsWatched >= 10) {
      user.balance += 0.06;
      user.adsWatched = 0;
      cycleCompleted = true;
    }
    await user.save();
    res.json({ success: true, adsWatched: user.adsWatched, balance: user.balance.toFixed(2), cycleCompleted });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao contabilizar anúncio.' });
  }
});

app.post('/api/request-payout', async (req, res) => {
  try {
    const { username, pixKey } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'Utilizador não encontrado.' });

    const MIN_PAYOUT = 0.50;
    if (user.balance < MIN_PAYOUT) {
      return res.status(400).json({ error: `Saldo insuficiente! Mínimo: R$ ${MIN_PAYOUT.toFixed(2)}.` });
    }

    const amountToPay = user.balance;
    user.balance = 0.00;
    user.pixKey = pixKey;
    await user.save();

    res.json({ success: true, message: `Solicitação de saque de R$ ${amountToPay.toFixed(2)} enviada para PIX: ${pixKey}!` });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao processar saque.' });
  }
});

// --- WEBRTC & SOCKET.IO (MENSAGENS & CHAMADAS DE VÍDEO/TELA) ---
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
  socket.on('join_room', (room) => {
    socket.join(room);
  });

  socket.on('send_direct_message', async (data) => {
    const { from, to, text } = data;
    if (!from || !to || !text) return;

    const msg = new DirectMessage({ from, to, text });
    await msg.save();

    const roomKey = [from, to].sort().join('_');
    io.to(roomKey).emit('receive_direct_message', msg);
  });

  socket.on('send_group_message', async (data) => {
    const { groupId, sender, text } = data;
    if (!groupId || !sender || !text) return;

    const msg = new GroupMessage({ groupId, sender, text });
    await msg.save();

    io.to(groupId).emit('receive_group_message', msg);
  });

  // Sinalização WebRTC para Chamadas de Vídeo e Transmissão de Tela
  socket.on('call_signal', (data) => {
    io.to(data.room).emit('call_signal', data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor Elex ativo em http://localhost:${PORT}`));
