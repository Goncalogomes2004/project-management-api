import { Test, TestingModule } from '@nestjs/testing';
import { UsersMainController } from './users_main.controller';

describe('UsersMainController', () => {
  let controller: UsersMainController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersMainController],
    }).compile();

    controller = module.get<UsersMainController>(UsersMainController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
