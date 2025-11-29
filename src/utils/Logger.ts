/**
 * Logger class that wraps console methods with a prefix
 */

export interface LoggerProps {
  prefix: string;
  disable: boolean;
}
export class Logger {
  private prefix: string;
  private props: LoggerProps;

  constructor(props: Partial<LoggerProps> = {}) {
    this.props = { prefix: '', disable: false, ...props };
    this.prefix = props.prefix ? `[${props.prefix}] ` : '';
  }

  log(...data: unknown[]): void {
    if (this.props.disable) return;
    console.log(this.prefix, ...data);
  }

  info(...data: unknown[]): void {
    if (this.props.disable) return;
    console.info(this.prefix, ...data);
  }

  warn(...data: unknown[]): void {
    if (this.props.disable) return;
    console.warn(this.prefix, ...data);
  }

  error(...data: unknown[]): void {
    if (this.props.disable) return;
    console.error(this.prefix, ...data);
  }

  debug(...data: unknown[]): void {
    if (this.props.disable) return;
    console.debug(this.prefix, ...data);
  }

  trace(...data: unknown[]): void {
    if (this.props.disable) return;
    console.trace(this.prefix, ...data);
  }

  setProps(newProps: Partial<LoggerProps>): void {
    this.props = { ...this.props, ...newProps };
    this.prefix = this.props.prefix ? `[${this.props.prefix}] ` : '';
  }
}
