import { Injectable } from "@nestjs/common";
import { Observable, Subject } from "rxjs";
import { Alert } from "../entities/alert.entity";
import { MetricsService } from "../metrics/metrics.service";

export type AlertEventType = "created" | "updated" | "resolved";

export interface AlertEvent {
  type: AlertEventType;
  alert: Alert;
}

@Injectable()
export class AlertsEventsService {
  private readonly stream = new Subject<AlertEvent>();

  constructor(private readonly metrics: MetricsService) {}

  emit(event: AlertEvent): void {
    // Todo evento de alerta passa por aqui — ponto único para contabilizar.
    this.metrics.recordAlertEvent(event.type);
    this.stream.next(event);
  }

  asObservable(): Observable<AlertEvent> {
    return this.stream.asObservable();
  }
}
