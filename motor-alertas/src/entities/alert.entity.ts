import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AlertSeverity } from '../common/air-quality';

export type AlertStatus = 'active' | 'resolved';

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  neighborhoodId: string;

  @Column()
  neighborhoodName: string;

  @Column()
  resourceUuid: string;

  @Column({ type: 'int' })
  aqi: number;

  @Column({ type: 'int' })
  peakAqi: number;

  @Column()
  level: string;

  @Column({ type: 'varchar' })
  severity: AlertSeverity;

  @Column()
  message: string;

  @Index()
  @Column({ type: 'varchar', default: 'active' })
  status: AlertStatus;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'simple-array', nullable: true })
  triggeredBy: string[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  triggeredAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
