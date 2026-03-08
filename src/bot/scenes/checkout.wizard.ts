import { Scenes, Markup } from 'telegraf';
import { CustomContext } from '../../types';
import { PlanService } from '../../services/plan.service';
import { SubscriptionService } from '../../services/subscription.service';
import { logger } from '../../utils/logger';

// Hardcoded Dummy Wallets for now
const WALLETS = {
    'TRC20': 'T-DummyAddress-TRC20-123456',
    'ERC20': '0x-DummyAddress-ERC20-123456',
    'TON': 'UQ-DummyAddress-TON-123456'
};

export const checkoutWizard = new Scenes.WizardScene<CustomContext>(
    'CHECKOUT_WIZARD',

    // Step 1: User just clicked a plan, ask for Network
    async (ctx) => {
        // We expect the payload to be like: buy_plan_1
        // But since this is step 1 of the wizard, we actually need to capture that ID
        // when they enter the scene. We will pass it in the scene state.
        const planId = (ctx.scene.state as any).planId;

        if (!planId) {
            await ctx.reply("Error: No plan selected. Please try again.");
            return ctx.scene.leave();
        }

        const plan = await PlanService.getPlanById(Number(planId));
        if (!plan) {
            await ctx.reply("Error: Plan not found.");
            return ctx.scene.leave();
        }

        // Generate a simple 6-digit track ID (e.g. 123456)
        const trackId = Math.floor(100000 + Math.random() * 900000).toString();

        (ctx.scene.state as any).plan = plan;
        (ctx.scene.state as any).trackId = trackId;

        const networkKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('USDT (TRC20)', 'network_TRC20')],
            [Markup.button.callback('USDT (ERC20)', 'network_ERC20')],
            [Markup.button.callback('USDT (TON)', 'network_TON')],
            [Markup.button.callback('❌ Cancel', 'cancel_checkout')]
        ]);

        await ctx.reply(
            `You selected: *${plan.name}*\nPrice: *$${plan.price_usdt} USDT*\n\nPlease select your preferred network for payment:`,
            { parse_mode: 'Markdown', ...networkKeyboard }
        );

        return ctx.wizard.next();
    },

    // Step 2: Handle Network Selection & Ask for TXID
    async (ctx) => {
        if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
            await ctx.reply("Please click one of the network buttons.");
            return;
        }

        const action = ctx.callbackQuery.data;

        if (action === 'cancel_checkout') {
            await ctx.reply("Checkout cancelled.");
            await ctx.answerCbQuery();
            return ctx.scene.leave();
        }

        if (!action.startsWith('network_')) {
            await ctx.reply("Invalid network selection.");
            return;
        }

        const network = action.split('_')[1] as keyof typeof WALLETS;
        const walletAddress = WALLETS[network];
        const plan = (ctx.scene.state as any).plan;
        const trackId = (ctx.scene.state as any).trackId;

        (ctx.scene.state as any).network = network;

        await ctx.answerCbQuery();
        await ctx.reply(
            `🏦 *Payment Instructions*\n\n` +
            `*Track ID:* \`${trackId}\`\n\n` +
            `Please send exactly *$${plan.price_usdt} USDT* via *${network}* network to the following address:\n\n` +
            `\`${walletAddress}\`\n\n` +
            `_Tap the address above to copy it._\n\n` +
            `⏳ Once you have sent the payment, please **reply to this message** with your **Transaction ID (TXID) / Hash**.`,
            { parse_mode: 'Markdown' }
        );

        return ctx.wizard.next();
    },

    // Step 3: Receive TXID
    async (ctx) => {
        if (!ctx.message || !('text' in ctx.message)) {
            await ctx.reply("Please send your Transaction ID (TXID) as text.");
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
            }

            // Call the service to save to Postgres
            await SubscriptionService.createPendingPurchase(user, plan, txid, trackId);

            await ctx.reply(
                `✅ *Payment Received & Recorded!*\n\n` +
                `Thank you. We have securely saved your TXID:\n\`${txid}\`\n\n` +
                `Your payment (\`#${trackId}\`) is now **Processing**. Once an admin verifies the hash (or it auto-confirms), your VPN configuration will be delivered here automatically.`,
                { parse_mode: 'Markdown' }
            );
        } catch (e: any) {
            logger.error(`Checkout Wizard Error Saving TXID: ${e.message}`);
            // If they provided a duplicate TX hash, we will let them know
            if (e.message.includes("already exists")) {
                await ctx.reply("❌ That Transaction ID has already been submitted in our system. Please check your TXID and try again.");
                // Re-ask for TXID by not leaving the scene
                return;
            }
            await ctx.reply("❌ An internal database error occurred while saving your transaction. Please contact support.");
        }

        return ctx.scene.leave();
    }
);
