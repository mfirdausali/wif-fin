import { Document } from '../types/document';
import { Booking } from '../types/booking';

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';

const defaultCompanyInfo: CompanyInfo = {
  name: 'WIF JAPAN SDN BHD',
  address: 'Malaysia Office\nKuala Lumpur, Malaysia',
  tel: '+60-XXX-XXXXXXX',
  email: 'info@wifjapan.com',
  registrationNo: '(1594364-K)',
  registeredOffice: 'NO.6, LORONG KIRI 10, KAMPUNG DATUK KERAMAT, KUALA LUMPUR, 54000, Malaysia',
};

/**
 * Get current user name from auth session
 */
function getCurrentUserName(): string {
  try {
    const sessionData = localStorage.getItem('wif_auth_session');
    if (sessionData) {
      const session = JSON.parse(sessionData);
      return session.user?.fullName || session.user?.username || 'System';
    }
  } catch (error) {
    console.error('Error getting current user name:', error);
  }
  return 'System';
}

export interface CompanyInfo {
  name: string;
  address: string;
  tel: string;
  email: string;
  registrationNo: string;
  registeredOffice: string;
}

export interface PrinterInfo {
  userName: string;
  printDate: string; // ISO timestamp
}

export interface BookingCardOptions {
  categories: string[];
  includePrices: boolean;
  outputFormat: 'combined' | 'separate';
}

export interface BookingFormPrintOptions {
  pricingDisplay: 'none' | 'internal' | 'b2b' | 'both';
  includeNotes: boolean;
  includeEmptyCategories: boolean;
  showProfitMargin: boolean;
  showExchangeRate: boolean;
}

export class PdfService {
  /**
   * Downloads a PDF for any document type
   */
  static async downloadPDF(
    documentData: Document,
    companyInfo?: CompanyInfo,
    printerInfo?: PrinterInfo
  ): Promise<void> {
    const endpoint = this.getEndpointForDocumentType(documentData.documentType);
    const dataKey = this.getDataKeyForDocumentType(documentData.documentType);

    try {
      const response = await fetch(`${PDF_SERVICE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [dataKey]: documentData,
          companyInfo,
          printerInfo,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documentData.documentType}-${documentData.documentNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    }
  }

  /**
   * Get API endpoint for document type
   */
  private static getEndpointForDocumentType(documentType: string): string {
    switch (documentType) {
      case 'invoice':
        return '/api/pdf/invoice';
      case 'receipt':
        return '/api/pdf/receipt';
      case 'payment_voucher':
        return '/api/pdf/payment-voucher';
      case 'statement_of_payment':
        return '/api/pdf/statement-of-payment';
      default:
        throw new Error(`Unknown document type: ${documentType}`);
    }
  }

  /**
   * Get data key for request body
   */
  private static getDataKeyForDocumentType(documentType: string): string {
    switch (documentType) {
      case 'invoice':
        return 'invoice';
      case 'receipt':
        return 'receipt';
      case 'payment_voucher':
        return 'paymentVoucher';
      case 'statement_of_payment':
        return 'statementOfPayment';
      default:
        throw new Error(`Unknown document type: ${documentType}`);
    }
  }

  /**
   * Downloads booking card PDFs
   */
  static async downloadBookingCard(
    booking: Booking,
    options: BookingCardOptions,
    companyInfo?: CompanyInfo,
    printerInfo?: PrinterInfo
  ): Promise<void> {
    try {
      const response = await fetch(`${PDF_SERVICE_URL}/api/pdf/booking-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          booking,
          categories: options.categories,
          includePrices: options.includePrices,
          outputFormat: options.outputFormat,
          companyInfo,
          printerInfo,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type');

      if (contentType?.includes('application/pdf')) {
        // Single combined PDF
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `booking-card-${booking.bookingCode}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else if (contentType?.includes('application/json')) {
        // Multiple separate PDFs
        const data = await response.json();

        if (data.pdfs && Array.isArray(data.pdfs)) {
          // Download each PDF
          for (const pdf of data.pdfs) {
            const byteCharacters = atob(pdf.data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = pdf.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Small delay between downloads to prevent browser issues
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }
    } catch (error) {
      console.error('Booking card PDF generation error:', error);
      throw error;
    }
  }

  /**
   * Downloads booking form PDF
   */
  static async downloadBookingForm(
    booking: Booking,
    options: BookingFormPrintOptions,
    companyInfo?: CompanyInfo
  ): Promise<void> {
    try {
      const response = await fetch(`${PDF_SERVICE_URL}/api/pdf/booking-form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          booking: booking,
          options: {
            pricingDisplay: options.pricingDisplay,
            includeNotes: options.includeNotes,
            includeEmptyCategories: options.includeEmptyCategories,
            showProfitMargin: options.showProfitMargin,
            showExchangeRate: options.showExchangeRate,
            paperSize: 'a4',
            orientation: 'portrait',
          },
          companyInfo: companyInfo || defaultCompanyInfo,
          printerInfo: {
            userName: getCurrentUserName(),
            printDate: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `booking-form-${booking.bookingCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Booking form PDF generation error:', error);
      throw error;
    }
  }

  /**
   * Check if PDF service is available
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${PDF_SERVICE_URL}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
