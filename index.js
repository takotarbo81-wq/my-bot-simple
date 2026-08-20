require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const Groq = require("groq-sdk");
const fs = require("fs");

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

const DATA_FILE = "./ticket-data.json";

let data = {
  categories: {},
  memory: {},
  stats: {
    opened: 0,
    closed: 0,
    ratings: []
  }
};

if (fs.existsSync(DATA_FILE)) {
  try {
    const saved = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    data = {
      ...data,
      ...saved,
      stats: {
        ...data.stats,
        ...(saved.stats || {})
      }
    };
  } catch (error) {
    console.log("⚠️ تعذر قراءة البيانات القديمة.");
  }
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2)
    );
  } catch (error) {
    console.error("❌ خطأ حفظ البيانات:", error);
  }
}

function isTicket(channel) {
  if (!channel) return false;

  return (
    channel.type === ChannelType.GuildText &&
    (
      channel.name.startsWith("ticket-") ||
      channel.name.startsWith("تكت-")
    )
  );
}

// ======================================
// الأوامر
// ======================================

const commands = [

  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("إعداد نظام التكت — Ticket Setup")
    .addSubcommand(sub =>
      sub
        .setName("category")
        .setDescription("تحديد كاتيجوري التكت")
        .addChannelOption(option =>
          option
            .setName("category")
            .setDescription("اختر كاتيجوري التكت")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("إرسال لوحة فتح التكت — Ticket Panel"),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("إغلاق التكت — Close Ticket"),

  new SlashCommandBuilder()
    .setName("rename")
    .setDescription("تغيير اسم التكت — Rename Ticket")
    .addStringOption(option =>
      option
        .setName("name")
        .setDescription("الاسم الجديد للتكت")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("إحصائيات التكتات — Ticket Statistics")

].map(command => command.toJSON());

// ======================================
// تسجيل الأوامر تلقائيًا
// ======================================

async function registerCommands() {
  try {
    const rest = new REST({
      version: "10"
    }).setToken(
      process.env.DISCORD_TOKEN
    );

    for (const guild of client.guilds.cache.values()) {

      await rest.put(
        Routes.applicationGuildCommands(
          client.user.id,
          guild.id
        ),
        {
          body: commands
        }
      );

      console.log(
        `✅ Commands registered: ${guild.name}`
      );
    }

  } catch (error) {
    console.error(
      "❌ Command registration error:",
      error
    );
  }
}

// ======================================
// تشغيل البوت
// ======================================

client.once("ready", async () => {

  console.log("================================");
  console.log(
    `🤖 TicketAI Online: ${client.user.tag}`
  );
  console.log(`🧠 AI: ${MODEL}`);
  console.log("🎫 Ticket System: ON");
  console.log("================================");

  await registerCommands();
});

// ======================================
// AI
// ======================================

async function askAI(
  channelId,
  username,
  text
) {

  if (!data.memory[channelId]) {
    data.memory[channelId] = [];
  }

  const history =
    data.memory[channelId]
      .slice(-10)
      .map(
        item =>
          `${item.role}: ${item.content}`
      )
      .join("\n");

  const response =
    await groq.chat.completions.create({

      model: MODEL,

      messages: [

        {
          role: "system",

          content: `
أنت TicketAI، مساعد دعم فني ذكي داخل Discord.

افهم Discord والتكتات والسيرفرات
والقنوات والرتب والصلاحيات والبوتات.

تحدث بالعربية الطبيعية.
افهم اللهجة الأردنية والعامية.

ساعد المستخدم مباشرة.

إذا كانت المشكلة تحتاج Screenshot
اطلب منه إرسال صورة.

إذا لم تفهم المشكلة
اسأل سؤالًا واضحًا.

إذا المستخدم سب:
لا تسبه ولا تغضب.
ابقَ محترمًا وحاول مساعدته.

لا تخترع معلومات.
لا تقل إنك نفذت شيئًا لم تنفذه.
لا تكتب Draft.
لا تعرض التفكير الداخلي.

المحادثة السابقة:
${history || "لا يوجد سياق سابق."}

اسم المستخدم:
${username}

رسالة المستخدم:
${text}

اكتب الرد النهائي فقط.
`
        },

        {
          role: "user",
          content: text
        }

      ],

      max_completion_tokens: 500,
      temperature: 0.7
    });

  return (
    response.choices?.[0]
      ?.message?.content
      ?.trim() || ""
  );
}

// ======================================
// إنشاء التكت
// ======================================

async function createTicket(interaction) {

  const guild = interaction.guild;

  const categoryId =
    data.categories[guild.id];

  if (!categoryId) {

    await interaction.reply({
      content:
        "❌ لم يتم تحديد كاتيجوري التكت.\nاستخدم `/setup category` أولًا.",
      ephemeral: true
    });

    return;
  }

  const category =
    guild.channels.cache.get(
      categoryId
    );

  if (!category) {

    await interaction.reply({
      content:
        "❌ الكاتيجوري المحفوظة لم تعد موجودة.",
      ephemeral: true
    });

    return;
  }

  const existing =
    guild.channels.cache.find(
      channel =>
        channel.name ===
        `ticket-${interaction.user.id}`
    );

  if (existing) {

    await interaction.reply({
      content:
        `❌ عندك تكت مفتوح بالفعل: ${existing}`,
      ephemeral: true
    });

    return;
  }

  const channel =
    await guild.channels.create({

      name:
        `ticket-${interaction.user.id}`,

      type:
        ChannelType.GuildText,

      parent:
        category.id,

      permissionOverwrites: [

        {
          id:
            guild.roles.everyone.id,

          deny: [
            PermissionFlagsBits.ViewChannel
          ]
        },

        {
          id:
            interaction.user.id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        },

        {
          id:
            client.user.id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels
          ]
        }

      ]
    });

  data.stats.opened++;

  data.memory[channel.id] = [];

  saveData();

  const embed =
    new EmbedBuilder()
      .setTitle("🎫 TicketAI Support")
      .setDescription(
        `أهلًا <@${interaction.user.id}> 👋\n\n` +
        "اكتب مشكلتك هنا، وسيحاول TicketAI مساعدتك."
      );

  const row =
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("إغلاق التكت")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)

      );

  await channel.send({
    content:
      `<@${interaction.user.id}>`,
    embeds: [embed],
    components: [row]
  });

  await interaction.reply({
    content:
      `✅ تم إنشاء التكت: ${channel}`,
    ephemeral: true
  });
}

// ======================================
// إغلاق التكت
// ======================================

async function closeTicket(channel) {

  if (!isTicket(channel)) return;

  const row =
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId("rate_1")
          .setLabel("1 ⭐")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("rate_2")
          .setLabel("2 ⭐")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("rate_3")
          .setLabel("3 ⭐")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("rate_4")
          .setLabel("4 ⭐")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("rate_5")
          .setLabel("5 ⭐")
          .setStyle(ButtonStyle.Primary)

      );

  await channel.send({

    embeds: [
      new EmbedBuilder()
        .setTitle("⭐ تقييم الدعم")
        .setDescription(
          "كيف كانت تجربتك؟ اختر تقييمًا من 1 إلى 5."
        )
    ],

    components: [row]

  });

  data.stats.closed++;

  saveData();

  setTimeout(async () => {

    try {
      await channel.delete(
        "Ticket closed"
      );
    } catch {}

  }, 10000);
}

// ======================================
// Slash Commands + Buttons
// ======================================

client.on(
  "interactionCreate",
  async interaction => {

    try {

      // ================================
      // Slash Commands
      // ================================

      if (
        interaction.isChatInputCommand()
      ) {

        // /setup category
        if (
          interaction.commandName ===
          "setup"
        ) {

          if (
            !interaction.memberPermissions.has(
              PermissionFlagsBits.ManageGuild
            )
          ) {

            await interaction.reply({
              content:
                "❌ تحتاج صلاحية Manage Server.",
              ephemeral: true
            });

            return;
          }

          const category =
            interaction.options.getChannel(
              "category"
            );

          data.categories[
            interaction.guild.id
          ] = category.id;

          saveData();

          await interaction.reply({
            content:
              `✅ تم تحديد كاتيجوري التكتات: ${category}`,
            ephemeral: true
          });

          return;
        }

        // /panel
        if (
          interaction.commandName ===
          "panel"
        ) {

          if (
            !interaction.memberPermissions.has(
              PermissionFlagsBits.ManageGuild
            )
          ) {

            await interaction.reply({
              content:
                "❌ تحتاج صلاحية Manage Server.",
              ephemeral: true
            });

            return;
          }

          const embed =
            new EmbedBuilder()
              .setTitle("🎫 الدعم الفني")
              .setDescription(
                "اضغط على الزر لفتح تكت جديد مع TicketAI."
              );

          const row =
            new ActionRowBuilder()
              .addComponents(

                new ButtonBuilder()
                  .setCustomId(
                    "open_ticket"
                  )
                  .setLabel("فتح تكت")
                  .setEmoji("🎫")
                  .setStyle(
                    ButtonStyle.Primary
                  )

              );

          await interaction.reply({
            embeds: [embed],
            components: [row]
          });

          return;
        }

        // /close
        if (
          interaction.commandName ===
          "close"
        ) {

          if (
            !isTicket(
              interaction.channel
            )
          ) {

            await interaction.reply({
              content:
                "❌ استخدم الأمر داخل التكت.",
              ephemeral: true
            });

            return;
          }

          await interaction.reply({
            content:
              "🔒 سيتم إغلاق التكت خلال 10 ثواني."
          });

          await closeTicket(
            interaction.channel
          );

          return;
        }

        // /rename
        if (
          interaction.commandName ===
          "rename"
        ) {

          if (
            !isTicket(
              interaction.channel
            )
          ) {

            await interaction.reply({
              content:
                "❌ استخدم الأمر داخل التكت.",
              ephemeral: true
            });

            return;
          }

          if (
            !interaction.memberPermissions.has(
              PermissionFlagsBits.ManageChannels
            )
          ) {

            await interaction.reply({
              content:
                "❌ تحتاج Manage Channels.",
              ephemeral: true
            });

            return;
          }

          let name =
            interaction.options.getString(
              "name"
            );

          name =
            name
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(
                /[^a-zA-Z0-9\u0600-\u06FF-]/g,
                ""
              )
              .substring(0, 90);

          if (!name) {

            await interaction.reply({
              content:
                "❌ الاسم غير صالح.",
              ephemeral: true
            });

            return;
          }

          await interaction.channel.setName(
            name
          );

          await interaction.reply({
            content:
              `✅ تم تغيير اسم التكت إلى **${name}**`
          });

          return;
        }

        // /stats
        if (
          interaction.commandName ===
          "stats"
        ) {

          if (
            !interaction.memberPermissions.has(
              PermissionFlagsBits.ManageGuild
            )
          ) {

            await interaction.reply({
              content:
                "❌ تحتاج Manage Server.",
              ephemeral: true
            });

            return;
          }

          const ratings =
            data.stats.ratings || [];

          const average =
            ratings.length
              ? (
                  ratings.reduce(
                    (a, b) => a + b,
                    0
                  ) / ratings.length
                ).toFixed(2)
              : "لا يوجد";

          await interaction.reply({

            embeds: [

              new EmbedBuilder()
                .setTitle(
                  "📊 TicketAI Statistics"
                )
                .addFields(

                  {
                    name:
                      "🎫 التكتات المفتوحة",
                    value:
                      String(
                        data.stats.opened
                      ),
                    inline: true
                  },

                  {
                    name:
                      "🔒 التكتات المغلقة",
                    value:
                      String(
                        data.stats.closed
                      ),
                    inline: true
                  },

                  {
                    name:
                      "⭐ متوسط التقييم",
                    value:
                      `${average}/5`,
                    inline: true
                  }

                )

            ]

          });

          return;
        }
      }

      // ================================
      // فتح تكت
      // ================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "open_ticket"
      ) {

        await createTicket(
          interaction
        );

        return;
      }

      // ================================
      // إغلاق
      // ================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "close_ticket"
      ) {

        await interaction.reply({
          content:
            "🔒 جاري إغلاق التكت..."
        });

        await closeTicket(
          interaction.channel
        );

        return;
      }

      // ================================
      // تقييم
      // ================================

      if (
        interaction.isButton() &&
        interaction.customId.startsWith(
          "rate_"
        )
      ) {

        const rating =
          Number(
            interaction.customId
              .split("_")[1]
          );

        data.stats.ratings.push(
          rating
        );

        saveData();

        await interaction.reply({
          content:
            `⭐ شكرًا! تقييمك **${rating}/5**`,
          ephemeral: true
        });

        return;
      }

    } catch (error) {

      console.error(
        "❌ Interaction Error:",
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {

        await interaction.reply({
          content:
            "❌ حدث خطأ.",
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
);

// ======================================
// AI داخل التكت
// ======================================

client.on(
  "messageCreate",
  async message => {

    if (message.author.bot) return;
    if (!message.guild) return;
    if (!isTicket(message.channel)) return;

    const text =
      message.content.trim();

    if (!text) return;

    try {

      await message.channel
        .sendTyping()
        .catch(() => {});

      if (
        !data.memory[
          message.channel.id
        ]
      ) {
        data.memory[
          message.channel.id
        ] = [];
      }

      const memory =
        data.memory[
          message.channel.id
        ];

      memory.push({
        role: "المستخدم",
        content: text
      });

      const answer =
        await askAI(
          message.channel.id,
          message.author.username,
          text
        );

      if (!answer) {

        await message.reply(
          "❌ ما قدرت أجهز رد حاليًا."
        );

        return;
      }

      await message.reply({
        content:
          answer.substring(0, 1900),

        allowedMentions: {
          repliedUser: false
        }
      });

      memory.push({
        role: "TicketAI",
        content:
          answer.substring(0, 1900)
      });

      // الاحتفاظ بآخر 12 رسالة
      if (memory.length > 12) {
        memory.splice(
          0,
          memory.length - 12
        );
      }

      saveData();

    } catch (error) {

      console.error(
        "❌ AI ERROR:",
        error
      );

      await message.reply(
        "❌ صار خطأ مؤقت بالذكاء الاصطناعي."
      ).catch(() => {});
    }
  }
);

// ======================================
// التحقق
// ======================================

if (!process.env.DISCORD_TOKEN) {

  console.error(
    "❌ DISCORD_TOKEN غير موجود."
  );

  process.exit(1);
}

if (!process.env.GROQ_API_KEY) {

  console.error(
    "❌ GROQ_API_KEY غير موجود."
  );

  process.exit(1);
}

// ======================================
// Login
// ======================================

client.login(
  process.env.DISCORD_TOKEN
);
