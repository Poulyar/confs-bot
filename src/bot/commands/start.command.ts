import { CustomContext } from '../../types';
import { Markup } from 'telegraf';
import { t, SupportedLanguage } from '../../locales';

export const startCommand = async (ctx: CustomContext) => {
    // authMiddleware ensures this code only runs if the user is in the DB and active.
    const user = ctx.dbUser;
    const lang = (user?.language as SupportedLanguage) || 'en';

    if (!user) {
        // Should theoretically never happen if middleware is working
        await ctx.reply('Error: User not found in session context.');
        return;
    }

    const welcomeMessage = `Welcome back, *${user.username || 'User'}*! 🛡\n\n`
        + `Your VIP Napster VPN portal is ready.\n`
        + `Use the buttons below to manage your configurations.`;

    // Create main menu keyboard using translations
    const keyboard = Markup.keyboard([
        [t(lang, 'buy_plan_btn'), t(lang, 'my_subs_btn')],
        [t(lang, 'free_trial_btn'), t(lang, 'invite_link_btn')],
        [t(lang, 'setup_guide_btn'), t(lang, 'profile_btn')],
        [t(lang, 'support_btn')]
    ]).resize();

    await ctx.reply(t(lang, 'welcome'), keyboard);
};

export const adminCommand = async (ctx: CustomContext) => {
    const user = ctx.dbUser;

    if (!user?.is_admin) {
        await ctx.reply('You do not have permission to use this command.');
        return;
    }

    await ctx.reply('Admin Panel:\nUse /generate_invites [amount] to create new codes.');
};
