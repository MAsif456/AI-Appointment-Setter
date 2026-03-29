import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('UsersService', () => {
  let service: UsersService;
  let model: any;

  const mockUser = (overrides = {}) => ({
    _id: new Types.ObjectId().toString(),
    name: 'Test User',
    email: 'test@example.com',
    role: 'staff',
    assignedClinics: [new Types.ObjectId()],
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  beforeEach(async () => {
    model = {
      find: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken('User'), useValue: model },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const users = [mockUser()];
      const chain = {
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(users),
      };

      model.find.mockReturnValue(chain);
      model.countDocuments.mockResolvedValue(10);

      const result = await service.findAll(1);

      expect(result.users).toEqual(users);
      expect(result.total).toBe(10);
      expect(result.totalPages).toBe(2);
      expect(result.currentPage).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return user if found', async () => {
      const user = mockUser();
      const chain = {
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(user),
      };

      model.findById.mockReturnValue(chain);

      const result = await service.findById('id');

      expect(result).toEqual(user);
    });

    it('should throw if user not found', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(null),
      };

      model.findById.mockReturnValue(chain);

      await expect(service.findById('id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update user normally', async () => {
      const user = mockUser();
      model.findById.mockResolvedValue(user);

      const result = await service.update(user._id, {
        name: 'New Name',
        email: 'NEW@EMAIL.COM',
      });

      expect(user.name).toBe('New Name');
      expect(user.email).toBe('new@email.com');
      expect(user.save).toHaveBeenCalled();
      expect(result).toBe(user);
    });

    it('should clear clinics when role becomes admin', async () => {
      const user = mockUser();
      model.findById.mockResolvedValue(user);

      await service.update(user._id, {
        role: 'admin',
        assignedClinics: ['507f1f77bcf86cd799439011'],
      });

      expect(user.assignedClinics).toEqual([]);
    });

    it('should map clinics to ObjectId for staff', async () => {
      const user = mockUser();
      model.findById.mockResolvedValue(user);

      await service.update(user._id, {
        role: 'staff',
        assignedClinics: ['507f1f77bcf86cd799439011'],
      });

      expect(user.assignedClinics[0]).toBeInstanceOf(Types.ObjectId);
    });

    it('should throw if staff has no clinics', async () => {
      const user = mockUser({ assignedClinics: [] });
      model.findById.mockResolvedValue(user);

      await expect(
        service.update(user._id, { role: 'staff', assignedClinics: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if user not found', async () => {
      model.findById.mockResolvedValue(null);

      await expect(
        service.update('id', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      const user = mockUser();
      model.findById.mockResolvedValue(user);
      model.findByIdAndUpdate.mockResolvedValue(true);
      model.findByIdAndDelete.mockResolvedValue(true);

      jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => fn());

      const result = await service.delete('id1', 'id2');

      expect(model.findByIdAndUpdate).toHaveBeenCalled();
      expect(model.findByIdAndDelete).toHaveBeenCalled();
      expect(result.message).toBe('User deleted successfully');
    });

    it('should throw if deleting own account', async () => {
      await expect(
        service.delete('same-id', 'same-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if user not found', async () => {
      model.findById.mockResolvedValue(null);

      await expect(
        service.delete('id1', 'id2'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});