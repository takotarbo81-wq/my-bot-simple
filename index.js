const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

// ==================================================
// الإعدادات
// ==================================================

// ID رتبة الإدارة
const ADMIN_ROLE_ID = "ضع_ID_رتبة_الإدارة_هنا";

// اسم البوت
const BOT_NAME = "بوت دعم";

// ==================================================
// Gemini
// ==================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// ==================================================
// Discord
// ==================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==================================================
// تعليمات Gemini
// ==================================================

const SYSTEM_PROMPT = `
أنت بوت دعم فني احترافي داخل Discord.

قواعدك:
- رد باللغة العربية.
- كن محترمًا وودودًا.
- افهم مشكلة العميل قبل الإجابة.
- أعطِ الحل مباشرة وباختصار.
- لا تكرر الكلام.
- إذا كانت المشكلة تحتاج تدخل موظف قل له ذلك.
- لا تطلب كلمة مرور.
- لا تطلب Discord Token.
- لا تطلب API Key.
- لا تخترع معلومات غير متأكد منها.
- لا تغلق التكت بنفسك.
- لا تنفذ أوامر الإدارة.
- أوامر الإدارة يتم تنفيذها فقط بواسطة النظام البرمجي.
`;

// ==================================================
// التحقق من رتبة الإدارة
// ==================================================

function isAdmin(member) {
  if (!member) return false;

  // Administrator دائمًا مسموح
  if (
    member.permissions.has(
      PermissionsBitField.Flags.Administrator
    )
  ) {
    return true;
  }

  // رتبة الإدارة
  if (
    ADMIN_ROLE_ID &&
    ADMIN_ROLE_ID !== "ضع_ID_رتبة_الإدارة_هنا"
  ) {
    return member.roles.cache.has(ADMIN_ROLE_ID);
  }

  return false;
}

// ==================================================
// هل هذه قناة تكت؟
// ==================================================

function isTicket(channel) {
  if (!channel) return false;

  if (channel.type !== ChannelType.GuildText) {
    return false;
  }

  const name = channel.name.toLowerCase();

  return (
    name.startsWith("ticket-") ||
    name.startsWith("claimed-") ||
    name.includes("ticket") ||
    name.includes("تكت")
  );
}

// ==================================================
// جاهزية البوت
// ==================================================

client.once("ready", () => {
  console.log("================================");
  console.log(`✅ ${BOT_NAME} شغال`);
  console.log(`🤖 ${client.user.tag}`);
  console.log("🧠 Gemini جاهز");
  console.log("🎫 نظام التكت جاهز");
  console.log("🛡️ نظام الإدارة جاهز");
  console.log("⭐ نظام التقييم جاهز");
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

      // ----------------------------------------------
      // منع غير الإدارة
      // ----------------------------------------------

      if (!isAdmin(message.member)) {

        if (
          /اطرد|طرد|احظر|حظر|بان|ban|kick|timeout|تايم|رتبة|اعطي|أعطي|شيل/i
            .test(command)
        ) {
          return message.reply(
            "❌ هذا الأمر مخصص لأعضاء الإدارة فقط."
          );
        }

        // إذا مجرد سؤال عادي للذكاء الاصطناعي
        return;
      }

      // ==================================================
      // طرد عضو
      // ==================================================

      if (/^(اطرد|طرد|kick)\b/i.test(command)) {

        const member =
          message.mentions.members.first();

        if (!member) {
          return message.reply(
            "❌ منشن الشخص الذي تريد طرده."
          );
        }

        if (member.id === message.author.id) {
          return message.reply(
            "❌ لا يمكنك طرد نفسك."
          );
        }

        if (!member.kickable) {
          return message.reply(
            "❌ لا أستطيع طرد هذا الشخص. تأكد أن رتبة البوت أعلى من رتبته."
          );
        }

        await member.kick(
          `By ${message.author.tag}`
        );

        return message.reply(
          `👢 تم طرد ${member.user.tag}.`
        );
      }

      // ==================================================
      // حظر عضو
      // ==================================================

      if (/^(احظر|حظر|بان|ban)\b/i.test(command)) {

        const member =
          message.mentions.members.first();

        if (!member) {
          return message.reply(
            "❌ منشن الشخص الذي تريد حظره."
          );
        }

        if (member.id === message.author.id) {
          return message.reply(
            "❌ لا يمكنك حظر نفسك."
          );
        }

        if (!member.bannable) {
          return message.reply(
            "❌ لا أستطيع حظر هذا الشخص. تأكد أن رتبة البوت أعلى من رتبته."
          );
        }

        await member.ban({
          reason: `By ${message.author.tag}`
        });

        return message.reply(
          `🔨 تم حظر ${member.user.tag}.`
        );
      }

      // ==================================================
      // Timeout
      // ==================================================

      if (
        /^(timeout|تايم|تايم اوت|تايم أوت|اسكت)\b/i
          .test(command)
      ) {

        const member =
          message.mentions.members.first();

        if (!member) {
          return message.reply(
            "❌ منشن الشخص."
          );
        }

        if (!member.moderatable) {
          return message.reply(
            "❌ لا أستطيع إعطاء Timeout لهذا الشخص."
          );
        }

        await member.timeout(
          10 * 60 * 1000,
          `By ${message.author.tag}`
        );

        return message.reply(
          `⏱️ تم إعطاء ${member.user.tag} Timeout لمدة 10 دقائق.`
        );
      }

      // ==================================================
      // إعطاء رتبة
      // ==================================================

      if (
        /^(اعطي|أعطي|اعط|أعط|role|رتبة)\b/i
          .test(command)
      ) {

        const member =
          message.mentions.members.first();

        const role =
          message.mentions.roles.first();

        if (!member || !role) {
          return message.reply(
            "❌ الاستخدام:\n@البوت اعطي @الشخص @الرتبة"
          );
        }

        if (
          role.position >=
          message.guild.members.me.roles.highest.position
        ) {
          return message.reply(
            "❌ رتبة البوت يجب أن تكون أعلى من الرتبة المطلوبة."
          );
        }

        await member.roles.add(role);

        return message.reply(
          `🎭 تم إعطاء ${member.user.tag} رتبة **${role.name}**.`
        );
      }

      // ==================================================
      // إزالة رتبة
      // ==================================================

      if (
        /^(شيل|ازيل|أزيل|إزالة|remove)\b/i
          .test(command)
      ) {

        const member =
          message.mentions.members.first();

        const role =
          message.mentions.roles.first();

        if (!member || !role) {
          return message.reply(
            "❌ الاستخدام:\n@البوت شيل @الشخص @الرتبة"
          );
        }

        await member.roles.remove(role);

        return message.reply(
          `🗑️ تمت إزالة رتبة **${role.name}** من ${member.user.tag}.`
        );
      }

      // ==================================================
      // حذف رسائل
      // ==================================================

      const clear =
        command.match(
          /^(امسح|مسح|clear)\s+(\d+)/i
        );

      if (clear) {

        const amount =
          Number(clear[2]);

        if (amount < 1 || amount > 100) {
          return message.reply(
            "❌ العدد يجب أن يكون بين 1 و100."
          );
        }

        const deleted =
          await message.channel.bulkDelete(
            amount,
            true
          );

        return message.channel.send(
          `🧹 تم حذف ${deleted.size} رسالة.`
        );
      }

      return;
    }

    // ==================================================
    // التكت فقط
    // ==================================================

    if (!isTicket(message.channel)) {
      return;
    }

    // ==================================================
    // إغلاق التكت
    // ==================================================

    const close =
      /^(اغلق|أغلق|اقفل|أقفل|سكر|close)\s*(التكت|التذكرة|ticket)?$/i
        .test(text);

    if (close) {

      await message.channel.send(
        "🔒 سيتم إغلاق التكت خلال 3 ثواني..."
      );

      setTimeout(async () => {

        try {

          const row =
            new ActionRowBuilder()
              .addComponents(

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
            embeds: [
              new EmbedBuilder()
                .setTitle("⭐ تقييم الدعم")
                .setDescription(
                  "قيّم تجربتك معنا من 1 إلى 5 نجوم."
                )
            ],
            components: [row]
          });

        } catch (err) {
          console.error(
            "Close error:",
            err
          );
        }

      }, 3000);

      return;
    }

    // ==================================================
    // Gemini
    // ==================================================

    await message.channel.sendTyping();

    // آخر رسائل التكت
    const messages =
      await message.channel.messages.fetch({
        limit: 8
      });

    const history =
      [...messages.values()]
        .reverse()
        .map((msg) => {
          return `${msg.author.username}: ${msg.content}`;
        })
        .join("\n");

    const prompt = `
${SYSTEM_PROMPT}

محادثة التكت:
${history}

آخر رسالة من العميل:
${text}

اكتب الرد الذي يجب إرساله للعميل مباشرة.
`;

    console.log(
      `🧠 Gemini request from ${message.author.tag}`
    );

    const response =
      await ai.models.generateContent({

        model: "gemini-3.6-flash",

        contents: prompt,

        config: {
          maxOutputTokens: 300
        }

      });

    const answer =
      response.text?.trim();

    if (!answer) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    // Discord يسمح بـ 2000 حرف
    if (answer.length <= 2000) {

      await message.channel.send(answer);

    } else {

      for (
        let i = 0;
        i < answer.length;
        i += 1900
      ) {
        await message.channel.send(
          answer.substring(
            i,
            i + 1900
          )
        );
      }
    }

  } catch (error) {

    console.error(
      "================================"
    );

    console.error(
      "❌ ERROR:"
    );

    console.error(
      error?.message || error
    );

    console.error(
      "================================"
    );

    try {
      await message.channel.send(
        "❌ صار خطأ أثناء الاتصال بالذكاء الاصطناعي."
      );
    } catch {}
  }
});

// ==================================================
// التقييم
// ==================================================

client.on(
  "interactionCreate",
  async (interaction) => {

    if (!interaction.isButton()) {
      return;
    }

    if (
      !interaction.customId.startsWith(
        "rating_"
      )
    ) {
      return;
    }

    const rating =
      Number(
        interaction.customId.replace(
          "rating_",
          ""
        )
      );

    await interaction.reply({
      content:
        `❤️ شكرًا لك! تم تسجيل تقييمك ${"⭐".repeat(rating)}`,
      ephemeral: true
    });

    // حذف التكت بعد 5 ثواني
    setTimeout(async () => {

      try {
        await interaction.channel.delete(
          "Ticket closed after rating"
        );
      } catch (err) {
        console.error(
          "Delete ticket error:",
          err.message
        );
      }

    }, 5000);
  }
);

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
