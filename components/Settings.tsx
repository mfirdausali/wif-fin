import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { ArrowLeft, Save, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { UserManagement } from './auth/UserManagement';
import { ActivityLog } from './auth/ActivityLog';
import { isAdmin } from '../utils/permissions';
import { getUserStats } from '../services/userService';
import { getActivityLogs, downloadActivityLogs } from '../services/activityLogService';

const COMPANY_INFO_STORAGE_KEY = 'wif_company_info';

export interface CompanyInfo {
  name: string;
  address: string;
  tel: string;
  email: string;
  registrationNo: string;
  registeredOffice: string;
}

const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: 'WIF JAPAN SDN BHD',
  address: 'Malaysia Office\nKuala Lumpur, Malaysia',
  tel: '+60-XXX-XXXXXXX',
  email: 'info@wifjapan.com',
  registrationNo: '(1594364-K)',
  registeredOffice: 'NO.6, LORONG KIRI 10, KAMPUNG DATUK KERAMAT, KUALA LUMPUR, 54000, Malaysia'
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
    deactivateExistingUser
  } = useAuth();
  const userIsAdmin = user && isAdmin(user);
  const [formData, setFormData] = useState<CompanyInfo>(DEFAULT_COMPANY_INFO);

  useEffect(() => {
    // Load company info from localStorage
    const stored = localStorage.getItem(COMPANY_INFO_STORAGE_KEY);
    if (stored) {
      try {
        const loadedData = JSON.parse(stored);
        // Merge with defaults to ensure new fields exist
        setFormData({
          ...DEFAULT_COMPANY_INFO,
          ...loadedData
        });
      } catch (error) {
        console.error('Failed to load company info:', error);
      }
    }
  }, []);

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem(COMPANY_INFO_STORAGE_KEY, JSON.stringify(formData));

    toast.success('Company information saved', {
      description: 'Settings will be applied to all new PDFs',
    });
  };

  const handleReset = () => {
    setFormData(DEFAULT_COMPANY_INFO);
    localStorage.removeItem(COMPANY_INFO_STORAGE_KEY);

    toast.info('Reset to default company information');
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
              <Button onClick={handleSave} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </Button>
              <Button variant="outline" onClick={handleReset}>
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
              userStats={getUserStats()}
              onCreateUser={createNewUser}
              onUpdateUser={updateExistingUser}
              onDeleteUser={deleteExistingUser}
              onActivateUser={activateExistingUser}
              onDeactivateUser={deactivateExistingUser}
            />
          </TabsContent>
        )}

        {userIsAdmin && user && (
          <TabsContent value="logs">
            <ActivityLog
              activities={getActivityLogs()}
              users={users}
              onExport={(format) => downloadActivityLogs(format)}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// Export function to get company info for PDF generation
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

// Export function to save company info
export function saveCompanyInfo(companyInfo: CompanyInfo): void {
  localStorage.setItem(COMPANY_INFO_STORAGE_KEY, JSON.stringify(companyInfo));
}
