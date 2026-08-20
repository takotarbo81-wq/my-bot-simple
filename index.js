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

// =========================
// CONFIG
// =========================

const TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود في Variables");
  process.exit(1);
}

if (!SUPPORT_ROLE_ID) {
  console.error("❌ SUPPORT_ROLE_ID غير موجود في Variables");
  process.exit(1);
}

// Groq model سريع
const AI_MODEL = "llama-3.1-8b-instant";

// =========================
// CLIENT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// =========================
// DATABASE بسيط
// =========================

const settings = new Map();
const ticketStats = new Map();

// =========================
// SLASH COMMANDS
// =========================

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("إرسال لوحة فتح التكت"),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("إغلاق التكت"),

  new SlashCommandBuilder()
    .setName("promot")
    .setDescription("تحويل التكت للدعم"),

  new SlashCommandBuilder()
    .setName("rename")
    .setDescription("تغيير اسم التكت")
    .addStringOption(option =>
      option
        .setName("name")
        .setDescription("الاسم الجديد")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("إعدادات البوت")
    .addSubcommand(sub =>
      sub
        .setName("category")
        .setDescription("تحديد كاتيجوري التكت")
        .addChannelOption(option =>
          option
            .setName("category")
            .setDescription("اختار الكاتيجوري")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("إحصائيات التكتات"),
].map(command => command.toJSON());

// =========================
// REGISTER COMMANDS
// =========================

client.once("ready", async () => {
  console.log("================================");
  console.log(`🤖 البوت شغال: ${client.user.tag}`);
  console.log("🧠 AI: Groq / Llama 3.1 8B");
  console.log("🎫 Ticket System: ON");
  console.log("================================");

  client.user.setActivity("التذاكر 🛡️", {
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

    console.log("✅ تم تسجيل الأوامر");
  } catch (error) {
    console.error("❌ خطأ تسجيل الأوامر:", error);
  }
});

// =========================
// AI
// =========================

async function askAI(message) {
  if (!GROQ_API_KEY) {
    return "⚠️ مفتاح الذكاء الاصطناعي غير موجود.";
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
              content:
                "أنت بوت دعم فني داخل Discord. رد بالعربية بشكل مختصر ومفيد. لا تدّعي أنك موظف بشري. إذا كانت المشكلة تحتاج تدخل موظف دعم، أخبر المستخدم أن يشرح المشكلة بوضوح.",
            },

            {
              role: "user",
              content: message,
            },
          ],

          temperature: 0.5,
          max_tokens: 300,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq Error:", data);

      return "❌ حصل خطأ مؤقت في الذكاء الاصطناعي.";
    }

    return (
      data?.choices?.[0]?.message?.content ||
      "ما قدرت أفهم سؤالك، اشرح المشكلة بطريقة أوضح."
    );
  } catch (error) {
    console.error("AI ERROR:", error);

    return "❌ تعذر الاتصال بالذكاء الاصطناعي حاليًا.";
  }
}

// =========================
// COMMAND HANDLER
// =========================

client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.commandName;

    // =====================
    // PANEL
    // =====================

    if (command === "panel") {
      const embed = new EmbedBuilder()
        .setTitle("🎫 الدعم الفني")
        .setDescription(
          "اضغط الزر بالأسفل لفتح تذكرة مع فريق الدعم."
        )
        .setColor(0x5865f2);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_ticket")
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

    // =====================
    // SETUP CATEGORY
    // =====================

    if (command === "setup") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: "❌ تحتاج صلاحية Administrator.",
          ephemeral: true,
        });
      }

      const category = interaction.options.getChannel("category");

      settings.set(interaction.guild.id, {
        categoryId: category.id,
      });

      await interaction.reply({
        content: `✅ تم تحديد كاتيجوري التكتات: ${category}`,
        ephemeral: true,
      });

      return;
    }

    // =====================
    // RENAME
    // =====================

    if (command === "rename") {
      if (!interaction.channel.name.startsWith("ticket-")) {
        return interaction.reply({
          content: "❌ هذا الأمر يستخدم داخل التكت فقط.",
          ephemeral: true,
        });
      }

      const name = interaction.options.getString("name");

      const cleanName = name
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\u0600-\u06FF-_]/g, "-")
        .slice(0, 90);

      await interaction.channel.setName(`ticket-${cleanName}`);

      await interaction.reply(`✅ تم تغيير اسم التكت إلى **ticket-${cleanName}**`);

      return;
    }

    // =====================
    // CLOSE
    // =====================

    if (command === "close") {
      if (!interaction.channel.name.startsWith("ticket-")) {
        return interaction.reply({
          content: "❌ هذا الأمر يستخدم داخل التكت فقط.",
          ephemeral: true,
        });
      }

      await interaction.reply("🔒 سيتم إغلاق التكت خلال 5 ثوانٍ...");

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (error) {
          console.error("Close error:", error);
        }
      }, 5000);

      return;
    }

    // =====================
    // PROMOT
    // =====================

    if (command === "promot") {
      if (!interaction.channel.name.startsWith("ticket-")) {
        return interaction.reply({
          content: "❌ هذا الأمر يستخدم داخل التكت فقط.",
          ephemeral: true,
        });
      }

      const role = interaction.guild.roles.cache.get(SUPPORT_ROLE_ID);

      if (!role) {
        return interaction.reply({
          content: "❌ رتبة الدعم غير موجودة. تأكد من SUPPORT_ROLE_ID.",
          ephemeral: true,
        });
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
        `🛡️ تم تحويل التكت إلى فريق الدعم.`
      );

      return;
    }

    // =====================
    // STATS
    // =====================

    if (command === "stats") {
      const guildId = interaction.guild.id;

      const stats = ticketStats.get(guildId) || {
        opened: 0,
        closed: 0,
      };

      const embed = new EmbedBuilder()
        .setTitle("📊 إحصائيات التكتات")
        .addFields(
          {
            name: "🎫 التكتات المفتوحة",
            value: `${stats.opened}`,
            inline: true,
          },
          {
            name: "🔒 التكتات المغلقة",
            value: `${stats.closed}`,
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
    console.error("COMMAND ERROR:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ صار خطأ أثناء تنفيذ الأمر.",
        ephemeral: true,
      });
    }
  }
});

// =========================
// BUTTONS
// =========================

client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.isButton()) return;

    // =====================
    // OPEN TICKET
    // =====================

    if (interaction.customId === "open_ticket") {
      const guild = interaction.guild;

      const oldTicket = guild.channels.cache.find(
        channel =>
          channel.name === `ticket-${interaction.user.id}` &&
          channel.type === ChannelType.GuildText
      );

      if (oldTicket) {
        return interaction.reply({
          content: `❌ عندك تكت مفتوح بالفعل: ${oldTicket}`,
          ephemeral: true,
        });
      }

      const serverSettings = settings.get(guild.id);

      const channelOptions = {
        name: `ticket-${interaction.user.id}`,
        type: ChannelType.GuildText,

        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },

          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
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
        ],
      };

      if (serverSettings?.categoryId) {
        channelOptions.parent = serverSettings.categoryId;
      }

      const channel = await guild.channels.create(channelOptions);

      const currentStats = ticketStats.get(guild.id) || {
        opened: 0,
        closed: 0,
      };

      currentStats.opened++;
      ticketStats.set(guild.id, currentStats);

      const embed = new EmbedBuilder()
        .setTitle("🎫 تذكرة الدعم")
        .setDescription(
          `مرحبًا ${interaction.user} 👋\n\n` +
          `اكتب مشكلتك بالتفصيل وسأحاول مساعدتك بالذكاء الاصطناعي.\n\n` +
          `🛡️ إذا احتجت موظف دعم، استخدم **/promot**.`
        )
        .setColor(0x5865f2);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("إغلاق التكت")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `${interaction.user}`,
        embeds: [embed],
        components: [row],
      });

      await interaction.reply({
        content: `✅ تم فتح التكت: ${channel}`,
        ephemeral: true,
      });

      return;
    }

    // =====================
    // CLOSE BUTTON
    // =====================

    if (interaction.customId === "close_ticket") {
      if (!interaction.channel.name.startsWith("ticket-")) {
        return interaction.reply({
          content: "❌ هذا ليس تكت.",
          ephemeral: true,
        });
      }

      await interaction.reply("🔒 سيتم إغلاق التكت خلال 5 ثوانٍ...");

      setTimeout(async () => {
        try {
          const guildId = interaction.guild.id;

          const stats = ticketStats.get(guildId) || {
            opened: 0,
            closed: 0,
          };

          stats.closed++;

          ticketStats.set(guildId, stats);

          await interaction.channel.delete();
        } catch (error) {
          console.error(error);
        }
      }, 5000);
    }
  } catch (error) {
    console.error("BUTTON ERROR:", error);
  }
});

// =========================
// AI MESSAGE SYSTEM
// =========================

client.on("messageCreate", async message => {
  try {
    if (message.author.bot) return;

    if (!message.guild) return;

    // AI يعمل فقط داخل التكت
    if (!message.channel.name.startsWith("ticket-")) return;

    // تجاهل الأوامر
    if (message.content.startsWith("/")) return;

    if (!message.content.trim()) return;

    // حالة معالجة
    const loading = await message.reply("🤖 جاري التفكير...");

    const answer = await askAI(message.content);

    await loading.edit(answer);
  } catch (error) {
    console.error("MESSAGE ERROR:", error);
  }
});

// =========================
// ERRORS
// =========================

process.on("unhandledRejection", error => {
  console.error("UNHANDLED REJECTION:", error);
});

process.on("uncaughtException", error => {
  console.error("UNCAUGHT EXCEPTION:", error);
});

// =========================
// LOGIN
// =========================

client.login(TOKEN);
