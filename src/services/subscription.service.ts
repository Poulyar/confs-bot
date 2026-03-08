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
}
