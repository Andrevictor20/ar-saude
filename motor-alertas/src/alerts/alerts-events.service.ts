import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { Alert } from '../entities/alert.entity';

export type AlertEventType = 'created' | 'updated' | 'resolved';

export interface AlertEvent {
  type: AlertEventType;
  alert: Alert;
}

@Injectable()
export class AlertsEventsService {
  private readonly stream = new Subject<AlertEvent>();

  emit(event: AlertEvent): void {
    this.stream.next(event);
  }

  asObservable(): Observable<AlertEvent> {
    return this.stream.asObservable();
  }
}
