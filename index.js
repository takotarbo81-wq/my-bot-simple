const {
  Client,
  GatewayIntentBits,
  ChannelType,
} = require("discord.js");

require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

client.once("ready", () => {
  console.log(`✅ البوت شغال: ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  if (message.channel.type !== ChannelType.GuildText) return;

  // يشتغل فقط داخل التكتات
  const name = message.channel.name.toLowerCase();

  if (!name.includes("ticket") && !name.includes("تكت")) {
    return;
  }

  try {
    await message.channel.sendTyping();

    console.log(`📩 رسالة من ${message.author.tag}: ${message.content}`);

    const result = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `
أنت بوت دعم فني في Discord.

تكلم باللغة العربية.
كن محترمًا وودودًا.
أجب على سؤال العميل مباشرة.
إذا لم تعرف الإجابة، أخبره أن الموظف يستطيع مساعدته.

رسالة العميل:
${message.content}
      `,
    });

    const reply = result.text;

    if (!reply) {
      await message.channel.send("❌ Gemini لم يرجع ردًا.");
      return;
    }

    await message.channel.send(reply);

    console.log("✅ تم إرسال رد Gemini");

  } catch (error) {
    console.error("❌ خطأ Gemini:");
    console.error(error);

    await message.channel.send(
      "❌ حدث خطأ في الاتصال بـ Gemini."
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
