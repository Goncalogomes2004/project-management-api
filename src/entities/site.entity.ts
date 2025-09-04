import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Atividade } from './atividade.entity';
import { SitesUsers } from './sites_users.entity';
import { SitesTabelas } from './sites-tabelas.entity';

@Entity({ name: 'sites' })
export class Site {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100 })
    name: string;

    @Column()
    active: boolean;

    @OneToMany(() => Atividade, atividade => atividade.site)
    atividades: Atividade[];

    @OneToMany(() => SitesUsers, su => su.site)
    sitesUsers: SitesUsers[];

    @OneToMany(() => SitesTabelas, (st: SitesTabelas) => st.site)
    sitesTabelas: SitesTabelas[];
}
