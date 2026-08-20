require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");

// ======================================================
// VARIABLES
// ======================================================

const TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID;

const AI_MODEL = "llama-3.1-8b-instant";

// ======================================================
// CHECK VARIABLES
// ======================================================

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود");
  process.exit(1);
}

if (!SUPPORT_ROLE_ID) {
  console.error("❌ SUPPORT_ROLE_ID غير موجود");
  process.exit(1);
}

if (!GROQ_API_KEY) {
  console.warn("⚠️ GROQ_API_KEY غير موجود - الذكاء الاصطناعي لن يعمل");
}

// ======================================================
// CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ======================================================
// BOT DATABASE
// ======================================================

// لكل سيرفر
// categoryId = كاتيجوري التكتات
// ticketIds = التكتات التي أنشأها هذا البوت
// stats = الإحصائيات

const database = new Map();

function getGuildData(guildId) {
  if (!database.has(guildId)) {
    database.set(guildId, {
      categoryId: null,
      ticketIds: new Set(),
      opened: 0,
      closed: 0,
    });
  }

  return database.get(guildId);
}

// ======================================================
// SLASH COMMANDS
// ======================================================

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("إرسال لوحة فتح التكت"),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("إغلاق التكت الحالي"),

  new SlashCommandBuilder()
    .setName("promot")
    .setDescription("تحويل التكت لفريق الدعم"),

  new SlashCommandBuilder()
    .setName("rename")
    .setDescription("تغيير اسم التكت")
    .addStringOption(option =>
      option
        .setName("name")
        .setDescription("الاسم الجديد للتكت")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("إعداد البوت")
    .addSubcommand(sub =>
      sub
        .setName("category")
        .setDescription("تحديد كاتيجوري التكتات")
        .addChannelOption(option =>
          option
            .setName("category")
            .setDescription("اختر الكاتيجوري")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("إحصائيات تكتات هذا البوت"),
].map(command => command.toJSON());

// ======================================================
// READY
// ======================================================

client.once("ready", async () => {
  console.log("=================================");
  console.log(`🤖 ${client.user.tag}`);
  console.log("🎫 Ticket System: ONLINE");
  console.log("🧠 AI: Groq");
  console.log(`⚡ Model: ${AI_MODEL}`);
  console.log("=================================");

  client.user.setActivity("التذاكر 🎫", {
    type: 3,
  });

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      {
        body: commands,
      }
    );

    console.log("✅ تم تسجيل جميع الأوامر");
  } catch (error) {
    console.error("❌ خطأ تسجيل الأوامر:");
    console.error(error);
  }
});

// ======================================================
// CHECK BOT'S TICKET
// ======================================================

function isOurTicket(channel) {
  if (!channel || !channel.guild) return false;

  const data = getGuildData(channel.guild.id);

  return data.ticketIds.has(channel.id);
}

// ======================================================
// AI
// ======================================================

async function askAI(userMessage) {
  if (!GROQ_API_KEY) {
    return "⚠️ الذكاء الاصطناعي غير مفعل حاليًا.";
  }

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          model: AI_MODEL,

          messages: [
            {
              role: "system",
              content: `
أنت بوت دعم فني داخل Discord.

قواعدك:
- تكلم بالعربية.
- كن مختصرًا وواضحًا.
- ساعد المستخدم في مشاكل Discord والسيرفر والتذاكر.
- لا تدّعي أنك شخص حقيقي.
- إذا كانت المشكلة تحتاج تدخل موظف، قل للمستخدم أن يشرح المشكلة بوضوح.
- لا تعطي معلومات خطيرة أو ضارة.
- لا تكرر كلام المستخدم بدون فائدة.
              `,
            },

            {
              role: "user",
              content: userMessage,
            },
          ],

          temperature: 0.5,
          max_tokens: 400,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ GROQ ERROR:");
      console.error(data);

      return "❌ صار خطأ مؤقت في الذكاء الاصطناعي، حاول مرة ثانية.";
    }

    const answer =
      data?.choices?.[0]?.message?.content;

    if (!answer) {
      return "❌ ما قدرت أطلع رد حاليًا.";
    }

    return answer;
  } catch (error) {
    console.error("❌ AI ERROR:");
    console.error(error);

    return "❌ تعذر الاتصال بالذكاء الاصطناعي حاليًا.";
  }
}

// ======================================================
// SLASH COMMANDS
// ======================================================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {

    // ==================================================
    // PANEL
    // ==================================================

    if (interaction.commandName === "panel") {

      const embed = new EmbedBuilder()
        .setTitle("🎫 الدعم الفني")
        .setDescription(
          "اضغط على الزر بالأسفل لفتح تذكرة مع فريق الدعم.\n\n" +
          "🤖 سيتم مساعدتك بواسطة نظام الدعم والذكاء الاصطناعي."
        )
        .setColor(0x5865f2)
        .setFooter({
          text: "Ticket AI",
        });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_ai_open")
            .setLabel("فتح تذكرة")
            .setEmoji("🎫")
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.reply({
        embeds: [embed],
        components: [row],
      });

      return;
    }

    // ==================================================
    // SETUP CATEGORY
    // ==================================================

    if (
      interaction.commandName === "setup" &&
      interaction.options.getSubcommand() === "category"
    ) {

      if (
        !interaction.memberPermissions.has(
          PermissionFlagsBits.Administrator
        )
      ) {
        await interaction.reply({
          content: "❌ تحتاج صلاحية Administrator.",
          ephemeral: true,
        });

        return;
      }

      const category =
        interaction.options.getChannel("category");

      const data = getGuildData(interaction.guild.id);

      data.categoryId = category.id;

      await interaction.reply({
        content:
          `✅ تم تحديد كاتيجوري التكتات:\n${category}`,
        ephemeral: true,
      });

      return;
    }

    // ==================================================
    // VERIFY TICKET COMMANDS
    // ==================================================

    if (
      ["close", "promot", "rename"].includes(
        interaction.commandName
      )
    ) {

      if (!isOurTicket(interaction.channel)) {
        await interaction.reply({
          content:
            "❌ هذا التكت ليس تابعًا لهذا البوت.",
          ephemeral: true,
        });

        return;
      }
    }

    // ==================================================
    // CLOSE
    // ==================================================

    if (interaction.commandName === "close") {

      await interaction.reply(
        "🔒 سيتم إغلاق التكت خلال 5 ثوانٍ..."
      );

      const data =
        getGuildData(interaction.guild.id);

      data.ticketIds.delete(interaction.channel.id);
      data.closed++;

      setTimeout(async () => {
        try {
          await interaction.channel.delete(
            "Ticket closed"
          );
        } catch (error) {
          console.error(
            "❌ Close error:",
            error
          );
        }
      }, 5000);

      return;
    }

    // ==================================================
    // PROMOT
    // ==================================================

    if (interaction.commandName === "promot") {

      const role =
        interaction.guild.roles.cache.get(
          SUPPORT_ROLE_ID
        );

      if (!role) {
        await interaction.reply({
          content:
            "❌ رتبة الدعم غير موجودة. تأكد من SUPPORT_ROLE_ID.",
          ephemeral: true,
        });

        return;
      }

      await interaction.channel.permissionOverwrites.edit(
        role.id,
        {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        }
      );

      await interaction.reply(
        `🛡️ تم تحويل التكت إلى فريق الدعم.\n\n${role}`
      );

      return;
    }

    // ==================================================
    // RENAME
    // ==================================================

    if (interaction.commandName === "rename") {

      const name =
        interaction.options.getString("name");

      const cleanName = name
        .trim()
        .toLowerCase()
        .replace(
          /[^a-zA-Z0-9\u0600-\u06FF-_]/g,
          "-"
        )
        .slice(0, 80);

      await interaction.channel.setName(
        `ticket-${cleanName}`
      );

      await interaction.reply(
        `✅ تم تغيير اسم التكت إلى:\n\`ticket-${cleanName}\``
      );

      return;
    }

    // ==================================================
    // STATS
    // ==================================================

    if (interaction.commandName === "stats") {

      const data =
        getGuildData(interaction.guild.id);

      const embed = new EmbedBuilder()
        .setTitle("📊 إحصائيات Ticket AI")
        .addFields(
          {
            name: "🎫 التكتات المفتوحة",
            value: `${data.ticketIds.size}`,
            inline: true,
          },
          {
            name: "📂 إجمالي التكتات",
            value: `${data.opened}`,
            inline: true,
          },
          {
            name: "🔒 التكتات المغلقة",
            value: `${data.closed}`,
            inline: true,
          }
        )
        .setColor(0x5865f2);

      await interaction.reply({
        embeds: [embed],
      });

      return;
    }

  } catch (error) {

    console.error(
      "❌ COMMAND ERROR:",
      error
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction.reply({
        content:
          "❌ حدث خطأ أثناء تنفيذ الأمر.",
        ephemeral: true,
      });
    }
  }
});

// ======================================================
// BUTTON SYSTEM
// ======================================================

client.on("interactionCreate", async interaction => {

  if (!interaction.isButton()) return;

  try {

    // ==================================================
    // OPEN TICKET
    // ==================================================

    if (
      interaction.customId === "ticket_ai_open"
    ) {

      const guild =
        interaction.guild;

      const data =
        getGuildData(guild.id);

      // ----------------------------------------------
      // منع تكتين لنفس الشخص
      // ----------------------------------------------

      const existingTicket =
        [...data.ticketIds]
          .map(id =>
            guild.channels.cache.get(id)
          )
          .find(channel => {

            if (!channel) return false;

            return channel.topic ===
              `TicketOwner:${interaction.user.id}`;
          });

      if (existingTicket) {

        await interaction.reply({
          content:
            `❌ عندك تكت مفتوح بالفعل:\n${existingTicket}`,
          ephemeral: true,
        });

        return;
      }

      // ----------------------------------------------
      // PERMISSIONS
      // ----------------------------------------------

      const permissions = [

        {
          id: guild.roles.everyone.id,

          deny: [
            PermissionFlagsBits.ViewChannel,
          ],
        },

        {
          id: interaction.user.id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },

        {
          id: SUPPORT_ROLE_ID,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ];

      // ----------------------------------------------
      // CREATE CHANNEL
      // ----------------------------------------------

      const channel =
        await guild.channels.create({

          name:
            `ticket-${interaction.user.username}`
              .toLowerCase()
              .replace(
                /[^a-z0-9-_]/g,
                "-"
              )
              .slice(0, 80),

          type:
            ChannelType.GuildText,

          parent:
            data.categoryId || undefined,

          topic:
            `TicketOwner:${interaction.user.id}`,

          permissionOverwrites:
            permissions,
        });

      // ----------------------------------------------
      // SAVE TICKET
      // ----------------------------------------------

      data.ticketIds.add(channel.id);
      data.opened++;

      // ----------------------------------------------
      // EMBED
      // ----------------------------------------------

      const embed =
        new EmbedBuilder()
          .setTitle("🎫 تذكرة الدعم")
          .setDescription(
            `مرحبًا ${interaction.user} 👋\n\n` +

            `اكتب مشكلتك هنا وسأحاول مساعدتك.\n\n` +

            `🤖 **الذكاء الاصطناعي:** متاح\n` +

            `🛡️ **فريق الدعم:** يمكنه دخول التكت\n\n` +

            `إذا احتجت تحويل المشكلة للدعم استخدم:\n` +

            `\`/promot\``
          )
          .setColor(0x5865f2);

      // ----------------------------------------------
      // BUTTONS
      // ----------------------------------------------

      const row =
        new ActionRowBuilder()
          .addComponents(

            new ButtonBuilder()
              .setCustomId(
                "ticket_ai_close"
              )
              .setLabel("إغلاق")
              .setEmoji("🔒")
              .setStyle(
                ButtonStyle.Danger
              ),

            new ButtonBuilder()
              .setCustomId(
                "ticket_ai_support"
              )
              .setLabel("تحويل للدعم")
              .setEmoji("🛡️")
              .setStyle(
                ButtonStyle.Secondary
              )
          );

      // ----------------------------------------------
      // SEND
      // ----------------------------------------------

      await channel.send({

        content:
          `${interaction.user}`,

        embeds: [embed],

        components: [row],
      });

      await interaction.reply({

        content:
          `✅ تم فتح تذكرتك:\n${channel}`,

        ephemeral: true,
      });

      return;
    }

    // ==================================================
    // CLOSE BUTTON
    // ==================================================

    if (
      interaction.customId ===
      "ticket_ai_close"
    ) {

      if (!isOurTicket(interaction.channel)) {

        await interaction.reply({
          content:
            "❌ هذا التكت ليس تابعًا لهذا البوت.",
          ephemeral: true,
        });

        return;
      }

      const data =
        getGuildData(
          interaction.guild.id
        );

      data.ticketIds.delete(
        interaction.channel.id
      );

      data.closed++;

      await interaction.reply(
        "🔒 سيتم إغلاق التكت خلال 5 ثوانٍ..."
      );

      setTimeout(async () => {

        try {

          await interaction.channel.delete(
            "Ticket closed by button"
          );

        } catch (error) {

          console.error(
            "❌ Ticket delete error:",
            error
          );

        }

      }, 5000);

      return;
    }

    // ==================================================
    // SUPPORT BUTTON
    // ==================================================

    if (
      interaction.customId ===
      "ticket_ai_support"
    ) {

      if (!isOurTicket(interaction.channel)) {

        await interaction.reply({
          content:
            "❌ هذا التكت ليس تابعًا لهذا البوت.",
          ephemeral: true,
        });

        return;
      }

      const role =
        interaction.guild.roles.cache.get(
          SUPPORT_ROLE_ID
        );

      if (!role) {

        await interaction.reply({
          content:
            "❌ رتبة الدعم غير موجودة.",
          ephemeral: true,
        });

        return;
      }

      await interaction.channel.permissionOverwrites.edit(
        role.id,
        {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        }
      );

      await interaction.reply(
        `🛡️ تم تحويل التكت إلى فريق الدعم.\n${role}`
      );

      return;
    }

  } catch (error) {

    console.error(
      "❌ BUTTON ERROR:",
      error
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {

      await interaction.reply({
        content:
          "❌ حدث خطأ.",
        ephemeral: true,
      });

    }
  }
});

// ======================================================
// AI MESSAGE SYSTEM
// ======================================================

client.on("messageCreate", async message => {

  try {

    // البوتات لا نرد عليها
    if (message.author.bot) return;

    // DM لا
    if (!message.guild) return;

    // ----------------------------------------------
    // أهم نقطة:
    // لا نرد إلا على تكتات هذا البوت
    // ----------------------------------------------

    if (!isOurTicket(message.channel)) {
      return;
    }

    // تجاهل الرسائل الفارغة
    if (!message.content.trim()) return;

    // تجاهل slash commands
    if (
      message.content.startsWith("/")
    ) {
      return;
    }

    // ----------------------------------------------
    // Typing
    // ----------------------------------------------

    await message.channel.sendTyping();

    // ----------------------------------------------
    // AI
    // ----------------------------------------------

    const answer =
      await askAI(message.content);

    // ----------------------------------------------
    // Discord max message
    // ----------------------------------------------

    if (answer.length <= 1900) {

      await message.reply(answer);

    } else {

      const chunks =
        answer.match(/[\s\S]{1,1900}/g);

      for (const chunk of chunks) {

        await message.channel.send(
          chunk
        );

      }
    }

  } catch (error) {

    console.error(
      "❌ MESSAGE ERROR:",
      error
    );

  }
});

// ======================================================
// ERRORS
// ======================================================

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "❌ UNHANDLED REJECTION:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "❌ UNCAUGHT EXCEPTION:",
      error
    );
  }
);

// ======================================================
// LOGIN
// ======================================================

client.login(TOKEN);
