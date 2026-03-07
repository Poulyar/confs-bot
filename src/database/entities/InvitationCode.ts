import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('invitation_codes')
export class InvitationCode {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 50, unique: true })
    code: string;

    @Column({ type: 'boolean', default: false })
    is_used: boolean = false;

    // Admin or authorized user who generated this code
    @ManyToOne(() => User, (user) => user.codes_created, { nullable: true })
    @JoinColumn({ name: 'creator_id' })
    creator: User;

    @Column({ nullable: true })
    creator_id: number;

    // The user who eventually used this code (the new user)
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'used_by_id' })
    used_by: User;

    @Column({ nullable: true })
    used_by_id: number;
}
