import { AppDataSource } from '../database/data-source';
import { User, Subscription, Plan, Coupon } from '../database/entities';
import { VpnService } from './vpn.service';
import { logger } from '../utils/logger';

const subRepo = AppDataSource.getRepository(Subscription);
const planRepo = AppDataSource.getRepository(Plan);

export class SubscriptionService {

    /**
     * Called when a user clicks "Free Trial"
     */
    static async startTrial(user: User): Promise<Subscription | null> {
        if (user.has_used_trial) {
            throw new Error("You have already used your free trial.");
        }

        logger.info(`Starting free trial for user ${user.id}`);

        // 1. Create VPN Client (e.g. 500MB, 1 Day)
        const bytesLimit = 500 * 1024 * 1024;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 1);

        const vpnInfo = await VpnService.createClient(user, bytesLimit, expiryDate);

        const sub = new Subscription();
        sub.user_id = user.id;
        // Trial logic usually doesn't have a plan ID. But for foreign key constraint we might need a default row in plans table. Let's assume plan 1 is free trial for now.
        sub.plan_id = 1;

        // Convert to GB for the database
        const gbLimit = bytesLimit / (1024 * 1024 * 1024);
        sub.remaining_data_gb = gbLimit;

        sub.expiry_date = expiryDate;
        sub.config_link = vpnInfo.link;
        sub.napster_config_id = vpnInfo.remoteId;
        sub.status = 'active';

        const savedSub = await subRepo.save(sub);

        // 3. Mark user as having used their trial
        user.has_used_trial = true;
        await AppDataSource.getRepository(User).save(user);

        return savedSub;
    }

    /**
     * Called when a payment is confirmed by admin
     */
    static async activateSubscription(subId: number): Promise<Subscription> {
        const sub = await subRepo.findOne({ where: { id: subId }, relations: ['user', 'plan'] });
        if (!sub) throw new Error("Subscription not found");
        if (sub.status === 'active') throw new Error("Subscription is already active");

        // Here we would actually call the VpnService to create the client in the panel
        // Convert GB back to bytes
        const bytesLimit = (sub.remaining_data_gb || 0) * 1024 * 1024 * 1024;
        const vpnInfo = await VpnService.createClient(sub.user as unknown as User, bytesLimit, sub.expiry_date || new Date());

        sub.status = 'active';
        sub.napster_config_id = vpnInfo.remoteId;
        sub.config_link = vpnInfo.link;

        return await subRepo.save(sub);
    }
}
