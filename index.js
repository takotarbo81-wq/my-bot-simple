const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const CONFIG = {
  TICKET_KEYWORDS: ['ticket', 'تكت', 'دعم', 'support'],
  SYSTEM_PROMPT: `أنت مساعد دعم فني في سيرفر دسكورد.
مهمتك الرد على استفسارات الأعضاء داخل التكتات بشكل مفيد، مختصر، ومحترم.
- إذا كان السؤال بسيط جاوب عليه مباشرة.
- إذا كانت المشكلة معقدة أو تحتاج تدخل بشري، وضح للعضو إنك بتحوله لفريق الدعم.
- خلي ردودك بالعربية إلا إذا كتب العضو بالإنجليزي.
- لا تخترع معلومات لا تعرفها.`,
  MODEL_NAME: 'gemini-flash-latest',
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: CONFIG.MODEL_NAME,
  systemInstruction: CONFIG.SYSTEM_PROMPT,
});

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

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;
    if (!isTicketChannel(message.channel)) return;
    if (!message.content || message.content.trim().length === 0) return;

    await message.channel.sendTyping();

    const channelId = message.channel.id;
    if (!conversations.has(channelId)) {
      conversations.set(channelId, model.startChat({ history: [] }));
    }
    const chat = conversations.get(channelId);

    const result = await chat.sendMessage(message.content);
    const reply = result.response.text();

    if (reply.length <= 2000) {
      await message.reply(reply);
    } else {
      for (let i = 0; i < reply.length; i += 2000) {
        await message.channel.send(reply.slice(i, i + 2000));
      }
    }
  } catch (err) {
    console.error('❌ خطأ:', err);
    message.reply('صار خطأ بسيط، جرب كمان مرة أو استنى فريق الدعم 🙏').catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
