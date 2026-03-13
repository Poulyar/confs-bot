import { AppDataSource } from '../database/data-source';
import { Subscription, Transaction, User, Plan } from '../database/entities';
import { VpnService } from './vpn.service';
import { NpvtService } from './npvt.service';

export class SubscriptionService {
    static getSubRepository() {
        return AppDataSource.getRepository(Subscription);
    }
    static getTxRepository() {
        return AppDataSource.getRepository(Transaction);
    }

    /**
     * Creates a pending subscription and a linked pending transaction for a user purchasing a plan.
     */
    static async createPendingPurchase(user: User, plan: Plan, txHash: string, trackId: string, finalUsdtAmount: number, couponId?: number): Promise<{ subscription: Subscription, transaction: Transaction }> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Check if this TX hash already exists
            const existingTx = await queryRunner.manager.findOne(Transaction, { where: { tx_hash: txHash } });
            if (existingTx) {
                throw new Error("Transaction hash already exists in the system.");
            }

            // 1. Create the Pending Subscription
            const sub = new Subscription();
            sub.user_id = user.id;
            sub.plan_id = plan.id;
            sub.status = 'pending';

            // Reuse the same trackId shown to the user during checkout
            sub.track_id = trackId;

            // We set expiry/data later when exactly activated by the VPN API, 
            // but we can initialize data to plan structure.
            sub.remaining_data_gb = plan.volume_gb;

            if (couponId) {
                sub.coupon_id = couponId;
            }

            const savedSub = await queryRunner.manager.save(sub);

            // 2. Create the Pending Transaction
            const tx = new Transaction();
            tx.user_id = user.id;
            tx.sub_id = savedSub.id;
            tx.tx_hash = txHash;
            tx.amount = finalUsdtAmount;
            tx.track_id = trackId; // Keep them unified
            tx.status = 'pending';

            const savedTx = await queryRunner.manager.save(tx);

            await queryRunner.commitTransaction();

            return {
                subscription: savedSub,
                transaction: savedTx
            };

        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Retrieves all subscriptions for a specific user, including the related Plan data.
     */
    static async getUserSubscriptions(userId: number): Promise<Subscription[]> {
        return await this.getSubRepository().find({
            where: { user_id: userId },
            relations: ['plan'],
            order: { created_at: 'DESC' }
        });
    }

    /**
     * Retrieves a single subscription by ID, ensuring it belongs to the user.
     */
    static async getSubscriptionById(subId: number, userId: number): Promise<Subscription | null> {
        return await this.getSubRepository().findOne({
            where: { id: subId, user_id: userId },
            relations: ['plan']
        });
    }

    /**
     * Retrieves all pending matching subscription + transaction pairs for admin review.
     */
    static async getPendingSubscriptions(): Promise<{ subscription: Subscription, transaction: Transaction }[]> {
        const subs = await this.getSubRepository().find({
            where: { status: 'pending' },
            relations: ['plan', 'user'],
            order: { created_at: 'ASC' }
        });

        const results = [];
        for (const sub of subs) {
            const tx = await this.getTxRepository().findOne({ where: { sub_id: sub.id, status: 'pending' } });
            if (tx) {
                results.push({ subscription: sub, transaction: tx });
            }
        }
        return results;
    }

    /**
     * Internal generic method to provision a subscription on the VPN server,
     * set the active flag, save it to DB, construct a success message, and burn the coupon.
     */
    private static async provisionSubscription(sub: Subscription, manager: any): Promise<Subscription> {
        // Set Expiry Date based on plan duration
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + sub.plan.duration_days);

        // --- VPN PANEL GENERATION (commented out — using .npvt pool instead) ---
        // const email = `user_${sub.user_id}_sub_${sub.id}`;
        // const limitGb = sub.plan.volume_gb;
        // const expiryMs = expiry.getTime();
        // const realConfig = await VpnService.createClient(email, limitGb, expiryMs);
        // if (!realConfig) {
        //     throw new Error("Failed to generate real VPN configuration from 3X-UI panel.");
        // }
        // sub.config_link = realConfig;
        // -----------------------------------------------------------------------

        sub.status = 'active';
        sub.expiry_date = expiry;

        // Burn the coupon if exists
        if (sub.coupon) {
            sub.coupon.is_used = true;
            await manager.save(sub.coupon);
        }

        const updatedSub = await manager.save(sub);
        return updatedSub;
    }

    /**
     * Admin approves a pending subscription. Marks it active, generates config, and sets expiry.
     */
    static async approveSubscription(subId: number): Promise<Subscription> {
        return await AppDataSource.transaction(async manager => {
            const sub = await manager.findOne(Subscription, { where: { id: subId }, relations: ['plan', 'user', 'coupon'] });
            if (!sub) throw new Error("Subscription not found");
            if (sub.status !== 'pending') throw new Error(`Cannot approve a subscription with status: ${sub.status}`);

            const tx = await manager.findOne(Transaction, { where: { sub_id: subId } });
            if (!tx) throw new Error("Transaction not found");

            tx.status = 'confirmed';
            await manager.save(tx);

            // Claim an .npvt config from the pool for this plan
            const npvtConfig = await NpvtService.claimForSubscription(subId, sub.plan_id);
            if (!npvtConfig) {
                throw new Error(`NO_CONFIGS_AVAILABLE:${sub.plan.name}`);
            }
            sub.npvt_config_id = npvtConfig.id;

            return await this.provisionSubscription(sub, manager);
        });
    }

    /**
     * Bypasses the crypto generation logic entirely. Directly activates a subscription when a 100% coupon is applied.
     */
    static async createFreePurchase(user: User, plan: Plan, couponId: number, trackId: string): Promise<{ subscription: Subscription, transaction: Transaction }> {
        return await AppDataSource.transaction(async manager => {
            // 1. Create Active Subscription Entity Shell
            let sub = new Subscription();
            sub.user_id = user.id;
            sub.plan_id = plan.id;
            sub.status = 'pending';

            // Reuse the same trackId shown to the user during checkout
            sub.track_id = trackId;
            sub.remaining_data_gb = plan.volume_gb;
            sub.coupon_id = couponId;

            sub = await manager.save(sub);

            // Re-fetch with relations to pass to provisionSubscription
            let reloadedSub = await manager.findOne(Subscription, { where: { id: sub.id }, relations: ['plan', 'coupon'] });

            // 2. Create Confirmed Transaction Entity
            const tx = new Transaction();
            tx.user_id = user.id;
            tx.sub_id = sub.id;
            tx.tx_hash = `COUPON_100_${couponId}_${Date.now()}`;
            tx.amount = 0;
            tx.track_id = sub.track_id;
            tx.status = 'confirmed';

            const savedTx = await manager.save(tx);

            // 3. Provision Reality
            const activatedSub = await this.provisionSubscription(reloadedSub!, manager);

            return {
                subscription: activatedSub,
                transaction: savedTx
            };
        });
    }

    /**
     * Admin rejects a subscription.
     */
    static async rejectSubscription(subId: number): Promise<Subscription> {
        return await AppDataSource.transaction(async manager => {
            const sub = await manager.findOne(Subscription, { where: { id: subId }, relations: ['user'] });
            if (!sub) throw new Error("Subscription not found");
            if (sub.status !== 'pending') throw new Error(`Cannot reject a subscription with status: ${sub.status}`);

            const tx = await manager.findOne(Transaction, { where: { sub_id: subId } });
            if (!tx) throw new Error("Transaction not found");

            sub.status = 'rejected';
            tx.status = 'rejected';

            await manager.save(sub);
            await manager.save(tx);

            return sub;
        });
    }

    /**
     * Issues a free trial subscription to a user.
     */
    static async createTrialSubscription(user: User): Promise<Subscription> {
        return await AppDataSource.transaction(async manager => {
            // Re-fetch user inside transaction with lock to prevent race conditions
            const currentDbUser = await manager.findOne(User, {
                where: { id: user.id },
                lock: { mode: 'pessimistic_write' }
            });

            if (!currentDbUser) throw new Error("User not found.");
            if (currentDbUser.has_used_trial) {
                throw new Error("You have already claimed your free trial.");
            }

            // Find or dynamically create 'Free Trial' plan
            let trialPlan = await manager.findOne(Plan, { where: { name: 'Free Trial' } });
            if (!trialPlan) {
                trialPlan = new Plan();
                trialPlan.name = 'Free Trial';
                trialPlan.price_usdt = 0;
                trialPlan.volume_gb = 5; // 5GB
                trialPlan.duration_days = 1; // 24 Hours
                await manager.save(trialPlan);
            }

            const trackId = Math.floor(100000 + Math.random() * 900000).toString();

            const sub = new Subscription();
            sub.user_id = currentDbUser.id;
            sub.plan_id = trialPlan.id;
            sub.status = 'active';
            sub.track_id = trackId;
            sub.remaining_data_gb = trialPlan.volume_gb;

            const expiry = new Date();
            expiry.setDate(expiry.getDate() + trialPlan.duration_days);

            // Generate real config using 3X-UI
            // Use a temporary ID since sub.id doesn't exist until saved
            const tempId = Date.now().toString().slice(-4);
            const email = `trial_${currentDbUser.id}_${tempId}`;
            const limitGb = trialPlan.volume_gb;
            const expiryMs = expiry.getTime();

            const realConfig = await VpnService.createClient(email, limitGb, expiryMs);
            if (!realConfig) {
                throw new Error("Failed to generate trial VPN configuration from 3X-UI panel.");
            }

            sub.config_link = realConfig;
            sub.expiry_date = expiry;

            await manager.save(sub);

            // Flag user
            currentDbUser.has_used_trial = true;
            await manager.save(currentDbUser);

            return sub;
        });
    }
}
