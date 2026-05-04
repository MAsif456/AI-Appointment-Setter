import {
  Controller, Get, Patch, Delete,
  Param, Body, Query, UseGuards, Req,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto, UpdateNotificationPreferencesDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

/**
 * Admin-only endpoints for managing user accounts.
 * All routes require JwtAuthGuard + AdminGuard.
 *
 * User creation is handled by POST /auth/create-user in AuthController.
 *
 * Notification preference endpoints (GET/PATCH /users/me/notification-preferences)
 * are protected by JwtAuthGuard only — any authenticated user can manage their own prefs.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Returns the authenticated user's notification preferences.
   * Returns schema defaults if the user has never saved preferences.
   */
  @Get('me/notification-preferences')
  @UseGuards(JwtAuthGuard)
  async getNotificationPreferences(@Req() req: any) {
    return this.usersService.getNotificationPreferences(req.user._id.toString());
  }

  /**
   * Updates the authenticated user's notification preferences.
   * Only the fields present in the body are changed.
   */
  @Patch('me/notification-preferences')
  @UseGuards(JwtAuthGuard)
  async updateNotificationPreferences(
    @Req() req: any,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(req.user._id.toString(), dto);
  }

  /**
   * Returns a paginated list of all users.
   * @param page - Page number (1-based, default 1). Shows 5 users per page.
   */
  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAll(@Query('page') page = '1') {
    return this.usersService.findAll(parseInt(page, 10));
  }

  /** Returns a single user by ID. */
  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  /**
   * Updates a user's name, email, role, or assigned clinics.
   * Passes the requesting admin's ID so self-demotion can be blocked.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    return this.usersService.update(id, dto, req.user._id.toString());
  }

  /**
   * Deletes a user account.
   * Cannot delete own account or the last admin.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.usersService.delete(id, req.user._id.toString());
  }
}