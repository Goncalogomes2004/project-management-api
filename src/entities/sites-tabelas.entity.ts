import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Site } from './site.entity';

@Entity({ name: 'sites_tabelas' })
export class SitesTabelas {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    site_id: number;

    @Column({ length: 100 })
    table_name: string;

    @Column({ length: 100 })
    table_id: string;

    @ManyToOne(() => Site, site => site.sitesTabelas, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'site_id' })
    site: Site;
}
