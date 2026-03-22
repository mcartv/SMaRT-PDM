import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Search, 
  Filter, 
  Download, 
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const applications = [
  { id: '2025-001', name: 'Dela Cruz, Juan', program: 'TES', submitted: 'Oct 20, 2025', status: 'Documents Ready', statusColor: 'bg-green-100 text-green-800' },
  { id: '2025-002', name: 'Santos, Maria', program: 'TDP', submitted: 'Oct 21, 2025', status: 'Missing Grade', statusColor: 'bg-red-100 text-red-800' },
  { id: '2025-003', name: 'Reyes, Ana', program: 'TES', submitted: 'Oct 19, 2025', status: 'Under Review', statusColor: 'bg-orange-100 text-orange-800' },
  { id: '2025-004', name: 'Garcia, Pedro', program: 'Private', submitted: 'Oct 22, 2025', status: 'Approved', statusColor: 'bg-blue-100 text-blue-800' },
  { id: '2025-005', name: 'Lopez, Rosa', program: 'TES', submitted: 'Oct 18, 2025', status: 'Documents Ready', statusColor: 'bg-green-100 text-green-800' },
  { id: '2025-006', name: 'Martinez, Carlos', program: 'TDP', submitted: 'Oct 23, 2025', status: 'Missing Grade', statusColor: 'bg-red-100 text-red-800' },
  { id: '2025-007', name: 'Fernandez, Lisa', program: 'TES', submitted: 'Oct 17, 2025', status: 'Under Review', statusColor: 'bg-orange-100 text-orange-800' },
  { id: '2025-008', name: 'Torres, Miguel', program: 'TES', submitted: 'Oct 24, 2025', status: 'Documents Ready', statusColor: 'bg-green-100 text-green-800' },
  { id: '2025-009', name: 'Villanueva, Sofia', program: 'Private', submitted: 'Oct 16, 2025', status: 'Under Review', statusColor: 'bg-orange-100 text-orange-800' },
  { id: '2025-010', name: 'Ramos, Daniel', program: 'TDP', submitted: 'Oct 25, 2025', status: 'Approved', statusColor: 'bg-blue-100 text-blue-800' },
];

export default function ApplicationReview() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);

  const toggleSelection = (id: string) => {
    setSelectedApps(prev => 
      prev.includes(id) ? prev.filter(appId => appId !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedApps(selectedApps.length === applications.length ? [] : applications.map(a => a.id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Review Applications</h1>
          <p className="text-gray-600 mt-1">24 pending review</p>
        </div>
        <Button className="bg-[#10B981] hover:bg-[#10B981]/90 text-white">
          <Download className="w-4 h-4 mr-2" />
          Export List
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="shadow-md">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Program Filter */}
              <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  <SelectItem value="tes">TES</SelectItem>
                  <SelectItem value="tdp">TDP</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="ready">Documents Ready</SelectItem>
                  <SelectItem value="missing">Missing Docs</SelectItem>
                  <SelectItem value="review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Range */}
              <Input type="date" placeholder="Date range" />
            </div>

            {/* Advanced Filters Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Advanced Filters
            </Button>

            {showAdvancedFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Year Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1st Year</SelectItem>
                    <SelectItem value="2">2nd Year</SelectItem>
                    <SelectItem value="3">3rd Year</SelectItem>
                    <SelectItem value="4">4th Year</SelectItem>
                  </SelectContent>
                </Select>

                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eng">Engineering</SelectItem>
                    <SelectItem value="bus">Business</SelectItem>
                    <SelectItem value="arts">Arts & Sciences</SelectItem>
                    <SelectItem value="edu">Education</SelectItem>
                  </SelectContent>
                </Select>

                <Input placeholder="GWA range (e.g., 1.0-2.0)" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card className="shadow-md">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedApps.length === applications.length}
                      onChange={toggleAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Student Name</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">ID</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Program</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Submitted</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applications.map((app, index) => (
                  <tr key={app.id} className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedApps.includes(app.id)}
                        onChange={() => toggleSelection(app.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{app.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{app.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{app.program}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{app.submitted}</td>
                    <td className="px-6 py-4">
                      <Badge className={app.statusColor}>{app.status}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate(`/admin/applications/${app.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        VIEW
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bulk Actions */}
          {selectedApps.length > 0 && (
            <div className="p-4 bg-blue-50 border-t border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {selectedApps.length} application(s) selected
                </span>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-[#10B981] hover:bg-[#10B981]/90 text-white">
                    Approve Selected
                  </Button>
                  <Button size="sm" variant="outline" className="border-orange-500 text-orange-600">
                    Request Changes
                  </Button>
                  <Button size="sm" variant="outline">
                    Export List
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Pagination */}
          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">Showing 1-10 of 24 applications</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="bg-[#1E3A8A] text-white">1</Button>
              <Button variant="outline" size="sm">2</Button>
              <Button variant="outline" size="sm">3</Button>
              <span className="px-2">...</span>
              <Button variant="outline" size="sm">10</Button>
              <Button variant="outline" size="sm">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
