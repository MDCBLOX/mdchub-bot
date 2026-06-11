const { Client, GatewayIntentBits, Events, SlashCommandBuilder, REST, Routes } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1514642368085754058';

if (!TOKEN) {
  console.error('❌ ERROR: TOKEN environment variable is missing!');
  console.error('Please add TOKEN in Railway Variables.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot is online as: ${client.user.tag}`);

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
    console.log('✅ Slash commands registered successfully');
  } catch (error) {
    console.error('Error registering slash commands:', error);
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
          content: '❌ Role "MDC verified" not found in this server. Please create the role first.', 
          ephemeral: true 
        });
      }

      await interaction.member.roles.add(role);

      await interaction.reply({ 
        content: `✅ Verification successful!\nYour code: \`${code}\`\nYou now have the **MDC verified** role.`, 
        ephemeral: true 
      });

    } catch (error) {
      console.error('Role assignment error:', error);
      await interaction.reply({ 
        content: '❌ Failed to give role. Make sure:\n1. Bot role is higher than "MDC verified"\n2. Bot has "Manage Roles" permission', 
        ephemeral: true 
      });
    }
  }
});

client.on('error', error => {
  console.error('Discord client error:', error);
});

client.login(TOKEN)
  .catch(err => {
    console.error('❌ Failed to login with token:', err.message);
    process.exit(1);
  });