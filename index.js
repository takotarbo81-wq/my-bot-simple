require("dotenv").config();

const {
  Client,
  GatewayIntentBits
} = require("discord.js");

const Groq = require("groq-sdk");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const MODEL = "llama-3.1-8b-instant";

client.once("ready", () => {
  console.log("================================");
  console.log("🤖 TicketAI Online");
  console.log(`🧠 Model: ${MODEL}`);
  console.log("⚡ Groq AI Enabled");
  console.log("================================");
});

client.on("messageCreate", async (message) => {
  try {
    // تجاهل البوتات
    if (message.author.bot) return;

    // لازم يكون داخل سيرفر
    if (!message.guild) return;

    // تجاهل الرسائل الفارغة
    const text = message.content.trim();

    if (!text) return;

    console.log(
      `📩 ${message.author.username}: ${text}`
    );

    // يظهر Typing مباشرة
    await message.channel.sendTyping().catch(() => {});

    const completion =
      await groq.chat.completions.create({
        model: MODEL,

        messages: [
          {
            role: "system",
            content: `
أنت TicketAI، مساعد ذكاء اصطناعي حقيقي داخل Discord.

تكلم بطريقة طبيعية وودية.
افهم العربية والعامية واللهجة الأردنية.

إذا المستخدم شرح مشكلة:
- افهم المشكلة.
- أعطه حلًا مباشرًا.
- إذا احتجت معلومة ناقصة، اسأله عنها.

قواعد مهمة:
- لا تقل "أنا مجرد بوت".
- لا تكتب Draft.
- لا تكتب تحليل داخلي.
- لا تكرر نفس الجملة.
- لا تبدأ كل رد بـ "أهلاً بك".
- لا تخترع معلومات.
- اجعل الرد مختصرًا وواضحًا.
`
          },

          {
            role: "user",
            content: text
          }
        ],

        max_tokens: 300,

        temperature: 0.6
      });

    const answer =
      completion.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      await message.reply(
        "❌ ما قدرت أجهز رد حاليًا."
      );
      return;
    }

    await message.reply({
      content: answer.slice(0, 1900),

      allowedMentions: {
        repliedUser: false
      }
    });

    console.log(
      `🤖 AI: ${answer}`
    );

  } catch (error) {

    console.error(
      "❌ GROQ ERROR:",
      error
    );

    const errorText =
      String(error?.message || error);

    if (
      errorText.includes("401") ||
      errorText.includes("invalid
