process.env.JWT_SECRET = 'test-secret';

import { Test, TestingModule } from '@nestjs/testing';
import { AuthModule } from './auth.module';
import { getModelToken } from '@nestjs/mongoose';

describe('AuthModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(getModelToken('User'))
      .useValue({})
      .compile();
  });

  it('should compile', () => {
    expect(module).toBeDefined();
  });
});