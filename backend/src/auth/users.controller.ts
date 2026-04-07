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
 * User creation is handled by POST /auth/create-user in AuthController.
 */
@Controller('users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Returns a paginated list of all users.
   * @param page - Page number (1-based, default 1). Shows 5 users per page.
   */
  @Get()
  async findAll(@Query('page') page = '1') {
    return this.usersService.findAll(parseInt(page, 10));
  }

  /** Returns a single user by ID. */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  /**
   * Updates a user's name, email, role, or assigned clinics.
   * Passes the requesting admin's ID so self-demotion can be blocked.
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    return this.usersService.update(id, dto, req.user._id.toString());
  }

  /**
   * Deletes a user account.
   * Cannot delete own account or the last admin.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.usersService.delete(id, req.user._id.toString());
  }
}