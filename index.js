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

const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  // تجاهل رسائل البوتات
  if (message.author.bot) return;

  // فقط داخل التكتات
  const isTicket =
    message.channel.type === ChannelType.GuildText &&
    (
      message.channel.name.toLowerCase().includes("ticket") ||
      message.channel.name.toLowerCase().includes("تكت")
    );

  if (!isTicket) return;

  // إذا الرسالة فاضية
  if (!message.content.trim()) return;

  try {
    await message.channel.sendTyping();

    const response = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "أنت موظف دعم فني داخل سيرفر Discord. أجب بالعربية بشكل مختصر وواضح وودود. إذا لم تعرف الإجابة، قل إنك تحتاج إلى تدخل الإدارة ولا تخترع معلومات.",
          },
          {
            role: "user",
            content: message.content,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek API Error:", errorText);
      return message.reply("❌ صار خطأ في الاتصال بالذكاء الاصطناعي.");
    }

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content ||
      "❌ ما قدرت أطلع رد حاليًا.";

    await message.reply(reply);
  } catch (error) {
    console.error("Bot Error:", error);
    await message.reply("❌ صار خطأ، حاول مرة ثانية.");
  }
});

client.login(process.env.DISCORD_TOKEN);
