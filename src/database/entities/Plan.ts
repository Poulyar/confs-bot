import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Subscription } from './Subscription';

@Entity('plans')
export class Plan {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'text' })
    name: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price_usdt: number;

    @Column({ type: 'integer' })
    volume_gb: number;

    @Column({ type: 'integer' })
    duration_days: number;

    @OneToMany(() => Subscription, (subscription) => subscription.plan)
    subscriptions: Subscription[];
}
