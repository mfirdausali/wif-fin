import { useState } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Progress } from './ui/progress';
import { CheckCircle2, Building2, Wallet, FileText, Sparkles, ArrowRight, ArrowLeft, Rocket } from 'lucide-react';
import { Account, AccountType } from '../types/account';
import { Currency } from '../types/document';
import { CompanyInfo } from './Settings';

interface OnboardingProps {
  isOpen: boolean;
  onComplete: (companyInfo: CompanyInfo, firstAccount: Account | null) => void;
  onSkip: () => void;
}

type OnboardingStep = 'welcome' | 'company' | 'account' | 'tutorial' | 'complete';

export function Onboarding({ isOpen, onComplete, onSkip }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [companyData, setCompanyData] = useState<CompanyInfo>({
    name: 'WIF JAPAN SDN BHD',
    address: 'Malaysia Office\nKuala Lumpur, Malaysia',
    tel: '+60-XXX-XXXXXXX',
    email: 'info@wifjapan.com',
    registrationNo: '(1594364-K)',
    registeredOffice: 'NO.6, LORONG KIRI 10, KAMPUNG DATUK KERAMAT, KUALA LUMPUR, 54000, Malaysia',
  });

  const [accountData, setAccountData] = useState({
    name: '',
    type: 'main_bank' as AccountType,
    currency: 'MYR' as Currency,
    country: 'Malaysia' as 'Malaysia' | 'Japan',
    bankName: '',
    accountNumber: '',
    custodian: '',
    initialBalance: '',
  });

  const steps: OnboardingStep[] = ['welcome', 'company', 'account', 'tutorial', 'complete'];
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleNext = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleFinish = () => {
    let account: Account | null = null;

    if (accountData.name.trim()) {
      const initialBalance = parseFloat(accountData.initialBalance) || 0;
      account = {
        id: `ACC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: accountData.name,
        type: accountData.type,
        currency: accountData.currency,
        country: accountData.country,
        bankName: accountData.type === 'main_bank' ? accountData.bankName : undefined,
        accountNumber: accountData.type === 'main_bank' ? accountData.accountNumber : undefined,
        custodian: accountData.type === 'petty_cash' ? accountData.custodian : undefined,
        initialBalance: initialBalance,
        currentBalance: initialBalance,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    onComplete(companyData, account);
  };

  const isAccountValid = () => {
    if (!accountData.name.trim()) return false;
    if (accountData.type === 'main_bank' && !accountData.bankName.trim()) return false;
    if (accountData.type === 'petty_cash' && !accountData.custodian.trim()) return false;
    return true;
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" >
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
            <span className="text-sm text-gray-500">{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Welcome Step */}
        {currentStep === 'welcome' && (
          <div className="text-center py-8">
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
            </div>
            <h2 className="text-3xl font-bold mb-4">Welcome to WIF Finance System!</h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              Your all-in-one financial document management solution for Malaysia and Japan operations.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-2xl mx-auto text-left">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <FileText className="w-8 h-8 text-blue-600 mb-2" />
                <h3 className="font-semibold mb-1">Document Management</h3>
                <p className="text-sm text-gray-600">Create invoices, receipts, payment vouchers, and statements</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <Wallet className="w-8 h-8 text-green-600 mb-2" />
                <h3 className="font-semibold mb-1">Account Tracking</h3>
                <p className="text-sm text-gray-600">Monitor balances across MYR and JPY accounts</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <CheckCircle2 className="w-8 h-8 text-purple-600 mb-2" />
                <h3 className="font-semibold mb-1">Automated Workflow</h3>
                <p className="text-sm text-gray-600">Automatic balance updates and transaction tracking</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <Building2 className="w-8 h-8 text-orange-600 mb-2" />
                <h3 className="font-semibold mb-1">PDF Generation</h3>
                <p className="text-sm text-gray-600">Professional documents with your company branding</p>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-8">Let's set up your system in just a few quick steps!</p>

            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={onSkip}>
                Skip Setup
              </Button>
              <Button onClick={handleNext} className="px-8">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Company Step */}
        {currentStep === 'company' && (
          <div className="py-6">
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Company Information</h2>
              <p className="text-gray-600">This information will appear on all your documents and PDFs</p>
            </div>

            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={companyData.name}
                  onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                  placeholder="WIF JAPAN SDN BHD"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tel">Telephone</Label>
                  <Input
                    id="tel"
                    value={companyData.tel}
                    onChange={(e) => setCompanyData({ ...companyData, tel: e.target.value })}
                    placeholder="+60-XXX-XXXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={companyData.email}
                    onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                    placeholder="info@wifjapan.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Office Address</Label>
                <Textarea
                  id="address"
                  rows={3}
                  value={companyData.address}
                  onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                  placeholder="Malaysia Office&#10;Kuala Lumpur, Malaysia"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registrationNo">Registration Number</Label>
                <Input
                  id="registrationNo"
                  value={companyData.registrationNo}
                  onChange={(e) => setCompanyData({ ...companyData, registrationNo: e.target.value })}
                  placeholder="(1594364-K)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registeredOffice">Registered Office</Label>
                <Textarea
                  id="registeredOffice"
                  rows={2}
                  value={companyData.registeredOffice}
                  onChange={(e) => setCompanyData({ ...companyData, registeredOffice: e.target.value })}
                  placeholder="NO.6, LORONG KIRI 10, KAMPUNG DATUK KERAMAT, KUALA LUMPUR, 54000, Malaysia"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-8">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Account Step */}
        {currentStep === 'account' && (
          <div className="py-6">
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Create Your First Account</h2>
              <p className="text-gray-600">Set up a bank account or petty cash to start tracking transactions</p>
            </div>

            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountType">Account Type *</Label>
                  <Select
                    value={accountData.type}
                    onValueChange={(value) => setAccountData({ ...accountData, type: value as AccountType })}
                  >
                    <SelectTrigger id="accountType">
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
                    value={accountData.country}
                    onValueChange={(value) =>
                      setAccountData({
                        ...accountData,
                        country: value as 'Malaysia' | 'Japan',
                        currency: value === 'Malaysia' ? 'MYR' : 'JPY',
                      })
                    }
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
                <Label htmlFor="accountName">Account Name *</Label>
                <Input
                  id="accountName"
                  value={accountData.name}
                  onChange={(e) => setAccountData({ ...accountData, name: e.target.value })}
                  placeholder={
                    accountData.type === 'main_bank'
                      ? 'e.g., Maybank - WIF JAPAN SDN BHD'
                      : 'e.g., Office Petty Cash'
                  }
                />
              </div>

              {accountData.type === 'main_bank' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name *</Label>
                    <Input
                      id="bankName"
                      value={accountData.bankName}
                      onChange={(e) => setAccountData({ ...accountData, bankName: e.target.value })}
                      placeholder="e.g., Maybank"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input
                      id="accountNumber"
                      value={accountData.accountNumber}
                      onChange={(e) => setAccountData({ ...accountData, accountNumber: e.target.value })}
                      placeholder="e.g., 564089558605"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="custodian">Custodian (Person Holding Cash) *</Label>
                  <Input
                    id="custodian"
                    value={accountData.custodian}
                    onChange={(e) => setAccountData({ ...accountData, custodian: e.target.value })}
                    placeholder="e.g., Firdaus Ali"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="initialBalance">Initial Balance ({accountData.currency})</Label>
                <Input
                  id="initialBalance"
                  type="number"
                  step="0.01"
                  value={accountData.initialBalance}
                  onChange={(e) => setAccountData({ ...accountData, initialBalance: e.target.value })}
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500">
                  Enter the current balance in this account (or leave as 0 if starting fresh)
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-8">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleNext} disabled={!isAccountValid()}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Tutorial Step */}
        {currentStep === 'tutorial' && (
          <div className="py-6">
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">How It Works</h2>
              <p className="text-gray-600">Understanding the document workflow</p>
            </div>

            <div className="space-y-6 max-w-2xl mx-auto">
              {/* Income Flow */}
              <div className="p-6 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-sm">
                    1
                  </span>
                  Receiving Money (Income)
                </h3>
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex items-start gap-3">
                    <span className="font-medium min-w-24">Step 1:</span>
                    <span>Create an <strong>Invoice</strong> for your customer</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-medium min-w-24">Step 2:</span>
                    <span>When payment is received, create a <strong>Receipt</strong></span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-medium min-w-24">Result:</span>
                    <span className="text-green-700">✓ Account balance increases automatically</span>
                  </div>
                </div>
              </div>

              {/* Expense Flow */}
              <div className="p-6 bg-red-50 rounded-lg border border-red-200">
                <h3 className="font-semibold text-red-900 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white text-sm">
                    2
                  </span>
                  Paying Money (Expenses)
                </h3>
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex items-start gap-3">
                    <span className="font-medium min-w-24">Step 1:</span>
                    <span>Create a <strong>Payment Voucher</strong> (requires approval)</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-medium min-w-24">Step 2:</span>
                    <span>After payment is made, create <strong>Statement of Payment</strong></span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-medium min-w-24">Result:</span>
                    <span className="text-red-700">✓ Account balance decreases automatically</span>
                  </div>
                </div>
              </div>

              {/* Key Features */}
              <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-4">Key Features</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5" />
                    <span>Automatic balance calculations - no manual entry needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5" />
                    <span>Transaction fees tracking (ATM, wire transfer, etc.)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5" />
                    <span>Professional PDF generation with company branding</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5" />
                    <span>Multi-currency support (MYR & JPY)</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-8">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {currentStep === 'complete' && (
          <div className="text-center py-12">
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                <Rocket className="w-10 h-10 text-white" />
              </div>
            </div>
            <h2 className="text-3xl font-bold mb-4">You're All Set!</h2>
            <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto">
              Your WIF Finance System is ready to use. Start creating documents and managing your finances with ease.
            </p>

            <div className="max-w-md mx-auto mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200 text-left">
              <h3 className="font-semibold mb-3">Setup Summary:</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Company information configured</span>
                </div>
                {accountData.name && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span>
                      {accountData.type === 'main_bank' ? 'Bank account' : 'Petty cash'} created (
                      {accountData.currency})
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Workflow tutorial completed</span>
                </div>
              </div>
            </div>

            <Button onClick={handleFinish} size="lg" className="px-8">
              Start Using System
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
