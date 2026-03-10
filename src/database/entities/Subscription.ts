import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './User';
import { Plan } from './Plan';
import { Coupon } from './Coupon';

@Entity('subscriptions')
export class Subscription {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column()
    user_id: number;

    @Column({ type: 'varchar', length: 20, unique: true })
    track_id: string; // User friendly tracking ID for support

    @ManyToOne(() => Plan)
    @JoinColumn({ name: 'plan_id' })
    plan: Plan;

    @Column()
    plan_id: number;

    @ManyToOne(() => Coupon, { nullable: true })
    @JoinColumn({ name: 'coupon_id' })
    coupon: Coupon;

    @Column({ nullable: true })
    coupon_id: number;

    @Column({ type: 'text', unique: true, nullable: true })
    napster_config_id: string; // Remote UUID in VPN Panel

    @Column({ type: 'text', nullable: true })
    config_link: string; // Verification/connection string

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status: string; // 'pending', 'active', 'expired', 'disabled'

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    remaining_data_gb: number;

    @Column({ type: 'timestamp', nullable: true })
    expiry_date: Date;

    @CreateDateColumn()
    created_at: Date;
}
