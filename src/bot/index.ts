import { Telegraf, session, Scenes } from 'telegraf';
import { CustomContext } from '../types';
import { authMiddleware } from './middlewares/auth.middleware';
import { startCommand, adminCommand } from './commands/start.command';
import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';
import { UserService } from '../services/user.service';
import { PlanService } from '../services/plan.service';
import { Markup } from 'telegraf';
import { HttpsProxyAgent } from 'https-proxy-agent';

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
    throw new Error('BOT_TOKEN must be provided!');
}

let botConfig: any = {};
if (process.env.HTTP_PROXY) {
    botConfig.telegram = {
        agent: new HttpsProxyAgent(process.env.HTTP_PROXY)
    };
    logger.info(`Using HTTP_PROXY: ${process.env.HTTP_PROXY} for Telegram API`);
}

export const bot = new Telegraf<CustomContext>(token, botConfig);

// Basic session memory (required for scenes/wizards)
bot.use(session());

// Apply our custom authentication/gatekeeping middleware
bot.use(authMiddleware);

// Register Commands
bot.start(startCommand);
bot.command('admin', adminCommand);

// Handle "Buy Plan" button click
bot.hears('🛒 Buy Plan', async (ctx) => {
    try {
        const plans = await PlanService.getAllPlans();

        if (plans.length === 0) {
            return ctx.reply("There are currently no active plans to purchase. Please check back later.");
        }

        // Group the plans into rows of 1 for the inline keyboard
        const buttons = plans.map(plan => {
            const label = `${plan.name} - ${plan.volume_gb > 0 ? plan.volume_gb + 'GB' : 'Unlimited'} - $${plan.price_usdt}`;
            return [Markup.button.callback(label, `buy_plan_${plan.id}`)];
        });

        await ctx.reply("Please select a plan from the options below:", Markup.inlineKeyboard(buttons));

    } catch (e) {
        logger.error("Error fetching plans", e);
        await ctx.reply("An error occurred while fetching our plans. Please try again.");
    }
});

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
            `Here is your invite link:\n\n🔗 <a href="${link}">${link}</a>\n\n<i>Note: This link can only be used by one person.</i>`,
            { parse_mode: 'HTML' }
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
            return `• <code>${c.code}</code>\n  🔗 <a href="${link}">${link}</a>`;
        }).join('\n\n');

        await ctx.reply(`Generated ${codes.length} invitation codes:\n\n${codeStrings}`, { parse_mode: 'HTML' });
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
