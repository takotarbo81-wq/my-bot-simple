const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");

const fs = require("fs");

// =========================
// الإعدادات
// =========================

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود");
  process.exit(1);
}

if (!GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY غير موجود");
  process.exit(1);
}

// =========================
// ملف الإعدادات
// =========================

const CONFIG_FILE = "./config.json";

let config = {
  aiChatId: null,
  ticketCategoryId: null,
  ticketName: "ai-ticket",
};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    config = {
      ...config,
      ...JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")),
    };
  } catch (err) {
    console.log("⚠️ تعذر قراءة config.json");
  }
}

function saveConfig() {
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify(config, null, 2)
  );
}

// =========================
// Discord Client
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// =========================
// أوامر البوت
// =========================

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("إرسال بانل الدعم والتذاكر"),

  new SlashCommandBuilder()
    .setName("ai-ticket")
    .setDescription("إرسال بانل AI Ticket"),

  new SlashCommandBuilder()
    .setName("ai-chat")
    .setDescription("تحديد شات الذكاء الاصطناعي")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("الشات الذي سيرد فيه AI")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ai-category")
    .setDescription("تحديد كاتيجوري التكتات")
    .addChannelOption(option =>
      option
        .setName("category")
        .setDescription("كاتيجوري التكتات")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ai-stats")
    .setDescription("عرض حالة نظام AI"),
].map(command => command.toJSON());

// =========================
// تسجيل الأوامر بدون GUILD_ID
// =========================

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  try {
    console.log("🔄 تسجيل أوامر Slash...");

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
}

// =========================
// Groq AI
// =========================

async function askAI(text) {
  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },

        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",

          messages: [
            {
              role: "system",
              content:
                "أنت بوت دعم عربي محترم وسريع. أجب باللغة العربية بشكل واضح ومختصر، وساعد المستخدم في حل مشكلته.",
            },
            {
              role: "user",
              content: text,
            },
          ],

          temperature: 0.6,
          max_completion_tokens: 1024,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq Error:", data);
      return "❌ حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.";
    }

    return (
      data?.choices?.[0]?.message?.content ||
      "❌ لم أستطع الحصول على رد."
    );
  } catch (error) {
    console.error("AI Error:", error);
    return "❌ حصل خطأ في نظام الذكاء الاصطناعي.";
  }
}

// =========================
// تشغيل البوت
// =========================

client.once("ready", async () => {
  console.log("================================");
  console.log(`🤖 البوت: ${client.user.tag}`);
  console.log(`🟢 متصل بنجاح`);
  console.log("================================");

  await registerCommands();
});

// =========================
// الرسائل
// =========================

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.guild) return;

  // --------------------------------
  // AI CHAT
  // --------------------------------

  if (
    config.aiChatId &&
    message.channel.id === config.aiChatId
  ) {
    await message.channel.sendTyping();

    const answer = await askAI(message.content);

    if (answer.length <= 2000) {
      await message.reply(answer);
    } else {
      await message.reply(answer.substring(0, 2000));
    }

    return;
  }

  // --------------------------------
  // AI TICKETS
  // البوت يرد فقط داخل التكتات التي أنشأها
  // --------------------------------

  if (
    message.channel.type === ChannelType.GuildText &&
    message.channel.name.startsWith("ai-ticket-")
  ) {
    await message.channel.sendTyping();

    const answer = await askAI(message.content);

    if (answer.length <= 2000) {
      await message.reply(answer);
    } else {
      await message.reply(answer.substring(0, 2000));
    }
  }
});

// =========================
// الأوامر والأزرار
// =========================

client.on("interactionCreate", async interaction => {

  // =========================
  // Slash Commands
  // =========================

  if (interaction.isChatInputCommand()) {

    // -------------------------
    // /ai-chat
    // -------------------------

    if (interaction.commandName === "ai-chat") {

      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "❌ تحتاج صلاحية Manage Server.",
          ephemeral: true,
        });
      }

      const channel =
        interaction.options.getChannel("channel");

      config.aiChatId = channel.id;
      saveConfig();

      return interaction.reply({
        content:
          `✅ تم تحديد شات AI:\n${channel}`,
        ephemeral: true,
      });
    }

    // -------------------------
    // /ai-category
    // -------------------------

    if (interaction.commandName === "ai-category") {

      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "❌ تحتاج صلاحية Manage Server.",
          ephemeral: true,
        });
      }

      const category =
        interaction.options.getChannel("category");

      config.ticketCategoryId = category.id;
      saveConfig();

      return interaction.reply({
        content:
          `✅ تم تحديد كاتيجوري التكتات:\n${category}`,
        ephemeral: true,
      });
    }

    // -------------------------
    // /ai-stats
    // -------------------------

    if (interaction.commandName === "ai-stats") {

      const embed = new EmbedBuilder()
        .setTitle("🤖 حالة نظام AI")
        .setDescription(
          "نظام الذكاء الاصطناعي يعمل."
        )
        .addFields(
          {
            name: "🧠 AI Chat",
            value: config.aiChatId
              ? `<#${config.aiChatId}>`
              : "❌ غير محدد",
          },
          {
            name: "🎫 Ticket Category",
            value: config.ticketCategoryId
              ? `<#${config.ticketCategoryId}>`
              : "❌ غير محددة",
          },
          {
            name: "🟢 البوت",
            value: "Online",
          }
        )
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
      });
    }

    // -------------------------
    // /panel
    // -------------------------

    if (interaction.commandName === "panel") {

      const embed = new EmbedBuilder()
        .setTitle("🎫 مركز الدعم")
        .setDescription(
          "اضغط الزر بالأسفل لفتح تذكرة دعم خاصة بك."
        )
        .setFooter({
          text: "AI Support",
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("create_ticket")
          .setLabel("فتح تذكرة")
          .setEmoji("🎫")
          .setStyle(ButtonStyle.Primary)
      );

      return interaction.reply({
        embeds: [embed],
        components: [row],
      });
    }

    // -------------------------
    // /ai-ticket
    // -------------------------

    if (interaction.commandName === "ai-ticket") {

      const embed = new EmbedBuilder()
        .setTitle("🤖 AI Ticket")
        .setDescription(
          "افتح تذكرة وسيقوم نظام AI بمساعدتك."
        )
        .setColor(0x5865f2);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("create_ticket")
          .setLabel("فتح AI Ticket")
          .setEmoji("🤖")
          .setStyle(ButtonStyle.Success)
      );

      return interaction.reply({
        embeds: [embed],
        components: [row],
      });
    }
  }

  // =========================
  // إنشاء التكت
  // =========================

  if (
    interaction.isButton() &&
    interaction.customId === "create_ticket"
  ) {

    if (!config.ticketCategoryId) {
      return interaction.reply({
        content:
          "❌ لم يتم تحديد كاتيجوري التكتات.\nاستخدم `/ai-category` أولاً.",
        ephemeral: true,
      });
    }

    const guild = interaction.guild;

    // منع المستخدم من فتح أكثر من تكت
    const existing = guild.channels.cache.find(
      channel =>
        channel.type === ChannelType.GuildText &&
        channel.name ===
          `ai-ticket-${interaction.user.id}`
    );

    if (existing) {
      return interaction.reply({
        content:
          `❌ عندك تكت مفتوح بالفعل: ${existing}`,
        ephemeral: true,
      });
    }

    try {

      const ticket = await guild.channels.create({
        name: `ai-ticket-${interaction.user.id}`,

        type: ChannelType.GuildText,

        parent: config.ticketCategoryId,

        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,

            deny: [
              PermissionsBitField.Flags.ViewChannel,
            ],
          },

          {
            id: interaction.user.id,

            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },

          {
            id: client.user.id,

            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageChannels,
            ],
          },
        ],
      });

      const closeRow =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("close_ticket")
            .setLabel("إغلاق التكت")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Danger)
        );

      const embed = new EmbedBuilder()
        .setTitle("🤖 AI Support")
        .setDescription(
          `أهلاً ${interaction.user} 👋\n\nاكتب مشكلتك هنا وسيقوم AI بمساعدتك.\n\n🔒 اضغط الزر لإغلاق التكت.`
        )
        .setColor(0x5865f2);

      await ticket.send({
        content: `<@${interaction.user.id}>`,
        embeds: [embed],
        components: [closeRow],
      });

      return interaction.reply({
        content:
          `✅ تم إنشاء تكتك: ${ticket}`,
        ephemeral: true,
      });

    } catch (error) {

      console.error(error);

      return interaction.reply({
        content:
          "❌ لم أستطع إنشاء التكت. تأكد أن البوت لديه صلاحية Manage Channels.",
        ephemeral: true,
      });
    }
  }

  // =========================
  // إغلاق التكت
  // =========================

  if (
    interaction.isButton() &&
    interaction.customId === "close_ticket"
  ) {

    if (
      !interaction.channel.name.startsWith("ai-ticket-")
    ) {
      return interaction.reply({
        content: "❌ هذا ليس تكت AI.",
        ephemeral: true,
      });
    }

    await interaction.reply("🔒 سيتم إغلاق التكت...");

    setTimeout(async () => {
      try {
        await interaction.channel.delete();
      } catch (error) {
        console.error(error);
      }
    }, 2000);
  }
});

// =========================
// تسجيل الدخول
// =========================

client.login(DISCORD_TOKEN);
