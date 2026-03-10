import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User';
import { Subscription } from './Subscription';

@Entity('coupons')
export class Coupon {
    @PrimaryGeneratedColumn()
    id: number;

    // Coupon belongs to a specific user
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ nullable: true })
    user_id: number;

    @Column({ type: 'varchar', length: 20, unique: true })
    code: string;

    @Column({ type: 'integer', default: 0 })
    discount_percent: number = 0;

    @Column({ type: 'boolean', default: false })
    is_used: boolean = false;

    @Column({ type: 'timestamp', nullable: true })
    expiry_date: Date;

    @OneToMany(() => Subscription, (sub) => sub.coupon)
    subscriptions: Subscription[];
}
