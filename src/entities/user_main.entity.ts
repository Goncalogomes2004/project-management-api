import { Entity, PrimaryGeneratedColumn, Column, OneToMany, BeforeInsert, Unique } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SitesUsers } from './sites_users.entity';

@Entity({ name: 'user_main' })
@Unique(['email'])
export class UserMain {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100 })
    nome: string;

    @Column({ length: 100 })
    email: string;

    @Column({ length: 100 })
    password: string;

    @Column({ type: 'tinyint' })
    admin: boolean;

    @OneToMany(() => SitesUsers, su => su.user)
    sitesUsers: SitesUsers[];

    @BeforeInsert()
    private async hashPassword() {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }

    async hasPassword(plain: string): Promise<boolean> {
        return bcrypt.compare(plain, this.password);
    }
}
