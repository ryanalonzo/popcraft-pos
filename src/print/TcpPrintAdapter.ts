/**
 * Real-hardware adapter for the Xprinter XP-Q80I (or any ESC/POS thermal
 * printer reachable over raw TCP). Opens a connection, writes the bytes,
 * closes. No retries here — the calling layer (offline queue / sale
 * confirmation flow) is responsible for retry policy.
 */

import TcpSocket from 'react-native-tcp-socket';

import type { PrintAdapter, PrintJob, PrintResult } from './types';

const DEFAULT_HOST = '192.168.1.50';
const DEFAULT_PORT = 9100;
const CONNECT_TIMEOUT_MS = 5000;

export interface TcpPrintAdapterOptions {
  host?: string;
  port?: number;
  /** Override the 5-second default connect/write timeout. */
  timeoutMs?: number;
}

export class TcpPrintAdapter implements PrintAdapter {
  readonly host: string;
  readonly port: number;
  readonly timeoutMs: number;

  constructor(options: TcpPrintAdapterOptions = {}) {
    this.host = options.host ?? DEFAULT_HOST;
    this.port = options.port ?? DEFAULT_PORT;
    this.timeoutMs = options.timeoutMs ?? CONNECT_TIMEOUT_MS;
  }

  print(job: PrintJob): Promise<PrintResult> {
    const start = performance.now();
    return new Promise<PrintResult>((resolve) => {
      let settled = false;
      const settle = (result: PrintResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const client = TcpSocket.createConnection(
        {
          host: this.host,
          port: this.port,
          // The lib's TLS-only `timeout` field; we also enforce our own below.
        },
        () => {
          client.write(job.bytes, undefined, (err) => {
            if (err) {
              settle({
                success: false,
                error: err.message,
                durationMs: performance.now() - start,
              });
              try {
                client.destroy();
              } catch {
                // ignore
              }
              return;
            }
            client.end();
          });
        },
      );

      const timeout = setTimeout(() => {
        settle({
          success: false,
          error: `Connection to ${this.host}:${this.port} timed out`,
          durationMs: performance.now() - start,
        });
        try {
          client.destroy();
        } catch {
          // ignore
        }
      }, this.timeoutMs);

      client.on('error', (err: Error) => {
        clearTimeout(timeout);
        settle({
          success: false,
          error: err.message,
          durationMs: performance.now() - start,
        });
      });

      client.on('close', () => {
        clearTimeout(timeout);
        settle({ success: true, durationMs: performance.now() - start });
      });
    });
  }
}
