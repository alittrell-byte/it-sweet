import { EventEmitter } from 'events';
import { LogEntry } from './logEntry.model';

// Simple in-process pub/sub feeding the SSE tail stream (backend/src/modules/logs/logRoutes.ts).
// Works for a single-backend-container deployment, which is what docker-compose.yml runs;
// it would not fan out across multiple backend replicas without a shared bus (e.g. Redis).
export const logEventBus = new EventEmitter();
logEventBus.setMaxListeners(200); // one listener per open tail connection

export function emitLogEntry(entry: LogEntry): void {
  logEventBus.emit('entry', entry);
}
