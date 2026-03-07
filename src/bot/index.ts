import { Telegraf, session, Scenes } from 'telegraf';
import { CustomContext } from '../types';
import { authMiddleware } from './middlewares/auth.middleware';
import { startCommand, adminCommand } from './commands/start.command';
import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';
import { UserService } from '../services/user.service';

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
    throw new Error('BOT_TOKEN must be provided!');
}

export const bot = new Telegraf<CustomContext>(token);

// Basic session memory (required for scenes/wizards)
bot.use(session());

// Apply our custom authentication/gatekeeping middleware
bot.use(authMiddleware);

// Register Commands
bot.start(startCommand);
bot.command('admin', adminCommand);

// Handle "Generate Invite Link" button click
bot.hears('🔗 Generate Invite Link', async (ctx) => {
    if (!ctx.dbUser) return;

    try {
        // Here you could add logic to limit how many invites a user can generate
        // For example: check ctx.dbUser.codes_created.length if we loaded the relation

        await ctx.reply('Generating your unique invite link...');

        const codes = await UserService.generateInvitationCode(ctx.dbUser.id, 1);
        if (codes.length === 0) throw new Error("Code generation failed");

        const code = codes[0];
        const botInfo = await ctx.telegram.getMe();
        const link = `https://t.me/${botInfo.username}?start=${code.code}`;

        await ctx.reply(
            `Here is your invite link:\n\n🔗 ${link}\n\nNote: This link can only be used by one person.`
        );
    } catch (e) {
        logger.error("Error generating user invite", e);
        await ctx.reply("Failed to generate invite. Please try again later.");
    }
});

bot.command('generate_invites', async (ctx) => {
    // Basic protection - hardcode to first user ID or add to env variable
    if (ctx.dbUser?.id !== 1) {
        return ctx.reply("Unauthorized.");
    }
    const countStr = ctx.message.text.split(' ')[1];
    const count = parseInt(countStr) || 1;

    try {
        const codes = await UserService.generateInvitationCode(ctx.dbUser.id, count);
        const botInfo = await ctx.telegram.getMe();

        const codeStrings = codes.map(c => {
            const link = `https://t.me/${botInfo.username}?start=${c.code}`;
            return `• \`${c.code}\`\n  🔗 ${link}`;
        }).join('\n\n');

        await ctx.replyWithMarkdown(`Generated ${codes.length} invitation codes:\n\n${codeStrings}`);
    } catch (e) {
        logger.error("Error generating codes", e);
        await ctx.reply("Failed to generate codes.");
    }
});

// Start bot helper
export const startBot = () => {
    bot.launch()
        .then(() => logger.info('Telegram Bot successfully launched!'))
        .catch((err) => logger.error('Error launching Telegram Bot:', err));

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
};
