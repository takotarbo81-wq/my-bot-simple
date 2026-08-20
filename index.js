const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

const Groq = require("groq-sdk");
require("dotenv").config();

// =====================================
// ENV
// =====================================

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود في Railway Variables");
  process.exit(1);
}

if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY غير موجود في Railway Variables");
  process.exit(1);
}

// =====================================
// DISCORD
// =====================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// =====================================
// GROQ
// =====================================

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// موديل Groq
const AI_MODEL = "openai/gpt-oss-20b";

// =====================================
// AI SETTINGS
// =====================================

const SYSTEM_PROMPT = `
أنت TicketAI، بوت دعم فني ذكي داخل Discord.

أنت تتحدث بالعربية بشكل أساسي.

قواعد الرد:
- كن محترماً وودوداً.
- افهم مشكلة المستخدم قبل الرد.
- أعطِ حلاً واضحاً ومباشراً.
- إذا لم تعرف الحل، قل إنك غير متأكد ولا تخترع معلومات.
- لا تقل إنك OpenAI أو Gemini.
- أنت تعمل بواسطة Groq.
- لا تذكر معلومات تقنية عن API إلا إذا سأل المستخدم.
- لا تطيل الرد بدون سبب.
- استخدم الإيموجي عند الحاجة فقط.
`;

// =====================================
// ASK GROQ
// =====================================

async function askAI(userMessage) {
  const completion = await groq.chat.completions.create({
    model: AI_MODEL,

    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: userMessage,
      },
    ],

    temperature: 0.7,
    max_completion_tokens: 700,
  });

  return (
    completion.choices?.[0]?.message?.content?.trim() ||
    "❌ ما قدرت أطلع رد حالياً."
  );
}

// =====================================
// BOT READY
// =====================================

client.once("ready", async () => {
  console.log("======================================");
  console.log("🤖 TicketAI Online");
  console.log(`👤 ${client.user.tag}`);
  console.log(`🌐 Servers: ${client.guilds.cache.size}`);
  console.log("🧠 AI: Groq");
  console.log(`⚙️ Model: ${AI_MODEL}`);
  console.log("======================================");

  client.user.setPresence({
    activities: [
      {
        name: "دعم التكتات 🤖",
        type: 3,
      },
    ],
    status: "online",
  });
});

// =====================================
// PANEL COMMAND
// =====================================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "panel") {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🤖 TicketAI Support")
          .setDescription(
            "مرحباً بك في الدعم الفني!\n\n" +
            "اضغط على الزر بالأسفل لفتح تكت والتحدث مع الذكاء الاصطناعي."
          )
          .setColor(0x5865f2),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("open_ticket")
            .setLabel("🎫 فتح تكت")
            .setStyle(ButtonStyle.Primary)
        ),
      ],
    });
  }
});

// =====================================
// BUTTONS
// =====================================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  // ===================================
  // OPEN TICKET
  // ===================================

  if (interaction.customId === "open_ticket") {
    // مهم جداً حتى لا يظهر:
    // This interaction failed
    await interaction.deferReply({
      ephemeral: true,
    });

    try {
      const guild = interaction.guild;

      if (!guild) {
        return interaction.editReply("❌ هذا الأمر يجب أن يكون داخل سيرفر.");
      }

      // البحث عن تكت مفتوح للمستخدم
      const existingTicket = guild.channels.cache.find(
        (channel) =>
          channel.type === ChannelType.GuildText &&
          channel.name === `ticket-${interaction.user.id}`
      );

      if (existingTicket) {
        return interaction.editReply(
          `❌ عندك تكت مفتوح بالفعل:\n${existingTicket}`
        );
      }

      // إنشاء التكت
      const ticket = await guild.channels.create({
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
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ManageChannels,
            ],
          },
        ],
      });

      const embed = new EmbedBuilder()
        .setTitle("🤖 مرحباً بك في AI Support")
        .setDescription(
          "اكتب مشكلتك هنا وسأحاول مساعدتك.\n\n" +
          "💡 اكتب المشكلة بالتفصيل للحصول على إجابة أفضل."
        )
        .setColor(0x5865f2);

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("🔒 إغلاق التكت")
          .setStyle(ButtonStyle.Danger)
      );

      await ticket.send({
        content: `<@${interaction.user.id}>`,
        embeds: [embed],
        components: [buttons],
      });

      await interaction.editReply(
        `✅ تم إنشاء التكت بنجاح!\n${ticket}`
      );

      console.log(`🎫 Ticket created: ${ticket.name}`);
    } catch (error) {
      console.error("❌ Ticket creation error:", error);

      await interaction.editReply(
        "❌ صار خطأ أثناء إنشاء التكت."
      );
    }

    return;
  }

  // ===================================
  // CLOSE TICKET
  // ===================================

  if (interaction.customId === "close_ticket") {
    // مهم جداً حتى لا يظهر:
    // didn't respond in time
    await interaction.deferUpdate();

    try {
      await interaction.channel.send(
        "🔒 سيتم إغلاق التكت خلال 3 ثوانٍ..."
      );

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (error) {
          console.error("❌ Delete ticket error:", error);
        }
      }, 3000);
    } catch (error) {
      console.error("❌ Close ticket error:", error);
    }

    return;
  }
});

// =====================================
// AI TICKET RESPONDER
// =====================================

client.on("messageCreate", async (message) => {
  try {
    // لا يرد على البوتات
    if (message.author.bot) return;

    // لازم يكون داخل سيرفر
    if (!message.guild) return;

    // لازم يكون داخل تكت
    const isTicket =
      message.channel.name.startsWith("ticket-");

    if (!isTicket) return;

    // لا يوجد نص
    if (!message.content?.trim()) return;

    console.log(
      `💬 ${message.author.tag}: ${message.content}`
    );

    // رسالة مؤقتة
    const thinking = await message.channel.send(
      "🤖 **جاري التفكير...**"
    );

    try {
      const answer = await askAI(message.content);

      if (!answer) {
        return thinking.edit(
          "❌ الذكاء الاصطناعي لم يرجع رداً."
        );
      }

      // Discord حد الرسالة 2000 حرف
      const chunks = [];

      for (let i = 0; i < answer.length; i += 1900) {
        chunks.push(answer.slice(i, i + 1900));
      }

      // تعديل رسالة التفكير
      await thinking.edit(chunks.shift());

      // إرسال باقي الرد
      for (const chunk of chunks) {
        await message.channel.send(chunk);
      }

      console.log("✅ Groq AI replied");
    } catch (error) {
      console.error("================================");
      console.error("❌ GROQ ERROR");
      console.error(error);
      console.error("================================");

      await thinking.edit(
        "❌ **الذكاء الاصطناعي غير متاح حالياً.**\n" +
        "تأكد من أن `GROQ_API_KEY` صحيح في Railway Variables."
      );
    }
  } catch (error) {
    console.error("❌ Message handler error:", error);
  }
});

// =====================================
// SLASH COMMAND DEPLOYMENT
// =====================================

client.once("ready", async () => {
  try {
    const commands = [
      {
        name: "panel",
        description: "إرسال لوحة التكت",
      },
    ];

    await client.application.commands.set(commands);

    console.log("✅ تم تسجيل /panel");
  } catch (error) {
    console.error("❌ Command registration error:", error);
  }
});

// =====================================
// ERROR HANDLING
// =====================================

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled Rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
});

// =====================================
// LOGIN
// =====================================

client
  .login(process.env.DISCORD_TOKEN)
  .catch((error) => {
    console.error("❌ Discord Login Error:", error);
    process.exit(1);
  });
