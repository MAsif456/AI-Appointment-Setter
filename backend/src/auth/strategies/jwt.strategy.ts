import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User, UserDocument } from '../../database/schemas/user.schema';

/**
 * JWT strategy that validates every incoming request token.
 *
 * In addition to the standard isActive check, it validates tokenVersion —
 * a counter stored on the user document that is incremented whenever their
 * role changes. If the version in the token is lower than the DB value,
 * the token was issued before the role change and is rejected with a 401.
 * The frontend axios interceptor then clears localStorage and redirects
 * the user to login, forcing them to re-authenticate with their new role.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  /**
   * Called on every protected request after the JWT is decoded.
   * @param payload - Decoded JWT payload containing sub, email, role, tokenVersion
   * @throws UnauthorizedException if the user is inactive or token is stale
   */
  async validate(payload: any): Promise<UserDocument> {
    const user = await this.userModel
      .findById(payload.sub)
      .select('-passwordHash');

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Session expired');
    }

    // Reject tokens issued before a role change
    const currentVersion = user.tokenVersion ?? 0;
    const tokenVersion = payload.tokenVersion ?? 0;

    if (tokenVersion < currentVersion) {
      throw new UnauthorizedException(
        'Your permissions have changed. Please log in again.',
      );
    }

    // Prevent refresh tokens (type: 'refresh' or missing type) from being used as Bearer tokens
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    return user;
  }
}