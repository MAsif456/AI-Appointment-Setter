import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../database/schemas/user.schema';
import { UpdateUserDto, UpdateNotificationPreferencesDto } from './dto/auth.dto';

const PAGE_SIZE = 5;

/**
 * Handles admin CRUD operations for user accounts.
 * Separated from AuthService to keep both files under 200 lines.
 *
 * Deletion rules:
 *   - You cannot delete your own account
 *   - Admin accounts cannot be deleted directly — an admin must first be
 *     demoted to staff by another admin, then deleted as a normal staff account
 *   - The super admin account (isSuperAdmin: true) can never be demoted or deleted
 *
 * Role change rules:
 *   - You cannot demote your own account
 *   - The super admin can never be demoted
 *   - tokenVersion is incremented on role change to immediately invalidate
 *     the affected user's JWT on their next request
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async findAll(page = 1) {
    const skip = (page - 1) * PAGE_SIZE;
    const [users, total] = await Promise.all([
      this.userModel
        .find()
        .select('-passwordHash -verificationToken -verificationTokenExpires -passwordResetToken -passwordResetExpires')
        .populate('assignedClinics', 'name address')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE),
      this.userModel.countDocuments(),
    ]);
    return { users, total, totalPages: Math.ceil(total / PAGE_SIZE), currentPage: page };
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findById(id)
      .select('-passwordHash -verificationToken -verificationTokenExpires -passwordResetToken -passwordResetExpires')
      .populate('assignedClinics', 'name address');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async countAdmins(): Promise<number> {
    return this.userModel.countDocuments({ role: 'admin' });
  }

  /**
   * Updates a user's details.
   * @param id            - ID of the user being updated
   * @param dto           - Fields to update
   * @param requesterId   - ID of the admin making the request
   */
  async update(id: string, dto: UpdateUserDto, requesterId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const newRole = dto.role ?? user.role;
    const newClinics = dto.assignedClinics ?? user.assignedClinics.map(c => c.toString());

    // Super admin can never be demoted
    if (user.isSuperAdmin && newRole === 'staff') {
      throw new BadRequestException('The super admin account cannot be demoted.');
    }

    // An admin cannot demote their own account
    if (id === requesterId && user.role === 'admin' && newRole === 'staff') {
      throw new BadRequestException(
        'You cannot change your own role. Ask another admin to do this.',
      );
    }

    // Must keep at least one admin
    if (user.role === 'admin' && newRole === 'staff') {
      const adminCount = await this.countAdmins();
      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot demote the last admin. Promote another user to admin first.',
        );
      }
    }

    if (newRole === 'staff' && newClinics.length === 0) {
      throw new BadRequestException('Staff members must have at least one clinic assigned');
    }

    if (dto.name) user.name = dto.name;
    if (dto.email) user.email = dto.email.toLowerCase();
    if (dto.assignedClinics !== undefined) {
      user.assignedClinics = newRole === 'admin'
        ? []
        : dto.assignedClinics.map(i => new Types.ObjectId(i));
    }

    // Increment tokenVersion when role changes so the user's JWT is rejected
    // on their next API call, forcing an immediate re-login with new permissions
    if (dto.role && dto.role !== user.role) {
      user.role = dto.role;
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      this.logger.log(`Role changed for user ${id} — tokenVersion: ${user.tokenVersion}`);
    }

    await user.save();
    this.logger.log(`User ${id} updated by admin ${requesterId}`);
    return user;
  }

  /**
   * Returns the notification preferences for the authenticated user.
   * If no preferences are stored yet, returns the schema defaults (all true).
   */
  async getNotificationPreferences(userId: string): Promise<UserDocument['notificationPreferences']> {
    const user = await this.userModel.findById(userId).select('notificationPreferences');
    if (!user) throw new NotFoundException('User not found');
    const prefs = user.notificationPreferences as any ?? {};
    return {
      generalNotifications: prefs.generalNotifications ?? true,
      emailNotifications: prefs.emailNotifications ?? true,
      stalledConversations: prefs.stalledConversations ?? true,
      escalatedConversations: prefs.escalatedConversations ?? true,
      bookingCancelled: prefs.bookingCancelled ?? true,
      newUserJoined: prefs.newUserJoined ?? true,
      appointmentReminders: prefs.appointmentReminders ?? true,
      gdprDataDeletion: prefs.gdprDataDeletion ?? true,
      newLead: prefs.newLead ?? true,
      appointmentRescheduled: prefs.appointmentRescheduled ?? true,
    };
  }

  /**
   * Updates notification preferences for the authenticated user.
   * Only the fields present in the DTO are changed; others are preserved.
   */
  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<UserDocument['notificationPreferences']> {
    const user = await this.userModel.findById(userId).select('notificationPreferences');
    if (!user) throw new NotFoundException('User not found');

    const current = user.notificationPreferences as any ?? {};

    const updated = {
      generalNotifications: dto.generalNotifications ?? current.generalNotifications ?? true,
      emailNotifications: dto.emailNotifications ?? current.emailNotifications ?? true,
      stalledConversations: dto.stalledConversations ?? current.stalledConversations ?? true,
      escalatedConversations: dto.escalatedConversations ?? current.escalatedConversations ?? true,
      bookingCancelled: dto.bookingCancelled ?? current.bookingCancelled ?? true,
      newUserJoined: dto.newUserJoined ?? current.newUserJoined ?? true,
      appointmentReminders: dto.appointmentReminders ?? current.appointmentReminders ?? true,
      gdprDataDeletion: dto.gdprDataDeletion ?? current.gdprDataDeletion ?? true,
      newLead: dto.newLead ?? current.newLead ?? true,
      appointmentRescheduled: dto.appointmentRescheduled ?? current.appointmentRescheduled ?? true,
    };

    await this.userModel.findByIdAndUpdate(userId, { $set: { notificationPreferences: updated } });
    this.logger.log(`Notification preferences updated for user ${userId}`);
    return updated;
  }

  /**
   * Checks whether a specific notification type is enabled for a user.
   * Returns false if generalNotifications is off, regardless of individual toggles.
   */
  async isNotificationEnabled(
    userId: string,
    type: 'emailNotifications' | 'stalledConversations' | 'escalatedConversations' | 'bookingCancelled' | 'newUserJoined' | 'appointmentReminders',
  ): Promise<boolean> {
    const prefs = await this.getNotificationPreferences(userId);
    if (!prefs.generalNotifications) return false;
    return prefs[type] ?? true;
  }

  /**
   * Deletes a staff user account.
   * Admin accounts cannot be deleted directly — they must be demoted to staff first.
   * The super admin account can never be deleted.
   */
  async delete(id: string, requestingUserId: string): Promise<{ message: string }> {
    if (id === requestingUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');

    // Super admin is permanently protected
    if (user.isSuperAdmin) {
      throw new BadRequestException('The super admin account cannot be deleted.');
    }

    // Admin accounts cannot be deleted — demote first, then delete
    if (user.role === 'admin') {
      throw new BadRequestException(
        'Admin accounts cannot be deleted directly. Demote the user to staff first, then delete.',
      );
    }

    // Deactivate first so any active JWT is rejected immediately
    await this.userModel.findByIdAndUpdate(id, { isActive: false });
    await new Promise(resolve => setTimeout(resolve, 100));
    await this.userModel.findByIdAndDelete(id);

    this.logger.log(`User ${id} deleted by admin ${requestingUserId}`);
    return { message: 'User deleted successfully' };
  }
}