import { Document } from '../types/document';

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';

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
