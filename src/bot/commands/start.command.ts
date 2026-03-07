import { CustomContext } from '../../types';
import { Markup } from 'telegraf';

export const startCommand = async (ctx: CustomContext) => {
    // authMiddleware ensures this code only runs if the user is in the DB and active.
    const user = ctx.dbUser;

    if (!user) {
        // Should theoretically never happen if middleware is working
        await ctx.reply('Error: User not found in session context.');
        return;
    }

    const welcomeMessage = `Welcome back, *${user.username || 'User'}*! 🛡\n\n`
        + `Your VIP Napster VPN portal is ready.\n`
        + `Use the buttons below to manage your configurations.`;

    // Create main menu keyboard
    const keyboard = Markup.keyboard([
        ['🛒 Buy Plan', '🛡 My Subscriptions'],
        ['🎁 Free Trial', '🔗 Generate Invite Link'],
        ['❓ Help Center']
    ]).resize();

    await ctx.replyWithMarkdown(welcomeMessage, keyboard);
};

export const adminCommand = async (ctx: CustomContext) => {
    const user = ctx.dbUser;
    // Let's assume user.id === 1 is the super admin for now.
    // We can add a role or is_admin flag to the User entity later.
    if (user?.id !== 1) {
        await ctx.reply('You do not have permission to use this command.');
        return;
    }

    await ctx.reply('Admin Panel:\nUse /generate_invites [amount] to create new codes.');
};
