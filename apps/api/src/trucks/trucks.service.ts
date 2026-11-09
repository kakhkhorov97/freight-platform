import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { validatePositiveKg } from "../graphql/creation-validation";
import { User, UserRole } from "../users/user.entity";
import { Truck } from "./truck.entity";

@Injectable()
export class TrucksService {
  constructor(
    @InjectRepository(Truck) private readonly repository: Repository<Truck>,
  ) {}

  async create(
    driverId: string,
    plate: string,
    capacityKg: number,
  ): Promise<Truck> {
    const plateNumber = plate.replace(/\s/gu, "").toUpperCase();
    if (
      !plateNumber ||
      [...plateNumber].length > 32 ||
      /\p{Cc}/u.test(plateNumber)
    ) {
      throw new BadRequestException(
        "plateNumber must contain 1–32 characters without control characters",
      );
    }
    validatePositiveKg(capacityKg, "capacityKg");
    if (
      !(await this.repository.manager.existsBy(User, {
        id: driverId,
        role: UserRole.Driver,
      }))
    ) {
      throw new BadRequestException("driverId must refer to a driver");
    }
    try {
      return await this.repository.save(
        this.repository.create({ driverId, plateNumber, capacityKg }),
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.driverError.constraint === "UQ_trucks_plate_number"
      ) {
        throw new ConflictException("A truck with this plate already exists");
      }
      throw error;
    }
  }

  list(limit: number, offset: number): Promise<Truck[]> {
    return this.repository.find({
      take: limit,
      skip: offset,
      order: { id: "ASC" },
    });
  }

  findById(id: string): Promise<Truck | null> {
    return this.repository.findOneBy({ id });
  }
}
