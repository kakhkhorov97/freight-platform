import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { parseTimeWindow } from "../graphql/creation-validation";
import { toGeoPoint } from "../graphql/geo-point";
import { Truck } from "../trucks/truck.entity";
import { CreateTripInput } from "./create-trip.input";
import { Trip } from "./trip.entity";

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip) private readonly repository: Repository<Trip>,
  ) {}

  async create(
    truckId: string,
    driverId: string,
    input: CreateTripInput,
  ): Promise<Trip> {
    const { start, end } = parseTimeWindow(
      input.departureAt,
      input.latestArrivalAt,
    );
    if (
      !(await this.repository.manager.existsBy(Truck, {
        id: truckId,
        driverId,
      }))
    ) {
      throw new BadRequestException("truckId must refer to one of your trucks");
    }
    return this.repository.save(
      this.repository.create({
        ...input,
        departureAt: start,
        latestArrivalAt: end,
        truckId,
        origin: toGeoPoint(input.origin),
        destination: toGeoPoint(input.destination),
      }),
    );
  }

  list(limit: number, offset: number): Promise<Trip[]> {
    return this.repository.find({
      take: limit,
      skip: offset,
      order: { id: "ASC" },
    });
  }

  findById(id: string): Promise<Trip | null> {
    return this.repository.findOneBy({ id });
  }
}
