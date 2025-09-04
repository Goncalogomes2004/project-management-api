import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserMain } from 'src/entities/user_main.entity';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Site } from 'src/entities/site.entity';
import { SitesUsers } from 'src/entities/sites_users.entity';
import { ChangesGateway } from 'src/Gateway/updates.gateway';

@Injectable()
export class UsersMainService {



    constructor(
        @InjectRepository(UserMain)
        private usersRepository: Repository<UserMain>,
        private readonly jwtService: JwtService,
        @InjectRepository(Site)
        private sitesRepo: Repository<Site>,
        @InjectRepository(SitesUsers)
        private sitesUsersRepo: Repository<SitesUsers>,
        private changesGateway: ChangesGateway,

    ) { }



    async assignSiteToUser(
        userId: number,
        siteId: number,
        admin: boolean = false
    ): Promise<SitesUsers> {
        // Verifica se usuário e site existem
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) throw new Error('Utilizador não encontrado');

        const site = await this.sitesRepo.findOne({ where: { id: siteId } });
        if (!site) throw new Error('Site não encontrado');

        // 🔹 Verifica se já existe associação
        const existing = await this.sitesUsersRepo.findOne({
            where: { user_id: userId, site_id: siteId },
        });

        if (existing) {
            // Remove a associação existente
            await this.sitesUsersRepo.remove(existing);
        }
        // Cria a nova associação
        const association = this.sitesUsersRepo.create({
            user_id: userId,
            site_id: siteId,
            admin,
            user,
            site,
        });
        this.changesGateway.sendTableAltered("user_main", 1)
        this.changesGateway.sendUserPermissionsAltered(userId);

        return this.sitesUsersRepo.save(association);
    }


    async getUserSites(userId: number): Promise<Site[]> {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) throw new Error('Utilizador não encontrado');

        if (!user.admin) {
            const sites = await this.sitesRepo
                .createQueryBuilder('site')
                .innerJoin('site.sitesUsers', 'su', 'su.user_id = :userId', { userId })
                .getMany();


            return sites;
        }
        return this.sitesRepo.find();
    }


    async findIsAdmin(arg0: number): Promise<number> {
        const user = await this.usersRepository.findOne({ where: { id: arg0 } })
        return user?.admin ? 1 : 0
    }

    async create(user: Partial<UserMain>): Promise<UserMain> {
        const newUser = this.usersRepository.create({
            nome: user.nome,
            email: user.email,
            password: user.password,
            admin: user.admin
        });
        this.changesGateway.sendTableAltered("user_main", 1)

        return await this.usersRepository.save(newUser);
    }

    findAll(): Promise<UserMain[]> {
        return this.usersRepository.find();
    }

    async findOne(id: number): Promise<UserMain> {
        const user = await this.usersRepository.findOneBy({ id });
        if (!user) {
            throw new Error(`User with id ${id} not found`);
        }
        return user;
    }



    async assignSitesToUserBatch(
        userId: number,
        sites: { id: number; admin: boolean }[]
    ): Promise<SitesUsers[]> {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) throw new Error('Utilizador não encontrado');
        this.deleteUserSites(userId)
        const results: SitesUsers[] = [];

        for (const { id: siteId, admin } of sites) {
            const site = await this.sitesRepo.findOne({ where: { id: siteId } });
            if (!site) continue; // ignora se site não existir

            const existing = await this.sitesUsersRepo.findOne({
                where: { user_id: userId, site_id: siteId },
            });

            if (existing) {
                await this.sitesUsersRepo.remove(existing);
            }

            const association = this.sitesUsersRepo.create({
                user_id: userId,
                site_id: siteId,
                admin,
                user,
                site,
            });

            results.push(await this.sitesUsersRepo.save(association));
        }

        // envia notificação de alteração
        this.changesGateway.sendTableAltered("user_main", 1);
        this.changesGateway.sendUserPermissionsAltered(userId);

        return results;
    }


    async login(email: string, password: string): Promise<{ token: string, name: string, id: number, admin: boolean } | null> {
        const user = await this.usersRepository.findOne({
            where: { email: email },
            select: ['id', 'email', 'password', 'nome', 'admin']
        });

        if (!user) {
            throw new Error('Utilizador não existe');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            throw new Error('Credenciais Inválidas');
        }

        const users = await this.usersRepository.find({
            select: ['id', 'email', 'password', 'nome', 'admin']
        });

        const index = users.findIndex(u => u.email === email);


        const payload = { name: user.nome, id: user.id, admin: user.admin };
        const token = await this.jwtService.signAsync(payload);
        console.log("login com sucesso")
        return { token, name: user.nome, id: user.id, admin: user.admin };
    }


    async getIsAdminForSite(userId: number, site_id: number): Promise<boolean> {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        const site = await this.sitesRepo.findOne({ where: { id: site_id } });
        const connection = await this.sitesUsersRepo.findOne({ where: { site_id: site_id, user_id: userId } })

        return connection?.admin ?? false
    }


    async deleteUserSites(userId: number): Promise<void> {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) throw new Error('Utilizador não encontrado');
        this.changesGateway.sendTableAltered("user_main", 1)
        await this.sitesUsersRepo.delete({ user_id: userId });
    }



    async updatePassword(userId: number, newPassword: string): Promise<void> {
        const user = await this.usersRepository.findOne({ where: { id: userId } });

        if (!user) {
            throw new NotFoundException('Utilizador não encontrado');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        console.log("password mudada", hashedPassword)
        await this.usersRepository.update(userId, { password: hashedPassword });
    }

}
