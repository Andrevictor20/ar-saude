import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity("measurements")
@Unique("uq_measurement_resource_time", ["resourceUuid", "measuredAt"])
export class Measurement {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column()
  neighborhoodId: string;

  @Column()
  neighborhoodName: string;

  @Column()
  resourceUuid: string;

  @Column({ type: "int", nullable: true })
  aqi: number | null;

  @Column()
  level: string;

  @Column({ type: "double precision", nullable: true })
  pm10: number | null;

  @Column({ type: "double precision", nullable: true })
  pm2_5: number | null;

  @Column({ type: "double precision", nullable: true })
  no2: number | null;

  @Column({ type: "double precision", nullable: true })
  ozone: number | null;

  @Column({ type: "double precision", nullable: true })
  co: number | null;

  @Column({ type: "double precision", nullable: true })
  so2: number | null;

  @Column({ type: "double precision", nullable: true })
  nh3: number | null;

  @Column({ type: "double precision", nullable: true })
  no: number | null;

  @Column({ type: "double precision", nullable: true })
  latitude: number | null;

  @Column({ type: "double precision", nullable: true })
  longitude: number | null;

  @Index()
  @Column({ type: "timestamptz" })
  measuredAt: Date;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
