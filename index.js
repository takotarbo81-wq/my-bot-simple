const {
  Client,
  GatewayIntentBits,
  ChannelType,
} = require("discord.js");

require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

// =========================
// Discord
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// =========================
// Gemini
// =========================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// =========================
// Bot Ready
// =========================

client.once("ready", () => {
  console.log("================================");
  console.log(`✅ البوت شغال: ${client.user.tag}`);
  console.log("🤖 Gemini AI متصل");
  console.log("================================");
});

// =========================
// Messages
// =========================

client.on("messageCreate", async (message) => {
  try {
    // لا يرد على البوتات
    if (message.author.bot) return;

    // فقط قنوات السيرفر
    if (!message.guild) return;

    // فقط القنوات النصية
    if (message.channel.type !== ChannelType.GuildText) return;

    // فقط التكتات
    const channelName = message.channel.name.toLowerCase();

    const isTicket =
      channelName.includes("ticket") ||
      channelName.includes("تكت");

    if (!isTicket) return;

    // إذا الرسالة فاضية
    if (!message.content.trim()) return;

    // إظهار أن البوت يفكر
    await message.channel.sendTyping();

    console.log(
      `📩 ${message.author.tag}: ${message.content}`
    );

    // =========================
    // Gemini Request
    // =========================

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",

      contents: `
أنت بوت دعم فني ذكي داخل تكتات Discord.

قواعدك:
- تحدث بالعربية.
- كن محترمًا وودودًا.
- اجعل الرد واضحًا ومختصرًا.
- لا تقل إنك إنسان.
- إذا لم تعرف الإجابة، قل إن الموظف يستطيع المساعدة.
- لا تكرر كلام العميل بدون فائدة.

رسالة العميل:
${message.content}
      `,

      config: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });

    const reply = response.text;

    // =========================
    // إرسال الرد
    // =========================

    if (!reply || !reply.trim()) {
      await message.channel.send(
        "❌ ما قدرت أطلع رد حاليًا، حاول مرة ثانية."
      );
      return;
    }

    // Discord عنده حد 2000 حرف
    if (reply.length <= 2000) {
      await message.channel.send(reply);
    } else {
      // تقسيم الرد الطويل
      for (let i = 0; i < reply.length; i += 1900) {
        await message.channel.send(
          reply.substring(i, i + 1900)
        );
      }
    }

    console.log("✅ تم إرسال رد Gemini");

  } catch (error) {
    console.error("❌ Gemini Error:");
    console.error(error);

    await message.channel.send(
      "❌ صار خطأ أثناء الاتصال بالذكاء الاصطناعي. تأكد من مفتاح Gemini وحاول مرة ثانية."
    );
  }
});

// =========================
// Login
// =========================

client.login(process.env.DISCORD_TOKEN);
