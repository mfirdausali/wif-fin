/**
 * Activity Log Component
 *
 * Displays comprehensive audit trail:
 * - All system activities
 * - Filterable by type, user, date range
 * - Searchable
 * - Exportable (JSON/CSV)
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Download, FileText, Search, Calendar, User, Activity } from 'lucide-react';
import { ActivityLog as ActivityLogType, ActivityType, PublicUser } from '../../types/auth';

interface ActivityLogProps {
  activities: ActivityLogType[];
  users: PublicUser[];
  onExport: (format: 'json' | 'csv') => void;
}

export function ActivityLog({ activities, users, onExport }: ActivityLogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ActivityType | 'all'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filter activities
  const filteredActivities = activities.filter((activity) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!activity.description.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Type filter
    if (typeFilter !== 'all' && activity.type !== typeFilter) {
      return false;
    }

    // User filter
    if (userFilter !== 'all' && activity.userId !== userFilter) {
      return false;
    }

    // Date range filter
    if (startDate) {
      const activityDate = new Date(activity.timestamp);
      const start = new Date(startDate);
      if (activityDate < start) return false;
    }

    if (endDate) {
      const activityDate = new Date(activity.timestamp);
      const end = new Date(endDate);
      end.setHours(23, 59, 59); // Include the entire end date
      if (activityDate > end) return false;
    }

    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActivityIcon = (type: ActivityType) => {
    if (type.startsWith('auth:')) return '🔐';
    if (type.startsWith('document:')) return '📄';
    if (type.startsWith('account:')) return '💰';
    if (type.startsWith('user:')) return '👤';
    if (type.startsWith('system:')) return '⚙️';
    return '📋';
  };

  const getActivityBadgeColor = (type: ActivityType) => {
    if (type.startsWith('auth:')) return 'bg-purple-100 text-purple-800';
    if (type.startsWith('document:')) return 'bg-blue-100 text-blue-800';
    if (type.startsWith('account:')) return 'bg-green-100 text-green-800';
    if (type.startsWith('user:')) return 'bg-orange-100 text-orange-800';
    if (type.startsWith('system:')) return 'bg-gray-100 text-gray-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Get unique activity types
  const activityTypes = Array.from(new Set(activities.map((a) => a.type))).sort();

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Activities</p>
                <p className="text-2xl font-bold">{filteredActivities.length}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Users Active</p>
                <p className="text-2xl font-bold">
                  {new Set(filteredActivities.map((a) => a.userId)).size}
                </p>
              </div>
              <User className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today</p>
                <p className="text-2xl font-bold">
                  {
                    filteredActivities.filter((a) => {
                      const activityDate = new Date(a.timestamp).toDateString();
                      const today = new Date().toDateString();
                      return activityDate === today;
                    }).length
                  }
                </p>
              </div>
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Export</p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => onExport('json')}>
                    JSON
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onExport('csv')}>
                    CSV
                  </Button>
                </div>
              </div>
              <Download className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Complete audit trail of all system activities</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type-filter">Type</Label>
              <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
                <SelectTrigger id="type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {activityTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-filter">User</Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger id="user-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Activity List */}
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {filteredActivities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-gray-500">No activities found</p>
                </div>
              ) : (
                filteredActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-2xl">{getActivityIcon(activity.type)}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={getActivityBadgeColor(activity.type)}>
                              {activity.type}
                            </Badge>
                            <span className="text-sm text-gray-600">by {activity.username}</span>
                          </div>
                          <p className="text-sm">{activity.description}</p>
                          {activity.resourceType && (
                            <p className="text-xs text-gray-500 mt-1">
                              Resource: {activity.resourceType}
                              {activity.resourceId && ` (${activity.resourceId.substring(0, 20)}...)`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        {formatDate(activity.timestamp)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
