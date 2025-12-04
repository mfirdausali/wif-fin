import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Account, AccountType } from '../types/account';
import { Currency, Country } from '../types/document';
import { Building2, Wallet, Plus, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface AccountManagementProps {
  accounts: Account[];
  onAddAccount?: (account: Account) => void;
  onAccountClick?: (account: Account) => void;
}

export function AccountManagement({ accounts, onAddAccount, onAccountClick }: AccountManagementProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'main_bank' as AccountType,
    currency: 'MYR' as Currency,
    country: 'Malaysia' as Country,
    bankName: '',
    accountNumber: '',
    custodian: '',
    initialBalance: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'main_bank',
      currency: 'MYR',
      country: 'Malaysia',
      bankName: '',
      accountNumber: '',
      custodian: '',
      initialBalance: '',
      notes: '',
    });
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.name.trim()) {
      setValidationError('Account name is required');
      return;
    }

    if (formData.type === 'main_bank' && !formData.bankName.trim()) {
      setValidationError('Bank name is required for bank accounts');
      return;
    }

    if (formData.type === 'petty_cash' && !formData.custodian.trim()) {
      setValidationError('Custodian name is required for petty cash');
      return;
    }

    const initialBalance = parseFloat(formData.initialBalance) || 0;

    const account: Account = {
      id: `ACC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: formData.name,
      type: formData.type,
      currency: formData.currency,
      country: formData.country,
      bankName: formData.type === 'main_bank' ? formData.bankName : undefined,
      accountNumber: formData.type === 'main_bank' ? formData.accountNumber : undefined,
      custodian: formData.type === 'petty_cash' ? formData.custodian : undefined,
      initialBalance: initialBalance,
      currentBalance: initialBalance,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: formData.notes || undefined,
    };

    if (onAddAccount) {
      onAddAccount(account);
    }
    setIsOpen(false);
    resetForm();
  };

  const formatCurrency = (amount: number, currency: Currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const mainBankAccounts = accounts.filter(acc => acc.type === 'main_bank' && acc.isActive);
  const pettyCashAccounts = accounts.filter(acc => acc.type === 'petty_cash' && acc.isActive);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2>Accounts</h2>
          <p className="text-sm text-gray-600">Main bank and petty cash accounts</p>
        </div>
        {onAddAccount && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader className="border-b pb-4">
              <DialogTitle>Add New Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {validationError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Account Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value as AccountType })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main_bank">Main Bank Account</SelectItem>
                      <SelectItem value="petty_cash">Petty Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Select
                    value={formData.country}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      country: value as Country,
                      currency: value === 'Malaysia' ? 'MYR' : 'JPY'
                    })}
                  >
                    <SelectTrigger id="country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Malaysia">🇲🇾 Malaysia</SelectItem>
                      <SelectItem value="Japan">🇯🇵 Japan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Account Name *</Label>
                <Input
                  id="name"
                  placeholder={formData.type === 'main_bank' ? 'e.g., Maybank - WIF JAPAN SDN BHD' : 'e.g., Office Petty Cash'}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {formData.type === 'main_bank' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bankName">Bank Name *</Label>
                      <Input
                        id="bankName"
                        placeholder="e.g., Maybank"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">Account Number</Label>
                      <Input
                        id="accountNumber"
                        placeholder="e.g., 1234567890"
                        value={formData.accountNumber}
                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="custodian">Custodian (Person Holding Cash) *</Label>
                  <Input
                    id="custodian"
                    placeholder="e.g., John Doe"
                    value={formData.custodian}
                    onChange={(e) => setFormData({ ...formData, custodian: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="initialBalance">Initial Balance</Label>
                  <Input
                    id="initialBalance"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.initialBalance}
                    onChange={(e) => setFormData({ ...formData, initialBalance: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency *</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value as Currency })}
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MYR">MYR (Malaysian Ringgit)</SelectItem>
                      <SelectItem value="JPY">JPY (Japanese Yen)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Add Account</Button>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Main Bank Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Main Bank Accounts
            </CardTitle>
            <CardDescription>{mainBankAccounts.length} active</CardDescription>
          </CardHeader>
          <CardContent>
            {mainBankAccounts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No bank accounts added</p>
            ) : (
              <div className="space-y-3">
                {mainBankAccounts.map((account) => (
                  <div
                    key={account.id}
                    className={`p-3 border rounded-lg ${onAccountClick ? 'cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-colors' : ''}`}
                    onClick={() => onAccountClick?.(account)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{account.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {account.country === 'Malaysia' ? '🇲🇾' : '🇯🇵'}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {account.bankName} {account.accountNumber && `• ${account.accountNumber}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(account.currentBalance, account.currency)}
                        </div>
                        {onAccountClick && (
                          <div className="text-xs text-blue-600 mt-1">View details →</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Petty Cash Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Petty Cash Accounts
            </CardTitle>
            <CardDescription>{pettyCashAccounts.length} active</CardDescription>
          </CardHeader>
          <CardContent>
            {pettyCashAccounts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No petty cash accounts added</p>
            ) : (
              <div className="space-y-3">
                {pettyCashAccounts.map((account) => (
                  <div
                    key={account.id}
                    className={`p-3 border rounded-lg ${onAccountClick ? 'cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-colors' : ''}`}
                    onClick={() => onAccountClick?.(account)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{account.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {account.country === 'Malaysia' ? '🇲🇾' : '🇯🇵'}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Held by: {account.custodian}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(account.currentBalance, account.currency)}
                        </div>
                        {onAccountClick && (
                          <div className="text-xs text-blue-600 mt-1">View details →</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
