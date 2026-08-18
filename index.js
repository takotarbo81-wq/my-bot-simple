const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
} = require("discord.js");

require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ================================
// إعدادات OpenAI
// ================================
const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5.6";

// ================================
// تشغيل البوت
// ================================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log("🤖 OpenAI AI Support Bot is online!");
});

// ================================
// رسائل التكتات
// ================================
client.on("messageCreate", async (message) => {
  // تجاهل رسائل البوتات
  if (message.author.bot) return;

  // التأكد أن الرسالة داخل تكت
  const isTicket =
    message.channel.type === ChannelType.GuildText &&
    (
      message.channel.name.toLowerCase().includes("ticket") ||
      message.channel.name.toLowerCase().includes("تكت")
    );

  if (!isTicket) return;

  // تجاهل الرسائل الفارغة
  const userMessage = message.content.trim();
  if (!userMessage) return;

  try {
    // إظهار أن البوت يكتب
    await message.channel.sendTyping();

    // التأكد من وجود مفتاح OpenAI
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ OPENAI_API_KEY غير موجود!");
      return message.reply(
        "❌ البوت غير متصل بالذكاء الاصطناعي. تأكد من إعداد OPENAI_API_KEY."
      );
    }

    // إرسال الطلب إلى OpenAI
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },

      body: JSON.stringify({
        model: OPENAI_MODEL,

        instructions:
          "أنت موظف دعم فني داخل سيرفر Discord. " +
          "أجب بالعربية بشكل مختصر وواضح وودود. " +
          "ساعد المستخدم في حل مشكلته. " +
          "إذا لم تعرف الإجابة، قل إنك تحتاج إلى تدخل الإدارة ولا تخترع معلومات.",

        input: userMessage,

        max_output_tokens: 500,
      }),
    });

    // إذا OpenAI رجع خطأ
    if (!response.ok) {
      const errorText = await response.text();

      console.error("❌ OpenAI API Error:");
      console.error(errorText);

      return message.reply(
        "❌ صار خطأ في الاتصال بالذكاء الاصطناعي."
      );
    }

    // تحويل الرد إلى JSON
    const data = await response.json();

    // استخراج النص
    const reply =
      data.output_text ||
      "❌ ما قدرت أطلع رد حاليًا.";

    // Discord يسمح بحد أقصى 2000 حرف للرسالة
    const chunks = [];

    for (let i = 0; i < reply.length; i += 1900) {
      chunks.push(reply.substring(i, i + 1900));
    }

    // إرسال الرد
    for (const chunk of chunks) {
      await message.reply(chunk);
    }

  } catch (error) {
    console.error("❌ Bot Error:", error);

    await message.reply(
      "❌ صار خطأ، حاول مرة ثانية."
    );
  }
});

// ================================
// تسجيل دخول Discord
// ================================
if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود!");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
