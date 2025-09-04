import { Entity, Column, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { UserMain } from './user_main.entity';
import { Site } from './site.entity';

@Entity({ name: 'sites_users' })
export class SitesUsers {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    site_id: number;

    @Column()
    user_id: number;

    @Column({ default: false })
    admin: boolean;

    @ManyToOne(() => Site, site => site.sitesUsers, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'site_id' })
    site: Site;

    @ManyToOne(() => UserMain, user => user.sitesUsers, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: UserMain;
}
