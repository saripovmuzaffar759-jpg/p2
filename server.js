const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// ========== БАЗА ДАННЫХ ==========
class Database {
    constructor() {
        this.dataFile = path.join(__dirname, 'database.json');
        this.online = new Map();
        this.data = null;
        this.init();
    }

    defaultData() {
        return {
            config: {
                name: 'SuperChat Ultra',
                desc: 'Мой Telegram',
                theme: 'dark',
                skin: 'default'
            },
            users: {
                // ПРЕДУСТАНОВЛЕННЫЕ ПОЛЬЗОВАТЕЛИ
                'doros': {
                    username: 'doros',
                    displayName: 'Дорос',
                    password: '123456',
                    avatar: { emoji: '👑', color: '#FFD700', background: '#FFD70020' },
                    status: 'online',
                    bio: '👑 Администратор',
                    balance: 1000,
                    messages: 0,
                    gifts: [],
                    friends: [],
                    chats: [],
                    achievements: {},
                    createdAt: new Date().toISOString(),
                    lastSeen: new Date().toISOString(),
                    role: 'admin'
                },
                'muz': {
                    username: 'muz',
                    displayName: 'Муза',
                    password: '123456',
                    avatar: { emoji: '🎵', color: '#FF6B6B', background: '#FF6B6B20' },
                    status: 'online',
                    bio: '🎵 Музыкальный админ',
                    balance: 1000,
                    messages: 0,
                    gifts: [],
                    friends: [],
                    chats: [],
                    achievements: {},
                    createdAt: new Date().toISOString(),
                    lastSeen: new Date().toISOString(),
                    role: 'admin'
                },
                'admin': {
                    username: 'admin',
                    displayName: 'Admin',
                    password: 'admin',
                    avatar: { emoji: '⚡', color: '#FF4444', background: '#FF444420' },
                    status: 'online',
                    bio: '⚡ Главный администратор',
                    balance: 9999,
                    messages: 0,
                    gifts: [],
                    friends: [],
                    chats: [],
                    achievements: {},
                    createdAt: new Date().toISOString(),
                    lastSeen: new Date().toISOString(),
                    role: 'admin'
                }
            },
            messages: {},
            chats: {},
            gifts: {
                available: [
                    { id: 'rose', name: '🌹 Роза', price: 10, emoji: '🌹' },
                    { id: 'heart', name: '❤️ Сердце', price: 20, emoji: '❤️' },
                    { id: 'star', name: '⭐ Звезда', price: 30, emoji: '⭐' },
                    { id: 'crown', name: '👑 Корона', price: 50, emoji: '👑' },
                    { id: 'diamond', name: '💎 Бриллиант', price: 100, emoji: '💎' },
                    { id: 'rocket', name: '🚀 Ракета', price: 200, emoji: '🚀' }
                ]
            }
        };
    }

    async init() {
        try {
            const exists = await fs.access(this.dataFile).then(() => true).catch(() => false);
            if (exists) {
                const content = await fs.readFile(this.dataFile, 'utf8');
                this.data = JSON.parse(content);
                // Проверяем, есть ли предустановленные пользователи
                const defaultUsers = this.defaultData().users;
                for (const [key, val] of Object.entries(defaultUsers)) {
                    if (!this.data.users[key]) {
                        this.data.users[key] = val;
                    }
                }
                await this.save();
                console.log('✅ База данных загружена');
            } else {
                this.data = this.defaultData();
                await this.save();
                console.log('📁 Создана новая БД с пользователями');
            }
        } catch (err) {
            console.error('❌ Ошибка:', err);
            this.data = this.defaultData();
        }
    }

    async save() {
        try {
            await fs.writeFile(this.dataFile, JSON.stringify(this.data, null, 2));
        } catch (err) {
            console.error('❌ Ошибка сохранения:', err);
        }
    }

    getUser(username) {
        if (!this.data.users[username]) {
            this.data.users[username] = {
                username: username,
                displayName: username,
                password: '123456', // пароль по умолчанию
                avatar: this.generateAvatar(username),
                status: 'online',
                bio: '',
                balance: 100,
                messages: 0,
                gifts: [],
                friends: [],
                chats: [],
                achievements: {},
                createdAt: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                role: 'user'
            };
            this.save();
        }
        return this.data.users[username];
    }

    generateAvatar(username) {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8A5C', '#A29BFE'];
        const color = colors[username.length % colors.length];
        const emojis = ['😊', '😎', '🤩', '🥳', '😺', '🦊', '🐼', '🐨', '🦁', '🐧', '🐱', '🐶'];
        const emoji = emojis[username.length % emojis.length];
        return { color, emoji, background: `${color}20` };
    }

    getChat(chatId) {
        if (!this.data.chats[chatId]) {
            this.data.chats[chatId] = {
                id: chatId,
                type: 'private',
                members: [],
                admins: [],
                name: '',
                messages: [],
                createdAt: new Date().toISOString(),
                avatar: null
            };
            this.save();
        }
        return this.data.chats[chatId];
    }

    createPrivateChat(user1, user2) {
        const chatId = [user1, user2].sort().join('_');
        if (this.data.chats[chatId]) return chatId;
        
        const chat = this.getChat(chatId);
        chat.type = 'private';
        chat.members = [user1, user2];
        chat.name = `${user1} & ${user2}`;
        
        const user1Data = this.getUser(user1);
        const user2Data = this.getUser(user2);
        
        if (!user1Data.chats.includes(chatId)) user1Data.chats.push(chatId);
        if (!user2Data.chats.includes(chatId)) user2Data.chats.push(chatId);
        
        this.save();
        return chatId;
    }

    sendMessage(chatId, from, content, type = 'text', replyTo = null) {
        const chat = this.getChat(chatId);
        const message = {
            id: Date.now() + Math.random(),
            chatId,
            from: from,
            content: content,
            type: type,
            time: new Date().toISOString(),
            replyTo: replyTo,
            reactions: {},
            read: [],
            edited: false,
            deleted: false
        };
        
        chat.messages.push(message);
        
        const user = this.getUser(from);
        user.messages = (user.messages || 0) + 1;
        user.lastSeen = new Date().toISOString();
        
        this.save();
        return message;
    }

    sendGift(from, to, giftId, chatId) {
        const fromUser = this.getUser(from);
        const toUser = this.getUser(to);
        const gift = this.data.gifts.available.find(g => g.id === giftId);
        
        if (!gift) return { success: false, error: 'Подарок не найден' };
        if ((fromUser.balance || 0) < gift.price) {
            return { success: false, error: 'Недостаточно средств' };
        }
        
        fromUser.balance = (fromUser.balance || 0) - gift.price;
        if (!toUser.gifts) toUser.gifts = [];
        toUser.gifts.push({
            id: gift.id,
            name: gift.name,
            from: from,
            emoji: gift.emoji,
            time: new Date().toISOString()
        });
        
        const giftMessage = {
            id: Date.now() + Math.random(),
            chatId: chatId,
            from: 'system',
            content: `🎁 ${from} подарил ${gift.emoji} ${gift.name} ${to}`,
            type: 'system',
            time: new Date().toISOString(),
            reactions: {},
            gift: gift
        };
        
        const chat = this.getChat(chatId);
        chat.messages.push(giftMessage);
        
        this.save();
        return { 
            success: true, 
            message: giftMessage,
            gift: gift
        };
    }

    // ===== АВТОРИЗАЦИЯ =====
    login(username, password) {
        const user = this.getUser(username);
        if (user.password === password) {
            return { success: true, user };
        }
        return { success: false, error: 'Неверный пароль' };
    }

    register(username, password) {
        if (this.data.users[username]) {
            return { success: false, error: 'Пользователь уже существует' };
        }
        const user = this.getUser(username);
        user.password = password;
        user.createdAt = new Date().toISOString();
        this.save();
        return { success: true, user };
    }
}

// Ждем инициализации БД
let db;
async function startServer() {
    db = new Database();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // ========== SOCKET.IO ==========
    io.on('connection', (socket) => {
        console.log('🔌 Подключен:', socket.id);
        
        let currentUser = null;

        // ===== ЛОГИН =====
        socket.on('login', (data) => {
            const { username, password } = data;
            const result = db.login(username, password);
            
            if (result.success) {
                const user = result.user;
                currentUser = username;
                
                db.online.set(socket.id, { username, status: 'online' });
                user.status = 'online';
                user.lastSeen = new Date().toISOString();
                db.save();

                const userChats = user.chats || [];
                const chats = userChats.map(id => db.getChat(id));

                socket.emit('login_success', {
                    username: username,
                    user: user,
                    chats: chats,
                    gifts: db.data.gifts.available
                });

                io.emit('online_users', Array.from(db.online.values()).map(u => ({
                    username: u.username,
                    status: u.status || 'online'
                })));

                console.log(`✅ ${username} вошел в систему`);
            } else {
                socket.emit('login_error', result.error);
            }
        });

        // ===== РЕГИСТРАЦИЯ =====
        socket.on('register', (data) => {
            const { username, password } = data;
            const result = db.register(username, password);
            
            if (result.success) {
                socket.emit('register_success', { username });
                console.log(`📝 Зарегистрирован: ${username}`);
            } else {
                socket.emit('register_error', result.error);
            }
        });

        socket.on('create_private_chat', (targetUser) => {
            if (!currentUser) {
                socket.emit('error', 'Вы не авторизованы');
                return;
            }
            
            const chatId = db.createPrivateChat(currentUser, targetUser);
            const chat = db.getChat(chatId);
            
            [currentUser, targetUser].forEach(user => {
                const userSocket = Array.from(io.sockets.sockets.values()).find(
                    s => s.data?.username === user
                );
                if (userSocket) {
                    userSocket.emit('chat_created', { chatId, chat });
                }
            });
        });

        socket.on('send_message', ({ chatId, content, type = 'text', replyTo = null }) => {
            if (!currentUser) {
                socket.emit('error', 'Вы не авторизованы');
                return;
            }
            
            const message = db.sendMessage(chatId, currentUser, content, type, replyTo);
            const chat = db.getChat(chatId);
            
            chat.members.forEach(user => {
                const userSocket = Array.from(io.sockets.sockets.values()).find(
                    s => s.data?.username === user
                );
                if (userSocket) {
                    userSocket.emit('new_message', { chatId, message });
                }
            });
        });

        socket.on('send_gift', ({ to, giftId, chatId }) => {
            if (!currentUser) {
                socket.emit('error', 'Вы не авторизованы');
                return;
            }
            
            const result = db.sendGift(currentUser, to, giftId, chatId);
            
            if (result.success) {
                const toSocket = Array.from(io.sockets.sockets.values()).find(
                    s => s.data?.username === to
                );
                if (toSocket) {
                    toSocket.emit('gift_received', {
                        from: currentUser,
                        gift: result.gift,
                        chatId: chatId
                    });
                }
                
                const fromUser = db.getUser(currentUser);
                const toUser = db.getUser(to);
                
                const fromSocket = Array.from(io.sockets.sockets.values()).find(
                    s => s.data?.username === currentUser
                );
                if (fromSocket) {
                    fromSocket.emit('balance_update', fromUser.balance);
                }
                if (toSocket) {
                    toSocket.emit('balance_update', toUser.balance);
                }
                
                const chat = db.getChat(chatId);
                chat.members.forEach(user => {
                    const userSocket = Array.from(io.sockets.sockets.values()).find(
                        s => s.data?.username === user
                    );
                    if (userSocket) {
                        userSocket.emit('new_message', { chatId, message: result.message });
                    }
                });
                
                socket.emit('gift_sent', { success: true });
            } else {
                socket.emit('error', result.error);
            }
        });

        socket.on('add_reaction', ({ chatId, messageId, reaction }) => {
            if (!currentUser) return;
            
            const chat = db.getChat(chatId);
            const message = chat.messages.find(m => m.id === messageId);
            if (!message) return;
            
            if (!message.reactions) message.reactions = {};
            if (!message.reactions[reaction]) message.reactions[reaction] = [];
            
            const index = message.reactions[reaction].indexOf(currentUser);
            if (index === -1) {
                message.reactions[reaction].push(currentUser);
            } else {
                message.reactions[reaction].splice(index, 1);
            }
            
            db.save();
            
            chat.members.forEach(user => {
                const userSocket = Array.from(io.sockets.sockets.values()).find(
                    s => s.data?.username === user
                );
                if (userSocket) {
                    userSocket.emit('reaction_update', { chatId, messageId, reactions: message.reactions });
                }
            });
        });

        // ===== ПОИСК ПОЛЬЗОВАТЕЛЕЙ =====
        socket.on('search_users', (query) => {
            if (!currentUser || query.length < 2) return;
            
            const results = Object.keys(db.data.users)
                .filter(u => {
                    const user = db.data.users[u];
                    return u.toLowerCase().includes(query.toLowerCase()) && 
                           u !== currentUser &&
                           (!user.hidden || user.hidden === false);
                })
                .map(u => {
                    const user = db.data.users[u];
                    return {
                        username: u,
                        displayName: user.displayName || u,
                        avatar: user.avatar,
                        status: user.status || 'offline',
                        bio: user.bio || ''
                    };
                });
            
            socket.emit('search_results', results);
        });

        socket.on('get_gifts', () => {
            socket.emit('gifts_list', db.data.gifts.available);
        });

        socket.on('typing', ({ chatId }) => {
            if (!currentUser) return;
            const chat = db.getChat(chatId);
            chat.members.forEach(user => {
                if (user !== currentUser) {
                    const userSocket = Array.from(io.sockets.sockets.values()).find(
                        s => s.data?.username === user
                    );
                    if (userSocket) {
                        userSocket.emit('user_typing', { chatId, user: currentUser });
                    }
                }
            });
        });

        socket.on('disconnect', () => {
            if (currentUser) {
                db.online.delete(socket.id);
                const user = db.getUser(currentUser);
                user.status = 'offline';
                user.lastSeen = new Date().toISOString();
                db.save();
                
                io.emit('online_users', Array.from(db.online.values()).map(u => ({
                    username: u.username,
                    status: u.status || 'offline'
                })));
                
                console.log(`👋 ${currentUser} отключился`);
            }
        });

        socket.data = { username: currentUser };
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log('\n' + '🚀'.repeat(30));
        console.log('🌟 SUPERCHAT ULTRA v2.1 - С ПАРОЛЯМИ');
        console.log('🚀'.repeat(30));
        console.log(`📡 Порт: ${PORT}`);
        console.log(`👥 Пользователей: ${Object.keys(db.data.users).length}`);
        console.log(`📝 Доступные логины:`);
        for (const [key, val] of Object.entries(db.data.users)) {
            console.log(`   👤 ${key} (${val.password})`);
        }
        console.log(`💬 Чатов: ${Object.keys(db.data.chats).length}`);
        console.log(`🎁 Подарков: ${db.data.gifts.available.length}`);
        console.log('🚀'.repeat(30) + '\n');
    });
}

startServer();
