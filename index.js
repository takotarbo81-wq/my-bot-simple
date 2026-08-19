require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");

const { GoogleGenAI } = require("@google/genai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// موديل سريع
const MODEL = "gemini-3.5-flash-lite";

// ==================================================
// هل القناة تكت؟
// ==================================================

function isTicket(channel) {
  if (!channel) return false;
  if (channel.type !== ChannelType.GuildText) return false;

  const name = channel.name.toLowerCase();

  return (
    name.startsWith("ticket-") ||
    name.startsWith("claimed-") ||
    name.includes("ticket") ||
    name.includes("تكت")
  );
}

// ==================================================
// تشغيل البوت
// ==================================================

client.once("ready", () => {
  console.log("================================");
  console.log(`✅ البوت شغال: ${client.user.tag}`);
  console.log(`🤖 Gemini: ${MODEL}`);
  console.log("🛡️ نظام الإدارة جاهز");
  console.log("🎫 نظام التكت جاهز");
  console.log("================================");
});

// ==================================================
// الرسائل
// ==================================================

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    const text = message.content.trim();

    if (!text) return;

    // ==================================================
    // أوامر الإدارة عن طريق منشن البوت
    // ==================================================

    if (message.mentions.has(client.user)) {

      const command = text
        .replace(
          new RegExp(`<@!?${client.user.id}>`, "g"),
          ""
        )
        .trim();

      // ==================================================
      // BAN
      // ==================================================

      if (/^(احظر|حظر|بان|ban)\b/i.test(command)) {

        // يجب أن يكون لدى المستخدم صلاحية Ban Members
        if (
          !message.member.permissions.has(
            PermissionsBitField.Flags.BanMembers
          )
        ) {
          return message.reply(
            "❌ ما عندك صلاحية حظر الأعضاء."
          );
        }

        const target =
          message.mentions.members.first();

        if (!target) {
          return message.reply(
            "❌ منشن الشخص الذي تريد حظره."
          );
        }

        if (target.id === message.author.id) {
          return message.reply(
            "❌ لا يمكنك حظر نفسك."
          );
        }

        // هل البوت يستطيع حظره؟
        if (!target.bannable) {
          return message.reply(
            "❌ لا أستطيع حظر هذا العضو. تأكد أن رتبة البوت أعلى من رتبته."
          );
        }

        await target.ban({
          reason: `By ${message.author.tag}`,
        });

        return message.reply(
          `🔨 تم حظر **${target.user.tag}** بنجاح.`
        );
      }

      // ==================================================
      // KICK
      // ==================================================

      if (/^(اطرد|طرد|kick)\b/i.test(command)) {

        if (
          !message.member.permissions.has(
            PermissionsBitField.Flags.KickMembers
          )
        ) {
          return message.reply(
            "❌ ما عندك صلاحية طرد الأعضاء."
          );
        }

        const target =
          message.mentions.members.first();

        if (!target) {
          return message.reply(
            "❌ منشن الشخص الذي تريد طرده."
          );
        }

        if (target.id === message.author.id) {
          return message.reply(
            "❌ لا يمكنك طرد نفسك."
          );
        }

        if (!target.kickable) {
          return message.reply(
            "❌ لا أستطيع طرد هذا العضو. تأكد أن رتبة البوت أعلى من رتبته."
          );
        }

        await target.kick(
          `By ${message.author.tag}`
        );

        return message.reply(
          `👢 تم طرد **${target.user.tag}** بنجاح.`
        );
      }

      // ==================================================
      // TIMEOUT
      // ==================================================

      if (
        /^(timeout|تايم|تايم اوت|تايم أوت|اسكت)\b/i.test(
          command
        )
      ) {

        if (
          !message.member.permissions.has(
            PermissionsBitField.Flags.ModerateMembers
          )
        ) {
          return message.reply(
            "❌ ما عندك صلاحية Timeout."
          );
        }

        const target =
          message.mentions.members.first();

        if (!target) {
          return message.reply(
            "❌ منشن الشخص."
          );
        }

        if (!target.moderatable) {
          return message.reply(
            "❌ لا أستطيع إعطاء Timeout لهذا العضو."
          );
        }

        // 10 دقائق
        await target.timeout(
          10 * 60 * 1000,
          `By ${message.author.tag}`
        );

        return message.reply(
          `⏱️ تم إعطاء **${target.user.tag}** Timeout لمدة 10 دقائق.`
        );
      }

      return;
    }

    // ==================================================
    // التكت
    // ==================================================

    if (!isTicket(message.channel)) return;

    // ==================================================
    // إغلاق التكت
    // ==================================================

    const lower = text.toLowerCase();

    const closeWords = [
      "اغلق",
      "أغلق",
      "اغلاق",
      "إغلاق",
      "اقفل",
      "أقفل",
      "سكر التكت",
      "close",
      "close ticket",
    ];

    const wantsClose =
      closeWords.some((word) =>
        lower === word ||
        lower.includes(word)
      );

    if (wantsClose) {

      // لازم Manage Channels
      if (
        !message.member.permissions.has(
          PermissionsBitField.Flags.ManageChannels
        )
      ) {
        return message.reply(
          "❌ ما عندك صلاحية إغلاق التكت."
        );
      }

      await message.reply(
        "🔒 سيتم إغلاق التكت خلال 3 ثواني..."
      );

      setTimeout(async () => {
        try {

          await message.channel.delete(
            "Ticket closed"
          );

        } catch (error) {
          console.error(
            "❌ خطأ إغلاق التكت:",
            error
          );
        }
      }, 3000);

      return;
    }

    // ==================================================
    // Gemini AI
    // ==================================================

    await message.channel.sendTyping();

    const prompt = `
أنت بوت دعم فني احترافي داخل Discord.

اسمك TicketAI.

مهمتك:
- ساعد العميل في حل مشكلته.
- تحدث باللغة العربية الطبيعية.
- افهم اللهجة الأردنية والعربية العامية.
- كن محترمًا وودودًا.
- إذا قال العميل مرحبا، رحب به واسأله كيف تستطيع مساعدته.
- إذا شرح مشكلة، حاول حلها خطوة بخطوة.
- اجعل الرد مختصرًا وواضحًا.
- لا تكرر الكلام.
- لا تتكلم عن البرمجة أو API أو prompt.
- لا تذكر أنك Gemini.
- لا تطلب كلمات مرور أو Tokens أو API Keys.
- لا تنفذ أوامر الإدارة.
- لا تحظر أو تطرد أي شخص بنفسك.
- إذا احتاج العميل موظفًا، قل له إن موظف الدعم يستطيع مساعدته.
- لا تغلق التكت بنفسك.

رسالة العميل:
${text}

اكتب الرد مباشرة بدون شرح للتعليمات.
`;

    const result =
      await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          maxOutputTokens: 250,
        },
      });

    const answer =
      result.text?.trim();

    if (!answer) {
      return;
    }

    await message.reply({
      content: answer.slice(0, 1900),
      allowedMentions: {
        repliedUser: false,
      },
    });

  } catch (error) {

    console.error("================================");
    console.error("❌ ERROR:");
    console.error(error?.message || error);
    console.error("================================");

    let errorMessage =
      "❌ صار خطأ مؤقت، حاول مرة ثانية.";

    const errorText =
      String(error?.message || error);

    if (
      errorText.includes("429") ||
      errorText.toLowerCase().includes("quota")
    ) {
      errorMessage =
        "⏳ Gemini وصل لحد الاستخدام حاليًا، حاول بعد قليل.";
    }

    if (
      errorText.includes("401") ||
      errorText.includes("403") ||
      errorText.toLowerCase().includes("api key")
    ) {
      errorMessage =
        "❌ مفتاح Gemini غير صحيح أو غير مفعّل.";
    }

    try {
      await message.reply({
        content: errorMessage,
        allowedMentions: {
          repliedUser: false,
        },
      });
    } catch {}
  }
});

// ==================================================
// فحص المتغيرات
// ==================================================

if (!process.env.DISCORD_TOKEN) {
  console.error(
    "❌ DISCORD_TOKEN غير موجود في Railway Variables"
  );
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "❌ GEMINI_API_KEY غير موجود في Railway Variables"
  );
  process.exit(1);
}

// ==================================================
// Login
// ==================================================

client.login(
  process.env.DISCORD_TOKEN
);
