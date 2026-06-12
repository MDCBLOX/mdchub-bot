const { Client, GatewayIntentBits, Events, SlashCommandBuilder, REST, Routes, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1514642368085754058';
const LOG_CHANNEL_NAME = '《🚫》console';

// Warning system
let warnings = {};
if (fs.existsSync('./warnings.json')) {
  warnings = JSON.parse(fs.readFileSync('./warnings.json', 'utf8'));
}

function saveWarnings() {
  fs.writeFileSync('./warnings.json', JSON.stringify(warnings, null, 2));
}

function getWarningCount(userId) {
  return warnings[userId] || 0;
}

function addWarning(userId) {
  warnings[userId] = (warnings[userId] || 0) + 1;
  saveWarnings();
  return warnings[userId];
}

function resetWarnings(userId) {
  delete warnings[userId];
  saveWarnings();
}

// Bad words list
const badWords = [
  "amk", "aq", "sik", "siktir", "oruspu", "orospu", "piç", "pezevenk", "göt", "got", "amına",
  "fuck", "shit", "bitch", "asshole", "dick", "pussy", "cunt", "whore", "bastard",
  "porn", "porno", "sex", "sikiş", "sikis", "amcık", "amcik", "yarrak", "yarra", "31", "mastürbasyon"
];

const blockedFiles = ['.exe', '.zip', '.rar', '.7z', '.js', '.bat', '.cmd', '.scr'];

if (!TOKEN) {
  console.error('ERROR: TOKEN environment variable is missing!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function sendLog(guild, embed) {
  const logChannel = guild.channels.cache.find(ch => ch.name === LOG_CHANNEL_NAME);
  if (logChannel) {
    await logChannel.send({ embeds: [embed] }).catch(() => {});
  }
}

function hasPermission(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.some(role => 
    role.name === 'Owner' || role.name === 'Moderator'
  );
}

client.once(Events.ClientReady, async () => {
  console.log(`Bot is online as: ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const commands = [
    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Warn a user (Owner/Moderator only)')
      .addUserOption(option => option.setName('user').setDescription('User to warn').setRequired(true))
      .addStringOption(option => option.setName('reason').setDescription('Reason for warning').setRequired(true)),
    
    new SlashCommandBuilder()
      .setName('warnings')
      .setDescription('Check warnings of a user')
      .addUserOption(option => option.setName('user').setDescription('User to check').setRequired(true)),
    
    new SlashCommandBuilder()
      .setName('unwarn')
      .setDescription('Remove all warnings from a user (Owner/Moderator only)')
      .addUserOption(option => option.setName('user').setDescription('User to unwarn').setRequired(true)),
    
    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Ban a user (Owner/Moderator only)')
      .addUserOption(option => option.setName('user').setDescription('User to ban').setRequired(true))
      .addStringOption(option => option.setName('reason').setDescription('Reason for ban').setRequired(false))
  ];

  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Slash commands registered');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

// Auto Moderation
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.toLowerCase();
  let triggered = false;
  let reason = '';

  for (let word of badWords) {
    if (content.includes(word)) {
      triggered = true;
      reason = 'Küfür / +18 içerik';
      break;
    }
  }

  if (message.attachments.size > 0) {
    message.attachments.forEach(attachment => {
      const filename = attachment.name.toLowerCase();
      if (blockedFiles.some(ext => filename.endsWith(ext))) {
        triggered = true;
        reason = 'Yasaklı dosya türü';
      }
    });
  }

  if (triggered) {
    try {
      await message.delete().catch(() => {});
      
      const warnCount = addWarning(message.author.id);
      
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⚠️ Otomatik Uyarı')
        .setDescription(`${message.author} bir kuralı ihlal etti.`)
        .addFields(
          { name: 'Sebep', value: reason },
          { name: 'Uyarı Sayısı', value: `${warnCount}/2` }
        )
        .setTimestamp();

      await sendLog(message.guild, embed);

      if (warnCount >= 2) {
        await message.member.ban({ reason: `Otomatik ban: ${reason}` }).catch(() => {});
        
        const banEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🔨 Otomatik Ban')
          .setDescription(`${message.author.tag} 2. uyarı nedeniyle banlandı.`)
          .addFields({ name: 'Sebep', value: reason })
          .setTimestamp();
        
        await sendLog(message.guild, banEmbed);
        resetWarnings(message.author.id);
      } else {
        await message.channel.send(`${message.author}, uyarı aldın! (${warnCount}/2) Sebep: ${reason}`).catch(() => {});
      }
    } catch (error) {
      console.error('Auto moderation error:', error);
    }
  }
});

// Slash Commands
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, guild, member } = interaction;

  // Permission check for dangerous commands
  if (['warn', 'unwarn', 'ban'].includes(commandName)) {
    if (!hasPermission(member)) {
      return interaction.reply({ 
        content: 'Bu komutu kullanma yetkin yok. Sadece Owner ve Moderator rolleri kullanabilir.', 
        ephemeral: true 
      });
    }
  }

  if (commandName === 'warn') {
    const user = options.getUser('user');
    const reason = options.getString('reason');
    const targetMember = await guild.members.fetch(user.id).catch(() => null);

    if (!targetMember) {
      return interaction.reply({ content: 'Kullanıcı bulunamadı.', ephemeral: true });
    }

    const warnCount = addWarning(user.id);

    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('⚠️ Manuel Uyarı')
      .setDescription(`${user} uyarıldı.`)
      .addFields(
        { name: 'Sebep', value: reason },
        { name: 'Uyarı Sayısı', value: `${warnCount}/2` },
        { name: 'Uyaran', value: `${member.user.tag}` }
      )
      .setTimestamp();

    await sendLog(guild, embed);

    if (warnCount >= 2) {
      await targetMember.ban({ reason: `Manuel ban: ${reason}` }).catch(() => {});
      const banEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔨 Ban')
        .setDescription(`${user.tag} 2. uyarı nedeniyle banlandı.`)
        .addFields({ name: 'Sebep', value: reason })
        .setTimestamp();
      await sendLog(guild, banEmbed);
      resetWarnings(user.id);
    }

    await interaction.reply({ content: `${user} uyarıldı. (${warnCount}/2)`, ephemeral: true });
  }

  if (commandName === 'warnings') {
    const user = options.getUser('user');
    const count = getWarningCount(user.id);
    await interaction.reply({ content: `${user} kullanıcısının ${count} uyarısı var.`, ephemeral: true });
  }

  if (commandName === 'unwarn') {
    const user = options.getUser('user');
    resetWarnings(user.id);
    await interaction.reply({ content: `${user} kullanıcısının uyarıları temizlendi.`, ephemeral: true });
  }

  if (commandName === 'ban') {
    const user = options.getUser('user');
    const reason = options.getString('reason') || 'Sebep belirtilmedi';
    const targetMember = await guild.members.fetch(user.id).catch(() => null);

    if (!targetMember) return interaction.reply({ content: 'Kullanıcı bulunamadı.', ephemeral: true });

    await targetMember.ban({ reason });
    
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🔨 Manuel Ban')
      .setDescription(`${user.tag} banlandı.`)
      .addFields(
        { name: 'Sebep', value: reason },
        { name: 'Banlayan', value: `${member.user.tag}` }
      )
      .setTimestamp();

    await sendLog(guild, embed);
    await interaction.reply({ content: `${user.tag} banlandı.`, ephemeral: true });
  }
});

client.login(TOKEN);