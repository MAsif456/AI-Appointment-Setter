import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('UsersService', () => {
  let service: UsersService;
  let model: any;

  /** Builds a minimal fake user document */
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

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated users with total and page info', async () => {
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

  // ─── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the user when found', async () => {
      const user = mockUser();
      model.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(user),
      });
      expect(await service.findById('id')).toEqual(user);
    });

    it('throws NotFoundException when user does not exist', async () => {
      model.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(null),
      });
      await expect(service.findById('id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getNotificationPreferences ─────────────────────────────────────────────

  describe('getNotificationPreferences', () => {
    it('returns stored preferences when the user exists', async () => {
      const prefs = { generalNotifications: true, emailNotifications: false, stalledConversations: true, escalatedConversations: true, bookingCancelled: true, newUserJoined: true, appointmentReminders: true };
      model.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ notificationPreferences: prefs }) });
      expect(await service.getNotificationPreferences('uid')).toEqual(prefs);
    });

    it('returns all-true defaults when notificationPreferences is undefined', async () => {
      model.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ notificationPreferences: undefined }) });
      const result = await service.getNotificationPreferences('uid');
      expect(result).toEqual({ generalNotifications: true, emailNotifications: true, stalledConversations: true, escalatedConversations: true, bookingCancelled: true, newUserJoined: true, appointmentReminders: true });
    });

    it('throws NotFoundException when user does not exist', async () => {
      model.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
      await expect(service.getNotificationPreferences('bad')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateNotificationPreferences ──────────────────────────────────────────

  describe('updateNotificationPreferences', () => {
    it('merges partial DTO over existing preferences and returns updated values', async () => {
      const existing = { generalNotifications: true, emailNotifications: true, stalledConversations: true, escalatedConversations: true, bookingCancelled: true, newUserJoined: true, appointmentReminders: true };
      model.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ notificationPreferences: existing }) });
      model.findByIdAndUpdate.mockResolvedValue({});

      const result = await service.updateNotificationPreferences('uid', { emailNotifications: false });

      expect(result.emailNotifications).toBe(false);
      expect(result.generalNotifications).toBe(true);
      expect(result.stalledConversations).toBe(true);
      expect(result.escalatedConversations).toBe(true);
      expect(result.bookingCancelled).toBe(true);
      expect(result.newUserJoined).toBe(true);
      expect(result.appointmentReminders).toBe(true);
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith('uid', { $set: { notificationPreferences: result } });
    });

    it('saves all fields when full DTO is provided', async () => {
      model.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ notificationPreferences: undefined }) });
      model.findByIdAndUpdate.mockResolvedValue({});

      const dto = { generalNotifications: false, emailNotifications: false, stalledConversations: false, escalatedConversations: false, bookingCancelled: false, newUserJoined: false, appointmentReminders: false };
      const result = await service.updateNotificationPreferences('uid', dto);

      expect(result).toEqual(dto);
    });

    it('throws NotFoundException when user does not exist', async () => {
      model.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
      await expect(service.updateNotificationPreferences('bad', {})).rejects.toThrow(NotFoundException);
    });
  });

  // ─── isNotificationEnabled ──────────────────────────────────────────────────

  describe('isNotificationEnabled', () => {
    it('returns false when generalNotifications is off, regardless of individual toggle', async () => {
      const prefs = { generalNotifications: false, emailNotifications: true, stalledConversations: true, escalatedConversations: true, appointmentReminders: true };
      model.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ notificationPreferences: prefs }) });
      expect(await service.isNotificationEnabled('uid', 'emailNotifications')).toBe(false);
    });

    it('returns false when the specific toggle is off and general is on', async () => {
      const prefs = { generalNotifications: true, emailNotifications: false, stalledConversations: true, escalatedConversations: true, appointmentReminders: true };
      model.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ notificationPreferences: prefs }) });
      expect(await service.isNotificationEnabled('uid', 'emailNotifications')).toBe(false);
    });

    it('returns true when general is on and the specific toggle is on', async () => {
      const prefs = { generalNotifications: true, emailNotifications: true, stalledConversations: true, escalatedConversations: true, appointmentReminders: true };
      model.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ notificationPreferences: prefs }) });
      expect(await service.isNotificationEnabled('uid', 'stalledConversations')).toBe(true);
    });

    it('returns false when escalatedConversations is off', async () => {
      const prefs = { generalNotifications: true, emailNotifications: true, stalledConversations: true, escalatedConversations: false, appointmentReminders: true };
      model.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ notificationPreferences: prefs }) });
      expect(await service.isNotificationEnabled('uid', 'escalatedConversations')).toBe(false);
    });

    it('returns false when appointmentReminders is off', async () => {
      const prefs = { generalNotifications: true, emailNotifications: true, stalledConversations: true, escalatedConversations: true, appointmentReminders: false };
      model.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ notificationPreferences: prefs }) });
      expect(await service.isNotificationEnabled('uid', 'appointmentReminders')).toBe(false);
    });
  });

  // ─── update — happy paths ───────────────────────────────────────────────────

  describe('update', () => {
    const REQUESTER = 'requester-id';

    it('updates name and email and saves', async () => {
      const user = mockUser();
      model.findById.mockResolvedValue(user);

      await service.update(user._id, { name: 'New Name', email: 'NEW@EMAIL.COM' }, REQUESTER);

      expect(user.name).toBe('New Name');
      expect(user.email).toBe('new@email.com');
      expect(user.save).toHaveBeenCalled();
    });

    it('clears assignedClinics when role changes to admin', async () => {
      const user = mockUser();
      model.findById.mockResolvedValue(user);

      await service.update(user._id, { role: 'admin', assignedClinics: ['507f1f77bcf86cd799439011'] }, REQUESTER);

      expect(user.assignedClinics).toEqual([]);
    });

    it('maps assignedClinics to ObjectIds for staff', async () => {
      const user = mockUser();
      model.findById.mockResolvedValue(user);

      await service.update(user._id, { role: 'staff', assignedClinics: ['507f1f77bcf86cd799439011'] }, REQUESTER);

      expect(user.assignedClinics[0]).toBeInstanceOf(Types.ObjectId);
    });

    it('increments tokenVersion when role changes', async () => {
      const adminUser = mockUser({ role: 'admin', tokenVersion: 2, isSuperAdmin: false });
      model.findById.mockResolvedValue(adminUser);
      model.countDocuments.mockResolvedValue(2); // two admins — demotion allowed

      await service.update(adminUser._id, { role: 'staff', assignedClinics: ['507f1f77bcf86cd799439011'] }, REQUESTER);

      expect(adminUser.tokenVersion).toBe(3);
    });

    it('does NOT increment tokenVersion when role is unchanged', async () => {
      const user = mockUser({ role: 'staff', tokenVersion: 1 });
      model.findById.mockResolvedValue(user);

      await service.update(user._id, { name: 'Only Name Change' }, REQUESTER);

      expect(user.tokenVersion).toBe(1);
    });

    it('throws NotFoundException when user does not exist', async () => {
      model.findById.mockResolvedValue(null);
      await expect(service.update('id', {}, REQUESTER)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when switching to staff with no clinics', async () => {
      const user = mockUser({ assignedClinics: [] });
      model.findById.mockResolvedValue(user);

      await expect(
        service.update(user._id, { role: 'staff', assignedClinics: [] }, REQUESTER),
      ).rejects.toThrow(BadRequestException);
    });
  });
});