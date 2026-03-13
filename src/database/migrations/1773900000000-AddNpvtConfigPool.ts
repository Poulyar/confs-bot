import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNpvtConfigPool1773900000000 implements MigrationInterface {
    name = 'AddNpvtConfigPool1773900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create npvt_configs pool table
        await queryRunner.query(`
            CREATE TABLE "npvt_configs" (
                "id" SERIAL PRIMARY KEY,
                "plan_id" integer NOT NULL,
                "filename" varchar(255) NOT NULL,
                "file_data" text NOT NULL,
                "is_assigned" boolean NOT NULL DEFAULT false,
                "assigned_to_sub_id" integer,
                "uploaded_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "FK_npvt_configs_plan" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION,
                CONSTRAINT "FK_npvt_configs_sub" FOREIGN KEY ("assigned_to_sub_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL
            )
        `);

        // Link subscriptions to their assigned npvt config
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN "npvt_config_id" integer`);
        await queryRunner.query(`
            ALTER TABLE "subscriptions"
            ADD CONSTRAINT "FK_subscriptions_npvt_config"
            FOREIGN KEY ("npvt_config_id") REFERENCES "npvt_configs"("id") ON DELETE SET NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_npvt_config"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "npvt_config_id"`);
        await queryRunner.query(`DROP TABLE "npvt_configs"`);
    }
}
