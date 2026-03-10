import { AppDataSource } from '../database/data-source';
import { Coupon } from '../database/entities';
import * as crypto from 'crypto';

export class CouponService {
    static getRepository() {
        return AppDataSource.getRepository(Coupon);
    }

    /**
     * Generates a new unique alpha-numeric time-usable coupon.
     * @param discountPercent The percentage discount (e.g., 20)
     * @param expiryHours How many hours from now the coupon expires
     * @param userId Optional. If provided, only this user can redeem it.
     */
    static async generateCoupon(discountPercent: number, expiryHours: number, userId?: number): Promise<Coupon> {
        const repo = this.getRepository();

        const buffer = crypto.randomBytes(4);
        const code = `DISC-${buffer.toString('hex').toUpperCase()}`;

        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + expiryHours);

        const coupon = repo.create({
            code,
            discount_percent: discountPercent,
            expiry_date: expiryDate,
            is_used: false
        });

        if (userId) {
            coupon.user_id = userId;
        }

        return await repo.save(coupon);
    }

    /**
     * Validates a coupon code.
     * Throws an error if invalid, expired, or already used.
     * Returns the Coupon entity if valid.
     */
    static async validateCoupon(code: string, userId?: number): Promise<Coupon> {
        const repo = this.getRepository();

        const coupon = await repo.findOne({ where: { code } });

        if (!coupon) {
            throw new Error('invalid_coupon_code');
        }

        if (coupon.is_used) {
            throw new Error('coupon_already_used');
        }

        if (coupon.expiry_date && coupon.expiry_date < new Date()) {
            throw new Error('coupon_expired');
        }

        if (coupon.user_id && userId && coupon.user_id !== userId) {
            throw new Error('coupon_not_for_user');
        }

        return coupon;
    }

    /**
     * Burns a coupon by marking it as used.
     */
    static async consumeCoupon(couponId: number): Promise<void> {
        const repo = this.getRepository();
        await repo.update(couponId, { is_used: true });
    }
}
