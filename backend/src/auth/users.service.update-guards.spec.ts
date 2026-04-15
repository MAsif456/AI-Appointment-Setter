import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('UsersService — update guards and delete', () => {
  let service: UsersService;
  let model: any;

  const mockUser = (overrides = {}): any => ({
    _id: new Types.ObjectId().toString(),
    name: 'Test User',
    email: 'test@example.com',
    role: 'staff',
    isSuperAdmin: false,
    tokenVersion: 0,
    assignedClinics: [new Types.ObjectId()],
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  beforeEach(async () => {
    model = {
      find: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn(),
      findByIdAndUpdate: jest.fn().mockResolvedValue(true),
      findByIdAndDelete: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken('User'), useValue: model },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => { fn(); return 0 as any; });
  });

  afterEach(() => jest.restoreAllMocks());

  // ─── update — demotion protection ──────────────────────────────────────────

  describe('update — admin demotion protection', () => {
    it('throws when super admin is demoted', async () => {
      const superAdmin = mockUser({ role: 'admin', isSuperAdmin: true });
      model.findById.mockResolvedValue(superAdmin);

      await expect(
        service.update(superAdmin._id, { role: 'staff', assignedClinics: ['507f1f77bcf86cd799439011'] }, 'other-admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when admin demotes their own account', async () => {
      const admin = mockUser({ role: 'admin' });
      model.findById.mockResolvedValue(admin);

      await expect(
        service.update(admin._id, { role: 'staff', assignedClinics: ['507f1f77bcf86cd799439011'] }, admin._id),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when demoting the last admin', async () => {
      const admin = mockUser({ role: 'admin', isSuperAdmin: false });
      model.findById.mockResolvedValue(admin);
      model.countDocuments.mockResolvedValue(1); // only one admin

      await expect(
        service.update(admin._id, { role: 'staff', assignedClinics: ['507f1f77bcf86cd799439011'] }, 'other-requester'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows demotion when multiple admins exist', async () => {
      const admin = mockUser({ role: 'admin', isSuperAdmin: false });
      model.findById.mockResolvedValue(admin);
      model.countDocuments.mockResolvedValue(2); // two admins — safe to demote

      await expect(
        service.update(admin._id, { role: 'staff', assignedClinics: ['507f1f77bcf86cd799439011'] }, 'other-admin'),
      ).resolves.not.toThrow();
    });
  });

  // ─── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes a staff user and returns success message', async () => {
      const user = mockUser({ role: 'staff' });
      model.findById.mockResolvedValue(user);

      const result = await service.delete(user._id, 'requester-id');

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(user._id, { isActive: false });
      expect(model.findByIdAndDelete).toHaveBeenCalledWith(user._id);
      expect(result.message).toBe('User deleted successfully');
    });

    it('throws when deleting own account', async () => {
      await expect(service.delete('same-id', 'same-id')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when user does not exist', async () => {
      model.findById.mockResolvedValue(null);
      await expect(service.delete('id1', 'id2')).rejects.toThrow(NotFoundException);
    });

    it('throws when deleting the super admin account', async () => {
      const superAdmin = mockUser({ role: 'admin', isSuperAdmin: true });
      model.findById.mockResolvedValue(superAdmin);

      await expect(service.delete(superAdmin._id, 'other-admin')).rejects.toThrow(BadRequestException);
    });

    it('throws when trying to delete an admin account directly', async () => {
      const admin = mockUser({ role: 'admin', isSuperAdmin: false });
      model.findById.mockResolvedValue(admin);

      await expect(service.delete(admin._id, 'other-admin')).rejects.toThrow(BadRequestException);
    });
  });
});