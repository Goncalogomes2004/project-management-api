import { Module } from '@nestjs/common';
import { UsersMainService } from './users_main.service';
import { UsersMainController } from './users_main.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserMain } from 'src/entities/user_main.entity';
import { JwtModule } from '@nestjs/jwt';
import { Site } from 'src/entities/site.entity';
import { SitesUsers } from 'src/entities/sites_users.entity';
import { ChangesGateway } from 'src/Gateway/updates.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserMain, Site, SitesUsers]),
    JwtModule.register({
      secret: 'secretKey',           // chave secreta para assinatura dos tokens
      signOptions: { expiresIn: '1h' }, // tokens expiram em 1 hora
    }),
  ],
  providers: [UsersMainService, ChangesGateway],
  controllers: [UsersMainController],
  exports: [UsersMainService], // exporta para outros módulos se precisar
})
export class UsersMainModule { }
