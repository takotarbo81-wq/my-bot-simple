require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField
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

const MODEL = "openai/gpt-oss-20b";

// ===============================
// تشغيل البوت
// ===============================

client.once("ready", () => {
  console.log("================================");
  console.log("🤖 TicketAI Online");
  console.log("🧠 Model: " + MODEL);
  console.log("⚡ Groq Connected");
  console.log("================================");
});

// ===============================
// رسالة المستخدم
// ===============================

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const text = message.content.trim();

  if (!text) return;

  console.log(
    "📩 " + message.author.username + ": " + text
  );

  try {
    // إظهار أن البوت يكتب
    await message.channel.sendTyping().catch(() => {});

    // ===============================
    // الذكاء الاصطناعي
    // ===============================

    const response = await groq.chat.completions.create({
      model: MODEL,

      messages: [
        {
          role: "system",

          content: `
أنت TicketAI، مساعد دعم فني ذكي داخل Discord.

أنت تفهم Discord بشكل جيد، مثل:
- السيرفرات
- التذاكر
- القنوات
- الرتب
- الصلاحيات
- مشاكل الدخول
- مشاكل البوتات
- مشاكل Discord العامة

تحدث بالعربية بشكل طبيعي.
افهم اللهجة الأردنية والعربية العامية.

إذا المستخدم عنده مشكلة:
- افهم المشكلة أولًا.
- أعطه الحل بشكل واضح ومختصر.
- إذا كانت المشكلة تحتاج صورة، اطلب منه إرسال صورة للشاشة.
- إذا لم تفهم المشكلة، اسأل سؤالًا واضحًا.
- لا تكرر نفس الرد.
- لا تبدأ كل رد بـ "أهلاً بك".
- لا تقل "أنا مجرد بوت".
- لا تكتب Draft.
- لا تخترع معلومات.
- لا تدعي أنك نفذت إجراءً لم تنفذه.

إذا المستخدم سب أو تكلم بطريقة سيئة:
- لا تسبه.
- لا تعصب عليه.
- رد بهدوء وحاول مساعدته.

أنت مساعد تذاكر، لذلك ركز على حل مشكلة المستخدم.
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

    // ===============================
    // إرسال الرد
    // ===============================

    await message.reply({
      content: answer.slice(0, 1900),

      allowedMentions: {
        repliedUser: false
      }
    });

    console.log("🤖 AI: " + answer);

    // ===============================
    // تغيير اسم التكت
    // ===============================

    await renameTicket(message, text);

  } catch (error) {

    console.error("================================");
    console.error("❌ GROQ ERROR");
    console.error(error);
    console.error("================================");

    let reply =
      "❌ صار خطأ مؤقت بالذكاء الاصطناعي.";

    if (error?.status === 401) {
      reply =
        "❌ مفتاح Groq غير صحيح.";
    }

    if (error?.status === 429) {
      reply =
        "⏳ وصلنا لحد الاستخدام، حاول بعد قليل.";
    }

    if (error?.status === 404) {
      reply =
        "❌ نموذج الذكاء الاصطناعي غير متاح.";
    }

    if (error?.status === 503) {
      reply =
        "⏳ خدمة الذكاء الاصطناعي مشغولة حاليًا.";
    }

    await message.reply(reply).catch(() => {});
  }
});

// ===============================
// تغيير اسم التكت
// ===============================

async function renameTicket(message, userText) {

  const channel = message.channel;

  // نتأكد أن القناة تكت
  if (!channel.isTextBased()) return;

  if (!channel.name.startsWith("ticket-")) {
    return;
  }

  // التأكد من صلاحية البوت
  const me = message.guild.members.me;

  if (!me) return;

  if (
    !me.permissions.has(
      PermissionsBitField.Flags.ManageChannels
    )
  ) {
    console.log(
      "⚠️ البوت لا يملك ManageChannels"
    );
    return;
  }

  try {

    // نطلب من AI اسم قصير للتكت
    const nameResponse =
      await groq.chat.completions.create({
        model: MODEL,

        messages: [
          {
            role: "system",

            content: `
حوّل مشكلة المستخدم إلى اسم قناة Discord قصير جدًا.

القواعد:
- بالعربي.
- من 2 إلى 4 كلمات فقط.
- بدون رموز غريبة.
- بدون @.
- بدون #.
- بدون مسافات، استخدم -
- لا تكتب ticket.
- لا تكتب شرح.
- أعطني اسم القناة فقط.

مثال:
"ما بقدر أدخل حسابي"

النتيجة:
مشكلة-تسجيل-الدخول
`
          },

          {
            role: "user",
            content: userText
          }
        ],

        temperature: 0.2,
        max_completion_tokens: 50
      });

    let newName =
      nameResponse.choices?.[0]?.message?.content
        ?.trim()
        .toLowerCase();

    if (!newName) return;

    // تنظيف الاسم
    newName = newName
      .replace(/```/g, "")
      .replace(/`/g, "")
      .replace(/#/g, "")
      .replace(/@/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9\u0600-\u06FF-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!newName) return;

    // Discord يسمح باسم قناة حتى 100 حرف
    newName = newName.substring(0, 90);

    // إذا الاسم نفسه لا نغيره
    if (channel.name === newName) return;

    await channel.setName(newName);

    console.log(
      "✏️ Ticket renamed to: " + newName
    );

  } catch (error) {

    console.error(
      "❌ Ticket rename error:",
      error.message
    );
  }
}

// ===============================
// التحقق من المفاتيح
// ===============================

if (!process.env.DISCORD_TOKEN) {

  console.error(
    "❌ DISCORD_TOKEN غير موجود!"
  );

  process.exit(1);
}

if (!process.env.GROQ_API_KEY) {

  console.error(
    "❌ GROQ_API_KEY غير موجود!"
  );

  process.exit(1);
}

// ===============================
// تسجيل الدخول
// ===============================

client.login(
  process.env.DISCORD_TOKEN
);
