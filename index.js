const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
} = require("discord.js");

require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

client.once("ready", () => {
  console.log(`✅ البوت شغال باسم: ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    // لا يرد على نفسه أو على البوتات
    if (message.author.bot) return;

    // فقط داخل التكتات
    const isTicket =
      message.channel.type === ChannelType.GuildText &&
      (
        message.channel.name.toLowerCase().includes("ticket") ||
        message.channel.name.toLowerCase().includes("تكت")
      );

    if (!isTicket) return;

    // رسالة مؤقتة
    const thinking = await message.channel.send("🤖 جاري التفكير...");

    const prompt = `
أنت بوت دعم فني داخل سيرفر Discord.
أجب باللغة العربية وبأسلوب محترم وواضح.
لا تدّعي أنك موظف بشري.
إذا لم تعرف الإجابة، قل للمستخدم إن الموظف يستطيع مساعدته.

رسالة العميل:
${message.content}
`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    await thinking.edit(response);

  } catch (error) {
    console.error("❌ Gemini Error:", error);

    await message.channel.send(
      "❌ صار خطأ أثناء الاتصال بالذكاء الاصطناعي. حاول مرة ثانية."
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
