require("dotenv").config();

const {
  Client,
  GatewayIntentBits
} = require("discord.js");

const { GoogleGenAI } = require("@google/genai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

client.once("ready", () => {
  console.log(`🤖 البوت شغال: ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  try {
    console.log("📩 رسالة:", message.content);

    const result = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `
أنت مساعد ذكاء اصطناعي داخل Discord.
افهم العربية واللهجة الأردنية والعامية.
رد بشكل طبيعي ومفيد ومختصر.
لا تقل إنك مجرد بوت.
لا تكتب Draft أو تحليل داخلي.

رسالة المستخدم:
${message.content}
`
    });

    const reply = result.text?.trim();

    if (!reply) return;

    await message.reply(reply.slice(0, 1900));

    console.log("🤖 الرد:", reply);

  } catch (error) {
    console.error("❌ Gemini Error:", error);

    await message.reply(
      "❌ صار خطأ مؤقت بالذكاء الاصطناعي."
    ).catch(() => {});
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود");
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY غير موجود");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
