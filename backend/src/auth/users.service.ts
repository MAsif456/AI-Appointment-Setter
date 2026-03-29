import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../database/schemas/user.schema';
import { UpdateUserDto } from './dto/auth.dto';

const PAGE_SIZE = 5;

/**
 * Handles admin CRUD operations for user accounts.
 * Separated from AuthService (single responsibility) to keep both files under 200 lines.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Returns a paginated list of all users for the User Management page.
   * @param page - 1-based page number (default: 1). Returns 5 users per page.
   */
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

  /**
   * Returns a single user by ID excluding sensitive fields.
   * @throws NotFoundException if the user does not exist
   */
  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findById(id)
      .select('-passwordHash -verificationToken -verificationTokenExpires -passwordResetToken -passwordResetExpires')
      .populate('assignedClinics', 'name address');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Updates a user's details.
   * Staff switching to admin has assigned clinics cleared.
   * @throws BadRequestException if switching to staff with no clinics
   */
  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const newRole = dto.role ?? user.role;
    const newClinics = dto.assignedClinics ?? user.assignedClinics.map(c => c.toString());

    if (newRole === 'staff' && newClinics.length === 0) {
      throw new BadRequestException('Staff members must have at least one clinic assigned');
    }

    if (dto.name) user.name = dto.name;
    if (dto.email) user.email = dto.email.toLowerCase();
    if (dto.role) user.role = dto.role;
    if (dto.assignedClinics !== undefined) {
      user.assignedClinics = dto.role === 'admin'
        ? []
        : dto.assignedClinics.map(id => new Types.ObjectId(id));
    }

    await user.save();
    this.logger.log(`User ${id} updated`);
    return user;
  }

  /**
   * Deletes a user account. Cannot delete own account.
   *
   * Security: Before deleting, we set isActive=false so the JWT strategy
   * immediately rejects any in-flight requests from that user.
   * The next API call the deleted staff member makes will get a 401,
   * which the frontend axios interceptor handles by logging them out.
   *
   * @throws BadRequestException if attempting to delete own account
   * @throws NotFoundException if the user does not exist
   */
  async delete(id: string, requestingUserId: string): Promise<{ message: string }> {
    if (id === requestingUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');

    // Deactivate first so any active session is rejected immediately
    // by validateUser() in the JWT strategy before the document is gone
    await this.userModel.findByIdAndUpdate(id, { isActive: false });

    // Small delay to allow any in-flight requests to hit the deactivation check
    await new Promise(resolve => setTimeout(resolve, 100));

    await this.userModel.findByIdAndDelete(id);
    this.logger.log(`User ${id} deleted by admin ${requestingUserId}`);
    return { message: 'User deleted successfully' };
  }
}