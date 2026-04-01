import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { UpdateUserDto } from './dto/auth.dto';

const mockGuard = { canActivate: () => true };

const mockUsersService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

/** Unit tests for UsersController */
describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(JwtAuthGuard).useValue(mockGuard)
      .overrideGuard(AdminGuard).useValue(mockGuard)
      .compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  // findAll
  describe('findAll', () => {
    it('calls usersService.findAll with parsed page number', async () => {
      const paginated = { users: [], total: 0, totalPages: 1, currentPage: 1 };
      mockUsersService.findAll.mockResolvedValue(paginated);
      const result = await controller.findAll('2');
      expect(mockUsersService.findAll).toHaveBeenCalledWith(2);
      expect(result).toEqual(paginated);
    });

    it('defaults to page 1 when no page param is passed', async () => {
      mockUsersService.findAll.mockResolvedValue({ users: [], total: 0, totalPages: 1, currentPage: 1 });
      await controller.findAll('1');
      expect(mockUsersService.findAll).toHaveBeenCalledWith(1);
    });
  });

  // findOne
  describe('findOne', () => {
    it('calls usersService.findById with the correct id', async () => {
      const user = { _id: 'user_1', name: 'Sarah', role: 'staff' };
      mockUsersService.findById.mockResolvedValue(user);
      const result = await controller.findOne('user_1');
      expect(mockUsersService.findById).toHaveBeenCalledWith('user_1');
      expect(result).toEqual(user);
    });
  });

  // update
  describe('update', () => {
    it('calls usersService.update with id and dto', async () => {
      const dto: UpdateUserDto = { name: 'Updated Name' };
      const updated = { _id: 'user_1', name: 'Updated Name', role: 'staff' };
      mockUsersService.update.mockResolvedValue(updated);
      const req = {
        user: { _id: { toString: () => 'admin_1' },}
      };

      const result = await controller.update('user_1', dto, req as any);

      expect(mockUsersService.update).toHaveBeenCalledWith( 'user_1', dto, 'admin_1' );
      expect(result).toEqual(updated);
    });
  });

  // delete
  describe('delete', () => {
    it('calls usersService.delete with id and requesting user id from req', async () => {
      const req = { user: { _id: { toString: () => 'admin_1' } } };
      mockUsersService.delete.mockResolvedValue({ message: 'User deleted successfully' });
      const result = await controller.delete('user_2', req as any);
      expect(mockUsersService.delete).toHaveBeenCalledWith('user_2', 'admin_1');
      expect(result).toEqual({ message: 'User deleted successfully' });
    });
  });
});