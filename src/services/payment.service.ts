import { AppDataSource } from '../database/data-source';
import { Transaction, User, Subscription } from '../database/entities';

const txRepo = AppDataSource.getRepository(Transaction);

export class PaymentService {

    /**
     * Records a new user transaction submission 
     * Default state is 'pending' until Admin checks their wallet.
     */
    static async submitTransactionHash(user: User, subscriptionId: number, hash: string, expectedUsdt: number): Promise<Transaction | null> {
        // Validation: Ensure hash isn't already used
        const existingTx = await txRepo.findOne({ where: { tx_hash: hash } });
        if (existingTx) {
            throw new Error("Transaction hash has already been submitted.");
        }

        const tx = new Transaction();
        tx.user_id = user.id;
        tx.sub_id = subscriptionId;
        tx.tx_hash = hash;
        tx.amount = expectedUsdt;
        tx.status = 'pending';

        return await txRepo.save(tx);
    }

    /**
     * Admin function: Approves a transaction, which in the bot logic should trigger VPN connection state change
     */
    static async approveTransaction(txId: number): Promise<Transaction | null> {
        const tx = await txRepo.findOne({ where: { id: txId } });
        if (!tx) return null;

        tx.status = 'confirmed';
        return await txRepo.save(tx);
    }

    /**
     * Admin function: Rejects a fake/invalid transaction
     */
    static async rejectTransaction(txId: number): Promise<Transaction | null> {
        const tx = await txRepo.findOne({ where: { id: txId } });
        if (!tx) return null;

        tx.status = 'rejected';
        return await txRepo.save(tx);
    }
}
