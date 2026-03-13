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
import { NpvtService } from '../services/npvt.service';
import { VpnService } from '../services/vpn.service';
import { Markup } from 'telegraf';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { checkoutWizard } from './scenes/checkout.wizard';
import { adminCouponWizard } from './scenes/admin-coupon.wizard';
import { adminNpvtWizard } from './scenes/admin-npvt.wizard';
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
const stage = new Scenes.Stage<CustomContext>([checkoutWizard, adminCouponWizard, adminNpvtWizard]);
bot.use(stage.middleware());

// Register Commands
bot.start(startCommand);
bot.command('admin', adminCommand);

bot.action('generate_coupon', async (ctx) => {
    if (!ctx.dbUser?.is_admin) return;
    await ctx.scene.enter('ADMIN_COUPON_WIZARD');
    await ctx.answerCbQuery();
});

bot.action('upload_npvt_configs', async (ctx) => {
    if (!ctx.dbUser?.is_admin) return;
    await ctx.scene.enter('ADMIN_NPVT_WIZARD');
    await ctx.answerCbQuery();
});


const handlePendingSubs = async (ctx: any) => {
    const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';

    if (!ctx.dbUser?.is_admin) {
        if (ctx.callbackQuery) await ctx.answerCbQuery(t(lang, 'admin_unauthorized'), { show_alert: true });
        else await ctx.reply(t(lang, 'admin_unauthorized'));
        return;
    }

    try {
        const pendings = await SubscriptionService.getPendingSubscriptions();

        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';

        if (pendings.length === 0) {
            const msg = t(lang, 'admin_no_pending');
            if (ctx.callbackQuery) await ctx.answerCbQuery(msg, { show_alert: true });
            else await ctx.reply(msg);
            return;
        }

        if (ctx.callbackQuery) await ctx.answerCbQuery();

        for (const { subscription: sub, transaction: tx } of pendings) {
            let msg = `${t(lang, 'admin_pending_title')}\n\n`;
            msg += `${t(lang, 'admin_pending_user', { id: sub.user.id.toString(), username: sub.user.username || 'unknown' })}\n`;
            msg += `${t(lang, 'admin_pending_plan', { planName: sub.plan.name, amount: tx.amount.toString() })}\n`;
            msg += `${t(lang, 'admin_pending_track', { trackId: sub.track_id })}\n`;
            msg += `${t(lang, 'admin_pending_hash', { hash: tx.tx_hash })}\n\n`;
            msg += `${t(lang, 'admin_pending_submitted', { date: tx.created_at.toLocaleString() })}`;

            const keyboard = Markup.inlineKeyboard([
                Markup.button.callback(t(lang, 'admin_pending_approve'), `approve_tx_${sub.id}`),
                Markup.button.callback(t(lang, 'admin_pending_reject'), `reject_tx_${sub.id}`)
            ]);

            await ctx.reply(msg, { parse_mode: 'Markdown', ...keyboard });
        }
    } catch (e) {
        logger.error("Error fetching pendings", e);
        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';
        await ctx.reply(t(lang, 'generic_error_fetch_pendings'));
    }
};

bot.command('pending', handlePendingSubs);
bot.action('admin_pending_subs', handlePendingSubs);

// Admin approves transaction
bot.action(/approve_tx_(\d+)/, async (ctx) => {
    if (!ctx.dbUser?.is_admin) return;
    const subId = parseInt(ctx.match[1], 10);
    const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';

    try {
        const sub = await SubscriptionService.approveSubscription(subId);

        // Update the admin msg
        await ctx.editMessageText(t(lang, 'admin_approve_success', { trackId: sub.track_id }), { parse_mode: 'Markdown' });

        // User target language (the user who bought the sub)
        const targetLang = (sub.user.language as SupportedLanguage) || 'en';

        // Send the .npvt config file to the user
        const npvtConfig = await NpvtService.getConfigForSub(sub.id);
        if (npvtConfig) {
            const fileBuffer = Buffer.from(npvtConfig.file_data, 'base64');
            await ctx.telegram.sendDocument(
                sub.user.telegram_id.toString(),
                { source: fileBuffer, filename: 'vprivate-config.npvt' },
                { caption: t(targetLang, 'admin_approve_user_dm', { trackId: sub.track_id }) }
            );
        } else {
            // Fallback: text message if no file (shouldn't happen)
            await ctx.telegram.sendMessage(
                sub.user.telegram_id.toString(),
                t(targetLang, 'admin_approve_user_dm', { trackId: sub.track_id }),
                { parse_mode: 'Markdown' }
            );
        }
    } catch (e: any) {
        logger.error(`Approve error: ${e.message}`);
        if (e.message.startsWith('NO_CONFIGS_AVAILABLE:')) {
            const planName = e.message.split(':')[1];
            await ctx.answerCbQuery(`⚠️ No configs in pool for plan "${planName}". Upload more before approving.`, { show_alert: true });
        } else {
            await ctx.answerCbQuery(`Error: ${e.message}`);
        }
    }
});;

// Admin rejects transaction
bot.action(/reject_tx_(\d+)/, async (ctx) => {
    if (!ctx.dbUser?.is_admin) return;
    const subId = parseInt(ctx.match[1], 10);
    const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';

    try {
        const sub = await SubscriptionService.rejectSubscription(subId);

        // Update admin msg
        await ctx.editMessageText(t(lang, 'admin_reject_success', { trackId: sub.track_id }), { parse_mode: 'Markdown' });

        const targetLang = (sub.user.language as SupportedLanguage) || 'en';

        // Notify user directly
        const userMsg = t(targetLang, 'admin_reject_user_dm', { trackId: sub.track_id });
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

    // try {
    //     if (ctx.dbUser.has_used_trial) {
    //         return ctx.reply(t(lang, 'trial_already_used'));
    //     }

    //     await ctx.reply(t(lang, 'trial_processing'));

    //     const sub = await SubscriptionService.createTrialSubscription(ctx.dbUser);

    //     ctx.dbUser.has_used_trial = true;

    //     await ctx.reply(t(lang, 'trial_success', { dataGB: sub.remaining_data_gb, config: sub.config_link }), { parse_mode: 'Markdown' });

    // } catch (e: any) {
    //     logger.error(`Trial Error: ${e.message}`);
    //     await ctx.reply(e.message.includes('already') ? t(lang, 'trial_already_used') : "Error.");
    // }
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
        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';
        await ctx.answerCbQuery(t(lang, 'lang_error_saving'));
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
        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';
        await ctx.answerCbQuery(t(lang, 'lang_error_changing'));
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
        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';

        if (!sub) {
            await ctx.answerCbQuery(t(lang, 'sub_not_found'));
            return;
        }

        await ctx.answerCbQuery();

        // Sync live traffic from VPN panel if this sub has an npvt config assigned
        if (sub.npvt_config_id) {
            try {
                const npvtConfig = await NpvtService.getConfigForSub(sub.id);
                if (npvtConfig) {
                    // Derive panel email: strip first hyphen-separated segment from filename (without extension)
                    // e.g. "Ardashir-vl-20G7-100.npvt" => "vl-20G7-100"
                    const baseName = npvtConfig.filename.replace(/\.npvt$/i, '');
                    const panelEmail = baseName.substring(baseName.indexOf('-') + 1);

                    const traffic = await VpnService.getClientTraffics(panelEmail);
                    if (traffic) {
                        // Update the DB with fresh values
                        const subRepo = AppDataSource.getRepository('Subscription');
                        const updates: any = {};
                        if (traffic.remainingGb !== null) {
                            updates.remaining_data_gb = traffic.remainingGb;
                            sub.remaining_data_gb = traffic.remainingGb;
                        }
                        if (traffic.expiryDate !== null) {
                            updates.expiry_date = traffic.expiryDate;
                            sub.expiry_date = traffic.expiryDate;
                        }
                        if (Object.keys(updates).length > 0) {
                            await subRepo.update(sub.id, updates);
                        }
                    }
                }
            } catch (syncErr: any) {
                // Non-fatal: panel may be unreachable, show cached values
                logger.warn(`Traffic sync skipped for sub ${subId}: ${syncErr.message}`);
            }
        }

        let message = t(lang, 'sub_details_title');
        message += t(lang, 'sub_track_id', { trackId: sub.track_id });
        message += t(lang, 'sub_plan', { planName: sub.plan.name });
        message += t(lang, 'sub_status', { status: sub.status.toUpperCase() });

        if (sub.status === 'pending') {
            message += `\n_Your payment is currently being reviewed._\n`;
        } else if (sub.status === 'active' || sub.status === 'expired') {
            message += t(lang, 'sub_data_remaining', { remaining: sub.remaining_data_gb.toString() });
            message += sub.expiry_date ? t(lang, 'sub_expiry', { date: sub.expiry_date.toLocaleDateString() }) : t(lang, 'sub_not_active');
            message += `\n`;
        }

        const keyboardButtons: any[][] = [[Markup.button.callback(t(lang, 'sub_back_btn'), 'list_subs')]];

        // Add re-download button if a config file is assigned
        if (sub.npvt_config_id) {
            keyboardButtons.unshift([Markup.button.callback('📥 Re-download Config', `redownload_config_${sub.id}`)]);
        }

        const keyboard = Markup.inlineKeyboard(keyboardButtons);

        await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });

    } catch (e) {
        logger.error(`Error fetching sub ${subId}`, e);
        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';
        await ctx.answerCbQuery(t(lang, 'sub_failed_load'));
    }
});


// Handle 'Back to List' button
bot.action('list_subs', async (ctx) => {
    await ctx.answerCbQuery();
    // Re-trigger the My Subscriptions view
    // Since ctx.message.text won't exist in a callback query, we just copy the logic
    try {
        if (!ctx.dbUser) return;
        const lang = (ctx.dbUser.language as SupportedLanguage) || 'en';
        const subs = await SubscriptionService.getUserSubscriptions(ctx.dbUser.id);

        if (subs.length === 0) {
            return ctx.editMessageText(t(lang, 'sub_empty_list'));
        }

        const buttons = subs.map(sub => {
            const statusEmoji = sub.status === 'active' ? '🟢' : (sub.status === 'pending' ? '⏳' : '🔴');
            const label = `${statusEmoji} ${sub.track_id} - ${sub.plan.name}`;
            return [Markup.button.callback(label, `manage_sub_${sub.id}`)];
        });

        await ctx.editMessageText(t(lang, 'sub_list_header'), Markup.inlineKeyboard(buttons));
    } catch (e) {
        logger.error("Error refreshing subs", e);
    }
});

// Handle re-download of assigned .npvt config
bot.action(/redownload_config_(\d+)/, async (ctx) => {
    if (!ctx.dbUser) return;
    const subId = parseInt(ctx.match[1], 10);
    const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';

    try {
        await ctx.answerCbQuery();

        const config = await NpvtService.getConfigForSub(subId);
        if (!config) {
            await ctx.reply(t(lang, 'sub_config_not_found'));
            return;
        }

        const fileBuffer = Buffer.from(config.file_data, 'base64');
        await ctx.replyWithDocument(
            { source: fileBuffer, filename: 'vprivate-config.npvt' },
            { caption: t(lang, 'sub_config_redownload_caption') }
        );
    } catch (e) {
        logger.error(`Redownload error for sub ${subId}`, e);
        await ctx.reply(t(lang, 'generic_error'));
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
        // Fixed telegram deep link format
        const link = `https://t.me/${botInfo.username}?start=${code.code}`;

        await ctx.reply(
            t(lang, 'invite_success', { link: link }),
            { parse_mode: 'HTML', link_preview_options: { is_disabled: false } }
        );
    } catch (e) {
        logger.error("Error generating user invite", e);
        await ctx.reply(t(lang, 'invite_error'));
    }
});

bot.command('generate_invites', async (ctx) => {
    // Basic protection - hardcode to first user ID or add to env variable
    const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';

    if (ctx.dbUser?.id !== 1) {
        return ctx.reply(t(lang, 'admin_unauthorized'));
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

        await ctx.reply(t(lang, 'admin_invites_generated', { count: codes.length.toString(), codes: codeStrings }), { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    } catch (e) {
        logger.error("Error generating codes", e);
        await ctx.reply(t(lang, 'admin_invites_failed'));
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
