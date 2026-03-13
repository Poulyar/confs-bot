import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Plan } from './Plan';
import { Subscription } from './Subscription';

@Entity('npvt_configs')
export class NpvtConfig {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Plan)
    @JoinColumn({ name: 'plan_id' })
    plan: Plan;

    @Column()
    plan_id: number;

    @Column({ type: 'varchar', length: 255 })
    filename: string;

    @Column({ type: 'text' })
    file_data: string; // Base64-encoded .npvt content

    @Column({ type: 'boolean', default: false })
    is_assigned: boolean;

    @ManyToOne(() => Subscription, { nullable: true })
    @JoinColumn({ name: 'assigned_to_sub_id' })
    subscription: Subscription;

    @Column({ nullable: true })
    assigned_to_sub_id: number;

    @CreateDateColumn()
    uploaded_at: Date;
}
