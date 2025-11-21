import { Invoice } from '../../types/document';

interface InvoicePdfTemplateProps {
  invoice: Invoice;
  companyInfo?: {
    name: string;
    address: string;
    tel: string;
    email: string;
  };
}

export function InvoicePdfTemplate({ invoice, companyInfo }: InvoicePdfTemplateProps) {
  const defaultCompany = {
    name: 'WIF JAPAN SDN BHD',
    address: 'Malaysia Office\nKuala Lumpur, Malaysia',
    tel: '+60-XXX-XXXXXXX',
    email: 'info@wifjapan.com'
  };

  const company = companyInfo || defaultCompany;
  const subtotal = invoice.items.reduce((sum: number, item) => sum + item.amount, 0);
  const taxAmount = (subtotal * (invoice.taxRate || 0)) / 100;
  const total = subtotal + taxAmount;

  return (
    <div id="pdf-content" style={{
      fontFamily: "'Helvetica', 'Arial', sans-serif",
      lineHeight: '1.4',
      color: '#000000',
      background: 'white',
      padding: '0.75in',
      width: '8.5in',
      minHeight: '11in',
      fontSize: '11pt'
    }}>
      {/* Document Title */}
      <div style={{
        textAlign: 'center',
        fontSize: '18pt',
        fontWeight: 'normal',
        marginBottom: '6pt',
        letterSpacing: '4pt'
      }}>
        INVOICE
      </div>
      <div style={{
        width: '100%',
        height: '2pt',
        background: '#000000',
        marginBottom: '24pt'
      }} />

      {/* Header Section */}
      <div style={{ display: 'flex', marginBottom: '24pt' }}>
        <div style={{ flex: 1, paddingRight: '24pt' }}>
          {/* Company Info */}
          <div style={{ marginBottom: '18pt' }}>
            <div style={{ fontSize: '14pt', marginBottom: '3pt' }}>{company.name}</div>
            <div style={{ fontSize: '10pt', whiteSpace: 'pre-line' }}>
              {company.address}<br/>
              Tel: {company.tel}<br/>
              Email: {company.email}
            </div>
          </div>

          {/* Customer Info */}
          <div>
            <strong>Bill To:</strong><br/>
            <strong>{invoice.customerName}</strong><br/>
            {invoice.customerAddress && (
              <div style={{ whiteSpace: 'pre-line' }}>{invoice.customerAddress}</div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, textAlign: 'right' }}>
          {/* Date Info */}
          <div style={{ marginBottom: '18pt' }}>
            <div style={{ marginBottom: '3pt' }}>Issue Date: {new Date(invoice.createdAt).toLocaleDateString()}</div>
            <div style={{ marginBottom: '3pt' }}>Invoice No.: {invoice.documentNumber}</div>
            <div>Status: <span style={{
              textTransform: 'uppercase',
              fontWeight: 'bold',
              color: invoice.status === 'paid' ? '#059669' : '#d97706'
            }}>{invoice.status}</span></div>
          </div>
        </div>
      </div>

      {/* Amount Section */}
      <div style={{ display: 'flex', marginBottom: '18pt', gap: '0' }}>
        <div style={{
          flex: 1,
          background: '#e8e8e8',
          border: '1pt solid #000000',
          padding: '12pt',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '11pt', marginBottom: '6pt' }}>Invoice Amount</div>
          <div style={{ fontSize: '20pt', fontWeight: 'bold' }}>
            {invoice.currency} {total.toFixed(2)}
          </div>
        </div>
        <div style={{
          flex: 1,
          border: '1pt solid #000000',
          borderLeft: 'none'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{
                  background: '#e8e8e8',
                  padding: '8pt 12pt',
                  borderBottom: '0.5pt solid #000000',
                  fontSize: '10pt',
                  width: '50%'
                }}>Payment Terms</td>
                <td style={{
                  padding: '8pt 12pt',
                  borderBottom: '0.5pt solid #000000',
                  fontSize: '10pt'
                }}>{invoice.paymentTerms || 'Net 30 Days'}</td>
              </tr>
              <tr>
                <td style={{
                  background: '#e8e8e8',
                  padding: '8pt 12pt',
                  fontSize: '10pt'
                }}>Country</td>
                <td style={{
                  padding: '8pt 12pt',
                  fontSize: '10pt'
                }}>{invoice.country}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Items Table */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        border: '1pt solid #000000'
      }}>
        <thead>
          <tr>
            <th style={{
              background: '#e8e8e8',
              padding: '12pt 8pt',
              border: '0.5pt solid #000000',
              fontSize: '11pt',
              fontWeight: 'normal',
              textAlign: 'center',
              width: '50%'
            }}>Description</th>
            <th style={{
              background: '#e8e8e8',
              padding: '12pt 8pt',
              border: '0.5pt solid #000000',
              fontSize: '11pt',
              fontWeight: 'normal',
              textAlign: 'center',
              width: '15%'
            }}>Qty</th>
            <th style={{
              background: '#e8e8e8',
              padding: '12pt 8pt',
              border: '0.5pt solid #000000',
              fontSize: '11pt',
              fontWeight: 'normal',
              textAlign: 'center',
              width: '17.5%'
            }}>Unit Price</th>
            <th style={{
              background: '#e8e8e8',
              padding: '12pt 8pt',
              border: '0.5pt solid #000000',
              fontSize: '11pt',
              fontWeight: 'normal',
              textAlign: 'center',
              width: '17.5%'
            }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item: any, index: number) => (
            <tr key={index}>
              <td style={{
                padding: '8pt',
                border: '0.5pt solid #000000',
                fontSize: '10pt',
                textAlign: 'left'
              }}>{item.description}</td>
              <td style={{
                padding: '8pt',
                border: '0.5pt solid #000000',
                fontSize: '10pt',
                textAlign: 'center'
              }}>{item.quantity}</td>
              <td style={{
                padding: '8pt',
                border: '0.5pt solid #000000',
                fontSize: '10pt',
                textAlign: 'center'
              }}>{invoice.currency} {item.unitPrice.toFixed(2)}</td>
              <td style={{
                padding: '8pt',
                border: '0.5pt solid #000000',
                fontSize: '10pt',
                textAlign: 'center'
              }}>{invoice.currency} {item.amount.toFixed(2)}</td>
            </tr>
          ))}
          {/* Empty rows for spacing */}
          {Array.from({ length: Math.max(0, 5 - invoice.items.length) }).map((_, i) => (
            <tr key={`empty-${i}`}>
              <td style={{ padding: '8pt', border: '0.5pt solid #000000', height: '24pt' }}>&nbsp;</td>
              <td style={{ padding: '8pt', border: '0.5pt solid #000000' }}>&nbsp;</td>
              <td style={{ padding: '8pt', border: '0.5pt solid #000000' }}>&nbsp;</td>
              <td style={{ padding: '8pt', border: '0.5pt solid #000000' }}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals Section */}
      <div style={{
        borderLeft: '1pt solid #000000',
        borderRight: '1pt solid #000000',
        borderBottom: '1pt solid #000000'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{
                background: '#e8e8e8',
                padding: '8pt 12pt',
                borderTop: '0.5pt solid #000000',
                fontSize: '10pt',
                textAlign: 'center',
                width: '15%'
              }}>Subtotal</td>
              <td style={{
                padding: '8pt 12pt',
                borderTop: '0.5pt solid #000000',
                fontSize: '10pt',
                textAlign: 'right'
              }}>{invoice.currency} {subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td style={{
                background: '#e8e8e8',
                padding: '8pt 12pt',
                borderTop: '0.5pt solid #000000',
                fontSize: '10pt',
                textAlign: 'center'
              }}>Tax ({invoice.taxRate || 0}%)</td>
              <td style={{
                padding: '8pt 12pt',
                borderTop: '0.5pt solid #000000',
                fontSize: '10pt',
                textAlign: 'right'
              }}>{invoice.currency} {taxAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td style={{
                background: '#e8e8e8',
                padding: '8pt 12pt',
                borderTop: '0.5pt solid #000000',
                fontSize: '11pt',
                fontWeight: 'bold',
                textAlign: 'center'
              }}>Total Amount</td>
              <td style={{
                background: '#e8e8e8',
                padding: '8pt 12pt',
                borderTop: '0.5pt solid #000000',
                fontSize: '11pt',
                fontWeight: 'bold',
                textAlign: 'right'
              }}>{invoice.currency} {total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notes Section */}
      {invoice.notes && (
        <div style={{
          marginTop: '24pt',
          border: '1pt solid #000000'
        }}>
          <div style={{
            background: '#e8e8e8',
            padding: '8pt 12pt',
            fontSize: '11pt',
            borderBottom: '0.5pt solid #000000'
          }}>Notes</div>
          <div style={{
            padding: '12pt',
            minHeight: '48pt',
            fontSize: '10pt',
            lineHeight: '1.4',
            whiteSpace: 'pre-line'
          }}>
            {invoice.notes}
          </div>
        </div>
      )}
    </div>
  );
}
