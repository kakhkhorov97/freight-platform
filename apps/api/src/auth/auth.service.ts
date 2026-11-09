import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  LessThanOrEqual,
  MoreThan,
  QueryFailedError,
  Repository,
} from "typeorm";
import { User, UserRole } from "../users/user.entity";
import { hashPassword, verifyPassword } from "./password";
import { AuthSession } from "./session.entity";

export interface Principal {
  id: string;
  role: UserRole;
  sessionHash: string;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  private readonly attempts = new Map<
    string,
    { count: number; expires: number }
  >();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthSession)
    private readonly sessions: Repository<AuthSession>,
  ) {}

  private limitAttempts(ip: string): void {
    const now = Date.now();
    for (const [key, attempt] of this.attempts) {
      if (attempt.expires <= now) this.attempts.delete(key);
    }
    const attempt = this.attempts.get(ip);
    if (
      (attempt && attempt.count >= 10) ||
      (!attempt && this.attempts.size >= 1000)
    ) {
      throw new HttpException(
        "Too many authentication attempts. Try again later.",
        429,
      );
    }
    if (attempt) attempt.count += 1;
    else this.attempts.set(ip, { count: 1, expires: now + 60_000 });
  }

  async register(
    ip: string,
    email: string,
    password: string,
    displayName: string,
    role: UserRole,
  ): Promise<User> {
    this.limitAttempts(ip);
    const normalizedEmail = email.trim().toLowerCase();
    const name = displayName.trim();
    if (
      normalizedEmail.length > 254 ||
      !/^[^@\s\p{Cc}]+@[^@\s\p{Cc}]+\.[^@\s\p{Cc}]+$/u.test(normalizedEmail)
    ) {
      throw new BadRequestException("A valid email address is required");
    }
    if ([...password].length < 15 || [...password].length > 128) {
      throw new BadRequestException("Password must contain 15–128 characters");
    }
    if (!name || [...name].length > 100 || /\p{Cc}/u.test(name)) {
      throw new BadRequestException(
        "displayName must contain 1–100 characters without control characters",
      );
    }
    if (role !== UserRole.Driver && role !== UserRole.Shipper) {
      throw new BadRequestException(
        "Only driver and shipper roles can be registered",
      );
    }
    const passwordHash = await hashPassword(password);
    try {
      return await this.users.save(
        this.users.create({
          email: normalizedEmail,
          passwordHash,
          displayName: name,
          role,
        }),
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.driverError.constraint === "UQ_users_email"
      ) {
        throw new ConflictException(
          "An account with this email already exists",
        );
      }
      throw error;
    }
  }

  async login(ip: string, email: string, password: string) {
    this.limitAttempts(ip);
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.length > 254 || Buffer.byteLength(password) > 512) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const user = await this.users.findOne({
      where: { email: normalizedEmail },
      select: { id: true, passwordHash: true },
    });
    if (
      !(await verifyPassword(password, user?.passwordHash ?? null)) ||
      !user
    ) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.sessions.delete({ expiresAt: LessThanOrEqual(new Date()) });
    await this.sessions.insert({
      tokenHash: tokenHash(token),
      userId: user.id,
      expiresAt,
    });
    return { token, expiresAt };
  }

  async authenticate(authorization?: string): Promise<Principal> {
    const token = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/iu)?.[1];
    if (!token) throw new UnauthorizedException("A valid session is required");
    const session = await this.sessions.findOne({
      where: { tokenHash: tokenHash(token), expiresAt: MoreThan(new Date()) },
      relations: { user: true },
    });
    if (!session)
      throw new UnauthorizedException("A valid session is required");
    return {
      id: session.userId,
      role: session.user.role,
      sessionHash: session.tokenHash,
    };
  }

  async logout(principal: Principal): Promise<boolean> {
    await this.sessions.delete(principal.sessionHash);
    return true;
  }
}
