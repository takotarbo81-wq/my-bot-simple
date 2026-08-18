const {
  Client,
  GatewayIntentBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require("discord.js");

require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

// =============================
// Discord
// =============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// =============================
// Gemini
// =============================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// =============================
// إعدادات
// =============================

const ticketWords = [
  "ticket",
  "تكت",
  "ticket-",
];

const closeWords = [
  "اغلق",
  "أغلق",
  "اغلاق",
  "إغلاق",
  "سكر التكت",
  "سكر التذكرة",
  "اغلق التكت",
  "أغلق التكت",
  "اقفل التكت",
  "أقفل التكت",
  "close",
  "close ticket",
];

const staffWords = [
  "موظف",
  "موظفين",
  "دعم",
  "ادمن",
  "مشرف",
  "staff",
  "admin",
  "human",
];

// =============================
// معرفة هل القناة تكت
// =============================

function isTicket(channel) {
  if (!channel) return false;

  if (channel.type !== ChannelType.GuildText) {
    return false;
  }

  const name = channel.name.toLowerCase();

  return ticketWords.some((word) =>
    name.includes(word.toLowerCase())
  );
}

// =============================
// معرفة طلب الإغلاق
// =============================

function wantsClose(text) {
  const message = text.toLowerCase().trim();

  return closeWords.some((word) =>
    message.includes(word.toLowerCase())
  );
}

// =============================
// معرفة طلب موظف
// =============================

function wantsStaff(text) {
  const message = text.toLowerCase();

  return staffWords.some((word) =>
    message.includes(word.toLowerCase())
  );
}

// =============================
// البوت جاهز
// =============================

client.once("ready", () => {
  console.log("=================================");
  console.log(`✅ البوت شغال: ${client.user.tag}`);
  console.log("🤖 Gemini AI متصل");
  console.log("🎫 نظام التكتات جاهز");
  console.log("⭐ نظام التقييم جاهز");
  console.log("=================================");
});

// =============================
// الرسائل
// =============================

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    if (!message.guild) return;

    if (!isTicket(message.channel)) return;

    const content = message.content.trim();

    if (!content) return;

    // =============================
    // إغلاق التكت
    // =============================

    if (wantsClose(content)) {
      await message.channel.send(
        "🔒 سيتم إغلاق التكت الآن، شكرًا لتواصلك معنا ❤️"
      );

      await new Promise((resolve) =>
        setTimeout(resolve, 2000)
      );

      // قفل القناة على الجميع
      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: false,
        }
      );

      await message.channel.send(
        "⭐ **قبل إنهاء التذكرة، نقدر تقييمك؟**\nاختر تقييمك من 1 إلى 5:"
      );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("rating_1")
          .setLabel("⭐")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("rating_2")
          .setLabel("⭐⭐")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("rating_3")
          .setLabel("⭐⭐⭐")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("rating_4")
          .setLabel("⭐⭐⭐⭐")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("rating_5")
          .setLabel("⭐⭐⭐⭐⭐")
          .setStyle(ButtonStyle.Success)
      );

      await message.channel.send({
        components: [row],
      });

      return;
    }

    // =============================
    // طلب موظف
    // =============================

    if (wantsStaff(content)) {
      await message.channel.send(
        "👨‍💼 أكيد، سيتم تحويل طلبك للموظف المختص. يرجى الانتظار قليلًا."
      );

      return;
    }

    // =============================
    // Gemini
    // =============================

    await message.channel.sendTyping();

    // جلب آخر 15 رسالة
    const messages = await message.channel.messages.fetch({
      limit: 15,
    });

    const conversation = [...messages.values()]
      .reverse()
      .map((msg) => {
        const author = msg.author.bot
          ? "البوت"
          : msg.author.username;

        return `${author}: ${msg.content}`;
      })
      .join("\n");

    const prompt = `
أنت بوت دعم فني احترافي داخل Discord.

مهمتك:
1. افهم مشكلة العميل.
2. حاول حل المشكلة بنفسك.
3. أعطِ خطوات واضحة وسهلة.
4. لا تخترع معلومات غير موجودة.
5. إذا لم تعرف الحل، أخبر العميل أن الموظف المختص يستطيع مساعدته.
6. لا تقل أنك إنسان.
7. تكلم بالعربية.
8. كن محترمًا وودودًا.
9. لا تغلق التكت بنفسك.
10. لا تطلب من العميل كتابة "أغلق" إلا إذا كانت المشكلة انتهت.
11. اجعل ردك مختصرًا ومفيدًا.
12. إذا كانت المشكلة تحتاج صلاحيات موظف، اطلب تدخل الموظف.

محادثة التكت:

${conversation}

آخر رسالة من العميل:

${content}
`;

    const result = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const reply = result.text;

    if (!reply || !reply.trim()) {
      await message.channel.send(
        "❌ لم أتمكن من إنشاء رد حاليًا."
      );

      return;
    }

    // =============================
    // إرسال الرد
    // =============================

    if (reply.length <= 2000) {
      await message.channel.send(reply);
    } else {
      for (let i = 0; i < reply.length; i += 1900) {
        await message.channel.send(
          reply.substring(i, i + 1900)
        );
      }
    }

    console.log(
      `🤖 رد على ${message.author.tag}: ${reply.substring(
        0,
        100
      )}`
    );

  } catch (error) {
    console.error("❌ ERROR:");
    console.error(error);

    try {
      await message.channel.send(
        "❌ صار خطأ مؤقت في نظام الذكاء الاصطناعي. حاول مرة ثانية."
      );
    } catch {}
  }
});

// =============================
// التقييم
// =============================

client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isButton()) return;

    if (!interaction.customId.startsWith("rating_")) {
      return;
    }

    const rating = interaction.customId.replace(
      "rating_",
      ""
    );

    await interaction.reply({
      content: `❤️ شكرًا لك! تم تسجيل تقييمك: ${"⭐".repeat(
        Number(rating)
      )}`,
      ephemeral: true,
    });

    console.log(
      `⭐ تقييم ${rating}/5 من ${interaction.user.tag}`
    );

    // إزالة أزرار التقييم
    try {
      await interaction.message.edit({
        components: [],
      });
    } catch {}

    // حذف التكت بعد 5 ثواني
    setTimeout(async () => {
      try {
        await interaction.channel.delete(
          "Ticket closed after rating"
        );
      } catch (error) {
        console.log(
          "⚠️ لم أستطع حذف التكت:"
        );
      }
    }, 5000);

  } catch (error) {
    console.error("❌ Rating Error:", error);
  }
});

// =============================
// تسجيل الدخول
// =============================

client.login(process.env.DISCORD_TOKEN);
