import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Site } from './site.entity';

@Entity({ name: 'atividades' })
export class Atividade {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    site_id: number;

    @Column({ length: 100 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'datetime', nullable: true })
    due_date: Date;

    @ManyToOne(() => Site, site => site.atividades, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'site_id' })
    site: Site;
}
