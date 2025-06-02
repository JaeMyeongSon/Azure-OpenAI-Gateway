import { Test, TestingModule } from '@nestjs/testing';
import { LoadBalancingController } from './load-balancing.controller';

describe('LoadBalancingController', () => {
  let controller: LoadBalancingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoadBalancingController],
    }).compile();

    controller = module.get<LoadBalancingController>(LoadBalancingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
