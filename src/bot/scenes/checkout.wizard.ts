import { Scenes, Markup } from 'telegraf';
import { CustomContext } from '../../types';
import { PlanService } from '../../services/plan.service';
import { SubscriptionService } from '../../services/subscription.service';
import { CouponService } from '../../services/coupon.service';
import { UserService } from '../../services/user.service';
import { getExplorerLink } from '../../utils/explorer';
import { logger } from '../../utils/logger';
import { t, SupportedLanguage } from '../../locales';

// Hardcoded Dummy Wallets for now
const WALLETS = {
    'TRC20': 'TReAQNyWFQzFaqiGmF22ripUyjzUXQzX2E',
    'ERC20': '0x8Ae1Dd63e4AB324ae93910b728d281D96a4547F5',
    'BEP20': '0x8Ae1Dd63e4AB324ae93910b728d281D96a4547F5',
    'SOL': 'BQMFy4hFYMrhRfJhuGpNPzY5ETMXk16799hMTtRHCQbC',
    'TON': 'UQCTzZzvfDxmocsABag_KXu7FVyiUP8BOHT7sKssyzTtuVZD'
};

export const checkoutWizard = new Scenes.WizardScene<CustomContext>(
    'CHECKOUT_WIZARD',

    // Step 1: User just clicked a plan, ask for Network
    async (ctx) => {
        // We expect the payload to be like: buy_plan_1
        // But since this is step 1 of the wizard, we actually need to capture that ID
        // when they enter the scene. We will pass it in the scene state.
        const planId = (ctx.scene.state as any).planId;

        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';

        if (!planId) {
            await ctx.reply(t(lang, 'checkout_error_no_plan'));
            return ctx.scene.leave();
        }

        const plan = await PlanService.getPlanById(Number(planId));
        if (!plan) {
            await ctx.reply(t(lang, 'checkout_error_plan_not_found'));
            return ctx.scene.leave();
        }

        // Generate a simple 6-digit track ID (e.g. 123456)
        const trackId = Math.floor(100000 + Math.random() * 900000).toString();

        (ctx.scene.state as any).plan = plan;
        (ctx.scene.state as any).trackId = trackId;

        const networkKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback(t(lang, 'checkout_apply_coupon_btn'), 'apply_coupon')],
            [Markup.button.callback('USDT (TRC20)', 'network_TRC20')],
            [Markup.button.callback('USDT (ERC20)', 'network_ERC20')],
            [Markup.button.callback('USDT (BEP20)', 'network_BEP20')],
            [Markup.button.callback('USDT (SOL)', 'network_SOL')],
            [Markup.button.callback('USDT (TON)', 'network_TON')],
            [Markup.button.callback(t(lang, 'checkout_cancel_btn'), 'cancel_checkout')]
        ]);

        await ctx.reply(
            t(lang, 'checkout_step1_text', { planName: plan.name, price: plan.price_usdt.toString() }),
            { parse_mode: 'Markdown', ...networkKeyboard }
        );

        return ctx.wizard.next();
    },

    // Step 2: Handle Network Selection OR Ask for Coupon
    async (ctx) => {
        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';
        const state = ctx.scene.state as any;

        // If we are currently waiting for the user to type a coupon code
        if (state.waitingForCoupon && ctx.message && 'text' in ctx.message) {
            const code = ctx.message.text.trim();
            if (code === '/cancel') {
                state.waitingForCoupon = false;
                await ctx.reply(t(lang, 'checkout_coupon_cancelled'));
                return; // Re-prompt network on next input
            }

            try {
                const coupon = await CouponService.validateCoupon(code, ctx.dbUser?.id);
                state.coupon_id = coupon.id;
                state.discount_percent = coupon.discount_percent;
                state.waitingForCoupon = false;

                const discountedPrice = state.plan.price_usdt * (1 - coupon.discount_percent / 100);
                state.finalPrice = discountedPrice;

                // 100% Free Discount Handling
                if (discountedPrice === 0) {
                    await ctx.reply(t(lang, 'checkout_100_discount'), { parse_mode: 'Markdown' });

                    try {
                        const { subscription } = await SubscriptionService.createFreePurchase(ctx.dbUser!, state.plan, coupon.id, state.trackId);

                        await ctx.reply(
                            t(lang, 'checkout_free_success', { config: subscription.config_link }),
                            { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
                        );
                        return ctx.scene.leave();
                    } catch (e: any) {
                        logger.error(`Error generating free subscription: ${e.message}`);
                        await ctx.reply(t(lang, 'checkout_free_error', { code: code }));
                        return ctx.scene.leave();
                    }
                }

                await ctx.reply(t(lang, 'checkout_coupon_applied', { percent: coupon.discount_percent.toString(), price: discountedPrice.toFixed(2) }));

                // Show network keyboard again, without coupon button
                const networkKeyboard = Markup.inlineKeyboard([
                    [Markup.button.callback('USDT (TRC20)', 'network_TRC20')],
                    [Markup.button.callback('USDT (ERC20)', 'network_ERC20')],
                    [Markup.button.callback('USDT (BEP20)', 'network_BEP20')],
                    [Markup.button.callback('USDT (SOL)', 'network_SOL')],
                    [Markup.button.callback('USDT (TON)', 'network_TON')],
                    [Markup.button.callback(t(lang, 'checkout_cancel_btn'), 'cancel_checkout')]
                ]);
                await ctx.reply(t(lang, 'checkout_select_network', { price: discountedPrice.toFixed(2) }), networkKeyboard);
                return;
            } catch (e: any) {
                state.waitingForCoupon = false;
                const errKey = `checkout_${e.message}` as any;
                // If translation exists, use it, otherwise generic error
                const errMsg = t(lang, errKey) !== errKey ? t(lang, errKey) : t(lang, 'checkout_invalid_coupon_code');
                await ctx.reply(errMsg);
                return; // Re-prompt next loop
            }
        }

        if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
            await ctx.reply(t(lang, 'checkout_click_network_btn'));
            return;
        }

        const action = ctx.callbackQuery.data;

        if (action === 'apply_coupon') {
            state.waitingForCoupon = true;
            await ctx.answerCbQuery();
            await ctx.reply(t(lang, 'checkout_enter_coupon'));
            return; // stay on this step to receive text next loop
        }

        if (action === 'cancel_checkout') {
            await ctx.reply(t(lang, 'checkout_checkout_cancelled'));
            await ctx.answerCbQuery();
            return ctx.scene.leave();
        }

        if (!action.startsWith('network_')) {
            await ctx.reply(t(lang, 'checkout_invalid_network'));
            return;
        }

        const network = action.split('_')[1] as keyof typeof WALLETS;
        const walletAddress = WALLETS[network];
        const plan = state.plan;
        const trackId = state.trackId;
        const finalPrice = state.finalPrice ?? plan.price_usdt;

        state.network = network;

        await ctx.answerCbQuery();
        await ctx.reply(
            t(lang, 'checkout_payment_instructions', { trackId, price: Number(finalPrice).toFixed(2), network, wallet: walletAddress }),
            { parse_mode: 'Markdown' }
        );

        return ctx.wizard.next();
    },

    // Step 3: Receive TXID
    async (ctx) => {
        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';

        if (!ctx.message || !('text' in ctx.message)) {
            await ctx.reply(t(lang, 'checkout_send_txid'));
            return;
        }

        const txid = ctx.message.text.trim();
        const state = ctx.scene.state as any;

        try {
            // We need the resolved user from context and plan from wizard state
            const user = ctx.dbUser;
            const plan = state.plan;
            const trackId = state.trackId;

            if (!user || !plan || !trackId) {
                throw new Error("Session expired. Missing user or plan.");
                // Error boundary will catch and translate
            }

            const finalPrice = state.finalPrice ?? plan.price_usdt;

            // Call the service to save to Postgres
            const { subscription } = await SubscriptionService.createPendingPurchase(user, plan, txid, trackId, finalPrice, state.network || 'Unknown', state.coupon_id);

            await ctx.reply(
                t(lang, 'checkout_txid_recorded', { txid, trackId }),
                { parse_mode: 'Markdown' }
            );

            // Notify all admins (fire-and-forget — don't block user on DM failures)
            UserService.getAdmins().then(admins => {
                const adminMsg =
                    `🔔 *New Payment Submitted*\n\n` +
                    `👤 User: @${user.username || user.telegram_id} (ID: \`${user.telegram_id}\`)\n` +
                    `📦 Plan: \`${plan.name}\`\n` +
                    `🌐 Network: \`${state.network || 'Unknown'}\`\n` +
                    `🧾 Track ID: \`${trackId}\`\n` +
                    `🔗 Hash: ${getExplorerLink(state.network || 'Unknown', txid)}\n\n` +
                    `Use /pending to review.`;

                for (const admin of admins) {
                    ctx.telegram.sendMessage(admin.telegram_id.toString(), adminMsg, { parse_mode: 'Markdown' })
                        .catch(e => logger.warn(`Failed to notify admin ${admin.telegram_id}: ${e.message}`));
                }
            }).catch(e => logger.warn(`Failed to fetch admins for notification: ${e.message}`));
        } catch (e: any) {
            logger.error(`Checkout Wizard Error Saving TXID: ${e.message}`);
            // If they provided a duplicate TX hash, we will let them know
            if (e.message.includes("already exists")) {
                await ctx.reply(t(lang, 'checkout_txid_exists'));
                // Re-ask for TXID by not leaving the scene
                return;
            }
            if (e.message.includes("Session expired")) {
                await ctx.reply(t(lang, 'checkout_session_expired'));
            } else {
                await ctx.reply(t(lang, 'checkout_db_error'));
            }
        }

        return ctx.scene.leave();
    }
);
