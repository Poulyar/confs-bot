import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './User';
import { Subscription } from './Subscription';

@Entity('transactions')
export class Transaction {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column()
    user_id: number;

    @ManyToOne(() => Subscription)
    @JoinColumn({ name: 'sub_id' })
    subscription: Subscription;

    @Column()
    sub_id: number;

    @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
    track_id: string; // User friendly tracking ID for support

    // The actual hash user pastes
    @Column({ type: 'text', unique: true })
    tx_hash: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    amount: number;

    // 'pending', 'confirmed', 'rejected'
    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status: string = 'pending';

    @CreateDateColumn()
    created_at: Date;
}
