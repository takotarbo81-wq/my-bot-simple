const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
require("dotenv").config();

// =====================================================
// الإعدادات
// =====================================================

// حط ID رتبة الإدارة هنا
const ADMIN_ROLE_ID = "1538954905488851016";

// اختياري - ID قناة اللوج
const LOG_CHANNEL_ID = "";

// =====================================================
// Gemini
// =====================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// =====================================================
// Discord
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =====================================================
// إعدادات الذكاء الاصطناعي
// =====================================================

const AI_PROMPT = `
أنت بوت دعم فني احترافي داخل Discord.

مهمتك:
- مساعدة العميل داخل التكت.
- فهم المشكلة بسرعة.
- إعطاء حل واضح ومباشر.
- الرد باللغة العربية.
- كن محترمًا وودودًا.
- لا تطول الرد بدون سبب.
- لا تكرر الكلام.
- إذا لم تعرف الحل قل للعميل أن الموظف المختص سيساعده.
- لا تطلب كلمة مرور أو Token أو API Key.
- لا تغلق التكت بنفسك.
- لا تنفذ أوامر الإدارة من خلال Gemini.
`;

// =====================================================
// معرفة هل القناة تكت
// =====================================================

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

// =====================================================
// صلاحية الإدارة
// =====================================================

function isAdmin(member) {
  if (!member) return false;

  if (
    ADMIN_ROLE_ID &&
    ADMIN_ROLE_ID !== "ضع_هنا_ID_الرتبة"
  ) {
    return member.roles.cache.has(ADMIN_ROLE_ID);
  }

  return member.permissions.has(
    PermissionsBitField.Flags.Administrator
  );
}

// =====================================================
// اللوج
// =====================================================

async function sendLog(guild, text) {
  if (!LOG_CHANNEL_ID) return;

  try {
    const channel =
      guild.channels.cache.get(LOG_CHANNEL_ID);

    if (channel) {
      await channel.send(text);
    }
  } catch (err) {
    console.log("Log Error:", err.message);
  }
}

// =====================================================
// تشغيل البوت
// =====================================================

client.once("ready", async () => {
  console.log("================================");
  console.log(`✅ البوت شغال: ${client.user.tag}`);
  console.log("🤖 Gemini جاهز");
  console.log("🎫 نظام التكت جاهز");
  console.log("🛡️ نظام الإدارة جاهز");
  console.log("⭐ نظام التقييم جاهز");
  console.log("================================");

  // Slash Commands
  const commands = [

    new SlashCommandBuilder()
      .setName("promot")
      .setDescription("تغيير تعليمات الذكاء الاصطناعي")
      .addStringOption(option =>
        option
          .setName("text")
          .setDescription("التعليمات الجديدة")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("promot-view")
      .setDescription("عرض تعليمات الذكاء الاصطناعي"),

    new SlashCommandBuilder()
      .setName("promot-reset")
      .setDescription("إرجاع تعليمات الذكاء الاصطناعي الافتراضية")

  ].map(command => command.toJSON());

  try {
    const rest = new REST({
      version: "10"
    }).setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      {
        body: commands
      }
    );

    console.log("✅ Slash Commands جاهزة");

  } catch (err) {
    console.error(
      "❌ Slash Commands Error:",
      err.message
    );
  }
});

// =====================================================
// Slash Commands
// =====================================================

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) {
    return;
  }

  // /promot
  if (interaction.commandName === "promot") {

    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: "❌ ما عندك صلاحية.",
        ephemeral: true
      });
    }

    const text =
      interaction.options.getString("text");

    try {
      fs.writeFileSync(
        "prompt.txt",
        text,
        "utf8"
      );

      await interaction.reply({
        content: "✅ تم تحديث تعليمات Gemini.",
        ephemeral: true
      });

    } catch (err) {
      await interaction.reply({
        content: "❌ فشل حفظ التعليمات.",
        ephemeral: true
      });
    }

    return;
  }

  // /promot-view
  if (
    interaction.commandName === "promot-view"
  ) {

    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: "❌ ما عندك صلاحية.",
        ephemeral: true
      });
    }

    let prompt = AI_PROMPT;

    try {
      if (fs.existsSync("prompt.txt")) {
        prompt = fs.readFileSync(
          "prompt.txt",
          "utf8"
        );
      }
    } catch {}

    return interaction.reply({
      content:
        "```text\n" +
        prompt.substring(0, 1900) +
        "\n```",
      ephemeral: true
    });
  }

  // /promot-reset
  if (
    interaction.commandName === "promot-reset"
  ) {

    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: "❌ ما عندك صلاحية.",
        ephemeral: true
      });
    }

    try {
      if (fs.existsSync("prompt.txt")) {
        fs.unlinkSync("prompt.txt");
      }
    } catch {}

    return interaction.reply({
      content:
        "✅ تم إرجاع تعليمات Gemini الافتراضية.",
      ephemeral: true
    });
  }
});

// =====================================================
// الأوامر عن طريق منشن البوت
// =====================================================

client.on("messageCreate", async message => {

  try {

    if (message.author.bot) return;
    if (!message.guild) return;

    const content =
      message.content.trim();

    if (!content) return;

    // =================================================
    // أوامر الإدارة عند منشن البوت
    // =================================================

    if (message.mentions.has(client.user)) {

      const command =
        content
          .replace(
            new RegExp(
              `<@!?${client.user.id}>`,
              "g"
            ),
            ""
          )
          .trim();

      // -----------------------------------------------
      // تحقق من الرتبة
      // -----------------------------------------------

      if (!isAdmin(message.member)) {

        if (
          /اطرد|طرد|احظر|حظر|ban|kick|timeout|رتبة|اعطي/i
            .test(command)
        ) {
          await message.reply(
            "❌ هذا الأمر مخصص للإدارة فقط."
          );
        }

        return;
      }

      // =================================================
      // KICK
      // =================================================

      if (
        /^(اطرد|طرد|kick)\b/i.test(command)
      ) {

        const target =
          message.mentions.members.first();

        if (!target) {
          return message.reply(
            "❌ اعمل منشن للشخص."
          );
        }

        if (!target.kickable) {
          return message.reply(
            "❌ لا أستطيع طرد هذا الشخص. تأكد أن رتبة البوت أعلى منه."
          );
        }

        await target.kick(
          `By ${message.author.tag}`
        );

        await message.reply(
          `👢 تم طرد ${target.user.tag}.`
        );

        await sendLog(
          message.guild,
          `👢 طرد\nالمنفذ: ${message.author}\nالعضو: ${target.user.tag}`
        );

        return;
      }

      // =================================================
      // BAN
      // =================================================

      if (
        /^(احظر|حظر|ban)\b/i.test(command)
      ) {

        const target =
          message.mentions.members.first();

        if (!target) {
          return message.reply(
            "❌ اعمل منشن للشخص."
          );
        }

        if (!target.bannable) {
          return message.reply(
            "❌ لا أستطيع حظر هذا الشخص. تأكد أن رتبة البوت أعلى منه."
          );
        }

        await target.ban({
          reason:
            `By ${message.author.tag}`
        });

        await message.reply(
          `🔨 تم حظر ${target.user.tag}.`
        );

        await sendLog(
          message.guild,
          `🔨 حظر\nالمنفذ: ${message.author}\nالعضو: ${target.user.tag}`
        );

        return;
      }

      // =================================================
      // TIMEOUT
      // =================================================

      if (
        /timeout|تايم اوت|تايم أوت|اسكت/i
          .test(command)
      ) {

        const target =
          message.mentions.members.first();

        if (!target) {
          return message.reply(
            "❌ اعمل منشن للشخص."
          );
        }

        if (!target.moderatable) {
          return message.reply(
            "❌ لا أستطيع إعطاء Timeout لهذا الشخص."
          );
        }

        await target.timeout(
          10 * 60 * 1000,
          `By ${message.author.tag}`
        );

        await message.reply(
          `⏱️ تم إعطاء ${target.user.tag} Timeout لمدة 10 دقائق.`
        );

        await sendLog(
          message.guild,
          `⏱️ Timeout\nالمنفذ: ${message.author}\nالعضو: ${target.user.tag}`
        );

        return;
      }

      // =================================================
      // إعطاء رتبة
      // =================================================

      if (
        /^(اعطي|أعطي|اعط|أعط|رتبة|role)\b/i
          .test(command)
      ) {

        const target =
          message.mentions.members.first();

        const role =
          message.mentions.roles.first();

        if (!target || !role) {
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

        await target.roles.add(role);

        await message.reply(
          `🎭 تم إعطاء ${target.user} رتبة ${role}.`
        );

        await sendLog(
          message.guild,
          `🎭 إعطاء رتبة\nالمنفذ: ${message.author}\nالعضو: ${target.user.tag}\nالرتبة: ${role.name}`
        );

        return;
      }

      // =================================================
      // إزالة رتبة
      // =================================================

      if (
        /^(شيل|ازيل|إزالة|احذف رتبة|remove role)\b/i
          .test(command)
      ) {

        const target =
          message.mentions.members.first();

        const role =
          message.mentions.roles.first();

        if (!target || !role) {
          return message.reply(
            "❌ الاستخدام:\n@البوت شيل @الشخص @الرتبة"
          );
        }

        await target.roles.remove(role);

        await message.reply(
          `🗑️ تم إزالة رتبة ${role} من ${target.user}.`
        );

        return;
      }

      // =================================================
      // حذف رسائل
      // =================================================

      const clearMatch =
        command.match(
          /^(امسح|مسح|clear)\s+(\d+)/i
        );

      if (clearMatch) {

        const amount =
          Number(clearMatch[2]);

        if (
          amount < 1 ||
          amount > 100
        ) {
          return message.reply(
            "❌ العدد من 1 إلى 100."
          );
        }

        const deleted =
          await message.channel.bulkDelete(
            amount,
            true
          );

        await message.channel.send(
          `🧹 تم حذف ${deleted.size} رسالة.`
        );

        return;
      }

      return;
    }

    // =================================================
    // نظام التكت
    // =================================================

    if (!isTicket(message.channel)) {
      return;
    }

    // =================================================
    // إغلاق التكت
    // =================================================

    const lower =
      content.toLowerCase();

    const closeWords = [
      "اغلق التكت",
      "أغلق التكت",
      "اقفل التكت",
      "أقفل التكت",
      "سكر التكت",
      "اغلاق التكت",
      "إغلاق التكت",
      "close ticket"
    ];

    const wantsClose =
      closeWords.some(word =>
        lower.includes(
          word.toLowerCase()
        )
      );

    if (wantsClose) {

      await message.channel.send(
        "🔒 سيتم إغلاق التكت خلال 3 ثواني..."
      );

      setTimeout(async () => {

        try {

          await message.channel.permissionOverwrites.edit(
            message.guild.roles.everyone,
            {
              SendMessages: false
            }
          );

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
            content:
              "⭐ **قيّم تجربتك معنا من 1 إلى 5:**",
            components: [row]
          });

        } catch (err) {

          console.error(
            "Close Error:",
            err
          );

        }

      }, 3000);

      return;
    }

    // =================================================
    // Gemini
    // =================================================

    await message.channel.sendTyping();

    // نجيب آخر 5 رسائل فقط للسرعة
    const messages =
      await message.channel.messages.fetch({
        limit: 5
      });

    const conversation =
      [...messages.values()]
        .reverse()
        .map(msg =>
          `${msg.author.username}: ${msg.content}`
        )
        .join("\n");

    let customPrompt =
      AI_PROMPT;

    try {

      if (
        fs.existsSync("prompt.txt")
      ) {
        customPrompt =
          fs.readFileSync(
            "prompt.txt",
            "utf8"
          );
      }

    } catch {}

    // =================================================
    // طلب Gemini
    // =================================================

    const result =
      await ai.models.generateContent({

        model: "gemini-3.6-flash",

        contents: `
${customPrompt}

محادثة التكت:
${conversation}

رسالة العميل الحالية:
${content}

أجب العميل مباشرة.
خلي الرد سريع وواضح ومختصر.
        `,

        config: {
          maxOutputTokens: 250,
          temperature: 0.4
        }

      });

    const reply =
      result.text;

    if (!reply) {
      console.log(
        "Gemini returned empty response."
      );
      return;
    }

    // Discord حد الرسالة 2000 حرف
    if (reply.length <= 2000) {

      await message.channel.send(
        reply
      );

    } else {

      for (
        let i = 0;
        i < reply.length;
        i += 1900
      ) {

        await message.channel.send(
          reply.substring(
            i,
            i + 1900
          )
        );

      }
    }

  } catch (error) {

    // =================================================
    // الخطأ الحقيقي يظهر في Railway
    // =================================================

    console.error(
      "================================"
    );

    console.error(
      "❌ GEMINI/DISCORD ERROR"
    );

    console.error(
      error?.message || error
    );

    console.error(
      "================================"
    );

    try {

      await message.channel.send(
        "❌ صار خطأ مؤقت في الذكاء الاصطناعي، حاول مرة ثانية."
      );

    } catch {}

  }

});

// =====================================================
// التقييم
// =====================================================

client.on(
  "interactionCreate",
  async interaction => {

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

    await sendLog(
      interaction.guild,
      `⭐ تقييم تكت\nالمستخدم: ${interaction.user}\nالتقييم: ${rating}/5`
    );

    try {

      await interaction.message.edit({
        components: []
      });

    } catch {}

    // حذف التكت بعد 5 ثواني

    setTimeout(async () => {

      try {

        await interaction.channel.delete(
          "Ticket closed"
        );

      } catch {}

    }, 5000);

  }
);

// =====================================================
// تسجيل الدخول
// =====================================================

if (!process.env.DISCORD_TOKEN) {
  console.error(
    "❌ DISCORD_TOKEN غير موجود في Variables"
  );
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "❌ GEMINI_API_KEY غير موجود في Variables"
  );
  process.exit(1);
}

client.login(
  process.env.DISCORD_TOKEN
);

