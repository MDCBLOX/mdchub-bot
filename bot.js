const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Level system data file
const DATA_FILE = path.join(__dirname, 'levels.json');

// Load or create levels data
let levels = {};
if (fs.existsSync(DATA_FILE)) {
    levels = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveLevels() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(levels, null, 2));
}

// Calculate level from XP
function getLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp));
}

// Calculate XP needed for next level
function getXpForNextLevel(level) {
    return Math.ceil(Math.pow((level + 1) / 0.1, 2));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
    console.error('ERROR: TOKEN is missing! Set it in Railway Variables.');
    process.exit(1);
}

client.once(Events.ClientReady, () => {
    console.log(`Bot is online! Logged in as ${client.user.tag}`);
});

// Level system - XP on message
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;

    // Initialize user data if not exists
    if (!levels[userId]) {
        levels[userId] = {
            xp: 0,
            level: 0,
            username: message.author.username
        };
    }

    // Give random XP (10-20)
    const xpGained = Math.floor(Math.random() * 11) + 10;
    levels[userId].xp += xpGained;
    levels[userId].username = message.author.username;

    const oldLevel = levels[userId].level;
    const newLevel = getLevel(levels[userId].xp);

    // Level up check
    if (newLevel > oldLevel) {
        levels[userId].level = newLevel;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('Level Up!')
            .setDescription(`Congratulations <@${userId}>! You reached **Level ${newLevel}**!`)
            .addFields(
                { name: 'Total XP', value: `${levels[userId].xp}`, inline: true },
                { name: 'Next Level', value: `${getXpForNextLevel(newLevel)} XP`, inline: true }
            )
            .setTimestamp();

        message.channel.send({ embeds: [embed] }).catch(() => {});
    }

    saveLevels();
});

// Slash commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'verify') {
        const code = interaction.options.getString('code');

        if (!code || !code.startsWith('MDC-')) {
            return interaction.reply({ 
                content: 'Invalid code. Codes must start with MDC-', 
                ephemeral: true 
            });
        }

        try {
            const member = interaction.member;
            const role = interaction.guild.roles.cache.find(r => r.name === 'MDC verified');

            if (!role) {
                return interaction.reply({ 
                    content: 'Verified role not found. Please contact an administrator.', 
                    ephemeral: true 
                });
            }

            if (member.roles.cache.has(role.id)) {
                return interaction.reply({ 
                    content: 'You are already verified!', 
                    ephemeral: true 
                });
            }

            await member.roles.add(role);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Verification Successful')
                .setDescription(`Welcome! You have been verified and given the **MDC verified** role.`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

            // Log to console channel
            const logChannel = interaction.guild.channels.cache.find(ch => ch.name.includes('console'));
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('New Verification')
                    .setDescription(`<@${member.id}> verified with code: `${code}``)
                    .setTimestamp();
                logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }

        } catch (error) {
            console.error('Verify error:', error);
            await interaction.reply({ 
                content: 'An error occurred during verification.', 
                ephemeral: true 
            });
        }
    }

    // Level command
    if (commandName === 'level') {
        const user = interaction.options.getUser('user') || interaction.user;
        const userId = user.id;

        if (!levels[userId]) {
            return interaction.reply({ 
                content: `${user.username} has no XP yet.`, 
                ephemeral: true 
            });
        }

        const userLevel = levels[userId].level;
        const userXp = levels[userId].xp;
        const nextLevelXp = getXpForNextLevel(userLevel);

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`${user.username}'s Level`)
            .addFields(
                { name: 'Level', value: `${userLevel}`, inline: true },
                { name: 'XP', value: `${userXp}`, inline: true },
                { name: 'Next Level', value: `${nextLevelXp} XP`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    // Leaderboard command
    if (commandName === 'leaderboard') {
        const sortedUsers = Object.entries(levels)
            .sort((a, b) => b[1].xp - a[1].xp)
            .slice(0, 10);

        if (sortedUsers.length === 0) {
            return interaction.reply({ content: 'No users have XP yet.', ephemeral: true });
        }

        let description = '';
        sortedUsers.forEach((entry, index) => {
            const [userId, data] = entry;
            description += `**${index + 1}.** <@${userId}> - Level ${data.level} (${data.xp} XP)
`;
        });

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('Leaderboard - Top 10')
            .setDescription(description)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
});

client.login(TOKEN);