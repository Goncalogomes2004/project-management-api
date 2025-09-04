import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { UsersMainService } from './users_main.service';
import { UserMain } from 'src/entities/user_main.entity';
import { SitesUsers } from 'src/entities/sites_users.entity';
import { Site } from 'src/entities/site.entity';
@Controller('users-main')
export class UsersMainController {
    constructor(private readonly usersService: UsersMainService) { }
    @Get()
    findAll(): Promise<UserMain[]> {
        return this.usersService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string): Promise<UserMain> {
        return this.usersService.findOne(+id);
    }

    @Get('/isAdmin/:id')
    findIsAdmin(@Param('id') id: string): Promise<number> {
        return this.usersService.findIsAdmin(+id);
    }



    @Post()
    create(@Body() user: Partial<UserMain>): Promise<UserMain> {
        return this.usersService.create(user);
    }

    @Post("/login")
    login(@Body() body: { email: string; password: string }) {
        console.log("login com sucesso")

        return this.usersService.login(body.email, body.password);
    }


    @Post(':userId/sites/batch')
    async assignSitesBatch(
        @Param('userId', ParseIntPipe) userId: number,
        @Body() body: { sites: { id: number; admin: boolean }[] }
    ): Promise<SitesUsers[]> {
        console.log("A associar sites ao user", userId, body.sites);
        return this.usersService.assignSitesToUserBatch(userId, body.sites);
    }

    @Get('/sites/:userId')
    getUserSites(@Param('userId', ParseIntPipe) userId: number): Promise<Site[]> {
        return this.usersService.getUserSites(userId);
    }



    @Get('/isSiteAdmin/:userId/:site_id')
    getIsAdminForSite(@Param('userId', ParseIntPipe) userId: number, @Param('site_id', ParseIntPipe) site_id: number): Promise<boolean> {
        return this.usersService.getIsAdminForSite(userId, site_id);
    }




    @Patch(':id/password')
    async changePassword(
        @Param('id') id: string,
        @Body('newPassword') newPassword: string,
    ): Promise<{ message: string }> {
        console.log("a alterar password", newPassword)
        await this.usersService.updatePassword(+id, newPassword);
        return { message: 'Password atualizada com sucesso!' };
    }



    @Delete('/sites/:userId')
    deleteUserSites(@Param('userId', ParseIntPipe) userId: number): Promise<void> {
        console.log("A apagar para o user", userId)
        return this.usersService.deleteUserSites(userId);
    }
}
