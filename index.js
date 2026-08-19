const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const CONFIG = {
  TICKET_KEYWORDS: ['ticket', 'تكت', 'دعم', 'support'],
  SYSTEM_PROMPT: `أنت مساعد دعم فني في سيرفر دسكورد.
مهمتك الرد على استفسارات الأعضاء داخل التكتات بشكل مفيد ومحترم.
- خلي ردودك مختصرة ومباشرة قدر الإمكان (فقرة أو فقرتين كحد أقصى)، بدون حشو أو مقدمات طويلة.
- إذا كان السؤال بسيط جاوب عليه مباشرة بدون شرح زايد.
- إذا كانت المشكلة معقدة أو تحتاج تدخل بشري، وضح للعضو باختصار إنك بتحوله لفريق الدعم.
- خلي ردودك بالعربية إلا إذا كتب العضو بالإنجليزي.
- لا تخترع معلومات لا تعرفها.`,
  MODEL_NAME: 'gemini-flash-latest',
  MAX_CONVERSATIONS: 500,
  INACTIVE_MINUTES: 60,
  MAX_HISTORY_MESSAGES: 10, // أقصى عدد رسائل نحتفظ فيها بذاكرة كل تكت (يسرّع الردود اللي بعدها)
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: CONFIG.MODEL_NAME,
  systemInstruction: CONFIG.SYSTEM_PROMPT,
  generationConfig: {
    maxOutputTokens: 300, // يحد طول الرد فيطلع أسرع
  },
});

// كل عنصر: { chat, lastUsed, history }
const conversations = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  console.log(`✅ البوت شغال باسم ${client.user.tag}`);
});

function isTicketChannel(channel) {
  if (!channel?.name) return false;
  const name = channel.name.toLowerCase();
  return CONFIG.TICKET_KEYWORDS.some((kw) => name.includes(kw.toLowerCase()));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

setInterval(() => {
  const now = Date.now();
  const cutoff = CONFIG.INACTIVE_MINUTES * 60 * 1000;
  for (const [channelId, data] of conversations.entries()) {
    if (now - data.lastUsed > cutoff) {
      conversations.delete(channelId);
    }
  }
}, 10 * 60 * 1000);

function getConversation(channelId) {
  const existing = conversations.get(channelId);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing;
  }

  if (conversations.size >= CONFIG.MAX_CONVERSATIONS) {
    const oldestKey = [...conversations.entries()].sort(
      (a, b) => a[1].lastUsed - b[1].lastUsed
    )[0][0];
    conversations.delete(oldestKey);
  }

  const data = { chat: null, lastUsed: Date.now(), history: [] };
  conversations.set(channelId, data);
  return data;
}

// يبني تشات جديد كل مرة بس بأحدث جزء من السجل (يمنع الردود من التباطؤ مع طول التكت)
function rebuildChat(data) {
  const trimmedHistory = data.history.slice(-CONFIG.MAX_HISTORY_MESSAGES);
  data.chat = model.startChat({ history: trimmedHistory });
}

async function sendWithRetry(chat, content, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await chat.sendMessage(content);
    } catch (err) {
      const status = err?.status;
      const retryable = status === 503 || status === 429;
      if (retryable && attempt < retries) {
        await sleep(attempt * 2500);
        continue;
      }
      throw err;
    }
  }
}

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;
    if (!isTicketChannel(message.channel)) return;
    if (!message.content || message.content.trim().length === 0) return;

    await message.channel.sendTyping();

    const data = getConversation(message.channel.id);
    if (!data.chat) rebuildChat(data);

    const result = await sendWithRetry(data.chat, message.content);
    const reply = result.response.text();

    // خزّن الرسالتين بالسجل، وقلّمه لو طال
    data.history.push({ role: 'user', parts: [{ text: message.content }] });
    data.history.push({ role: 'model', parts: [{ text: reply }] });
    if (data.history.length > CONFIG.MAX_HISTORY_MESSAGES) {
      data.history = data.history.slice(-CONFIG.MAX_HISTORY_MESSAGES);
      rebuildChat(data); // أعد بناء التشات بالسجل المقلّم عشان الطلب القادم يكون أسرع
    }

    if (reply.length <= 2000) {
      await message.reply(reply);
    } else {
      for (let i = 0; i < reply.length; i += 2000) {
        await message.channel.send(reply.slice(i, i + 2000));
      }
    }
  } catch (err) {
    console.error('❌ خطأ:', err);
    const status = err?.status;
    const msg =
      status === 429
        ? 'في ضغط كبير حالياً على النظام، جرب بعد شوي 🙏'
        : 'صار خطأ بسيط، جرب كمان مرة أو استنى فريق الدعم 🙏';
    message.reply(msg).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
