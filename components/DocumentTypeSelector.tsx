import { Card, CardContent } from './ui/card';
import { FileText, Receipt, FileCheck, CheckCircle2 } from 'lucide-react';
import { DocumentType } from '../types/document';
import { PublicUser } from '../types/auth';
import { getAccessibleDocumentTypes } from '../utils/permissions';

interface DocumentTypeSelectorProps {
  selectedType: DocumentType | null;
  onSelectType: (type: DocumentType) => void;
  user?: PublicUser | null;
}

export function DocumentTypeSelector({ selectedType, onSelectType, user }: DocumentTypeSelectorProps) {
  const allDocumentTypes = [
    {
      type: 'invoice' as DocumentType,
      icon: FileText,
      title: 'Invoice',
      description: 'Bill sent to customer for goods/services',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    {
      type: 'receipt' as DocumentType,
      icon: Receipt,
      title: 'Receipt',
      description: 'Proof of payment received from customer',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      type: 'payment_voucher' as DocumentType,
      icon: FileCheck,
      title: 'Payment Voucher',
      description: 'Authorization to make payment to payee',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
    },
    {
      type: 'statement_of_payment' as DocumentType,
      icon: CheckCircle2,
      title: 'Statement of Payment',
      description: 'Proof that payment has been made & received',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
    },
  ];

  // Filter document types based on user role
  const accessibleTypes = user ? getAccessibleDocumentTypes(user) : ['invoice', 'receipt', 'payment_voucher', 'statement_of_payment'];
  const documentTypes = allDocumentTypes.filter(dt => accessibleTypes.includes(dt.type));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {documentTypes.map(({ type, icon: Icon, title, description, color, bgColor, borderColor }) => (
        <Card
          key={type}
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedType === type ? `ring-2 ring-offset-2 ${borderColor}` : ''
          }`}
          onClick={() => onSelectType(type)}
        >
          <CardContent className="p-6">
            <div className={`w-12 h-12 rounded-lg ${bgColor} flex items-center justify-center mb-4`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <h3 className="mb-2">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
