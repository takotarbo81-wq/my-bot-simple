require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
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
  console.log("🧠 Groq AI: " + MODEL);
  console.log("================================");
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const text = message.content.trim();

  if (!text) return;

  console.log("📩 " + message.author.username + ": " + text);

  try {
    await message.channel.sendTyping();

    const response = await groq.chat.completions.create({
      model: MODEL,

      messages: [
        {
          role: "system",
          content:
            "أنت TicketAI، مساعد ذكاء اصطناعي داخل Discord. " +
            "تكلم بالعربية الطبيعية وافهم اللهجة الأردنية والعامية. " +
            "ساعد المستخدم مباشرة وباختصار. " +
            "لا تستخدم ردود محفوظة ولا تكرر نفسك. " +
            "إذا كانت المشكلة غير واضحة اسأل المستخدم عن التفاصيل."
        },
        {
          role: "user",
          content: text
        }
      ],

      temperature: 0.6,
      max_tokens: 300
    });

    const answer = response.choices[0].message.content;

    if (!answer) {
      await message.reply("❌ ما قدرت أجهز رد.");
      return;
    }

    await message.reply({
      content: answer.substring(0, 1900),
      allowedMentions: {
        repliedUser: false
      }
    });

    console.log("🤖 AI: " + answer);

  } catch (error) {
    console.error("❌ AI ERROR:");
    console.error(error);

    await message.reply(
      "❌ صار خطأ مؤقت بالذكاء الاصطناعي، حاول مرة ثانية."
    ).catch(() => {});
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود");
  process.exit(1);
}

if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY غير موجود");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
