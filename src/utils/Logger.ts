/**
 * Logger class that wraps console methods with a prefix
 */

export interface LoggerProps {
  prefix: string;
  disable: boolean;
}

export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  prefix?: string;
}

export type LogOutputHandler = (entry: LogEntry) => void;

export class Logger {
  private static outputHandler: LogOutputHandler | undefined;
  private static consoleEnabled = true;
  private prefix: string;
  private props: LoggerProps;

  constructor(props: Partial<LoggerProps> = {}) {
    this.props = { prefix: '', disable: false, ...props };
    this.prefix = props.prefix ? `[${props.prefix}] ` : '';
  }

  static setOutputHandler(handler: LogOutputHandler | undefined): void {
    this.outputHandler = handler;
  }

  static setConsoleEnabled(enabled: boolean): void {
    this.consoleEnabled = enabled;
  }

  log(...data: unknown[]): void {
    this.emit('log', data);
  }

  info(...data: unknown[]): void {
    this.emit('info', data);
  }

  warn(...data: unknown[]): void {
    this.emit('warn', data);
  }

  error(...data: unknown[]): void {
    this.emit('error', data);
  }

  debug(...data: unknown[]): void {
    this.emit('debug', data);
  }

  trace(...data: unknown[]): void {
    this.emit('trace', data);
  }

  setProps(newProps: Partial<LoggerProps>): void {
    this.props = { ...this.props, ...newProps };
    this.prefix = this.props.prefix ? `[${this.props.prefix}] ` : '';
  }

  private emit(level: LogLevel, data: unknown[]): void {
    if (this.props.disable) return;

    const prefix = this.prefix.trim();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: this.formatMessage(data),
      ...(prefix ? { prefix } : {}),
    };

    Logger.outputHandler?.(entry);

    if (!Logger.consoleEnabled) {
      return;
    }

    switch (level) {
      case 'log':
        console.log(this.prefix, ...data);
        break;
      case 'info':
        console.info(this.prefix, ...data);
        break;
      case 'warn':
        console.warn(this.prefix, ...data);
        break;
      case 'error':
        console.error(this.prefix, ...data);
        break;
      case 'debug':
        console.debug(this.prefix, ...data);
        break;
      case 'trace':
        console.trace(this.prefix, ...data);
        break;
    }
  }

  private formatMessage(data: unknown[]): string {
    return data.map(item => this.formatValue(item)).join(' ');
  }

  private formatValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'symbol') return value.toString();
    if (value instanceof Error) return value.message;
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'function') {
      return value.name ? `[Function ${value.name}]` : '[Function]';
    }

    return Object.prototype.toString.call(value);
  }
}
