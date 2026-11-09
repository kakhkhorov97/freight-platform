import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repository: Repository<User>,
  ) {}

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
