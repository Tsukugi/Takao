import { Logger } from '../src/utils/Logger';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

describe('Logger', () => {
  let consoleLogSpy: Mock;
  let consoleInfoSpy: Mock;
  let consoleWarnSpy: Mock;
  let consoleErrorSpy: Mock;
  let consoleDebugSpy: Mock;
  let consoleTraceSpy: Mock;

  beforeEach(() => {
    Logger.setConsoleEnabled(true);
    Logger.setOutputHandler(undefined);
    // Mock console methods to capture their calls
    consoleLogSpy = vi
      .spyOn(console, 'log')
      .mockImplementation(() => {}) as Mock;
    consoleInfoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => {}) as Mock;
    consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {}) as Mock;
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {}) as Mock;
    consoleDebugSpy = vi
      .spyOn(console, 'debug')
      .mockImplementation(() => {}) as Mock;
    consoleTraceSpy = vi
      .spyOn(console, 'trace')
      .mockImplementation(() => {}) as Mock;
  });

  afterEach(() => {
    // Restore console methods after each test
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a logger with default properties', () => {
      const logger: any = new Logger();
      expect(logger).toBeInstanceOf(Logger);
      expect(logger.props.prefix).toBe('');
      expect(logger.props.disable).toBe(false);
    });

    it('should create a logger with custom prefix', () => {
      const logger: any = new Logger({ prefix: 'TestPrefix' });
      expect(logger.props.prefix).toBe('TestPrefix');
      expect(logger.prefix).toBe('[TestPrefix] ');
    });

    it('should create a logger with disabled logging', () => {
      const logger: any = new Logger({ disable: true });
      expect(logger.props.disable).toBe(true);
    });

    it('should create a logger with both prefix and disable options', () => {
      const logger: any = new Logger({ prefix: 'Game', disable: true });
      expect(logger.props.prefix).toBe('Game');
      expect(logger.props.disable).toBe(true);
      expect(logger.prefix).toBe('[Game] ');
    });
  });

  describe('log methods', () => {
    it('should call console.log with prefix when logging', () => {
      const logger = new Logger({ prefix: 'Test' });
      logger.log('Hello', 'World');

      expect(consoleLogSpy).toHaveBeenCalledWith('[Test] ', 'Hello', 'World');
    });

    it('should call console.info with prefix when logging info', () => {
      const logger = new Logger({ prefix: 'Test' });
      logger.info('Info message');

      expect(consoleInfoSpy).toHaveBeenCalledWith('[Test] ', 'Info message');
    });

    it('should call console.warn with prefix when logging warning', () => {
      const logger = new Logger({ prefix: 'Test' });
      logger.warn('Warning message');

      expect(consoleWarnSpy).toHaveBeenCalledWith('[Test] ', 'Warning message');
    });

    it('should call console.error with prefix when logging error', () => {
      const logger = new Logger({ prefix: 'Test' });
      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Test] ', 'Error message');
    });

    it('should call console.debug with prefix when logging debug', () => {
      const logger = new Logger({ prefix: 'Test' });
      logger.debug('Debug message');

      expect(consoleDebugSpy).toHaveBeenCalledWith('[Test] ', 'Debug message');
    });

    it('should call console.trace with prefix when logging trace', () => {
      const logger = new Logger({ prefix: 'Test' });
      logger.trace('Trace message');

      expect(consoleTraceSpy).toHaveBeenCalledWith('[Test] ', 'Trace message');
    });

    it('should not call console methods when logging is disabled', () => {
      const logger = new Logger({ prefix: 'Test', disable: true });
      logger.log('This should not be logged');
      logger.info('This should not be logged');
      logger.warn('This should not be logged');
      logger.error('This should not be logged');
      logger.debug('This should not be logged');
      logger.trace('This should not be logged');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleTraceSpy).not.toHaveBeenCalled();
    });
  });

  describe('setProps', () => {
    it('should update prefix property', () => {
      const logger: any = new Logger({ prefix: 'OldPrefix' });
      expect(logger.props.prefix).toBe('OldPrefix');
      expect(logger.prefix).toBe('[OldPrefix] ');

      logger.setProps({ prefix: 'NewPrefix' });
      expect(logger.props.prefix).toBe('NewPrefix');
      expect(logger.prefix).toBe('[NewPrefix] ');
    });

    it('should update disable property', () => {
      const logger: any = new Logger({ disable: false });
      expect(logger.props.disable).toBe(false);

      logger.setProps({ disable: true });
      expect(logger.props.disable).toBe(true);

      // Verify logging is now disabled
      logger.log('This should not be logged');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should update both prefix and disable properties', () => {
      const logger: any = new Logger({ prefix: 'OldPrefix', disable: false });

      logger.setProps({ prefix: 'NewPrefix', disable: true });
      expect(logger.props.prefix).toBe('NewPrefix');
      expect(logger.props.disable).toBe(true);
      expect(logger.prefix).toBe('[NewPrefix] ');

      // Verify logging is now disabled with new prefix
      logger.log('This should not be logged');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should preserve original properties not being updated', () => {
      const logger: any = new Logger({ prefix: 'TestPrefix', disable: false });

      logger.setProps({ disable: true }); // Only update disable
      expect(logger.props.prefix).toBe('TestPrefix'); // Should remain unchanged
      expect(logger.props.disable).toBe(true); // Should be updated

      logger.setProps({ prefix: 'UpdatedPrefix' }); // Now update prefix
      expect(logger.props.prefix).toBe('UpdatedPrefix'); // Should now be updated
      expect(logger.props.disable).toBe(true); // Should remain true
    });
  });
});
