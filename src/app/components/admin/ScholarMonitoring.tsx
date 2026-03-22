import { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Search, 
  Download, 
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';

const scholars = [
  { id: 'S2023-001', name: 'Dela Cruz, Maria', program: 'BS Computer Science', scholarship: 'TES', gwa: '1.45', status: 'Active', roProgress: '100%', roStatus: 'complete' },
  { id: 'S2023-002', name: 'Santos, Juan', program: 'BS Business Admin', scholarship: 'TDP', gwa: '1.78', status: 'Active', roProgress: '75%', roStatus: 'progress' },
  { id: 'S2023-003', name: 'Reyes, Ana', program: 'BS Engineering', scholarship: 'TES', gwa: '2.15', status: 'At Risk', roProgress: '50%', roStatus: 'progress' },
  { id: 'S2023-004', name: 'Garcia, Pedro', program: 'BS Education', scholarship: 'Private', gwa: '1.62', status: 'Active', roProgress: '100%', roStatus: 'complete' },
  { id: 'S2023-005', name: 'Lopez, Rosa', program: 'BS Nursing', scholarship: 'TES', gwa: '1.55', status: 'Active', roProgress: '80%', roStatus: 'progress' },
  { id: 'S2023-006', name: 'Martinez, Carlos', program: 'BS Computer Science', scholarship: 'TDP', gwa: '2.35', status: 'At Risk', roProgress: '25%', roStatus: 'behind' },
  { id: 'S2023-007', name: 'Fernandez, Lisa', program: 'BS Psychology', scholarship: 'TES', gwa: '1.42', status: 'Active', roProgress: '100%', roStatus: 'complete' },
  { id: 'S2023-008', name: 'Torres, Miguel', program: 'BS Architecture', scholarship: 'Private', gwa: '1.88', status: 'Active', roProgress: '90%', roStatus: 'progress' },
  { id: 'S2023-009', name: 'Villanueva, Sofia', program: 'BS Accountancy', scholarship: 'TES', gwa: '1.35', status: 'Active', roProgress: '100%', roStatus: 'complete' },
  { id: 'S2023-010', name: 'Ramos, Daniel', program: 'BS Engineering', scholarship: 'TDP', gwa: '2.05', status: 'At Risk', roProgress: '60%', roStatus: 'progress' },
];

export default function ScholarMonitoring() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProgram, setFilterProgram] = useState('all');
  const [filterScholarship, setFilterScholarship] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const getGWAColor = (gwa: string) => {
    const gwaNum = parseFloat(gwa);
    if (gwaNum >= 2.0) return 'text-red-600 font-bold';
    if (gwaNum >= 1.75) return 'text-orange-600';
    return 'text-green-600';
  };

  const getROProgressColor = (progress: string, status: string) => {
    if (status === 'complete') return 'bg-green-500';
    if (status === 'behind') return 'bg-red-500';
    return 'bg-orange-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Active Scholars</h1>
          <p className="text-gray-600 mt-1">1,280 total scholars</p>
        </div>
        <Button className="bg-[#10B981] hover:bg-[#10B981]/90 text-white">
          <Download className="w-4 h-4 mr-2" />
          Export Master List
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="shadow-md">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by ID or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Program Filter */}
            <Select value={filterProgram} onValueChange={setFilterProgram}>
              <SelectTrigger>
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                <SelectItem value="cs">Computer Science</SelectItem>
                <SelectItem value="eng">Engineering</SelectItem>
                <SelectItem value="bus">Business Admin</SelectItem>
                <SelectItem value="edu">Education</SelectItem>
              </SelectContent>
            </Select>

            {/* Scholarship Filter */}
            <Select value={filterScholarship} onValueChange={setFilterScholarship}>
              <SelectTrigger>
                <SelectValue placeholder="All Scholarships" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scholarships</SelectItem>
                <SelectItem value="tes">TES</SelectItem>
                <SelectItem value="tdp">TDP</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="at-risk">At Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Scholars Table */}
      <Card className="shadow-md">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">ID</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Program</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Scholarship</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">GWA</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">RO Progress</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scholars.map((scholar, index) => (
                  <tr 
                    key={scholar.id} 
                    className={`hover:bg-blue-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } ${parseFloat(scholar.gwa) >= 2.0 ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{scholar.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{scholar.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{scholar.program}</td>
                    <td className="px-6 py-4">
                      <Badge className={
                        scholar.scholarship === 'TES' ? 'bg-blue-100 text-blue-800' :
                        scholar.scholarship === 'TDP' ? 'bg-green-100 text-green-800' :
                        'bg-purple-100 text-purple-800'
                      }>
                        {scholar.scholarship}
                      </Badge>
                    </td>
                    <td className={`px-6 py-4 text-sm ${getGWAColor(scholar.gwa)}`}>
                      {scholar.gwa}
                      {parseFloat(scholar.gwa) >= 2.0 && (
                        <AlertTriangle className="w-4 h-4 inline ml-1 text-red-600" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={
                        scholar.status === 'Active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }>
                        {scholar.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                          <div 
                            className={`h-2 rounded-full ${getROProgressColor(scholar.roProgress, scholar.roStatus)}`}
                            style={{ width: scholar.roProgress }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 w-12 text-right">{scholar.roProgress}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Button size="sm" variant="outline">
                        <Eye className="w-4 h-4 mr-1" />
                        VIEW PROFILE
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">Showing 1-10 of 1,280 scholars</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="bg-[#1E3A8A] text-white">1</Button>
              <Button variant="outline" size="sm">2</Button>
              <Button variant="outline" size="sm">3</Button>
              <span className="px-2">...</span>
              <Button variant="outline" size="sm">128</Button>
              <Button variant="outline" size="sm">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-md">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-[#1E3A8A]">1,280</p>
            <p className="text-sm text-gray-600 mt-1">Total Scholars</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-green-600">1,103</p>
            <p className="text-sm text-gray-600 mt-1">Active Status</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-orange-600">177</p>
            <p className="text-sm text-gray-600 mt-1">At Risk (GWA ≥ 2.0)</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-blue-600">1.68</p>
            <p className="text-sm text-gray-600 mt-1">Average GWA</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
