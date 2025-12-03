import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { Switch } from './ui/switch';
import { ArrowLeft, Save, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { UserManagement } from './auth/UserManagement';
import { ActivityLog } from './auth/ActivityLog';
import { isAdmin } from '../utils/permissions';
// import { getUserStats } from '../services/userService';
import { getActivityLogsAsync, downloadActivityLogs, logSystemEvent } from '../services/activityLogService';
import { ActivityLog as ActivityLogType } from '../types/auth';
import * as SupabaseService from '../services/supabaseService';

const COMPANY_INFO_STORAGE_KEY = 'wif_company_info';
const DEFAULT_COMPANY_ID = 'c0000000-0000-0000-0000-000000000001';

export interface CompanyInfo {
  name: string;
  address: string;
  tel: string;
  email: string;
  registrationNo: string;
  registeredOffice: string;
  allowNegativeBalance: boolean;
}

const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: 'WIF JAPAN SDN BHD',
  address: 'Malaysia Office\nKuala Lumpur, Malaysia',
  tel: '+60-XXX-XXXXXXX',
  email: 'info@wifjapan.com',
  registrationNo: '(1594364-K)',
  registeredOffice: 'NO.6, LORONG KIRI 10, KAMPUNG DATUK KERAMAT, KUALA LUMPUR, 54000, Malaysia',
  allowNegativeBalance: false
};

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  const {
    user,
    users,
    createNewUser,
    updateExistingUser,
    deleteExistingUser,
    activateExistingUser,
    deactivateExistingUser,
    changeUserPassword,
  } = useAuth();
  const userIsAdmin = user && isAdmin(user);
  const [formData, setFormData] = useState<CompanyInfo>(DEFAULT_COMPANY_INFO);
  const [_isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLogType[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [originalFormData, setOriginalFormData] = useState<CompanyInfo>(DEFAULT_COMPANY_INFO);

  // Calculate user stats from users array
  const userStats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.isActive).length;
    const inactive = users.filter(u => !u.isActive).length;
    const locked = users.filter(u => 'isLocked' in u && u.isLocked).length;
    const byRole = {
      admin: users.filter(u => u.role === 'admin').length,
      manager: users.filter(u => u.role === 'manager').length,
      accountant: users.filter(u => u.role === 'accountant').length,
      viewer: users.filter(u => u.role === 'viewer').length,
    };
    return { total, active, inactive, locked, byRole };
  }, [users]);

  useEffect(() => {
    // Load company info from Supabase
    async function loadCompanyInfo() {
      try {
        const company = await SupabaseService.getOrCreateDefaultCompany();
        const loadedInfo: CompanyInfo = {
          name: company.name || DEFAULT_COMPANY_INFO.name,
          address: company.address || DEFAULT_COMPANY_INFO.address,
          tel: company.tel || DEFAULT_COMPANY_INFO.tel,
          email: company.email || DEFAULT_COMPANY_INFO.email,
          registrationNo: company.registration_no || DEFAULT_COMPANY_INFO.registrationNo,
          registeredOffice: company.registered_office || DEFAULT_COMPANY_INFO.registeredOffice,
          allowNegativeBalance: company.allow_negative_balance || DEFAULT_COMPANY_INFO.allowNegativeBalance,
        };
        setFormData(loadedInfo);
        setOriginalFormData(loadedInfo);
        // Also sync to localStorage for offline access
        localStorage.setItem(COMPANY_INFO_STORAGE_KEY, JSON.stringify({
          name: company.name,
          address: company.address,
          tel: company.tel,
          email: company.email,
          registrationNo: company.registration_no,
          registeredOffice: company.registered_office,
          allowNegativeBalance: company.allow_negative_balance,
        }));
      } catch (error) {
        console.error('Failed to load company info from Supabase:', error);
        // Fall back to localStorage
        const stored = localStorage.getItem(COMPANY_INFO_STORAGE_KEY);
        if (stored) {
          try {
            const loadedData = JSON.parse(stored);
            const loadedInfo = { ...DEFAULT_COMPANY_INFO, ...loadedData };
            setFormData(loadedInfo);
            setOriginalFormData(loadedInfo);
          } catch (e) {
            console.error('Failed to parse localStorage:', e);
          }
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadCompanyInfo();
  }, []);

  // Load activity logs from Google Sheets
  useEffect(() => {
    async function loadActivityLogs() {
      if (!userIsAdmin) return;
      setIsLoadingLogs(true);
      try {
        const logs = await getActivityLogsAsync();
        setActivityLogs(logs);
      } catch (error) {
        console.error('Failed to load activity logs:', error);
      } finally {
        setIsLoadingLogs(false);
      }
    }
    loadActivityLogs();
  }, [userIsAdmin]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to Supabase
      await SupabaseService.updateCompanyInfo(DEFAULT_COMPANY_ID, formData);
      // Also save to localStorage for offline access
      localStorage.setItem(COMPANY_INFO_STORAGE_KEY, JSON.stringify(formData));

      // Log settings change if user is logged in
      if (user) {
        // Calculate what changed
        const changes: Record<string, { from: string | boolean; to: string | boolean }> = {};
        const fieldLabels: Record<keyof CompanyInfo, string> = {
          name: 'Company Name',
          address: 'Address',
          tel: 'Telephone',
          email: 'Email',
          registrationNo: 'Registration No',
          registeredOffice: 'Registered Office',
          allowNegativeBalance: 'Allow Negative Balance',
        };

        (Object.keys(formData) as Array<keyof CompanyInfo>).forEach((key) => {
          if (formData[key] !== originalFormData[key]) {
            changes[fieldLabels[key]] = {
              from: originalFormData[key],
              to: formData[key],
            };
          }
        });

        const changedFieldNames = Object.keys(changes);
        const description = changedFieldNames.length > 0
          ? `${user.fullName} updated company settings: ${changedFieldNames.join(', ')}`
          : `${user.fullName} saved company settings (no changes)`;

        logSystemEvent(
          'system:settings_changed',
          user,
          description,
          {
            settingsType: 'company',
            changes,
            newValues: formData,
          }
        );

        // Update original form data to reflect saved state
        setOriginalFormData({ ...formData });
      }

      toast.success('Company information saved', {
        description: 'Settings will be applied to all new PDFs',
      });
    } catch (error) {
      console.error('Failed to save company info:', error);
      toast.error('Failed to save company information', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFormData(DEFAULT_COMPANY_INFO);
    localStorage.removeItem(COMPANY_INFO_STORAGE_KEY);

    toast.info('Reset to default company information');
  };

  // Handle activity log export with logging
  const handleExportActivityLogs = async (format: 'json' | 'csv') => {
    if (user) {
      // Log the export event
      logSystemEvent(
        'system:data_exported',
        user,
        `${user.fullName} exported activity logs as ${format.toUpperCase()}`,
        {
          exportFormat: format,
          recordCount: activityLogs.length,
          exportedAt: new Date().toISOString(),
        }
      );
    }
    // Perform the actual export
    await downloadActivityLogs(format);
  };

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className={userIsAdmin ? "grid w-full grid-cols-3" : "grid w-full grid-cols-1"}>
          <TabsTrigger value="company">Company Info</TabsTrigger>
          {userIsAdmin && <TabsTrigger value="users">User Management</TabsTrigger>}
          {userIsAdmin && <TabsTrigger value="logs">Activity Logs</TabsTrigger>}
        </TabsList>

        <TabsContent value="company">
          <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <p className="text-sm text-gray-600">
            This information will appear on all generated PDF documents
          </p>
          {!userIsAdmin && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Read-Only Access</AlertTitle>
              <AlertDescription>
                Only administrators can modify company information. Contact an administrator if changes are needed.
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="WIF JAPAN SDN BHD"
              disabled={!userIsAdmin}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              rows={3}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Malaysia Office&#10;Kuala Lumpur, Malaysia"
              disabled={!userIsAdmin}
            />
            <p className="text-xs text-gray-500">
              Use multiple lines for a cleaner appearance on PDFs
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tel">Telephone</Label>
            <Input
              id="tel"
              value={formData.tel}
              onChange={(e) => setFormData({ ...formData, tel: e.target.value })}
              placeholder="+60-XXX-XXXXXXX"
              disabled={!userIsAdmin}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="info@wifjapan.com"
              disabled={!userIsAdmin}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="registrationNo">Company Registration No</Label>
            <Input
              id="registrationNo"
              value={formData.registrationNo}
              onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
              placeholder="(1594364-K)"
              disabled={!userIsAdmin}
            />
            <p className="text-xs text-gray-500">
              This will appear in the PDF footer
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="registeredOffice">Registered Office</Label>
            <Textarea
              id="registeredOffice"
              rows={2}
              value={formData.registeredOffice}
              onChange={(e) => setFormData({ ...formData, registeredOffice: e.target.value })}
              placeholder="NO.6, LORONG KIRI 10, KAMPUNG DATUK KERAMAT, KUALA LUMPUR, 54000, Malaysia"
              disabled={!userIsAdmin}
            />
            <p className="text-xs text-gray-500">
              This will appear in the PDF footer
            </p>
          </div>

          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold mb-4">Account Settings</h3>

            <div className="flex items-start justify-between space-x-4">
              <div className="flex-1">
                <Label htmlFor="allowNegativeBalance" className="text-base font-medium">
                  Allow Negative Balances (Overdraft)
                </Label>
                <p className="text-sm text-gray-500 mt-1">
                  When enabled, accounts can have negative balances. Payments will be allowed even if they exceed the current account balance.
                </p>
                <p className="text-xs text-amber-600 mt-2">
                  <Info className="w-3 h-3 inline mr-1" />
                  Warning: Enabling this removes balance validation for Statement of Payment documents.
                </p>
              </div>
              <Switch
                id="allowNegativeBalance"
                checked={formData.allowNegativeBalance}
                onCheckedChange={(checked) => setFormData({ ...formData, allowNegativeBalance: checked })}
                disabled={!userIsAdmin}
              />
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold mb-3">Preview</h3>
            <div className="p-4 bg-gray-50 rounded border text-sm">
              <div className="font-bold mb-1">{formData.name || 'Company Name'}</div>
              <div className="whitespace-pre-line text-gray-700">
                {formData.address || 'Address not set'}
              </div>
              <div className="text-gray-700 mt-2">
                Tel: {formData.tel || 'Not set'}
              </div>
              <div className="text-gray-700">
                Email: {formData.email || 'Not set'}
              </div>
            </div>
          </div>

          {userIsAdmin && (
            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button variant="outline" onClick={handleReset} disabled={isSaving}>
                Reset to Default
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {userIsAdmin && user && (
          <TabsContent value="users">
            <UserManagement
              users={users}
              currentUser={user}
              userStats={userStats}
              onCreateUser={createNewUser}
              onUpdateUser={updateExistingUser}
              onDeleteUser={deleteExistingUser}
              onActivateUser={activateExistingUser}
              onDeactivateUser={deactivateExistingUser}
              onChangeUserPassword={changeUserPassword}
            />
          </TabsContent>
        )}

        {userIsAdmin && user && (
          <TabsContent value="logs">
            <ActivityLog
              activities={activityLogs}
              users={users}
              onExport={handleExportActivityLogs}
              isLoading={isLoadingLogs}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// Export function to get company info for PDF generation (sync - uses localStorage cache)
export function getCompanyInfo(): CompanyInfo {
  const stored = localStorage.getItem(COMPANY_INFO_STORAGE_KEY);
  if (stored) {
    try {
      const loadedData = JSON.parse(stored);
      // Merge with defaults to ensure new fields exist
      return {
        ...DEFAULT_COMPANY_INFO,
        ...loadedData
      };
    } catch (error) {
      console.error('Failed to load company info:', error);
    }
  }
  return DEFAULT_COMPANY_INFO;
}

// Export async function to get company info from Supabase
export async function getCompanyInfoAsync(): Promise<CompanyInfo> {
  try {
    const company = await SupabaseService.getOrCreateDefaultCompany();
    const companyInfo: CompanyInfo = {
      name: company.name || DEFAULT_COMPANY_INFO.name,
      address: company.address || DEFAULT_COMPANY_INFO.address,
      tel: company.tel || DEFAULT_COMPANY_INFO.tel,
      email: company.email || DEFAULT_COMPANY_INFO.email,
      registrationNo: company.registration_no || DEFAULT_COMPANY_INFO.registrationNo,
      registeredOffice: company.registered_office || DEFAULT_COMPANY_INFO.registeredOffice,
      allowNegativeBalance: company.allow_negative_balance || DEFAULT_COMPANY_INFO.allowNegativeBalance,
    };
    // Update localStorage cache
    localStorage.setItem(COMPANY_INFO_STORAGE_KEY, JSON.stringify(companyInfo));
    return companyInfo;
  } catch (error) {
    console.error('Failed to load company info from Supabase:', error);
    // Fall back to localStorage
    return getCompanyInfo();
  }
}

// Export function to save company info
export function saveCompanyInfo(companyInfo: CompanyInfo): void {
  localStorage.setItem(COMPANY_INFO_STORAGE_KEY, JSON.stringify(companyInfo));
}
