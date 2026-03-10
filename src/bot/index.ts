import { Telegraf, session, Scenes } from 'telegraf';
import { CustomContext } from '../types';
import { authMiddleware } from './middlewares/auth.middleware';
import { startCommand, adminCommand } from './commands/start.command';
import { logger } from '../utils/logger';
import { AppDataSource } from '../database/data-source';
import * as dotenv from 'dotenv';
import { UserService } from '../services/user.service';
import { PlanService } from '../services/plan.service';
import { SubscriptionService } from '../services/subscription.service';
import { Markup } from 'telegraf';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { checkoutWizard } from './scenes/checkout.wizard';
import { adminCouponWizard } from './scenes/admin-coupon.wizard';
import { en } from '../locales/en';
import { fa } from '../locales/fa';
import { t, SupportedLanguage } from '../locales';

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
const stage = new Scenes.Stage<CustomContext>([checkoutWizard, adminCouponWizard]);
bot.use(stage.middleware());

// Register Commands
bot.start(startCommand);
bot.command('admin', adminCommand);

bot.action('generate_coupon', async (ctx) => {
    if (!ctx.dbUser?.is_admin) return;
    await ctx.scene.enter('ADMIN_COUPON_WIZARD');
    await ctx.answerCbQuery();
});

// Handle Admin /pending command
bot.command('pending', async (ctx) => {
    if (!ctx.dbUser?.is_admin) return ctx.reply("Unauthorized.");

    try {
        const pendings = await SubscriptionService.getPendingSubscriptions();

        if (pendings.length === 0) {
            return ctx.reply("There are no pending subscriptions to review.");
        }

        for (const { subscription: sub, transaction: tx } of pendings) {
            let msg = `🔥 *Pending Approval*\n\n`;
            msg += `👤 *User ID:* ${sub.user.id} (@${sub.user.username || 'unknown'})\n`;
            msg += `📦 *Plan:* ${sub.plan.name} ($${tx.amount})\n`;
            msg += `🧾 *Track ID:* ${sub.track_id}\n`;
            msg += `🔗 *Hash:* \`${tx.tx_hash}\`\n\n`;
            msg += `_Submitted around ${tx.created_at.toLocaleString()}._`;

            const keyboard = Markup.inlineKeyboard([
                Markup.button.callback('✅ Approve', `approve_tx_${sub.id}`),
                Markup.button.callback('❌ Reject', `reject_tx_${sub.id}`)
            ]);

            await ctx.reply(msg, { parse_mode: 'Markdown', ...keyboard });
        }
    } catch (e) {
        logger.error("Error fetching pendings", e);
        await ctx.reply("Error fetching pending transactions.");
    }
});

// Admin approves transaction
bot.action(/approve_tx_(\d+)/, async (ctx) => {
    if (!ctx.dbUser?.is_admin) return;
    const subId = parseInt(ctx.match[1], 10);

    try {
        const sub = await SubscriptionService.approveSubscription(subId);

        // Update the admin msg
        await ctx.editMessageText(`✅ *Approved: Track ID ${sub.track_id}*\nHash has been verified and user notified.`, { parse_mode: 'Markdown' });

        // Notify the user directly
        const userMsg = `🎉 *Payment Approved!*\n\nYour transaction (${sub.track_id}) has been verified.\n\n*Your Connection Config:*\n\`${sub.config_link}\`\n\nYou can also find this link in '🛡 My Subscriptions'.`;
        await ctx.telegram.sendMessage(sub.user.telegram_id.toString(), userMsg, { parse_mode: 'Markdown' });
    } catch (e: any) {
        logger.error(`Approve error: ${e.message}`);
        await ctx.answerCbQuery(`Error: ${e.message}`);
    }
});

// Admin rejects transaction
bot.action(/reject_tx_(\d+)/, async (ctx) => {
    if (!ctx.dbUser?.is_admin) return;
    const subId = parseInt(ctx.match[1], 10);

    try {
        const sub = await SubscriptionService.rejectSubscription(subId);

        // Update admin msg
        await ctx.editMessageText(`❌ *Rejected: Track ID ${sub.track_id}*\nTransaction was rejected and user notified.`, { parse_mode: 'Markdown' });

        // Notify user directly
        const userMsg = `🚫 *Payment Rejected*\n\nYour transaction (${sub.track_id}) could not be verified by our team. If you believe this is an error, please contact support and provide your hash.`;
        await ctx.telegram.sendMessage(sub.user.telegram_id.toString(), userMsg, { parse_mode: 'Markdown' });
    } catch (e: any) {
        logger.error(`Reject error: ${e.message}`);
        await ctx.answerCbQuery(`Error: ${e.message}`);
    }
});

// Handle "Buy Plan" button click
bot.hears([en.buy_plan_btn, fa.buy_plan_btn], async (ctx) => {
    try {
        const plans = await PlanService.getAllPlans();
        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';

        if (plans.length === 0) {
            return ctx.reply(t(lang, 'no_plans_avail'));
        }

        // Group the plans into rows of 1 for the inline keyboard
        const buttons = plans.map(plan => {
            const label = `${plan.name} - ${plan.volume_gb > 0 ? plan.volume_gb + 'GB' : t(lang, 'unlimited')} - $${plan.price_usdt}`;
            return [Markup.button.callback(label, `buy_plan_${plan.id}`)];
        });

        await ctx.reply(t(lang, 'select_plan'), Markup.inlineKeyboard(buttons));

    } catch (e) {
        logger.error("Error fetching plans", e);
        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';
        await ctx.reply(t(lang, 'generic_error'));
    }
});

// Handle "Free Trial" button click
bot.hears([en.free_trial_btn, fa.free_trial_btn], async (ctx) => {
    if (!ctx.dbUser) return;
    const lang = (ctx.dbUser.language as SupportedLanguage) || 'en';

    try {
        if (ctx.dbUser.has_used_trial) {
            return ctx.reply(t(lang, 'trial_already_used'));
        }

        await ctx.reply(t(lang, 'trial_processing'));

        const sub = await SubscriptionService.createTrialSubscription(ctx.dbUser);

        ctx.dbUser.has_used_trial = true;

        await ctx.reply(t(lang, 'trial_success', { dataGB: sub.remaining_data_gb, config: sub.config_link }), { parse_mode: 'Markdown' });

    } catch (e: any) {
        logger.error(`Trial Error: ${e.message}`);
        await ctx.reply(e.message.includes('already') ? t(lang, 'trial_already_used') : "Error.");
    }
});

// Handle Language Selection (from inline keyboard)
bot.action(/set_lang_(.*)/, async (ctx) => {
    if (!ctx.dbUser) return;
    const selectedLang = ctx.match[1] as SupportedLanguage;

    try {
        ctx.dbUser.language = selectedLang;
        await AppDataSource.getRepository('User').save(ctx.dbUser);

        // Let's drop them straight into the main menu keyboard using their new lang
        const keyboard = Markup.keyboard([
            [t(selectedLang, 'buy_plan_btn'), t(selectedLang, 'my_subs_btn')],
            [t(selectedLang, 'free_trial_btn'), t(selectedLang, 'invite_link_btn')],
            [t(selectedLang, 'setup_guide_btn'), t(selectedLang, 'profile_btn')],
            [t(selectedLang, 'support_btn')]
        ]).resize();

        await ctx.answerCbQuery(t(selectedLang, 'lang_changed'));
        await ctx.editMessageText(t(selectedLang, 'welcome'));

        // Telegram doesn't allow sending a ReplyKeyboard on editMessageText, 
        // We must send a new message to pop it up.
        await ctx.reply(t(selectedLang, 'welcome'), keyboard);

    } catch (e) {
        logger.error("Lang select error", e);
        await ctx.answerCbQuery("Error saving language.");
    }
});

// Profile Handler
bot.hears([en.profile_btn, fa.profile_btn], async (ctx) => {
    if (!ctx.dbUser) return;
    const lang = (ctx.dbUser.language as SupportedLanguage) || 'en';

    let roleStr = ctx.dbUser.is_admin ? (lang === 'en' ? 'Admin 👑' : 'مدیر 👑') : (lang === 'en' ? 'User 👤' : 'کاربر 👤');
    let langStr = ctx.dbUser.language === 'en' ? 'English 🇺🇸' : 'فارسی 🇮🇷';

    const msg = t(lang, 'profile_text', {
        id: ctx.dbUser.telegram_id.toString(),
        role: roleStr,
        lang: langStr
    });

    // Profile Inline Keyboard: Contains language toggle button
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback(t(lang, 'change_lang_btn'), 'toggle_lang')]
    ]);

    await ctx.reply(msg, { parse_mode: 'Markdown', ...kb });
});

// Profile -> Toggle Language Inline Button
bot.action('toggle_lang', async (ctx) => {
    if (!ctx.dbUser) return;

    try {
        const newLang = ctx.dbUser.language === 'en' ? 'fa' : 'en';

        ctx.dbUser.language = newLang;
        await AppDataSource.getRepository('User').save(ctx.dbUser);

        // Update main reply keyboard 
        const rootKeyboard = Markup.keyboard([
            [t(newLang, 'buy_plan_btn'), t(newLang, 'my_subs_btn')],
            [t(newLang, 'free_trial_btn'), t(newLang, 'invite_link_btn')],
            [t(newLang, 'setup_guide_btn'), t(newLang, 'profile_btn')],
            [t(newLang, 'support_btn')]
        ]).resize();

        await ctx.answerCbQuery(t(newLang, 'lang_changed'));

        // Send a fresh message to pop the updated keyboard up
        await ctx.reply(t(newLang, 'lang_changed'), rootKeyboard);

        // Edit the profile text to reflect the new language
        let roleStr = ctx.dbUser.is_admin ? (newLang === 'en' ? 'Admin 👑' : 'مدیر 👑') : (newLang === 'en' ? 'User 👤' : 'کاربر 👤');
        let langStr = ctx.dbUser.language === 'en' ? 'English 🇺🇸' : 'فارسی 🇮🇷';

        const msg = t(newLang, 'profile_text', {
            id: ctx.dbUser.telegram_id.toString(),
            role: roleStr,
            lang: langStr
        });

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback(t(newLang, 'change_lang_btn'), 'toggle_lang')]
        ]);

        await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...kb });

    } catch (e: any) {
        logger.error(`Lang Switch Error: ${e.message}`);
        await ctx.answerCbQuery("Error changing language.");
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
bot.hears([en.my_subs_btn, fa.my_subs_btn], async (ctx) => {
    if (!ctx.dbUser) return;
    const lang = (ctx.dbUser.language as SupportedLanguage) || 'en';

    try {
        const subs = await SubscriptionService.getUserSubscriptions(ctx.dbUser.id);

        if (subs.length === 0) {
            return ctx.reply(t(lang, 'no_subs_yet'));
        }

        // Create an inline button for each subscription
        const buttons = subs.map(sub => {
            const statusEmoji = sub.status === 'active' ? '🟢' : (sub.status === 'pending' ? '⏳' : '🔴');
            const label = `${statusEmoji} ${sub.track_id} - ${sub.plan.name}`;
            return [Markup.button.callback(label, `manage_sub_${sub.id}`)];
        });

        await ctx.reply(t(lang, 'here_are_subs'), Markup.inlineKeyboard(buttons));

    } catch (e) {
        logger.error("Error fetching subscriptions", e);
        await ctx.reply(t(lang, 'generic_error'));
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
        message += `*Track ID:* \`${sub.track_id}\`\n`;
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
            const label = `${statusEmoji} ${sub.track_id} - ${sub.plan.name}`;
            return [Markup.button.callback(label, `manage_sub_${sub.id}`)];
        });

        await ctx.editMessageText("Here are your subscriptions. Click on one to view details:", Markup.inlineKeyboard(buttons));
    } catch (e) {
        logger.error("Error refreshing subs", e);
    }
});

// Handle "Generate Invite Link" button click
bot.hears([en.invite_link_btn, fa.invite_link_btn], async (ctx) => {
    if (!ctx.dbUser) return;
    const lang = (ctx.dbUser.language as SupportedLanguage) || 'en';

    try {
        // Here you could add logic to limit how many invites a user can generate
        // For example: check ctx.dbUser.codes_created.length if we loaded the relation

        await ctx.reply(t(lang, 'invite_generating'));

        const codes = await UserService.generateInvitationCode(ctx.dbUser.id, 1);
        if (codes.length === 0) throw new Error("Code generation failed");

        const code = codes[0];
        const botInfo = await ctx.telegram.getMe();
        const link = `https://t.me/${botInfo.username}?start=${code.code}`;

        await ctx.reply(
            t(lang, 'invite_success', { link: link }),
            { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
        );
    } catch (e) {
        logger.error("Error generating user invite", e);
        await ctx.reply(t(lang, 'invite_error'));
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
