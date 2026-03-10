import { AppDataSource } from '../database/data-source';
import { Subscription, Transaction, User, Plan } from '../database/entities';

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
    static async createPendingPurchase(user: User, plan: Plan, txHash: string, trackId: string): Promise<{ subscription: Subscription, transaction: Transaction }> {
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

            // Generate a random 8-character alphanumeric track ID (e.g. TRK-A1B2C3D4)
            sub.track_id = 'TRK-' + Math.random().toString(36).substring(2, 10).toUpperCase();

            // We set expiry/data later when exactly activated by the VPN API, 
            // but we can initialize data to plan structure.
            sub.remaining_data_gb = plan.volume_gb;

            const savedSub = await queryRunner.manager.save(sub);

            // 2. Create the Pending Transaction
            const tx = new Transaction();
            tx.user_id = user.id;
            tx.sub_id = savedSub.id;
            tx.tx_hash = txHash;
            tx.amount = plan.price_usdt;
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
     * Admin approves a subscription. Marks it active, generates a dummy config, and sets expiry.
     */
    static async approveSubscription(subId: number): Promise<Subscription> {
        return await AppDataSource.transaction(async manager => {
            const sub = await manager.findOne(Subscription, { where: { id: subId }, relations: ['plan', 'user'] });
            if (!sub) throw new Error("Subscription not found");
            if (sub.status !== 'pending') throw new Error(`Cannot approve a subscription with status: ${sub.status}`);

            const tx = await manager.findOne(Transaction, { where: { sub_id: subId } });
            if (!tx) throw new Error("Transaction not found");

            // Generate dummy config
            const dummyConfig = `vless://dummy-uuid-${sub.user_id}-${Date.now()}@vprivate-server:443?type=tcp&security=tls#${sub.track_id}`;

            // Set Expiry Date based on plan duration
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + sub.plan.duration_days);

            sub.status = 'active';
            sub.config_link = dummyConfig;
            sub.expiry_date = expiry;

            tx.status = 'confirmed';

            await manager.save(sub);
            await manager.save(tx);

            return sub;
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

            const dummyConfig = `vless://trial-dummy-uuid-${currentDbUser.id}-${Date.now()}@vprivate-server:443?type=tcp&security=tls#${trackId}`;

            const expiry = new Date();
            expiry.setDate(expiry.getDate() + trialPlan.duration_days);

            sub.config_link = dummyConfig;
            sub.expiry_date = expiry;

            await manager.save(sub);

            // Flag user
            currentDbUser.has_used_trial = true;
            await manager.save(currentDbUser);

            return sub;
        });
    }
}
