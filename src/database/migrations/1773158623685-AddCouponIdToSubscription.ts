import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCouponIdToSubscription1773158623685 implements MigrationInterface {
    name = 'AddCouponIdToSubscription1773158623685'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure is_admin column exists and matches the User entity
        await queryRunner.query(
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" boolean NOT NULL DEFAULT false`
        );

        // Ensure track_id column exists and matches the Subscription entity
        await queryRunner.query(
            `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "track_id" character varying(20)`
        );
        await queryRunner.query(`ALTER TABLE "subscriptions" ALTER COLUMN "track_id" SET NOT NULL`);

        // Add coupon_id column and foreign key
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD "coupon_id" integer`);
        await queryRunner.query(
            `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_5759fd98f5e56940654ba474041" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_5759fd98f5e56940654ba474041"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ALTER COLUMN "track_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "coupon_id"`);
        // Keep the column definitions but relax constraints to match the previous state
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "is_admin" DROP NOT NULL`);
    }

}
