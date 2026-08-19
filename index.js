const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");

const fs = require("fs");
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

// =====================================================
// CONFIG
// =====================================================

const ADMIN_ROLE_ID = ""; 
// ضع ID رتبة الإدارة هنا.
// مثال:
// const ADMIN_ROLE_ID = "123456789012345678";

const LOG_CHANNEL_ID = "";
// اختياري: ضع ID قناة اللوج هنا.

const PROMPT_FILE = "./prompt.json";

// =====================================================
// DEFAULT PROMPT
// =====================================================

const DEFAULT_PROMPT = `
أنت بوت دعم فني احترافي داخل سيرفر Discord.

مهمتك مساعدة العملاء داخل التكتات وحل مشاكلهم.

القواعد:
- تحدث بالعربية.
- كن محترمًا وودودًا.
- افهم مشكلة العميل.
- حاول حل المشكلة خطوة بخطوة.
- اجعل الرد واضحًا ومختصرًا.
- لا تخترع معلومات.
- إذا لم تعرف الحل، أخبر العميل أن الموظف المختص يستطيع المساعدة.
- لا تدّعي أنك إنسان.
- لا تغلق التكت من نفسك.
- لا تطلب كلمات مرور أو مفاتيح API أو رموز تحقق.
- لا تكرر نفس الكلام.
- استخدم الإيموجي باعتدال.
`;

// =====================================================
// PROMPT STORAGE
// =====================================================

function loadPrompt() {
  try {
    if (!fs.existsSync(PROMPT_FILE)) {
      fs.writeFileSync(
        PROMPT_FILE,
        JSON.stringify(
          { prompt: DEFAULT_PROMPT },
          null,
          2
        )
      );

      return DEFAULT_PROMPT;
    }

    const data = JSON.parse(
      fs.readFileSync(PROMPT_FILE, "utf8")
    );

    return data.prompt || DEFAULT_PROMPT;

  } catch (error) {
    console.error("Prompt load error:", error);
    return DEFAULT_PROMPT;
  }
}

function savePrompt(prompt) {
  fs.writeFileSync(
    PROMPT_FILE,
    JSON.stringify(
      { prompt },
      null,
      2
    )
  );
}

// =====================================================
// GEMINI
// =====================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// =====================================================
// DISCORD
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// =====================================================
// TICKET
// =====================================================

function isTicket(channel) {
  if (!channel) return false;

  if (
    channel.type !== ChannelType.GuildText
  ) {
    return false;
  }

  const name = channel.name.toLowerCase();

  return (
    name.includes("ticket") ||
    name.includes("تكت")
  );
}

// =====================================================
// ADMIN
// =====================================================

function isAdmin(member) {
  if (!member) return false;

  // إذا وضعت Role ID
  if (ADMIN_ROLE_ID) {
    return member.roles.cache.has(
      ADMIN_ROLE_ID
    );
  }

  // إذا تركته فارغًا
  return member.permissions.has(
    PermissionsBitField.Flags.Administrator
  );
}

// =====================================================
// BOT READY
// =====================================================

client.once("ready", async () => {

  console.log("================================");
  console.log(`✅ البوت شغال: ${client.user.tag}`);
  console.log("🤖 Gemini متصل");
  console.log("🎫 نظام التكتات جاهز");
  console.log("🛡️ نظام الإدارة جاهز");
  console.log("⭐ نظام التقييم جاهز");
  console.log("================================");

  // ===================================================
  // SLASH COMMANDS
  // ===================================================

  const commands = [

    new SlashCommandBuilder()
      .setName("promot")
      .setDescription("تغيير تعليمات الذكاء الاصطناعي")
      .addStringOption(option =>
        option
          .setName("text")
          .setDescription("البرومبت الجديد")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("promot-view")
      .setDescription("عرض البرومبت الحالي"),

    new SlashCommandBuilder()
      .setName("promot-reset")
      .setDescription("إرجاع البرومبت الافتراضي"),

  ].map(command => command.toJSON());

  try {

    const rest = new REST({
      version: "10",
    }).setToken(
      process.env.DISCORD_TOKEN
    );

    await rest.put(
      Routes.applicationCommands(
        client.user.id
      ),
      {
        body: commands,
      }
    );

    console.log("✅ Slash Commands registered");

  } catch (error) {
    console.error(
      "❌ Slash Commands Error:",
      error
    );
  }
});

// =====================================================
// SLASH COMMANDS
// =====================================================

client.on(
  "interactionCreate",
  async interaction => {

    if (!interaction.isChatInputCommand()) {
      return;
    }

    // =================================================
    // /promot
    // =================================================

    if (
      interaction.commandName === "promot"
    ) {

      if (
        !isAdmin(
          interaction.member
        )
      ) {

        await interaction.reply({
          content:
            "❌ ليس لديك صلاحية استخدام هذا الأمر.",
          ephemeral: true,
        });

        return;
      }

      const text =
        interaction.options.getString(
          "text"
        );

      savePrompt(text);

      await interaction.reply({
        content:
          "✅ تم تحديث تعليمات Gemini بنجاح.",
        ephemeral: true,
      });

      return;
    }

    // =================================================
    // /promot-view
    // =================================================

    if (
      interaction.commandName ===
      "promot-view"
    ) {

      if (
        !isAdmin(
          interaction.member
        )
      ) {

        await interaction.reply({
          content:
            "❌ ليس لديك صلاحية.",
          ephemeral: true,
        });

        return;
      }

      const prompt =
        loadPrompt();

      await interaction.reply({
        content:
          "```text\n" +
          prompt.substring(
            0,
            1900
          ) +
          "\n```",
        ephemeral: true,
      });

      return;
    }

    // =================================================
    // /promot-reset
    // =================================================

    if (
      interaction.commandName ===
      "promot-reset"
    ) {

      if (
        !isAdmin(
          interaction.member
        )
      ) {

        await interaction.reply({
          content:
            "❌ ليس لديك صلاحية.",
          ephemeral: true,
        });

        return;
      }

      savePrompt(
        DEFAULT_PROMPT
      );

      await interaction.reply({
        content:
          "✅ تم إرجاع البرومبت الافتراضي.",
        ephemeral: true,
      });

      return;
    }
  }
);

// =====================================================
// LOG
// =====================================================

async function sendLog(
  guild,
  text
) {

  if (!LOG_CHANNEL_ID) {
    return;
  }

  try {

    const channel =
      guild.channels.cache.get(
        LOG_CHANNEL_ID
      );

    if (channel) {
      await channel.send(text);
    }

  } catch (error) {
    console.log(
      "Log error:",
      error.message
    );
  }
}

// =====================================================
// CLOSE WORDS
// =====================================================

const closeWords = [
  "اغلق التكت",
  "أغلق التكت",
  "اقفل التكت",
  "أقفل التكت",
  "سكر التكت",
  "اغلاق التكت",
  "إغلاق التكت",
  "close ticket",
];

// =====================================================
// MESSAGE CREATE
// =====================================================

client.on(
  "messageCreate",
  async message => {

    try {

      if (message.author.bot) {
        return;
      }

      if (!message.guild) {
        return;
      }

      const content =
        message.content.trim();

      if (!content) {
        return;
      }

      // =================================================
      // ADMIN COMMANDS
      // فقط عند منشن البوت
      // =================================================

      if (
        message.mentions.has(
          client.user
        )
      ) {

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

        // ===============================================
        // إذا المستخدم غير إداري
        // ===============================================

        if (!isAdmin(message.member)) {

          // لا نزعج المستخدم برسالة في كل منشن
          if (
            /اطرد|طرد|احظر|حظر|ban|kick|timeout|تايم/i
              .test(command)
          ) {

            await message.reply(
              "❌ ليس لديك صلاحية استخدام أوامر الإدارة."
            );
          }

          return;
        }

        // =================================================
        // KICK
        // =================================================

        if (
          /(^|\s)(اطرد|طرد|kick)(\s|$)/i
            .test(command)
        ) {

          const target =
            message.mentions.members
              .filter(
                member =>
                  member.id !==
                  client.user.id
              )
              .first();

          if (!target) {

            await message.reply(
              "❌ اعمل منشن للشخص الذي تريد طرده."
            );

            return;
          }

          if (!target.kickable) {

            await message.reply(
              "❌ لا أستطيع طرد هذا العضو. تأكد من ترتيب الرتب وصلاحيات البوت."
            );

            return;
          }

          await target.kick(
            `By ${message.author.tag}`
          );

          await message.reply(
            `👢 تم طرد ${target.user.tag}.`
          );

          await sendLog(
            message.guild,
            `👢 **Kick**\nالمنفذ: ${message.author}\nالعضو: ${target.user.tag}`
          );

          return;
        }

        // =================================================
        // BAN
        // =================================================

        if (
          /(^|\s)(احظر|حظر|ban)(\s|$)/i
            .test(command)
        ) {

          const target =
            message.mentions.members
              .filter(
                member =>
                  member.id !==
                  client.user.id
              )
              .first();

          if (!target) {

            await message.reply(
              "❌ اعمل منشن للشخص الذي تريد حظره."
            );

            return;
          }

          if (!target.bannable) {

            await message.reply(
              "❌ لا أستطيع حظر هذا العضو. تأكد من ترتيب الرتب وصلاحيات البوت."
            );

            return;
          }

          await target.ban({
            reason:
              `By ${message.author.tag}`,
          });

          await message.reply(
            `🔨 تم حظر ${target.user.tag}.`
          );

          await sendLog(
            message.guild,
            `🔨 **Ban**\nالمنفذ: ${message.author}\nالعضو: ${target.user.tag}`
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
            message.mentions.members
              .filter(
                member =>
                  member.id !==
                  client.user.id
              )
              .first();

          if (!target) {

            await message.reply(
              "❌ اعمل منشن للشخص."
            );

            return;
          }

          if (!target.moderatable) {

            await message.reply(
              "❌ لا أستطيع إعطاء Timeout لهذا العضو."
            );

            return;
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
            `⏱️ **Timeout**\nالمنفذ: ${message.author}\nالعضو: ${target.user.tag}`
          );

          return;
        }

        // =================================================
        // CLEAR
        // =================================================

        const clearMatch =
          command.match(
            /(?:امسح|مسح|clear)\s+(\d+)/i
          );

        if (clearMatch) {

          const amount =
            Number(
              clearMatch[1]
            );

          if (
            amount < 1 ||
            amount > 100
          ) {

            await message.reply(
              "❌ العدد يجب أن يكون من 1 إلى 100."
            );

            return;
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

        // =================================================
        // إذا ما كان أمر معروف
        // نخلي Gemini يفهم الطلب
        // =================================================

        await message.channel.sendTyping();

        const result =
          await ai.models.generateContent({

            model:
              "gemini-3.6-flash",

            contents: `
أنت مساعد إدارة Discord.

المستخدم منشنك وطلب منك شيئًا.

لكن لا تنفذ أي إجراء إداري بنفسك.
الأوامر الإدارية يتم تنفيذها فقط من كود البوت بعد التحقق من الصلاحيات.

إذا كان الطلب غير واضح، اطلب توضيحًا.

الطلب:
${command}
            `,

            config: {
              maxOutputTokens: 200,
            },
          });

        const reply =
          result.text;

        if (reply) {
          await message.reply(
            reply.substring(
              0,
              1900
            )
          );
        }

        return;
      }

      // =================================================
      // TICKET SYSTEM
      // =================================================

      if (
        !isTicket(
          message.channel
        )
      ) {
        return;
      }

      // =================================================
      // CLOSE TICKET
      // =================================================

      const lower =
        content.toLowerCase();

      const wantsClose =
        closeWords.some(
          word =>
            lower.includes(
              word.toLowerCase()
            )
        );

      if (wantsClose) {

        // صاحب التكت أو الإدارة
        // يمكنهم طلب الإغلاق

        await message.channel.send(
          "🔒 سيتم إغلاق التكت خلال 3 ثوانٍ..."
        );

        setTimeout(
          async () => {

            try {

              await message.channel.permissionOverwrites.edit(
                message.guild.roles.everyone,
                {
                  SendMessages:
                    false,
                }
              );

              const row =
                new ActionRowBuilder()
                  .addComponents(

                    new ButtonBuilder()
                      .setCustomId(
                        "rating_1"
                      )
                      .setLabel(
                        "⭐"
                      )
                      .setStyle(
                        ButtonStyle.Danger
                      ),

                    new ButtonBuilder()
                      .setCustomId(
                        "rating_2"
                      )
                      .setLabel(
                        "⭐⭐"
                      )
                      .setStyle(
                        ButtonStyle.Danger
                      ),

                    new ButtonBuilder()
                      .setCustomId(
                        "rating_3"
                      )
                      .setLabel(
                        "⭐⭐⭐"
                      )
                      .setStyle(
                        ButtonStyle.Secondary
                      ),

                    new ButtonBuilder()
                      .setCustomId(
                        "rating_4"
                      )
                      .setLabel(
                        "⭐⭐⭐⭐"
                      )
                      .setStyle(
                        ButtonStyle.Primary
                      ),

                    new ButtonBuilder()
                      .setCustomId(
                        "rating_5"
                      )
                      .setLabel(
                        "⭐⭐⭐⭐⭐"
                      )
                      .setStyle(
                        ButtonStyle.Success
                      )
                  );

              await message.channel.send({
                content:
                  "⭐ **قيّم تجربتك معنا من 1 إلى 5:**",
                components: [
                  row,
                ],
              });

            } catch (
              error
            ) {

              console.error(
                "Close error:",
                error
              );
            }

          },
          3000
        );

        return;
      }

      // =================================================
      // GEMINI SUPPORT
      // =================================================

      await message.channel.sendTyping();

      // =================================================
      // آخر 8 رسائل فقط
      // أسرع من 15
      // =================================================

      const messages =
        await message.channel.messages.fetch({
          limit: 8,
        });

      const conversation =
        [...messages.values()]
          .reverse()
          .map(
            msg =>
              `${msg.author.username}: ${msg.content}`
          )
          .join("\n");

      const systemPrompt =
        loadPrompt();

      const result =
        await ai.models.generateContent({

          model:
            "gemini-3.6-flash",

          contents: `
${systemPrompt}

محادثة التكت الأخيرة:
${conversation}

آخر رسالة:
${content}

أجب الآن على العميل مباشرة.
          `,

          config: {
            maxOutputTokens: 300,
          },
        });

      const reply =
        result.text;

      if (!reply) {
        return;
      }

      // =================================================
      // إرسال الرد
      // =================================================

      if (
        reply.length <= 2000
      ) {

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

      console.error(
        "❌ MAIN ERROR:",
        error
      );

      try {

        await message.channel.send(
          "❌ صار خطأ مؤقت، حاول مرة ثانية."
        );

      } catch {}
    }
  }
);

// =====================================================
// RATINGS
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
      ephemeral: true,
    });

    await sendLog(
      interaction.guild,
      `⭐ **Ticket Rating**\nالمستخدم: ${interaction.user}\nالتقييم: ${rating}/5`
    );

    try {

      await interaction.message.edit({
        components: [],
      });

    } catch {}

    // حذف التكت بعد 5 ثواني

    setTimeout(
      async () => {

        try {

          await interaction.channel.delete(
            "Ticket closed"
          );

        } catch {}

      },
      5000
    );
  }
);

// =====================================================
// LOGIN
// =====================================================

client.login(
  process.env.DISCORD_TOKEN
);
