import { Telegraf, session, Scenes } from 'telegraf';
import { CustomContext } from '../types';
import { authMiddleware } from './middlewares/auth.middleware';
import { startCommand, adminCommand } from './commands/start.command';
import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';
import { UserService } from '../services/user.service';
import { PlanService } from '../services/plan.service';
import { SubscriptionService } from '../services/subscription.service';
import { Markup } from 'telegraf';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { checkoutWizard } from './scenes/checkout.wizard';

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

// Apply our custom authentication/gatekeeping middleware FIRST
bot.use(authMiddleware);

// Setup scenes (This must come AFTER authMiddleware so scenes have ctx.dbUser)
const stage = new Scenes.Stage<CustomContext>([checkoutWizard]);
bot.use(stage.middleware());

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

// Handle the Inline Keyboard button click for purchasing a plan
bot.action(/buy_plan_(\d+)/, async (ctx) => {
    const planId = ctx.match[1];

    // Enter the wizard scene and pass the planId in the state
    await ctx.scene.enter('CHECKOUT_WIZARD', { planId });
    await ctx.answerCbQuery();
});

// Handle "My Subscriptions" button click
bot.hears('🛡 My Subscriptions', async (ctx) => {
    if (!ctx.dbUser) return;

    try {
        const subs = await SubscriptionService.getUserSubscriptions(ctx.dbUser.id);

        if (subs.length === 0) {
            return ctx.reply("You don't have any subscriptions yet. Click '🛒 Buy Plan' to get started.");
        }

        // Create an inline button for each subscription
        const buttons = subs.map(sub => {
            const statusEmoji = sub.status === 'active' ? '🟢' : (sub.status === 'pending' ? '⏳' : '🔴');
            const label = `${statusEmoji} ${sub.plan.name} (${sub.status})`;
            return [Markup.button.callback(label, `manage_sub_${sub.id}`)];
        });

        await ctx.reply("Here are your subscriptions. Click on one to view details:", Markup.inlineKeyboard(buttons));

    } catch (e) {
        logger.error("Error fetching subscriptions", e);
        await ctx.reply("Failed to load your subscriptions.");
    }
});

// Handle viewing a specific subscription's details
bot.action(/manage_sub_(\d+)/, async (ctx) => {
    if (!ctx.dbUser) return;
    const subId = parseInt(ctx.match[1], 10);

    try {
        const sub = await SubscriptionService.getSubscriptionById(subId, ctx.dbUser.id);

        if (!sub) {
            await ctx.answerCbQuery("Subscription not found.");
            return;
        }

        await ctx.answerCbQuery();

        let message = `📦 *Subscription Details*\n\n`;
        message += `*Plan:* ${sub.plan.name}\n`;
        message += `*Status:* ${sub.status.toUpperCase()}\n`;

        if (sub.status === 'pending') {
            message += `\n_Your payment is currently being reviewed. Your config will appear here once approved._`;
        } else if (sub.status === 'active' || sub.status === 'expired') {
            message += `*Data Remaining:* ${sub.remaining_data_gb} GB\n`;
            message += `*Expiry:* ${sub.expiry_date ? sub.expiry_date.toLocaleDateString() : 'N/A'}\n\n`;

            if (sub.config_link) {
                // In HTML mode, we can format the config link as a monospaced block for easy copying
                message += `*Your Connection Config:*\n\`${sub.config_link}\``;
            } else {
                message += `_Config link not assigned yet._`;
            }
        }

        // Future enhancements: Add a "Refresh Config" or "Reset UUID" button here
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Back to List', 'list_subs')]
        ]);

        await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });

    } catch (e) {
        logger.error(`Error fetching sub ${subId}`, e);
        await ctx.answerCbQuery("Failed to load details.");
    }
});

// Handle 'Back to List' button
bot.action('list_subs', async (ctx) => {
    await ctx.answerCbQuery();
    // Re-trigger the My Subscriptions view
    // Since ctx.message.text won't exist in a callback query, we just copy the logic
    try {
        if (!ctx.dbUser) return;
        const subs = await SubscriptionService.getUserSubscriptions(ctx.dbUser.id);

        if (subs.length === 0) {
            return ctx.editMessageText("You don't have any subscriptions yet. Click '🛒 Buy Plan' to get started.");
        }

        const buttons = subs.map(sub => {
            const statusEmoji = sub.status === 'active' ? '🟢' : (sub.status === 'pending' ? '⏳' : '🔴');
            const label = `${statusEmoji} ${sub.plan.name} (${sub.status})`;
            return [Markup.button.callback(label, `manage_sub_${sub.id}`)];
        });

        await ctx.editMessageText("Here are your subscriptions. Click on one to view details:", Markup.inlineKeyboard(buttons));
    } catch (e) {
        logger.error("Error refreshing subs", e);
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
