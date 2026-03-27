import {
  Controller, Get, Patch, Delete,
  Param, Body, Query, UseGuards, Req,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

/**
 * Admin-only endpoints for managing user accounts.
 * All routes require JwtAuthGuard + AdminGuard.
 *
 * User creation is handled by POST /auth/create-user in AuthController
 * since it is part of the auth flow (sends verification email).
 */
@Controller('users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Returns a paginated list of all user accounts for the User Management page.
   * @param page - Page number (1-based, default: 1). Shows 5 users per page.
   */
  @Get()
  async findAll(@Query('page') page = '1') {
    return this.usersService.findAll(parseInt(page, 10));
  }

  /**
   * Returns a single user by ID.
   * @param id - The user's MongoDB ObjectId
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  /**
   * Updates a user's name, email, role, or assigned clinics.
   * @param id - The user's MongoDB ObjectId
   * @param dto - Fields to update (all optional)
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  /**
   * Deletes a user account. Cannot delete your own account.
   * @param id - The user's MongoDB ObjectId
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string, @Req() req) {
    return this.usersService.delete(id, req.user._id.toString());
  }
}