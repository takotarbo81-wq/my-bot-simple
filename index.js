require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const { GoogleGenAI } = require("@google/genai");

// =========================
// الإعدادات
// =========================

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

const MODEL = "gemini-3.6-flash";

// كلمات إغلاق التكت
const CLOSE_WORDS = [
  "اغلق",
  "إغلاق",
  "اغلاق",
  "سكر التكت",
  "سكر التكت",
  "close",
  "close ticket",
  "اقفل",
  "إقفل"
];

// =========================
// تشغيل البوت
// =========================

client.once("ready", () => {
  console.log(`✅ البوت اشتغل: ${client.user.tag}`);
  console.log(`🤖 Gemini: ${MODEL}`);
});

// =========================
// الرسائل
// =========================

client.on("messageCreate", async (message) => {
  try {
    // تجاهل البوتات
    if (message.author.bot) return;

    // لازم يكون داخل سيرفر
    if (!message.guild) return;

    // =========================
    // إغلاق التكت
    // =========================

    const text = message.content.trim().toLowerCase();

    const wantsClose = CLOSE_WORDS.some(word =>
      text === word ||
      text.includes(word)
    );

    if (
      wantsClose &&
      message.channel.type === ChannelType.GuildText &&
      (
        message.channel.name.startsWith("ticket-") ||
        message.channel.name.startsWith("claimed-") ||
        message.channel.name.includes("ticket")
      )
    ) {
      // لازم المستخدم يكون عنده Manage Channels
      if (
        message.member.permissions.has(
          PermissionsBitField.Flags.ManageChannels
        )
      ) {
        await message.reply("🔒 سيتم إغلاق التكت خلال 3 ثواني...");

        setTimeout(async () => {
          try {
            await message.channel.delete(
              "Ticket closed by authorized staff"
            );
          } catch (err) {
            console.error("خطأ في إغلاق التكت:", err);
          }
        }, 3000);

        return;
      } else {
        await message.reply(
          "❌ ما عندك صلاحية إغلاق التكت."
        );

        return;
      }
    }

    // =========================
    // الرد فقط داخل التكت
    // =========================

    const isTicket =
      message.channel.name.startsWith("ticket-") ||
      message.channel.name.startsWith("claimed-") ||
      message.channel.name.includes("ticket");

    if (!isTicket) return;

    // تجاهل الرسائل الفارغة
    if (!message.content.trim()) return;

    // =========================
    // مؤشر الكتابة
    // =========================

    await message.channel.sendTyping();

    // =========================
    // طلب Gemini
    // =========================

    const prompt = `
أنت بوت دعم فني احترافي داخل Discord.

اسمك: TicketAI

مهمتك:
- ساعد المستخدم في حل مشكلته.
- تكلم بالعربية بشكل واضح وبسيط.
- إذا المستخدم كتب "مرحبا" رد عليه بشكل طبيعي.
- لا تخترع معلومات غير مؤكدة.
- إذا المشكلة تحتاج تدخل موظف، قل له أن أحد أعضاء الدعم سيتابع معه.
- لا تغلق التكت بنفسك.
- لا تطرد أو تحظر أي شخص.
- لا تنفذ أوامر Discord من خلال الذكاء الاصطناعي.
- اجعل الرد مختصر وسريع.
- لا تقل إنك Gemini.
- لا تذكر تفاصيل البرمجة.

رسالة المستخدم:
${message.content}
`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0.5,
        maxOutputTokens: 300
      }
    });

    const answer = response.text?.trim();

    // =========================
    // إرسال الرد
    // =========================

    if (!answer) {
      await message.reply(
        "❌ ما قدرت أجهز رد حاليًا، حاول مرة ثانية."
      );
      return;
    }

    await message.reply({
      content: answer.slice(0, 1900),
      allowedMentions: {
        repliedUser: false
      }
    });

  } catch (error) {
    console.error("❌ Gemini Error:", error);

    let errorMessage =
      "❌ صار خطأ مؤقت بالذكاء الاصطناعي، حاول مرة ثانية.";

    if (
      error.message &&
      (
        error.message.includes("API key") ||
        error.message.includes("401") ||
        error.message.includes("403")
      )
    ) {
      errorMessage =
        "❌ مفتاح Gemini غير صحيح أو غير مفعّل.";
    }

    if (
      error.message &&
      (
        error.message.includes("429") ||
        error.message.toLowerCase().includes("quota")
      )
    ) {
      errorMessage =
        "⏳ تم الوصول إلى حد استخدام Gemini، حاول لاحقًا.";
    }

    try {
      await message.reply(errorMessage);
    } catch {}
  }
});

// =========================
// أخطاء عامة
// =========================

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

// =========================
// تسجيل الدخول
// =========================

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود في Variables");
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY غير موجود في Variables");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
