import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsAvailableToPlan1775919184587 implements MigrationInterface {
    name = 'AddIsAvailableToPlan1775919184587'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "npvt_configs" DROP CONSTRAINT "FK_npvt_configs_plan"`);
        await queryRunner.query(`ALTER TABLE "npvt_configs" DROP CONSTRAINT "FK_npvt_configs_sub"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_npvt_config"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_c65104e572ae7ecb20993ccb0dd"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_0deaa0ee5092d45fac99139de7c"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_2bfb40d4802a8b42400f636388e"`);
        await queryRunner.query(`ALTER TABLE "plans" ADD "is_available" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "invitation_codes" ADD CONSTRAINT "UQ_c65104e572ae7ecb20993ccb0dd" UNIQUE ("code")`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "UQ_6d86e21139e93422c240cb7a66b" UNIQUE ("track_id")`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "UQ_0deaa0ee5092d45fac99139de7c" UNIQUE ("tx_hash")`);
        await queryRunner.query(`ALTER TABLE "npvt_configs" ADD CONSTRAINT "FK_c06ca4ce70d12d122a38633ba42" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "npvt_configs" ADD CONSTRAINT "FK_93c9711b292ca0977feb8af56c5" FOREIGN KEY ("assigned_to_sub_id") REFERENCES "subscriptions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_18739a844380f869eb6b35cc465" FOREIGN KEY ("npvt_config_id") REFERENCES "npvt_configs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_18739a844380f869eb6b35cc465"`);
        await queryRunner.query(`ALTER TABLE "npvt_configs" DROP CONSTRAINT "FK_93c9711b292ca0977feb8af56c5"`);
        await queryRunner.query(`ALTER TABLE "npvt_configs" DROP CONSTRAINT "FK_c06ca4ce70d12d122a38633ba42"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "UQ_0deaa0ee5092d45fac99139de7c"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "UQ_6d86e21139e93422c240cb7a66b"`);
        await queryRunner.query(`ALTER TABLE "invitation_codes" DROP CONSTRAINT "UQ_c65104e572ae7ecb20993ccb0dd"`);
        await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "is_available"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_2bfb40d4802a8b42400f636388e" ON "transactions" ("track_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_0deaa0ee5092d45fac99139de7c" ON "transactions" ("tx_hash") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_c65104e572ae7ecb20993ccb0dd" ON "invitation_codes" ("code") `);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_npvt_config" FOREIGN KEY ("npvt_config_id") REFERENCES "npvt_configs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "npvt_configs" ADD CONSTRAINT "FK_npvt_configs_sub" FOREIGN KEY ("assigned_to_sub_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "npvt_configs" ADD CONSTRAINT "FK_npvt_configs_plan" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
