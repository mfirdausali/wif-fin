import { DocumentType } from '../types/document';

interface DocumentCounter {
  date: string; // YYYYMMDD format
  counters: {
    invoice: number;
    receipt: number;
    payment_voucher: number;
    statement_of_payment: number;
  };
}

const COUNTER_STORAGE_KEY = 'wif_document_counters';

export class DocumentNumberService {
  /**
   * Get the document type prefix
   */
  private static getPrefix(type: DocumentType): string {
    const prefixes = {
      invoice: 'INV',
      receipt: 'RCP',
      payment_voucher: 'PV',
      statement_of_payment: 'SOP',
    };
    return prefixes[type];
  }

  /**
   * Get today's date in YYYYMMDD format
   */
  private static getTodayString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * Get or create today's counter object
   */
  private static getTodayCounter(): DocumentCounter {
    const today = this.getTodayString();
    const stored = localStorage.getItem(COUNTER_STORAGE_KEY);

    if (stored) {
      const counters: DocumentCounter[] = JSON.parse(stored);
      const todayCounter = counters.find(c => c.date === today);

      if (todayCounter) {
        return todayCounter;
      }
    }

    // Create new counter for today
    return {
      date: today,
      counters: {
        invoice: 0,
        receipt: 0,
        payment_voucher: 0,
        statement_of_payment: 0,
      },
    };
  }

  /**
   * Save counter to localStorage
   */
  private static saveCounter(counter: DocumentCounter): void {
    const stored = localStorage.getItem(COUNTER_STORAGE_KEY);
    let counters: DocumentCounter[] = stored ? JSON.parse(stored) : [];

    // Remove old counter for same date if exists
    counters = counters.filter(c => c.date !== counter.date);

    // Add new counter
    counters.push(counter);

    // Keep only last 90 days of counters to avoid localStorage bloat
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffDate = this.formatDate(ninetyDaysAgo);
    counters = counters.filter(c => c.date >= cutoffDate);

    localStorage.setItem(COUNTER_STORAGE_KEY, JSON.stringify(counters));
  }

  /**
   * Format date to YYYYMMDD
   */
  private static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * Generate next document number for given type
   * Format: WIF-PREFIX-YYYYMMDD-XXX
   * Example: WIF-INV-20251113-001
   */
  public static generateDocumentNumber(type: DocumentType): string {
    const prefix = this.getPrefix(type);
    const today = this.getTodayString();
    const counter = this.getTodayCounter();

    // Increment counter for this type
    counter.counters[type]++;

    // Save updated counter
    this.saveCounter(counter);

    // Format serial number with leading zeros (3 digits)
    const serial = String(counter.counters[type]).padStart(3, '0');

    // Return formatted document number
    return `WIF-${prefix}-${today}-${serial}`;
  }

  /**
   * Get current count for a document type today
   */
  public static getCurrentCount(type: DocumentType): number {
    const counter = this.getTodayCounter();
    return counter.counters[type];
  }

  /**
   * Reset counter for a specific date (admin function)
   */
  public static resetCounterForDate(date: string, type?: DocumentType): void {
    const stored = localStorage.getItem(COUNTER_STORAGE_KEY);
    if (!stored) return;

    let counters: DocumentCounter[] = JSON.parse(stored);
    const dateCounter = counters.find(c => c.date === date);

    if (dateCounter) {
      if (type) {
        // Reset specific type
        dateCounter.counters[type] = 0;
      } else {
        // Reset all types for this date
        dateCounter.counters = {
          invoice: 0,
          receipt: 0,
          payment_voucher: 0,
          statement_of_payment: 0,
        };
      }

      localStorage.setItem(COUNTER_STORAGE_KEY, JSON.stringify(counters));
    }
  }

  /**
   * Get all counters (for debugging/admin)
   */
  public static getAllCounters(): DocumentCounter[] {
    const stored = localStorage.getItem(COUNTER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }
}
