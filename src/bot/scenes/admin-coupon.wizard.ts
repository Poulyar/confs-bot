import { Scenes, Markup } from 'telegraf';
import { CustomContext } from '../../types';
import { CouponService } from '../../services/coupon.service';
import { t, SupportedLanguage } from '../../locales';
import { logger } from '../../utils/logger';

export const adminCouponWizard = new Scenes.WizardScene<CustomContext>(
    'ADMIN_COUPON_WIZARD',
    // Step 1: Prompt for Discount Percentage
    async (ctx) => {
        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';
        if (!ctx.dbUser?.is_admin) {
            await ctx.reply("Unauthorized.");
            return ctx.scene.leave();
        }

        await ctx.reply(t(lang, 'admin_coupon_percent'), Markup.removeKeyboard());
        return ctx.wizard.next();
    },
    // Step 2: Receive Percentage, Prompt for Expiry Hours
    async (ctx) => {
        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';

        if (ctx.message && 'text' in ctx.message) {
            if (ctx.message.text === '/cancel') {
                await ctx.reply("Cancelled.");
                return ctx.scene.leave();
            }

            const percent = parseInt(ctx.message.text.trim(), 10);
            if (isNaN(percent) || percent < 1 || percent > 100) {
                await ctx.reply(t(lang, 'admin_coupon_invalid'));
                return; // Stay on current step
            }

            (ctx.wizard.state as any).percent = percent;
            await ctx.reply(t(lang, 'admin_coupon_hours'));
            return ctx.wizard.next();
        }
    },
    // Step 3: Receive Hours, Generate Coupon
    async (ctx) => {
        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';
        const percent = (ctx.wizard.state as any).percent;

        if (ctx.message && 'text' in ctx.message) {
            if (ctx.message.text === '/cancel') {
                await ctx.reply("Cancelled.");
                return ctx.scene.leave();
            }

            const hours = parseInt(ctx.message.text.trim(), 10);
            if (isNaN(hours) || hours <= 0) {
                await ctx.reply(t(lang, 'admin_coupon_invalid'));
                return;
            }

            try {
                const coupon = await CouponService.generateCoupon(percent, hours);

                // Return to main keyboard layout
                const keyboard = Markup.keyboard([
                    [t(lang, 'buy_plan_btn'), t(lang, 'my_subs_btn')],
                    [t(lang, 'free_trial_btn'), t(lang, 'invite_link_btn')],
                    [t(lang, 'setup_guide_btn'), t(lang, 'profile_btn')],
                    [t(lang, 'support_btn')]
                ]).resize();

                await ctx.reply(
                    t(lang, 'admin_coupon_success', { code: coupon.code, percent: percent.toString(), hours: hours.toString() }),
                    { parse_mode: 'Markdown', ...keyboard }
                );

                return ctx.scene.leave();
            } catch (e: any) {
                logger.error("Coupon Gen Error", e);
                await ctx.reply("System error generating coupon.");
                return ctx.scene.leave();
            }
        }
    }
);
