import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User, UserRole } from "./user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repository: Repository<User>,
  ) {}

  create(displayName: string, role: UserRole): Promise<User> {
    const name = displayName.trim();
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
    return this.repository.save(
      this.repository.create({ displayName: name, role }),
    );
  }

  list(limit: number, offset: number): Promise<User[]> {
    return this.repository.find({
      take: limit,
      skip: offset,
      order: { id: "ASC" },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }
}
