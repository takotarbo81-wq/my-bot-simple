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

const MODEL = "openai/gpt-oss-20b";

client.once("ready", () => {
  console.log("================================");
  console.log("🤖 TicketAI Online");
  console.log("🧠 Model: " + MODEL);
  console.log("⚡ Groq Connected");
  console.log("================================");
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const text = message.content.trim();

  if (!text) return;

  console.log(
    "📩 " + message.author.username + ": " + text
  );

  try {
    await message.channel.sendTyping();

    const response = await groq.chat.completions.create({
      model: MODEL,

      messages: [
        {
          role: "system",
          content: `
أنت TicketAI، مساعد ذكاء اصطناعي داخل Discord.

تحدث بالعربية بشكل طبيعي.
افهم اللهجة الأردنية والعربية العامية.
ساعد المستخدم في حل مشكلته مباشرة.

لا تستخدم ردود محفوظة.
لا تكرر نفس الكلام.
لا تقل إنك مجرد بوت.
لا تكتب تحليلًا داخليًا.
لا تكتب كلمة Draft.
إذا كانت المشكلة غير واضحة، اسأل المستخدم عن التفاصيل.
اجعل ردك واضحًا ومفيدًا ومختصرًا.
`
        },
        {
          role: "user",
          content: text
        }
      ],

      temperature: 0.7,
      max_completion_tokens: 500
    });

    const answer =
      response.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      await message.reply(
        "❌ ما قدرت أطلع رد حاليًا."
      );
      return;
    }

    await message.reply({
      content: answer.slice(0, 1900),
      allowedMentions: {
        repliedUser: false
      }
    });

    console.log("🤖 AI: " + answer);

  } catch (error) {
    console.error("================================");
    console.error("❌ GROQ ERROR");
    console.error(error);
    console.error("================================");

    let reply = "❌ صار خطأ بالذكاء الاصطناعي.";

    if (error?.status === 401) {
      reply = "❌ مفتاح Groq غير صحيح.";
    }

    if (error?.status === 429) {
      reply = "⏳ وصلنا لحد الاستخدام، حاول بعد قليل.";
    }

    if (error?.status === 404) {
      reply = "❌ نموذج الذكاء الاصطناعي غير متاح لهذا المفتاح.";
    }

    if (error?.status === 503) {
      reply = "⏳ خدمة الذكاء الاصطناعي مشغولة حاليًا، حاول مرة ثانية.";
    }

    await message.reply(reply).catch(() => {});
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود!");
  process.exit(1);
}

if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY غير موجود!");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
