const { Client, GatewayIntentBits, Events, SlashCommandBuilder, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1514642368085754058';

client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot is online as: ${client.user.tag}`);

  // Register slash command
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: [new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify your account with the code from the website')
        .addStringOption(option =>
          option.setName('code')
            .setDescription('The verification code from MDCHUB website')
            .setRequired(true)
        )] }
    );
    console.log('✅ Slash commands registered');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'verify') {
    const code = interaction.options.getString('code');

    try {
      const role = interaction.guild.roles.cache.find(r => r.name === 'MDC verified');

      if (!role) {
        return interaction.reply({ 
          content: '❌ Role "MDC verified" not found. Please create it first.', 
          ephemeral: true 
        });
      }

      await interaction.member.roles.add(role);

      await interaction.reply({ 
        content: `✅ Verification successful!\nCode: \`${code}\`\nYou have been given the **MDC verified** role.`, 
        ephemeral: true 
      });

    } catch (error) {
      console.error(error);
      await interaction.reply({ 
        content: '❌ Error: Make sure the bot role is higher than "MDC verified" and has "Manage Roles" permission.', 
        ephemeral: true 
      });
    }
  }
});

client.login('MTUxNDY0MjM2ODA4NTc1NDA1OA.GGbPEc.a7lZWog26d-m0N0TpQvdsSPbbW3J--8veLHC-k');
