const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

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

// Verify command
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
                .setDescription(`Welcome! You have been verified and given the MDC verified role.`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

            // Log to console channel
            const logChannel = interaction.guild.channels.cache.find(ch => ch.name.includes('console'));
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('New Verification')
                    .setDescription(`<@${member.id}> verified with code: ${code}`)
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
});

client.login(TOKEN);