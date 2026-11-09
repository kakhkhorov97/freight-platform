import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Match } from "./match.entity";

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match) private readonly repository: Repository<Match>,
  ) {}

  list(limit: number, offset: number): Promise<Match[]> {
    return this.repository.find({
      take: limit,
      skip: offset,
      order: { id: "ASC" },
    });
  }

  findById(id: string): Promise<Match | null> {
    return this.repository.findOneBy({ id });
  }
}
