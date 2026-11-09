import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  parseTimeWindow,
  validatePositiveKg,
} from "../graphql/creation-validation";
import { toGeoPoint } from "../graphql/geo-point";
import { User, UserRole } from "../users/user.entity";
import { CreateLoadInput } from "./create-load.input";
import { Load } from "./load.entity";

@Injectable()
export class LoadsService {
  constructor(
    @InjectRepository(Load) private readonly repository: Repository<Load>,
  ) {}

  async create(shipperId: string, input: CreateLoadInput): Promise<Load> {
    const { start, end } = parseTimeWindow(
      input.pickupWindowStart,
      input.pickupWindowEnd,
    );
    validatePositiveKg(input.weightKg, "weightKg");
    if (
      !(await this.repository.manager.existsBy(User, {
        id: shipperId,
        role: UserRole.Shipper,
      }))
    ) {
      throw new BadRequestException("shipperId must refer to a shipper");
    }
    return this.repository.save(
      this.repository.create({
        ...input,
        pickupWindowStart: start,
        pickupWindowEnd: end,
        shipperId,
        pickup: toGeoPoint(input.pickup),
        delivery: toGeoPoint(input.delivery),
      }),
    );
  }

  list(limit: number, offset: number): Promise<Load[]> {
    return this.repository.find({
      take: limit,
      skip: offset,
      order: { id: "ASC" },
    });
  }

  findById(id: string): Promise<Load | null> {
    return this.repository.findOneBy({ id });
  }
}
