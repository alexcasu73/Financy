import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkTelegramSettings() {
  try {
    console.log("🔍 Checking Telegram settings for all users...\n");

    const users = await prisma.user.findMany({
      include: {
        settings: true,
      },
    });

    if (users.length === 0) {
      console.log("❌ No users found in database");
      return;
    }

    console.log(`Found ${users.length} user(s)\n`);

    for (const user of users) {
      console.log(`👤 User: ${user.email} (${user.id})`);

      if (!user.settings) {
        console.log("   ⚠️  No settings found - will be created on first access");
      } else {
        console.log(`   Telegram Enabled: ${user.settings.telegramEnabled ? '✅' : '❌'}`);
        console.log(`   Telegram Chat ID: ${user.settings.telegramChatId || '❌ Not set'}`);
      }
      console.log();
    }

    // Check environment variables
    console.log("\n🔧 Environment Configuration:");
    console.log(`   TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Not set'}`);
    console.log(`   TELEGRAM_CHAT_ID: ${process.env.TELEGRAM_CHAT_ID ? '✅ Set (legacy)' : '❌ Not set'}`);

    // Summary
    const usersWithTelegram = users.filter(u => u.settings?.telegramEnabled && u.settings?.telegramChatId);
    console.log(`\n📊 Summary:`);
    console.log(`   Users with Telegram enabled: ${usersWithTelegram.length}/${users.length}`);

    if (usersWithTelegram.length === 0) {
      console.log("\n💡 To enable Telegram notifications:");
      console.log("   1. Make sure TELEGRAM_BOT_TOKEN is set in .env");
      console.log("   2. Send /start to your bot on Telegram");
      console.log("   3. Call GET /api/settings/telegram/chat-id to get your chat ID");
      console.log("   4. Update your settings with PUT /api/settings");
      console.log("      { \"telegramChatId\": \"your_chat_id\", \"telegramEnabled\": true }");
      console.log("   5. Test with POST /api/settings/telegram/test");
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTelegramSettings();
