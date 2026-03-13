import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1772891570118 implements MigrationInterface {
    name = 'Initial1772891570118'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "invitation_codes" ("id" SERIAL NOT NULL, "code" character varying(50) NOT NULL, "is_used" boolean NOT NULL DEFAULT false, "creator_id" integer, "used_by_id" integer, CONSTRAINT "UQ_c65104e572ae7ecb20993ccb0dd" UNIQUE ("code"), CONSTRAINT "PK_707eabf9705bec823c436dfa264" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "telegram_id" bigint NOT NULL, "username" text, "has_used_trial" boolean NOT NULL DEFAULT false, "is_admin" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "language" character varying(5), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "invited_by_user_id" integer, CONSTRAINT "UQ_1a1e4649fd31ea6ec6b025c7bfc" UNIQUE ("telegram_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "subscriptions" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "plan_id" integer NOT NULL, "napster_config_id" text, "config_link" text, "status" character varying(20) NOT NULL DEFAULT 'pending', "remaining_data_gb" numeric(10,2), "expiry_date" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6641160edd9811deb609a478e34" UNIQUE ("napster_config_id"), CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "plans" ("id" SERIAL NOT NULL, "name" text NOT NULL, "price_usdt" numeric(10,2) NOT NULL, "volume_gb" integer NOT NULL, "duration_days" integer NOT NULL, CONSTRAINT "PK_3720521a81c7c24fe9b7202ba61" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "coupons" ("id" SERIAL NOT NULL, "user_id" integer, "code" character varying(20) NOT NULL, "discount_percent" integer NOT NULL DEFAULT '0', "is_used" boolean NOT NULL DEFAULT false, "expiry_date" TIMESTAMP, CONSTRAINT "UQ_e025109230e82925843f2a14c48" UNIQUE ("code"), CONSTRAINT "PK_d7ea8864a0150183770f3e9a8cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "sub_id" integer NOT NULL, "track_id" character varying(20), "tx_hash" text NOT NULL, "amount" numeric(10,2), "status" character varying(20) NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0deaa0ee5092d45fac99139de7c" UNIQUE ("tx_hash"), CONSTRAINT "UQ_2bfb40d4802a8b42400f636388e" UNIQUE ("track_id"), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "invitation_codes" ADD CONSTRAINT "FK_e6c44819f9b3241db39d33613ac" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invitation_codes" ADD CONSTRAINT "FK_3d98a840651f0222bd640977ee9" FOREIGN KEY ("used_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_f18afc9d813b651ab321b83dafa" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_d0a95ef8a28188364c546eb65c1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_e45fca5d912c3a2fab512ac25dc" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD CONSTRAINT "FK_9974c02e617aa96ddafd8404323" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_e1c4e6511ab14b061034e894bcb" FOREIGN KEY ("sub_id") REFERENCES "subscriptions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_e1c4e6511ab14b061034e894bcb"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP CONSTRAINT "FK_9974c02e617aa96ddafd8404323"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_e45fca5d912c3a2fab512ac25dc"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_d0a95ef8a28188364c546eb65c1"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_f18afc9d813b651ab321b83dafa"`);
        await queryRunner.query(`ALTER TABLE "invitation_codes" DROP CONSTRAINT "FK_3d98a840651f0222bd640977ee9"`);
        await queryRunner.query(`ALTER TABLE "invitation_codes" DROP CONSTRAINT "FK_e6c44819f9b3241db39d33613ac"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TABLE "coupons"`);
        await queryRunner.query(`DROP TABLE "plans"`);
        await queryRunner.query(`DROP TABLE "subscriptions"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "invitation_codes"`);
    }

}
