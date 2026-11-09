import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { FindOptionsWhere } from "typeorm";
import type { Principal } from "../auth/auth.service";
import { UserRole } from "../users/user.entity";
import { Match } from "./match.entity";

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match) private readonly repository: Repository<Match>,
  ) {}

  private visibility(principal: Principal): FindOptionsWhere<Match> {
    if (principal.role === UserRole.Admin) return {};
    if (principal.role === UserRole.Driver)
      return { trip: { truck: { driverId: principal.id } } };
    return { load: { shipperId: principal.id } };
  }

  list(limit: number, offset: number, principal: Principal): Promise<Match[]> {
    return this.repository.find({
      where: this.visibility(principal),
      take: limit,
      skip: offset,
      order: { id: "ASC" },
    });
  }

  findById(id: string, principal: Principal): Promise<Match | null> {
    return this.repository.findOneBy({ ...this.visibility(principal), id });
  }
}
